// Renderer2D - Uses Plotly.js for interactive 2D visualization with hover tooltips

import Plotly from 'plotly.js-dist-min';
import type { GraphResult, InterestingPoint, ResultType, MathEngineModule } from '../types';
import { ThemeManager } from './theme-manager';

export interface Renderer2DOptions {
    width: number;
    height: number;
    title?: string;
    showGrid?: boolean;
    showLegend?: boolean;
}

export class Renderer2D {
    private themeManager: ThemeManager;
    private container: HTMLElement;
    private plotDiv: HTMLElement | null = null;
    private wasmModule: MathEngineModule | null = null;
    private equation: string = '';
    private currentOptions: Renderer2DOptions | null = null;
    private isRecalculating: boolean = false;

    constructor(container: HTMLElement, wasmModule?: MathEngineModule) {
        this.container = container;
        this.themeManager = ThemeManager.getInstance();
        this.wasmModule = wasmModule || null;
    }

    /**
     * Render a 2D graph from the WASM GraphResult
     * Now supports dynamic recalculation on zoom/pan (Desmos-style)
     */
    public render(result: GraphResult, options: Renderer2DOptions, equation?: string): void {
        // Store equation for dynamic recalculation
        if (equation) {
            this.equation = equation;
        }
        this.currentOptions = options;
        // Clear any existing chart
        this.destroy();

        // Handle error case
        if (!result.success) {
            this.renderError(result.errorMessage);
            return;
        }

        // Extract data from result
        const xData: number[] = [];
        const yData: number[] = [];

        // Extract x and y data from path
        for (const point of result.path) {
            xData.push(point.x);
            yData.push(point.y);
        }

        // Debug: Log data ranges
        console.log('2D Renderer data:', {
            pathSize: result.path.length,
            xDataLength: xData.length,
            yDataLength: yData.length,
            xRange: [Math.min(...xData), Math.max(...xData)],
            yRange: [Math.min(...yData), Math.max(...yData)],
            firstPoints: xData.slice(0, 5).map((x, i) => ({ x, y: yData[i] })),
            lastPoints: xData.slice(-5).map((x, i) => ({ x, y: yData[yData.length - 5 + i] }))
        });

        // Get theme colors
        const colors = this.themeManager.getColors();

        // Create plot container
        this.plotDiv = this.container.createDiv({ cls: 'math-graph-2d-plotly' });
        this.plotDiv.style.width = `${options.width}px`;
        this.plotDiv.style.height = `${options.height}px`;

        // Main function trace
        const mainTrace: Partial<Plotly.PlotData> = {
            x: xData,
            y: yData,
            type: 'scatter',
            mode: 'lines',
            name: 'f(x)',
            line: {
                color: colors.interactiveAccent,
                width: 2,
            },
            hovertemplate: 'x: %{x:.4f}<br>y: %{y:.4f}<extra></extra>',
        };

        const traces: Partial<Plotly.PlotData>[] = [mainTrace];

        // Group interesting points by type
        const zeros: InterestingPoint[] = [];
        const intercepts: InterestingPoint[] = [];
        const maxima: InterestingPoint[] = [];
        const minima: InterestingPoint[] = [];

        for (const point of result.points) {
            switch (point.type) {
                case 0: // ZERO
                    zeros.push(point);
                    break;
                case 1: // INTERCEPT
                    intercepts.push(point);
                    break;
                case 2: // MAXIMA
                    maxima.push(point);
                    break;
                case 3: // MINIMA
                    minima.push(point);
                    break;
            }
        }

        // Add traces for interesting points with labels and tooltips
        if (zeros.length > 0) {
            traces.push({
                x: zeros.map(p => p.location.x),
                y: zeros.map(p => p.location.y),
                type: 'scatter',
                mode: 'markers+text' as any,
                name: 'Zeros',
                text: zeros.map(p => p.label || ''),
                textposition: 'top center',
                textfont: {
                    size: 10,
                    color: colors.textNormal,
                },
                marker: {
                    size: 10,
                    color: colors.interactiveAccent,
                    symbol: 'circle',
                    line: {
                        color: colors.interactiveAccent,
                        width: 2,
                    },
                },
                hovertemplate: '<b>Zero</b><br>x: %{x:.4f}<br>y: %{y:.4f}<extra></extra>',
            });
        }

        if (maxima.length > 0) {
            traces.push({
                x: maxima.map(p => p.location.x),
                y: maxima.map(p => p.location.y),
                type: 'scatter',
                mode: 'markers+text' as any,
                name: 'Local Max',
                text: maxima.map(p => p.label || ''),
                textposition: 'top center',
                textfont: {
                    size: 10,
                    color: colors.textNormal,
                },
                marker: {
                    size: 10,
                    color: '#10b981',
                    symbol: 'triangle-up',
                    line: {
                        color: '#10b981',
                        width: 2,
                    },
                },
                hovertemplate: '<b>Local Maximum</b><br>x: %{x:.4f}<br>y: %{y:.4f}<extra></extra>',
            });
        }

        if (minima.length > 0) {
            traces.push({
                x: minima.map(p => p.location.x),
                y: minima.map(p => p.location.y),
                type: 'scatter',
                mode: 'markers+text' as any,
                name: 'Local Min',
                text: minima.map(p => p.label || ''),
                textposition: 'bottom center',
                textfont: {
                    size: 10,
                    color: colors.textNormal,
                },
                marker: {
                    size: 10,
                    color: '#ef4444',
                    symbol: 'triangle-down',
                    line: {
                        color: '#ef4444',
                        width: 2,
                    },
                },
                hovertemplate: '<b>Local Minimum</b><br>x: %{x:.4f}<br>y: %{y:.4f}<extra></extra>',
            });
        }

        if (intercepts.length > 0) {
            traces.push({
                x: intercepts.map(p => p.location.x),
                y: intercepts.map(p => p.location.y),
                type: 'scatter',
                mode: 'markers+text' as any,
                name: 'Intercepts',
                text: intercepts.map(p => p.label || ''),
                textposition: 'top center',
                textfont: {
                    size: 10,
                    color: colors.textNormal,
                },
                marker: {
                    size: 8,
                    color: colors.textMuted,
                    symbol: 'diamond',
                    line: {
                        color: colors.textMuted,
                        width: 2,
                    },
                },
                hovertemplate: '<b>Intercept</b><br>x: %{x:.4f}<br>y: %{y:.4f}<extra></extra>',
            });
        }

        // Layout configuration
        const layout: Partial<Plotly.Layout> = {
            title: options.title ? {
                text: options.title,
                font: {
                    family: 'var(--font-interface)',
                    size: 14,
                    color: colors.textNormal,
                },
            } : undefined,
            autosize: false,
            width: options.width,
            height: options.height,
            margin: {
                l: 60,
                r: 40,
                t: options.title ? 50 : 20,
                b: 50,
            },
            paper_bgcolor: colors.backgroundPrimary,
            plot_bgcolor: colors.backgroundSecondary,
            xaxis: {
                title: {
                    text: 'x',
                    font: {
                        family: 'var(--font-interface)',
                        size: 12,
                        color: colors.textMuted,
                    },
                },
                gridcolor: colors.backgroundModifier,
                gridwidth: 1,
                showgrid: options.showGrid !== false,
                zeroline: true,
                zerolinecolor: colors.textFaint,
                zerolinewidth: 2,
                color: colors.textMuted,
            },
            yaxis: {
                title: {
                    text: 'f(x)',
                    font: {
                        family: 'var(--font-interface)',
                        size: 12,
                        color: colors.textMuted,
                    },
                },
                gridcolor: colors.backgroundModifier,
                gridwidth: 1,
                showgrid: options.showGrid !== false,
                zeroline: true,
                zerolinecolor: colors.textFaint,
                zerolinewidth: 2,
                color: colors.textMuted,
            },
            showlegend: options.showLegend !== false && (zeros.length > 0 || maxima.length > 0 || minima.length > 0 || intercepts.length > 0),
            legend: {
                x: 1,
                xanchor: 'right',
                y: 1,
                bgcolor: this.themeManager.hexToRGBA(colors.backgroundSecondary, 0.9),
                bordercolor: colors.borderColor,
                borderwidth: 1,
                font: {
                    family: 'var(--font-interface)',
                    size: 11,
                    color: colors.textNormal,
                },
            },
            hovermode: 'closest',
            hoverlabel: {
                bgcolor: colors.backgroundSecondary,
                bordercolor: colors.borderColor,
                font: {
                    family: 'var(--font-monospace)',
                    size: 12,
                    color: colors.textNormal,
                },
            },
        };

        // Configuration for interactivity
        const config: Partial<Plotly.Config> = {
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            toImageButtonOptions: {
                format: 'png',
                filename: 'graph',
                height: options.height,
                width: options.width,
                scale: 2,
            },
        };

        // Create the plot
        Plotly.newPlot(this.plotDiv, traces, layout, config);

        // Add dynamic recalculation on zoom/pan (Desmos-style)
        if (this.wasmModule && this.equation) {
            (this.plotDiv as any).on('plotly_relayout', (eventData: any) => {
                this.handleZoomPan(eventData);
            });
        }
    }

    /**
     * Handle zoom/pan events and dynamically recalculate function
     * This makes the graph behave like Desmos - infinite zooming with recalculation
     */
    private async handleZoomPan(eventData: any): Promise<void> {
        // Avoid recursive recalculation
        if (this.isRecalculating || !this.wasmModule || !this.equation || !this.plotDiv || !this.currentOptions) {
            return;
        }

        // Check if this is a zoom/pan event (has xaxis.range or autosize)
        const hasXRange = eventData['xaxis.range[0]'] !== undefined || eventData['xaxis.range'] !== undefined;
        const hasAutosize = eventData.autosize !== undefined;
        
        if (!hasXRange && !hasAutosize) {
            return;
        }

        this.isRecalculating = true;

        try {
            // Get current axis ranges from the plot
            const layout = (this.plotDiv as any).layout;
            let xMin: number, xMax: number;

            if (eventData['xaxis.range[0]'] !== undefined) {
                xMin = eventData['xaxis.range[0]'];
                xMax = eventData['xaxis.range[1]'];
            } else if (eventData['xaxis.range'] !== undefined) {
                xMin = eventData['xaxis.range'][0];
                xMax = eventData['xaxis.range'][1];
            } else if (layout.xaxis && layout.xaxis.range) {
                xMin = layout.xaxis.range[0];
                xMax = layout.xaxis.range[1];
            } else {
                this.isRecalculating = false;
                return;
            }

            // Expand range slightly to ensure smooth edges
            const range = xMax - xMin;
            const padding = range * 0.1;
            xMin -= padding;
            xMax += padding;

            // Calculate appropriate resolution based on zoom level
            // More zoomed in = higher resolution for smoother curves
            const resolution = Math.min(800, Math.max(200, Math.floor(500 / Math.log10(range + 1))));

            console.log('Dynamic recalculation:', { xMin, xMax, resolution, range });

            // Call WASM to recalculate with new range
            const wasmResult = this.wasmModule.calculate2D(
                this.equation,
                xMin,
                xMax,
                resolution
            );

            if (!wasmResult.success) {
                console.warn('Recalculation failed:', wasmResult.errorMessage);
                this.isRecalculating = false;
                return;
            }

            // Convert to plain arrays
            const xData: number[] = [];
            const yData: number[] = [];
            const pathSize = wasmResult.path.size();
            
            for (let i = 0; i < pathSize; i++) {
                const point = wasmResult.path.get(i);
                xData.push(point.x);
                yData.push(point.y);
            }

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

            // Update the main trace
            const updateData: any = {
                x: [xData],
                y: [yData],
            };

            // Group interesting points by type
            const zeros = points.filter(p => p.type === 0);
            const maxima = points.filter(p => p.type === 2);
            const minima = points.filter(p => p.type === 3);
            const intercepts = points.filter(p => p.type === 1);

            // Add interesting points data
            let traceIndex = 1;
            if (zeros.length > 0) {
                updateData.x[traceIndex] = zeros.map(p => p.location.x);
                updateData.y[traceIndex] = zeros.map(p => p.location.y);
                traceIndex++;
            }
            if (maxima.length > 0) {
                updateData.x[traceIndex] = maxima.map(p => p.location.x);
                updateData.y[traceIndex] = maxima.map(p => p.location.y);
                traceIndex++;
            }
            if (minima.length > 0) {
                updateData.x[traceIndex] = minima.map(p => p.location.x);
                updateData.y[traceIndex] = minima.map(p => p.location.y);
                traceIndex++;
            }
            if (intercepts.length > 0) {
                updateData.x[traceIndex] = intercepts.map(p => p.location.x);
                updateData.y[traceIndex] = intercepts.map(p => p.location.y);
                traceIndex++;
            }

            // Update plot with new data (use Plotly.restyle to avoid triggering another relayout)
            await Plotly.restyle(this.plotDiv, updateData);

        } catch (error) {
            console.error('Error during dynamic recalculation:', error);
        } finally {
            this.isRecalculating = false;
        }
    }

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
     * Destroy the chart and clean up
     */
    public destroy(): void {
        if (this.plotDiv) {
            Plotly.purge(this.plotDiv);
            this.plotDiv = null;
        }
        this.container.empty();
    }

    /**
     * Update chart size
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