import { Line, BufferGeometry, LineBasicMaterial, Vector3, Scene, Camera, Frustum, Matrix4 } from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ThemeConfig } from '../config/ThemeConfig';

export class AxisSystem {
    private scene: Scene;
    private xLine: Line;
    private yLine: Line; // Actually Z line in 3D plotting terms usually, but let's stick to standard Y-up for now. 
    // Wait, math graphs usually have Z up. Three.js is Y up.
    // We will map Math Z -> Three Y (or rotate the world).
    // Let's assume standard Three.js coordinates for now: Y is up.
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
        // Y Axis (Up)
        this.yLine = new Line(new BufferGeometry().setFromPoints([new Vector3(0, -EXTENT, 0), new Vector3(0, EXTENT, 0)]), mat);
        // Z Axis
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

    public update(camera: Camera) {
        // 1. Culling Logic
        // Update frustum
        this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

        // 2. Determine visible ticks based on camera position/zoom
        // This is a simplified example. In a real math engine, you calculate the "step" (1, 5, 10, etc.)
        // based on zoom level.

        const dist = camera.position.length();
        let step = 1;
        if (dist > 20) step = 5;
        if (dist > 100) step = 20;

        const visibleRange = dist * 1.5; // Heuristic for visual range



        const ticks: Vector3[] = [];

        // Generate potential ticks (only generating simple integer ticks for demo)
        for (let i = -Math.round(visibleRange); i <= Math.round(visibleRange); i += step) {
            if (i === 0) continue; // Skip origin often
            ticks.push(new Vector3(i, 0, 0)); // X axis
            // ticks.push(new Vector3(0, i, 0)); // Y axis
            ticks.push(new Vector3(0, 0, i)); // Z axis
        }

        // 3. Render Labels
        // Clear current active labels (return to pool)
        this.activeLabels.forEach(lbl => {
            this.scene.remove(lbl);
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
            // Format text (e.g., "-5")
            const val = pos.x !== 0 ? pos.x : pos.z;
            lbl.element.textContent = val.toString();

            this.scene.add(lbl);
            this.activeLabels.add(lbl);
        }
    }

    public updateTheme(theme: ThemeConfig) {
        (this.xLine.material as LineBasicMaterial).color.set(theme.axisColor);
        (this.yLine.material as LineBasicMaterial).color.set(theme.axisColor);
        (this.zLine.material as LineBasicMaterial).color.set(theme.axisColor);

        // Update pooled labels? 
        // DOM elements update via CSS usually, but we can force styles
    }
}
