# Math Graph Plugin for Obsidian

A high-performance mathematical graphing plugin for Obsidian that renders 2D and 3D functions using WebAssembly and modern visualization libraries.

## Features

- ⚡ **Blazing Fast**: C++ computation backend compiled to WebAssembly for near-native performance
- 📊 **2D Graphing**: Professional scientific-grade 2D function plots with WebGL acceleration
- 🎨 **3D Visualization**: Interactive 3D surface plots powered by Plotly.js
- 🎯 **Smart Analysis**: Automatically detects and marks zeros, maxima, and minima
- 🌓 **Dynamic Theme Integration**: Real-time color updates when switching between light/dark themes
- 🔍 **Interactive**: Native pan, zoom, and rotate with built-in Plotly controls
- 📏 **Professional Axis Labels**: Built-in adaptive axis labels and tick formatting
- 🌐 **Dynamic Grid**: Automatic grid scaling and subdivision based on zoom level
- 🎯 **Hover Tooltips**: Native coordinate display on hover
- 📐 **Zero-Copy Performance**: Direct WASM-to-WebGL data transfer with typed arrays

## Scientific-Grade Features

### Dynamic Obsidian Theme Integration

The graphs seamlessly integrate with Obsidian's theme system:

- **Automatic Sync**: Graphs update immediately when you toggle Light/Dark mode or change accent colors
- **Native Colors**: Uses Obsidian's CSS variables (`--background-primary`, `--text-normal`, `--interactive-accent`)
- **Real-time Updates**: All visual elements (background, grid, axes, labels) adapt instantly

### Plotly.js Powered Visualization

Built on the industry-standard scientific visualization library:

- **WebGL Acceleration**: Hardware-accelerated rendering using `scattergl` for 2D and `surface` for 3D
- **Native Tooltips**: Built-in coordinate display and hover information
- **Adaptive Axes**: Automatic tick formatting and grid subdivision
- **Zero-Copy Data**: Direct WASM memory to WebGL buffers for maximum performance
- **Professional Controls**: Industry-standard pan, zoom, and rotate interactions

### Enhanced Interactions

#### 2D Mode
- **Pan**: Click and drag to pan
- **Zoom**: Scroll to zoom in/out
- **Hover**: See precise coordinates on hover
- **Select**: Click and drag to select a region to zoom
- **Reset**: Double-click to reset view

#### 3D Mode
- **Rotate**: Click and drag to rotate the view (orbital or turntable mode)
- **Zoom**: Scroll to zoom in/out
- **Pan**: Shift+drag or right-click drag
- **Hover**: See x, y, z coordinates on hover
- **Contour Projection**: Optional contour lines projected on bottom plane

## Installation

1. Download the latest release from the releases page
2. Extract the files into your `.obsidian/plugins/math-graph-plugin` directory
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

## Usage

### 2D Graphs

Create a code block with the `graph` language identifier:

````markdown
```graph
type: 2d
equation: sin(x) * cos(x)
xMin: -10
xMax: 10
resolution: 200
width: 600
height: 400
```
````

#### 2D Examples

**Sine Wave:**
````markdown
```graph
type: 2d
equation: sin(x)
xMin: -6.28
xMax: 6.28
```
````

**Polynomial Function:**
````markdown
```graph
type: 2d
equation: x^3 - 4*x^2 + x + 6
xMin: -3
xMax: 5
```
````

**Exponential Decay:**
````markdown
```graph
type: 2d
equation: exp(-x^2/2)
xMin: -4
xMax: 4
```
````

**Rational Function:**
````markdown
```graph
type: 2d
equation: 1/(x^2 + 1)
xMin: -5
xMax: 5
```
````

### 3D Graphs

For 3D surface plots, set the type to `3d` and provide a function of both `x` and `y`:

````markdown
```graph
type: 3d
equation: sin(sqrt(x^2 + y^2))
xMin: -10
xMax: 10
yMin: -10
yMax: 10
resolution: 50
width: 600
height: 500
```
````

#### 3D Examples

**Wave Pattern:**
````markdown
```graph
type: 3d
equation: sin(x) * cos(y)
xMin: -6
xMax: 6
yMin: -6
yMax: 6
resolution: 40
```
````

**Paraboloid:**
````markdown
```graph
type: 3d
equation: x^2 + y^2
xMin: -5
xMax: 5
yMin: -5
yMax: 5
```
````

**Saddle Surface:**
````markdown
```graph
type: 3d
equation: x^2 - y^2
xMin: -3
xMax: 3
yMin: -3
yMax: 3
```
````

**Ripple Effect:**
````markdown
```graph
type: 3d
equation: sin(sqrt(x^2 + y^2)) / sqrt(x^2 + y^2 + 1)
xMin: -10
xMax: 10
yMin: -10
yMax: 10
resolution: 60
```
````

## Configuration Options

### Common Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | `2d` | Graph type: `2d` or `3d` |
| `equation` | string | *required* | Mathematical function to plot |
| `resolution` | number | `100` | Number of sample points (higher = smoother) |
| `width` | number | `600` | Graph width in pixels |
| `height` | number | `400` | Graph height in pixels |

### 2D-Specific Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `xMin` | number | `-10` | Minimum x value |
| `xMax` | number | `10` | Maximum x value |

### 3D-Specific Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `xMin` | number | `-10` | Minimum x value |
| `xMax` | number | `10` | Maximum x value |
| `yMin` | number | `-10` | Minimum y value |
| `yMax` | number | `10` | Maximum y value |

## Supported Mathematical Functions

The plugin uses the ExprTk library, which supports a wide range of mathematical operations:

### Basic Operations
- Addition: `+`
- Subtraction: `-`
- Multiplication: `*`
- Division: `/`
- Power: `^` or `**`
- Modulo: `%`

### Trigonometric Functions
- `sin(x)`, `cos(x)`, `tan(x)`
- `asin(x)`, `acos(x)`, `atan(x)`
- `sinh(x)`, `cosh(x)`, `tanh(x)`

### Exponential & Logarithmic
- `exp(x)` - e^x
- `log(x)` - natural logarithm
- `log10(x)` - base-10 logarithm
- `sqrt(x)` - square root

### Other Functions
- `abs(x)` - absolute value
- `ceil(x)` - ceiling
- `floor(x)` - floor
- `round(x)` - round to nearest integer
- `min(x, y)` - minimum
- `max(x, y)` - maximum

### Constants
- `pi` - π (3.14159...)
- `e` - Euler's number (2.71828...)

## Features in Detail

### Automatic Feature Detection

The plugin automatically analyzes your function and marks:

- **Zeros** (roots): Points where f(x) = 0
- **Maxima**: Local maximum points
- **Minima**: Local minimum points

These are displayed as colored markers on the graph.

### 2D Graph Interactions

- **Pan**: Click and drag to pan around the graph
- **Zoom**: Scroll to zoom in/out
- **Crosshair**: Hover to see precise coordinate values

### 3D Graph Interactions

- **Rotate**: Click and drag to rotate the view
- **Zoom**: Scroll to zoom in/out
- **Pan**: Right-click and drag (or Shift+drag)

### Theme Integration

The plugin automatically adapts to your Obsidian theme, using your configured colors for:
- Graph lines and surfaces
- Axes and grid lines
- Text labels
- Background colors

## Performance Tips

1. **Resolution**: Lower resolution (50-100) for quick previews, higher (200-500) for final graphs
2. **3D Complexity**: 3D graphs with resolution > 100 may impact performance on slower devices
3. **Multiple Graphs**: Consider using lower resolutions when displaying many graphs on one page

## Troubleshooting

### "WASM module not initialized" Error

This means the WebAssembly backend failed to load. Try:
1. Reloading Obsidian
2. Disabling and re-enabling the plugin
3. Checking the console for detailed error messages

### "Syntax Error" in Graph

If you see a syntax error:
1. Check that the code block language is exactly `graph`
2. Check that your equation uses valid ExprTk syntax
3. Ensure variable names match (`x` for 2D, `x` and `y` for 3D)
4. Verify that all parentheses are balanced
5. Make sure you're using `*` for multiplication (e.g., `2*x`, not `2x`)

### Graph Not Rendering

1. Ensure the code block language is exactly `graph`
2. Check that the `equation` parameter is specified
3. Verify the `type` is either `2d` or `3d`
4. Check the browser console for error messages

## Technical Details

### Architecture

- **Backend**: C++ with ExprTk for mathematical expression parsing
- **Bridge**: WebAssembly (compiled with Emscripten) for browser compatibility
- **Rendering**: Plotly.js with WebGL for hardware-accelerated 2D and 3D graphics
  - 2D: `scattergl` traces for high-performance line plots
  - 3D: `surface` traces with native lighting and rotation

### Performance Metrics

- Calculation of 1,000 points: < 2ms (WASM)
- 2D rendering: 60 FPS with up to 100,000 points (WebGL)
- 3D rendering: 60 FPS @ 50×50 resolution
- Zero-copy data transfer: Direct typed array sharing between WASM and WebGL
- Memory usage: ~10-50 MB per graph (depending on resolution)

## Development

### Building from Source

```bash
# Build the C++ engine
cd engine
make wasm

# Install dependencies and build the plugin
cd ../plugin
bun install
bun run build
```

### Project Structure

```
obsidian-graphing/
├── engine/              # C++ computation backend
│   ├── engine.hpp       # Core data structures
│   ├── parser.cpp       # ExprTk wrapper
│   ├── sampler.cpp      # Grid generation
│   ├── analyzer.cpp     # Feature detection
│   └── binding.cpp      # Emscripten bindings
└── plugin/              # TypeScript frontend
    ├── src/
    │   ├── main.ts           # Plugin entry point
    │   ├── types.ts          # Type definitions
    │   ├── wasm/
    │   │   └── loader.ts     # WASM initialization
    │   └── rendering/
    │       ├── theme-manager.ts
    │       ├── renderer-2d.ts
    │       └── renderer-3d.ts
    └── styles.css            # Plugin styles
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the 0-BSD License.

## Credits

- Built with [Obsidian](https://obsidian.md)
- Math parsing: [ExprTk](https://github.com/ArashPartow/exprtk)
- Visualization: [Plotly.js](https://plotly.com/javascript/) - Industry-standard scientific graphing
- WebAssembly: [Emscripten](https://emscripten.org)

## Support

If you encounter any issues or have feature requests, please file them on the [GitHub Issues](https://github.com/yourusername/obsidian-math-graph/issues) page.