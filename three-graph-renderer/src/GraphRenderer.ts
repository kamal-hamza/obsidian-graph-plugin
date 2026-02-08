import {
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
    Color,
    DirectionalLight,
    AmbientLight,
    Group,
    Vector3,
} from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { ThemeConfig, DEFAULT_THEME } from "./config/ThemeConfig";
import { InputController } from "./controls/InputController";
import { InteractionManager } from "./controls/InteractionManager";
import { AxisSystem } from "./axes/AxisSystem";
import { GridSystem } from "./axes/GridSystem";
import { GraphGeometry } from "./geometry/GraphGeometry";
import { WasmComputer } from "./wasm/WasmComputer";
import { Legend } from "./ui/Legend";
import { Colorbar } from "./ui/Colorbar";
import { NiceScale } from "./utils/NiceScale";

export interface GraphBounds {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zMin: number;
    zMax: number;
}

export class GraphRenderer {
    private container: HTMLElement | null = null;
    private renderer: WebGLRenderer;
    private labelRenderer: CSS2DRenderer;
    private scene: Scene;
    private graphGroup: Group;
    private camera: PerspectiveCamera;

    private input: InputController;
    private interactionManager: InteractionManager;
    private axisSystem: AxisSystem;
    private gridSystem: GridSystem;
    private traces: Map<string, GraphGeometry> = new Map();
    public computer: WasmComputer;

    private theme: ThemeConfig = DEFAULT_THEME;
    private resizeObserver: ResizeObserver;
    private needsUpdate: boolean = true;
    public isAutoRotating: boolean = false;

    // UI Components
    private legend: Legend;
    private colorbar: Colorbar;

    private lights: { ambient: AmbientLight; directional: DirectionalLight };

    // State for calculated bounds
    private activeBounds: GraphBounds | undefined;
    private activeSpacing: number | undefined;

    // Reactive Viewport State
    private lastCameraPosition = new Vector3();
    private lastCameraTarget = new Vector3();
    private isUpdating = false;
    private lastUpdateBounds = { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
    private formulas: Map<string, string> = new Map(); // Store formulas for regeneration

    private updateDebounceTimer: number | null = null;
    // Wait for a 400ms pause in movement before regenerating
    private readonly UPDATE_DEBOUNCE_MS = 400;

    constructor(wasmFactory?: any) {
        // 1. Core Three.js Setup
        this.scene = new Scene();
        this.scene.background = new Color(this.theme.backgroundColor);

        this.graphGroup = new Group();
        this.scene.add(this.graphGroup);

        this.camera = new PerspectiveCamera(60, 1, 0.1, 50000);
        this.camera.position.set(20, 20, 20); // Initial view
        this.camera.up.set(0, 0, 1); // Z-up setup

        this.renderer = new WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);

        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.domElement.style.position = "absolute";
        this.labelRenderer.domElement.style.top = "0px";
        this.labelRenderer.domElement.style.pointerEvents = "none";

        // 2. Lighting (New)
        this.lights = {
            ambient: new AmbientLight(0xffffff, 0.6), // Soft white light
            directional: new DirectionalLight(0xffffff, 0.8),
        };
        this.lights.directional.position.set(10, 20, 30);
        this.scene.add(this.lights.ambient);
        this.scene.add(this.lights.directional);

        // 3. Systems
        this.input = new InputController(this.camera, this.renderer);
        this.input.controls.addEventListener("change", () => {
            this.needsUpdate = true;
        });

        this.axisSystem = new AxisSystem(this.graphGroup, this.theme);
        this.gridSystem = new GridSystem(this.graphGroup, this.theme);

        // Initialize UI
        this.legend = new Legend();
        this.legend.setCallback((id, visible) => this.toggleTrace(id, visible));

        this.colorbar = new Colorbar();
        this.colorbar.updateColors(
            this.theme.colorMap.start,
            this.theme.colorMap.end,
        );

        // Initialize Interaction Manager
        this.interactionManager = new InteractionManager(
            this.camera,
            this.scene,
            this.renderer.domElement,
        );
        // Note: InteractionManager target will be set when adding traces if we want to hover,
        // but currently it handles a single mesh or needs modification to handle multiple.
        // For now, let's just not set a specific target or handle it in addTrace.

        this.computer = new WasmComputer(wasmFactory);

        this.resizeObserver = new ResizeObserver(() => this.onResize());

        // Start Loop
        this.animate();
    }

    public isReady(): Promise<void> {
        return this.computer.ready;
    }

    public mount(container: HTMLElement) {
        this.container = container;
        container.style.position = "relative";

        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.labelRenderer.setSize(
            container.clientWidth,
            container.clientHeight,
        );

        container.appendChild(this.renderer.domElement);
        container.appendChild(this.labelRenderer.domElement);

        // Append UI
        container.appendChild(this.legend.getElement());
        container.appendChild(this.colorbar.getElement());

        this.resizeObserver.observe(container);
        this.onResize();
        this.needsUpdate = true;
    }

    public destroy() {
        if (this.container) {
            this.container.removeChild(this.renderer.domElement);
            this.container.removeChild(this.labelRenderer.domElement);
            this.container.removeChild(this.legend.getElement());
            this.container.removeChild(this.colorbar.getElement());
            this.resizeObserver.disconnect();
        }
        this.input.dispose();
        this.interactionManager.dispose();
        this.gridSystem.dispose();
        this.renderer.dispose();
    }

    public updateTheme(theme: ThemeConfig) {
        this.theme = theme;
        this.scene.background = new Color(theme.backgroundColor);
        this.axisSystem.updateTheme(theme);
        this.gridSystem.updateTheme(theme);

        // Update Spikelines Theme
        this.interactionManager.updateTheme(theme.axisColor);

        this.colorbar.updateColors(theme.colorMap.start, theme.colorMap.end);

        // Update all traces
        this.traces.forEach((trace) => {
            const mat = trace.getMaterial();
            mat.setColors(theme.colorMap.start, theme.colorMap.end);
            trace.setContourColor(theme.contourColor);
        });

        this.needsUpdate = true;
    }

    public async setExpression(formula: string) {
        // Add as the default trace
        await this.addTrace('default', formula);

        // Initialize lastUpdateBounds to the active bounds to prevent immediate re-render
        if (this.activeBounds) {
            this.lastUpdateBounds = {
                xMin: this.activeBounds.xMin,
                xMax: this.activeBounds.xMax,
                yMin: this.activeBounds.yMin,
                yMax: this.activeBounds.yMax,
            };
        }
    }

    private updateAspectRatio() {
        // To maintain a perfect cubic sense of scale, we force a 1:1:1 visual scale.
        // This ensures that the box stays a cube and the axes are visually equal.
        // The uniform cubic bounds calculated in addTrace() already include appropriate padding.
        this.graphGroup.scale.set(1, 1, 1);
    }

    public async addTrace(
        id: string,
        formula: string,
        range?: any,
        resolutionOverride?: number,
    ) {
        // Store the formula so it can be used for dynamic updates later
        this.formulas.set(id, formula);

        // Determine resolution based on the size of the range
        // Higher range = more points to keep it smooth
        const span = range?.xMax - range?.xMin || 20;
        const calcResolution = Math.min(
            250,
            Math.max(100, Math.floor(span * 10)),
        );
        const resolution = resolutionOverride || calcResolution;

        // Initial Raw Range
        const rawRange = range || { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };

        // 1. Calculate initial data to find Z-range
        const initialData = this.computer.calculate(formula, rawRange, 100);
        let calculatedMinZ = Infinity;
        let calculatedMaxZ = -Infinity;

        if (initialData) {
            for (let i = 0; i < initialData.length; i += 3) {
                const z = initialData[i + 2];
                if (z < calculatedMinZ) calculatedMinZ = z;
                if (z > calculatedMaxZ) calculatedMaxZ = z;
            }
        }

        // Fallbacks for flat/empty data
        if (calculatedMinZ === Infinity) {
            calculatedMinZ = -1;
            calculatedMaxZ = 1;
        }
        if (Math.abs(calculatedMaxZ - calculatedMinZ) < 1e-5) {
            calculatedMinZ -= 1;
            calculatedMaxZ += 1;
        }

        // 2. CALCULATE UNIFORM CUBIC BOUNDS - always use for equal-length axes
        const xSpan = Math.abs(rawRange.xMax - rawRange.xMin);
        const ySpan = Math.abs(rawRange.yMax - rawRange.yMin);
        const zSpan = Math.abs(calculatedMaxZ - calculatedMinZ);

        // Find the largest span and add 20% padding
        const maxSpan = Math.max(xSpan, ySpan, zSpan) * 1.2;

        const centerX = (rawRange.xMax + rawRange.xMin) / 2;
        const centerY = (rawRange.yMax + rawRange.yMin) / 2;
        const centerZ = (calculatedMaxZ + calculatedMinZ) / 2;

        // Apply the same span to all axes for cubic bounding box
        const niceX = new NiceScale(centerX - maxSpan / 2, centerX + maxSpan / 2);
        const niceY = new NiceScale(centerY - maxSpan / 2, centerY + maxSpan / 2);
        const niceZ = new NiceScale(centerZ - maxSpan / 2, centerZ + maxSpan / 2);

        // Create separate nice scale for actual data Z-range (for gradient colors)
        const dataZScale = new NiceScale(calculatedMinZ, calculatedMaxZ);

        const bounds = {
            xMin: niceX.getNiceMin(),
            xMax: niceX.getNiceMax(),
            yMin: niceY.getNiceMin(),
            yMax: niceY.getNiceMax(),
            zMin: niceZ.getNiceMin(),
            zMax: niceZ.getNiceMax(),
        };

        // Store the actual data Z-range for gradient mapping
        const dataZBounds = {
            zMin: dataZScale.getNiceMin(),
            zMax: dataZScale.getNiceMax(),
        };

        // 3. Calculate data using appropriate range
        // For initial load (no range provided), use the raw range to avoid over-expansion
        // For dynamic updates (range provided), use that range to fill viewport
        const samplingRange = range || rawRange;
        const data = this.computer.calculate(formula, samplingRange, resolution);

        // Use largest spacing for uniform grid/ticks? Or independent?
        const primarySpacing = niceX.getTickSpacing();

        // If trace exists, update it. If not, create new.
        let geometry = this.traces.get(id);
        if (!geometry) {
            geometry = new GraphGeometry();
            this.traces.set(id, geometry);
            this.graphGroup.add(geometry.getObject());
            this.graphGroup.add(geometry.getContourObject());

            // Set initial styles
            const mat = geometry.getMaterial();
            mat.setColors(this.theme.colorMap.start, this.theme.colorMap.end);
            geometry.setContourColor(this.theme.contourColor);

            // Add to legend
            this.legend.addTrace(id, this.theme.colorMap.end);

            this.interactionManager.setTarget(geometry.getObject());
        }

        // Update active bounds state
        this.activeBounds = bounds;
        this.activeSpacing = primarySpacing;

        // Collect Ticks
        const ticks = {
            x: niceX.getTicks(),
            y: niceY.getTicks(),
            z: niceZ.getTicks(),
        };

        // Update Grids & Walls
        // We pass bounds and explicit ticks
        this.gridSystem.updateBounds(bounds, ticks);

        // Update Interaction Manager
        this.interactionManager.updateBounds(bounds);

        // Update Colorbar bounds (using actual data z bounds for gradient)
        this.colorbar.updateBounds(dataZBounds.zMin, dataZBounds.zMax);

        // Set Floor Level
        geometry.setFloorLevel(bounds.zMin);

        // Update Aspect Ratio (force 1:1:1 for cubic scale)
        this.updateAspectRatio();

        // Update data only if it is valid AND not empty
        if (data && data.length > 0) {
            geometry.updateData(data, resolution);
            
            // IMPORTANT: Use actual data Z-range for gradient colors, not cubic bounds
            // This ensures colors map to the real data range, not the expanded cubic box
            const mat = geometry.getMaterial();
            mat.setZRange(dataZBounds.zMin, dataZBounds.zMax);

            this.container?.appendChild(this.legend.getElement()); // Ensure legend is there if mounting happened
            this.needsUpdate = true;
        } else {
            console.warn(`[GraphRenderer] Trace update skipped: WASM returned ${data ? 'empty' : 'null'} data.`);
        }
    }

    private calculateLOD(span: number): number {
        let resolution: number;

        if (span < 10) {
            // Ultra-close zoom: Use very high density (500x500 grid)
            resolution = 500;
        } else if (span < 30) {
            resolution = 400;
        } else if (span < 100) {
            resolution = 300;
        } else if (span < 500) {
            resolution = 250;
        } else {
            resolution = 200;
        }

        return Math.max(150, resolution);
    }

    private scheduleUpdate() {
        if (this.isUpdating) {
            console.log("[GraphRenderer] Update skipped: Already updating");
            return;
        }

        if (this.updateDebounceTimer !== null) {
            window.clearTimeout(this.updateDebounceTimer);
        }

        this.updateDebounceTimer = window.setTimeout(() => {
            console.log(
                "[GraphRenderer] Debounce fired, calling updateDynamicView",
            );
            this.updateDynamicView();
            this.updateDebounceTimer = null;
        }, this.UPDATE_DEBOUNCE_MS);
    }

    private async updateDynamicView() {
        console.log("[GraphRenderer] updateDynamicView started");
        if (this.isUpdating) return;
        this.isUpdating = true;

        try {
            const target = this.input.controls.target;
            const dist = this.camera.position.distanceTo(target);

            // Calculate visible frustum bounds at z=0 plane
            const vFOV =
                ((this.camera as PerspectiveCamera).fov * Math.PI) / 180;
            const aspect = (this.camera as PerspectiveCamera).aspect;

            // Calculate visible height and width at the target distance
            const visibleHeight = 2 * Math.tan(vFOV / 2) * dist;
            const visibleWidth = visibleHeight * aspect;

            console.log(
                `[GraphRenderer] Frustum Calc: dist=${dist.toFixed(2)}, vH=${visibleHeight.toFixed(2)}, vW=${visibleWidth.toFixed(2)}`,
            );

            // USE BUFFER TO CREATE MARGINS
            // 1.1 fills the view with a slight safety margin for panning
            const bufferFactor = 1.1;
            const halfWidth = (visibleWidth / 2) * bufferFactor;
            const halfHeight = (visibleHeight / 2) * bufferFactor;

            const span = Math.max(halfWidth, halfHeight) * 2;
            console.log(`[GraphRenderer] Calculated span: ${span.toFixed(2)}`);

            // Check if update needed (Hysteresis)
            const currentSpan =
                this.lastUpdateBounds.xMax - this.lastUpdateBounds.xMin;
            const currentCenterX =
                (this.lastUpdateBounds.xMax + this.lastUpdateBounds.xMin) / 2;
            const currentCenterY =
                (this.lastUpdateBounds.yMax + this.lastUpdateBounds.yMin) / 2;

            // REFINED TRIGGER LOGIC - More sensitive for better responsiveness
            // 1. Zoom Out: Regenerate earlier when view expands 50% beyond current graph
            const zoomOutTrigger = span > currentSpan * 1.5;

            // 2. Zoom In: Regenerate when viewing less than 70% of the current graph
            // This ensures we get higher resolution before it looks "pixelated."
            const zoomInTrigger = span < currentSpan * 0.7;

            const zoomChanged = zoomInTrigger || zoomOutTrigger;

            const posChanged =
                Math.sqrt(
                    Math.pow(target.x - currentCenterX, 2) +
                        Math.pow(target.y - currentCenterY, 2),
                ) >
                span * 0.2; // 20% of visible area

            console.log(
                `[GraphRenderer] Change Check: currentSpan=${currentSpan.toFixed(2)}, zoomChanged=${zoomChanged}, posChanged=${posChanged}`,
            );

            if (!zoomChanged && !posChanged && currentSpan > 0) {
                console.log(
                    "[GraphRenderer] No significant change, skipping update",
                );
                return;
            }

            const dynamicRange = {
                xMin: target.x - halfWidth,
                xMax: target.x + halfWidth,
                yMin: target.y - halfHeight,
                yMax: target.y + halfHeight,
            };

            // Perform single high-resolution update for all traces
            if (this.formulas.size > 0) {
                // Determine the ideal resolution once
                const res = this.calculateLOD(span);
                console.log(
                    `[GraphRenderer] Triggering Update for ${this.formulas.size} trace(s): res=${res}, range=`,
                    dynamicRange,
                );
                
                // Update all traces in parallel
                const updatePromises = Array.from(this.formulas.entries()).map(([id, formula]) => {
                    return this.addTrace(
                        id,
                        formula,
                        dynamicRange,
                        res,
                    );
                });

                // Wait for all WASM calculations to finish
                await Promise.all(updatePromises);
            } else {
                console.warn(
                    "[GraphRenderer] Skipping update: No formulas registered",
                );
            }

            this.lastUpdateBounds = {
                xMin: dynamicRange.xMin,
                xMax: dynamicRange.xMax,
                yMin: dynamicRange.yMin,
                yMax: dynamicRange.yMax,
            };
        } finally {
            this.isUpdating = false;
            console.log("[GraphRenderer] updateDynamicView finished");
        }
    }

    public removeTrace(id: string) {
        const geometry = this.traces.get(id);
        if (geometry) {
            this.graphGroup.remove(geometry.getObject());
            this.graphGroup.remove(geometry.getContourObject());
            this.traces.delete(id);
            this.formulas.delete(id);
            this.legend.removeTrace(id);
            this.needsUpdate = true;
        }
    }

    public toggleTrace(id: string, visible: boolean) {
        const geometry = this.traces.get(id);
        if (geometry) {
            geometry.getObject().visible = visible;
            geometry.getContourObject().visible = visible;
            this.needsUpdate = true;
        }
    }

    public setZClipping(min: number, max: number) {
        this.traces.forEach((trace) => {
            trace.getMaterial().setClipRange(min, max);
        });
        this.needsUpdate = true;
    }

    public setView(type: "top" | "side" | "isometric") {
        switch (type) {
            case "top":
                this.camera.position.set(0, 0, 50);
                break;
            case "side":
                this.camera.position.set(0, 50, 0);
                break;
            case "isometric":
                this.camera.position.set(25, 25, 25);
                break;
        }
        this.camera.lookAt(0, 0, 0);
        this.input.controls.update();
        this.needsUpdate = true;
    }

    private onResize() {
        if (!this.container) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        this.labelRenderer.setSize(width, height);
        this.needsUpdate = true;
    }

    private animate = () => {
        requestAnimationFrame(this.animate);

        if (this.isAutoRotating) {
            this.graphGroup.rotation.z += 0.005; // Slowly spin the graph
            this.needsUpdate = true;
        }

        // Check if camera moved significantly (Pos + Target)
        const cameraChanged =
            this.camera.position.distanceTo(this.lastCameraPosition) > 0.1;
        // @ts-ignore - OrbitControls target access
        const targetChanged =
            this.input.controls.target.distanceTo(this.lastCameraTarget) > 0.1;

        if (cameraChanged || targetChanged) {
            console.log(
                `[GraphRenderer] Camera movement detected. CamDiff: ${this.camera.position.distanceTo(this.lastCameraPosition).toFixed(3)}, TargetDiff: ${this.input.controls.target.distanceTo(this.lastCameraTarget).toFixed(3)}`,
            );
            this.scheduleUpdate(); // Use debounced version
            this.lastCameraPosition.copy(this.camera.position);
            // @ts-ignore - OrbitControls target access
            this.lastCameraTarget.copy(this.input.controls.target);
            this.needsUpdate = true;
        }

        // FIX: Check if interaction changed. If it did, we MUST render.
        const interactionActive = this.interactionManager.update();

        if (this.needsUpdate || interactionActive) {
            this.input.update();

            this.axisSystem.update(
                this.camera,
                this.activeBounds,
                this.activeSpacing,
            );
            this.gridSystem.update(this.camera);

            this.renderer.render(this.scene, this.camera);
            this.labelRenderer.render(this.scene, this.camera);

            this.needsUpdate = false;
        }
    };
}
