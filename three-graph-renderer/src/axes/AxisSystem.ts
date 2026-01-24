import { Line, BufferGeometry, LineBasicMaterial, Vector3, Scene, Camera, Frustum, Matrix4 } from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ThemeConfig } from '../config/ThemeConfig';

export class AxisSystem {
    private scene: Scene;
    private xLine: Line;
    private yLine: Line;
    private zLine: Line;


    private pool: CSS2DObject[] = [];
    private activeLabels: Set<CSS2DObject> = new Set();

    private frustum = new Frustum();
    private projScreenMatrix = new Matrix4();

    constructor(scene: Scene, theme: ThemeConfig) {
        this.scene = scene;

        // Create Infinite Lines (Geometry big enough to seem infinite)
        const EXTENT = 10000;

        const mat = new LineBasicMaterial({ color: theme.axisColor });

        // X Axis
        this.xLine = new Line(new BufferGeometry().setFromPoints([new Vector3(-EXTENT, 0, 0), new Vector3(EXTENT, 0, 0)]), mat);
        // Y Axis (Depth in ThreeJS typically, but here Y)
        this.yLine = new Line(new BufferGeometry().setFromPoints([new Vector3(0, -EXTENT, 0), new Vector3(0, EXTENT, 0)]), mat);
        // Z Axis (Up)
        this.zLine = new Line(new BufferGeometry().setFromPoints([new Vector3(0, 0, -EXTENT), new Vector3(0, 0, EXTENT)]), mat);

        scene.add(this.xLine);
        scene.add(this.yLine);
        scene.add(this.zLine);

        // Pre-populate pool
        for (let i = 0; i < 50; i++) {
            this.pool.push(this.createLabelObject());
        }
    }

    private createLabelObject(): CSS2DObject {
        const div = document.createElement('div');
        div.className = 'axis-label';
        div.style.color = 'var(--text-normal, #888)';
        div.style.fontFamily = 'var(--font-interface, sans-serif)';
        div.style.fontSize = '12px';
        div.style.userSelect = 'none';
        div.style.position = 'absolute'; // Ensure it doesn't flow
        return new CSS2DObject(div);
    }

    public update(camera: Camera, bounds?: { xMin: number, xMax: number, yMin: number, yMax: number, zMin: number, zMax: number }, tickSpacing?: number) {
        // 1. Culling Logic
        // Update frustum
        this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

        // 2. Determine visible ticks
        const dist = camera.position.length();
        let step = tickSpacing || 1;

        // If no tickSpacing provided (legacy), fall back to distance heuristic
        if (!tickSpacing) {
            if (dist > 20) step = 5;
            if (dist > 100) step = 20;
        }

        const visibleRange = dist * 1.5;

        // Define ranges to iterate
        let xMin = -visibleRange, xMax = visibleRange;
        let yMin = -visibleRange, yMax = visibleRange;
        let zMin = -visibleRange, zMax = visibleRange;

        if (bounds) {
            // Constrain ticks to the bounding box + some margin? Or just show ticks within bounds.
            xMin = bounds.xMin; xMax = bounds.xMax;
            yMin = bounds.yMin; yMax = bounds.yMax;
            zMin = bounds.zMin; zMax = bounds.zMax;
        }

        const ticks: Vector3[] = [];

        // Generate ticks
        // Snap start to step
        const startX = Math.ceil(xMin / step) * step;
        const startY = Math.ceil(yMin / step) * step;
        const startZ = Math.ceil(zMin / step) * step;

        for (let x = startX; x <= xMax; x += step) {
            if (Math.abs(x) < 1e-10) continue; // Skip origin
            ticks.push(new Vector3(x, 0, 0));
        }

        for (let z = startZ; z <= zMax; z += step) {
            if (Math.abs(z) < 1e-10) continue;
            ticks.push(new Vector3(0, 0, z));
        }

        // Y axis
        for (let y = startY; y <= yMax; y += step) {
            if (Math.abs(y) < 1e-10) continue;
            ticks.push(new Vector3(0, y, 0));
        }

        // 3. Render Labels
        // Clear current active labels (return to pool)
        this.activeLabels.forEach(lbl => {
            if (this.scene.children.includes(lbl)) {
                this.scene.remove(lbl);
            }
            this.pool.push(lbl);
        });
        this.activeLabels.clear();

        // Assign new labels
        for (const pos of ticks) {
            // Frustum check (optimization: don't even create/fetch label if point is outside)
            if (!this.frustum.containsPoint(pos)) continue;

            let lbl = this.pool.pop();
            if (!lbl) lbl = this.createLabelObject(); // Grow pool if empty

            lbl.position.copy(pos);
            // Format text
            // Determine value based on axis
            let val = 0;
            if (Math.abs(pos.y) > 0.001) val = pos.y;
            else if (Math.abs(pos.z) > 0.001) val = pos.z;
            else val = pos.x;

            // Format to reasonable decimals
            lbl.element.textContent = Number.isInteger(val) ? val.toString() : val.toFixed(2);

            this.scene.add(lbl);
            this.activeLabels.add(lbl);
        }
    }

    public updateTheme(theme: ThemeConfig) {
        (this.xLine.material as LineBasicMaterial).color.set(theme.axisColor);
        (this.yLine.material as LineBasicMaterial).color.set(theme.axisColor);
        (this.zLine.material as LineBasicMaterial).color.set(theme.axisColor);
    }
}
