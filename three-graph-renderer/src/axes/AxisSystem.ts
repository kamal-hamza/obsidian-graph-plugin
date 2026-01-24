import { Line, BufferGeometry, LineBasicMaterial, Vector3, Camera, Frustum, Matrix4, Object3D, Vector2 } from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ThemeConfig } from '../config/ThemeConfig';

export class AxisSystem {
    private parent: Object3D;
    private xLine: Line;
    private yLine: Line;
    private zLine: Line;


    private pool: CSS2DObject[] = [];
    private activeLabels: Set<CSS2DObject> = new Set();

    private frustum = new Frustum();
    private projScreenMatrix = new Matrix4();

    constructor(parent: Object3D, theme: ThemeConfig) {
        this.parent = parent;

        // Create Infinite Lines (Geometry big enough to seem infinite)
        const EXTENT = 10000;

        const mat = new LineBasicMaterial({ color: theme.axisColor });

        // X Axis
        this.xLine = new Line(new BufferGeometry().setFromPoints([new Vector3(-EXTENT, 0, 0), new Vector3(EXTENT, 0, 0)]), mat);
        // Y Axis (Depth in ThreeJS typically, but here Y)
        this.yLine = new Line(new BufferGeometry().setFromPoints([new Vector3(0, -EXTENT, 0), new Vector3(0, EXTENT, 0)]), mat);
        // Z Axis (Up)
        this.zLine = new Line(new BufferGeometry().setFromPoints([new Vector3(0, 0, -EXTENT), new Vector3(0, 0, EXTENT)]), mat);

        parent.add(this.xLine);
        parent.add(this.yLine);
        parent.add(this.zLine);

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

    public update(camera: Camera, bounds?: { xMin: number, xMax: number, yMin: number, yMax: number, zMin: number, zMax: number }, forceTickSpacing?: number) {
        if (!bounds) return;

        // 1. Update Matrices
        camera.updateMatrixWorld();
        this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

        // 2. Clear Labels
        this.activeLabels.forEach(lbl => {
            if (lbl.parent === this.parent) this.parent.remove(lbl);
            this.pool.push(lbl);
        });
        this.activeLabels.clear();

        // 3. Helper to project and calculate screen density
        const width = window.innerWidth; // Approximate or pass in
        const height = window.innerHeight;

        const project = (v: Vector3): Vector3 | null => {
            const p = v.clone();
            p.applyMatrix4(this.projScreenMatrix);
            // Check if behind camera
            if (p.z > 1) return null; // NDC z is -1 to 1 usually? In ThreeJS, outside 1 is clipped?
            // Actually applyMatrix4 produces NDC.
            return new Vector3(
                (p.x * 0.5 + 0.5) * width,
                -(p.y * 0.5 - 0.5) * height, // Invert Y for screen coords
                p.z
            );
        };

        const getDynamicStep = (axisDir: Vector3): number => {
            // Measure px distance of 1 unit at the bounds center
            const center = new Vector3(
                (bounds.xMin + bounds.xMax) / 2,
                (bounds.yMin + bounds.yMax) / 2,
                (bounds.zMin + bounds.zMax) / 2
            );
            const p1 = project(center);
            const p2 = project(center.clone().add(axisDir));

            if (!p1 || !p2) return forceTickSpacing || 1;

            const distPx = new Vector2(p1.x - p2.x, p1.y - p2.y).length();
            if (distPx < 1) return forceTickSpacing || 10; // Very far away

            // We want ~50px per tick
            const targetStep = 80 / distPx; // units per tick

            // Nice scale rounding
            const power = Math.floor(Math.log10(targetStep));
            const base = targetStep / Math.pow(10, power);
            let niceBase = 1;
            if (base < 1.5) niceBase = 1;
            else if (base < 3.5) niceBase = 2;
            else if (base < 7.5) niceBase = 5;
            else niceBase = 10;

            return niceBase * Math.pow(10, power);
        };

        // 4. Generate Ticks
        const occupiedRects: { x: number, y: number, w: number, h: number }[] = [];
        const labelMargin = 5; // px

        const processAxis = (start: number, end: number, step: number, createVec: (v: number) => Vector3) => {
            // Align start to step
            const first = Math.ceil(start / step) * step;

            for (let val = first; val <= end; val += step) {
                if (Math.abs(val) < 1e-10) continue; // Skip origin if needed, or keep it.

                const pos3D = createVec(val);

                // Frustum Check
                if (!this.frustum.containsPoint(pos3D)) continue;

                // Screen Project & Overlap
                const screenPos = project(pos3D);
                if (!screenPos) continue;

                // If outside screen bounds (0..width, 0..height), maybe skip?
                // Allow some margin for partial labels
                if (screenPos.x < -50 || screenPos.x > width + 50 ||
                    screenPos.y < -50 || screenPos.y > height + 50) continue;

                // Check Overlap
                // Assume Label Size roughly 40x20
                const lw = 40;
                const lh = 20;
                const rect = {
                    x: screenPos.x - lw / 2 - labelMargin,
                    y: screenPos.y - lh / 2 - labelMargin,
                    w: lw + labelMargin * 2,
                    h: lh + labelMargin * 2
                };

                let collision = false;
                for (const r of occupiedRects) {
                    if (rect.x < r.x + r.w && rect.x + rect.w > r.x &&
                        rect.y < r.y + r.h && rect.y + rect.h > r.y) {
                        collision = true;
                        break;
                    }
                }

                if (collision) continue;

                // Add Label
                occupiedRects.push(rect);

                let lbl = this.pool.pop();
                if (!lbl) lbl = this.createLabelObject();

                lbl.position.copy(pos3D);
                lbl.element.textContent = Number.isInteger(val) ? val.toString() : val.toFixed(2);
                // Bonus: Check legibility (color?)

                this.parent.add(lbl);
                this.activeLabels.add(lbl);
            }
        };

        // X Axis
        const xStep = forceTickSpacing || getDynamicStep(new Vector3(1, 0, 0));
        processAxis(bounds.xMin, bounds.xMax, xStep, (v) => new Vector3(v, 0, 0));

        // Y Axis
        const yStep = forceTickSpacing || getDynamicStep(new Vector3(0, 1, 0));
        processAxis(bounds.yMin, bounds.yMax, yStep, (v) => new Vector3(0, v, 0));

        // Z Axis
        const zStep = forceTickSpacing || getDynamicStep(new Vector3(0, 0, 1));
        processAxis(bounds.zMin, bounds.zMax, zStep, (v) => new Vector3(0, 0, v));
    }

    public updateTheme(theme: ThemeConfig) {
        (this.xLine.material as LineBasicMaterial).color.set(theme.axisColor);
        (this.yLine.material as LineBasicMaterial).color.set(theme.axisColor);
        (this.zLine.material as LineBasicMaterial).color.set(theme.axisColor);
    }
}
