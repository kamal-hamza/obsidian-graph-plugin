import { Scene, PerspectiveCamera, WebGLRenderer, Color, DirectionalLight, AmbientLight } from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ThemeConfig, DEFAULT_THEME } from './config/ThemeConfig';
import { InputController } from './controls/InputController';
import { AxisSystem } from './axes/AxisSystem';
import { GridSystem } from './axes/GridSystem';
import { GraphGeometry } from './geometry/GraphGeometry';
import { WasmComputer } from './compute/WasmComputer';

export class GraphRenderer {
    private container: HTMLElement | null = null;
    private renderer: WebGLRenderer;
    private labelRenderer: CSS2DRenderer;
    private scene: Scene;
    private camera: PerspectiveCamera;

    private input: InputController;
    private axisSystem: AxisSystem;
    private gridSystem: GridSystem;
    private graphGeometry: GraphGeometry;
    public computer: WasmComputer;

    private theme: ThemeConfig = DEFAULT_THEME;
    private resizeObserver: ResizeObserver;
    private needsUpdate: boolean = true;

    private lights: { ambient: AmbientLight, directional: DirectionalLight };

    constructor(wasmFactory?: any) {
        // 1. Core Three.js Setup
        this.scene = new Scene();
        this.scene.background = new Color(this.theme.backgroundColor);

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

        this.axisSystem = new AxisSystem(this.scene, this.theme);
        this.gridSystem = new GridSystem(this.scene, this.theme);

        this.graphGeometry = new GraphGeometry();
        this.scene.add(this.graphGeometry.getObject());
        this.scene.add(this.graphGeometry.getContourObject());

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

        this.resizeObserver.observe(container);
        this.onResize();
        this.needsUpdate = true;
    }

    public destroy() {
        if (this.container) {
            this.container.removeChild(this.renderer.domElement);
            this.container.removeChild(this.labelRenderer.domElement);
            this.resizeObserver.disconnect();
        }
        this.input.dispose();
        this.gridSystem.dispose();
        this.renderer.dispose();
    }

    public updateTheme(theme: ThemeConfig) {
        this.theme = theme;
        this.scene.background = new Color(theme.backgroundColor);
        this.axisSystem.updateTheme(theme);
        this.gridSystem.updateTheme(theme);

        // Update graph material
        const mat = this.graphGeometry.getMaterial();
        mat.setColors(theme.colorMap.start, theme.colorMap.end);

        // Update Contour Color
        this.graphGeometry.setContourColor(theme.contourColor);

        this.needsUpdate = true;
    }

    public async setExpression(formula: string) {
        // Demo range
        const range = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
        // Assume Z range for bounds calculation
        // In a real app, we'd calculate this from data or set fixed defaults
        const zBounds = { zMin: -5, zMax: 5 };
        const resolution = 150;

        // Update Grids & Walls
        this.gridSystem.updateBounds({
            ...range,
            ...zBounds
        });

        // Set Floor Level for Contours
        this.graphGeometry.setFloorLevel(zBounds.zMin);

        const data = this.computer.calculate(formula, range, resolution);
        if (data) {
            this.graphGeometry.updateData(data, resolution);
            this.needsUpdate = true;
        }
    }

    public setZClipping(min: number, max: number) {
        this.graphGeometry.getMaterial().setClipRange(min, max);
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

        if (this.needsUpdate) {
            this.input.update();

            this.axisSystem.update(this.camera);
            // Position-based grid fade
            // Note: gridSystem update expects Vector3, but we can pass camera.position
            this.gridSystem.update(this.camera.position);

            // Keep directional light loosely following camera for consistent illumination
            // this.lights.directional.position.copy(this.camera.position).add(new Vector3(5,5,10));

            this.renderer.render(this.scene, this.camera);
            this.labelRenderer.render(this.scene, this.camera);

            this.needsUpdate = false;
        }
    };
}
