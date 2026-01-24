import { Group, Mesh, PlaneGeometry, MeshBasicMaterial, GridHelper, DoubleSide, LineBasicMaterial, Camera, LineSegments, BoxGeometry, WireframeGeometry } from 'three';
import { ThemeConfig } from '../config/ThemeConfig';
import { GraphBounds } from '../GraphRenderer';

interface GridTicks {
    x: number[];
    y: number[];
    z: number[];
}

export class GridSystem {
    private group: Group;

    // Planes
    private xyPlane: Mesh;
    private xzPlane: Mesh;
    private yzPlane: Mesh;

    // Grids
    private xyGrid: GridHelper | null = null;
    private xzGrid: GridHelper | null = null;
    private yzGrid: GridHelper | null = null;

    // Cage (Mirror Effect)
    private cage: LineSegments;

    private theme: ThemeConfig;

    constructor(parent: Group, theme: ThemeConfig) {
        this.theme = theme;
        this.group = new Group();
        parent.add(this.group);

        const planeMat = new MeshBasicMaterial({
            color: theme.gridColor,
            transparent: true,
            opacity: 0.05,
            side: DoubleSide,
            depthWrite: false
        });

        // 1. Create Base Planes (will be scaled)
        this.xyPlane = new Mesh(new PlaneGeometry(1, 1), planeMat);
        this.xzPlane = new Mesh(new PlaneGeometry(1, 1), planeMat);
        this.yzPlane = new Mesh(new PlaneGeometry(1, 1), planeMat);

        this.group.add(this.xyPlane);
        this.group.add(this.xzPlane);
        this.group.add(this.yzPlane);

        // 2. Create Cage (Box)
        const cageGeo = new BoxGeometry(1, 1, 1);
        const cageMat = new LineBasicMaterial({ color: theme.axisColor, transparent: true, opacity: 0.3 });
        this.cage = new LineSegments(new WireframeGeometry(cageGeo), cageMat);
        this.group.add(this.cage);
    }

    private activeBounds: GraphBounds | null = null;

    public updateBounds(bounds: GraphBounds, ticks: GridTicks) {
        this.activeBounds = bounds;
        const xSize = Math.abs(bounds.xMax - bounds.xMin);
        const ySize = Math.abs(bounds.yMax - bounds.yMin);
        const zSize = Math.abs(bounds.zMax - bounds.zMin);

        // Update Cage
        // WireframeGeometry doesn't scale well if we just scale the mesh because lines get thick/thin?
        // Actually LineSegments with LineBasicMaterial stays 1px usually. Scale is fine.
        this.cage.scale.set(xSize, ySize, zSize);
        this.cage.position.set(
            (bounds.xMin + bounds.xMax) / 2,
            (bounds.yMin + bounds.yMax) / 2,
            (bounds.zMin + bounds.zMax) / 2
        );

        // 1. Update Plane Scales
        this.xyPlane.scale.set(xSize, ySize, 1);
        this.xzPlane.scale.set(xSize, zSize, 1);
        this.yzPlane.scale.set(zSize, ySize, 1);

        // 2. Grids (Helpers)
        // Re-create grids if needed or just move them. 
        // For simplicity, we re-create if size changes significantly, but primarily we just move them in update().

        // Update GridHelpers
        const maxDim = Math.max(xSize, ySize, zSize);
        // Spacing heuristic
        let spacing = 1;
        if (ticks.x.length > 1) spacing = ticks.x[1] - ticks.x[0];

        const divisions = Math.ceil(maxDim / spacing);
        const helperSize = divisions * spacing;

        const color1 = 0x888888;
        const color2 = 0x888888;

        // Dispose old grids
        if (this.xyGrid) { this.group.remove(this.xyGrid); this.xyGrid.dispose(); }
        if (this.xzGrid) { this.group.remove(this.xzGrid); this.xzGrid.dispose(); }
        if (this.yzGrid) { this.group.remove(this.yzGrid); this.yzGrid.dispose(); }

        // Create new Grids
        this.xyGrid = new GridHelper(helperSize, divisions, color1, color2);
        this.xyGrid.rotation.x = Math.PI / 2;

        this.xzGrid = new GridHelper(helperSize, divisions, color1, color2);
        // Default GridHelper is XZ plane. matches our XZ wall orientation locally? 
        // XZ Plane geometry is Rotated X 90. 
        // GridHelper is XZ (Y up). 
        // effectively they are similar. 

        this.yzGrid = new GridHelper(helperSize, divisions, color1, color2);
        this.yzGrid.rotation.z = Math.PI / 2;

        this.group.add(this.xyGrid);
        this.group.add(this.xzGrid);
        this.group.add(this.yzGrid);

        // Apply theme to new grids
        this.updateTheme(this.theme); // Re-apply theme colors/opacity

        // Force an update to position them correctly immediately
        // We can't do it without a camera, so we wait for the loop.
    }

    public updateTheme(theme: ThemeConfig) {
        this.theme = theme;
        (this.xyPlane.material as MeshBasicMaterial).color.set(theme.gridColor);
        (this.xzPlane.material as MeshBasicMaterial).color.set(theme.gridColor);
        (this.yzPlane.material as MeshBasicMaterial).color.set(theme.gridColor);

        const gridMatUpdate = (grid: GridHelper | null) => {
            if (!grid) return;
            const mat = grid.material as LineBasicMaterial;
            mat.opacity = 0.15;
            mat.transparent = true;
            mat.color.set(theme.majorGridColor);
            // GridHelper vertex colors override this usually, unless we disable vertex colors?
            // ThreeJS GridHelper sets vertexColors: true. 
            // We might need to make a custom grid if we want strict color control, 
            // but usually setting material color tints it.
        };
        gridMatUpdate(this.xyGrid);
        gridMatUpdate(this.xzGrid);
        gridMatUpdate(this.yzGrid);
    }

    public update(camera: Camera) {
        if (!this.activeBounds) return;
        const bounds = this.activeBounds;

        // Calculate Center
        const cx = (bounds.xMin + bounds.xMax) / 2;
        const cy = (bounds.yMin + bounds.yMax) / 2;
        const cz = (bounds.zMin + bounds.zMax) / 2;

        // Determine "Back" Faces relative to camera
        // If Camera X > Center X, we view from Right. Back wall is Left (xMin).
        // If Camera X < Center X, we view from Left. Back wall is Right (xMax).

        const camPos = camera.position;

        const wallX = camPos.x > cx ? bounds.xMin : bounds.xMax;
        const wallY = camPos.y > cy ? bounds.yMin : bounds.yMax;
        const wallZ = camPos.z > cz ? bounds.zMin : bounds.zMax;

        // 1. XY Plane (Constant Z) - Floor/Ceiling
        // Position at wallZ
        this.xyPlane.position.set(cx, cy, wallZ);
        if (this.xyGrid) this.xyGrid.position.set(cx, cy, wallZ);

        // 2. XZ Plane (Constant Y) - Back/Front Wall
        this.xzPlane.position.set(cx, wallY, cz);
        if (this.xzGrid) this.xzGrid.position.set(cx, wallY, cz);

        // 3. YZ Plane (Constant X) - Left/Right Wall
        this.yzPlane.position.set(wallX, cy, cz);
        if (this.yzGrid) this.yzGrid.position.set(wallX, cy, cz);
    }

    public dispose() {
        this.group.clear();
        this.xyGrid?.dispose();
        this.xzGrid?.dispose();
        this.yzGrid?.dispose();
        // Planes geometries are shared or static? In constructor we made new ones.
        (this.xyPlane.geometry).dispose();
        (this.xzPlane.geometry).dispose();
        (this.yzPlane.geometry).dispose();
    }
}

