// Type declarations for the Emscripten-compiled WASM module
// This module is built with EXPORT_ES6=1 and MODULARIZE=1
// It exports a default factory function that returns a Promise<MathModule>

export interface MathModule {
    HEAPF64: Float64Array;
    calculate3D: (
        formula: string,
        xMin: number,
        xMax: number,
        yMin: number,
        yMax: number,
        res: number
    ) => GraphResult;
    getPathData3D: (result: GraphResult) => Float64Array;
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
}

export interface GraphResult {
    success: boolean;
    errorMessage: string;
    path: any; // C++ vector
    delete: () => void;
}

// The module exports a default factory function
declare const createMathModule: () => Promise<MathModule>;
export default createMathModule;