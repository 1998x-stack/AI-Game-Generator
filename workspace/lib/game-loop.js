/**
 * @fileoverview Game loop utilities providing variable and fixed timestep loops
 * with FPS counter, pause/resume, and delta time capping.
 */

/**
 * Creates a variable timestep game loop with delta time capping.
 *
 * The loop calls {@link update} with a delta time in seconds, then calls
 * {@link render}. Delta time is capped at 50ms to prevent physics explosions
 * on frame hitches.
 *
 * @example
 * ```js
 * const loop = createGameLoop(
 *   (dt) => { player.update(dt); },
 *   ()   => { renderer.draw(); }
 * );
 * loop.start();
 * ```
 *
 * @param {(dt: number) => void} update – Called each frame with delta time in seconds.
 * @param {() => void} render – Called each frame after update.
 * @returns {GameLoop} The game loop controller.
 */
export function createGameLoop(update, render) {
  /** @type {number} */
  let lastTime = 0;
  /** @type {boolean} */
  let running = false;
  /** @type {number|null} */
  let animFrameId = null;
  /** @type {boolean} */
  let paused = false;
  /** @type {number} */
  let frameCount = 0;
  /** @type {number} */
  let fpsAccum = 0;
  /** @type {number} */
  let currentFps = 0;

  /**
   * @param {number} timestamp – High-resolution timestamp from rAF.
   */
  function loop(timestamp) {
    if (!running) return;
    if (paused) {
      lastTime = timestamp;
      animFrameId = requestAnimationFrame(loop);
      return;
    }

    const rawDt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // Cap delta time to avoid spiral-of-death on tab-away
    const dt = Math.min(rawDt, 0.05);

    // FPS counter update
    frameCount++;
    fpsAccum += rawDt;
    if (fpsAccum >= 1) {
      currentFps = Math.round(frameCount / fpsAccum);
      frameCount = 0;
      fpsAccum = 0;
    }

    update(dt);
    render();

    animFrameId = requestAnimationFrame(loop);
  }

  return /** @type {GameLoop} */ ({
    /** Start (or resume) the loop. Idempotent. */
    start() {
      if (running) return;
      running = true;
      paused = false;
      lastTime = performance.now();
      animFrameId = requestAnimationFrame(loop);
    },

    /** Pause the loop. Update/render will not be called. */
    pause() {
      paused = true;
    },

    /** Resume from pause. */
    resume() {
      paused = false;
    },

    /** Stop the loop entirely. Must call start() to restart. */
    stop() {
      running = false;
      paused = false;
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    },

    /** @returns {boolean} Whether the loop is currently running. */
    get isRunning() { return running; },

    /** @returns {boolean} Whether the loop is currently paused. */
    get isPaused() { return paused; },

    /** @returns {number} Current frames-per-second (updated once per second). */
    get fps() { return currentFps; },
  });
}

/**
 * Creates a **fixed timestep** game loop using the accumulator pattern.
 *
 * Physics/accretion updates run at {@link fixedDt} intervals (default 1/60s),
 * while rendering happens every frame at the display refresh rate. This
 * decouples simulation stability from frame rate.
 *
 * @example
 * ```js
 * const loop = createFixedTimestepLoop(
 *   (dt)   => { physicsWorld.step(dt); }, // runs at 60 Hz
 *   (alpha) => { renderer.interpolate(alpha); } // runs at display Hz
 * );
 * loop.start();
 * ```
 *
 * @param {(fixedDt: number) => void} fixedUpdate – Called 0..N times per frame
 *   at the fixed timestep (for physics, logic, networking).
 * @param {(alpha: number) => void} render – Called once per frame.
 *   `alpha` (0..1) is the interpolation factor between the last two fixed steps,
 *   useful for smooth rendering.
 * @param {number} [fixedDt=1/60] – The fixed timestep in seconds.
 * @returns {FixedTimestepLoop} The game loop controller.
 */
export function createFixedTimestepLoop(fixedUpdate, render, fixedDt = 1 / 60) {
  /** @type {number} */
  let lastTime = 0;
  /** @type {number} */
  let accumulator = 0;
  /** @type {boolean} */
  let running = false;
  /** @type {number|null} */
  let animFrameId = null;
  /** @type {boolean} */
  let paused = false;
  /** @type {number} */
  let frameCount = 0;
  /** @type {number} */
  let fpsAccum = 0;
  /** @type {number} */
  let currentFps = 0;

  /**
   * Maximum accumulated time to prevent spiral-of-death.
   * Equivalent to 8 fixed steps.
   */
  const MAX_ACCUMULATOR = fixedDt * 8;

  /**
   * @param {number} timestamp – High-resolution timestamp from rAF.
   */
  function loop(timestamp) {
    if (!running) return;
    if (paused) {
      lastTime = timestamp;
      animFrameId = requestAnimationFrame(loop);
      return;
    }

    const rawDt = Math.min((timestamp - lastTime) / 1000, MAX_ACCUMULATOR);
    lastTime = timestamp;

    // FPS counter
    frameCount++;
    fpsAccum += rawDt;
    if (fpsAccum >= 1) {
      currentFps = Math.round(frameCount / fpsAccum);
      frameCount = 0;
      fpsAccum = 0;
    }

    accumulator += rawDt;

    // Consume fixed steps
    let stepped = false;
    while (accumulator >= fixedDt) {
      fixedUpdate(fixedDt);
      accumulator -= fixedDt;
      stepped = true;
    }

    // Interpolation alpha for render smoothing
    const alpha = stepped ? accumulator / fixedDt : 0;
    render(alpha);

    animFrameId = requestAnimationFrame(loop);
  }

  return /** @type {FixedTimestepLoop} */ ({
    start() {
      if (running) return;
      running = true;
      paused = false;
      lastTime = performance.now();
      accumulator = 0;
      animFrameId = requestAnimationFrame(loop);
    },

    pause() {
      paused = true;
    },

    resume() {
      paused = false;
    },

    stop() {
      running = false;
      paused = false;
      accumulator = 0;
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    },

    get isRunning() { return running; },
    get isPaused() { return paused; },
    get fps() { return currentFps; },
  });
}

/**
 * @typedef {Object} GameLoop
 * @property {() => void} start - Start or resume the variable-timestep loop.
 * @property {() => void} pause - Pause the loop (freezes delta time).
 * @property {() => void} resume - Resume from pause.
 * @property {() => void} stop - Stop and release the loop.
 * @property {boolean} isRunning - Whether the loop is active.
 * @property {boolean} isPaused - Whether the loop is paused.
 * @property {number} fps - Smoothed frames-per-second reading.
 */

/**
 * @typedef {Object} FixedTimestepLoop
 * @property {() => void} start - Start the fixed-timestep loop.
 * @property {() => void} pause - Pause the loop.
 * @property {() => void} resume - Resume from pause.
 * @property {() => void} stop - Stop and release the loop.
 * @property {boolean} isRunning - Whether the loop is active.
 * @property {boolean} isPaused - Whether the loop is paused.
 * @property {number} fps - Smoothed frames-per-second reading.
 */
