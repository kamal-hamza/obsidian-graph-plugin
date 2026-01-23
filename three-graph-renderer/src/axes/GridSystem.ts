import { GridHelper, Color, Scene } from 'three';
import { ThemeConfig } from '../config/ThemeConfig';

export class GridSystem {
    private majorGrid: GridHelper;
    private minorGrid: GridHelper;
    private scene: Scene;

    constructor(scene: Scene, theme: ThemeConfig) {
        this.scene = scene;

        // Major Grid: 100 units, 10 divisions (lines every 10 units)
        this.majorGrid = new GridHelper(1000, 100, theme.majorGridColor, theme.majorGridColor);

        // Minor Grid: 100 units, 100 divisions (lines every 1 unit)
        this.minorGrid = new GridHelper(1000, 1000, theme.minorGridColor, theme.minorGridColor);

        // Adjust y-offset slightly to separate from axis lines
        this.majorGrid.position.y = -0.01;
        this.minorGrid.position.y = -0.02;

        this.scene.add(this.majorGrid);
        this.scene.add(this.minorGrid);
    }

    public updateTheme(theme: ThemeConfig) {
        // GridHelper colors are stored in the material
        // Accessing internal material colors is a bit hacky in Three types, 
        // but GridHelper uses LineSegments which has a material.

        const majorColor = new Color(theme.majorGridColor);
        const minorColor = new Color(theme.minorGridColor);

        // Re-creating grids is often safer/easier than updating internal buffer attributes for colors
        this.dispose();

        this.majorGrid = new GridHelper(1000, 100, majorColor, majorColor);
        this.minorGrid = new GridHelper(1000, 1000, minorColor, minorColor);

        this.majorGrid.position.y = -0.01;
        this.minorGrid.position.y = -0.02;

        this.scene.add(this.majorGrid);
        this.scene.add(this.minorGrid);
    }

    public update(cameraPosition: { length: () => number }) {
        // Logic to fade grids could go here based on zoom level
        // For now, simpler implementation: just keep them visible
        const dist = cameraPosition.length();

        // Example: Fade out minor grid when very far away
        if (dist > 100) {
            this.minorGrid.visible = false;
        } else {
            this.minorGrid.visible = true;
        }
    }

    public dispose() {
        this.scene.remove(this.majorGrid);
        this.scene.remove(this.minorGrid);
        // Dispose geometry/materials if needed (GridHelper manages its own mostly)
    }
}
