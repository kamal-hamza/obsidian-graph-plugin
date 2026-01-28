export interface ThemeConfig {
    backgroundColor: string;
    // The main X,Y,Z axes lines
    axisColor: string;
    // The labels (x,y,z, numbers)
    labelColor: string;
    // The inner grid lines on the planes
    gridColor: string;
    majorGridColor: string;
    minorGridColor: string;
    // The outer bounding box "cage"
    gridCageColor: string;
    textColor: string;
    fontFamily: string;
    graphColor: string;
    contourColor: string; // New option
    colorMap: {
        start: string;
        end: string;
    };
}

export const DEFAULT_THEME: ThemeConfig = {
    // Dark background
    backgroundColor: '#1e1e1e',
    // Pure white for maximum visibility axes
    axisColor: '#FFFFFF',
    // Light gray for labels
    labelColor: '#cccccc',
    // Subtle gray for inner grid lines
    gridColor: '#444444',
    majorGridColor: '#666666',
    minorGridColor: '#333333',
    // Brighter gray for the outer bounding cage so it stands out
    gridCageColor: '#888888',
    textColor: '#ffffff',
    fontFamily: 'Inter, sans-serif',
    graphColor: '#ffffff',
    contourColor: '#aaaaaa', // Default
    colorMap: {
        start: '#0000ff',
        end: '#ff0000',
    },
};
