import type { GridData, Position, Tile } from './types';

/**
 * Pure logic grid. Zero Pixi, zero DOM. Fully unit-testable.
 * Stores Tile objects so specials (striped, wrapped, color bomb) can coexist with normal tiles.
 */
export class Grid {
  private data: GridData;

  constructor(
    public readonly rows: number,
    public readonly cols: number,
    initial?: GridData,
  ) {
    this.data = initial
      ? initial.map((row) => [...row])
      : Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
  }

  get(row: number, col: number): Tile | null {
    if (!this.inBounds(row, col)) return null;
    return this.data[row][col];
  }

  set(row: number, col: number, value: Tile | null): void {
    if (!this.inBounds(row, col)) return;
    this.data[row][col] = value;
  }

  swap(a: Position, b: Position): void {
    const av = this.get(a.row, a.col);
    const bv = this.get(b.row, b.col);
    this.set(a.row, a.col, bv);
    this.set(b.row, b.col, av);
  }

  inBounds(row: number, col: number): boolean {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  areAdjacent(a: Position, b: Position): boolean {
    const dr = Math.abs(a.row - b.row);
    const dc = Math.abs(a.col - b.col);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
  }

  applyGravity(): { from: Position; to: Position }[] {
    const moves: { from: Position; to: Position }[] = [];

    // ---- Pass 1: straight vertical drop -----------------------------------
    // Tiles fall down their own column past empty cells, but stop on walls,
    // stones, or void.
    for (let col = 0; col < this.cols; col++) {
      let writeRow = this.rows - 1;
      for (let row = this.rows - 1; row >= 0; row--) {
        const v = this.get(row, col);
        if (v === null) continue;
        if (v.kind === 'wall' || v.kind === 'stone' || v.kind === 'void') {
          // Reset write head above this immovable cell — tiles won't pass it.
          writeRow = row - 1;
          continue;
        }
        if (writeRow !== row) {
          this.set(writeRow, col, v);
          this.set(row, col, null);
          moves.push({ from: { row, col }, to: { row: writeRow, col } });
        }
        writeRow--;
      }
    }

    // ---- Pass 2: diagonal slide ------------------------------------------
    // Any empty cell whose upward path is blocked tries to pull a tile from
    // its upper-left or upper-right neighbor. Repeat until stable so chains
    // of diagonals (zig-zag through walls) settle correctly.
    let changed = true;
    let safety = this.rows * this.cols + 5;
    while (changed && safety-- > 0) {
      changed = false;
      // Iterate bottom-up so a freshly slid tile can be pulled further down
      // on the next outer iteration.
      for (let row = this.rows - 1; row >= 0; row--) {
        for (let col = 0; col < this.cols; col++) {
          if (this.get(row, col) !== null) continue;
          // Only consider this empty cell if it can't be filled by direct
          // vertical drop (i.e. something above it blocks the column).
          if (!this.isVerticallyBlocked(row, col)) continue;

          // Try upper-left first, then upper-right. Random alternation could
          // be added here for visual variety, but deterministic is simpler.
          const candidates: Position[] = [
            { row: row - 1, col: col - 1 },
            { row: row - 1, col: col + 1 },
          ];
          for (const src of candidates) {
            if (!this.inBounds(src.row, src.col)) continue;
            const t = this.get(src.row, src.col);
            if (!t) continue;
            if (t.kind === 'wall' || t.kind === 'stone' || t.kind === 'void') continue;
            // Slide it
            this.set(row, col, t);
            this.set(src.row, src.col, null);
            moves.push({ from: src, to: { row, col } });
            changed = true;
            break;
          }
        }
      }
      // After a slide pass, run another vertical pass — slid tiles often
      // open new columns above them.
      if (changed) {
        for (let col = 0; col < this.cols; col++) {
          let writeRow = this.rows - 1;
          for (let row = this.rows - 1; row >= 0; row--) {
            const v = this.get(row, col);
            if (v === null) continue;
            if (v.kind === 'wall' || v.kind === 'stone' || v.kind === 'void') {
              writeRow = row - 1;
              continue;
            }
            if (writeRow !== row) {
              this.set(writeRow, col, v);
              this.set(row, col, null);
              moves.push({ from: { row, col }, to: { row: writeRow, col } });
            }
            writeRow--;
          }
        }
      }
    }

    return moves;
  }

  /** True if the cell at (row, col) has a wall or stone somewhere directly above
   *  in the same column. Void is NOT a blocker — it's the absence of grid, so
   *  fresh tiles can spawn from the top and traverse void rows freely. */
  private isVerticallyBlocked(row: number, col: number): boolean {
    for (let r = row - 1; r >= 0; r--) {
      const t = this.data[r][col];
      if (!t) continue;
      if (t.kind === 'wall' || t.kind === 'stone') return true;
    }
    return false;
  }

  /**
   * Fills null cells that have a clear path from the top of the grid (no
   * wall/stone above in the same column). Void cells are *traversed* — they
   * represent off-grid space, so a column whose top rows are void simply means
   * tiles spawn lower down. This keeps shaped grids (T, U, cross) full.
   */
  fillEmpty(factory: () => Tile): Position[] {
    const filled: Position[] = [];
    for (let col = 0; col < this.cols; col++) {
      for (let row = 0; row < this.rows; row++) {
        const v = this.get(row, col);
        if (v !== null) {
          // Real obstacle: stop refilling this column below it.
          if (v.kind === 'wall' || v.kind === 'stone') break;
          // Void: skip but keep walking — the next playable cell down might be empty.
          if (v.kind === 'void') continue;
          continue;
        }
        if (this.isVerticallyBlocked(row, col)) break;
        this.set(row, col, factory());
        filled.push({ row, col });
      }
    }
    return filled;
  }

  clone(): Grid {
    return new Grid(this.rows, this.cols, this.data);
  }

  /**
   * In-place Fisher-Yates shuffle of the matchable cells only. Walls and stones
   * keep their positions so the level layout stays intact through a reshuffle.
   */
  reshuffle(rng: () => number = Math.random): void {
    const positions: { row: number; col: number }[] = [];
    const tiles: Tile[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.data[r][c];
        if (t && t.kind !== 'wall' && t.kind !== 'stone' && t.kind !== 'void') {
          positions.push({ row: r, col: c });
          tiles.push(t);
        }
      }
    }
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      this.data[p.row][p.col] = tiles[i];
    }
  }

  toArray(): GridData {
    return this.data.map((row) => [...row]);
  }
}
