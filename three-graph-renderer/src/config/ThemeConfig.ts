export interface ThemeConfig {
    backgroundColor: string;
    axisColor: string;
    gridColor: string;
    majorGridColor: string;
    minorGridColor: string;
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
    backgroundColor: '#1e1e1e',
    axisColor: '#888888',
    gridColor: '#444444',
    majorGridColor: '#666666',
    minorGridColor: '#333333',
    textColor: '#ffffff',
    fontFamily: 'Inter, sans-serif',
    graphColor: '#ffffff',
    contourColor: '#aaaaaa', // Default
    colorMap: {
        start: '#0000ff',
        end: '#ff0000',
    },
};
