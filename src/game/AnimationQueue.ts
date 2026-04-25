/**
 * Serializes async steps so that swap → match → cascade → new match → ...
 * run strictly in order with no interleaving.
 */
export class AnimationQueue {
  private running = false;
  private queue: Array<() => Promise<void>> = [];

  push(task: () => Promise<void>): void {
    this.queue.push(task);
    if (!this.running) void this.drain();
  }

  private async drain(): Promise<void> {
    this.running = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      try {
        await task();
      } catch (err) {
        console.error('AnimationQueue task failed:', err);
      }
    }
    this.running = false;
  }

  get isBusy(): boolean {
    return this.running;
  }
}
