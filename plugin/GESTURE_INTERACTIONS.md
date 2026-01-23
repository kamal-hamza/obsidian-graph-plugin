# Gesture-Based Interaction Model

## Overview

The Math Graph Plugin uses a **Three.js-style gesture-based interaction model** that maximizes the viewable graph area while providing intuitive, professional-grade trackpad and touch support. This document describes how users interact with graphs and how the system is implemented.

---

## User Experience

### Philosophy

Instead of requiring users to manually switch between "Pan" and "Rotate" modes via toolbar buttons, all interactions are available simultaneously through:

- **Modifier keys** (desktop)
- **Natural gestures** (mobile/trackpad)
- **Scroll/pinch** for zoom (universal)

This creates a clean, distraction-free interface where the graph is front and center.

---

## Interaction Reference

### Desktop (Mouse & Trackpad)

| Action | Gesture | Notes |
|--------|---------|-------|
| **Rotate (3D)** | **Click and Drag** | Primary interaction for orbital camera movement around the graph |
| **Pan (2D)** | **Click and Drag** | Moves the coordinate system like a map |
| **Pan (3D)** | **Shift + Click and Drag** | Slides the entire 3D scene without rotating |
| **Zoom** | **Scroll Wheel or Pinch** | Smoothly zooms in/out toward the focal point |
| **Reset View** | **Double Click** | Returns to default camera position and zoom level |

### Mobile (Touch)

| Action | Gesture | Notes |
|--------|---------|-------|
| **Rotate (3D)** | **One-Finger Drag** | Natural touch rotation of 3D surfaces |
| **Pan (2D)** | **One-Finger Drag** | Move the graph across the screen |
| **Zoom** | **Two-Finger Pinch** | Native pinch-to-zoom support |
| **Pan (3D)** | **Two-Finger Drag** | Slide the 3D plot without rotating |

---

## User Guidance

### Interaction Hints

A subtle, semi-transparent hint overlay appears at the bottom center of each graph:

- **3D Graphs**: `"Desktop: Drag to Rotate, Shift+Drag to Pan | Mobile: 1-Finger Rotate, 2-Finger Pan"`
- **2D Graphs**: `"Pinch or Scroll to Zoom • Drag to Pan"`

The hint:
- Fades to 30% opacity when the user starts interacting
- Disappears on hover to avoid obstruction
- Automatically adjusts for mobile screen sizes
- Matches the current Obsidian theme (light/dark)

### Mode Bar

The Plotly mode bar (toolbar with camera/download buttons) appears on **hover** or **tap**, keeping the interface clean while ensuring critical tools remain accessible:

- **Reset Camera**: Quickly return to default view
- **Download Image**: Export graph as PNG
- **Zoom In/Out**: Alternative zoom controls

---

## Technical Implementation

### Architecture Components

1. **`PlotlyThemeConfig`** (`plotly-theme-config.ts`)
   - Manages all Plotly configuration and theme styling
   - Sets default drag modes and scroll zoom behavior

2. **`RendererPlotly`** (`renderer-plotly.ts`)
   - Renders graphs using Plotly.js WebGL
   - Adds interaction hint overlays
   - Handles dynamic recalculation on zoom/pan

3. **Styles** (`styles.css`)
   - CSS for hint overlay positioning and theming
   - Ensures proper z-index layering and responsiveness

### Key Configuration

#### 2D Graphs

```typescript
// Default mode: pan (like a map)
layout: {
    dragmode: 'pan',
    // ... other layout options
}

config: {
    scrollZoom: true,           // Enable scroll-based zoom
    displayModeBar: 'hover',    // Show toolbar on hover/tap
    displaylogo: false,         // Hide Plotly logo
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
}
```

#### 3D Graphs

```typescript
// Default mode: orbit (rotate around center)
layout: {
    scene: {
        dragmode: 'orbit',
        // ... other scene options
    }
}

config: {
    scrollZoom: true,           // Enable scroll-based zoom
    displayModeBar: 'hover',    // Show toolbar on hover/tap
    displaylogo: false,         // Hide Plotly logo
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
}
```

### Plotly Native Gestures

The plugin leverages Plotly's built-in WebGL gesture handling:

- **Drag Detection**: Plotly automatically distinguishes between 1-finger and 2-finger drags on mobile
- **Pinch Recognition**: Native pinch-to-zoom is recognized without custom event handlers
- **Modifier Keys**: Plotly respects `Shift` key for panning in 3D mode
- **Touch vs Mouse**: Plotly automatically adapts interactions based on input device

No custom gesture recognition code is required—Plotly handles all low-level touch/mouse events.

---

## Implementation Details

### Adding Interaction Hints

In `RendererPlotly.render()`:

```typescript
// Add interaction hint overlay
this.addInteractionHint();

private addInteractionHint(): void {
    if (!this.plotDiv) return;

    const hint = this.plotDiv.createDiv({ cls: 'graph-interaction-hint' });
    
    if (this.mode === '3d') {
        hint.setText('Desktop: Drag to Rotate, Shift+Drag to Pan | Mobile: 1-Finger Rotate, 2-Finger Pan');
    } else {
        hint.setText('Pinch or Scroll to Zoom • Drag to Pan');
    }
}
```

### CSS Positioning

The hint overlay uses absolute positioning within the relatively-positioned plot container:

```css
.math-graph-plotly {
    position: relative;  /* Container for absolute-positioned hint */
}

.graph-interaction-hint {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);  /* Center horizontally */
    opacity: 0.85;
    transition: opacity 0.3s ease;
}

/* Fade on interaction */
.math-graph-plotly:active .graph-interaction-hint {
    opacity: 0.3;
}
```

### Theme Integration

The hint automatically adapts to Obsidian's theme:

```css
/* Dark theme */
.theme-dark .graph-interaction-hint {
    background-color: rgba(0, 0, 0, 0.7);
    color: var(--text-muted);
}

/* Light theme */
.theme-light .graph-interaction-hint {
    background-color: rgba(255, 255, 255, 0.9);
    color: var(--text-muted);
}
```

---

## Design Decisions

### Why "Hover" Mode Bar?

**Problem**: Fixed toolbars take up valuable screen space and clutter the interface.

**Solution**: `displayModeBar: 'hover'` shows the toolbar only when needed:
- Desktop: Appears on mouse hover
- Mobile: Appears on single tap
- Automatically hides when not in use

This maximizes the graph viewing area while keeping tools accessible.

### Why Persistent Hints?

**Problem**: Shift+Drag for 3D panning is not discoverable—users won't know about it unless told.

**Solution**: A subtle, always-visible hint ensures users learn the shortcuts quickly without needing to consult documentation.

The hint:
- Is non-intrusive (semi-transparent, small font)
- Fades further when interacting (30% opacity)
- Can be ignored by experienced users
- Reinforces muscle memory through repetition

### Why Scroll Zoom?

**Problem**: Requiring users to click a "Zoom In" button breaks flow and feels outdated.

**Solution**: `scrollZoom: true` enables industry-standard zoom behavior:
- Desktop: Scroll wheel zooms in/out smoothly
- Trackpad: Two-finger scroll or pinch zooms
- Mobile: Pinch gesture zooms

This matches user expectations from Google Maps, Figma, Blender, and other modern tools.

---

## Future Enhancements

Possible improvements to the interaction model:

1. **Customizable Hints**
   - Allow users to hide hints via settings
   - Add a "Learn More" link that opens full documentation

2. **Gesture Recording**
   - Track which gestures users actually use
   - Optimize hints based on usage patterns

3. **Keyboard Shortcuts**
   - Add shortcuts for common actions (e.g., `R` to reset view)
   - Display keyboard hints in the mode bar

4. **Touch Feedback**
   - Haptic feedback on mobile devices
   - Visual feedback for pinch/drag gestures

5. **Accessibility**
   - Screen reader announcements for mode changes
   - High-contrast mode for hints
   - Keyboard-only navigation support

---

## Testing Checklist

When testing gesture interactions, verify:

### Desktop
- [ ] Drag rotates 3D graph smoothly
- [ ] Drag pans 2D graph horizontally/vertically
- [ ] Shift+Drag pans 3D graph without rotating
- [ ] Scroll wheel zooms in/out
- [ ] Double-click resets camera
- [ ] Mode bar appears on hover
- [ ] Hint appears and fades on interaction

### Mobile
- [ ] One-finger drag rotates 3D graph
- [ ] One-finger drag pans 2D graph
- [ ] Two-finger pinch zooms smoothly
- [ ] Two-finger drag pans 3D graph
- [ ] Mode bar appears on tap
- [ ] Hint is readable and properly positioned

### Themes
- [ ] Hint matches dark theme colors
- [ ] Hint matches light theme colors
- [ ] Hint remains readable in all custom themes
- [ ] Mode bar styling matches theme

### Edge Cases
- [ ] Rapid gesture switching works smoothly
- [ ] No gesture conflicts or dead zones
- [ ] Works with external mice, trackpads, and touch screens
- [ ] Performance remains smooth with large datasets

---

## Troubleshooting

### "Shift+Drag isn't working in 3D"

**Cause**: Plotly requires `dragmode: 'orbit'` to be set in the scene layout.

**Fix**: Verify `layout.scene.dragmode` is set to `'orbit'` in `PlotlyThemeConfig.get3DLayout()`.

### "Scroll zoom isn't working"

**Cause**: `scrollZoom` is disabled in the Plotly config.

**Fix**: Ensure `config.scrollZoom: true` in `PlotlyThemeConfig.getPlotlyConfig()`.

### "Hint is not visible"

**Cause**: CSS z-index conflict or missing relative positioning on parent.

**Fix**: 
1. Verify `.math-graph-plotly` has `position: relative`
2. Verify `.graph-interaction-hint` has `z-index: 10`
3. Check for conflicting styles in Obsidian theme CSS

### "Mode bar never appears"

**Cause**: `displayModeBar` is set to `false` instead of `'hover'`.

**Fix**: Set `config.displayModeBar: 'hover'` in `PlotlyThemeConfig.getPlotlyConfig()`.

---

## References

- [Plotly.js Configuration Options](https://plotly.com/javascript/configuration-options/)
- [Plotly.js 3D Scatter Plots](https://plotly.com/javascript/3d-scatter-plots/)
- [Plotly.js 3D Surface Plots](https://plotly.com/javascript/3d-surface-plots/)
- [Three.js Camera Controls](https://threejs.org/docs/#examples/en/controls/OrbitControls) (inspiration for interaction model)

---

## Changelog

### v1.0.0 - 2024-01-XX
- ✨ Implemented gesture-based interaction model
- ✨ Added persistent interaction hints
- ✨ Enabled scroll zoom for all graphs
- ✨ Set mode bar to "hover" for clean interface
- ✨ Configured default drag modes (pan for 2D, orbit for 3D)
- 📝 Created comprehensive documentation
- 🎨 Added theme-aware hint styling

---

For questions or feedback, please open an issue on GitHub.