# Math Graph Plugin Examples

This document demonstrates various examples of using the Math Graph Plugin in Obsidian.

## 2D Graph Examples

### Example 1: Simple Sine Wave

```graph
type: 2d
equation: sin(x)
xMin: -6.28
xMax: 6.28
resolution: 200
width: 700
height: 400
```

### Example 2: Polynomial Function

```graph
type: 2d
equation: x^3 - 4*x^2 + x + 6
xMin: -3
xMax: 5
resolution: 150
```

### Example 3: Exponential Decay

```graph
type: 2d
equation: exp(-x^2/2)
xMin: -4
xMax: 4
```

### Example 4: Rational Function

```graph
type: 2d
equation: 1/(x^2 + 1)
xMin: -5
xMax: 5
```

### Example 5: Trigonometric Composition

```graph
type: 2d
equation: sin(x) * cos(x)
xMin: -10
xMax: 10
resolution: 300
```

### Example 6: Absolute Value and Conditionals

```graph
type: 2d
equation: abs(x) - 2
xMin: -5
xMax: 5
```

### Example 7: Logarithmic Function

```graph
type: 2d
equation: log(x + 1)
xMin: 0
xMax: 10
```

### Example 8: Damped Oscillation

```graph
type: 2d
equation: exp(-x/5) * sin(x)
xMin: 0
xMax: 20
resolution: 250
```

## 3D Graph Examples

### Example 9: Simple Wave Pattern

```graph
type: 3d
equation: sin(x) * cos(y)
xMin: -6
xMax: 6
yMin: -6
yMax: 6
resolution: 40
width: 700
height: 600
```

### Example 10: Ripple Effect

```graph
type: 3d
equation: sin(sqrt(x^2 + y^2))
xMin: -10
xMax: 10
yMin: -10
yMax: 10
resolution: 50
```

### Example 11: Paraboloid

```graph
type: 3d
equation: x^2 + y^2
xMin: -5
xMax: 5
yMin: -5
yMax: 5
resolution: 40
```

### Example 12: Saddle Surface (Hyperbolic Paraboloid)

```graph
type: 3d
equation: x^2 - y^2
xMin: -3
xMax: 3
yMin: -3
yMax: 3
resolution: 40
```

### Example 13: Gaussian (Bell Curve)

```graph
type: 3d
equation: exp(-(x^2 + y^2)/2)
xMin: -5
xMax: 5
yMin: -5
yMax: 5
resolution: 50
```

### Example 14: Mexican Hat (Sombrero)

```graph
type: 3d
equation: sin(sqrt(x^2 + y^2)) / sqrt(x^2 + y^2 + 1)
xMin: -10
xMax: 10
yMin: -10
yMax: 10
resolution: 60
```

### Example 15: Twisted Surface

```graph
type: 3d
equation: sin(x) * sin(y)
xMin: -6.28
xMax: 6.28
yMin: -6.28
yMax: 6.28
resolution: 50
```

### Example 16: Complex Terrain

```graph
type: 3d
equation: sin(x) + cos(y)
xMin: -6
xMax: 6
yMin: -6
yMax: 6
resolution: 45
```

## Advanced Examples

### Example 17: Product of Trigonometric Functions

```graph
type: 2d
equation: sin(x) * sin(2*x) * sin(3*x)
xMin: -3.14
xMax: 3.14
resolution: 400
```

### Example 18: Cosh and Sinh

```graph
type: 2d
equation: cosh(x)
xMin: -3
xMax: 3
```

### Example 19: Square Wave Approximation

```graph
type: 2d
equation: sin(x) + sin(3*x)/3 + sin(5*x)/5 + sin(7*x)/7
xMin: -10
xMax: 10
resolution: 500
```

### Example 20: 3D Plane

```graph
type: 3d
equation: 0.5*x + 0.5*y
xMin: -5
xMax: 5
yMin: -5
yMax: 5
resolution: 30
```

## Tips

1. **Resolution**: Higher resolution (200-500) gives smoother curves but takes longer to compute
2. **Range**: Adjust xMin/xMax to focus on interesting parts of the function
3. **3D Navigation**: 
   - Left click + drag: Rotate
   - Scroll: Zoom in/out
   - Right click + drag: Pan
4. **Performance**: For 3D graphs, keep resolution under 100 for smooth interaction

## Mathematical Functions Supported

- **Basic**: `+`, `-`, `*`, `/`, `^` (power)
- **Trigonometric**: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`
- **Hyperbolic**: `sinh`, `cosh`, `tanh`
- **Exponential/Logarithmic**: `exp`, `log`, `log10`
- **Other**: `sqrt`, `abs`, `ceil`, `floor`, `round`, `min`, `max`
- **Constants**: `pi`, `e`

## Error Handling

If you see a syntax error, check:
1. Variable names: Use `x` for 2D, `x` and `y` for 3D
2. Multiplication: Always use `*` (e.g., `2*x`, not `2x`)
3. Parentheses: Make sure they're balanced
4. Function names: Use lowercase (e.g., `sin`, not `Sin`)