/**
 * @fileoverview Input managers for keyboard, touch, and gamepad.
 *
 * Provides:
 * - `createInputManager()` – Keyboard state with just-pressed detection.
 * - `createTouchManager(canvas)` – Multi-touch with double-tap and long-press.
 * - `GamepadManager` – Polling-based gamepad state.
 * - `InputBuffer` – Queue-based input recording (fighting-game style).
 *
 * @example
 * ```js
 * const kb = createInputManager();
 * const touch = createTouchManager(canvas);
 * const gp = new GamepadManager();
 *
 * function update() {
 *   if (kb.isDown('ArrowRight')) moveRight();
 *   gp.poll(); // sync gamepad state
 * }
 * ```
 */

// ---------------------------------------------------------------------------
// Keyboard Input Manager
// ---------------------------------------------------------------------------

/**
 * Creates a keyboard input manager with `isDown` and `wasPressed` support.
 *
 * `wasPressed(key)` returns `true` once per key press (the frame the key
 * transitions from up to down). Subsequent calls return `false` until the
 * next press.
 *
 * @example
 * ```js
 * const input = createInputManager();
 * if (input.wasPressed(' ')) { jump(); }
 * ```
 *
 * @returns {KeyboardInput} Keyboard controller.
 */
export function createInputManager() {
  /** @type {Record<string, boolean>} */
  const keys = {};
  /** @type {Record<string, boolean>} */
  const justPressed = {};

  /**
   * @param {KeyboardEvent} e
   */
  function onKeyDown(e) {
    if (!keys[e.key]) {
      justPressed[e.key] = true;
    }
    keys[e.key] = true;
  }

  /**
   * @param {KeyboardEvent} e
   */
  function onKeyUp(e) {
    keys[e.key] = false;
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  return /** @type {KeyboardInput} */ ({
    /**
     * Check if a key is currently held down.
     * @param {string} key – e.g. `'ArrowRight'`, `'a'`, `' '`.
     * @returns {boolean}
     */
    isDown(key) {
      return !!keys[key];
    },

    /**
     * Check if a key was just pressed (fire once per press).
     * @param {string} key
     * @returns {boolean}
     */
    wasPressed(key) {
      if (justPressed[key]) {
        justPressed[key] = false;
        return true;
      }
      return false;
    },

    /** Clear all key states. */
    reset() {
      for (const key in keys) {
        keys[key] = false;
      }
    },

    /** Remove event listeners. Call on unmount. */
    destroy() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
      }
    },
  });
}

/**
 * @typedef {Object} KeyboardInput
 * @property {(key: string) => boolean} isDown
 * @property {(key: string) => boolean} wasPressed
 * @property {() => void} reset
 * @property {() => void} destroy
 */

// ---------------------------------------------------------------------------
// Touch Input Manager
// ---------------------------------------------------------------------------

/**
 * Creates a touch input manager for a given canvas element.
 *
 * Provides active touch tracking, double-tap detection (default 300ms window),
 * and long-press detection (default 500ms hold).
 *
 * @example
 * ```js
 * const touch = createTouchManager(canvas);
 * // in update():
 * for (const t of touch.getTouches()) {
 *   drawCircle(t.x, t.y);
 * }
 * if (touch.wasDoubleTap()) { /* zoom *\/ }
 * if (touch.wasLongPress()) { /* context menu *\/ }
 * ```
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} [doubleTapMs=300] – Max ms between taps to count as double.
 * @param {number} [longPressMs=500] – Min ms to hold for long-press.
 * @returns {TouchInput} Touch controller.
 */
export function createTouchManager(canvas, doubleTapMs = 300, longPressMs = 500) {
  /** @type {Array<TouchPoint>} */
  const touches = [];

  /** @type {number|null} */
  let lastTapTime = null;
  /** @type {boolean} */
  let doubleTapFlag = false;

  /** @type {Map<number, number>} – Maps touch ID to start timestamp. */
  const touchStartTimes = new Map();
  /** @type {Set<number>} – Touch IDs that triggered a long-press. */
  const longPressFired = new Set();
  /** @type {boolean} */
  let longPressFlag = false;

  /**
   * @param {TouchEvent} e
   */
  function onTouchStart(e) {
    e.preventDefault();
    const now = performance.now();

    for (const raw of e.changedTouches) {
      const rect = canvas.getBoundingClientRect();
      const touch = {
        id: raw.identifier,
        x: raw.clientX - rect.left,
        y: raw.clientY - rect.top,
        active: true,
      };
      touches.push(touch);
      touchStartTimes.set(raw.identifier, now);
    }

    // Double-tap detection
    if (lastTapTime !== null && now - lastTapTime < doubleTapMs) {
      doubleTapFlag = true;
    }
    lastTapTime = now;
  }

  /**
   * @param {TouchEvent} e
   */
  function onTouchMove(e) {
    e.preventDefault();
    for (const raw of e.changedTouches) {
      const existing = touches.find((t) => t.id === raw.identifier);
      if (existing) {
        const rect = canvas.getBoundingClientRect();
        existing.x = raw.clientX - rect.left;
        existing.y = raw.clientY - rect.top;
      }
    }
  }

  /**
   * @param {TouchEvent} e
   */
  function onTouchEnd(e) {
    const now = performance.now();

    for (const raw of e.changedTouches) {
      const idx = touches.findIndex((t) => t.id === raw.identifier);
      if (idx >= 0) touches.splice(idx, 1);

      // Long-press detection: check if held long enough
      const startTime = touchStartTimes.get(raw.identifier);
      if (startTime !== undefined && now - startTime >= longPressMs) {
        longPressFlag = true;
      }

      touchStartTimes.delete(raw.identifier);
      longPressFired.delete(raw.identifier);
    }
  }

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);

  return /** @type {TouchInput} */ ({
    /** @returns {Array<TouchPoint>} Active touches. */
    getTouches() {
      return touches;
    },

    /**
     * Check if a double-tap occurred since last check.
     * Fire-once semantics (like `wasPressed`).
     * @returns {boolean}
     */
    wasDoubleTap() {
      if (doubleTapFlag) {
        doubleTapFlag = false;
        return true;
      }
      return false;
    },

    /**
     * Check if a long-press occurred since last check.
     * Fire-once semantics.
     * @returns {boolean}
     */
    wasLongPress() {
      if (longPressFlag) {
        longPressFlag = false;
        return true;
      }
      return false;
    },

    /** Remove event listeners. */
    destroy() {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    },
  });
}

/**
 * @typedef {Object} TouchPoint
 * @property {number} id
 * @property {number} x
 * @property {number} y
 * @property {boolean} active
 */

/**
 * @typedef {Object} TouchInput
 * @property {() => Array<TouchPoint>} getTouches
 * @property {() => boolean} wasDoubleTap
 * @property {() => boolean} wasLongPress
 * @property {() => void} destroy
 */

// ---------------------------------------------------------------------------
// Gamepad Manager
// ---------------------------------------------------------------------------

/**
 * Polling-based gamepad manager. Supports up to 4 connected gamepads.
 *
 * Call {@link GamepadManager#poll} once per frame (typically in your update
 * loop) to synchronise button and axis state. Provides `isDown`, `wasPressed`,
 * and `axis` accessors.
 *
 * Buttons are referenced by index (0..15). Standard mapping:
 * - 0: A, 1: B, 2: X, 3: Y
 * - 4: LB, 5: RB, 6: LT, 7: RT
 * - 8: Select, 9: Start, 10: LS, 11: RS
 * - 12: D-pad up, 13: D-pad down, 14: D-pad left, 15: D-pad right
 *
 * @example
 * ```js
 * const gp = new GamepadManager();
 * // in update():
 * gp.poll();
 * if (gp.isDown(0, 0)) { /* player 1 pressed A *\/ }
 * const dx = gp.getAxis(0, 0); // left stick X of player 1
 * ```
 */
export class GamepadManager {
  constructor() {
    /**
     * Previous frame button state per gamepad index.
     * @type {Map<number, Array<boolean>>}
     */
    this._prevState = new Map();
  }

  /**
   * Synchronise internal state with the Gamepad API. Call once per frame.
   * Detects newly connected gamepads automatically.
   */
  poll() {
    const gamepads = this._getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp) continue;

      const prev = this._prevState.get(i) || [];
      const curr = [];

      for (let b = 0; b < gp.buttons.length; b++) {
        curr[b] = gp.buttons[b].pressed;
      }

      this._prevState.set(i, curr);
    }
  }

  /**
   * Check if a button is currently held.
   * @param {number} player – Gamepad index (0..3).
   * @param {number} button – Button index.
   * @returns {boolean}
   */
  isDown(player, button) {
    const state = this._prevState.get(player);
    return state ? !!state[button] : false;
  }

  /**
   * Check if a button was just pressed (fire-once).
   * @param {number} player
   * @param {number} button
   * @returns {boolean}
   */
  wasPressed(player, button) {
    const gamepads = this._getGamepads();
    const gp = gamepads[player];
    if (!gp) return false;

    const prev = this._prevState.get(player) || [];
    const curr = gp.buttons[button]?.pressed ?? false;
    return curr && !prev[button];
  }

  /**
   * Get an analog axis value (-1..1).
   * @param {number} player – Gamepad index.
   * @param {number} axis – Axis index (0 = left X, 1 = left Y, 2 = right X, 3 = right Y).
   * @returns {number}
   */
  getAxis(player, axis) {
    const gamepads = this._getGamepads();
    const gp = gamepads[player];
    if (!gp || gp.axes[axis] === undefined) return 0;
    return gp.axes[axis];
  }

  /**
   * Returns the deadzone-adjusted axis value. Values below `deadzone`
   * snap to 0, and remaining range is re-mapped to 0..1 so small movements
   * aren't lost entirely.
   *
   * @param {number} player
   * @param {number} axis
   * @param {number} [deadzone=0.15]
   * @returns {number}
   */
  getAxisWithDeadzone(player, axis, deadzone = 0.15) {
    const raw = this.getAxis(player, axis);
    const abs = Math.abs(raw);
    if (abs < deadzone) return 0;
    // Re-map remaining range
    return Math.sign(raw) * ((abs - deadzone) / (1 - deadzone));
  }

  /**
   * @returns {number} Number of connected gamepads.
   */
  get connectedCount() {
    return this._getGamepads().filter(Boolean).length;
  }

  /**
   * Safe getter for `navigator.getGamepads`.
   * @returns {Array<Gamepad|null>}
   */
  _getGamepads() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    return /** @type {Array<Gamepad|null>} */ (navigator.getGamepads());
  }
}

// ---------------------------------------------------------------------------
// Input Buffer (Queue)
// ---------------------------------------------------------------------------

/**
 * A time-stamped input buffer useful for fighting-game-style input sequences,
 * command queues, or replay recording.
 *
 * Each entry is an object `{ input: T, time: number }` where `time` is
 * relative to the buffer's internal clock. You advance the clock by calling
 * {@link InputBuffer#update}.
 *
 * @template T
 * @example
 * ```js
 * const buf = new InputBuffer(500); // 500ms window
 * const inputs = { left: false, right: false, punch: false };
 *
 * // Record inputs each frame
 * buf.push({ ...inputs });
 * buf.update(16); // advance 16ms
 *
 * // Consume a sequence
 * const hadCombo = buf.consume((entry) => entry.punch && entry.right);
 * ```
 */
export class InputBuffer {
  /**
   * @param {number} [maxAgeMs=1000] – Entries older than this are pruned.
   * @param {number} [maxLength=120] – Hard cap on queue length.
   */
  constructor(maxAgeMs = 1000, maxLength = 120) {
    /** @type {Array<{ input: T, time: number }>} */
    this._queue = [];
    this._maxAgeMs = maxAgeMs;
    this._maxLength = maxLength;
    /** @type {number} Internal clock in ms. */
    this._now = 0;
  }

  /**
   * Advance the internal clock by `dt` ms and prune expired entries.
   * Call once per frame.
   *
   * @param {number} dtMs – Delta time in milliseconds.
   */
  update(dtMs) {
    this._now += dtMs;
    this._prune();
  }

  /**
   * Record an input snapshot at the current time.
   *
   * @param {T} input
   */
  push(input) {
    this._queue.push({ input, time: this._now });
    if (this._queue.length > this._maxLength) {
      this._queue.shift();
    }
  }

  /**
   * Reset the buffer.
   */
  clear() {
    this._queue.length = 0;
    this._now = 0;
  }

  /**
   * Remove and return the oldest entry that matches `predicate`.
   *
   * Useful for consuming a specific gesture or command from the buffer.
   *
   * @param {(entry: { input: T, time: number }) => boolean} predicate
   * @returns {T | undefined}
   */
  consume(predicate) {
    const idx = this._queue.findIndex(predicate);
    if (idx >= 0) {
      const [removed] = this._queue.splice(idx, 1);
      return removed.input;
    }
    return undefined;
  }

  /**
   * Search the buffer without removing.
   *
   * @param {(entry: { input: T, time: number }) => boolean} predicate
   * @returns {T | undefined}
   */
  find(predicate) {
    const entry = this._queue.find(predicate);
    return entry ? entry.input : undefined;
  }

  /**
   * Check if a sequence of predicates exists in order within `windowMs`.
   * Each predicate must find a matching entry **after** the previous match.
   *
   * @param {Array<(input: T) => boolean>} sequence – Ordered list of matchers.
   * @param {number} [windowMs=500] – Max total time for the sequence.
   * @returns {boolean}
   */
  matchSequence(sequence, windowMs = 500) {
    if (sequence.length === 0) return false;

    let matchIdx = 0;
    let startTime = this._now;

    for (const entry of this._queue) {
      if (this._now - entry.time > this._maxAgeMs) continue;

      if (matchIdx === 0) {
        startTime = entry.time;
      }

      if (sequence[matchIdx](entry.input)) {
        matchIdx++;
        if (matchIdx >= sequence.length) {
          return (entry.time - startTime) <= windowMs;
        }
      }
    }

    return false;
  }

  /** @returns {number} Current number of buffered entries. */
  get length() {
    return this._queue.length;
  }

  /** Remove entries older than maxAge. */
  _prune() {
    const cutoff = this._now - this._maxAgeMs;
    while (this._queue.length > 0 && this._queue[0].time < cutoff) {
      this._queue.shift();
    }
  }
}
