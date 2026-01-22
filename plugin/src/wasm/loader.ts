// WasmLoader - Handles asynchronous initialization of the WASM module

import type { MathEngineModule } from '../types';

export class WasmLoader {
    private static instance: WasmLoader;
    private module: MathEngineModule | null = null;
    private initPromise: Promise<MathEngineModule> | null = null;

    private constructor() {}

    /**
     * Get the singleton instance of WasmLoader
     */
    public static getInstance(): WasmLoader {
        if (!WasmLoader.instance) {
            WasmLoader.instance = new WasmLoader();
        }
        return WasmLoader.instance;
    }

    /**
     * Initialize the WASM module. Safe to call multiple times.
     * @returns Promise that resolves to the initialized module
     */
    public async initialize(): Promise<MathEngineModule> {
        // If already initialized, return the cached module
        if (this.module) {
            return this.module;
        }

        // If initialization is in progress, return the existing promise
        if (this.initPromise) {
            return this.initPromise;
        }

        // Start initialization
        this.initPromise = this.loadModule();
        
        try {
            this.module = await this.initPromise;
            return this.module;
        } catch (error) {
            // Reset state on error to allow retry
            this.initPromise = null;
            throw new Error(`Failed to initialize WASM module: ${error}`);
        }
    }

    /**
     * Get the initialized module. Throws if not initialized.
     */
    public getModule(): MathEngineModule {
        if (!this.module) {
            throw new Error('WASM module not initialized. Call initialize() first.');
        }
        return this.module;
    }

    /**
     * Check if the module is initialized
     */
    public isInitialized(): boolean {
        return this.module !== null;
    }

    /**
     * Load the WASM module
     * 
     * The WASM module is compiled with Emscripten using:
     * - MODULARIZE=1: Exports as a factory function
     * - EXPORT_NAME='createMathModule': Named export
     * - EXPORT_ES6=1: ES6 module format
     * - SINGLE_FILE=1: Embedded WASM data
     * 
     * We load the module by:
     * 1. Reading it as text using Obsidian's vault adapter
     * 2. Creating a blob URL from the code
     * 3. Dynamically importing the blob URL
     */
    private async loadModule(): Promise<MathEngineModule> {
        try {
            // Get the Obsidian app instance
            const app = (window as any).app;
            if (!app) {
                throw new Error('Obsidian app not found');
            }

            console.log('Loading WASM module using Obsidian adapter...');
            
            // Read the module file using Obsidian's vault adapter
            const adapter = app.vault.adapter;
            const pluginPath = '.obsidian/plugins/math-graph-plugin/math_engine.js';
            
            console.log('Reading module file:', pluginPath);
            const moduleCode = await adapter.read(pluginPath);
            
            console.log('Module code loaded, length:', moduleCode.length);
            
            // Create a blob URL from the module code
            const blob = new Blob([moduleCode], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            
            console.log('Created blob URL:', blobUrl);
            console.log('Importing module from blob URL...');
            
            // Import the module from the blob URL
            const wasmModule = await import(/* @vite-ignore */ blobUrl);
            
            // Clean up the blob URL
            URL.revokeObjectURL(blobUrl);
            
            console.log('Module loaded successfully');
            console.log('Module keys:', Object.keys(wasmModule));
            console.log('Has default export:', 'default' in wasmModule);
            
            // Get the factory function
            let createMathModule: any;
            
            if (typeof wasmModule.default === 'function') {
                createMathModule = wasmModule.default;
            } else if (typeof wasmModule.createMathModule === 'function') {
                createMathModule = wasmModule.createMathModule;
            } else {
                console.error('Available exports:', Object.keys(wasmModule));
                throw new Error('WASM module did not export a factory function');
            }
            
            console.log('Calling WASM factory function...');
            
            // Call the factory function to initialize the WASM module
            const module = await createMathModule() as unknown as MathEngineModule;
            
            console.log('Math WASM module initialized successfully');
            return module;
        } catch (error) {
            console.error('Error loading WASM module:', error);
            throw error;
        }
    }

    /**
     * Reset the loader (useful for testing or reinitialization)
     */
    public reset(): void {
        this.module = null;
        this.initPromise = null;
    }
}

// Export a convenience function for getting the initialized module
export async function getMathEngine(): Promise<MathEngineModule> {
    const loader = WasmLoader.getInstance();
    return await loader.initialize();
}