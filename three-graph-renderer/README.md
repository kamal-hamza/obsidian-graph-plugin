# three-graph-renderer

A high-performance 3D mathematical function renderer built with Three.js and WebAssembly. Designed for smooth, interactive visualization of complex mathematical surfaces with dynamic level-of-detail and intelligent zoom behavior.

## Features

- WebAssembly-powered computation for blazing-fast mathematical function evaluation
- Dynamic color gradients with customizable themes
- Adaptive resolution that automatically adjusts based on zoom level
- Smooth zoom behavior with intelligent buffering to prevent constant regeneration
- Automatic grid and axis systems with nice tick marks
- Interactive controls with orbit, pan, and zoom
- Level-of-detail (LOD) system for optimal performance
- Customizable themes supporting light and dark modes

## Installation

### Using npm

```bash
npm install three-graph-renderer
```

### Using Bun

```bash
bun add three-graph-renderer
```

### Using pnpm

```bash
pnpm add three-graph-renderer
```

## Prerequisites

This library requires Three.js as a peer dependency:

```bash
npm install three
```

## Quick Start

```typescript
import { GraphRenderer } from 'three-graph-renderer';

// Create a container element
const container = document.getElementById('graph-container');

// Initialize the renderer
const renderer = new GraphRenderer();

// Mount to DOM
renderer.mount(container);

// Set a mathematical expression
await renderer.setExpression('sin(sqrt(x^2 + y^2))');

// The graph will render automatically!
```

## API Reference

### GraphRenderer

The main class for rendering 3D graphs.

#### Constructor

```typescript
constructor(wasmFactory?: any)
```

Creates a new GraphRenderer instance. Optionally accepts a custom WASM factory function.

#### Methods

##### `mount(container: HTMLElement): void`

Attaches the renderer to a DOM element.

```typescript
const container = document.getElementById('graph-container');
renderer.mount(container);
```

##### `destroy(): void`

Cleans up resources and removes the renderer from the DOM.

```typescript
renderer.destroy();
```

##### `async setExpression(formula: string, range?: GraphBounds): Promise<void>`

Sets and renders a mathematical expression.

```typescript
// Simple expression with default range
await renderer.setExpression('x^2 + y^2');

// With custom range
await renderer.setExpression('sin(x) * cos(y)', {
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5
});
```

##### `updateTheme(theme: Partial<ThemeConfig>): void`

Updates the visual theme of the graph.

```typescript
renderer.updateTheme({
    colorMap: {
        start: '#0000ff',
        end: '#ff0000'
    },
    backgroundColor: '#1a1a1a',
    gridColor: '#333333'
});
```

##### `setZClipping(enabled: boolean): void`

Enables or disables Z-axis clipping for better visualization of complex surfaces.

```typescript
renderer.setZClipping(true);
```

### Types

#### GraphBounds

Defines the rendering boundaries for the graph.

```typescript
interface GraphBounds {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zMin?: number;
    zMax?: number;
}
```

#### ThemeConfig

Configuration object for customizing the visual appearance.

```typescript
interface ThemeConfig {
    colorMap: {
        start: string;
        end: string;
    };
    backgroundColor: string;
    gridColor: string;
    axisColor: string;
    contourColor: string;
}
```

## Supported Mathematical Functions

The library supports a wide range of mathematical operations:

- Basic operators: `+`, `-`, `*`, `/`, `^`
- Trigonometric: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`
- Hyperbolic: `sinh`, `cosh`, `tanh`
- Exponential and logarithmic: `exp`, `log`, `ln`, `log10`
- Roots and powers: `sqrt`, `cbrt`, `pow`
- Absolute value: `abs`
- Constants: `pi`, `e`

### Example Expressions

```typescript
// Wave interference
await renderer.setExpression('sin(sqrt(x^2 + y^2))');

// Gaussian function
await renderer.setExpression('exp(-(x^2 + y^2))');

// Saddle surface
await renderer.setExpression('x^2 - y^2');

// Complex periodic
await renderer.setExpression('sin(x) * cos(y)');

// Ripple effect
await renderer.setExpression('cos(sqrt(x^2 + y^2)) / (1 + sqrt(x^2 + y^2))');
```

## Advanced Usage

### Custom Theme

```typescript
import { GraphRenderer } from 'three-graph-renderer';

const renderer = new GraphRenderer();
renderer.mount(container);

renderer.updateTheme({
    colorMap: {
        start: '#00ffff',
        end: '#ff00ff'
    },
    backgroundColor: '#000000',
    gridColor: '#444444',
    axisColor: '#ffffff',
    contourColor: '#00ff00'
});

await renderer.setExpression('sin(x) * sin(y)');
```

### Dynamic Range Updates

```typescript
// Start with a wide view
await renderer.setExpression('x^2 + y^2', {
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10
});

// Later, zoom into a specific region
await renderer.setExpression('x^2 + y^2', {
    xMin: -2,
    xMax: 2,
    yMin: -2,
    yMax: 2
});
```

### Handling Multiple Graphs

```typescript
const renderer1 = new GraphRenderer();
const renderer2 = new GraphRenderer();

renderer1.mount(document.getElementById('graph-1'));
renderer2.mount(document.getElementById('graph-2'));

await renderer1.setExpression('sin(x) * cos(y)');
await renderer2.setExpression('x^2 + y^2');
```

## Building from Source

### Prerequisites

- Node.js 18+ or Bun
- Emscripten SDK (for WebAssembly compilation)

### Build Steps

1. Clone the repository
2. Install dependencies:

```bash
bun install
```

3. Build the WebAssembly engine:

```bash
bun run build-engine
```

4. Build the TypeScript library:

```bash
bun run build
```

5. The compiled library will be in the `dist` folder.

### Development

Run the development server with hot reload:

```bash
bun run dev
```

## Publishing

### Local Testing

Test the library locally before publishing:

```bash
# In the three-graph-renderer directory
npm link

# In your test project
npm link three-graph-renderer
```

### Publishing to npm

1. Update the version in `package.json`
2. Build the library:

```bash
bun run build:full
```

3. Publish:

```bash
npm publish
```

Note: The `prepublishOnly` script will automatically run the full build process.

## Performance Considerations

### Resolution Management

The library automatically adjusts resolution based on zoom level:

- Ultra-close zoom (span < 10): 500x500 grid
- Close zoom (span < 30): 400x400 grid
- Medium zoom (span < 100): 300x300 grid
- Far zoom (span < 500): 250x250 grid
- Very far zoom (span >= 500): 200x200 grid

### Zoom Behavior

The renderer uses intelligent buffering to prevent constant regeneration:

- Zoom-in trigger: Regenerates when viewing less than 50% of current graph
- Zoom-out trigger: Regenerates when viewing more than 250% of current graph
- Debounce: 400ms pause after last interaction before regeneration

### Memory Management

Always call `destroy()` when removing a renderer to free up resources:

```typescript
renderer.destroy();
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 15+
- Edge 90+

WebAssembly support is required.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Troubleshooting

### Graph Not Appearing

Ensure the container element has explicit dimensions:

```css
#graph-container {
    width: 800px;
    height: 600px;
}
```

### Performance Issues

- Reduce the range to render smaller areas
- Use simpler mathematical expressions
- Ensure hardware acceleration is enabled in your browser

### WebAssembly Loading Errors

Make sure the WASM file is being served correctly. If using a bundler, ensure `.wasm` files are properly handled.

## Support

For issues, questions, or contributions, please visit the GitHub repository.