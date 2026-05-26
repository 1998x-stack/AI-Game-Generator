# HTML5 Game Development Guide

A comprehensive reference for building browser-based games using the Canvas 2D API. Every pattern here is compatible with this project's build pipeline and runs in `<script type="module">` context.

---

## Table of Contents

1. [Game Loop](#game-loop)
2. [Canvas Rendering](#canvas-rendering)
3. [Fixed Timestep](#fixed-timestep)
4. [Collision Detection](#collision-detection)
5. [Input Handling](#input-handling)
6. [Touch Controls](#touch-controls)
7. [Sprite Management](#sprite-management)
8. [Audio](#audio)
9. [Game States](#game-states)
10. [Entity-Component Pattern](#entity-component-pattern)
11. [Object Pooling](#object-pooling)
12. [Performance Tips](#performance-tips)

---

## Game Loop

Every game **must** use `requestAnimationFrame` for smooth, battery-efficient animation. Never use `setInterval` or `setTimeout` — they are not synchronized with the display refresh rate.

### Basic Variable-Timestep Loop

The simplest loop calculates delta time each frame and passes it to an update function:

```javascript
let lastTime = 0;

function gameLoop(timestamp) {
  const deltaTime = (timestamp - lastTime) / 1000; // seconds
  lastTime = timestamp;

  // Prevent huge jumps if tab was backgrounded (see: Fixed Timestep)
  const dt = Math.min(deltaTime, 0.05);

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
```

### Using the Reusable GameLoop (Pre-loaded)

The project provides a pre-built `GameLoop` utility in `lib/game-loop.js`. It is already loaded before your game code runs, so you can import it directly — never redeclare it:

```javascript
import { createGameLoop } from './lib/game-loop.js';

const loop = createGameLoop(
  (dt) => { /* update: dt is capped at 50ms */ },
  () => { /* render */ }
);

loop.start();

// Later: loop.stop();
```

The `createGameLoop` factory returns an object with `start()`, `stop()`, and an `isRunning` getter. It caps delta time at 50ms internally, so you never need to clamp it yourself.

### Fixed-Timestep Loop

For deterministic physics (e.g., platformers, fighting games), use the accumulator pattern. See [Fixed Timestep](#fixed-timestep) section for details.

---

## Canvas Rendering

### Setup

Always set canvas dimensions in JavaScript even if they are set in HTML — the packager does not guarantee HTML attributes persist:

```javascript
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;
```

### Clearing

Clear the entire canvas each frame before redrawing:

```javascript
ctx.clearRect(0, 0, canvas.width, canvas.height);
```

### Draw Order

Layers must be drawn back-to-front:

1. Background / sky / starfield
2. Game world tiles and objects
3. Entities (sorted by y for isometric depth)
4. Particles / effects
5. HUD / UI / overlays
6. Screen flash effects (damage, transitions)

### Transforms

Use `ctx.save()` and `ctx.restore()` around temporary transforms:

```javascript
function drawSprite(ctx, image, x, y, angle, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  // Draw centered on (0,0) so rotation pivots around center
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  ctx.restore();
}
```

### Pixel Art

Disable image smoothing for pixel-art games:

```javascript
ctx.imageSmoothingEnabled = false; // Standard
ctx.mozImageSmoothingEnabled = false; // Firefox
```

### Text Rendering

```javascript
ctx.font = 'bold 24px "Courier New", monospace';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillStyle = '#ffffff';
ctx.fillText('Score: 100', canvas.width / 2, 20);
```

---

## Fixed Timestep

The **accumulator pattern** decouples game logic updates from rendering, giving deterministic physics regardless of frame rate. This is essential for platformers, fighting games, and any simulation where stepping at a consistent rate matters.

### The Pattern

```javascript
const TICK_RATE = 1 / 60;   // 60 ticks per second (≈16.67ms)
const MAX_DT   = 0.05;      // cap at 50ms to prevent spiral of death

let accumulator = 0;
let lastTime = 0;

function gameLoop(timestamp) {
  let frameTime = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  // Clamp delta time to prevent huge jumps when tab is backgrounded
  if (frameTime > MAX_DT) frameTime = MAX_DT;

  accumulator += frameTime;

  // Step physics in fixed increments
  while (accumulator >= TICK_RATE) {
    fixedUpdate(TICK_RATE);  // Physics/movement with fixed dt
    accumulator -= TICK_RATE;
  }

  // Optional: interpolation for smooth rendering between ticks
  const alpha = accumulator / TICK_RATE;
  render(alpha);

  requestAnimationFrame(gameLoop);
}
```

### Why This Matters

- **Determinism**: Physics behaves identically at 30 FPS and 144 FPS.
- **Stability**: Collision detection doesn't miss thin walls at low FPS.
- **No Spiral of Death**: Delta time capping prevents the loop from falling behind forever after a pause.

### Delta Time Capping

Always cap delta time at **50ms** (20 FPS minimum). Without this, pausing the browser tab for 30 seconds produces a single 30-second frame, teleporting entities through walls:

```javascript
const dt = Math.min(rawDeltaTime, 0.05);
```

---

## Collision Detection

### AABB (Axis-Aligned Bounding Box)

Best for rectangles that don't rotate. Fast and simple:

```javascript
function checkAABB(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
```

The project provides this as a pre-loaded utility:

```javascript
import { aabbCollision } from './lib/collision.js';
if (aabbCollision(player, enemy)) { /* hit! */ }
```

### Circle Collision

Best for balls, pickups, and circular entities. Uses squared distance to avoid expensive `Math.sqrt`:

```javascript
function checkCircles(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const distSq = dx * dx + dy * dy;
  const radSum = a.radius + b.radius;
  return distSq < radSum * radSum;
}
```

Available as:

```javascript
import { circleCollision } from './lib/collision.js';
```

### Point in Rectangle

```javascript
function pointInRect(px, py, rect) {
  return (
    px >= rect.x && px <= rect.x + rect.width &&
    py >= rect.y && py <= rect.y + rect.height
  );
}
```

Available as:

```javascript
import { pointInRect } from './lib/collision.js';
```

### Collision Resolution

Always **check before moving**, or resolve by pushing objects out of overlap:

```javascript
// For platformers: resolve overlap after collision
function resolveOverlap(player, wall) {
  // Calculate overlap on each axis
  const overlapLeft   = (player.x + player.width)  - wall.x;
  const overlapRight  = (wall.x + wall.width)      - player.x;
  const overlapTop    = (player.y + player.height) - wall.y;
  const overlapBottom = (wall.y + wall.height)     - player.y;

  // Push out on the smallest overlap axis
  const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

  if (minOverlap === overlapLeft)      player.x = wall.x - player.width;
  else if (minOverlap === overlapRight)  player.x = wall.x + wall.width;
  else if (minOverlap === overlapTop)    player.y = wall.y - player.height;
  else if (minOverlap === overlapBottom) player.y = wall.y + wall.height;
}
```

---

## Input Handling

### Keyboard (Pre-loaded)

The project provides `InputManager` which handles key state tracking and edge detection (`wasPressed`):

```javascript
import { createInputManager } from './lib/input.js';

const input = createInputManager();

// In update():
if (input.isDown('ArrowRight')) { /* move right */ }
if (input.wasPressed(' '))       { /* jump on key press (not hold) */ }
```

The `wasPressed` method returns `true` only once per key press — perfect for jump, shoot, or menu-select actions.

### Preventing Default Browser Actions

Always prevent default for game keys to stop page scrolling:

```javascript
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
  // Do NOT prevent default for F5, F12, Ctrl+R, Ctrl+W
});
```

### Mouse Input

```javascript
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;
});

canvas.addEventListener('click', (e) => {
  // Handle click/tap to start or shoot
});
```

---

## Touch Controls

All touch interactions must call `e.preventDefault()` to prevent page scrolling.

### Virtual Joystick

A fixed-position on-screen joystick for 2D movement (platformers, top-down games):

```javascript
const joystick = {
  centerX: 100, centerY: 300, radius: 50,
  active: false, touchId: null,
  dx: 0, dy: 0  // Normalized -1..1 values
};

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  for (const touch of e.changedTouches) {
    const rect = canvas.getBoundingClientRect();
    const tx = touch.clientX - rect.left;
    const ty = touch.clientY - rect.top;

    // Check if touch is in joystick zone
    const dist = Math.hypot(tx - joystick.centerX, ty - joystick.centerY);
    if (dist < joystick.radius * 1.5) {
      joystick.active = true;
      joystick.touchId = touch.identifier;
    }
  }
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const touch of e.changedTouches) {
    if (touch.identifier !== joystick.touchId) continue;
    const rect = canvas.getBoundingClientRect();
    const tx = touch.clientX - rect.left;
    const ty = touch.clientY - rect.top;

    const dx = tx - joystick.centerX;
    const dy = ty - joystick.centerY;
    const dist = Math.hypot(dx, dy);

    if (dist < joystick.radius) {
      joystick.dx = dx / joystick.radius;
      joystick.dy = dy / joystick.radius;
    } else {
      joystick.dx = dx / dist;
      joystick.dy = dy / dist;
    }
  }
});

canvas.addEventListener('touchend', (e) => {
  for (const touch of e.changedTouches) {
    if (touch.identifier === joystick.touchId) {
      joystick.active = false;
      joystick.touchId = null;
      joystick.dx = 0;
      joystick.dy = 0;
    }
  }
});
```

### Swipe Detection

For swipe-input games (fruit slicing, runner lane changes):

```javascript
let swipeStartX = 0, swipeStartY = 0;
const SWIPE_THRESHOLD = 30;

canvas.addEventListener('touchstart', (e) => {
  const touch = e.changedTouches[0];
  swipeStartX = touch.clientX;
  swipeStartY = touch.clientY;
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  const touch = e.changedTouches[0];
  const dx = touch.clientX - swipeStartX;
  const dy = touch.clientY - swipeStartY;
  const dist = Math.hypot(dx, dy);

  if (dist < SWIPE_THRESHOLD) return; // Too short, ignore

  if (Math.abs(dx) > Math.abs(dy)) {
    console.log(dx > 0 ? 'SWIPE_RIGHT' : 'SWIPE_LEFT');
  } else {
    console.log(dy > 0 ? 'SWIPE_DOWN' : 'SWIPE_UP');
  }
}, { passive: false });
```

### Multi-Touch

Track multiple touches with unique identifiers for dual-stick controls or multi-finger gestures:

```javascript
const activeTouches = {};

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  for (const touch of e.changedTouches) {
    activeTouches[touch.identifier] = {
      x: touch.clientX,
      y: touch.clientY
    };
  }
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const touch of e.changedTouches) {
    activeTouches[touch.identifier] = {
      x: touch.clientX,
      y: touch.clientY
    };
  }
});

canvas.addEventListener('touchend', (e) => {
  for (const touch of e.changedTouches) {
    delete activeTouches[touch.identifier];
  }
});
```

The project provides a pre-built `createTouchManager`:

```javascript
import { createTouchManager } from './lib/input.js';
const touch = createTouchManager(canvas);
const touches = touch.getTouches(); // Array of {id, x, y, active}
```

---

## Sprite Management

### Loading Images

All images from `assets/` are inlined as base64 data URIs at build time. Access them via `window.__ASSETS__`:

```javascript
const img = new Image();
img.src = window.__ASSETS__['sprite.png'];  // Base64 data URI
// or just use the filename — the build tool resolves it:
// img.src = 'sprite.png';
```

Wait for images to load before starting the game:

```javascript
function loadAssets(filenames, callback) {
  let loaded = 0;
  const total = filenames.length;
  const images = {};

  for (const name of filenames) {
    const img = new Image();
    img.onload = () => {
      loaded++;
      if (loaded >= total) callback(images);
    };
    img.src = window.__ASSETS__[name] || name;
    images[name] = img;
  }
}
```

### Sprite Sheets with drawImage Clipping

Use `ctx.drawImage` with source rectangle arguments to extract frames from a sprite sheet:

```javascript
function drawFrame(ctx, sheet, frameIndex, frameWidth, frameHeight, destX, destY, scale = 1) {
  ctx.drawImage(
    sheet,                         // Source image (sprite sheet)
    frameIndex * frameWidth, 0,   // Source x, y (top-left of frame)
    frameWidth, frameHeight,       // Source width, height
    destX, destY,                  // Destination x, y
    frameWidth * scale,            // Destination width
    frameHeight * scale            // Destination height
  );
}

// Usage: draw the 3rd frame (index 2) of a 32x32 sheet
drawFrame(ctx, characterSheet, 2, 32, 32, player.x, player.y, 2);
```

### Animation Frames

A simple frame-based animation controller:

```javascript
const animation = {
  frames: [0, 1, 2, 3],       // Frame indices in the sprite sheet
  frameDuration: 0.1,          // Seconds per frame
  currentFrame: 0,
  timer: 0,

  update(dt) {
    this.timer += dt;
    if (this.timer >= this.frameDuration) {
      this.timer = 0;
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }
  },

  getFrameIndex() {
    return this.frames[this.currentFrame];
  }
};

// In update():
animation.update(dt);

// In render():
drawFrame(ctx, sheet, animation.getFrameIndex(), 32, 32, x, y);
```

---

## Audio

### Web Audio API Basics

The Web Audio API provides low-latency, high-quality audio. Create sounds programmatically or load short audio files.

### AudioContext — The Sound Lock

Browsers require a user gesture before creating/resuming an AudioContext. Always create it on first interaction:

```javascript
let audioCtx = null;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

// Call on first click or keypress
document.addEventListener('click', initAudio, { once: true });
document.addEventListener('keydown', initAudio, { once: true });
```

### Playing Sound Effects

```javascript
function playTone(frequency, duration, type = 'square') {
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;       // 'sine', 'square', 'sawtooth', 'triangle'
  osc.frequency.value = frequency;

  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

// One-shot sounds
function playShoot()   { playTone(800, 0.1, 'square'); }
function playExplode() { playTone(150, 0.3, 'sawtooth'); }
function playPickup()  { playTone(660, 0.08);
                         setTimeout(() => playTone(880, 0.08), 80); }
```

### Loading Audio Files

Audio files are inlined as base64 data URIs at build time. Use the Web Audio API's `decodeAudioData`:

```javascript
async function loadSound(name) {
  const response = await fetch(window.__ASSETS__[name]);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  return audioBuffer;
}

function playSound(buffer) {
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
}

// Usage
const sfx = await loadSound('explosion.wav');
playSound(sfx);
```

### Volume Control

```javascript
function playSoundWithVolume(buffer, volume) {
  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  gain.gain.value = volume;

  source.buffer = buffer;
  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
}
```

---

## Game States

Every game must handle distinct states. Use a state machine pattern (see also [game-patterns.md](./game-patterns.md)):

```javascript
const State = {
  MENU:     0,
  PLAYING:  1,
  PAUSED:   2,
  GAME_OVER: 3
};

let state = State.MENU;

function update(dt) {
  switch (state) {
    case State.MENU:
      // Wait for input to start
      if (input.wasPressed('Enter') || input.wasPressed(' ')) {
        resetGame();
        state = State.PLAYING;
      }
      break;

    case State.PLAYING:
      if (input.wasPressed('Escape') || input.wasPressed('p')) {
        state = State.PAUSED;
      }
      // Normal update logic...
      break;

    case State.PAUSED:
      if (input.wasPressed('Escape') || input.wasPressed('p')) {
        state = State.PLAYING;
      }
      break;

    case State.GAME_OVER:
      if (input.wasPressed('Enter') || input.wasPressed(' ')) {
        state = State.MENU;
      }
      break;
  }
}
```

**Critical**: Reset all game state variables (score, lives, player position, enemy arrays) when restarting. A common bug is leftover state from a previous session.

---

## Entity-Component Pattern

For complex games with many entity types (bullets, enemies, particles, power-ups), an Entity-Component System (ECS) separates data from behavior. Each entity is an ID with a bag of components, and systems operate on entities that have specific component combinations.

### Lightweight ECS Implementation

```javascript
// --- Entity Manager ---
const EntityManager = {
  nextId: 0,
  entities: new Map(),     // id -> Set<componentName>
  components: new Map(),   // 'position' -> Map<id, {x, y}>

  create() {
    const id = this.nextId++;
    this.entities.set(id, new Set());
    return id;
  },

  add(entityId, componentName, data) {
    this.entities.get(entityId).add(componentName);
    if (!this.components.has(componentName)) {
      this.components.set(componentName, new Map());
    }
    this.components.get(componentName).set(entityId, data);
  },

  get(entityId, componentName) {
    const pool = this.components.get(componentName);
    return pool ? pool.get(entityId) : null;
  },

  has(entityId, componentName) {
    const comps = this.entities.get(entityId);
    return comps ? comps.has(componentName) : false;
  },

  remove(entityId) {
    for (const [name, pool] of this.components) {
      pool.delete(entityId);
    }
    this.entities.delete(entityId);
  },

  // Query all entities that have ALL specified components
  query(...componentNames) {
    const results = [];
    for (const [id, comps] of this.entities) {
      if (componentNames.every(c => comps.has(c))) {
        results.push(id);
      }
    }
    return results;
  },

  clear() {
    this.nextId = 0;
    this.entities.clear();
    for (const pool of this.components.values()) pool.clear();
  }
};

// --- Systems operate on component queries ---
function movementSystem(dt) {
  for (const id of EntityManager.query('position', 'velocity')) {
    const pos = EntityManager.get(id, 'position');
    const vel = EntityManager.get(id, 'velocity');
    pos.x += vel.x * dt;
    pos.y += vel.y * dt;
  }
}

function renderSystem(ctx) {
  for (const id of EntityManager.query('position', 'sprite')) {
    const pos = EntityManager.get(id, 'position');
    const sprite = EntityManager.get(id, 'sprite');
    ctx.drawImage(sprite.image, pos.x, pos.y);
  }
}

// --- Usage ---
function createBullet(x, y, vx, vy) {
  const e = EntityManager.create();
  EntityManager.add(e, 'position', { x, y });
  EntityManager.add(e, 'velocity', { x: vx, y: vy });
  EntityManager.add(e, 'lifetime', { remaining: 2 }); // seconds
  EntityManager.add(e, 'sprite', { image: bulletImg });
  return e;
}

function lifetimeSystem(dt) {
  for (const id of EntityManager.query('lifetime')) {
    const life = EntityManager.get(id, 'lifetime');
    life.remaining -= dt;
    if (life.remaining <= 0) EntityManager.remove(id);
  }
}
```

### When to Use ECS

- **Use ECS when**: you have 5+ entity types with shared systems (movement, collision, rendering).
- **Don't use ECS when**: you have 2-3 entity types and can use simple classes/objects.

---

## Object Pooling

Creating and garbage-collecting many short-lived objects (bullets, particles, enemies) causes frame drops due to GC pauses. Object pooling reuses dead objects instead of allocating new ones.

### Basic Pool

```javascript
class ObjectPool {
  constructor(factory, resetFn, initialSize = 20) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.pool = [];
    this.active = [];

    // Pre-allocate
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire() {
    let obj;
    if (this.pool.length > 0) {
      obj = this.pool.pop();
    } else {
      obj = this.factory(); // Pool exhausted — grow
    }
    this.active.push(obj);
    return obj;
  }

  release(obj) {
    const idx = this.active.indexOf(obj);
    if (idx >= 0) {
      this.active.splice(idx, 1);
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }

  releaseAll() {
    for (const obj of this.active) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
    this.active.length = 0;
  }

  getActiveCount() { return this.active.length; }
  getPoolSize()    { return this.pool.length; }
}
```

### Usage Example — Bullet Pool

```javascript
const bulletPool = new ObjectPool(
  // Factory
  () => ({ x: 0, y: 0, vx: 0, vy: 0, alive: false }),
  // Reset
  (b) => { b.alive = false; }
);

function fireBullet(x, y, vx, vy) {
  const b = bulletPool.acquire();
  b.x = x;
  b.y = y;
  b.vx = vx;
  b.vy = vy;
  b.alive = true;
}

function updateBullets(dt) {
  for (const b of bulletPool.active) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Release if off-screen
    if (b.y < -10 || b.y > canvas.height + 10) {
      bulletPool.release(b);
    }
  }
}
```

### When to Pool

- **Bullets**: Always pool. A shmup can fire hundreds per second.
- **Particles**: Always pool. Particle emitters produce thousands.
- **Enemies**: Pool if enemies spawn frequently in waves.
- **Pickups / Power-ups**: Usually don't need pooling — few exist at once.

---

## Performance Tips

### Minimize Allocation in the Hot Path

- Pre-create objects instead of using object literals in the game loop.
- Use `objectPool.acquire()` and `objectPool.release()` for bullets/particles.
- Avoid `new` inside update/render (except for `AudioContext` creation).

### Pre-Calculate Values Outside the Loop

```javascript
// Bad: calculated every frame
function render() {
  const halfW = canvas.width / 2;
  const halfH = canvas.height / 2;
  // ...
}

// Good: calculated once
const HALF_W = canvas.width / 2;
const HALF_H = canvas.height / 2;
function render() {
  // Use HALF_W, HALF_H
}
```

### Use Integer Positions

Sub-pixel rendering is more expensive. Use `Math.round()` or `~~` for position values:

```javascript
// Sub-pixel (slower rendering)
ctx.drawImage(img, 3.14159, 2.71828);

// Integer (faster)
ctx.drawImage(img, Math.round(x), Math.round(y));
```

### Batch Canvas State Changes

Group operations by canvas state to minimize `save()`/`restore()` calls:

```javascript
// Efficient: batch all red objects together
ctx.fillStyle = '#ff0000';
for (const obj of redObjects) ctx.fillRect(obj.x, obj.y, 10, 10);

ctx.fillStyle = '#00ff00';
for (const obj of greenObjects) ctx.fillRect(obj.x, obj.y, 10, 10);
```

### Off-screen Canvas

For static backgrounds or complex elements that rarely change, render to an off-screen canvas and copy it:

```javascript
const bgCanvas = document.createElement('canvas');
bgCanvas.width = 800;
bgCanvas.height = 600;
const bgCtx = bgCanvas.getContext('2d');
// Draw background once...
drawBackground(bgCtx);

// In render loop — just copy:
ctx.drawImage(bgCanvas, 0, 0);
```

### Limit Draw Calls

- Layer static backgrounds onto an off-screen canvas.
- Only redraw entities that actually changed position/state.
- Use `ctx.clearRect` on dirty regions instead of the full canvas when appropriate.

### Avoid GC Pressure

- Reuse arrays: clear with `arr.length = 0` instead of `arr = []`.
- Reuse objects: update properties instead of creating new ones.
- Object pooling for frequently created/destroyed objects.

### Canvas Dimension Tips

- Keep canvas size reasonable (e.g., 800x600, 480x600). Very large canvases (4K+) cost proportionally more on fill operations.
- Use CSS scaling to display at larger sizes: `canvas { width: 100%; max-width: 800px; }`.
- Always set `canvas.width` and `canvas.height` in JavaScript — CSS `width`/`height` only affects display size, not backing store resolution.
