# Game Gotchas — Common Pitfalls to Avoid

A catalog of hard-won lessons. If something breaks, check here first.

---

## Canvas ID

**Always use `id="gameCanvas"`** — the build tool generates this exact ID in the HTML template. Never use `id="game"` or any other value:

```javascript
// ✅ Correct
const canvas = document.getElementById('gameCanvas');

// ❌ Wrong — will fail at runtime
const canvas = document.getElementById('game');
```

---

## Delta Time Clamping

**Always cap deltaTime at 50ms** to prevent huge physics jumps when the browser tab is backgrounded. Without clamping, a 30-second tab pause produces a 30-second frame, teleporting entities through walls:

```javascript
const dt = Math.min(rawDeltaTime, 0.05); // 50ms = 20 FPS floor
```

The pre-built `createGameLoop` utility does this automatically. If you write your own loop, you must clamp.

---

## Module Scope

Game code runs in `<script type="module">` — this means **no global scope pollution**. Variables declared with `var`, `let`, or `const` at the top level are scoped to the module, not `window`.

If you need a globally accessible entry point (for the build tool's `startGame()` auto-call pattern):

```javascript
// ✅ Correct
window.startGame = function() { /* ... */ };

// ❌ Wrong — not accessible outside the module
function startGame() { /* ... */ }
```

---

## Utils Are Pre-loaded

The utility files in `lib/` (`game-loop.js`, `input.js`, `collision.js`) are already loaded before your game code runs. **Never redeclare their classes or functions**:

```javascript
// ✅ Correct — import and use
import { createGameLoop } from './lib/game-loop.js';

// ❌ Wrong — GameLoop already exists
function createGameLoop() { /* don't do this */ }
```

---

## Canvas Dimensions

**Always set `canvas.width` and `canvas.height` in JavaScript**, even if they are set in the HTML. The packager does not guarantee HTML attributes survive the build process:

```javascript
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ✅ Always do this in JS
canvas.width = 800;
canvas.height = 600;

// HTML alone is not enough:
// <canvas id="gameCanvas" width="800" height="600"> — may be lost
```

---

## PostMessage Error Bridge

Runtime errors in the game are caught by an error handler and sent to the parent frame via `window.parent.postMessage()`. This is how errors appear in the chat UI.

Write clean error handling — uncaught exceptions will be reported:

```javascript
// This error will be caught and displayed in chat
throw new Error('Something broke');

// Better: handle gracefully
try {
  riskyOperation();
} catch (e) {
  console.warn('Non-fatal error:', e.message);
}
```

---

## Asset References

Images placed in `assets/` are embedded as base64 data URIs at build time. They are accessible through `window.__ASSETS__[filename]`:

```javascript
const img = new Image();
img.src = window.__ASSETS__['sprite.png'];
```

You can also reference images by filename alone — the build tool resolves them:

```javascript
img.src = 'sprite.png'; // Build tool inlines this as base64
```

But `window.__ASSETS__` is the authoritative source.

---

## No External Dependencies

**All code must be self-contained.** No CDN links, no npm imports at runtime. The build tool bundles everything into a single HTML file:

```javascript
// ❌ Wrong — CDN dependency fails in built output
// <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>

// ✅ Correct — pure Canvas 2D or self-contained code
const ctx = canvas.getContext('2d');
```

If you need a library, it must be included in the project's source and bundled by the build tool.

---

## Sound Lock (AudioContext)

Browsers require a user gesture before creating or resuming an `AudioContext`. This is the **Sound Lock** — always create your `AudioContext` on the first click or keypress:

```javascript
let audioCtx = null;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

// Must be called from a user gesture
document.addEventListener('click', initAudio, { once: true });
document.addEventListener('keydown', initAudio, { once: true });
```

Creating `AudioContext` eagerly (on page load) will result in silent audio and a console warning.

---

## Snake Game Pitfalls

| Pitfall | Why It Happens | Fix |
|---------|---------------|-----|
| Snake turns 180° into itself | Direction change not validated | Block `isOpposite(newDir, currentDir)` |
| Food spawns on snake body | Random position not checked against occupied cells | Collect occupied cells, pick from free set |
| Speed varies with frame rate | Movement not delta-time compensated | Use fixed timestep or multiply by dt |
| Snake body teleports | Tail removed before head added, or head/tail order wrong | Push head, then conditionally shift tail |

---

## Random Number Generation

- When generating random positions (food, power-ups), ensure a minimum distance from other objects and screen edges.
- Use `Math.random()` for simple randomness. Avoid `Date.now()` as a seed — it can produce patterns.
- For reproducible randomness (e.g., seeded levels), use a seeded PRNG:

```javascript
function createSeededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}
const rng = createSeededRandom(12345);
const value = rng(); // Deterministic
```

---

## Game Loop Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| `setInterval` | Jittery animation, battery drain | Use `requestAnimationFrame` |
| No delta time | Speed varies with FPS | Calculate and apply `dt` |
| No delta cap | Entities teleport after tab pause | Clamp `dt` to max 50ms |
| Accumulator overflow | Game runs at 1 FPS after long pause | Cap accumulated `frameTime` before adding |

---

## Scoring & State

- **Reset everything** when restarting: score, lives, positions, timers, enemy arrays, and any pooled objects.
- Score must persist between frames in a JS variable, not a DOM element. Update the DOM from the variable, not the other way around.
- Game-over conditions must be checked **every frame** (or every fixed tick), not only on collision events.

---

## HTML Structure

- Entry point must be `scripts/main.js`.
- Game HTML template must use `<canvas id="gameCanvas">`.
- Do not use external CDN URLs — everything must be self-contained.
- All CSS must be inline or in `assets/styles.css` (which gets inlined).

---

## Keyboard Input

- Always call `e.preventDefault()` for game keys to stop page scrolling: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Space`.
- Do NOT prevent default for browser controls: `F5`, `F12`, `Ctrl+R`, `Ctrl+W`.
- Do not assume `e.key` is always lowercase — arrow keys use PascalCase (`ArrowUp`, not `arrowup`).

---

## Mobile / Touch

- Add touch controls for mobile compatibility when possible.
- Always call `e.preventDefault()` in `touchstart` / `touchmove` / `touchend` handlers to prevent scrolling.
- Use `{ passive: false }` option on `addEventListener` for `touchstart` and `touchmove` to allow `preventDefault()`.
- Test with Chrome DevTools device emulation — desktop debugging doesn't catch touch issues.

---

## Canvas Rendering Gotchas

- `ctx.clearRect()` is your friend every frame — don't try to be clever about partial clears unless profiling shows it matters.
- `ctx.save()` and `ctx.restore()` must be balanced. Every `save()` needs a matching `restore()`.
- Set `ctx.imageSmoothingEnabled = false` for pixel-art games (also `mozImageSmoothingEnabled` on Firefox).
- Canvas coordinates start at (0,0) top-left, and the y-axis increases downward.
