import { gsap } from 'gsap';

/**
 * Wraps a GSAP tween in a Promise that resolves on completion.
 * Lets the game loop await animations sequentially.
 */
export function tween(target: object, vars: gsap.TweenVars): Promise<void> {
  return new Promise<void>((resolve) => {
    gsap.to(target, { ...vars, onComplete: resolve });
  });
}
