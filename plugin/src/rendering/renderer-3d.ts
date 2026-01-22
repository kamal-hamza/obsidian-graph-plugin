// Renderer3D - Uses Three.js for interactive 3D mathematical surface rendering

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GraphResult, InterestingPoint } from '../types';
import { ThemeManager } from './theme-manager';

export interface Renderer3DOptions {
    width: number;
    height: number;
    title?: string;
    wireframe?: boolean;
    showPoints?: boolean;
    showAxes?: boolean;
}

export class Renderer3D {
    private themeManager: ThemeManager;
    private container: HTMLElement;
    private scene: THREE.Scene | null = null;
    private camera: THREE.PerspectiveCamera | null = null;
    private renderer: THREE.WebGLRenderer | null = null;
    private controls: OrbitControls | null = null;
    private animationId: number | null = null;
    private surfaceMesh: THREE.Mesh | null = null;
    private pointsGroup: THREE.Group | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
        this.themeManager = ThemeManager.getInstance();
    }

    /**
     * Render a 3D graph from the WASM GraphResult
     */
    public render(result: GraphResult, options: Renderer3DOptions, resolution: number): void {
        // Clear any existing scene
        this.destroy();

        // Handle error case
        if (!result.success) {
            this.renderError(result.errorMessage);
            return;
        }

        // Get theme colors
        const colors = this.themeManager.getColors();
        const bgRGB = this.themeManager.hexToRGB(colors.backgroundPrimary);

        // Initialize Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(bgRGB[0], bgRGB[1], bgRGB[2]);

        // Setup camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            options.width / options.height,
            0.1,
            1000
        );
        this.camera.position.set(15, 15, 15);
        this.camera.lookAt(0, 0, 0);

        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(options.width, options.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Setup controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 100;

        // Add lighting
        this.setupLighting();

        // Add axes if requested
        if (options.showAxes !== false) {
            this.addAxes();
        }

        // Create the surface mesh
        this.createSurfaceMesh(result, resolution, options);

        // Add interesting points if requested
        if (options.showPoints !== false && result.points.length > 0) {
            this.addInterestingPoints(result.points);
        }

        // Start animation loop
        this.animate();
    }

    /**
     * Setup scene lighting
     */
    private setupLighting(): void {
        if (!this.scene) return;

        // Ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Directional light for highlights
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        this.scene.add(directionalLight);

        // Additional fill light from opposite side
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
        fillLight.position.set(-10, -10, -5);
        this.scene.add(fillLight);
    }

    /**
     * Add coordinate axes to the scene
     */
    private addAxes(): void {
        if (!this.scene) return;

        const colors = this.themeManager.getColors();
        const axisLength = 10;
        const axisColor = this.themeManager.hexToRGB(colors.textMuted);

        // Create axes helper
        const axesHelper = new THREE.AxesHelper(axisLength);
        this.scene.add(axesHelper);

        // Create grid helper
        const gridHelper = new THREE.GridHelper(20, 20, 
            new THREE.Color(axisColor[0], axisColor[1], axisColor[2]),
            new THREE.Color(axisColor[0] * 0.5, axisColor[1] * 0.5, axisColor[2] * 0.5)
        );
        this.scene.add(gridHelper);
    }

    /**
     * Create the 3D surface mesh from the path data
     */
    private createSurfaceMesh(result: GraphResult, resolution: number, options: Renderer3DOptions): void {
        if (!this.scene) return;

        const colors = this.themeManager.getColors();
        const accentRGB = this.themeManager.hexToRGB(colors.interactiveAccent);

        // Create geometry from the grid of points
        const geometry = new THREE.BufferGeometry();
        
        const vertices: number[] = [];
        const indices: number[] = [];
        const colors_array: number[] = [];

        // Extract vertices from path
        // Note: result.path is now a plain JS array
        for (const point of result.path) {
            vertices.push(point.x, point.z, point.y); // Note: z and y swapped for Three.js convention
        }

        const pathSize = result.path.length;

        // Generate indices for triangle mesh
        for (let i = 0; i < resolution - 1; i++) {
            for (let j = 0; j < resolution - 1; j++) {
                const a = i * resolution + j;
                const b = i * resolution + (j + 1);
                const c = (i + 1) * resolution + j;
                const d = (i + 1) * resolution + (j + 1);

                // Two triangles per quad
                indices.push(a, b, d);
                indices.push(a, d, c);
            }
        }

        // Generate colors based on height (z value)
        let minZ = Infinity;
        let maxZ = -Infinity;
        
        for (const point of result.path) {
            if (point.z < minZ) minZ = point.z;
            if (point.z > maxZ) maxZ = point.z;
        }

        const zRange = maxZ - minZ || 1;

        for (const point of result.path) {
            const t = (point.z - minZ) / zRange;
            
            // Gradient from blue (low) to red (high)
            const r = accentRGB[0] + t * (1 - accentRGB[0]);
            const g = accentRGB[1] * (1 - t);
            const b = accentRGB[2] * (1 - t) + t * 0.2;
            
            colors_array.push(r, g, b);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors_array, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        // Create material
        const material = new THREE.MeshPhongMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            wireframe: options.wireframe === true,
            shininess: 30,
            flatShading: false,
        });

        // Create and add mesh
        this.surfaceMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.surfaceMesh);
    }

    /**
     * Add interesting points as spheres in 3D space
     */
    private addInterestingPoints(points: InterestingPoint[]): void {
        if (!this.scene) return;

        this.pointsGroup = new THREE.Group();
        const colors = this.themeManager.getColors();

        // Iterate over points array
        for (const point of points) {
            let color: string;
            
            switch (point.type) {
                case 0: // ZERO
                    color = colors.interactiveAccent;
                    break;
                case 1: // INTERCEPT
                    color = colors.textNormal;
                    break;
                case 2: // MAXIMA
                    color = '#10b981';
                    break;
                case 3: // MINIMA
                    color = '#ef4444';
                    break;
                default:
                    color = colors.textMuted;
            }

            const rgb = this.themeManager.hexToRGB(color);
            const geometry = new THREE.SphereGeometry(0.3, 16, 16);
            const material = new THREE.MeshPhongMaterial({
                color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
                emissive: new THREE.Color(rgb[0] * 0.3, rgb[1] * 0.3, rgb[2] * 0.3),
            });

            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(point.location.x, point.location.z, point.location.y);
            this.pointsGroup.add(sphere);
        }

        this.scene.add(this.pointsGroup);
    }

    /**
     * Animation loop for rendering
     */
    private animate = (): void => {
        this.animationId = requestAnimationFrame(this.animate);

        if (this.controls) {
            this.controls.update();
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    };

    /**
     * Render an error message
     */
    private renderError(message: string): void {
        const colors = this.themeManager.getColors();
        
        this.container.empty();
        
        const errorDiv = this.container.createDiv({
            cls: 'math-graph-error',
        });
        
        errorDiv.style.padding = '20px';
        errorDiv.style.color = colors.textNormal;
        errorDiv.style.backgroundColor = colors.backgroundSecondary;
        errorDiv.style.border = `1px solid ${colors.borderColor}`;
        errorDiv.style.borderRadius = '4px';
        errorDiv.style.fontFamily = 'var(--font-monospace)';
        
        const titleEl = errorDiv.createEl('div', {
            text: '⚠️ Syntax Error',
        });
        titleEl.style.fontWeight = 'bold';
        titleEl.style.marginBottom = '8px';
        titleEl.style.color = '#ef4444';
        
        errorDiv.createEl('div', {
            text: message,
        });
    }

    /**
     * Destroy the scene and clean up resources
     */
    public destroy(): void {
        // Stop animation loop
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Dispose of controls
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }

        // Dispose of geometries and materials
        if (this.surfaceMesh) {
            this.surfaceMesh.geometry.dispose();
            if (Array.isArray(this.surfaceMesh.material)) {
                this.surfaceMesh.material.forEach(mat => mat.dispose());
            } else {
                this.surfaceMesh.material.dispose();
            }
            this.surfaceMesh = null;
        }

        if (this.pointsGroup) {
            this.pointsGroup.traverse((obj) => {
                if (obj instanceof THREE.Mesh) {
                    obj.geometry.dispose();
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(mat => mat.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
            this.pointsGroup = null;
        }

        // Dispose of renderer
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.domElement.remove();
            this.renderer = null;
        }

        // Clear scene
        this.scene = null;
        this.camera = null;

        // Clear container
        this.container.empty();
    }

    /**
     * Update renderer size
     */
    public resize(width: number, height: number): void {
        if (this.camera) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }

        if (this.renderer) {
            this.renderer.setSize(width, height);
        }
    }
}