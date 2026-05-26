# Build Tool Guide

## Overview

The `build_game` tool packages your game files into a single, self-contained HTML file that runs in the user's browser. The build process handles bundling, asset inlining, and error reporting setup.

---

## How It Works

1. Reads `user_space/scripts/main.js` as the entry point.
2. Bundles all JS files using esbuild (supports ES module `import`/`export`).
3. Inlines CSS files from `user_space/assets/` into a `<style>` tag.
4. Converts image files to base64 data URIs (PNG, JPG, GIF, SVG).
5. Injects an error handler that reports runtime errors to the parent frame via `postMessage`.
6. Outputs a single `game.html` with all content embedded.

---

## Entry Point Convention

Your game **must** have a `scripts/main.js` file. This is the entry point that imports other modules:

```javascript
// scripts/main.js
import { createGameLoop } from './lib/game-loop.js';
import { createInputManager } from './lib/input.js';

const input = createInputManager();
const loop = createGameLoop(update, render);
loop.start();
```

### The `startGame()` Auto-Call Pattern

The build tool automatically calls `window.startGame()` after the bundle loads. If you need an explicit entry point exposed to the build pipeline:

```javascript
// This function is called automatically after all scripts load
window.startGame = function() {
  const loop = createGameLoop(update, render);
  loop.start();
};
```

**Important:** Because scripts are bundled as `<script type="module">`, top-level variables are module-scoped, not global. Use `window.startGame` explicitly if the build tool needs to find your entry point.

---

## Script Loading Order

The build tool concatenates scripts in this order:

1. **Utility scripts** (`lib/game-loop.js`, `lib/input.js`, `lib/collision.js`) — always loaded first.
2. **Game code** (`scripts/main.js` and its imports) — loaded after utilities.

### Why This Matters

Utility classes (`GameLoop`, `InputManager`, collision helpers) are pre-loaded and available as imports. **Never redeclare them** in your game code:

```javascript
// ✅ Correct — import the pre-built utility
import { createGameLoop } from './lib/game-loop.js';

// ❌ Wrong — GameLoop is already defined in lib/
function createGameLoop() { /* ... */ }
```

### Script Format

All scripts are bundled as `<script type="module">` (not IIFE). This means:

- `import`/`export` syntax works across your files.
- Top-level variables are **module-scoped**, not added to `window`.
- The module executes after the DOM is parsed (deferred by default).

---

## Canvas ID Requirement

The build tool generates HTML with `<canvas id="gameCanvas">`. Your code must use this exact ID:

```javascript
// ✅ Correct
const canvas = document.getElementById('gameCanvas');

// ❌ Wrong — will fail because 'game' doesn't exist in the output
const canvas = document.getElementById('game');
```

---

## Asset Usage

Store images in `user_space/assets/`:

```
assets/
  ├── sprite.png
  ├── background.jpg
  ├── explosion.gif
  ├── icon.svg
  └── styles.css
```

### Accessing Inlined Assets via `window.__ASSETS__`

All images are converted to base64 data URIs at build time. Access them through the auto-generated `window.__ASSETS__` dictionary:

```javascript
const img = new Image();
img.src = window.__ASSETS__['sprite.png'];  // Returns a data URI like "data:image/png;base64,..."
```

You can also reference images by filename alone — the build tool resolves the path:

```javascript
img.src = 'sprite.png'; // Build tool inlines this
```

But `window.__ASSETS__` is the authoritative source and is guaranteed to work regardless of path resolution quirks.

### Checking If Assets Loaded

```javascript
function preloadAssets(filenames, callback) {
  let loaded = 0;
  const images = {};
  for (const name of filenames) {
    const img = new Image();
    img.onload = () => {
      loaded++;
      if (loaded >= filenames.length) callback(images);
    };
    img.onerror = () => {
      console.error(`Failed to load asset: ${name}`);
      loaded++;
      if (loaded >= filenames.length) callback(images);
    };
    img.src = window.__ASSETS__[name] || name;
    images[name] = img;
  }
}
```

---

## Error Handler Bridge

The build tool injects a global error handler that catches runtime exceptions and sends them to the parent frame via `postMessage`:

```javascript
window.addEventListener('error', (event) => {
  window.parent.postMessage({
    type: 'game-error',
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  }, '*');
});
```

This is how errors appear in the chat UI. Any uncaught exception in your game code is automatically reported.

**Best practices:**
- Use `try/catch` around risky operations (asset loading, audio context creation).
- Console warnings (`console.warn`) do not trigger the error bridge — use them for non-fatal issues.
- The error handler catches synchronous exceptions. For async errors, use `window.addEventListener('unhandledrejection', ...)` if needed.

---

## Output Format

The build produces a complete HTML5 document:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Game</title>
  <style>
    /* Inlined CSS from assets/styles.css */
  </style>
</head>
<body>
  <canvas id="gameCanvas"></canvas>
  <script type="module">
    // Bundled game code (utils first, then game code)
  </script>
  <script>
    // Error handler (postMessage bridge)
    // startGame() auto-call
  </script>
</body>
</html>
```

---

## After Building

Always call `build_game` after making any code changes. The output is shown to the user in the game preview panel.

---

## Troubleshooting

### "Canvas is null"

Your code is using `document.getElementById('game')` but the output has `id="gameCanvas"`. Use `'gameCanvas'` everywhere.

### "X is not defined" / "X is not a function"

You're redeclaring a utility function that is already provided by `lib/`. Import from the library instead of defining it yourself:

```javascript
// Instead of:
function createGameLoop(update, render) { ... }

// Do:
import { createGameLoop } from './lib/game-loop.js';
```

### "Assets not loading" / "404 on image"

Your image file is not in `assets/`, or the filename in code doesn't match exactly. Check:
- File is in `assets/` (not `scripts/` or root).
- Filename case matches (the build tool is case-sensitive).
- You're using `window.__ASSETS__['filename.ext']`.

### "Audio doesn't work" / "AudioContext was not allowed"

Browsers block audio until a user gesture. Create `AudioContext` on first click/keypress:

```javascript
document.addEventListener('click', () => {
  if (!audioCtx) audioCtx = new AudioContext();
}, { once: true });
```

### "Game runs super fast after tab switch"

Your delta time is not clamped. The browser delivers a huge timestamp jump when the tab comes back. Use `Math.min(dt, 0.05)` or use the `createGameLoop` utility which clamps automatically.

### "Variables are undefined"

You're in `<script type="module">` scope. Top-level `var`/`let`/`const` are not global. Use `window.variableName = value` for anything you need to expose globally.

### "Build fails silently"

Check that `scripts/main.js` exists and doesn't have syntax errors. Run your code through a linter before building.
