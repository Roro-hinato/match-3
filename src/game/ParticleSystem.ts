import { Container, Graphics } from 'pixi.js';
import { gsap } from 'gsap';

/**
 * Lightweight particle system. Each emit() spawns N small graphics that arc
 * outward from a point with simple ballistic motion (initial velocity + gravity)
 * and fade out. Particles are auto-cleaned at the end of their lifespan.
 *
 * Designed for short-lived bursts on tile destruction — not a heavy-duty
 * particle engine. For ~6 particles per tile and ~10 tiles per cascade,
 * we're at <100 active particles which Pixi handles trivially.
 *
 * The container is added once to the scene and reused across emits.
 */
export class ParticleSystem extends Container {
  /** Spawn `count` particles at (x, y), tinted `color`. */
  burst(x: number, y: number, color: number, count: number = 8): void {
    for (let i = 0; i < count; i++) {
      this.spawnOne(x, y, color);
    }
  }

  private spawnOne(x: number, y: number, color: number): void {
    const size = 3 + Math.random() * 4;
    const p = new Graphics();
    p.circle(0, 0, size).fill(color);
    p.x = x;
    p.y = y;
    this.addChild(p);

    // Initial velocity: random direction, biased upward, with some horizontal spread.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
    const speed = 80 + Math.random() * 120;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const lifetime = 0.5 + Math.random() * 0.3;

    // Animate position with gravity (using a custom tween via GSAP onUpdate).
    // We track time manually so we can apply non-linear motion.
    const state = { t: 0 };
    gsap.to(state, {
      t: lifetime,
      duration: lifetime,
      ease: 'none',
      onUpdate: () => {
        const t = state.t;
        // Ballistic trajectory: x = x0 + vx*t, y = y0 + vy*t + 0.5*g*t²
        p.x = x + vx * t;
        p.y = y + vy * t + 0.5 * 600 * t * t; // g = 600 px/s²
      },
      onComplete: () => {
        this.removeChild(p);
        p.destroy();
      },
    });
    // Fade + shrink in parallel
    gsap.to(p, {
      alpha: 0,
      duration: lifetime,
      ease: 'power2.in',
    });
    gsap.to(p.scale, {
      x: 0.3,
      y: 0.3,
      duration: lifetime,
      ease: 'power2.in',
    });
  }

  /**
   * Confetti rain — used on victory. Spawns N pieces at the top of `bounds`
   * that fall and gently rotate. Each piece picks a random tile color.
   */
  confetti(bounds: { x: number; y: number; width: number; height: number }, count: number, colors: number[]): void {
    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const startX = bounds.x + Math.random() * bounds.width;
      const startY = bounds.y - 20 - Math.random() * 80;
      const piece = new Graphics();
      const w = 6 + Math.random() * 6;
      const h = 10 + Math.random() * 6;
      piece.rect(-w / 2, -h / 2, w, h).fill(color);
      piece.x = startX;
      piece.y = startY;
      piece.rotation = Math.random() * Math.PI * 2;
      this.addChild(piece);

      const fallY = bounds.y + bounds.height + 40;
      const driftX = (Math.random() - 0.5) * 100;
      const duration = 2 + Math.random() * 2;

      gsap.to(piece, {
        x: startX + driftX,
        y: fallY,
        rotation: piece.rotation + (Math.random() - 0.5) * 8,
        duration,
        ease: 'power1.in',
        delay: i * 0.015,
        onComplete: () => {
          this.removeChild(piece);
          piece.destroy();
        },
      });
      gsap.to(piece, {
        alpha: 0,
        duration: 0.4,
        delay: duration - 0.4 + i * 0.015,
      });
    }
  }
}
