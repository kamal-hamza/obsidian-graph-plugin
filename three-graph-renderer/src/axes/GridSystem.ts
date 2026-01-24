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

        const size = 100;
        const divs = 10;

        // --- 1. XY Plane (Vertical Back) ---
        this.xyGrid = new GridHelper(size, divs, theme.majorGridColor, theme.majorGridColor);
        this.xyGrid.rotation.x = Math.PI / 2;

        this.xyPlane = new Mesh(
            new PlaneGeometry(size, size),
            new MeshBasicMaterial({
                color: theme.gridColor,
                transparent: true,
                opacity: 0.05,
                side: DoubleSide
            })
        );

        // --- 2. XZ Plane (Floor) ---
        this.xzGrid = new GridHelper(size, divs, theme.majorGridColor, theme.majorGridColor);

        this.xzPlane = new Mesh(
            new PlaneGeometry(size, size),
            new MeshBasicMaterial({
                color: theme.gridColor,
                transparent: true,
                opacity: 0.05,
                side: DoubleSide
            })
        );
        this.xzPlane.rotation.x = -Math.PI / 2;

        // --- 3. YZ Plane (Side) ---
        this.yzGrid = new GridHelper(size, divs, theme.majorGridColor, theme.majorGridColor);
        this.yzGrid.rotation.z = Math.PI / 2;

        this.yzPlane = new Mesh(
            new PlaneGeometry(size, size),
            new MeshBasicMaterial({
                color: theme.gridColor,
                transparent: true,
                opacity: 0.05,
                side: DoubleSide
            })
        );
        this.yzPlane.rotation.y = Math.PI / 2;

        this.group.add(this.xyGrid, this.xyPlane);
        this.group.add(this.xzGrid, this.xzPlane);
        this.group.add(this.yzGrid, this.yzPlane);

        this.updateTheme(theme);
    }

    public updateBounds(bounds: { xMin: number, xMax: number, yMin: number, yMax: number, zMin: number, zMax: number }, tickSpacing?: number) {
        const padding = 0.0;
        const spacing = tickSpacing || 1;

        const xSize = Math.abs(bounds.xMax - bounds.xMin);
        const ySize = Math.abs(bounds.yMax - bounds.yMin);
        const zSize = Math.abs(bounds.zMax - bounds.zMin);

        const xC = (bounds.xMin + bounds.xMax) / 2;
        const yC = (bounds.yMin + bounds.yMax) / 2;
        const zC = (bounds.zMin + bounds.zMax) / 2;

        // Dispose old grids
        this.group.remove(this.xyGrid);
        this.group.remove(this.xzGrid);
        this.group.remove(this.yzGrid);
        this.xyGrid.geometry.dispose();
        // @ts-ignore
        if (this.xyGrid.material) (this.xyGrid.material as any).dispose();
        this.xzGrid.geometry.dispose();
        // @ts-ignore
        if (this.xzGrid.material) (this.xzGrid.material as any).dispose();
        this.yzGrid.geometry.dispose();
        // @ts-ignore
        if (this.yzGrid.material) (this.yzGrid.material as any).dispose();


        // Create New Grids
        const c1 = 0x444444; const c2 = 0x888888;

        // 1. Floor (XY)
        // GridHelper(size, divisions, ...)
        // We set size=100 (base), divisions = 100/spacing.
        // This ensures that when we scale it, the spacing in world units is correct?
        // Wait: If size=100, divisions=100 (spacing 1). Line every 1 unit.
        // If we scale by 2, size becomes 200. Start spacing 1 -> Scaled spacing 2.
        // PROPER WAY:
        // Set divisions such that when scaled, the world spacing is 'tickSpacing'.
        // WorldSize = BaseSize * Scale.
        // WorldSpacing = (BaseSize / Divisions) * Scale.
        // tickSpacing = (100 / Divisions) * Scale.
        // Divisions = (100 * Scale) / tickSpacing.
        // Scale for X is xSize/100.
        // Divisions = (100 * (xSize/100)) / tickSpacing = xSize / tickSpacing.
        // Correct!

        // However, we have uniform divisions. 
        // If xSize != ySize, we need different divisions for X and Y lines?
        // GridHelper has ONE 'divisions' parameter for both axes.
        // IMPOSSIBLE to have perfect square cells if xSize != ySize using GridHelper with non-uniform scale.

        // Fix: Use equal sizing for the GridHelper creation to keep cells square, then clip?
        // OR: Just use the max dimension for divisions calculation, and use that max dimension for the grid size, then just position it?
        // Yes! Create a square grid helper of size MAX(x,y,z) large enough to cover everything.
        // Then we don't scale it non-uniformly. We leave scale at 1,1,1.
        // We might just see extra lines outside the bounds?
        // If we want to hide lines outside, we need stencils or masking.
        // For MVP "Perfect Fit", showing extra lines is better than distorted rectangles.
        // OR: We just accept rectangular cells if axes have different ranges.
        // Users usually prefer square cells.

        // Let's go with: Custom Divisions for GridHelper is not possible.
        // Let's try to fit xSize and ySize.
        // If we use divisions = xSize / spacing, then Y spacing will be (ySize/xSize) * spacing?
        // Not ideal.

        // Let's settle on: GridHelper of size `max(xSize, ySize)` with `max(xSize, ySize) / spacing` divisions.
        // We set Scale to 1,1,1.
        // We update the Plane (backdrop) transparency to only highlight the bounded area.
        // The grid lines will extend beyond the backdrop. This is acceptable for a 3D graph tool (infinite grid look).

        const maxDim = Math.max(xSize, ySize, zSize);
        // Round maxDim up to nearest tickSpacing multiple?
        const divs = Math.max(1, Math.round(maxDim / spacing));
        const gridSize = divs * spacing; // Actual size to exact multiples

        this.xyGrid = new GridHelper(gridSize, divs, c2, c1);
        this.xyGrid.rotation.x = Math.PI / 2;
        this.xyGrid.position.set(xC, yC, bounds.zMin - padding);
        // No scaling!

        this.xzGrid = new GridHelper(gridSize, divs, c2, c1);
        this.xzGrid.position.set(xC, bounds.yMin - padding, zC);

        this.yzGrid = new GridHelper(gridSize, divs, c2, c1);
        this.yzGrid.rotation.z = Math.PI / 2;
        this.yzGrid.position.set(bounds.xMin - padding, yC, zC);

        // Update Planes (Bounds only)
        // These define the "Box" visually.
        this.xyPlane.position.set(xC, yC, bounds.zMin - padding);
        this.xyPlane.scale.set(xSize / 100, ySize / 100, 1);

        this.xzPlane.position.set(xC, bounds.yMin - padding, zC);
        this.xzPlane.scale.set(xSize / 100, zSize / 100, 1);

        this.yzPlane.position.set(bounds.xMin - padding, yC, zC);
        this.yzPlane.scale.set(zSize / 100, ySize / 100, 1);

        this.group.add(this.xyGrid, this.xzGrid, this.yzGrid);
    }

    public updateTheme(theme: ThemeConfig) {
        const wallColor = new Color(theme.gridColor);

        // Update Plane Opacity/Color
        [this.xyPlane, this.xzPlane, this.yzPlane].forEach(mesh => {
            const mat = mesh.material as MeshBasicMaterial;
            mat.color.set(wallColor);
            mat.opacity = 0.05;
        });
    }

    public update(_cameraPosition: any) {
    }

    public dispose() {
        this.scene.remove(this.group);
    }
}
