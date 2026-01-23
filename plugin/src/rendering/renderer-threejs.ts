// High-performance unified Three.js renderer for both 2D and 3D graphs
// Following Three.js performance best practices:
// - Single draw call per dataset
// - Typed arrays only (zero-copy from WASM)
// - Buffer geometry updates (no rebuilds)
// - Shader-based coloring and effects
// - Proper cleanup for Electron/Obsidian

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GraphResult, InterestingPoint, ResultType, MathEngineModule } from '../types';
import { ThemeManager } from './theme-manager';

export interface RendererThreeJSOptions {
    width: number;
    height: number;
    title?: string;
    showGrid?: boolean;
    showAxes?: boolean;
    showPoints?: boolean;
    wireframe?: boolean;
    mode?: '2d' | '3d';
}

/**
 * High-performance unified Three.js renderer
 * Works for both 2D and 3D graphs with optimized rendering pipeline
 */
export class RendererThreeJS {
    private themeManager: ThemeManager;
    private container: HTMLElement;
    
    // Three.js core
    private scene: THREE.Scene | null = null;
    private camera: THREE.Camera | null = null;
    private renderer: THREE.WebGLRenderer | null = null;
    private controls: OrbitControls | null = null;
    
    // Geometry and materials (reused, never recreated per frame)
    private mainMesh: THREE.Mesh | null = null;
    private mainLine: THREE.Line | null = null;
    private mainPoints: THREE.Points | null = null;
    private axesHelper: THREE.AxesHelper | null = null;
    private gridHelper: THREE.GridHelper | null = null;
    private interestingPointsGroup: THREE.Group | null = null;
    
    // For dynamic recalculation (Desmos-style)
    private wasmModule: MathEngineModule | null = null;
    private equation: string = '';
    private currentOptions: RendererThreeJSOptions | null = null;
    private mode: '2d' | '3d' = '2d';
    private isRecalculating: boolean = false;
    private lastZoomLevel: number = 1;
    private recalculationDebounce: number | null = null;
    private currentResolution: number = 100;
    
    // Animation loop
    private animationId: number | null = null;
    
    // Tooltip element
    private tooltip: HTMLElement | null = null;
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private mouse: THREE.Vector2 = new THREE.Vector2();

    constructor(container: HTMLElement, wasmModule?: MathEngineModule) {
        this.container = container;
        this.themeManager = ThemeManager.getInstance();
        this.wasmModule = wasmModule || null;
        
        // Configure raycaster for better point picking
        this.raycaster.params.Points = { threshold: 0.1 };
    }

    /**
     * Render a graph (2D or 3D) with high performance
     */
    public render(result: GraphResult, options: RendererThreeJSOptions, equation?: string): void {
        if (equation) {
            this.equation = equation;
        }
        this.currentOptions = options;
        this.mode = options.mode || '2d';

        // Initialize Three.js if needed
        if (!this.scene) {
            this.initThreeJS(options);
        }

        // Handle error case
        if (!result.success) {
            this.renderError(result.errorMessage);
            return;
        }

        // Clear previous geometry
        this.clearGeometry();

        // Render based on mode
        if (this.mode === '2d') {
            this.render2D(result, options);
        } else {
            this.render3D(result, options);
        }

        // Start animation loop if not already running
        if (!this.animationId) {
            this.animate();
        }
    }

    /**
     * Initialize Three.js scene, camera, renderer, controls
     */
    private initThreeJS(options: RendererThreeJSOptions): void {
        const colors = this.themeManager.getColors();
        
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(colors.backgroundPrimary);

        // Create camera based on mode
        if (this.mode === '2d') {
            // Orthographic camera for 2D (no perspective distortion)
            const aspect = options.width / options.height;
            const frustumSize = 20;
            this.camera = new THREE.OrthographicCamera(
                frustumSize * aspect / -2,
                frustumSize * aspect / 2,
                frustumSize / 2,
                frustumSize / -2,
                0.1,
                1000
            );
            this.camera.position.set(0, 0, 10);
        } else {
            // Perspective camera for 3D
            this.camera = new THREE.PerspectiveCamera(
                60,
                options.width / options.height,
                0.1,
                1000
            );
            this.camera.position.set(15, 15, 15);
        }

        this.camera.lookAt(0, 0, 0);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
        });
        this.renderer.setSize(options.width, options.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Create controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        if (this.mode === '2d') {
            // 2D mode: disable rotation, only pan and zoom
            this.controls.enableRotate = false;
            this.controls.mouseButtons = {
                LEFT: THREE.MOUSE.PAN,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN
            };
        }

        // Add axes helper if requested
        if (options.showAxes !== false) {
            this.axesHelper = new THREE.AxesHelper(10);
            const axesMaterial = (this.axesHelper.material as THREE.LineBasicMaterial);
            axesMaterial.transparent = true;
            axesMaterial.opacity = 0.6;
            this.scene.add(this.axesHelper);
        }

        // Add grid helper if requested (3D only)
        if (options.showGrid !== false && this.mode === '3d') {
            this.gridHelper = new THREE.GridHelper(20, 20, colors.textFaint, colors.backgroundModifier);
            (this.gridHelper.material as THREE.Material).transparent = true;
            (this.gridHelper.material as THREE.Material).opacity = 0.3;
            this.scene.add(this.gridHelper);
        }

        // Add lighting for 3D
        if (this.mode === '3d') {
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            this.scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
            directionalLight.position.set(10, 10, 10);
            this.scene.add(directionalLight);
        }

        // Create tooltip
        this.createTooltip();

        // Setup event listeners
        this.setupEventListeners();

        // Listen to zoom/pan for dynamic recalculation (both 2D and 3D)
        if (this.wasmModule && this.equation) {
            this.controls.addEventListener('change', () => {
                this.handleZoomPanDebounced();
            });
        }
    }

    /**
     * Render 2D graph as a line in 3D space (on XY plane)
     */
    private render2D(result: GraphResult, options: RendererThreeJSOptions): void {
        const colors = this.themeManager.getColors();

        // Extract data into typed arrays (zero-copy from WASM ideal)
        const pointCount = result.path.length;
        const positions = new Float32Array(pointCount * 3);

        for (let i = 0; i < pointCount; i++) {
            const point = result.path[i]!;
            positions[i * 3] = point.x;
            positions[i * 3 + 1] = point.y;
            positions[i * 3 + 2] = 0; // Z = 0 for 2D
        }

        // Create buffer geometry (single draw call)
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        // Create material with theme colors
        const material = new THREE.LineBasicMaterial({
            color: new THREE.Color(colors.interactiveAccent),
            linewidth: 2, // Note: linewidth > 1 only works on some platforms
        });

        // Create line mesh
        this.mainLine = new THREE.Line(geometry, material);
        this.scene!.add(this.mainLine);

        // Add interesting points
        this.renderInterestingPoints(result.points, colors);

        // Adjust camera to fit data
        this.fitCameraToData(positions, this.mode);
    }

    /**
     * Render 3D graph as a surface mesh
     */
    private render3D(result: GraphResult, options: RendererThreeJSOptions): void {
        const colors = this.themeManager.getColors();

        // Calculate grid dimensions (assuming square grid)
        const totalPoints = result.path.length;
        const gridSize = Math.floor(Math.sqrt(totalPoints));

        // Extract positions into typed array
        const positions = new Float32Array(totalPoints * 3);
        const colorArray = new Float32Array(totalPoints * 3);

        // Find min/max Z for color mapping
        let minZ = Infinity;
        let maxZ = -Infinity;

        for (let i = 0; i < totalPoints; i++) {
            const point = result.path[i]!;
            positions[i * 3] = point.x;
            positions[i * 3 + 1] = point.z; // Y is up in Three.js
            positions[i * 3 + 2] = point.y;
            
            if (point.z < minZ) minZ = point.z;
            if (point.z > maxZ) maxZ = point.z;
        }

        // Color mapping based on height (shader alternative would be better)
        const range = maxZ - minZ || 1;
        for (let i = 0; i < totalPoints; i++) {
            const z = positions[i * 3 + 1]!;
            const normalized = (z - minZ) / range;
            
            // Color gradient: blue (low) -> green (mid) -> red (high)
            const color = this.heightToColor(normalized);
            colorArray[i * 3] = color.r;
            colorArray[i * 3 + 1] = color.g;
            colorArray[i * 3 + 2] = color.b;
        }

        // Create buffer geometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

        // Create indices for triangulated surface
        const indices: number[] = [];
        for (let y = 0; y < gridSize - 1; y++) {
            for (let x = 0; x < gridSize - 1; x++) {
                const a = y * gridSize + x;
                const b = y * gridSize + x + 1;
                const c = (y + 1) * gridSize + x;
                const d = (y + 1) * gridSize + x + 1;

                // Two triangles per quad
                indices.push(a, b, d);
                indices.push(a, d, c);
            }
        }
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        // Create material
        const material = new THREE.MeshPhongMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            wireframe: options.wireframe || false,
            shininess: 30,
        });

        // Create mesh
        this.mainMesh = new THREE.Mesh(geometry, material);
        this.scene!.add(this.mainMesh);

        // Optionally show wireframe overlay
        if (!options.wireframe) {
            const wireframeGeometry = new THREE.WireframeGeometry(geometry);
            const wireframeMaterial = new THREE.LineBasicMaterial({
                color: new THREE.Color(colors.textFaint),
                transparent: true,
                opacity: 0.1,
            });
            const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
            this.mainMesh.add(wireframe);
        }

        // Adjust camera to fit data
        this.fitCameraToData(positions, this.mode);
    }

    /**
     * Render interesting points (zeros, maxima, minima) as markers
     * Single draw call per point type
     */
    private renderInterestingPoints(points: InterestingPoint[], colors: any): void {
        if (points.length === 0) return;

        this.interestingPointsGroup = new THREE.Group();

        // Group by type for batch rendering
        const zeros: InterestingPoint[] = [];
        const maxima: InterestingPoint[] = [];
        const minima: InterestingPoint[] = [];
        const intercepts: InterestingPoint[] = [];

        for (const point of points) {
            switch (point.type) {
                case 0: zeros.push(point); break;
                case 1: intercepts.push(point); break;
                case 2: maxima.push(point); break;
                case 3: minima.push(point); break;
            }
        }

        // Create markers for each type (single geometry per type)
        if (zeros.length > 0) {
            this.addPointMarkers(zeros, 0x7c3aed, 'sphere', this.interestingPointsGroup);
        }
        if (maxima.length > 0) {
            this.addPointMarkers(maxima, 0x10b981, 'cone', this.interestingPointsGroup);
        }
        if (minima.length > 0) {
            this.addPointMarkers(minima, 0xef4444, 'cone', this.interestingPointsGroup);
        }
        if (intercepts.length > 0) {
            this.addPointMarkers(intercepts, 0x6b7280, 'sphere', this.interestingPointsGroup);
        }

        this.scene!.add(this.interestingPointsGroup);
    }

    /**
     * Add point markers efficiently (instanced rendering would be even better)
     */
    private addPointMarkers(
        points: InterestingPoint[],
        color: number,
        shape: 'sphere' | 'cone',
        parent: THREE.Group
    ): void {
        const geometry = shape === 'sphere'
            ? new THREE.SphereGeometry(0.15, 16, 16)
            : new THREE.ConeGeometry(0.1, 0.3, 8);

        const material = new THREE.MeshPhongMaterial({ color });

        for (const point of points) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                point.location.x,
                this.mode === '2d' ? point.location.y : point.location.z,
                this.mode === '2d' ? 0.1 : point.location.y
            );
            
            if (shape === 'cone' && point.type === 3) {
                // Minima: cone points down
                mesh.rotation.x = Math.PI;
            }

            // Store metadata for tooltip
            (mesh as any).userData = {
                type: point.type,
                label: point.label,
                location: point.location,
            };

            parent.add(mesh);
        }
    }

    /**
     * Convert height value to color
     */
    private heightToColor(normalized: number): THREE.Color {
        // Blue -> Cyan -> Green -> Yellow -> Red
        if (normalized < 0.25) {
            return new THREE.Color().setHSL(0.6, 1, 0.5 + normalized * 0.5);
        } else if (normalized < 0.5) {
            return new THREE.Color().setHSL(0.5, 1, 0.5);
        } else if (normalized < 0.75) {
            return new THREE.Color().setHSL(0.3, 1, 0.5);
        } else {
            return new THREE.Color().setHSL(0.0, 1, 0.5);
        }
    }

    /**
     * Fit camera to show all data
     */
    private fitCameraToData(positions: Float32Array, mode: '2d' | '3d'): void {
        if (!this.camera || !this.controls) return;

        // Calculate bounding box
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i]!;
            const y = positions[i + 1]!;
            const z = positions[i + 2]!;

            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
        }

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;

        const rangeX = maxX - minX;
        const rangeY = maxY - minY;
        const rangeZ = maxZ - minZ;

        // Update controls target
        this.controls.target.set(centerX, centerY, centerZ);

        if (mode === '2d') {
            // Orthographic camera: adjust zoom
            const orthoCamera = this.camera as THREE.OrthographicCamera;
            const maxRange = Math.max(rangeX, rangeY) * 1.2;
            const aspect = orthoCamera.right / orthoCamera.top;
            
            orthoCamera.left = -maxRange * aspect / 2;
            orthoCamera.right = maxRange * aspect / 2;
            orthoCamera.top = maxRange / 2;
            orthoCamera.bottom = -maxRange / 2;
            orthoCamera.updateProjectionMatrix();

            // Position camera looking at XY plane
            this.camera.position.set(centerX, centerY, 10);
        } else {
            // Perspective camera: adjust distance
            const maxRange = Math.max(rangeX, rangeY, rangeZ);
            const distance = maxRange * 2;
            const angle = Math.PI / 4;
            
            this.camera.position.set(
                centerX + distance * Math.cos(angle),
                centerY + distance * Math.sin(angle),
                centerZ + distance * Math.cos(angle)
            );
        }

        this.controls.update();
    }

    /**
     * Animation loop - minimal JS work per frame
     */
    private animate(): void {
        this.animationId = requestAnimationFrame(() => this.animate());

        // Only update controls (cheap)
        if (this.controls) {
            this.controls.update();
        }

        // Render
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * Debounced zoom/pan handler to avoid excessive recalculation
     */
    private handleZoomPanDebounced(): void {
        if (this.recalculationDebounce !== null) {
            clearTimeout(this.recalculationDebounce);
        }

        this.recalculationDebounce = window.setTimeout(() => {
            this.handleZoomPan();
        }, 150); // 150ms debounce
    }

    /**
     * Handle zoom/pan for dynamic recalculation (Desmos-style for both 2D and 3D)
     */
    private async handleZoomPan(): Promise<void> {
        if (this.isRecalculating || !this.wasmModule || !this.equation || !this.camera) {
            return;
        }

        if (this.mode === '2d') {
            await this.handleZoomPan2D();
        } else {
            await this.handleZoomPan3D();
        }
    }

    /**
     * Handle 2D dynamic recalculation
     */
    private async handleZoomPan2D(): Promise<void> {
        if (this.isRecalculating || !this.wasmModule || !this.equation) {
            return;
        }

        this.isRecalculating = true;

        try {
            const camera = this.camera as THREE.OrthographicCamera;
            const xMin = camera.left;
            const xMax = camera.right;

            // Calculate zoom level change
            const range = xMax - xMin;
            const zoomLevel = 20 / range; // 20 is initial frustum size
            const zoomChange = Math.abs(zoomLevel - this.lastZoomLevel) / this.lastZoomLevel;

            // Only recalculate if zoom changed significantly (>10%)
            if (zoomChange < 0.1 && this.lastZoomLevel !== 1) {
                this.isRecalculating = false;
                return;
            }

            this.lastZoomLevel = zoomLevel;

            // Expand slightly for smooth edges
            const padding = range * 0.1;
            const adjustedXMin = xMin - padding;
            const adjustedXMax = xMax + padding;

            // Adaptive resolution based on zoom
            const resolution = Math.min(800, Math.max(200, Math.floor(500 / Math.log10(range + 1))));
            
            console.log('2D Dynamic recalculation:', { 
                xMin: adjustedXMin.toFixed(2), 
                xMax: adjustedXMax.toFixed(2), 
                resolution, 
                zoomLevel: zoomLevel.toFixed(2) 
            });

            // Recalculate
            const wasmResult = this.wasmModule.calculate2D(this.equation, adjustedXMin, adjustedXMax, resolution);

            if (!wasmResult.success) {
                this.isRecalculating = false;
                return;
            }

            // Convert to typed array
            const pointCount = wasmResult.path.size();
            const positions = new Float32Array(pointCount * 3);

            for (let i = 0; i < pointCount; i++) {
                const point = wasmResult.path.get(i);
                positions[i * 3] = point.x;
                positions[i * 3 + 1] = point.y;
                positions[i * 3 + 2] = 0;
            }

            // Update geometry (don't rebuild!)
            if (this.mainLine && this.mainLine.geometry && this.mainLine.geometry.attributes.position) {
                this.mainLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                this.mainLine.geometry.attributes.position.needsUpdate = true;
            }

            // Update interesting points
            await this.updateInterestingPoints2D(wasmResult);

        } catch (error) {
            console.error('2D Dynamic recalculation error:', error);
        } finally {
            this.isRecalculating = false;
        }
    }

    /**
     * Handle 3D dynamic recalculation
     */
    private async handleZoomPan3D(): Promise<void> {
        if (this.isRecalculating || !this.wasmModule || !this.equation || !this.controls) {
            return;
        }

        this.isRecalculating = true;

        try {
            const camera = this.camera as THREE.PerspectiveCamera;
            const target = this.controls.target;
            const distance = this.camera!.position.distanceTo(target);

            // Calculate zoom level change
            const zoomLevel = 30 / distance; // 30 is initial distance
            const zoomChange = Math.abs(zoomLevel - this.lastZoomLevel) / this.lastZoomLevel;

            // Only recalculate if zoom changed significantly (>20% for 3D due to expense)
            if (zoomChange < 0.2 && this.lastZoomLevel !== 1) {
                this.isRecalculating = false;
                return;
            }

            this.lastZoomLevel = zoomLevel;

            // Calculate visible range based on camera distance and target
            const baseRange = distance * 0.5; // Adjust multiplier as needed
            const xMin = target.x - baseRange;
            const xMax = target.x + baseRange;
            const yMin = target.z - baseRange; // Remember: Y and Z are swapped
            const yMax = target.z + baseRange;

            // Adaptive resolution - lower resolution when zoomed out
            const resolution = Math.min(100, Math.max(30, Math.floor(80 / Math.log10(baseRange + 1))));
            
            console.log('3D Dynamic recalculation:', { 
                xMin: xMin.toFixed(2), 
                xMax: xMax.toFixed(2), 
                yMin: yMin.toFixed(2), 
                yMax: yMax.toFixed(2), 
                resolution, 
                distance: distance.toFixed(2),
                zoomLevel: zoomLevel.toFixed(2) 
            });

            // Recalculate
            const wasmResult = this.wasmModule.calculate3D(
                this.equation, 
                xMin, xMax, 
                yMin, yMax, 
                resolution
            );

            if (!wasmResult.success) {
                this.isRecalculating = false;
                return;
            }

            // Convert to typed arrays
            const totalPoints = wasmResult.path.size();
            const positions = new Float32Array(totalPoints * 3);
            const colorArray = new Float32Array(totalPoints * 3);

            let minZ = Infinity;
            let maxZ = -Infinity;

            for (let i = 0; i < totalPoints; i++) {
                const point = wasmResult.path.get(i);
                positions[i * 3] = point.x;
                positions[i * 3 + 1] = point.z; // Y is up in Three.js
                positions[i * 3 + 2] = point.y;
                
                if (point.z < minZ) minZ = point.z;
                if (point.z > maxZ) maxZ = point.z;
            }

            // Update colors
            const range = maxZ - minZ || 1;
            for (let i = 0; i < totalPoints; i++) {
                const z = positions[i * 3 + 1]!;
                const normalized = (z - minZ) / range;
                const color = this.heightToColor(normalized);
                colorArray[i * 3] = color.r;
                colorArray[i * 3 + 1] = color.g;
                colorArray[i * 3 + 2] = color.b;
            }

            // Update geometry (don't rebuild!)
            if (this.mainMesh && this.mainMesh.geometry) {
                const geometry = this.mainMesh.geometry;
                
                // Update positions
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
                
                // Recreate indices for new grid size
                const gridSize = Math.floor(Math.sqrt(totalPoints));
                const indices: number[] = [];
                for (let y = 0; y < gridSize - 1; y++) {
                    for (let x = 0; x < gridSize - 1; x++) {
                        const a = y * gridSize + x;
                        const b = y * gridSize + x + 1;
                        const c = (y + 1) * gridSize + x;
                        const d = (y + 1) * gridSize + x + 1;
                        indices.push(a, b, d);
                        indices.push(a, d, c);
                    }
                }
                geometry.setIndex(indices);
                geometry.computeVertexNormals();
                
                if (geometry.attributes.position) {
                    geometry.attributes.position.needsUpdate = true;
                }
                if (geometry.attributes.color) {
                    geometry.attributes.color.needsUpdate = true;
                }
            }

            // Store current resolution for reference
            this.currentResolution = resolution;

        } catch (error) {
            console.error('3D Dynamic recalculation error:', error);
        } finally {
            this.isRecalculating = false;
        }
    }

    /**
     * Update interesting points for 2D graph
     */
    private async updateInterestingPoints2D(wasmResult: any): Promise<void> {
        if (!this.scene || !this.interestingPointsGroup) {
            return;
        }

        // Remove old interesting points
        this.scene.remove(this.interestingPointsGroup);
        this.interestingPointsGroup.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                (child.material as THREE.Material).dispose();
            }
        });

        // Create new interesting points group
        const colors = this.themeManager.getColors();
        const points: any[] = [];
        const pointsSize = wasmResult.points.size();
        
        for (let i = 0; i < pointsSize; i++) {
            const p = wasmResult.points.get(i);
            points.push({
                location: { x: p.location.x, y: p.location.y, z: p.location.z },
                type: p.type,
                label: p.label
            });
        }

        this.interestingPointsGroup = new THREE.Group();
        this.renderInterestingPoints(points, colors);
        this.scene.add(this.interestingPointsGroup);
    }

    /**
     * Create tooltip element
     */
    private createTooltip(): void {
        const colors = this.themeManager.getColors();
        
        this.tooltip = document.createElement('div');
        this.tooltip.style.position = 'absolute';
        this.tooltip.style.padding = '8px 12px';
        this.tooltip.style.background = colors.backgroundSecondary;
        this.tooltip.style.border = `1px solid ${colors.borderColor}`;
        this.tooltip.style.borderRadius = '4px';
        this.tooltip.style.color = colors.textNormal;
        this.tooltip.style.fontFamily = 'var(--font-monospace)';
        this.tooltip.style.fontSize = '12px';
        this.tooltip.style.pointerEvents = 'none';
        this.tooltip.style.display = 'none';
        this.tooltip.style.zIndex = '1000';
        
        this.container.appendChild(this.tooltip);
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        if (!this.renderer) return;

        // Mouse move for tooltips
        this.renderer.domElement.addEventListener('mousemove', (event) => {
            this.onMouseMove(event);
        });

        // Handle resize
        window.addEventListener('resize', () => {
            this.onResize();
        });
    }

    /**
     * Handle mouse move for interactive tooltips
     */
    private onMouseMove(event: MouseEvent): void {
        if (!this.camera || !this.scene || !this.tooltip || !this.renderer) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycast only interesting points (selective raycasting)
        if (this.interestingPointsGroup) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.interestingPointsGroup.children, true);

            if (intersects.length > 0) {
                const object = intersects[0]!.object;
                const userData = (object as any).userData;

                if (userData && userData.label) {
                    this.tooltip.innerHTML = `
                        <strong>${this.getTypeLabel(userData.type)}</strong><br>
                        ${userData.label}
                    `;
                    this.tooltip.style.display = 'block';
                    this.tooltip.style.left = `${event.clientX + 10}px`;
                    this.tooltip.style.top = `${event.clientY + 10}px`;
                    return;
                }
            }
        }

        this.tooltip.style.display = 'none';
    }

    /**
     * Get label for point type
     */
    private getTypeLabel(type: number): string {
        switch (type) {
            case 0: return 'Zero';
            case 1: return 'Intercept';
            case 2: return 'Local Maximum';
            case 3: return 'Local Minimum';
            default: return 'Point';
        }
    }

    /**
     * Handle window resize
     */
    private onResize(): void {
        if (!this.currentOptions || !this.camera || !this.renderer) return;

        const width = this.currentOptions.width;
        const height = this.currentOptions.height;

        if (this.mode === '2d') {
            const orthoCamera = this.camera as THREE.OrthographicCamera;
            const aspect = width / height;
            const frustumHeight = orthoCamera.top - orthoCamera.bottom;
            orthoCamera.left = -frustumHeight * aspect / 2;
            orthoCamera.right = frustumHeight * aspect / 2;
            orthoCamera.updateProjectionMatrix();
        } else {
            (this.camera as THREE.PerspectiveCamera).aspect = width / height;
            (this.camera as THREE.PerspectiveCamera).updateProjectionMatrix();
        }

        this.renderer.setSize(width, height);
    }

    /**
     * Clear geometry (proper cleanup)
     */
    private clearGeometry(): void {
        if (this.mainMesh) {
            this.mainMesh.geometry.dispose();
            (this.mainMesh.material as THREE.Material).dispose();
            this.scene!.remove(this.mainMesh);
            this.mainMesh = null;
        }

        if (this.mainLine) {
            this.mainLine.geometry.dispose();
            (this.mainLine.material as THREE.Material).dispose();
            this.scene!.remove(this.mainLine);
            this.mainLine = null;
        }

        if (this.mainPoints) {
            this.mainPoints.geometry.dispose();
            (this.mainPoints.material as THREE.Material).dispose();
            this.scene!.remove(this.mainPoints);
            this.mainPoints = null;
        }

        if (this.interestingPointsGroup) {
            this.interestingPointsGroup.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    (child.material as THREE.Material).dispose();
                }
            });
            this.scene!.remove(this.interestingPointsGroup);
            this.interestingPointsGroup = null;
        }
    }

    /**
     * Render error message
     */
    private renderError(message: string): void {
        const colors = this.themeManager.getColors();
        
        this.container.empty();
        
        const errorDiv = this.container.createDiv({ cls: 'math-graph-error' });
        errorDiv.style.padding = '20px';
        errorDiv.style.color = colors.textNormal;
        errorDiv.style.backgroundColor = colors.backgroundSecondary;
        errorDiv.style.border = `1px solid ${colors.borderColor}`;
        errorDiv.style.borderRadius = '4px';
        errorDiv.style.fontFamily = 'var(--font-monospace)';
        
        const titleEl = errorDiv.createEl('div', { text: '⚠️ Error' });
        titleEl.style.fontWeight = 'bold';
        titleEl.style.marginBottom = '8px';
        titleEl.style.color = '#ef4444';
        
        errorDiv.createEl('div', { text: message });
    }

    /**
     * Destroy and cleanup (CRITICAL for Electron memory management)
     */
    public destroy(): void {
        // Stop animation loop
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Clear debounce timer
        if (this.recalculationDebounce !== null) {
            clearTimeout(this.recalculationDebounce);
            this.recalculationDebounce = null;
        }

        // Clear geometry
        this.clearGeometry();

        // Dispose of helpers
        if (this.axesHelper) {
            this.scene!.remove(this.axesHelper);
            this.axesHelper = null;
        }

        if (this.gridHelper) {
            (this.gridHelper.material as THREE.Material).dispose();
            this.scene!.remove(this.gridHelper);
            this.gridHelper = null;
        }

        // Dispose controls
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }

        // Dispose renderer
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.domElement.remove();
            this.renderer = null;
        }

        // Clear scene
        if (this.scene) {
            this.scene.clear();
            this.scene = null;
        }

        // Remove tooltip
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }

        // Clear container
        this.container.empty();
    }

    /**
     * Update graph size
     */
    public resize(width: number, height: number): void {
        if (this.currentOptions) {
            this.currentOptions.width = width;
            this.currentOptions.height = height;
            this.onResize();
        }
    }
}