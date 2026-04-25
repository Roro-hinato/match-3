import type { Grid } from './Grid';
import type { Match, Position, TileColor } from './types';

/** Detects matches and L/T intersections on a Tile-based grid. */
export class MatchDetector {
  private static colorAt(grid: Grid, row: number, col: number): number | null {
    const t = grid.get(row, col);
    if (!t) return null;
    if (t.kind === 'wall' || t.kind === 'stone' || t.kind === 'void') return null;
    return t.color;
  }

  /** All 3+ runs, horizontal and vertical. `length` field carries the run size. */
  static findAll(grid: Grid): Match[] {
    const matches: Match[] = [];

    // Horizontal
    for (let row = 0; row < grid.rows; row++) {
      let runStart = 0;
      for (let col = 1; col <= grid.cols; col++) {
        const prev = MatchDetector.colorAt(grid, row, col - 1);
        const curr = col < grid.cols ? MatchDetector.colorAt(grid, row, col) : null;
        if (prev === null || curr !== prev) {
          const runLen = col - runStart;
          if (runLen >= 3 && prev !== null) {
            const positions: Position[] = [];
            for (let c = runStart; c < col; c++) positions.push({ row, col: c });
            matches.push({ positions, color: prev, orientation: 'horizontal', length: runLen });
          }
          runStart = col;
        }
      }
    }

    // Vertical
    for (let col = 0; col < grid.cols; col++) {
      let runStart = 0;
      for (let row = 1; row <= grid.rows; row++) {
        const prev = MatchDetector.colorAt(grid, row - 1, col);
        const curr = row < grid.rows ? MatchDetector.colorAt(grid, row, col) : null;
        if (prev === null || curr !== prev) {
          const runLen = row - runStart;
          if (runLen >= 3 && prev !== null) {
            const positions: Position[] = [];
            for (let r = runStart; r < row; r++) positions.push({ row: r, col });
            matches.push({ positions, color: prev, orientation: 'vertical', length: runLen });
          }
          runStart = row;
        }
      }
    }

    return matches;
  }

  static hasAnyMatch(grid: Grid): boolean {
    return MatchDetector.findAll(grid).length > 0;
  }

  /**
   * Looks for a horizontal match and a vertical match of the same color that
   * share a cell. Each hit becomes a wrapped candy at the intersection.
   */
  static findLTIntersections(
    matches: Match[],
  ): { intersection: Position; color: TileColor; horiz: Match; vert: Match }[] {
    const results: {
      intersection: Position;
      color: TileColor;
      horiz: Match;
      vert: Match;
    }[] = [];
    const horiz = matches.filter((m) => m.orientation === 'horizontal');
    const vert = matches.filter((m) => m.orientation === 'vertical');
    for (const h of horiz) {
      for (const v of vert) {
        if (h.color !== v.color) continue;
        // A horizontal match has a single row; find a vertical match that contains a cell in that row/col
        for (const vp of v.positions) {
          if (vp.row === h.positions[0].row) {
            const cols = h.positions.map((p) => p.col);
            if (cols.includes(vp.col)) {
              results.push({ intersection: vp, color: h.color, horiz: h, vert: v });
              break;
            }
          }
        }
      }
    }
    return results;
  }

  /** True if swapping any adjacent pair would create a match. Used to detect deadlocks. */
  static hasPlayableMove(grid: Grid): boolean {
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
        ] as const) {
          const r2 = row + dr;
          const c2 = col + dc;
          if (!grid.inBounds(r2, c2)) continue;
          const ta = grid.get(row, col);
          const tb = grid.get(r2, c2);
          if (!ta || !tb) continue;
          if (ta.kind === 'wall' || ta.kind === 'stone' || ta.kind === 'void') continue;
          if (tb.kind === 'wall' || tb.kind === 'stone' || tb.kind === 'void') continue;
          const a = { row, col };
          const b = { row: r2, col: c2 };
          grid.swap(a, b);
          const hit = MatchDetector.hasAnyMatch(grid);
          grid.swap(a, b);
          if (hit) return true;
        }
      }
    }
    return false;
  }

  static findPlayableMoves(grid: Grid): { a: Position; b: Position }[] {
    const moves: { a: Position; b: Position }[] = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
        ] as const) {
          const r2 = row + dr;
          const c2 = col + dc;
          if (!grid.inBounds(r2, c2)) continue;
          const ta = grid.get(row, col);
          const tb = grid.get(r2, c2);
          if (!ta || !tb) continue;
          if (ta.kind === 'wall' || ta.kind === 'stone' || ta.kind === 'void') continue;
          if (tb.kind === 'wall' || tb.kind === 'stone' || tb.kind === 'void') continue;
          const a = { row, col };
          const b = { row: r2, col: c2 };
          grid.swap(a, b);
          const hit = MatchDetector.hasAnyMatch(grid);
          grid.swap(a, b);
          if (hit) moves.push({ a, b });
        }
      }
    }
    return moves;
  }
}
