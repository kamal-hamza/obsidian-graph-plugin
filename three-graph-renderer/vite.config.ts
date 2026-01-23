import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'ThreeGraphRenderer',
            fileName: (format) => `three-graph-renderer.${format}.js`,
        },
        rollupOptions: {
            external: ['three'],
            output: {
                globals: {
                    three: 'THREE',
                },
            },
        },
    },
    plugins: [
        dts({
            insertTypesEntry: true,
        }),
    ],
});
