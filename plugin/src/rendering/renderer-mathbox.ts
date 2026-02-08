import { ThemeManager } from './theme-manager';
import type { GraphResult, MathEngineModule, Point, InterestingPoint } from '../types';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Dynamic MathBox import
let MathBox: any = null;

// Load MathBox dynamically
async function loadMathBox() {
    if (MathBox) return MathBox;
    try {
        const module = await import('mathbox');
        MathBox = module;
        return MathBox;
    } catch (error) {
        console.error('Failed to load MathBox:', error);
        throw new Error('MathBox library could not be loaded');
    }
}

interface RendererMathBoxOptions {
    width: number;
    height: number;
    showGrid: boolean;
    showAxes: boolean;
    mode: '2d' | '3d';
    wireframe?: boolean;
}

export class RendererMathBox {
    private themeManager: ThemeManager;
    private container: HTMLElement;
    private mathbox: any;
    private wasmModule: MathEngineModule;
    private equation: string = '';
    private currentOptions: RendererMathBoxOptions | null = null;
    private lastResult: GraphResult | null = null;
    private mode: '2d' | '3d' = '2d';

    constructor(container: HTMLElement, wasmModule: MathEngineModule) {
        this.container = container;
        this.wasmModule = wasmModule;
        this.themeManager = ThemeManager.getInstance();
    }

    public async render(result: GraphResult, options: RendererMathBoxOptions, equation: string): Promise<void> {
        if (!result.success) {
            this.renderError(result.errorMessage || 'Unknown error');
            return;
        }

        // Destroy any existing MathBox instance first to prevent WebGL context leaks
        if (this.mathbox) {
            console.log('[MathBox] Destroying existing instance before re-render');
            this.destroy();
        }

        this.equation = equation;
        this.currentOptions = options;
        this.lastResult = result;
        this.mode = options.mode;

        // Clear container
        this.container.empty();

        const colors = this.themeManager.getColors();

        // Create MathBox container
        const element = this.container.createDiv({ cls: 'mathbox-container' });
        element.style.width = `${options.width}px`;
        element.style.height = `${options.height}px`;
        element.style.position = 'relative';
        element.style.minHeight = `${options.height}px`;
        element.style.display = 'block';
        
        console.log('[MathBox] Created container element:', {
            width: element.style.width,
            height: element.style.height,
            offsetWidth: element.offsetWidth,
            offsetHeight: element.offsetHeight,
            display: element.style.display,
            visibility: window.getComputedStyle(element).visibility,
            isConnected: element.isConnected
        });

        try {
            // Load MathBox library
            const MathBoxLib = await loadMathBox();
            
            // Initialize MathBox
            this.mathbox = MathBoxLib.mathBox({
                element: element,
                plugins: ['core', 'controls', 'cursor'],
                controls: {
                    klass: OrbitControls
                },
                camera: options.mode === '2d' 
                    ? { 
                        position: [0, 0, 3],
                        lookAt: [0, 0, 0]
                    }
                    : { 
                        position: [2, 2, 2],
                        lookAt: [0, 0, 0]
                    }
            });

            // Set background color
            const three = this.mathbox.three;
            three.renderer.setClearColor(new THREE.Color(colors.backgroundPrimary), 1.0);

            // Debug: Check Three.js state
            console.log('[MathBox] Three.js renderer initialized:', {
                canvas: three.renderer.domElement,
                canvasWidth: three.renderer.domElement.width,
                canvasHeight: three.renderer.domElement.height,
                canvasStyle: three.renderer.domElement.style.cssText,
                cameraPosition: three.camera.position,
                clearColor: colors.backgroundPrimary
            });

            // Debug: Check if WebGL context is valid
            const gl = three.renderer.getContext();
            console.log('[MathBox] WebGL context:', {
                isContextLost: gl.isContextLost(),
                drawingBufferWidth: gl.drawingBufferWidth,
                drawingBufferHeight: gl.drawingBufferHeight,
                viewport: gl.getParameter(gl.VIEWPORT)
            });

            if (options.mode === '2d') {
                console.log('[MathBox] Starting 2D render...');
                this.render2D(result, options, equation, colors);
            } else {
                console.log('[MathBox] Starting 3D render...');
                this.render3D(result, options, equation, colors);
            }

            // Force a manual render
            console.log('[MathBox] Forcing manual render...');
            three.renderer.render(three.scene, three.camera);
            console.log('[MathBox] Manual render complete');

            // Check canvas state after render
            const canvas = three.renderer.domElement;
            console.log('[MathBox] Post-render canvas state:', {
                width: canvas.width,
                height: canvas.height,
                styleWidth: canvas.style.width,
                styleHeight: canvas.style.height,
                offsetWidth: canvas.offsetWidth,
                offsetHeight: canvas.offsetHeight,
                clientWidth: canvas.clientWidth,
                clientHeight: canvas.clientHeight,
                display: window.getComputedStyle(canvas).display,
                visibility: window.getComputedStyle(canvas).visibility,
                opacity: window.getComputedStyle(canvas).opacity,
                position: window.getComputedStyle(canvas).position,
                zIndex: window.getComputedStyle(canvas).zIndex,
                parentElement: canvas.parentElement?.className,
                isConnected: canvas.isConnected
            });

            // Force canvas to be visible
            if (canvas.style.display === 'none' || window.getComputedStyle(canvas).display === 'none') {
                console.warn('[MathBox] Canvas was hidden, forcing display:block');
                canvas.style.display = 'block';
            }
            
            if (canvas.style.visibility === 'hidden' || window.getComputedStyle(canvas).visibility === 'hidden') {
                console.warn('[MathBox] Canvas visibility was hidden, forcing visible');
                canvas.style.visibility = 'visible';
            }

            if (canvas.style.opacity === '0' || parseFloat(window.getComputedStyle(canvas).opacity) === 0) {
                console.warn('[MathBox] Canvas opacity was 0, forcing opacity:1');
                canvas.style.opacity = '1';
            }

            // Ensure canvas has proper size
            if (canvas.width === 0 || canvas.height === 0) {
                console.error('[MathBox] Canvas has zero dimensions!', {
                    width: canvas.width,
                    height: canvas.height,
                    containerWidth: element.offsetWidth,
                    containerHeight: element.offsetHeight
                });
                
                // Force resize
                const width = element.offsetWidth || options.width;
                const height = element.offsetHeight || options.height;
                canvas.width = width;
                canvas.height = height;
                canvas.style.width = `${width}px`;
                canvas.style.height = `${height}px`;
                
                // Update renderer size
                three.renderer.setSize(width, height);
                
                // Re-render
                three.renderer.render(three.scene, three.camera);
                
                console.log('[MathBox] Forced canvas resize and re-render');
            }
        } catch (error) {
            console.error('MathBox rendering error:', error);
            this.renderError(`Rendering failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private render2D(result: GraphResult, options: RendererMathBoxOptions, equation: string, colors: any): void {
        console.log('[MathBox] render2D() called with', result.path.length, 'points');
        
        if (result.path.length === 0) {
            this.renderError('No data points to display');
            return;
        }

        // Calculate bounds from data
        const xValues = result.path.map((p: Point) => p.x);
        const yValues = result.path.map((p: Point) => p.y);
        const xMin = Math.min(...xValues);
        const xMax = Math.max(...xValues);
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);

        console.log('[MathBox] 2D data bounds:', { xMin, xMax, yMin, yMax });

        // Add padding
        const xPadding = (xMax - xMin) * 0.1;
        const yPadding = (yMax - yMin) * 0.1;

        // Create 2D cartesian view
        const view = this.mathbox
            .cartesian({
                range: [
                    [xMin - xPadding, xMax + xPadding],
                    [yMin - yPadding, yMax + yPadding]
                ],
                scale: [2, 2, 1],
            });

        // Add grid first (so it's behind everything)
        if (options.showGrid) {
            view.grid({
                axes: [1, 2],
                width: 1,
                divideX: 20,
                divideY: 20,
                color: colors.borderColor,
                opacity: 0.3,
            });
        }

        // Add axes
        if (options.showAxes) {
            view
                .axis({
                    axis: 1,
                    color: colors.textNormal,
                    width: 2,
                    detail: 40,
                })
                .axis({
                    axis: 2,
                    color: colors.textNormal,
                    width: 2,
                    detail: 40,
                });

            // Add scale/ticks for x-axis
            view
                .scale({
                    axis: 1,
                    divide: 10,
                })
                .ticks({
                    width: 2,
                    size: 10,
                    color: colors.textMuted,
                })
                .format({
                    digits: 2,
                })
                .label({
                    color: colors.textNormal,
                    size: 12,
                });

            // Add scale/ticks for y-axis
            view
                .scale({
                    axis: 2,
                    divide: 10,
                })
                .ticks({
                    width: 2,
                    size: 10,
                    color: colors.textMuted,
                })
                .format({
                    digits: 2,
                })
                .label({
                    color: colors.textNormal,
                    size: 12,
                });
        }

        // Plot the main function curve
        view
            .array({
                id: 'curve-data',
                data: result.path.map((p: Point) => [p.x, p.y, 0]),
                channels: 3,
                live: false,
            })
            .line({
                color: colors.accentColor,
                width: 3,
            });

        // Add interesting points (zeros, maxima, minima)
        this.addInterestingPoints2D(view, result.points, colors);

        // Add equation label
        view
            .array({
                id: 'equation-label',
                data: [[xMin - xPadding + (xMax - xMin) * 0.05, yMax + yPadding - (yMax - yMin) * 0.05, 0]],
                channels: 3,
            })
            .text({
                data: [`f(x) = ${equation}`],
            })
            .label({
                color: colors.textMuted,
                size: 14,
                outline: 0,
            });

        console.log('[MathBox] 2D rendering complete');
    }

    private render3D(result: GraphResult, options: RendererMathBoxOptions, equation: string, colors: any): void {
        console.log('[MathBox] render3D() called with', result.path.length, 'points');
        
        if (result.path.length === 0) {
            this.renderError('No data points to display');
            return;
        }

        // Extract grid data from path
        const gridSize = Math.sqrt(result.path.length);
        
        if (!Number.isInteger(gridSize)) {
            this.renderError('Invalid grid data for 3D surface');
            return;
        }

        const xSet = new Set<number>();
        const ySet = new Set<number>();

        result.path.forEach((p: Point) => {
            xSet.add(p.x);
            ySet.add(p.y);
        });

        const xValues = Array.from(xSet).sort((a, b) => a - b);
        const yValues = Array.from(ySet).sort((a, b) => a - b);

        // Create Z grid
        const zGrid: number[][] = [];
        for (let i = 0; i < gridSize; i++) {
            zGrid[i] = [];
            for (let j = 0; j < gridSize; j++) {
                const idx = i * gridSize + j;
                const point = result.path[idx];
                if (point) {
                    const row = zGrid[i];
                    if (row) {
                        row[j] = point.z;
                    }
                } else {
                    const row = zGrid[i];
                    if (row) {
                        row[j] = 0;
                    }
                }
            }
        }

        const xMin = Math.min(...xValues);
        const xMax = Math.max(...xValues);
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);
        const zMin = Math.min(...zGrid.flat());
        const zMax = Math.max(...zGrid.flat());

        console.log('[MathBox] 3D data bounds:', { xMin, xMax, yMin, yMax, zMin, zMax });
        console.log('[MathBox] Grid dimensions:', gridSize, 'x', gridSize);

        // Add padding for better visualization
        const zPadding = (zMax - zMin) * 0.1;

        // Create 3D view
        const view = this.mathbox
            .cartesian({
                range: [
                    [xMin, xMax],
                    [yMin, yMax],
                    [zMin - zPadding, zMax + zPadding]
                ],
                scale: [2, 2, 2],
            });

        // Add grid
        if (options.showGrid) {
            view.grid({
                axes: [1, 3],
                width: 1,
                divideX: 10,
                divideY: 10,
                color: colors.borderColor,
                opacity: 0.2,
            });
        }

        // Add axes
        if (options.showAxes) {
            view
                .axis({
                    axis: 1,
                    color: colors.textNormal,
                    width: 2,
                })
                .axis({
                    axis: 2,
                    color: colors.textNormal,
                    width: 2,
                })
                .axis({
                    axis: 3,
                    color: colors.textNormal,
                    width: 2,
                });

            // Add labels for each axis
            view
                .scale({
                    axis: 1,
                    divide: 5,
                })
                .ticks({
                    width: 2,
                    size: 10,
                    color: colors.textMuted,
                })
                .format({
                    digits: 1,
                })
                .label({
                    color: colors.textNormal,
                    size: 12,
                });

            view
                .scale({
                    axis: 2,
                    divide: 5,
                })
                .ticks({
                    width: 2,
                    size: 10,
                    color: colors.textMuted,
                })
                .format({
                    digits: 1,
                })
                .label({
                    color: colors.textNormal,
                    size: 12,
                });

            view
                .scale({
                    axis: 3,
                    divide: 5,
                })
                .ticks({
                    width: 2,
                    size: 10,
                    color: colors.textMuted,
                })
                .format({
                    digits: 1,
                })
                .label({
                    color: colors.textNormal,
                    size: 12,
                });
        }

        // Create surface using WASM-calculated data
        view
            .area({
                id: 'surface-data',
                rangeX: [xMin, xMax],
                rangeY: [yMin, yMax],
                width: gridSize,
                height: gridSize,
                channels: 3,
                expr: (emit: any, x: number, y: number, i: number, j: number) => {
                    // Use WASM-calculated Z value with safe access
                    const row = zGrid[i];
                    const z = (row && row[j] !== undefined) ? row[j] : 0;
                    emit(x, y, z);
                },
            })
            .surface({
                shaded: true,
                color: colors.accentColor,
                opacity: 0.75,
                lineX: options.wireframe || false,
                lineY: options.wireframe || false,
                width: 1,
            });

        // Add interesting points for 3D
        this.addInterestingPoints3D(view, result.points, colors);

        // Add equation label in 3D space
        view
            .array({
                id: 'equation-label-3d',
                data: [[xMin + (xMax - xMin) * 0.05, yMax - (yMax - yMin) * 0.05, zMax + zPadding]],
                channels: 3,
            })
            .text({
                data: [`f(x, y) = ${equation}`],
            })
            .label({
                color: colors.textMuted,
                size: 14,
                outline: 2,
            });

        console.log('[MathBox] 3D rendering complete');
    }

    private addInterestingPoints2D(view: any, points: InterestingPoint[], colors: any): void {
        if (!points || points.length === 0) return;

        const colorMap: { [key: number]: string } = {
            0: '#ef4444',  // zeros - red
            1: '#3b82f6',  // intercepts - blue
            2: '#10b981',  // maxima - green
            3: '#f59e0b'   // minima - orange
        };

        // Group points by type
        const byType: { [key: number]: InterestingPoint[] } = {};
        points.forEach((pt: InterestingPoint) => {
            const type = pt.type;
            if (!byType[type]) {
                byType[type] = [];
            }
            const group = byType[type];
            if (group) {
                group.push(pt);
            }
        });

        // Add each group as a separate point cloud
        Object.entries(byType).forEach(([typeStr, pts]) => {
            const type = parseInt(typeStr);
            view
                .array({
                    data: pts.map((p: InterestingPoint) => [p.location.x, p.location.y, 0]),
                    channels: 3,
                })
                .point({
                    color: colorMap[type] || colors.accentColor,
                    size: 20,
                    zIndex: 10,
                });

            // Add labels for interesting points
            pts.forEach((pt: InterestingPoint) => {
                view
                    .array({
                        data: [[pt.location.x, pt.location.y, 0]],
                        channels: 3,
                    })
                    .text({
                        data: [pt.label],
                    })
                    .label({
                        color: colorMap[type] || colors.accentColor,
                        size: 10,
                        offset: [0, 20],
                        outline: 2,
                    });
            });
        });
    }

    private addInterestingPoints3D(view: any, points: InterestingPoint[], colors: any): void {
        if (!points || points.length === 0) return;

        const colorMap: { [key: number]: string } = {
            0: '#ef4444',  // zeros
            1: '#3b82f6',  // intercepts
            2: '#10b981',  // maxima
            3: '#f59e0b'   // minima
        };

        // Group by type
        const byType: { [key: number]: InterestingPoint[] } = {};
        points.forEach((pt: InterestingPoint) => {
            const type = pt.type;
            if (!byType[type]) byType[type] = [];
            byType[type].push(pt);
        });

        // Add each group
        Object.entries(byType).forEach(([typeStr, pts]) => {
            const type = parseInt(typeStr);
            view
                .array({
                    data: pts.map((p: InterestingPoint) => [p.location.x, p.location.y, p.location.z]),
                    channels: 3,
                })
                .point({
                    color: colorMap[type] || colors.accentColor,
                    size: 15,
                    zIndex: 10,
                });
        });
    }

    public updateTheme(): void {
        if (!this.mathbox || !this.currentOptions || !this.lastResult) return;

        const colors = this.themeManager.getColors();

        // Update renderer background
        if (this.mathbox && this.mathbox.three && this.mathbox.three.renderer) {
            const three = this.mathbox.three;
            three.renderer.setClearColor(new THREE.Color(colors.backgroundPrimary), 1.0);
        }

        // For full theme update, destroy old instance first to prevent WebGL context leaks
        this.destroy();
        this.render(this.lastResult, this.currentOptions, this.equation);
    }

    public destroy(): void {
        console.log('[MathBox] Destroying renderer...');
        
        if (this.mathbox) {
            try {
                // Get the Three.js instance before removing
                const three = this.mathbox.three;
                
                // Remove all MathBox elements
                this.mathbox.remove('*');
                
                // Properly dispose of Three.js resources
                if (three) {
                    if (three.renderer) {
                        // Force context loss to free WebGL context
                        const gl = three.renderer.getContext();
                        if (gl) {
                            const loseContextExt = gl.getExtension('WEBGL_lose_context');
                            if (loseContextExt) {
                                loseContextExt.loseContext();
                            }
                        }
                        
                        three.renderer.dispose();
                        three.renderer.forceContextLoss();
                    }
                    
                    // Dispose of scene resources
                    if (three.scene) {
                        three.scene.traverse((object: any) => {
                            if (object.geometry) {
                                object.geometry.dispose();
                            }
                            if (object.material) {
                                if (Array.isArray(object.material)) {
                                    object.material.forEach((material: any) => material.dispose());
                                } else {
                                    object.material.dispose();
                                }
                            }
                        });
                    }
                }
                
                this.mathbox = null;
                console.log('[MathBox] Renderer destroyed successfully');
            } catch (error) {
                console.error('[MathBox] Error destroying renderer:', error);
            }
        }

        // Clear container
        if (this.container) {
            this.container.empty();
        }
    }

    public resize(width: number, height: number): void {
        if (this.mathbox && this.mathbox.three) {
            const three = this.mathbox.three;
            three.camera.aspect = width / height;
            three.camera.updateProjectionMatrix();
            three.renderer.setSize(width, height);
        }
    }

    private renderError(message: string): void {
        const colors = this.themeManager.getColors();
        
        this.container.empty();
        
        const errorDiv = this.container.createDiv({ cls: 'mathbox-error' });
        errorDiv.style.padding = '15px';
        errorDiv.style.color = colors.textNormal;
        errorDiv.style.backgroundColor = colors.backgroundSecondary;
        errorDiv.style.border = `1px solid ${colors.borderColor}`;
        errorDiv.style.borderRadius = '4px';
        errorDiv.style.fontFamily = 'var(--font-monospace)';
        errorDiv.style.fontSize = '13px';
        
        const titleEl = errorDiv.createEl('div', {
            text: '⚠️ Error',
        });
        titleEl.style.fontWeight = 'bold';
        titleEl.style.marginBottom = '8px';
        titleEl.style.color = '#ef4444';
        
        errorDiv.createEl('div', {
            text: message,
        });
    }
}