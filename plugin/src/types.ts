// TypeScript types matching the C++ structs from engine.hpp

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

export interface GraphResult {
    path: EmbindVector<Point>;
    points: EmbindVector<InterestingPoint>;
    success: boolean;
    errorMessage: string;
}

// WASM Module interface
export interface MathEngineModule {
    Point: new (x: number, y: number, z: number) => Point;
    ResultType: typeof ResultType;
    InterestingPoint: new () => InterestingPoint;
    GraphResult: new () => GraphResult;
    calculate2D(formula: string, xMin: number, xMax: number, resolution: number): GraphResult;
    calculate3D(formula: string, xMin: number, xMax: number, yMin: number, yMax: number, resolution: number): GraphResult;
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
export const DEFAULT_GRAPH_CONFIG: Partial<GraphConfig> = {
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10,
    resolution: 100,
    width: 600,
    height: 400
};