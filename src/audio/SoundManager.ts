/**
 * Procedural sound manager using the Web Audio API.
 * All sounds are synthesized on the fly — no audio files needed.
 *
 * Browser autoplay policies require a user gesture before an AudioContext
 * can play. Call `unlock()` from a pointer or key event handler before
 * any `play*` method can make noise.
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _enabled = true;
  private _volume = 0.5;
  private unlocked = false;

  /** Call from a user-gesture handler (pointerdown, keydown...) to enable audio. */
  unlock(): void {
    if (this.unlocked) return;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this._enabled ? this._volume : 0;
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.unlocked = true;
    } catch (err) {
      console.warn('Audio init failed:', err);
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  setEnabled(v: boolean): void {
    this._enabled = v;
    if (this.masterGain) this.masterGain.gain.value = v ? this._volume : 0;
  }

  toggle(): boolean {
    this.setEnabled(!this._enabled);
    return this._enabled;
  }

  /** Short pop when a player swaps two tiles. */
  playSwap(): void {
    this.sweep(620, 440, 0.08, 'triangle', 0.25);
  }

  /** Dull downward sweep when a swap reverts (no match formed). */
  playInvalidSwap(): void {
    this.sweep(210, 130, 0.2, 'sine', 0.22);
  }

  /**
   * Satisfying pop on match clear. Pitch climbs with cascade depth using
   * a minor-pentatonic scale — each cascade step lands on a musical note.
   */
  playMatch(combo: number): void {
    const scale = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
    const semis = scale[Math.min(combo - 1, scale.length - 1)];
    const root = 440;
    const freq = root * Math.pow(2, semis / 12);
    this.sweep(freq * 1.4, freq, 0.15, 'triangle', 0.3);
  }

  /** High sparkle layered on top of match from combo x2 onward. */
  playCombo(multiplier: number): void {
    const freq = 880 * Math.pow(1.12, multiplier - 2);
    this.sweep(freq * 1.5, freq, 0.2, 'sine', 0.18);
  }

  /**
   * Core primitive: frequency sweep with fast attack + exponential decay envelope.
   * Everything else in this class is a thin wrapper around this.
   */
  private sweep(
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ): void {
    if (!this._enabled || !this.ctx || !this.masterGain) return;
    if (this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);

    // Envelope: fast attack (8ms) to avoid clicks, then exponential decay.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }
}
