import type { FederatedPointerEvent } from 'pixi.js';
import type { Position } from '@/core/types';
import type { BoardView } from './BoardView';

/**
 * Click the first tile, then click an adjacent tile to swap.
 * Clicking an invalid (non-adjacent) tile replaces the selection.
 * If onTileTap returns true, the tap is fully handled (e.g. hammer mode)
 * and the default swap-selection flow is skipped.
 */
export class InputController {
  private selected: Position | null = null;

  constructor(
    private board: BoardView,
    private onSwap: (a: Position, b: Position) => void,
    private onFirstInteraction?: () => void,
    private onTileTap?: (pos: Position) => boolean,
  ) {
    board.eventMode = 'static';
    board.on('pointerdown', this.handlePointer);
  }

  private handlePointer = (e: FederatedPointerEvent): void => {
    this.onFirstInteraction?.();
    const local = this.board.toLocal(e.global);
    const pos = this.board.pixelToCell(local.x, local.y);
    if (!pos) {
      this.selected = null;
      this.board.showSelection(null);
      return;
    }

    // Intercept hook (hammer mode, etc). Returning true cancels normal selection.
    if (this.onTileTap && this.onTileTap(pos)) {
      this.selected = null;
      this.board.showSelection(null);
      return;
    }

    if (this.selected === null) {
      this.selected = pos;
      this.board.showSelection(pos);
      return;
    }

    const a = this.selected;
    const b = pos;
    const adjacent =
      (Math.abs(a.row - b.row) === 1 && a.col === b.col) ||
      (Math.abs(a.col - b.col) === 1 && a.row === b.row);

    if (adjacent) {
      this.selected = null;
      this.board.showSelection(null);
      this.onSwap(a, b);
    } else {
      this.selected = pos;
      this.board.showSelection(pos);
    }
  };
}
