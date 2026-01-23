# Math Graph Plugin Examples

This document contains examples of how to use the Math Graph Plugin in Obsidian.

## Scientific-Grade Visualization with Plotly.js

The plugin now uses Plotly.js, the industry-standard scientific graphing library:

### Dynamic Theme Integration
- **Automatic Sync**: Graphs update immediately when you toggle Light/Dark mode
- **Native Colors**: Uses Obsidian's `--background-primary`, `--text-normal`, and `--interactive-accent` variables
- All colors adapt to your theme in real-time

### WebGL-Accelerated Rendering
- **Hardware Acceleration**: Uses `scattergl` for 2D and `surface` for 3D
- **Zero-Copy Performance**: Direct WASM-to-WebGL data transfer with typed arrays
- **High Performance**: Smooth rendering with up to 100,000 points in 2D

### Professional Features
- **Native Tooltips**: Built-in hover information showing exact coordinates
- **Adaptive Axes**: Automatic tick formatting and smart grid subdivision
- **Interactive Controls**: Industry-standard pan, zoom, and rotate interactions
- **Contour Projections**: Optional contour lines for 3D surfaces

### Enhanced Interactions

#### 2D Mode
- **Pan**: Click and drag to pan
- **Zoom**: Scroll to zoom in/out, or click-drag to select region
- **Hover**: See precise coordinates on hover
- **Reset**: Double-click to reset view

#### 3D Mode
- **Rotate**: Click and drag to rotate (orbital/turntable mode)
- **Zoom**: Scroll to zoom in/out
- **Pan**: Shift+drag or right-click drag
- **Hover**: See x, y, z coordinates on hover

### Try It Yourself
Interact with the graphs using native Plotly controls - they respond instantly to your theme changes!

## 2D Graph Examples

### Example 1: Simple Sine Wave

```math-graph
type: 2d
equation: sin(x)
xMin: -10
xMax: 10
resolution: 200
```

### Example 2: Polynomial Function

```math-graph
type: 2d
equation: x^3 - 4*x^2 + x + 6
xMin: -3
xMax: 5
resolution: 150
```

### Example 3: Exponential Decay

```math-graph
type: 2d
equation: exp(-x^2/2)
xMin: -4
xMax: 4
resolution: 200
```

### Example 4: Rational Function

```math-graph
type: 2d
equation: 1/(x^2 + 1)
xMin: -5
xMax: 5
resolution: 200
```

### Example 5: Trigonometric Combination

```math-graph
type: 2d
equation: sin(x) * cos(x)
xMin: -6.28
xMax: 6.28
resolution: 300
```

### Example 6: Absolute Value

```math-graph
type: 2d
equation: abs(x) - 2
xMin: -5
xMax: 5
resolution: 100
```

### Example 7: Square Root Function

```math-graph
type: 2d
equation: sqrt(abs(x))
xMin: -5
xMax: 5
resolution: 200
```

### Example 8: Logarithmic Function

```math-graph
type: 2d
equation: log(x + 1)
xMin: 0
xMax: 10
resolution: 200
```

## 3D Graph Examples

### Example 1: Simple Paraboloid

```math-graph
type: 3d
equation: x^2 + y^2
xMin: -5
xMax: 5
yMin: -5
yMax: 5
resolution: 50
```

### Example 2: Saddle Surface

```math-graph
type: 3d
equation: x^2 - y^2
xMin: -3
xMax: 3
yMin: -3
yMax: 3
resolution: 40
```

### Example 3: Wave Pattern

```math-graph
type: 3d
equation: sin(x) * cos(y)
xMin: -6
xMax: 6
yMin: -6
yMax: 6
resolution: 50
```

### Example 4: Ripple Effect

```math-graph
type: 3d
equation: sin(sqrt(x^2 + y^2))
xMin: -10
xMax: 10
yMin: -10
yMax: 10
resolution: 60
```

### Example 5: Gaussian Surface

```math-graph
type: 3d
equation: exp(-(x^2 + y^2)/10)
xMin: -5
xMax: 5
yMin: -5
yMax: 5
resolution: 50
```

### Example 6: Complex Wave

```math-graph
type: