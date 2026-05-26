# Game Architecture Patterns

Reusable patterns for structuring browser-based games. Each pattern includes a code example and guidance on when to use it.

---

## Table of Contents

1. [State Machine Pattern](#state-machine-pattern)
2. [Game Loop with Fixed Timestep](#game-loop-with-fixed-timestep)
3. [Entity-Component System](#entity-component-system)
4. [Object Pooling](#object-pooling)
5. [Sprite Animation](#sprite-animation)
6. [Scrolling Background](#scrolling-background)
7. [Particle System](#particle-system)
8. [Score / UI Management](#score--ui-management)

---

## State Machine Pattern

Manages distinct game states (menu, playing, paused, game-over) with clean transitions. Each state has its own update and render logic.

### Implementation

```javascript
const State = {
  MENU:     'MENU',
  PLAYING:  'PLAYING',
  PAUSED:   'PAUSED',
  GAME_OVER: 'GAME_OVER'
};

class GameStateMachine {
  constructor() {
    this.state = State.MENU;
    this.transitions = {
      [State.MENU]:     { enter() {}, exit() {} },
      [State.PLAYING]:  { enter() {}, exit() {} },
      [State.PAUSED]:   { enter() {}, exit() {} },
      [State.GAME_OVER]:{ enter() {}, exit() {} }
    };
  }

  setState(newState) {
    if (this.state === newState) return;
    if (this.transitions[this.state]?.exit) {
      this.transitions[this.state].exit();
    }
    this.state = newState;
    if (this.transitions[this.state]?.enter) {
      this.transitions[this.state].enter();
    }
  }

  update(dt) {
    switch (this.state) {
      case State.MENU:
        this.updateMenu(dt);
        break;
      case State.PLAYING:
        this.updatePlaying(dt);
        break;
      case State.PAUSED:
        this.updatePaused(dt);
        break;
      case State.GAME_OVER:
        this.updateGameOver(dt);
        break;
    }
  }

  render(ctx) {
    switch (this.state) {
      case State.MENU:
        this.renderMenu(ctx);
        break;
      case State.PLAYING:
        this.renderPlaying(ctx);
        break;
      case State.PAUSED:
        this.renderPaused(ctx);
        break;
      case State.GAME_OVER:
        this.renderGameOver(ctx);
        break;
    }
  }

  // --- Individual update methods ---

  updateMenu(dt) {
    // Wait for input, show title
    if (input.wasPressed('Enter') || input.wasPressed(' ')) {
      this.resetGame();
      this.setState(State.PLAYING);
    }
  }

  updatePlaying(dt) {
    if (input.wasPressed('Escape') || input.wasPressed('p')) {
      this.setState(State.PAUSED);
      return;
    }
    // Normal game update...
  }

  updatePaused(dt) {
    if (input.wasPressed('Escape') || input.wasPressed('p')) {
      this.setState(State.PLAYING);
    }
  }

  updateGameOver(dt) {
    if (input.wasPressed('Enter') || input.wasPressed(' ')) {
      this.setState(State.MENU);
    }
  }

  resetGame() {
    // Reset all state: score, lives, positions, etc.
  }
}
```

### When to Use

- **Always** — every game needs at least 3 states (start, playing, game-over).
- Add `PAUSED` for any game longer than 30 seconds.
- Add `WIN` state for games with a victory condition.
- Add `LEVEL_COMPLETE` for games with multiple levels.

---

## Game Loop with Fixed Timestep

Decouples physics updates from rendering for deterministic, frame-rate-independent behavior. Essential for any game where consistent simulation matters.

### The Accumulator Pattern

```javascript
const TICK_RATE   = 1 / 60;    // 60 fixed steps per second
const MAX_FRAME   = 0.05;      // Cap at 50ms to prevent spiral of death

export function createFixedTimestepLoop(fixedUpdate, render) {
  let lastTime = 0;
  let accumulator = 0;
  let running = false;
  let animFrameId = null;

  function loop(timestamp) {
    if (!running) return;

    // Calculate frame time and clamp it
    let frameTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (frameTime > MAX_FRAME) frameTime = MAX_FRAME;

    accumulator += frameTime;

    // Run exactly N fixed updates this frame
    while (accumulator >= TICK_RATE) {
      fixedUpdate(TICK_RATE);
      accumulator -= TICK_RATE;
    }

    // Optional: interpolation alpha for smooth rendering
    // const alpha = accumulator / TICK_RATE;
    render();

    animFrameId = requestAnimationFrame(loop);
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      accumulator = 0;
      animFrameId = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    },
    get isRunning() { return running; },
    get fps() { return 1 / TICK_RATE; }
  };
}
```

### Usage Example

```javascript
const UPDATE = {
  TICK_RATE: 1 / 60,
  MAX_FRAME: 0.05
};

let lastTime = 0;
let accumulator = 0;

function fixedUpdate(tick) {
  // Physics runs at exactly 60 Hz
  player.x += player.vx * tick;
  player.y += player.vy * tick;
  checkCollisions();
}

function gameLoop(timestamp) {
  let frameTime = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  if (frameTime > UPDATE.MAX_FRAME) frameTime = UPDATE.MAX_FRAME;

  accumulator += frameTime;
  while (accumulator >= UPDATE.TICK_RATE) {
    fixedUpdate(UPDATE.TICK_RATE);
    accumulator -= UPDATE.TICK_RATE;
  }

  render();
  requestAnimationFrame(gameLoop);
}
```

### When to Use

- **Fixed timestep**: Platformers, fighting games, physics simulations, multiplayer (determinism required).
- **Variable timestep**: Simple casual games, turn-based games, visual demos.
- For most games in this project, fixed timestep is recommended.

---

## Entity-Component System

Separates data (components) from behavior (systems). Entities are just IDs with component bags. Systems iterate entities that match a component query.

### Lightweight ECS

```javascript
// --- Core ECS ---
const ECS = {
  nextId: 1,
  entities: new Map(),
  components: {},

  create() {
    const id = this.nextId++;
    this.entities.set(id, new Set());
    return id;
  },

  add(id, component, data) {
    this.entities.get(id).add(component);
    if (!this.components[component]) {
      this.components[component] = new Map();
    }
    this.components[component].set(id, data);
  },

  get(id, component) {
    return this.components[component]?.get(id);
  },

  has(id, component) {
    return this.entities.get(id)?.has(component) ?? false;
  },

  remove(id) {
    for (const pool of Object.values(this.components)) {
      pool.delete(id);
    }
    this.entities.delete(id);
  },

  // Query: get all entity IDs that have ALL specified components
  query(...components) {
    const results = [];
    for (const [id, comps] of this.entities) {
      if (components.every(c => comps.has(c))) {
        results.push(id);
      }
    }
    return results;
  },

  clear() {
    this.entities.clear();
    for (const pool of Object.values(this.components)) {
      pool.clear();
    }
  }
};

// --- Components are plain data objects ---
function Position(x = 0, y = 0)   { return { x, y }; }
function Velocity(x = 0, y = 0)   { return { x, y }; }
function Sprite(image, w, h)      { return { image, w, h }; }
function Health(maxHp)            { return { maxHp, hp: maxHp }; }
function Lifetime(seconds)        { return { remaining: seconds }; }

// --- Systems iterate over component queries ---
function movementSystem(dt) {
  for (const id of ECS.query('Position', 'Velocity')) {
    const pos = ECS.get(id, 'Position');
    const vel = ECS.get(id, 'Velocity');
    pos.x += vel.x * dt;
    pos.y += vel.y * dt;
  }
}

function lifetimeSystem(dt) {
  for (const id of ECS.query('Lifetime')) {
    const life = ECS.get(id, 'Lifetime');
    life.remaining -= dt;
    if (life.remaining <= 0) ECS.remove(id);
  }
}

function renderSystem(ctx) {
  for (const id of ECS.query('Position', 'Sprite')) {
    const pos = ECS.get(id, 'Position');
    const spr = ECS.get(id, 'Sprite');
    ctx.drawImage(spr.image, pos.x, pos.y, spr.w, spr.h);
  }
}

// --- Usage ---
function spawnBullet(x, y, vx, vy) {
  const e = ECS.create();
  ECS.add(e, 'Position', Position(x, y));
  ECS.add(e, 'Velocity', Velocity(vx, vy));
  ECS.add(e, 'Sprite', Sprite(bulletImg, 8, 8));
  ECS.add(e, 'Lifetime', Lifetime(2));
  return e;
}

function spawnEnemy(x, y) {
  const e = ECS.create();
  ECS.add(e, 'Position', Position(x, y));
  ECS.add(e, 'Velocity', Velocity(0, 50));
  ECS.add(e, 'Sprite', Sprite(enemyImg, 32, 32));
  ECS.add(e, 'Health', Health(3));
  return e;
}
```

### When to Use ECS vs Classes

| Use ECS When... | Use Classes When... |
|----------------|-------------------|
| 5+ entity types share behaviors | 2-3 entity types with unique logic |
| You add/remove components dynamically | Entities have fixed structure |
| Many entities share systems | Each entity has distinct methods |
| You need data-driven composition | You prefer familiar OOP patterns |

---

## Object Pooling

Reuses objects instead of allocating new ones, eliminating GC pauses from short-lived entities.

### Generic Pool

```javascript
class Pool {
  constructor(factory, reset, initialSize = 30) {
    this.factory = factory;
    this.reset = reset;
    this.available = [];
    this.active = [];

    // Pre-allocate
    for (let i = 0; i < initialSize; i++) {
      this.available.push(factory());
    }
  }

  get() {
    let obj = this.available.pop();
    if (!obj) obj = this.factory(); // grow on demand
    this.active.push(obj);
    return obj;
  }

  release(obj) {
    const idx = this.active.indexOf(obj);
    if (idx >= 0) {
      this.active.splice(idx, 1);
      this.reset(obj);
      this.available.push(obj);
    }
  }

  releaseAll() {
    for (const obj of this.active) {
      this.reset(obj);
      this.available.push(obj);
    }
    this.active.length = 0;
  }

  forEach(fn) {
    for (const obj of this.active) fn(obj);
  }

  get activeCount() { return this.active.length; }
  get poolSize()    { return this.available.length; }
}
```

### Bullet Pool Example

```javascript
// Factory creates a default bullet
const bullets = new Pool(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, alive: false, sprite: null }),
  (b) => { b.alive = false; },
  50  // pre-allocate 50 bullets
);

function fireBullet(x, y, angle, speed) {
  const b = bullets.get();
  b.x = x;
  b.y = y;
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
  b.alive = true;
}

function updateBullets(dt) {
  bullets.forEach((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Release off-screen bullets
    if (b.y < -20 || b.y > 620 || b.x < -20 || b.x > 820) {
      bullets.release(b);
    }
  });
}

function renderBullets(ctx) {
  bullets.forEach((b) => {
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}
```

### When to Pool

| Entity | Pool? | Why |
|--------|-------|-----|
| Bullets | **Always** | Hundreds can exist at once |
| Particles | **Always** | Particle systems create thousands |
| Enemies | Usually | Wave-based spawns benefit |
| Power-ups | Rarely | Few exist at once |
| UI elements | Never | Persistent, not spawned in loops |

---

## Sprite Animation

Frame-based animation with configurable timing. Works with sprite sheets.

### Animation Controller

```javascript
class SpriteAnimation {
  constructor(config) {
    this.sheet    = config.sheet;        // Image (sprite sheet)
    this.frames   = config.frames;       // Array of frame indices [0,1,2,...]
    this.duration = config.duration;     // Seconds per frame
    this.frameW   = config.frameWidth;   // Width of one frame in pixels
    this.frameH   = config.frameHeight;  // Height of one frame
    this.loop     = config.loop ?? true;
    this.onComplete = config.onComplete || null;

    this.currentIndex = 0;
    this.timer = 0;
    this.done = false;
  }

  reset() {
    this.currentIndex = 0;
    this.timer = 0;
    this.done = false;
  }

  update(dt) {
    if (this.done) return;

    this.timer += dt;
    while (this.timer >= this.duration) {
      this.timer -= this.duration;
      this.currentIndex++;

      if (this.currentIndex >= this.frames.length) {
        if (this.loop) {
          this.currentIndex = 0;
        } else {
          this.currentIndex = this.frames.length - 1;
          this.done = true;
          if (this.onComplete) this.onComplete();
          return;
        }
      }
    }
  }

  get currentFrame() {
    return this.frames[this.currentIndex];
  }

  draw(ctx, destX, destY, scale = 1) {
    const frame = this.currentFrame;
    ctx.drawImage(
      this.sheet,
      frame * this.frameW, 0,              // Source x, y
      this.frameW, this.frameH,             // Source w, h
      destX, destY,                         // Destination x, y
      this.frameW * scale, this.frameH * scale // Destination w, h
    );
  }
}
```

### Usage

```javascript
// Create animations for a character
const idleAnim = new SpriteAnimation({
  sheet: playerSheet,
  frames: [0, 1, 0, 2],       // 4-frame idle cycle
  duration: 0.15,             // 150ms per frame
  frameWidth: 32,
  frameHeight: 48,
  loop: true
});

const jumpAnim = new SpriteAnimation({
  sheet: playerSheet,
  frames: [3, 4, 5],
  duration: 0.1,
  frameWidth: 32,
  frameHeight: 48,
  loop: false,
  onComplete: () => { currentAnim = idleAnim; }
});

let currentAnim = idleAnim;

// In update():
currentAnim.update(dt);

// In render():
currentAnim.draw(ctx, player.x, player.y, 2);
```

### Animation State Machine

```javascript
const AnimState = {
  IDLE:   { anim: idleAnim },
  WALK:   { anim: walkAnim,  speedThreshold: 0.1 },
  JUMP:   { anim: jumpAnim },
  ATTACK: { anim: attackAnim, oneShot: true }
};

let animState = AnimState.IDLE;

function updateAnimation(dt, player) {
  // Determine which animation should play
  let next = AnimState.IDLE;
  if (Math.abs(player.vx) > AnimState.WALK.speedThreshold) next = AnimState.WALK;
  if (!player.grounded) next = AnimState.JUMP;

  // Transition if different
  if (next !== animState) {
    animState = next;
    animState.anim.reset();
  }

  animState.anim.update(dt);
}
```

---

## Scrolling Background

Creates the illusion of continuous movement by scrolling layered background images.

### Simple Horizontal Scroll

```javascript
class ScrollingBackground {
  constructor(image, speed, canvasWidth) {
    this.image = image;
    this.speed = speed;          // Pixels per second
    this.x = 0;
    this.canvasWidth = canvasWidth;
  }

  update(dt) {
    this.x -= this.speed * dt;
    // Wrap around
    if (this.x <= -this.canvasWidth) {
      this.x += this.canvasWidth;
    }
  }

  draw(ctx) {
    // Draw two copies side-by-side for seamless scrolling
    ctx.drawImage(this.image, this.x, 0);
    ctx.drawImage(this.image, this.x + this.canvasWidth, 0);
  }
}
```

### Parallax (Multi-Layer)

```javascript
class ParallaxBackground {
  constructor(layers, canvasWidth, canvasHeight) {
    // layers: [{ image, speed }, ...]
    this.layers = layers.map(l => ({
      image: l.image,
      speed: l.speed,
      x: 0,
      y: l.y || 0
    }));
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  update(dt) {
    for (const layer of this.layers) {
      layer.x -= layer.speed * dt;
      if (layer.x <= -this.canvasWidth) {
        layer.x += this.canvasWidth;
      }
    }
  }

  draw(ctx) {
    for (const layer of this.layers) {
      ctx.drawImage(layer.image, layer.x, layer.y);
      ctx.drawImage(layer.image, layer.x + this.canvasWidth, layer.y);
    }
  }
}

// Usage
const bg = new ParallaxBackground([
  { image: skyImg,    speed: 10  },  // Far: slow
  { image: mountainImg, speed: 30 }, // Mid: medium
  { image: treesImg,   speed: 60 },  // Near: fast
  { image: groundImg,  speed: 80, y: 500 }
], 800, 600);
```

### Infinite Vertical Scroll (Vertical Shooter)

```javascript
class VerticalScroller {
  constructor(image, speed) {
    this.image = image;
    this.speed = speed;
    this.y = 0;
  }

  update(dt) {
    this.y += this.speed * dt;
    if (this.y >= this.image.height) {
      this.y -= this.image.height;
    }
  }

  draw(ctx, canvasWidth, canvasHeight) {
    const imgH = this.image.height;
    // Draw the visible portion: two copies stacked
    ctx.drawImage(this.image, 0, 0, canvasWidth, imgH, 0, -this.y, canvasWidth, imgH);
    ctx.drawImage(this.image, 0, 0, canvasWidth, imgH, 0, imgH - this.y, canvasWidth, imgH);
  }
}
```

---

## Particle System

Lightweight emitter for visual effects: explosions, trails, fire, smoke, sparks.

### Simple Emitter

```javascript
class Particle {
  constructor() {
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.life = 0; this.maxLife = 0;
    this.size = 0;
    this.color = '#ffffff';
    this.alive = false;
  }
}

class ParticleEmitter {
  constructor(poolSize = 200) {
    this.pool = [];
    for (let i = 0; i < poolSize; i++) {
      this.pool.push(new Particle());
    }
    this.active = [];
  }

  emit(x, y, count, config) {
    for (let i = 0; i < count; i++) {
      const p = this.pool.pop();
      if (!p) break; // pool exhausted

      p.x = x + (Math.random() - 0.5) * (config.spread || 10);
      p.y = y + (Math.random() - 0.5) * (config.spread || 10);
      p.vx = (Math.random() - 0.5) * (config.speed || 100);
      p.vy = (Math.random() - 0.5) * (config.speed || 100) - (config.upward || 0);
      p.life = config.lifetime || 0.5;
      p.maxLife = p.life;
      p.size = config.size || 3;
      p.color = config.colors[Math.floor(Math.random() * config.colors.length)];
      p.alive = true;

      this.active.push(p);
    }
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt; // gravity
      p.life -= dt;

      if (p.life <= 0) {
        p.alive = false;
        this.active.splice(i, 1);
        this.pool.push(p);
      }
    }
  }

  draw(ctx) {
    for (const p of this.active) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.pool.push(...this.active);
    this.active.length = 0;
  }
}
```

### Usage Examples

```javascript
const emitter = new ParticleEmitter(300);

// Explosion effect
function explode(x, y) {
  emitter.emit(x, y, 40, {
    speed: 150,
    spread: 15,
    lifetime: 0.8,
    size: 4,
    colors: ['#ff4400', '#ff8800', '#ffcc00', '#ffffff'],
    upward: 0
  });
}

// Trail effect (call every frame)
function trail(x, y) {
  emitter.emit(x, y, 2, {
    speed: 20,
    spread: 5,
    lifetime: 0.3,
    size: 3,
    colors: ['#00aaff', '#0088ff'],
    upward: 30
  });
}

// In update():
emitter.update(dt);

// In render():
emitter.draw(ctx);
```

---

## Score / UI Management

Manages score display, high-score persistence, and HUD rendering.

### Score Manager

```javascript
class ScoreManager {
  constructor(storageKey = 'highscore') {
    this.score = 0;
    this.combo = 0;
    this.multiplier = 1;
    this.highScore = parseInt(localStorage.getItem(storageKey) || '0', 10);
    this.storageKey = storageKey;
  }

  add(points) {
    this.score += points * this.multiplier;
    this.combo++;

    // Scale multiplier with combo
    if (this.combo > 10)      this.multiplier = 4;
    else if (this.combo > 5)  this.multiplier = 3;
    else if (this.combo > 2)  this.multiplier = 2;
  }

  resetCombo() {
    this.combo = 0;
    this.multiplier = 1;
  }

  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem(this.storageKey, this.highScore.toString());
      return true; // new high score!
    }
    return false;
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.multiplier = 1;
  }
}
```

### HUD Renderer

```javascript
class HUD {
  constructor(canvas) {
    this.canvas = canvas;
    this.scoreManager = new ScoreManager();
  }

  draw(ctx, extraInfo = {}) {
    ctx.save();

    // Score (top-left)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`SCORE: ${this.scoreManager.score}`, 12, 12);

    // Combo (center)
    if (this.scoreManager.combo > 2) {
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`COMBO x${this.scoreManager.multiplier}`, this.canvas.width / 2, 12);
    }

    // High score (top-right)
    ctx.fillStyle = '#888888';
    ctx.font = '14px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`HI: ${this.scoreManager.highScore}`, this.canvas.width - 12, 14);

    // Extra info (e.g., lives, level, timer)
    if (extraInfo.lives !== undefined) {
      ctx.fillStyle = '#e74c3c';
      ctx.textAlign = 'left';
      ctx.font = '18px "Courier New", monospace';
      let hearts = '';
      for (let i = 0; i < extraInfo.lives; i++) hearts += '\u2665 ';
      ctx.fillText(hearts.trim(), 12, 38);
    }

    ctx.restore();
  }
}
```

### Usage in Game Loop

```javascript
const scoreManager = new ScoreManager();
const hud = new HUD(canvas);

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw game world...

  // Draw HUD on top
  hud.draw(ctx, { lives: player.lives });

  // Draw overlay screens on top of HUD
  if (gameState === State.GAME_OVER) {
    scoreManager.saveHighScore();
    drawGameOverOverlay(ctx);
  }
}
```
