# Bugfix Summary - WebGL and Dynamic Zoom

## Issues Fixed (Commit: 09e5efe)

### 1. Multiple Three.js Instances Warning ✅

**Error:**
```
THREE.WARNING: Multiple instances of Three.js being imported.
```

**Root Cause:**
- Three.js was being bundled into `main.js` by esbuild
- Obsidian provides its own Three.js instance
- Multiple copies caused context conflicts and warnings

**Solution:**
```javascript
// esbuild.config.mjs
external: [
    "obsidian",
    "electron",
    // ... other externals
    "three",  // Added to prevent bundling
    ...builtinModules
]
```

---

### 2. WebGL Buffer Size Errors ✅

**Error:**
```
[.WebGL-0x13c0b850600] GL_INVALID_OPERATION: glDrawElements: 
Vertex buffer is not big enough for the draw call.
```

**Root Cause:**
During dynamic recalculation (zoom/pan), the code was updating vertex buffers WITHOUT handling cases where vertex count changed:

1. **2D:** Different zoom levels → different resolutions → different vertex counts
2. **3D:** Adaptive resolution based on distance → grid size changes (30×30 vs 50×50)

The old code would update vertex positions but keep the old index buffer, causing:
- Indices pointing to vertices that don't exist
- WebGL attempting to draw more vertices than exist
- GL_INVALID_OPERATION errors

**Solution:**

Check if vertex count changed and handle accordingly:

```typescript
// 2D Update
if (oldVertexCount !== pointCount) {
    // Vertex count changed - rebuild geometry
    oldGeometry.dispose();
    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.mainLine.geometry = newGeometry;
} else {
    // Same count - update in place
    positionAttribute.array = positions;
    positionAttribute.needsUpdate = true;
}
```

```typescript
// 3D Update - Also rebuild indices
if (oldVertexCount !== totalPoints) {
    oldGeometry.dispose();
    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    newGeometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    
    // Recreate indices for new grid size
    const gridSize = Math.floor(Math.sqrt(totalPoints));
    // ... generate indices matching new vertex count
    newGeometry.setIndex(indices);
    newGeometry.computeVertexNormals();
    this.mainMesh.geometry = newGeometry;
} else {
    // Update in place
    positionAttribute.array = positions;
    colorAttribute.array = colorArray;
    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
    oldGeometry.computeVertexNormals();
}
```

---

### 3. Graph Not Expanding When Zooming Out ✅

**Problem:**
- Zooming out in 2D and 3D would not expand the graph
- Graph appeared "stuck" and wouldn't show more of the function

**Root Cause:**
Zoom threshold checks were preventing recalculation:

```typescript
// OLD CODE - Blocking updates
const zoomChange = Math.abs(zoomLevel - this.lastZoomLevel) / this.lastZoomLevel;

// Only recalculate if zoom changed significantly (>10% for 2D, >20% for 3D)
if (zoomChange < 0.1 && this.lastZoomLevel !== 1) {
    this.isRecalculating = false;
    return;  // ❌ Blocks recalculation
}
```

This meant:
- Small zoom increments wouldn't trigger recalculation
- Continuous zooming would appear stuck
- Graph wouldn't expand to show new range

**Solution:**
Remove threshold checks and rely on debouncing alone:

```typescript
// NEW CODE - Always recalculate (debounced)
const camera = this.camera as THREE.OrthographicCamera;
const xMin = camera.left;
const xMax = camera.right;

// Calculate zoom level for logging only
const range = xMax - xMin;
const zoomLevel = 20 / range;

// Immediately recalculate with new range
const wasmResult = this.wasmModule.calculate2D(
    this.equation, 
    adjustedXMin, 
    adjustedXMax, 
    resolution
);
```

The 150ms debounce in `handleZoomPanDebounced()` is sufficient to prevent excessive recalculations while still allowing smooth continuous zoom.

---

## Performance Impact

✅ **Minimal overhead:**
- Debouncing (150ms) prevents excessive recalculations
- `isRecalculating` flag prevents concurrent updates
- Old geometries properly disposed to free GPU memory
- In-place updates when vertex count matches (very fast)

✅ **Smooth UX:**
- Graph expands continuously when zooming out
- Desmos-style infinite zoom works properly
- No flickering or lag

---

## Files Changed

1. **`plugin/esbuild.config.mjs`**
   - Added `"three"` to external dependencies

2. **`plugin/src/rendering/renderer-threejs.ts`**
   - Fixed `handleZoomPan2D()`: Proper geometry updates + removed threshold
   - Fixed `handleZoomPan3D()`: Proper geometry + index buffer updates + removed threshold

---

## Testing Checklist

- ✅ No Three.js multiple instance warnings
- ✅ No WebGL buffer errors during zoom/pan
- ✅ 2D graph expands when zooming out
- ✅ 3D graph expands when zooming out
- ✅ No memory leaks (old geometries disposed)
- ✅ Smooth performance with debouncing

---

## Future Optimizations

1. **LOD Pipeline:** Precompute multiple resolutions and swap between them
2. **Buffer Pooling:** Reuse typed arrays when sizes match
3. **Incremental Updates:** Interpolate for small zoom changes instead of full recalculation
4. **Adaptive Debounce:** Longer debounce when zoomed out (larger WASM calculations)