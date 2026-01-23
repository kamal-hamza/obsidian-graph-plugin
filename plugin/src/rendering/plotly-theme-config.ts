// PlotlyThemeConfig - Centralized theme configuration for Plotly graphs
// Handles all styling, colors, and theme updates in one place

import type { Layout, Config, PlotData } from 'plotly.js-dist-min';
import { ThemeManager, type ThemeColors } from './theme-manager';

/**
 * Manages all Plotly theme configuration and styling
 */
export class PlotlyThemeConfig {
    private themeManager: ThemeManager;

    constructor() {
        this.themeManager = ThemeManager.getInstance();
    }

    /**
     * Generate a theme-aware colorscale for 3D surfaces
     * Uses accent colors to match Obsidian theme
     */
    public generateColorscale(): Array<[number, string]> {
        const colors = this.themeManager.getColors();
        
        // Convert colors to RGB format (Plotly requirement)
        const accentHex = this.colorToHex(colors.interactiveAccent);
        const accentHoverHex = this.colorToHex(colors.interactiveAccentHover);
        
        // Create gradient: dark accent → accent → accent-hover → light accent
        const darkShade = this.darkenColor(accentHex, 0.4);
        const midDark = this.darkenColor(accentHex, 0.2);
        const midLight = this.lightenColor(accentHoverHex, 0.2);
        const lightShade = this.lightenColor(accentHoverHex, 0.4);
        
        // Convert to RGB format for Plotly
        const toRGB = (hex: string): string => {
            const rgb = this.themeManager.hexToRGB255(hex);
            return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        };
        
        return [
            [0, toRGB(darkShade)],
            [0.25, toRGB(midDark)],
            [0.4, toRGB(accentHex)],
            [0.6, toRGB(accentHoverHex)],
            [0.75, toRGB(midLight)],
            [1, toRGB(lightShade)]
        ];
    }

    /**
     * Get complete 2D layout configuration
     */
    public get2DLayout(width: number, height: number, title?: string, showGrid: boolean = true): Partial<Layout> {
        const colors = this.themeManager.getColors();

        return {
            width,
            height,
            title: title ? {
                text: title,
                font: {
                    color: colors.textNormal,
                    family: 'var(--font-interface)',
                    size: 16,
                },
            } : undefined,
            paper_bgcolor: colors.backgroundSecondary,
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: {
                color: colors.textNormal,
                family: 'var(--font-interface)',
                size: 12,
            },
            xaxis: {
                title: {
                    text: 'x',
                    font: {
                        color: colors.textMuted,
                    },
                },
                gridcolor: colors.backgroundModifier,
                gridwidth: 1,
                showgrid: showGrid,
                zerolinecolor: colors.interactiveAccent,
                zerolinewidth: 1.5,
                linecolor: colors.borderColor,
                linewidth: 1,
                color: colors.textNormal,
                tickfont: {
                    color: colors.textMuted,
                },
            },
            yaxis: {
                title: {
                    text: 'y',
                    font: {
                        color: colors.textMuted,
                    },
                },
                gridcolor: colors.backgroundModifier,
                gridwidth: 1,
                showgrid: showGrid,
                zerolinecolor: colors.interactiveAccent,
                zerolinewidth: 1.5,
                linecolor: colors.borderColor,
                linewidth: 1,
                color: colors.textNormal,
                tickfont: {
                    color: colors.textMuted,
                },
            },
            hovermode: 'closest',
            showlegend: false,
            margin: {
                l: 50,
                r: 20,
                t: title ? 40 : 20,
                b: 50,
            },
        };
    }

    /**
     * Get complete 3D layout configuration with proper colorscale defaults
     */
    public get3DLayout(width: number, height: number, title?: string, showGrid: boolean = true, showLegend: boolean = false): Partial<Layout> {
        const colors = this.themeManager.getColors();

        return {
            width,
            height,
            title: title ? {
                text: title,
                font: {
                    color: colors.textNormal,
                    family: 'var(--font-interface)',
                    size: 16,
                },
            } : undefined,
            paper_bgcolor: colors.backgroundSecondary,
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: {
                color: colors.textNormal,
                family: 'var(--font-interface)',
                size: 12,
            },
            scene: {
                xaxis: {
                    title: {
                        text: 'x',
                        font: {
                            color: colors.textMuted,
                        },
                    },
                    gridcolor: colors.backgroundModifier,
                    gridwidth: 1,
                    showgrid: showGrid,
                    backgroundcolor: colors.backgroundPrimary,
                    color: colors.textNormal,
                    tickfont: {
                        color: colors.textMuted,
                    },
                },
                yaxis: {
                    title: {
                        text: 'y',
                        font: {
                            color: colors.textMuted,
                        },
                    },
                    gridcolor: colors.backgroundModifier,
                    gridwidth: 1,
                    showgrid: showGrid,
                    backgroundcolor: colors.backgroundPrimary,
                    color: colors.textNormal,
                    tickfont: {
                        color: colors.textMuted,
                    },
                },
                zaxis: {
                    title: {
                        text: 'z',
                        font: {
                            color: colors.textMuted,
                        },
                    },
                    gridcolor: colors.backgroundModifier,
                    gridwidth: 1,
                    showgrid: showGrid,
                    backgroundcolor: colors.backgroundPrimary,
                    color: colors.textNormal,
                    tickfont: {
                        color: colors.textMuted,
                    },
                },
                bgcolor: 'rgba(0,0,0,0)',
            },
            hovermode: 'closest',
            showlegend: showLegend,
            legend: {
                bgcolor: colors.backgroundSecondary,
                bordercolor: colors.borderColor,
                borderwidth: 1,
                font: {
                    color: colors.textNormal,
                    family: 'var(--font-interface)',
                },
            },
            margin: {
                l: 0,
                r: 0,
                t: title ? 30 : 10,
                b: 0,
            },
        };
    }

    /**
     * Apply theme styling to a 2D line trace
     */
    public style2DTrace(trace: Partial<PlotData>): Partial<PlotData> {
        const colors = this.themeManager.getColors();

        return {
            ...trace,
            line: {
                color: colors.interactiveAccent,
                width: 2,
            },
            hoverlabel: {
                bgcolor: colors.backgroundSecondary,
                bordercolor: colors.interactiveAccent,
                font: {
                    color: colors.textNormal,
                    family: 'var(--font-interface)',
                },
            },
        };
    }

    /**
     * Apply theme styling to a 3D surface trace with proper colorscale
     */
    public style3DSurfaceTrace(trace: Partial<PlotData>, equation?: string): Partial<PlotData> {
        const colors = this.themeManager.getColors();
        const colorscale = this.generateColorscale();

        return {
            ...trace,
            type: 'surface',
            colorscale: colorscale,
            reversescale: false,
            showscale: true,
            colorbar: {
                title: {
                    text: 'z',
                    font: {
                        color: colors.textNormal,
                        family: 'var(--font-interface)',
                    },
                },
                tickfont: {
                    color: colors.textMuted,
                },
                outlinecolor: colors.borderColor,
                bgcolor: colors.backgroundSecondary,
            },
            name: equation || 'f(x, y)',
            hovertemplate: 'x: %{x}<br>y: %{y}<br>z: %{z}<extra></extra>',
            hoverlabel: {
                bgcolor: colors.backgroundSecondary,
                bordercolor: colors.interactiveAccent,
                font: {
                    color: colors.textNormal,
                },
            },
            contours: {
                x: {
                    show: true,
                    usecolormap: true,
                    highlightcolor: colors.interactiveAccent,
                    project: { z: true }
                }
            },
        } as any;
    }

    /**
     * Apply theme styling to 3D scatter points
     */
    public style3DScatterTrace(trace: Partial<PlotData>): Partial<PlotData> {
        const colors = this.themeManager.getColors();

        return {
            ...trace,
            type: 'scatter3d',
            mode: 'markers',
            marker: {
                size: 6,
                color: trace.marker?.color || colors.textMuted,
                line: {
                    color: colors.borderColor,
                    width: 0.5,
                },
            },
            hoverlabel: {
                bgcolor: colors.backgroundSecondary,
                bordercolor: colors.interactiveAccent,
                font: {
                    color: colors.textNormal,
                },
            },
        };
    }

    /**
     * Get Plotly config with theme-aware settings
     */
    public getPlotlyConfig(): Partial<Config> {
        return {
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        };
    }

    /**
     * Get updates for theme change (for Plotly.update call)
     */
    public getThemeUpdateForMode(mode: '2d' | '3d'): { traceUpdate: any; layoutUpdate: any } {
        const colors = this.themeManager.getColors();

        const layoutUpdate: any = {
            paper_bgcolor: colors.backgroundSecondary,
            plot_bgcolor: 'rgba(0,0,0,0)',
            'font.color': colors.textNormal,
        };

        const traceUpdate: any = {
            'line.color': colors.interactiveAccent,
            'hoverlabel.bgcolor': colors.backgroundSecondary,
            'hoverlabel.bordercolor': colors.interactiveAccent,
            'hoverlabel.font.color': colors.textNormal,
        };

        if (mode === '2d') {
            layoutUpdate['xaxis.gridcolor'] = colors.backgroundModifier;
            layoutUpdate['xaxis.zerolinecolor'] = colors.interactiveAccent;
            layoutUpdate['xaxis.linecolor'] = colors.borderColor;
            layoutUpdate['xaxis.color'] = colors.textNormal;
            layoutUpdate['xaxis.tickfont.color'] = colors.textMuted;
            
            layoutUpdate['yaxis.gridcolor'] = colors.backgroundModifier;
            layoutUpdate['yaxis.zerolinecolor'] = colors.interactiveAccent;
            layoutUpdate['yaxis.linecolor'] = colors.borderColor;
            layoutUpdate['yaxis.color'] = colors.textNormal;
            layoutUpdate['yaxis.tickfont.color'] = colors.textMuted;
        } else {
            // 3D scene updates
            layoutUpdate['scene.xaxis.gridcolor'] = colors.backgroundModifier;
            layoutUpdate['scene.xaxis.backgroundcolor'] = colors.backgroundPrimary;
            layoutUpdate['scene.xaxis.color'] = colors.textNormal;
            layoutUpdate['scene.xaxis.tickfont.color'] = colors.textMuted;
            
            layoutUpdate['scene.yaxis.gridcolor'] = colors.backgroundModifier;
            layoutUpdate['scene.yaxis.backgroundcolor'] = colors.backgroundPrimary;
            layoutUpdate['scene.yaxis.color'] = colors.textNormal;
            layoutUpdate['scene.yaxis.tickfont.color'] = colors.textMuted;
            
            layoutUpdate['scene.zaxis.gridcolor'] = colors.backgroundModifier;
            layoutUpdate['scene.zaxis.backgroundcolor'] = colors.backgroundPrimary;
            layoutUpdate['scene.zaxis.color'] = colors.textNormal;
            layoutUpdate['scene.zaxis.tickfont.color'] = colors.textMuted;

            // CRITICAL: Update colorscale for 3D surface
            traceUpdate['colorscale'] = this.generateColorscale();
            traceUpdate['colorbar.title.font.color'] = colors.textNormal;
            traceUpdate['colorbar.tickfont.color'] = colors.textMuted;
            traceUpdate['colorbar.outlinecolor'] = colors.borderColor;
            traceUpdate['colorbar.bgcolor'] = colors.backgroundSecondary;
        }

        return { traceUpdate, layoutUpdate };
    }

    /**
     * Convert any CSS color to hex
     */
    private colorToHex(color: string): string {
        if (color.startsWith('#')) {
            return color;
        }
        
        const temp = document.createElement('div');
        temp.style.color = color;
        document.body.appendChild(temp);
        
        const computed = getComputedStyle(temp).color;
        document.body.removeChild(temp);
        
        const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match || !match[1] || !match[2] || !match[3]) {
            return '#7c3aed'; // Fallback purple
        }
        
        const r = parseInt(match[1], 10);
        const g = parseInt(match[2], 10);
        const b = parseInt(match[3], 10);
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    /**
     * Darken a hex color
     */
    private darkenColor(hex: string, factor: number): string {
        const rgb = this.themeManager.hexToRGB255(hex);
        const darkened = rgb.map((c: number) => Math.round(c * (1 - factor)));
        return `#${darkened.map((c: number) => c.toString(16).padStart(2, '0')).join('')}`;
    }

    /**
     * Lighten a hex color
     */
    private lightenColor(hex: string, factor: number): string {
        const rgb = this.themeManager.hexToRGB255(hex);
        const lightened = rgb.map((c: number) => Math.round(c + (255 - c) * factor));
        return `#${lightened.map((c: number) => c.toString(16).padStart(2, '0')).join('')}`;
    }
}