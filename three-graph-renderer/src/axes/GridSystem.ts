import { GridHelper, Color, Scene, Mesh, PlaneGeometry, MeshBasicMaterial, DoubleSide, Group } from 'three';
import { ThemeConfig } from '../config/ThemeConfig';

export class GridSystem {
    private scene: Scene;
    private group: Group;

    // Grids
    private xyGrid: GridHelper;
    private xzGrid: GridHelper;
    private yzGrid: GridHelper;

    // Background Planes (Backdrops)
    private xyPlane: Mesh;
    private xzPlane: Mesh;
    private yzPlane: Mesh;

    constructor(scene: Scene, theme: ThemeConfig) {
        this.scene = scene;
        this.group = new Group();
        this.scene.add(this.group);

        // Define generic sizing - will be updated by bounds later
        const size = 100;
        const divs = 10;

        // --- 1. XY Plane (Vertical Back) ---
        // Rotated 90deg around X makes it flat (XZ). 
        // Default GridHelper is XZ plane.

        // XY Grid: Needs rotation to stand up.
        this.xyGrid = new GridHelper(size, divs, theme.majorGridColor, theme.majorGridColor);
        this.xyGrid.rotation.x = Math.PI / 2; // Make it XY

        // XY Backdrop
        this.xyPlane = new Mesh(
            new PlaneGeometry(size, size),
            new MeshBasicMaterial({
                color: theme.gridColor,
                transparent: true,
                opacity: 0.05,
                side: DoubleSide
            })
        );
        // PlaneGeometry is XY by default? No, it's usually XY.
        // GridHelper is XZ by default.
        // We want Plane to match Grid.
        // PlaneGeometry created is XY.

        // --- 2. XZ Plane (Floor) ---
        // Default GridHelper orientation
        this.xzGrid = new GridHelper(size, divs, theme.majorGridColor, theme.majorGridColor);

        // XZ Backdrop (Floor)
        this.xzPlane = new Mesh(
            new PlaneGeometry(size, size),
            new MeshBasicMaterial({
                color: theme.gridColor,
                transparent: true,
                opacity: 0.05,
                side: DoubleSide
            })
        );
        this.xzPlane.rotation.x = -Math.PI / 2; // Flat

        // --- 3. YZ Plane (Side) ---
        this.yzGrid = new GridHelper(size, divs, theme.majorGridColor, theme.majorGridColor);
        this.yzGrid.rotation.z = Math.PI / 2; // Rotate generic XZ grid?
        // Wait, GridHelper is XZ. Rotate Z -> YZ? 
        // X points Right, Z points Back. 
        // Rotation Z=90 -> X axis becomes Y axis. Z stays Z. => YZ plane. Correct.

        // YZ Backdrop
        this.yzPlane = new Mesh(
            new PlaneGeometry(size, size),
            new MeshBasicMaterial({
                color: theme.gridColor,
                transparent: true,
                opacity: 0.05,
                side: DoubleSide
            })
        );
        this.yzPlane.rotation.y = Math.PI / 2; // XY -> YZ


        // Add all to group
        this.group.add(this.xyGrid, this.xyPlane);
        this.group.add(this.xzGrid, this.xzPlane);
        this.group.add(this.yzGrid, this.yzPlane);

        this.updateTheme(theme);
    }

    public updateBounds(bounds: { xMin: number, xMax: number, yMin: number, yMax: number, zMin: number, zMax: number }) {
        // Calculate center and size
        // Calculate center and size
        // Note: Project seems Z-up based on GraphRenderer "camera.up.set(0,0,1)" in previous step reading.
        // If Z-up:
        // X-Y is floor?
        // Let's re-read AxisSystem or GraphRenderer logic.
        // "this.camera.up.set(0, 0, 1);" confirms Z-up world.
        // Standard GridHelper is X-Z plane.

        // If World is Z-up:
        // Floor is XY Plane.
        // Walls are XZ and YZ.

        // ThreeJS GridHelper defaults to X-Z plane. 
        // So for "Floor" (XY in Z-up world), we need to rotate GridHelper 90 x-axis.

        // Let's adjust naming to be "Floor", "BackWall", "SideWall" to avoid confusion, 
        // or stick to Standard coordinates.
        // Let's assume:
        // X axis = Red
        // Y axis = Green
        // Z axis = Blue (Up)

        // Floor = XY Plane (z = zMin)
        // Back = XZ Plane (y = yMax) ?? Usually graphs have back-left corner.
        // Typical scientific box:
        // Floor at zMin (span X, Y)
        // Wall 1 at yMax (span X, Z) or yMin? Usually 'back' is +Y or +Z depending on view.
        // Wall 2 at xMin (span Y, Z)

        const padding = 0.0;

        const xSize = Math.abs(bounds.xMax - bounds.xMin);
        const ySize = Math.abs(bounds.yMax - bounds.yMin);
        const zSize = Math.abs(bounds.zMax - bounds.zMin);

        const xC = (bounds.xMin + bounds.xMax) / 2;
        const yC = (bounds.yMin + bounds.yMax) / 2;
        const zC = (bounds.zMin + bounds.zMax) / 2;

        // -- 1. Floor (XY Plane) at Z = zMin --
        // GridHelper is XZ by default. Rotate X 90 to match XY plane.
        // Size should cover max(X, Y) or be rectangular? GridHelper is square.
        // We'll scale it.

        // Re-create helpers to match size exactly or scale them? Scaling is better for perf.

        // FLOOR (XY)
        // Position
        this.xyGrid.position.set(xC, yC, bounds.zMin - padding);
        this.xyPlane.position.set(xC, yC, bounds.zMin - padding);

        // Scale/Size
        // GridHelper size is initial 100.
        // We want xSize and ySize.
        // Rotate GridHelper (XZ plain) by 90 deg X -> becomes XY.
        // X axis stays X. Z axis becomes -Y.
        // So scale.x => xSize, scale.z (local) => ySize.
        this.xyGrid.scale.set(xSize / 100, 1, ySize / 100);
        this.xyPlane.scale.set(xSize / 100, ySize / 100, 1); // PlaneGeometry is XY.

        // -- 2. Wall 1 (XZ Plane) at Y = yMax (or yMin? usually "Back" is positive Y in Z-up?)
        // Let's put it at yMin for now, can swap.
        // User said: "back of the current view (e.g., at xMin, yMin, and zMin)"
        // So yMin.
        this.xzGrid.position.set(xC, bounds.yMin - padding, zC);
        this.xzPlane.position.set(xC, bounds.yMin - padding, zC);

        // GridHelper (XZ default).
        // scale.x -> xSize, scale.z -> zSize.
        this.xzGrid.scale.set(xSize / 100, 1, zSize / 100); // 
        // Plane (XY default). Rotate to XZ -> Rot X -90.
        this.xzPlane.scale.set(xSize / 100, zSize / 100, 1);

        // -- 3. Wall 2 (YZ Plane) at X = xMin --
        this.yzGrid.position.set(bounds.xMin - padding, yC, zC);
        this.yzPlane.position.set(bounds.xMin - padding, yC, zC);

        // GridHelper (XZ default). Rotate Z 90 -> YZ.
        // Local X becomes World Y. Local Z becomes World Z.
        // scale.x -> ySize. scale.z -> zSize.
        this.yzGrid.scale.set(ySize / 100, 1, zSize / 100);

        // Plane (XY default). Rotate Y 90 -> YZ.
        this.yzPlane.scale.set(zSize / 100, ySize / 100, 1); // Width, Height. 
        // PlaneGeometry(Size, Size) -> X=Size, Y=Size.
        // Rot Y 90: X -> Z. Y -> Y.
        // So Local X (Width) maps to Z, Local Y (Height) maps to Y.
        // We want Z=zSize, Y=ySize.
        // So scale X -> zSize/100, Y -> ySize/100.

    }

    public updateTheme(theme: ThemeConfig) {
        // const majorColor = new Color(theme.majorGridColor); 
        const wallColor = new Color(theme.gridColor); // maybe add a dedicated wall color?

        // Update Grids?
        // GridHelpers are hard to update colors without disposing.
        // For now, let's assume they are recreated if theme changes drastically or just ignore for MVP.
        // But we DO need to set the material props if we want to change them.

        // It's cleaner to just accept the instance creation for now.
        // Ideally we'd dispose and recreate but we need to keep transforms.

        // Update Plane Opacity/Color
        [this.xyPlane, this.xzPlane, this.yzPlane].forEach(mesh => {
            const mat = mesh.material as MeshBasicMaterial;
            mat.color.set(wallColor);
            mat.opacity = 0.05;
        });
    }

    public update(_cameraPosition: any) {
        // Optional: Hide walls if camera looks from behind?
    }

    public dispose() {
        this.scene.remove(this.group);
        // dispose geometries/materials
    }
}
