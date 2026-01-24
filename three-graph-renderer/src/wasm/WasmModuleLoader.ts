import createMathModule, { MathModule } from './math_engine';

export class WasmModuleLoader {
    private static instance: MathModule | null = null;
    private static initializationPromise: Promise<MathModule> | null = null;

    /**
     * Initializes the WASM module.
     * @param factory Optional factory command to use (e.g. for testing or specific environment loading)
     */
    static async initialize(factory?: () => Promise<MathModule>): Promise<MathModule> {
        if (this.instance) return this.instance;
        if (this.initializationPromise) return this.initializationPromise;

        this.initializationPromise = (async () => {
            try {
                const moduleFactory = factory || createMathModule;
                this.instance = await moduleFactory();
                return this.instance;
            } catch (error) {
                console.error("Failed to load WASM Math Engine:", error);
                throw error;
            }
        })();

        return this.initializationPromise;
    }

    static getInstance(): MathModule | null {
        return this.instance;
    }
}
