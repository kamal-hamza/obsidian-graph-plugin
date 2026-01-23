// WASM Loader Wrapper for Three.js Graph Renderer
// This loader handles the WASM module initialization for both:
// 1. Vite dev environment (loads from public folder)
// 2. Production plugin build (passed as parameter)

export interface MathModule {
    HEAPF64: Float64Array;
    calculate3D: (formula: string, xMin: number, xMax: number, yMin: number, yMax: number, res: number) => GraphResult;
    getPathData3D: (result: GraphResult) => Float64Array;
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
}

export interface GraphResult {
    success: boolean;
    errorMessage: string;
    path: any;
    delete: () => void;
}

declare global {
    interface Window {
        createMathModule?: () => Promise<MathModule>;
    }
}

export class WasmModuleLoader {
    private static instance: WasmModuleLoader | null = null;
    private module: MathModule | null = null;
    private initPromise: Promise<MathModule> | null = null;
    private factory: (() => Promise<MathModule>) | null = null;

    private constructor() {}

    public static getInstance(): WasmModuleLoader {
        if (!WasmModuleLoader.instance) {
            WasmModuleLoader.instance = new WasmModuleLoader();
        }
        return WasmModuleLoader.instance;
    }

    /**
     * Initialize with a factory function (for production plugin use)
     */
    public setFactory(factory: () => Promise<MathModule>): void {
        this.factory = factory;
    }

    /**
     * Load WASM module
     * Will try in order:
     * 1. Factory function set via setFactory()
     * 2. Global window.createMathModule (loaded via script tag)
     * 3. Dynamic import from public folder (Vite dev only)
     */
    public async initialize(): Promise<MathModule> {
        // Return cached module if already loaded
        if (this.module) {
            return this.module;
        }

        // Return in-progress initialization
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this.loadModule();

        try {
            this.module = await this.initPromise;
            console.log('✅ WASM module initialized successfully');
            return this.module;
        } catch (error) {
            this.initPromise = null;
            throw error;
        }
    }

    private async loadModule(): Promise<MathModule> {
        console.log('🔄 Initializing WASM module...');

        // Method 1: Use factory function if provided
        if (this.factory) {
            console.log('📦 Using provided factory function');
            try {
                return await this.factory();
            } catch (error) {
                console.error('❌ Factory function failed:', error);
                throw new Error(`Factory function failed: ${error}`);
            }
        }

        // Method 2: Check for global createMathModule (script tag loaded)
        if (typeof window !== 'undefined' && window.createMathModule) {
            console.log('🌐 Using global createMathModule from script tag');
            try {
                return await window.createMathModule();
            } catch (error) {
                console.error('❌ Global createMathModule failed:', error);
                throw new Error(`Global module initialization failed: ${error}`);
            }
        }

        // Method 3: Try to load from public folder (Vite dev environment)
        // This will fail in production but that's okay - we should have factory or global
        console.log('📁 Attempting to load from /wasm/math_engine.js via script injection');
        
        try {
            // Inject script tag to load the WASM module
            await this.loadScriptFromPublic();
            
            // Wait for it to be available
            let attempts = 0;
            while (!window.createMathModule && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (window.createMathModule) {
                console.log('✅ Script loaded successfully, initializing...');
                return await window.createMathModule();
            } else {
                throw new Error('Script loaded but createMathModule not found');
            }
        } catch (error) {
            console.error('❌ Failed to load from public folder:', error);
            throw new Error(
                'WASM module not available. Please ensure math_engine.js is either:\n' +
                '1. Loaded via <script> tag, or\n' +
                '2. Passed via setFactory(), or\n' +
                '3. Available in /wasm/math_engine.js (dev only)'
            );
        }
    }

    private async loadScriptFromPublic(): Promise<void> {
        // The WASM module is built with EXPORT_ES6=1, so it's an ES6 module
        // We need to dynamically import it as a module
        // In dev, it's available in src/wasm (Vite can import from src)
        // In production plugin, it's loaded via factory or global
        try {
            console.log('📦 Attempting dynamic import of ./wasm/math_engine.js');
            const wasmModule = await import('./wasm/math_engine.js');
            
            console.log('✅ Module imported, keys:', Object.keys(wasmModule));
            
            // Extract the factory function (ES6 default export)
            let createFunc = wasmModule.default;
            
            if (typeof createFunc === 'function') {
                // Assign to global so the rest of the loader can find it
                window.createMathModule = createFunc;
                console.log('✅ createMathModule assigned to window');
            } else {
                throw new Error('Module did not export createMathModule or default');
            }
        } catch (error) {
            console.error('❌ Dynamic import failed:', error);
            throw error;
        }
    }

    public isInitialized(): boolean {
        return this.module !== null;
    }

    public getModule(): MathModule {
        if (!this.module) {
            throw new Error('WASM module not initialized. Call initialize() first.');
        }
        return this.module;
    }

    public reset(): void {
        this.module = null;
        this.initPromise = null;
        this.factory = null;
    }
}

// Convenience export
export async function initializeWasm(factory?: () => Promise<MathModule>): Promise<MathModule> {
    const loader = WasmModuleLoader.getInstance();
    if (factory) {
        loader.setFactory(factory);
    }
    return await loader.initialize();
}