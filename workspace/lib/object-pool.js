/**
 * @fileoverview Generic object pool for reusing objects and reducing GC pressure.
 *
 * Useful for frequently created/destroyed objects such as bullets, particles,
 * enemies, or UI notifications.
 *
 * @example
 * ```js
 * import { ObjectPool } from './object-pool.js';
 *
 * const bulletPool = new ObjectPool(
 *   () => ({ x: 0, y: 0, vx: 0, vy: 0, alive: false }),
 *   (b) => { b.alive = false; }
 * );
 *
 * // Fire a bullet
 * const b = bulletPool.acquire();
 * b.x = player.x; b.y = player.y; b.vx = 5; b.vy = 0; b.alive = true;
 *
 * // Recycle when off-screen
 * bulletPool.release(b);
 * ```
 */

/**
 * A generic, type-safe object pool that minimises allocations by reusing
 * objects.
 *
 * ## Lifecycle
 * 1. `acquire()` returns an object from the pool or creates a new one.
 * 2. Use the object.
 * 3. `release(obj)` resets it via `resetFn` and returns it to the pool.
 *
 * @template T
 */
export class ObjectPool {
  /**
   * @param {() => T} factory – Creates a new instance of T.
   * @param {(obj: T) => void} [reset] – Optional reset function called on
   *   release (and also on initial allocation if provided).
   * @param {number} [initialSize=10] – Number of objects to pre-allocate.
   */
  constructor(factory, reset, initialSize = 10) {
    /** @type {() => T} */
    this._factory = factory;

    /**
     * Reset function. Applied on release and optionally at allocation
     * time so pre-allocated objects start clean.
     * @type {(obj: T) => void}
     */
    this._reset = reset || (() => {});

    /**
     * Available (inactive) objects.
     * @type {T[]}
     */
    this._pool = [];

    /**
     * Total objects ever created (for stats).
     * @type {number}
     */
    this._totalCreated = 0;

    // Pre-allocate
    for (let i = 0; i < initialSize; i++) {
      const obj = this._factory();
      this._reset(obj);
      this._pool.push(obj);
      this._totalCreated++;
    }
  }

  /**
   * Retrieve an object from the pool (or create one if empty).
   *
   * The caller should treat the returned object as ready to use — the
   * reset function was applied when the object was released.
   *
   * @returns {T}
   */
  acquire() {
    if (this._pool.length > 0) {
      return this._pool.pop();
    }

    // Pool exhausted — create new
    this._totalCreated++;
    return this._factory();
  }

  /**
   * Return an object to the pool. The reset function is applied.
   *
   * It is safe to call this multiple times on the same object (the pool
   * doesn't guard against duplicates — avoid releasing the same object
   * twice).
   *
   * @param {T} obj
   */
  release(obj) {
    this._reset(obj);
    this._pool.push(obj);
  }

  /**
   * Pre-warm the pool with additional objects.
   *
   * @param {number} count – Number of objects to add.
   */
  grow(count) {
    for (let i = 0; i < count; i++) {
      const obj = this._factory();
      this._reset(obj);
      this._pool.push(obj);
      this._totalCreated++;
    }
  }

  /**
   * Drain and release all objects currently tracked as "active".
   * You provide the collection — the pool calls release on each element.
   *
   * @param {T[]} activeObjects – Array of objects currently in-use.
   */
  releaseAll(activeObjects) {
    for (let i = 0; i < activeObjects.length; i++) {
      this.release(activeObjects[i]);
    }
  }

  /**
   * Number of objects available for immediate acquisition.
   * @returns {number}
   */
  get available() {
    return this._pool.length;
  }

  /**
   * Total objects allocated since creation.
   * @returns {number}
   */
  get totalCreated() {
    return this._totalCreated;
  }
}
