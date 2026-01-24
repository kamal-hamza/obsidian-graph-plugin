import { Raycaster, Vector2, Vector3, Camera, Scene, Mesh, LineSegments, BufferGeometry, BufferAttribute, LineBasicMaterial } from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export interface GraphBounds {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zMin: number;
    zMax: number;
}

export class InteractionManager {
    private raycaster: Raycaster;
    private mouse: Vector2;
    private camera: Camera;
    private scene: Scene;
    private domElement: HTMLElement;
    private targetMesh: Mesh | null = null;

    private tooltip: CSS2DObject | null = null;
    private tooltipElement: HTMLDivElement | null = null;

    private spikelines: LineSegments | null = null;

    private bounds: GraphBounds = { xMin: -10, xMax: 10, yMin: -10, yMax: 10, zMin: -5, zMax: 5 };

    private isEnabled: boolean = true;

    constructor(camera: Camera, scene: Scene, domElement: HTMLElement) {
        this.camera = camera;
        this.scene = scene;
        this.domElement = domElement;

        this.raycaster = new Raycaster();
        this.mouse = new Vector2(-1, -1); // Initialize off-screen

        this.initTooltip();
        this.initSpikelines();

        this.domElement.addEventListener('mousemove', this.onMouseMove);
        this.domElement.addEventListener('mouseleave', this.onMouseLeave);
    }

    private initTooltip() {
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = 'graph-tooltip';
        this.tooltipElement.style.padding = '8px';
        this.tooltipElement.style.background = 'rgba(0, 0, 0, 0.8)';
        this.tooltipElement.style.color = '#fff';
        this.tooltipElement.style.borderRadius = '4px';
        this.tooltipElement.style.fontSize = '12px';
        this.tooltipElement.style.fontFamily = 'sans-serif';
        this.tooltipElement.style.pointerEvents = 'none'; // Essential
        this.tooltipElement.style.display = 'none';

        this.tooltip = new CSS2DObject(this.tooltipElement);
        this.tooltip.position.set(0, 0, 0);
        this.scene.add(this.tooltip);
    }

    private initSpikelines() {
        // 3 lines, 2 vertices each = 6 vertices
        const geometry = new BufferGeometry();
        const positions = new Float32Array(6 * 3); // 18 coords
        geometry.setAttribute('position', new BufferAttribute(positions, 3));

        const material = new LineBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.5,
            linewidth: 1 // Note: Three.js WebGLRenderer often ignores linewidth > 1
        });

        this.spikelines = new LineSegments(geometry, material);
        this.spikelines.frustumCulled = false;
        this.spikelines.visible = false;
        this.scene.add(this.spikelines);
    }

    public setTarget(mesh: Mesh) {
        this.targetMesh = mesh;
    }

    public updateBounds(bounds: GraphBounds) {
        this.bounds = bounds;
    }

    private onMouseMove = (event: MouseEvent) => {
        if (!this.isEnabled) return;

        const rect = this.domElement.getBoundingClientRect();

        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    private onMouseLeave = () => {
        this.mouse.set(-2, -2); // Move off-screen
        this.hideInteraction();
    }

    public updateTheme(axisColor: string) {
        if (this.spikelines) {
            (this.spikelines.material as LineBasicMaterial).color.set(axisColor);
        }
    }

    public update(): boolean {
        if (!this.targetMesh || !this.camera) return false;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        // If we want multiple targets, we need to pass them or update logic.
        // For now, assuming single target active or simple intersection.
        const intersects = this.raycaster.intersectObject(this.targetMesh);

        const wasVisible = this.spikelines?.visible || false;

        if (intersects.length > 0) {
            const point = intersects[0].point;
            this.showInteraction(point);
            return true; // We are interacting, keep rendering
        } else {
            this.hideInteraction();
            // If it was visible but now isn't, return true one last time to clear the spikes
            return wasVisible;
        }
    }

    private showInteraction(point: Vector3) {
        if (this.tooltipElement && this.tooltip) {
            this.tooltipElement.style.display = 'block';
            this.tooltipElement.textContent = `x: ${point.x.toFixed(2)}, y: ${point.y.toFixed(2)}, z: ${point.z.toFixed(2)}`;
            this.tooltip.position.copy(point);
            this.tooltip.position.z += 0.5; // Offset slightly above
        }

        if (this.spikelines) {
            this.spikelines.visible = true;
            const positions = this.spikelines.geometry.attributes.position as BufferAttribute;

            // Calculate Dynamic Walls consistent with GridSystem
            const cx = (this.bounds.xMin + this.bounds.xMax) / 2;
            const cy = (this.bounds.yMin + this.bounds.yMax) / 2;
            const cz = (this.bounds.zMin + this.bounds.zMax) / 2;

            const camPos = this.camera.position;

            const wallX = camPos.x > cx ? this.bounds.xMin : this.bounds.xMax;
            const wallY = camPos.y > cy ? this.bounds.yMin : this.bounds.yMax;
            const wallZ = camPos.z > cz ? this.bounds.zMin : this.bounds.zMax;

            // X-axis spike: (wallX, y, z) -> (x, y, z)
            positions.setXYZ(0, wallX, point.y, point.z);
            positions.setXYZ(1, point.x, point.y, point.z);

            // Y-axis spike: (x, wallY, z) -> (x, y, z)
            positions.setXYZ(2, point.x, wallY, point.z);
            positions.setXYZ(3, point.x, point.y, point.z);

            // Z-axis spike: (x, y, wallZ) -> (x, y, z)
            positions.setXYZ(4, point.x, point.y, wallZ);
            positions.setXYZ(5, point.x, point.y, point.z);

            positions.needsUpdate = true;
        }
    }

    private hideInteraction() {
        if (this.tooltipElement) {
            this.tooltipElement.style.display = 'none';
        }
        if (this.spikelines) {
            this.spikelines.visible = false;
        }
    }

    public dispose() {
        this.domElement.removeEventListener('mousemove', this.onMouseMove);
        this.domElement.removeEventListener('mouseleave', this.onMouseLeave);

        if (this.tooltip) {
            this.scene.remove(this.tooltip);
        }

        if (this.spikelines) {
            this.scene.remove(this.spikelines);
            this.spikelines.geometry.dispose();
            (this.spikelines.material as LineBasicMaterial).dispose();
        }

        this.tooltipElement?.remove();
    }
}
