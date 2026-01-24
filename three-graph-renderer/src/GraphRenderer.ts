import { Scene, PerspectiveCamera, WebGLRenderer, Color, DirectionalLight, AmbientLight, Group } from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ThemeConfig, DEFAULT_THEME } from './config/ThemeConfig';
import { InputController } from './controls/InputController';
import { InteractionManager } from './controls/InteractionManager';
import { AxisSystem } from './axes/AxisSystem';
import { GridSystem } from './axes/GridSystem';
import { GraphGeometry } from './geometry/GraphGeometry';
import { WasmComputer } from './wasm/WasmComputer';
import { Legend } from './ui/Legend';
import { Colorbar } from './ui/Colorbar';
import { NiceScale } from './utils/NiceScale';

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

    private lights: { ambient: AmbientLight, directional: DirectionalLight };

    // State for calculated bounds
    private activeBounds: GraphBounds | undefined;
    private activeSpacing: number | undefined;

    constructor(wasmFactory?: any) {
        // 1. Core Three.js Setup
        this.scene = new Scene();
        this.scene.background = new Color(this.theme.backgroundColor);

        this.graphGroup = new Group();
        this.scene.add(this.graphGroup);

        this.camera = new PerspectiveCamera(60, 1, 0.1, 50000);
        this.camera.position.set(20, 20, 20); // Initial view
        this.camera.up.set(0, 0, 1); // Z-up setup 

        this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setPixelRatio(window.devicePixelRatio);

        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0px';
        this.labelRenderer.domElement.style.pointerEvents = 'none';

        // 2. Lighting (New)
        this.lights = {
            ambient: new AmbientLight(0xffffff, 0.6), // Soft white light
            directional: new DirectionalLight(0xffffff, 0.8)
        };
        this.lights.directional.position.set(10, 20, 30);
        this.scene.add(this.lights.ambient);
        this.scene.add(this.lights.directional);

        // 3. Systems
        this.input = new InputController(this.camera, this.renderer);
        this.input.controls.addEventListener('change', () => { this.needsUpdate = true; });

        this.axisSystem = new AxisSystem(this.graphGroup, this.theme);
        this.gridSystem = new GridSystem(this.graphGroup, this.theme);

        // Initialize UI
        this.legend = new Legend();
        this.legend.setCallback((id, visible) => this.toggleTrace(id, visible));

        this.colorbar = new Colorbar();
        this.colorbar.updateColors(this.theme.colorMap.start, this.theme.colorMap.end);

        // Initialize Interaction Manager
        this.interactionManager = new InteractionManager(this.camera, this.scene, this.renderer.domElement);
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
        container.style.position = 'relative';

        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.labelRenderer.setSize(container.clientWidth, container.clientHeight);

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
        this.traces.forEach(trace => {
            const mat = trace.getMaterial();
            mat.setColors(theme.colorMap.start, theme.colorMap.end);
            trace.setContourColor(theme.contourColor);
        });

        this.needsUpdate = true;
    }

    public async setExpression(formula: string) {
        // Backward compatibility
        await this.addTrace('default', formula);
    }

    private updateAspectRatio() {
        if (!this.activeBounds) return;

        const xSize = Math.abs(this.activeBounds.xMax - this.activeBounds.xMin);
        const ySize = Math.abs(this.activeBounds.yMax - this.activeBounds.yMin);
        const zSize = Math.abs(this.activeBounds.zMax - this.activeBounds.zMin);

        if (zSize < 1e-9) return;

        const maxXY = Math.max(xSize, ySize);
        // Target Z visual size: at least 50% of the max dimension
        const targetZ = Math.max(zSize, maxXY * 0.5);
        const zScale = targetZ / zSize;

        this.graphGroup.scale.set(1, 1, zScale);
    }

    public async addTrace(id: string, formula: string) {
        const resolution = 150;
        // Initial Raw Range
        const rawRange = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };

        // 1. Calculate Data First
        const data = this.computer.calculate(formula, rawRange, resolution);

        // 2. Calculate actual Z bounds
        let calculatedMinZ = Infinity;
        let calculatedMaxZ = -Infinity;

        if (data) {
            for (let i = 0; i < data.length; i += 3) {
                const z = data[i + 2];
                if (z < calculatedMinZ) calculatedMinZ = z;
                if (z > calculatedMaxZ) calculatedMaxZ = z;
            }
        }

        // Handle edge case where data is empty or flat
        if (calculatedMinZ === Infinity || calculatedMaxZ === -Infinity) {
            calculatedMinZ = -1; calculatedMaxZ = 1;
        } else if (Math.abs(calculatedMaxZ - calculatedMinZ) < 1e-10) {
            calculatedMinZ -= 1; calculatedMaxZ += 1;
        }

        // 3. Compute "Nice" Scales (No artificial padding)
        const niceX = new NiceScale(rawRange.xMin, rawRange.xMax);
        const niceY = new NiceScale(rawRange.yMin, rawRange.yMax);
        const niceZ = new NiceScale(calculatedMinZ, calculatedMaxZ);

        const bounds = {
            xMin: niceX.getNiceMin(),
            xMax: niceX.getNiceMax(),
            yMin: niceY.getNiceMin(),
            yMax: niceY.getNiceMax(),
            zMin: niceZ.getNiceMin(),
            zMax: niceZ.getNiceMax()
        };

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

        // Update data
        this.activeBounds = bounds;
        this.activeSpacing = primarySpacing;

        // Collect Ticks
        const ticks = {
            x: niceX.getTicks(),
            y: niceY.getTicks(),
            z: niceZ.getTicks()
        };

        // Update Grids & Walls
        // We pass bounds and explicit ticks
        this.gridSystem.updateBounds(bounds, ticks);

        // Update Interaction Manager
        this.interactionManager.updateBounds(bounds);

        // Update Colorbar bounds (using nice z bounds)
        this.colorbar.updateBounds(bounds.zMin, bounds.zMax);

        // Set Floor Level
        geometry.setFloorLevel(bounds.zMin);

        // Update Aspect Ratio
        this.updateAspectRatio();


        // Update data
        if (data) {
            geometry.updateData(data, resolution);
            this.container?.appendChild(this.legend.getElement()); // Ensure legend is there if mounting happened
            this.needsUpdate = true;
        }
    }

    public removeTrace(id: string) {
        const geometry = this.traces.get(id);
        if (geometry) {
            this.graphGroup.remove(geometry.getObject());
            this.graphGroup.remove(geometry.getContourObject());
            // Dispose geometry/material?
            this.traces.delete(id);
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
        this.traces.forEach(trace => {
            trace.getMaterial().setClipRange(min, max);
        });
        this.needsUpdate = true;
    }

    public setView(type: 'top' | 'side' | 'isometric') {
        switch (type) {
            case 'top':
                this.camera.position.set(0, 0, 50);
                break;
            case 'side':
                this.camera.position.set(0, 50, 0);
                break;
            case 'isometric':
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

        // FIX: Check if interaction changed. If it did, we MUST render.
        const interactionActive = this.interactionManager.update();

        if (this.needsUpdate || interactionActive) {
            this.input.update();

            this.axisSystem.update(this.camera, this.activeBounds, this.activeSpacing);
            this.gridSystem.update(this.camera);

            this.renderer.render(this.scene, this.camera);
            this.labelRenderer.render(this.scene, this.camera);

            this.needsUpdate = false;
        }
    };
}
