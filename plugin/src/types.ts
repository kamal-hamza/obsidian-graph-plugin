// TypeScript types matching the C++ structs from engine.hpp

// Three.js CSS2D types for axis labels
export interface CSS2DObject {
    element: HTMLElement;
    position: { x: number; y: number; z: number };
}

export interface CSS2DRenderer {
    domElement: HTMLElement;
    setSize(width: number, height: number): void;
    render(scene: any, camera: any): void;
}

export interface Point {
    x: number;
    y: number;
    z: number;
}

export enum ResultType {
    ZERO = 0,
    INTERCEPT = 1,
    MAXIMA = 2,
    MINIMA = 3
}

export interface InterestingPoint {
    location: Point;
    type: ResultType;
    label: string;
}

// Embind vector interface (C++ std::vector exposed to JS)
export interface EmbindVector<T> {
    size(): number;
    get(index: number): T;
    push_back(value: T): void;
    resize(size: number, value: T): void;
    set(index: number, value: T): boolean;
}

// Result type returned directly from WASM (uses Embind vectors)
// IMPORTANT: Objects returned from WASM via Embind are wrappers for C++ memory
// and MUST be manually deleted by calling .delete() to prevent memory leaks
export interface WasmGraphResult {
    path: EmbindVector<Point>;
    points: EmbindVector<InterestingPoint>;
    success: boolean;
    errorMessage: string;
    // Manual memory management - MUST be called to free C++ memory
    delete(): void;
}

// Result type after conversion to plain JavaScript arrays
export interface GraphResult {
    path: Point[];
    points: InterestingPoint[];
    success: boolean;
    errorMessage: string;
}

// WASM Module interface
export interface MathEngineModule {
    Point: new (x: number, y: number, z: number) => Point;
    ResultType: typeof ResultType;
    InterestingPoint: new () => InterestingPoint;
    GraphResult: new () => WasmGraphResult;
    calculate2D(formula: string, xMin: number, xMax: number, resolution: number): WasmGraphResult;
    calculate3D(formula: string, xMin: number, xMax: number, yMin: number, yMax: number, resolution: number): WasmGraphResult;
    
    // Zero-copy data extraction functions (high performance)
    // These return Float64Array views directly into WASM memory
    getPathData2D(result: WasmGraphResult): Float64Array | undefined;
    getPathData3D(result: WasmGraphResult): Float64Array | undefined;
}

// Graph configuration for code blocks
export interface GraphConfig {
    equation: string;
    type: '2d' | '3d';
    xMin?: number;
    xMax?: number;
    yMin?: number;
    yMax?: number;
    resolution?: number;
    width?: number;
    height?: number;
}

// Default configuration values
// Note: These are fallback values. The plugin now uses intelligent analysis
// to determine optimal ranges automatically when not specified.
export const DEFAULT_GRAPH_CONFIG = {
    // 2D defaults
    xMin2D: -10,
    xMax2D: 10,
    resolution2D: 400,
    width2D: 700,
    height2D: 500,
    
    // 3D defaults (more conservative to prevent memory issues)
    xMin3D: -5,
    xMax3D: 5,
    yMin3D: -5,
    yMax3D: 5,
    resolution3D: 50,  // 50x50 = 2,500 points (safe for WASM)
    width3D: 700,
    height3D: 700,
    
    // Safety limits
    maxResolution2D: 1000,
    maxResolution3D: 100,  // 100x100 = 10,000 points (absolute max)
};