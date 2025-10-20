# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a 3D night driving game built with Next.js 15, React 19, Three.js, and GSAP. The game features a car driving through a dark environment illuminated only by its headlights, with palm trees that appear as you approach them. The entire game logic is contained in a single client-side component.

## Development Commands

```bash
# Start development server with Turbopack
npm run dev

# Build for production with Turbopack
npm run build

# Start production server
npm start

# Run ESLint
npm run lint
```

The development server runs on http://localhost:3000.

## Architecture

### Single-Page Application Structure
- **Next.js App Router**: Uses the App Router pattern with `app/layout.tsx` and `app/page.tsx`
- **Client-Side Only**: The main game component (`app/page.tsx`) is marked with `"use client"` directive as it requires browser APIs (canvas, WebGL, keyboard events)
- **No Server Components**: This is purely a client-side interactive application

### Game Architecture (app/page.tsx)

The entire game is implemented as a single React component with Three.js scene management:

**Core Systems:**
- **Scene Setup**: Three.js scene with fog, camera, renderer, and minimal lighting (headlights are the primary light source)
- **Car Class**: Custom `Car` extends `THREE.Object3D` with physics, steering, acceleration, and headlight systems
- **Render Loop**: Uses `requestAnimationFrame` with callback array pattern for updates
- **Keyboard Input**: Direct keyboard event handlers stored in `keys` object (arrow keys or WASD)

**Key Components:**
- **Ground**: Procedurally generated snowy terrain using `PlaneGeometry` with noise displacement
- **Palm Trees**: Loaded from FBX model (`/modals/Environment_PalmTree_3.fbx`) with fallback to boxes if loading fails
- **Visibility System**: Dynamic opacity based on headlight cone calculation (distance + angle factors)
- **Collision Detection**: Distance-based collision with hit counter tracking
- **Camera**: Follows car with smooth interpolation and dynamic lookAt positioning

**Important Constants (lines 23-30):**
- `GROUND_SIZE`: 2000 (terrain dimensions)
- `TREE_DISTRIBUTION_AREA`: 1800 (tree spawn area)
- `CAR_MOVEMENT_BOUNDS`: 990 (prevents car from leaving world)
- `TREE_COUNT`: 3000 (number of palm trees)

**Controls:**
- W/Up Arrow: Accelerate forward
- S/Down Arrow: Reverse
- A/Left Arrow: Steer left
- D/Right Arrow: Steer right

### Styling
- **Tailwind CSS v4**: Uses the new v4 inline theme syntax in `globals.css`
- **CSS Variables**: Theme uses CSS custom properties for dark/light mode
- **Geist Font**: Next.js font optimization for Geist and Geist Mono

## Key Technical Details

### Three.js Implementation
- **Modern BufferGeometry**: Uses `BufferGeometry` attributes API (not deprecated `Geometry`)
- **Shadow Mapping**: PCF soft shadows enabled on renderer
- **Tone Mapping**: Linear tone mapping with custom exposure
- **Material Cloning**: Each tree instance clones materials to avoid shared reference issues
- **FBX Loader**: Loads 3D models with proper rotation correction (90° X-axis rotation for upright trees)

### Performance Optimizations
- **Conditional Rendering**: Objects only visible when opacity > 0.01
- **Turbopack**: Enabled for both dev and build (faster bundling)
- **Material Transparency**: Dynamic opacity system for reveal effect

### React Patterns
- **useRef**: Used for DOM container, animation ID, and hit counter (mutable values that don't trigger re-renders)
- **useEffect**: Single effect for entire Three.js lifecycle with proper cleanup
- **Cleanup Function**: Cancels animation frames, removes event listeners, disposes renderer

## File Structure

```
app/
├── layout.tsx         # Root layout with font configuration and metadata
├── page.tsx           # Main game component (entire game logic)
└── globals.css        # Tailwind v4 styles and game-specific CSS

public/modals/         # 3D model assets (FBX files)
```

## Working with This Codebase

### Modifying Game Behavior
All game logic is in `app/page.tsx`. Key areas:
- **Car physics**: `Car.update()` method (lines 188-254)
- **Visibility system**: `updateBoxVisibility()` function (lines 415-471)
- **Collision detection**: `checkCollisions()` function (lines 474-504)
- **Scene setup**: Lines 33-66 (lights, camera, renderer)

### Adding 3D Models
Place FBX files in `public/modals/` directory. Reference them with absolute paths starting with `/modals/`. The FBXLoader is already configured with proper shadow support and material handling.

### Adjusting World Parameters
Modify the constants at lines 23-30 to change world size, tree density, or movement boundaries. These values are interdependent - ensure `CAR_MOVEMENT_BOUNDS` is less than `TREE_DISTRIBUTION_AREA`.

### TypeScript Configuration
- Target: ES2017
- Strict mode enabled
- Path alias: `@/*` maps to project root
- Module resolution: bundler mode (for Next.js)
