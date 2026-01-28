import { Group, Mesh, PlaneGeometry, MeshBasicMaterial, DoubleSide, LineBasicMaterial, Camera, LineSegments, BoxGeometry, WireframeGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
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
    private xyGrid: LineSegments | null = null;
    private xzGrid: LineSegments | null = null;
    private yzGrid: LineSegments | null = null;

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
        const cageMat = new LineBasicMaterial({ color: theme.gridCageColor, transparent: true, opacity: 0.5 });
        this.cage = new LineSegments(new WireframeGeometry(cageGeo), cageMat);
        this.group.add(this.cage);
    }

    private activeBounds: GraphBounds | null = null;

    public updateBounds(bounds: GraphBounds, ticks: GridTicks) {
        this.activeBounds = bounds;
        const xSize = Math.abs(bounds.xMax - bounds.xMin);
        const ySize = Math.abs(bounds.yMax - bounds.yMin);
        const zSize = Math.abs(bounds.zMax - bounds.zMin);

        const cx = (bounds.xMin + bounds.xMax) / 2;
        const cy = (bounds.yMin + bounds.yMax) / 2;
        const cz = (bounds.zMin + bounds.zMax) / 2;

        // Helper to create grid geometry based on specific ticks
        const createGridGeo = (ticksA: number[], ticksB: number[], minA: number, maxA: number, minB: number, maxB: number, cA: number, cB: number) => {
            const pts: number[] = [];
            // Lines parallel to B-axis (vertical lines at A-ticks)
            for (const a of ticksA) {
                pts.push(a - cA, minB - cB, 0, a - cA, maxB - cB, 0);
            }
            // Lines parallel to A-axis (horizontal lines at B-ticks)
            for (const b of ticksB) {
                pts.push(minA - cA, b - cB, 0, maxA - cA, b - cB, 0);
            }
            const geo = new BufferGeometry();
            geo.setAttribute('position', new Float32BufferAttribute(pts, 3));
            return geo;
        };

        // Dispose old grids
        [this.xyGrid, this.xzGrid, this.yzGrid].forEach(g => {
            if (g) { this.group.remove(g); g.geometry.dispose(); }
        });

        const gridMat = new LineBasicMaterial({
            color: this.theme.majorGridColor,
            transparent: true,
            opacity: 0.2
        });

        // Create New Tick-Aligned Grids
        this.xyGrid = new LineSegments(createGridGeo(ticks.x, ticks.y, bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax, cx, cy), gridMat);

        // XZ Grid: Note we swap Z/Y logic for orientation
        this.xzGrid = new LineSegments(createGridGeo(ticks.x, ticks.z, bounds.xMin, bounds.xMax, bounds.zMin, bounds.zMax, cx, cz), gridMat);
        this.xzGrid.rotation.x = Math.PI / 2;

        // YZ Grid: Note we swap Z/X logic for orientation
        this.yzGrid = new LineSegments(createGridGeo(ticks.y, ticks.z, bounds.yMin, bounds.yMax, bounds.zMin, bounds.zMax, cy, cz), gridMat);
        this.yzGrid.rotation.y = Math.PI / 2;

        this.group.add(this.xyGrid, this.xzGrid, this.yzGrid);

        // Update Plane and Cage scales (Existing logic)
        this.xyPlane.scale.set(xSize, ySize, 1);
        this.xzPlane.scale.set(xSize, zSize, 1);
        this.yzPlane.scale.set(zSize, ySize, 1);
        this.cage.scale.set(xSize, ySize, zSize);
        this.cage.position.set(cx, cy, cz);
    }

    public updateTheme(theme: ThemeConfig) {
        this.theme = theme;
        const mat = new LineBasicMaterial({ color: theme.majorGridColor, transparent: true, opacity: 0.2 });
        if (this.xyGrid) this.xyGrid.material = mat;
        if (this.xzGrid) this.xzGrid.material = mat;
        if (this.yzGrid) this.yzGrid.material = mat;

        (this.xyPlane.material as MeshBasicMaterial).color.set(theme.gridColor);
        (this.xzPlane.material as MeshBasicMaterial).color.set(theme.gridColor);
        (this.yzPlane.material as MeshBasicMaterial).color.set(theme.gridColor);
        
        // Update cage color
        (this.cage.material as LineBasicMaterial).color.set(theme.gridCageColor);
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
        if (this.xyGrid) { this.xyGrid.geometry.dispose(); }
        if (this.xzGrid) { this.xzGrid.geometry.dispose(); }
        if (this.yzGrid) { this.yzGrid.geometry.dispose(); }

        // Planes geometries are shared or static? In constructor we made new ones.
        (this.xyPlane.geometry).dispose();
        (this.xzPlane.geometry).dispose();
        (this.yzPlane.geometry).dispose();

        this.cage.geometry.dispose();
    }
}

