// Renderer2D - Uses uPlot for ultra-fast 2D canvas-based rendering

import uPlot from 'uplot';
import type { GraphResult, InterestingPoint, ResultType } from '../types';
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
    private chart: uPlot | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
        this.themeManager = ThemeManager.getInstance();
    }

    /**
     * Render a 2D graph from the WASM GraphResult
     */
    public render(result: GraphResult, options: Renderer2DOptions): void {
        // Clear any existing chart
        this.destroy();

        // Handle error case
        if (!result.success) {
            this.renderError(result.errorMessage);
            return;
        }

        // Extract data from result
        // Note: result.path is now a plain JS array
        const xData: number[] = [];
        const yData: number[] = [];

        // Extract x and y data from path
        for (const point of result.path) {
            xData.push(point.x);
            yData.push(point.y);
        }

        // Store points array separately to avoid capturing WASM reference in closure
        const interestingPoints = result.points;

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

        // Calculate padding dynamically based on size
        // Larger graphs get more padding for labels
        const horizontalPadding = Math.max(40, Math.floor(options.width * 0.08));
        const verticalPadding = Math.max(40, Math.floor(options.height * 0.1));
        const axisLabelSize = Math.max(50, Math.floor(options.width * 0.08));

        // Set container padding dynamically
        this.container.style.padding = `${verticalPadding}px ${horizontalPadding}px`;
        this.container.style.boxSizing = 'border-box';

        // Adjust dimensions for padding
        const actualWidth = options.width - (horizontalPadding * 2);
        const actualHeight = options.height - (verticalPadding * 2);

        // Create uPlot configuration
        const opts: uPlot.Options = {
            width: actualWidth,
            height: actualHeight,
            title: options.title,
            class: 'math-graph-2d',
            cursor: {
                drag: {
                    x: true,
                    y: true,
                },
            },
            scales: {
                x: {
                    auto: true,
                },
                y: {
                    auto: true,
                },
            },
            axes: [
                {
                    stroke: colors.textMuted,
                    grid: {
                        show: options.showGrid !== false,
                        stroke: colors.backgroundModifier,
                        width: 1,
                    },
                    ticks: {
                        stroke: colors.textFaint,
                        width: 1,
                    },
                    size: axisLabelSize,
                },
                {
                    stroke: colors.textMuted,
                    grid: {
                        show: options.showGrid !== false,
                        stroke: colors.backgroundModifier,
                        width: 1,
                    },
                    ticks: {
                        stroke: colors.textFaint,
                        width: 1,
                    },
                    size: axisLabelSize,
                },
            ],
            series: [
                {
                    label: 'x',
                },
                {
                    label: 'f(x)',
                    stroke: colors.interactiveAccent,
                    width: 2,
                    points: {
                        show: false,
                    },
                },
            ],
            hooks: {
                draw: [
                    (u) => {
                        // Draw interesting points after the main series
                        this.drawInterestingPoints(u, interestingPoints);
                    },
                ],
            },
        };

        // Create the chart
        const data: uPlot.AlignedData = [xData, yData];
        this.chart = new uPlot(opts, data, this.container);
    }

    /**
     * Draw interesting points (zeros, maxima, minima) on the chart
     */
    private drawInterestingPoints(u: uPlot, points: InterestingPoint[]): void {
        const colors = this.themeManager.getColors();
        const ctx = u.ctx;

        // Iterate over points array
        for (const point of points) {
            const cx = u.valToPos(point.location.x, 'x', true);
            const cy = u.valToPos(point.location.y, 'y', true);

            if (cx == null || cy == null) continue;

            // Draw point
            ctx.save();
            ctx.beginPath();

            // Set color based on type
            switch (point.type) {
                case 0: // ZERO
                    ctx.fillStyle = this.themeManager.hexToRGBA(colors.interactiveAccent, 0.8);
                    ctx.strokeStyle = colors.interactiveAccent;
                    break;
                case 1: // INTERCEPT
                    ctx.fillStyle = this.themeManager.hexToRGBA(colors.textNormal, 0.6);
                    ctx.strokeStyle = colors.textNormal;
                    break;
                case 2: // MAXIMA
                    ctx.fillStyle = this.themeManager.hexToRGBA('#10b981', 0.8);
                    ctx.strokeStyle = '#10b981';
                    break;
                case 3: // MINIMA
                    ctx.fillStyle = this.themeManager.hexToRGBA('#ef4444', 0.8);
                    ctx.strokeStyle = '#ef4444';
                    break;
            }

            ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw label if present
            if (point.label) {
                ctx.fillStyle = colors.textNormal;
                ctx.font = '12px var(--font-interface)';
                ctx.textAlign = 'center';
                ctx.fillText(point.label, cx, cy - 12);
            }

            ctx.restore();
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
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        this.container.empty();
    }

    /**
     * Update chart size
     */
    public resize(width: number, height: number): void {
        if (this.chart) {
            // Recalculate padding dynamically
            const horizontalPadding = Math.max(40, Math.floor(width * 0.08));
            const verticalPadding = Math.max(40, Math.floor(height * 0.1));
            
            // Update container padding
            this.container.style.padding = `${verticalPadding}px ${horizontalPadding}px`;
            
            // Adjust dimensions for padding
            const actualWidth = width - (horizontalPadding * 2);
            const actualHeight = height - (verticalPadding * 2);
            
            this.chart.setSize({ width: actualWidth, height: actualHeight });
        }
    }
}