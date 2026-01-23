// WasmComputer - Handles computation via WASM module
// Uses the centralized WASM loader for initialization

import { WasmModuleLoader } from '../wasm-loader';

export class WasmComputer {
    private loader: WasmModuleLoader;
    public ready: Promise<void>;

    constructor(factory?: any) {
        this.loader = WasmModuleLoader.getInstance();
        
        // If factory provided, set it
        if (factory) {
            this.loader.setFactory(factory);
        }

        // Initialize and expose ready promise
        this.ready = this.loader.initialize().then(() => {
            console.log('✅ WasmComputer ready');
        }).catch(error => {
            console.error('❌ WasmComputer initialization failed:', error);
            throw error;
        });
    }

    public calculate(formula: string, range: { xMin: number, xMax: number, yMin: number, yMax: number }, resolution: number = 100): Float32Array | null {
        if (!this.loader.isInitialized()) {
            console.warn("WASM not ready");
            return null;
        }

        const module = this.loader.getModule();

        // 1. Calculate in C++
        const result = module.calculate3D(
            formula,
            range.xMin, range.xMax,
            range.yMin, range.yMax,
            resolution
        );

        if (!result.success) {
            console.error("Math Error:", result.errorMessage);
            result.delete();
            return null;
        }

        // 2. Zero-Copy Extraction
        // getPathData3D returns a Float64Array view directly on WASM heap
        const dataView = module.getPathData3D(result);

        // Check if empty
        if (!dataView || dataView.length === 0) {
            result.delete();
            return null;
        }

        // Convert Float64 -> Float32 for Three.js compatibility
        // Three.js BufferGeometry uses Float32Array for attributes
        const f32 = new Float32Array(dataView);

        // Cleanup C++ object (the vector)
        result.delete();

        return f32;
    }
}