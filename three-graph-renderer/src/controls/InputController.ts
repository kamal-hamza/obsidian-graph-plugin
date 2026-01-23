import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Camera, WebGLRenderer, MOUSE } from 'three';

export class InputController {
    public controls: OrbitControls;
    private camera: Camera;

    constructor(camera: Camera, renderer: WebGLRenderer) {
        this.camera = camera;
        this.controls = new OrbitControls(camera, renderer.domElement);

        // Configure default controls
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // No Box-Zoom hijacking (native Three.js behavior)
        // Left click: Rotate
        // Right click: Pan
        this.controls.mouseButtons = {
            LEFT: MOUSE.ROTATE,
            MIDDLE: MOUSE.DOLLY,
            RIGHT: MOUSE.PAN
        };

        // "Infinite" axis feel - allow looking around freely but keep "up" oriented
        this.controls.maxPolarAngle = Math.PI; // Full rotation
        this.controls.minDistance = 0.1;
        this.controls.maxDistance = 1000;
    }

    public update() {
        this.updateZoomSensitivity();
        this.controls.update();
    }

    /**
     * Exponential Zooming: Adjust zoom speed based on distance from origin/target
     * This prevents the "slow pinch" issue when close to the center.
     */
    private updateZoomSensitivity() {
        const dist = this.camera.position.length();

        // Base speed + logarithmic factor
        // When far away (dist=100), speed is high. 
        // When close (dist=1), speed is low but proportional.
        // 1.0 is default speed.
        let speed = Math.log10(dist + 1);

        // Clamp to reasonable values
        speed = Math.max(0.1, Math.min(speed, 5.0));

        this.controls.zoomSpeed = speed;
        this.controls.panSpeed = speed; // Also scale panning
    }

    public dispose() {
        this.controls.dispose();
    }
}
