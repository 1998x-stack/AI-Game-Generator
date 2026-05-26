/**
 * @fileoverview Web Audio API-based sound manager for games.
 *
 * Provides:
 * - Lazy `AudioContext` creation (must be triggered by user gesture).
 * - Buffer loading (fetch → decode → cache).
 * - Playback with volume, loop, and playbackRate controls.
 * - Per-sound volume without affecting other sounds.
 *
 * @example
 * ```js
 * const sound = new SoundManager();
 *
 * // Must happen inside a click/touch handler (browser policy)
 * button.addEventListener('click', async () => {
 *   await sound.load('shoot', '/sfx/shoot.wav');
 *   sound.play('shoot', { volume: 0.5, loop: false });
 * });
 * ```
 */

/**
 * Manages loading and playing sound effects and music via the Web Audio API.
 *
 * ## AudioContext Autoplay Policy
 * Browsers require an AudioContext to be created/resumed from a user gesture.
 * {@link SoundManager} creates the context on the first call to
 * {@link SoundManager#play} or {@link SoundManager#play} (not at
 * construction), and will attempt a resume if the context is suspended.
 * Wrap your first `play()` call in a click/touch handler.
 */
export class SoundManager {
  constructor() {
    /** @type {AudioContext|null} */
    this._ctx = null;

    /**
     * Decoded audio buffers keyed by name.
     * @type {Map<string, AudioBuffer>}
     */
    this._buffers = new Map();

    /**
     * Currently active playback nodes keyed by name.
     * @type {Map<string, Array<{ source: AudioBufferSourceNode, gain: GainNode }>>}
     */
    this._active = new Map();

    /**
     * Per-sound volume overrides (0..1). If not set, uses `defaultVolume`.
     * @type {Map<string, number>}
     */
    this._volumes = new Map();

    /** @type {number} Global default volume (0..1). */
    this.defaultVolume = 1;

    /** @type {boolean} Whether the AudioContext has been initialised. */
    this._initialised = false;
  }

  /**
   * Ensure the AudioContext is created and running.
   * Safe to call multiple times.
   *
   * @returns {Promise<void>}
   */
  async _ensureContext() {
    if (!this._ctx) {
      const Ctor =
        window.AudioContext ||
        /** @type {any} */ (window).webkitAudioContext;
      if (!Ctor) {
        throw new Error('Web Audio API not supported in this browser');
      }
      this._ctx = new Ctor();
    }

    if (this._ctx.state === 'suspended') {
      await this._ctx.resume();
    }

    this._initialised = true;
  }

  /**
   * Fetch and decode an audio file, caching the buffer.
   *
   * @param {string} name – Logical name (used for playback).
   * @param {string} url – Path/URL to the audio file.
   * @returns {Promise<void>}
   */
  async load(name, url) {
    await this._ensureContext();

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio "${url}": ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this._ctx.decodeAudioData(arrayBuffer);

    this._buffers.set(name, audioBuffer);
  }

  /**
   * Play a loaded sound.
   *
   * @param {string} name – The name used in {@link load}.
   * @param {Object} [options]
   * @param {number} [options.volume] – Per-play volume (0..1).
   *   Falls back to per-sound volume (setVolume) then global defaultVolume.
   * @param {boolean} [options.loop=false]
   * @param {number} [options.playbackRate=1]
   * @param {number} [options.detune=0] – Detune in cents (±1200 = ±1 octave).
   * @returns {Promise<{ stop: () => void } | null>} A handle to stop the sound,
   *   or `null` if the buffer wasn't found.
   */
  async play(name, options = {}) {
    await this._ensureContext();

    const buffer = this._buffers.get(name);
    if (!buffer) {
      console.warn(`[SoundManager] No buffer loaded for "${name}"`);
      return null;
    }

    const ctx = /** @type {AudioContext} */ (this._ctx);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();

    source.buffer = buffer;
    source.loop = options.loop ?? false;
    source.playbackRate.value = options.playbackRate ?? 1;
    if (options.detune) source.detune.value = options.detune;

    // Resolve effective volume: per-play > per-sound > default
    const effectiveVolume =
      options.volume ?? this._volumes.get(name) ?? this.defaultVolume;
    gain.gain.value = effectiveVolume;

    source.connect(gain);
    gain.connect(ctx.destination);

    source.start(0);

    // Track active instances
    if (!this._active.has(name)) {
      this._active.set(name, []);
    }
    const entry = { source, gain };
    this._active.get(name).push(entry);

    // Auto-remove from active list when playback ends
    source.onended = () => {
      const list = this._active.get(name);
      if (list) {
        const idx = list.indexOf(entry);
        if (idx >= 0) list.splice(idx, 1);
      }
    };

    return {
      /** Stop this specific playback instance immediately. */
      stop: () => {
        try { source.stop(); } catch (_) { /* already stopped */ }
      },
    };
  }

  /**
   * Stop **all** instances of a named sound.
   *
   * @param {string} name
   */
  stop(name) {
    const list = this._active.get(name);
    if (!list) return;

    for (const entry of list) {
      try {
        entry.source.stop();
      } catch (_) {
        // source may have already stopped
      }
    }
    this._active.delete(name);
  }

  /**
   * Set the default volume for a specific sound (persists across plays).
   *
   * @param {string} name
   * @param {number} volume – 0..1.
   */
  setVolume(name, volume) {
    this._volumes.set(name, Math.max(0, Math.min(1, volume)));
  }

  /**
   * Change the volume of **currently playing** instances of a sound.
   *
   * @param {string} name
   * @param {number} volume – 0..1.
   */
  setPlaybackVolume(name, volume) {
    const list = this._active.get(name);
    if (!list) return;
    const clamped = Math.max(0, Math.min(1, volume));
    for (const entry of list) {
      entry.gain.gain.value = clamped;
    }
  }

  /**
   * Check whether a sound buffer has been loaded.
   *
   * @param {string} name
   * @returns {boolean}
   */
  isLoaded(name) {
    return this._buffers.has(name);
  }

  /**
   * Unload a specific buffer and stop any active instances.
   *
   * @param {string} name
   */
  unload(name) {
    this.stop(name);
    this._buffers.delete(name);
    this._volumes.delete(name);
  }

  /**
   * Release all resources and reset the manager.
   */
  destroy() {
    // Stop all active sounds
    for (const name of this._active.keys()) {
      this.stop(name);
    }
    this._buffers.clear();
    this._volumes.clear();

    if (this._ctx) {
      this._ctx.close().catch(() => {});
      this._ctx = null;
    }
    this._initialised = false;
  }
}
