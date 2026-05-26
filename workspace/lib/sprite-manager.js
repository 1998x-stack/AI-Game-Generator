/**
 * @fileoverview Sprite sheet management, animation playback, and a central
 * sprite manager for game rendering.
 *
 * @example
 * ```js
 * import { SpriteSheet, Animation, SpriteManager } from './sprite-manager.js';
 *
 * const sm = new SpriteManager();
 * await sm.load('player', '/images/player-sheet.png', 32, 48);
 *
 * const walk = new Animation(sm.get('player'), [0, 1, 2, 3], 0.1);
 *
 * function update(dt) {
 *   walk.update(dt);
 * }
 * function draw(ctx) {
 *   walk.draw(ctx, 100, 200);
 * }
 * ```
 */

// ---------------------------------------------------------------------------
// SpriteSheet
// ---------------------------------------------------------------------------

/**
 * Represents a sprite sheet loaded from an image URL with uniform frame sizes.
 *
 * Frames are indexed left-to-right, top-to-bottom starting from 0.
 *
 * @example
 * ```js
 * const sheet = new SpriteSheet('/images/hero.png', 32, 48);
 * await sheet.loaded; // resolves when image loads
 * sheet.drawFrame(ctx, 2, 100, 200); // draw frame index 2 at (100, 200)
 * ```
 */
export class SpriteSheet {
  /**
   * @param {string} imageSrc – Path or URL to the sprite sheet image.
   * @param {number} frameWidth – Width of each frame in pixels.
   * @param {number} frameHeight – Height of each frame in pixels.
   * @param {number} [margin=0] – Pixels between frames (uniform).
   */
  constructor(imageSrc, frameWidth, frameHeight, margin = 0) {
    /** @type {string} */
    this.src = imageSrc;
    /** @type {number} */
    this.frameWidth = frameWidth;
    /** @type {number} */
    this.frameHeight = frameHeight;
    /** @type {number} */
    this.margin = margin;

    /** @type {HTMLImageElement|null} */
    this.image = null;
    /** @type {number} */
    this.columns = 0;
    /** @type {number} */
    this.totalFrames = 0;

    /**
     * Promise that resolves when the sprite sheet has loaded.
     * @type {Promise<void>}
     */
    this.loaded = new Promise((resolve, reject) => {
      if (typeof Image === 'undefined') {
        reject(new Error('Image API not available (SSR?)'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        this.image = img;
        this.columns = Math.floor(img.width / (frameWidth + margin));
        const rows = Math.floor(img.height / (frameHeight + margin));
        this.totalFrames = this.columns * rows;
        resolve();
      };
      img.onerror = () => reject(new Error(`Failed to load sprite: ${imageSrc}`));
      img.src = imageSrc;
    });
  }

  /**
   * Draw a single frame from the sheet onto a canvas context.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} frameIndex – Zero-based frame index.
   * @param {number} x – Destination X.
   * @param {number} y – Destination Y.
   * @param {number} [scale=1] – Optional scale multiplier.
   */
  drawFrame(ctx, frameIndex, x, y, scale = 1) {
    if (!this.image) return;

    const col = frameIndex % this.columns;
    const row = Math.floor(frameIndex / this.columns);
    const sx = col * (this.frameWidth + this.margin);
    const sy = row * (this.frameHeight + this.margin);

    const sw = this.frameWidth;
    const sh = this.frameHeight;
    const dw = sw * scale;
    const dh = sh * scale;

    ctx.drawImage(this.image, sx, sy, sw, sh, x, y, dw, dh);
  }

  /**
   * Returns the number of frames in this sheet.
   * @returns {number}
   */
  get frameCount() {
    return this.totalFrames;
  }

  /**
   * Returns whether the image has loaded.
   * @returns {boolean}
   */
  get isLoaded() {
    return this.image !== null && this.image.complete;
  }
}

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

/**
 * Plays a sequence of frames from a {@link SpriteSheet}.
 *
 * Supports looping, ping-pong mode, and per-frame duration.
 *
 * @example
 * ```js
 * const anim = new Animation(playerSheet, [0, 1, 2, 3, 4, 5], 0.1);
 * anim.loop = true;
 *
 * // in update():
 * anim.update(dt);
 *
 * // in render():
 * anim.draw(ctx, x, y, 2); // 2x scale
 * ```
 */
export class Animation {
  /**
   * @param {SpriteSheet} spriteSheet
   * @param {number[]} frames – Ordered array of frame indices.
   * @param {number} [frameDuration=0.1] – Seconds per frame.
   */
  constructor(spriteSheet, frames, frameDuration = 0.1) {
    /** @type {SpriteSheet} */
    this.spriteSheet = spriteSheet;
    /** @type {number[]} */
    this.frames = frames;
    /** @type {number} */
    this.frameDuration = frameDuration;

    /** Whether the animation loops back to the start when finished. @type {boolean} */
    this.loop = true;
    /**
     * If true, animation plays forward then backward (requires loop=true).
     * @type {boolean}
     */
    this.pingPong = false;

    /** @type {number} Current frame index in the frames array. */
    this.currentFrame = 0;
    /** @type {number} Time accumulator for the current frame. */
    this.elapsed = 0;
    /** @type {boolean} */
    this._finished = false;
    /** @type {number} Direction of playback (1 = forward, -1 = backward). */
    this._direction = 1;
  }

  /**
   * Advance the animation by `dt` seconds.
   *
   * @param {number} dt – Delta time in seconds.
   */
  update(dt) {
    if (this._finished) return;

    this.elapsed += dt;

    while (this.elapsed >= this.frameDuration) {
      this.elapsed -= this.frameDuration;
      this.currentFrame += this._direction;

      // Reached end of sequence
      if (this.currentFrame >= this.frames.length) {
        if (this.pingPong) {
          this.currentFrame = this.frames.length - 2;
          this._direction = -1;
        } else if (this.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = this.frames.length - 1;
          this._finished = true;
          return;
        }
      }

      // Reached start (ping-pong reverse)
      if (this.currentFrame < 0) {
        this.currentFrame = 1;
        this._direction = 1;
      }
    }
  }

  /**
   * Draw the current animation frame.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} [scale=1]
   */
  draw(ctx, x, y, scale = 1) {
    const frameIndex = this.frames[this.currentFrame];
    this.spriteSheet.drawFrame(ctx, frameIndex, x, y, scale);
  }

  /** Reset the animation to the first frame. */
  reset() {
    this.currentFrame = 0;
    this.elapsed = 0;
    this._finished = false;
    this._direction = 1;
  }

  /**
   * Returns `true` if a non-looping animation has finished playing.
   * @returns {boolean}
   */
  get isFinished() {
    return this._finished;
  }
}

// ---------------------------------------------------------------------------
// SpriteManager
// ---------------------------------------------------------------------------

/**
 * Central registry for named sprite sheets and active animations.
 *
 * Manages loading, retrieval, batch updates, and drawing of animations.
 *
 * @example
 * ```js
 * const sm = new SpriteManager();
 * await sm.load('hero', '/images/hero-sheet.png', 32, 48);
 *
 * // Play an animation on the manager
 * sm.play('hero-walk', sm.get('hero'), [0, 1, 2, 3], 0.1, 100, 200);
 *
 * // In update loop:
 * sm.update(dt);
 * sm.drawAll(ctx);
 * ```
 */
export class SpriteManager {
  constructor() {
    /**
     * Loaded sprite sheets keyed by name.
     * @type {Map<string, SpriteSheet>}
     */
    this._sheets = new Map();

    /**
     * Active animations keyed by name.
     * @type {Map<string, Animation>}
     */
    this._animations = new Map();

    /**
     * Per-animation draw position.
     * @type {Map<string, { x: number, y: number, scale: number }>}
     */
    this._positions = new Map();
  }

  /**
   * Load a sprite sheet and register it by name.
   *
   * @param {string} name – Registry key.
   * @param {string} src – Image path/URL.
   * @param {number} frameWidth
   * @param {number} frameHeight
   * @param {number} [margin=0]
   * @returns {Promise<void>} Resolves when the sheet image loads.
   */
  async load(name, src, frameWidth, frameHeight, margin = 0) {
    const sheet = new SpriteSheet(src, frameWidth, frameHeight, margin);
    await sheet.loaded;
    this._sheets.set(name, sheet);
  }

  /**
   * Register an already-constructed sprite sheet.
   *
   * @param {string} name
   * @param {SpriteSheet} sheet
   */
  add(name, sheet) {
    this._sheets.set(name, sheet);
  }

  /**
   * Retrieve a previously loaded sprite sheet.
   *
   * @param {string} name
   * @returns {SpriteSheet|undefined}
   */
  get(name) {
    return this._sheets.get(name);
  }

  /**
   * Create and register an active animation.
   *
   * @param {string} name – Unique animation name.
   * @param {SpriteSheet} spriteSheet
   * @param {number[]} frames – Frame index sequence.
   * @param {number} frameDuration – Seconds per frame.
   * @param {number} x – Draw X position.
   * @param {number} y – Draw Y position.
   * @param {number} [scale=1]
   * @param {{ loop?: boolean, pingPong?: boolean }} [opts]
   * @returns {Animation}
   */
  play(name, spriteSheet, frames, frameDuration, x, y, scale = 1, opts = {}) {
    const anim = new Animation(spriteSheet, frames, frameDuration);
    if (opts.loop !== undefined) anim.loop = opts.loop;
    if (opts.pingPong !== undefined) anim.pingPong = opts.pingPong;

    this._animations.set(name, anim);
    this._positions.set(name, { x, y, scale });

    return anim;
  }

  /**
   * Advance all active animations by `dt` seconds.
   *
   * @param {number} dt – Delta time in seconds.
   */
  update(dt) {
    for (const [name, anim] of this._animations) {
      anim.update(dt);

      // Auto-remove finished one-shot animations
      if (anim.isFinished) {
        this._animations.delete(name);
        this._positions.delete(name);
      }
    }
  }

  /**
   * Draw all active animations at their registered positions.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  drawAll(ctx) {
    for (const [name, anim] of this._animations) {
      const pos = this._positions.get(name);
      if (pos) {
        anim.draw(ctx, pos.x, pos.y, pos.scale);
      }
    }
  }

  /**
   * Update a single animation's draw position at runtime.
   *
   * @param {string} name
   * @param {number} x
   * @param {number} y
   */
  setPosition(name, x, y) {
    const pos = this._positions.get(name);
    if (pos) {
      pos.x = x;
      pos.y = y;
    }
  }

  /**
   * Check if an animation is currently active.
   *
   * @param {string} name
   * @returns {boolean}
   */
  isPlaying(name) {
    return this._animations.has(name);
  }

  /**
   * Stop and remove an animation.
   *
   * @param {string} name
   */
  stop(name) {
    this._animations.delete(name);
    this._positions.delete(name);
  }

  /**
   * Remove all animations (keep loaded sprite sheets).
   */
  stopAll() {
    this._animations.clear();
    this._positions.clear();
  }
}
