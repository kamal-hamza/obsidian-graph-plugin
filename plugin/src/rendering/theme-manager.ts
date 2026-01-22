// ThemeManager - Dynamically pulls Obsidian's CSS variables for native look and feel

export interface ThemeColors {
    textNormal: string;
    textMuted: string;
    textFaint: string;
    interactiveAccent: string;
    interactiveAccentHover: string;
    backgroundPrimary: string;
    backgroundSecondary: string;
    backgroundModifier: string;
    borderColor: string;
}

export class ThemeManager {
    private static instance: ThemeManager;
    private colors: ThemeColors | null = null;

    private constructor() {}

    /**
     * Get the singleton instance of ThemeManager
     */
    public static getInstance(): ThemeManager {
        if (!ThemeManager.instance) {
            ThemeManager.instance = new ThemeManager();
        }
        return ThemeManager.instance;
    }

    /**
     * Get CSS variable value from document
     */
    private getCSSVariable(varName: string): string {
        const style = getComputedStyle(document.body);
        return style.getPropertyValue(varName).trim();
    }

    /**
     * Refresh theme colors from current Obsidian theme
     */
    public refreshColors(): ThemeColors {
        this.colors = {
            textNormal: this.getCSSVariable('--text-normal') || '#dcddde',
            textMuted: this.getCSSVariable('--text-muted') || '#a0a0a0',
            textFaint: this.getCSSVariable('--text-faint') || '#6c6c6c',
            interactiveAccent: this.getCSSVariable('--interactive-accent') || '#7c3aed',
            interactiveAccentHover: this.getCSSVariable('--interactive-accent-hover') || '#8b5cf6',
            backgroundPrimary: this.getCSSVariable('--background-primary') || '#202020',
            backgroundSecondary: this.getCSSVariable('--background-secondary') || '#161616',
            backgroundModifier: this.getCSSVariable('--background-modifier-border') || '#333333',
            borderColor: this.getCSSVariable('--background-modifier-border') || '#333333'
        };
        return this.colors;
    }

    /**
     * Get current theme colors (cached)
     */
    public getColors(): ThemeColors {
        if (!this.colors) {
            return this.refreshColors();
        }
        return this.colors;
    }

    /**
     * Convert hex color to RGB array [r, g, b] (0-1 range for Three.js)
     */
    public hexToRGB(hex: string): [number, number, number] {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Handle 3-digit hex
        if (hex.length === 3) {
            hex = hex.split('').map(char => char + char).join('');
        }
        
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;
        
        return [r, g, b];
    }

    /**
     * Convert hex color to RGB array [r, g, b] (0-255 range for canvas)
     */
    public hexToRGB255(hex: string): [number, number, number] {
        hex = hex.replace('#', '');
        
        if (hex.length === 3) {
            hex = hex.split('').map(char => char + char).join('');
        }
        
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return [r, g, b];
    }

    /**
     * Convert hex to rgba string
     */
    public hexToRGBA(hex: string, alpha: number = 1): string {
        const [r, g, b] = this.hexToRGB255(hex);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Listen for theme changes and refresh colors
     */
    public setupThemeListener(callback?: () => void): void {
        // Watch for theme changes via mutation observer
        const observer = new MutationObserver(() => {
            this.refreshColors();
            callback?.();
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });

        // Also refresh on window resize (some themes adjust on size)
        window.addEventListener('resize', () => {
            this.refreshColors();
            callback?.();
        });
    }
}

// Export convenience function
export function getThemeColors(): ThemeColors {
    return ThemeManager.getInstance().getColors();
}