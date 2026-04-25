import type { Application, Container } from 'pixi.js';

/**
 * Simple scene stack (flat). Only one scene is active at a time.
 * Setting a new scene destroys the previous one.
 */
export class SceneManager {
  private current: Container | null = null;

  constructor(private app: Application) {}

  set(next: Container): void {
    if (this.current) {
      if (this.current.parent) this.current.parent.removeChild(this.current);
      this.current.destroy({ children: true });
      this.current = null;
    }
    this.current = next;
    this.app.stage.addChild(next);
  }
}
