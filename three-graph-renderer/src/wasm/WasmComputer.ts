import { WasmModuleLoader } from './WasmModuleLoader';
import { MathModule } from './math_engine';

export class WasmComputer {
    private module: MathModule | null = null;
    public ready: Promise<void>;

    constructor(factory?: () => Promise<MathModule>) {
        this.ready = this.init(factory);
    }

    private async init(factory?: () => Promise<MathModule>) {
        this.module = await WasmModuleLoader.initialize(factory);
    }

    public calculate(
        formula: string,
        range: { xMin: number, xMax: number, yMin: number, yMax: number },
        resolution: number
    ): Float32Array | null {
        if (!this.module) {
            console.warn("WasmComputer: Module not loaded yet.");
            return null;
        }

        try {
            // Call C++ function
            const result = this.module.calculate3D(
                formula,
                range.xMin,
                range.xMax,
                range.yMin,
                range.yMax,
                resolution
            );

            if (!result.success) {
                console.error("Math Engine Error:", result.errorMessage);
                // Clean up if needed (though result is value type/struct in C++ binding usually, checking usage)
                // Binding "delete" is likely needed if it was allocated on heap or if embind created a handle.
                // The d.ts has `delete: () => void;`. Embind objects usually need delete().
                if (result.delete) result.delete();
                return null;
            }

            // Get Zero-Copy View (Float64)
            const doubleView = this.module.getPathData3D(result);

            // Convert to Float32Array for Three.js
            const float32Data = new Float32Array(doubleView);

            // Cleanup
            if (result.delete) result.delete();

            return float32Data;

        } catch (e) {
            console.error("WasmComputer Exception:", e);
            return null;
        }
    }
}
