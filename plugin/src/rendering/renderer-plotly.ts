// High-performance unified Plotly.js renderer for both 2D and 3D graphs
// Leverages Plotly's native WebGL acceleration and built-in interaction

import * as Plotly from 'plotly.js-dist-min';
import type { GraphResult, InterestingPoint, ResultType, MathEngineModule } from '../types';
import { ThemeManager } from './theme-manager';

export interface RendererPlotlyOptions {
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
 * High-performance unified Plotly.js renderer
 * Works for both 2D and 3D graphs with native acceleration
 */
export class RendererPlotly {
    private themeManager: ThemeManager;
    private container: HTMLElement;
    private plotDiv: HTMLElement | null = null;
    
    // For dynamic recalculation (Desmos-style)
    private wasmModule: MathEngineModule | null = null;
    private equation: string = '';
    private currentOptions: RendererPlotlyOptions | null = null;
    private mode: '2d' | '3d' = '2d';
    private isRecalculating: boolean = false;
    private lastZoomLevel: number = 1;
    private recalculationDebounce: number | null = null;
    private currentResolution: number = 100;
    
    // Track ranges for dynamic recalculation
    private maxRange2D: number = 0;
    private lastResolution2D: number = 0;
    private maxRange3D: number = 0;
    private lastResolution3D: number = 0;
    
    constructor(container: HTMLElement, wasmModule?: MathEngineModule) {
        this.container = container;
        this.themeManager = ThemeManager.getInstance();
        this.wasmModule = wasmModule || null;
    }

    /**
     * Main render entry point
     */
    public render(result: GraphResult, options: RendererPlotlyOptions, equation?: string): void {
        this.currentOptions = options;
        this.mode = options.mode || '2d';
        this.equation = equation || '';

        if (!result.success) {
            this.renderError(result.errorMessage);
            return;
        }

        // Create plot container
        this.plotDiv = this.container.createDiv({ cls: 'plotly-graph-container' });
        this.plotDiv.style.width = `${options.width}px`;
        this.plotDiv.style.height = `${options.height}px`;

        // Render based on mode
        if (this.mode === '2d') {
            this.render2D(result, options);
        } else {
            this.render3D(result, options);
        }
    }

    /**
     * Render 2D graph using Plotly scattergl (WebGL accelerated)
     */
    private render2D(result: GraphResult, options: RendererPlotlyOptions): void {
        if (!this.plotDiv) return;

        const colors = this.themeManager.getObsidianColors();
        
        // Extract x and y coordinates from path
        const xData: number[] = [];
        const yData: number[] = [];
        
        for (const point of result.path) {
            xData.push(point.x);
            yData.push(point.y);
        }

        // Main line trace (WebGL accelerated)
        const mainTrace: Partial<Plotly.PlotData> = {
            x: xData,
            y: yData,
            type: 'scattergl', // WebGL acceleration for performance
            mode: 'lines',
            line: {
                color: colors.accent,
                width: 2,
            },
            name: this.equation || 'f(x)',
            hoverinfo: 'x+y',
        };

        const traces: Partial<Plotly.PlotData>[] = [mainTrace];

        // Add interesting points if requested
        if (options.showPoints !== false && result.points.length > 0) {
            const pointTraces = this.createInterestingPointTraces2D(result.points, colors);
            traces.push(...pointTraces);
        }

        // Create layout with Obsidian theme colors
        const layout: Partial<Plotly.Layout> = {
            width: options.width,
            height: options.height,
            paper_bgcolor: colors.background,
            plot_bgcolor: colors.background,
            font: {
                color: colors.text,
                family: 'var(--font-interface)',
            },
            xaxis: {
                title: 'x',
                gridcolor: colors.grid,
                zerolinecolor: colors.accent,
                showgrid: options.showGrid !== false,
                showline: options.showAxes !== false,
                linecolor: colors.grid,
                color: colors.text,
            },
            yaxis: {
                title: 'y',
                gridcolor: colors.grid,
                zerolinecolor: colors.accent,
                showgrid: options.showGrid !== false,
                showline: options.showAxes !== false,
                linecolor: colors.grid,
                color: colors.text,
            },
            hovermode: 'closest',
            showlegend: result.points.length > 0,
            legend: {
                bgcolor: colors.background,
                bordercolor: colors.grid,
                font: {
                    color: colors.text,
                },
            },
            margin: {
                l: 60,
                r: 30,
                t: 30,
                b: 50,
            },
        };

        // Config for interactivity
        const config: Partial<Plotly.Config> = {
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            scrollZoom: true,
        };

        // Render the plot
        Plotly.newPlot(this.plotDiv, traces, layout, config);

        // Setup dynamic recalculation on zoom/pan
        if (this.wasmModule && this.equation) {
            (this.plotDiv as any).on('plotly_relayout', () => {
                this.handleZoomPanDebounced();
            });
        }
    }

    /**
     * Render 3D graph using Plotly surface trace
     */
    private render3D(result: GraphResult, options: RendererPlotlyOptions): void {
        if (!this.plotDiv) return;

        const colors = this.themeManager.getObsidianColors();
        
        // Convert path array to 2D grid for surface plot
        const gridData = this.pathToGrid(result.path);
        
        if (!gridData) {
            this.renderError('Failed to convert path to grid');
            return;
        }

        // Main surface trace
        const surfaceTrace: Partial<Plotly.PlotData> = {
            x: gridData.x,
            y: gridData.y,
            z: gridData.z,
            type: 'surface',
            colorscale: 'Viridis',
            showscale: true,
            name: this.equation || 'f(x, y)',
            hovertemplate: 'x: %{x}<br>y: %{y}<br>z: %{z}<extra></extra>',
            contours: {
                x: {
                    show: true,
                    usecolormap: true,
                    highlightcolor: colors.accent,
                    project: { z: true }
                }
            } as any,
        };

        const traces: Partial<Plotly.PlotData>[] = [surfaceTrace];

        // Add interesting points if requested
        if (options.showPoints !== false && result.points.length > 0) {
            const pointTrace = this.createInterestingPointTraces3D(result.points, colors);
            traces.push(pointTrace);
        }

        // Create 3D layout
        const layout: Partial<Plotly.Layout> = {
            width: options.width,
            height: options.height,
            paper_bgcolor: colors.background,
            font: {
                color: colors.text,
                family: 'var(--font-interface)',
            },
            scene: {
                xaxis: {
                    title: 'x',
                    gridcolor: colors.grid,
                    showgrid: options.showGrid !== false,
                    backgroundcolor: colors.background,
                    color: colors.text,
                },
                yaxis: {
                    title: 'y',
                    gridcolor: colors.grid,
                    showgrid: options.showGrid !== false,
                    backgroundcolor: colors.background,
                    color: colors.text,
                },
                zaxis: {
                    title: 'z',
                    gridcolor: colors.grid,
                    showgrid: options.showGrid !== false,
                    backgroundcolor: colors.background,
                    color: colors.text,
                },
                bgcolor: colors.background,
            },
            hovermode: 'closest',
            showlegend: result.points.length > 0,
            legend: {
                bgcolor: colors.background,
                bordercolor: colors.grid,
                font: {
                    color: colors.text,
                },
            },
            margin: {
                l: 0,
                r: 0,
                t: 30,
                b: 0,
            },
        };

        // Config for 3D interactivity
        const config: Partial<Plotly.Config> = {
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        };

        // Render the plot
        Plotly.newPlot(this.plotDiv, traces, layout, config);

        // Setup dynamic recalculation on zoom/pan
        if (this.wasmModule && this.equation) {
            (this.plotDiv as any).on('plotly_relayout', () => {
                this.handleZoomPanDebounced();
            });
        }
    }

    /**
     * Convert flat path array to 2D grid for surface plot
     */
    private pathToGrid(path: any[]): { x: number[], y: number[], z: number[][] } | null {
        if (path.length === 0) return null;

        // Calculate grid size (assuming square grid)
        const gridSize = Math.sqrt(path.length);
        if (!Number.isInteger(gridSize)) {
            console.error('Path length is not a perfect square');
            return null;
        }

        const size = Math.floor(gridSize);
        const xValues: number[] = [];
        const yValues: number[] = [];
        const zGrid: number[][] = [];

        // Extract unique x and y values
        const xSet = new Set<number>();
        const ySet = new Set<number>();
        
        for (const point of path) {
            xSet.add(point.x);
            ySet.add(point.y);
        }

        const xArray = Array.from(xSet).sort((a, b) => a - b);
        const yArray = Array.from(ySet).sort((a, b) => a - b);

        // Build z grid
        for (let i = 0; i < yArray.length; i++) {
            zGrid[i] = [];
            for (let j = 0; j < xArray.length; j++) {
                const xVal = xArray[j];
                const yVal = yArray[i];
                if (xVal === undefined || yVal === undefined) continue;
                
                const point = path.find(p => 
                    Math.abs(p.x - xVal) < 0.0001 && 
                    Math.abs(p.y - yVal) < 0.0001
                );
                zGrid[i]![j] = point ? point.z : 0;
            }
        }

        return { x: xArray, y: yArray, z: zGrid };
    }

    /**
     * Create traces for interesting points in 2D
     */
    private createInterestingPointTraces2D(
        points: InterestingPoint[],
        colors: any
    ): Partial<Plotly.PlotData>[] {
        const traces: Partial<Plotly.PlotData>[] = [];

        // Group points by type
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

        // Create trace for zeros
        if (zeros.length > 0) {
            traces.push({
                x: zeros.map(p => p.location.x),
                y: zeros.map(p => p.location.y),
                type: 'scattergl',
                mode: 'markers',
                marker: {
                    color: '#3b82f6',
                    size: 10,
                    symbol: 'circle',
                },
                name: 'Zeros',
                text: zeros.map(p => p.label),
                hoverinfo: 'x+y+text' as any,
            });
        }

        // Create trace for maxima
        if (maxima.length > 0) {
            traces.push({
                x: maxima.map(p => p.location.x),
                y: maxima.map(p => p.location.y),
                type: 'scattergl',
                mode: 'markers',
                marker: {
                    color: '#10b981',
                    size: 10,
                    symbol: 'triangle-up',
                },
                name: 'Local Maxima',
                text: maxima.map(p => p.label),
                hoverinfo: 'x+y+text' as any,
            });
        }

        // Create trace for minima
        if (minima.length > 0) {
            traces.push({
                x: minima.map(p => p.location.x),
                y: minima.map(p => p.location.y),
                type: 'scattergl',
                mode: 'markers',
                marker: {
                    color: '#ef4444',
                    size: 10,
                    symbol: 'triangle-down',
                },
                name: 'Local Minima',
                text: minima.map(p => p.label),
                hoverinfo: 'x+y+text' as any,
            });
        }

        // Create trace for intercepts
        if (intercepts.length > 0) {
            traces.push({
                x: intercepts.map(p => p.location.x),
                y: intercepts.map(p => p.location.y),
                type: 'scattergl',
                mode: 'markers',
                marker: {
                    color: '#f59e0b',
                    size: 10,
                    symbol: 'diamond',
                },
                name: 'Intercepts',
                text: intercepts.map(p => p.label),
                hoverinfo: 'x+y+text' as any,
            });
        }

        return traces;
    }

    /**
     * Create trace for interesting points in 3D
     */
    private createInterestingPointTraces3D(
        points: InterestingPoint[],
        colors: any
    ): Partial<Plotly.PlotData> {
        const colorMap: { [key: number]: string } = {
            0: '#3b82f6', // zeros - blue
            1: '#f59e0b', // intercepts - amber
            2: '#10b981', // maxima - green
            3: '#ef4444', // minima - red
        };

        const markerColors = points.map(p => colorMap[p.type] || '#888888');
        
        return {
            x: points.map(p => p.location.x),
            y: points.map(p => p.location.y),
            z: points.map(p => p.location.z),
            type: 'scatter3d',
            mode: 'markers',
            marker: {
                color: markerColors,
                size: 5,
                symbol: 'circle',
            },
            name: 'Interesting Points',
            text: points.map(p => `${this.getTypeLabel(p.type)}: ${p.label}`),
            hoverinfo: 'x+y+z+text' as any,
        };
    }

    /**
     * Get label for point type
     */
    private getTypeLabel(type: ResultType): string {
        switch (type) {
            case 0: return 'Zero';
            case 1: return 'Intercept';
            case 2: return 'Local Maximum';
            case 3: return 'Local Minimum';
            default: return 'Point';
        }
    }

    /**
     * Debounced zoom/pan handler
     */
    private handleZoomPanDebounced(): void {
        if (this.recalculationDebounce !== null) {
            clearTimeout(this.recalculationDebounce);
        }
        
        this.recalculationDebounce = window.setTimeout(() => {
            this.handleZoomPan();
        }, 300); // 300ms debounce
    }

    /**
     * Handle zoom/pan for dynamic recalculation (Desmos-style)
     */
    private async handleZoomPan(): Promise<void> {
        if (this.isRecalculating || !this.wasmModule || !this.equation || !this.plotDiv) {
            return;
        }

        if (this.mode === '2d') {
            await this.handleZoomPan2D();
        } else {
            await this.handleZoomPan3D();
        }
    }

    /**
     * Handle zoom/pan for 2D graphs
     */
    private async handleZoomPan2D(): Promise<void> {
        if (!this.plotDiv) return;

        try {
            this.isRecalculating = true;

            // Get current axis ranges from Plotly
            const layout = (this.plotDiv as any).layout;
            if (!layout || !layout.xaxis || !layout.yaxis) {
                return;
            }

            const xMin = layout.xaxis.range?.[0] ?? -10;
            const xMax = layout.xaxis.range?.[1] ?? 10;
            const range = xMax - xMin;

            // Determine if we need higher resolution based on zoom
            const resolution = Math.min(1000, Math.max(100, Math.floor(400 * (20 / range))));

            // Check if we need to recalculate
            const needsRecalculation = 
                range > this.maxRange2D * 1.2 || 
                resolution > this.lastResolution2D * 1.5;

            if (!needsRecalculation) {
                return;
            }

            // Add padding to avoid edge artifacts
            const padding = range * 0.1;
            const adjustedXMin = xMin - padding;
            const adjustedXMax = xMax + padding;

            // Call WASM to recalculate
            const wasmResult = this.wasmModule!.calculate2D(
                this.equation,
                adjustedXMin,
                adjustedXMax,
                resolution
            );

            if (!wasmResult.success) {
                console.error('Recalculation failed:', wasmResult.errorMessage);
                return;
            }

            // Convert to plain arrays
            const pathSize = wasmResult.path.size();
            const xData: number[] = [];
            const yData: number[] = [];
            
            for (let i = 0; i < pathSize; i++) {
                const p = wasmResult.path.get(i);
                xData.push(p.x);
                yData.push(p.y);
            }

            // Update the plot data
            Plotly.restyle(this.plotDiv, {
                x: [xData],
                y: [yData],
            }, [0]);

            // Update tracking variables
            this.maxRange2D = Math.max(this.maxRange2D, range);
            this.lastResolution2D = resolution;

            // Clean up WASM memory
            wasmResult.delete();

        } finally {
            this.isRecalculating = false;
        }
    }

    /**
     * Handle zoom/pan for 3D graphs
     */
    private async handleZoomPan3D(): Promise<void> {
        if (!this.plotDiv) return;

        try {
            this.isRecalculating = true;

            // Get current axis ranges from Plotly
            const layout = (this.plotDiv as any).layout;
            if (!layout || !layout.scene) {
                return;
            }

            const xMin = layout.scene.xaxis.range?.[0] ?? -5;
            const xMax = layout.scene.xaxis.range?.[1] ?? 5;
            const yMin = layout.scene.yaxis.range?.[0] ?? -5;
            const yMax = layout.scene.yaxis.range?.[1] ?? 5;
            
            const xRange = xMax - xMin;
            const yRange = yMax - yMin;
            const avgRange = (xRange + yRange) / 2;

            // Determine resolution based on zoom
            const resolution = Math.min(100, Math.max(30, Math.floor(50 * (10 / avgRange))));

            // Check if we need to recalculate
            const needsRecalculation = 
                avgRange > this.maxRange3D * 1.2 || 
                resolution > this.lastResolution3D * 1.5;

            if (!needsRecalculation) {
                return;
            }

            // Call WASM to recalculate
            const wasmResult = this.wasmModule!.calculate3D(
                this.equation,
                xMin,
                xMax,
                yMin,
                yMax,
                resolution
            );

            if (!wasmResult.success) {
                console.error('Recalculation failed:', wasmResult.errorMessage);
                return;
            }

            // Convert to plain arrays
            const pathSize = wasmResult.path.size();
            const path: any[] = [];
            
            for (let i = 0; i < pathSize; i++) {
                const p = wasmResult.path.get(i);
                path.push({ x: p.x, y: p.y, z: p.z });
            }

            // Convert to grid
            const gridData = this.pathToGrid(path);
            
            if (gridData) {
                // Update the plot data
                Plotly.restyle(this.plotDiv, {
                    x: [gridData.x],
                    y: [gridData.y],
                    z: [gridData.z],
                }, [0]);
            }

            // Update tracking variables
            this.maxRange3D = Math.max(this.maxRange3D, avgRange);
            this.lastResolution3D = resolution;

            // Clean up WASM memory
            wasmResult.delete();

        } finally {
            this.isRecalculating = false;
        }
    }

    /**
     * Update theme colors dynamically when Obsidian theme changes
     */
    public updateTheme(): void {
        if (!this.plotDiv) return;

        // Refresh theme colors
        this.themeManager.refreshColors();
        const colors = this.themeManager.getObsidianColors();

        // Build update object based on mode
        const update: Partial<Plotly.Layout> = {
            paper_bgcolor: colors.background,
            plot_bgcolor: colors.background,
            font: {
                color: colors.text,
            },
        };

        if (this.mode === '2d') {
            update.xaxis = {
                gridcolor: colors.grid,
                zerolinecolor: colors.accent,
                linecolor: colors.grid,
                color: colors.text,
            } as any;
            update.yaxis = {
                gridcolor: colors.grid,
                zerolinecolor: colors.accent,
                linecolor: colors.grid,
                color: colors.text,
            } as any;
        } else {
            update.scene = {
                xaxis: {
                    gridcolor: colors.grid,
                    backgroundcolor: colors.background,
                    color: colors.text,
                } as any,
                yaxis: {
                    gridcolor: colors.grid,
                    backgroundcolor: colors.background,
                    color: colors.text,
                } as any,
                zaxis: {
                    gridcolor: colors.grid,
                    backgroundcolor: colors.background,
                    color: colors.text,
                } as any,
                bgcolor: colors.background,
            } as any;
        }

        // Update legend colors
        update.legend = {
            bgcolor: colors.background,
            bordercolor: colors.grid,
            font: {
                color: colors.text,
            },
        } as any;

        // Apply the update
        Plotly.relayout(this.plotDiv, update);

        // Update main trace color
        Plotly.restyle(this.plotDiv, {
            'line.color': colors.accent,
        }, [0]);
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
     * Destroy and cleanup
     */
    public destroy(): void {
        // Clear debounce timer
        if (this.recalculationDebounce !== null) {
            clearTimeout(this.recalculationDebounce);
            this.recalculationDebounce = null;
        }

        // Purge Plotly to free memory
        if (this.plotDiv) {
            Plotly.purge(this.plotDiv);
            this.plotDiv = null;
        }

        // Clear container
        this.container.empty();
    }

    /**
     * Update graph size
     */
    public resize(width: number, height: number): void {
        if (this.plotDiv) {
            Plotly.relayout(this.plotDiv, {
                width: width,
                height: height,
            });
        }
    }
}