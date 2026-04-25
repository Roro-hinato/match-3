import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/Grid';
import { MatchDetector } from '@/core/MatchDetector';
import { GridGenerator } from '@/core/GridGenerator';
import { tile, type GridData, type Tile } from '@/core/types';

// Shorthand for null cells in test grids
const N = null;

// Build a GridData from a compact 2D array of colors (use N for empty cells).
function grid(data: (number | null)[][]): GridData {
  return data.map((row) => row.map((c) => (c === null ? null : tile(c))));
}

describe('Grid', () => {
  it('swaps two tiles', () => {
    const g = new Grid(
      2,
      2,
      grid([
        [1, 2],
        [3, 4],
      ]),
    );
    g.swap({ row: 0, col: 0 }, { row: 0, col: 1 });
    expect(g.get(0, 0)?.color).toBe(2);
    expect(g.get(0, 1)?.color).toBe(1);
  });

  it('identifies adjacency', () => {
    const g = new Grid(3, 3);
    expect(g.areAdjacent({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    expect(g.areAdjacent({ row: 0, col: 0 }, { row: 1, col: 0 })).toBe(true);
    expect(g.areAdjacent({ row: 0, col: 0 }, { row: 1, col: 1 })).toBe(false);
    expect(g.areAdjacent({ row: 0, col: 0 }, { row: 0, col: 0 })).toBe(false);
  });

  it('applies gravity correctly', () => {
    const g = new Grid(3, 1, grid([[1], [N], [2]]));
    const moves = g.applyGravity();
    expect(g.get(0, 0)).toBe(null);
    expect(g.get(1, 0)?.color).toBe(1);
    expect(g.get(2, 0)?.color).toBe(2);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toEqual({ from: { row: 0, col: 0 }, to: { row: 1, col: 0 } });
  });

  it('fills empty cells', () => {
    const g = new Grid(
      2,
      2,
      grid([
        [N, 1],
        [N, N],
      ]),
    );
    const filled = g.fillEmpty(() => tile(0));
    expect(filled).toHaveLength(3);
    expect(g.get(0, 0)?.color).toBe(0);
    expect(g.get(1, 0)?.color).toBe(0);
    expect(g.get(1, 1)?.color).toBe(0);
  });
});

describe('MatchDetector', () => {
  it('detects a horizontal match of 3', () => {
    const g = new Grid(1, 4, grid([[1, 1, 1, 2]]));
    const matches = MatchDetector.findAll(g);
    expect(matches).toHaveLength(1);
    expect(matches[0].positions).toHaveLength(3);
    expect(matches[0].orientation).toBe('horizontal');
    expect(matches[0].color).toBe(1);
    expect(matches[0].length).toBe(3);
  });

  it('detects a vertical match of 4', () => {
    const g = new Grid(4, 1, grid([[1], [1], [1], [1]]));
    const matches = MatchDetector.findAll(g);
    expect(matches).toHaveLength(1);
    expect(matches[0].positions).toHaveLength(4);
    expect(matches[0].orientation).toBe('vertical');
    expect(matches[0].length).toBe(4);
  });

  it('detects a 5-in-a-row with length 5', () => {
    const g = new Grid(1, 5, grid([[2, 2, 2, 2, 2]]));
    const matches = MatchDetector.findAll(g);
    expect(matches).toHaveLength(1);
    expect(matches[0].length).toBe(5);
  });

  it('ignores runs of 2', () => {
    const g = new Grid(1, 3, grid([[1, 1, 2]]));
    expect(MatchDetector.findAll(g)).toHaveLength(0);
  });

  it('detects overlapping horizontal and vertical matches', () => {
    const g = new Grid(
      3,
      3,
      grid([
        [1, 0, 0],
        [1, 0, 0],
        [1, 1, 1],
      ]),
    );
    const matches = MatchDetector.findAll(g);
    expect(matches).toHaveLength(2);
    expect(matches.some((m) => m.orientation === 'vertical')).toBe(true);
    expect(matches.some((m) => m.orientation === 'horizontal')).toBe(true);
  });

  it('ignores null runs', () => {
    const g = new Grid(1, 4, grid([[N, N, N, 1]]));
    expect(MatchDetector.findAll(g)).toHaveLength(0);
  });

  it('detects a playable move', () => {
    const g = new Grid(
      2,
      4,
      grid([
        [1, 1, 0, 1],
        [2, 3, 2, 3],
      ]),
    );
    expect(MatchDetector.hasPlayableMove(g)).toBe(true);
  });

  it('lists every playable move', () => {
    // Swap (0,2) with (0,3) → [1,1,1,0] row-match. That's one of the few moves available.
    const g = new Grid(
      2,
      4,
      grid([
        [1, 1, 0, 1],
        [2, 3, 2, 3],
      ]),
    );
    const moves = MatchDetector.findPlayableMoves(g);
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(g.areAdjacent(m.a, m.b)).toBe(true);
    }
  });

  it('finds L/T intersections for wrapped candy creation', () => {
    // L shape: vertical match in col 0, horizontal match on row 2 meeting at (2,0)
    const g = new Grid(
      3,
      3,
      grid([
        [1, 0, 0],
        [1, 0, 0],
        [1, 1, 1],
      ]),
    );
    const matches = MatchDetector.findAll(g);
    const lts = MatchDetector.findLTIntersections(matches);
    expect(lts).toHaveLength(1);
    expect(lts[0].intersection).toEqual({ row: 2, col: 0 });
    expect(lts[0].color).toBe(1);
  });

  it('does not report L/T for non-intersecting same-color matches', () => {
    // Two separate lines of color 1, not touching
    const g = new Grid(
      3,
      5,
      grid([
        [1, 1, 1, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 1, 1, 1],
      ]),
    );
    const matches = MatchDetector.findAll(g);
    const lts = MatchDetector.findLTIntersections(matches);
    expect(lts).toHaveLength(0);
  });
});

describe('GridGenerator', () => {
  it('generates a grid with no starting matches', () => {
    for (let seed = 0; seed < 10; seed++) {
      const g = GridGenerator.create(8, 8, 6);
      expect(MatchDetector.hasAnyMatch(g)).toBe(false);
    }
  });

  it('fills every cell with a normal tile', () => {
    const g = GridGenerator.create(8, 8, 6);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const t = g.get(r, c);
        expect(t).not.toBeNull();
        expect(t?.kind).toBe('normal');
      }
    }
  });
});

describe('Obstacles', () => {
  it('walls block gravity (tiles stack on them)', () => {
    const g = new Grid(4, 1);
    g.set(0, 0, tile(1));
    g.set(1, 0, null);
    g.set(2, 0, { color: 0, kind: 'wall' });
    g.set(3, 0, tile(2));
    g.applyGravity();
    // Tile at (0,0) falls onto the wall at (2,0) → ends at (1,0). Wall stays.
    expect(g.get(1, 0)?.color).toBe(1);
    expect(g.get(2, 0)?.kind).toBe('wall');
    expect(g.get(3, 0)?.color).toBe(2);
  });

  it('diagonal slide pulls tiles around walls', () => {
    // Wall at (1,1) blocks the column below; (2,1) is empty.
    // Tile at (1,0) should slide diagonally into (2,1) on the next gravity pass.
    const g = new Grid(3, 3);
    g.set(0, 0, tile(1));
    g.set(0, 1, tile(2));
    g.set(0, 2, tile(3));
    g.set(1, 0, tile(4));
    g.set(1, 1, { color: 0, kind: 'wall' });
    g.set(1, 2, tile(5));
    g.set(2, 0, tile(6));
    g.set(2, 1, null); // empty under the wall — needs a diagonal slide
    g.set(2, 2, tile(7));
    g.applyGravity();
    // (2,1) must now contain a tile. The exact source depends on slide order
    // but it should be filled.
    expect(g.get(2, 1)).not.toBeNull();
    expect(g.get(2, 1)?.kind).toBe('normal');
    // Wall is still there
    expect(g.get(1, 1)?.kind).toBe('wall');
  });

  it('fillEmpty does not refill cells trapped under a wall', () => {
    const g = new Grid(4, 1);
    g.set(0, 0, null);
    g.set(1, 0, { color: 0, kind: 'wall' });
    g.set(2, 0, null);
    g.set(3, 0, null);
    const filled = g.fillEmpty(() => tile(5));
    // Only (0,0) is reachable from the top; cells under the wall stay empty.
    expect(filled).toHaveLength(1);
    expect(g.get(0, 0)?.color).toBe(5);
    expect(g.get(2, 0)).toBeNull();
    expect(g.get(3, 0)).toBeNull();
  });

  it('void cells are skipped by match detection and gravity', () => {
    // A row with a void in the middle: 1-1-V-1-1 should not match.
    const g = new Grid(1, 5);
    g.set(0, 0, tile(1));
    g.set(0, 1, tile(1));
    g.set(0, 2, { color: 0, kind: 'void' });
    g.set(0, 3, tile(1));
    g.set(0, 4, tile(1));
    expect(MatchDetector.hasAnyMatch(g)).toBe(false);
  });

  /**
   * Reconciliation: applyGravity emits a `moves` list. BoardView replays this
   * list to keep its sprite-position table in sync with the model. If the model
   * ends up with a tile at (r, c), then replaying the moves on a parallel "sprite
   * tracker" (initialized to the pre-gravity grid) must put the SAME tile at (r, c).
   *
   * If the moves list is missing transitions, has wrong from/to, or reuses a
   * source cell that's already been consumed, the parallel array drifts away
   * from the model and the test fails. This guards against the BoardView/Grid
   * contract from regressing as we add more gravity behavior (diagonal slides,
   * stones, etc.).
   */
  it('moves array reconciles with the post-gravity grid through diagonal slides', () => {
    // Setup: 4×3 grid with a wall blocking the middle column at row 1.
    // Bottom-middle cell (3,1) is empty and must be filled by a diagonal slide
    // from one of the two adjacent columns.
    const g = new Grid(4, 3);
    // Use distinct colors so identity is checkable.
    g.set(0, 0, tile(10));
    g.set(0, 1, tile(11));
    g.set(0, 2, tile(12));
    g.set(1, 0, tile(13));
    g.set(1, 1, { color: 0, kind: 'wall' });
    g.set(1, 2, tile(14));
    g.set(2, 0, tile(15));
    g.set(2, 1, null); // empty under the wall
    g.set(2, 2, tile(16));
    g.set(3, 0, tile(17));
    g.set(3, 1, null); // also empty under the wall
    g.set(3, 2, tile(18));

    // Snapshot every cell's identity BEFORE gravity (objects: tiles share refs).
    const before: (Tile | null)[][] = [];
    for (let r = 0; r < g.rows; r++) {
      const row: (Tile | null)[] = [];
      for (let c = 0; c < g.cols; c++) row.push(g.get(r, c));
      before.push(row);
    }

    const moves = g.applyGravity();

    // Replay moves on a parallel "sprite tracker" — same algorithm BoardView
    // uses in animateGravity (set destination, null source).
    const sprites: (Tile | null)[][] = before.map((row) => [...row]);
    for (const m of moves) {
      const t = sprites[m.from.row][m.from.col];
      if (!t) continue;
      sprites[m.to.row][m.to.col] = t;
      sprites[m.from.row][m.from.col] = null;
    }

    // Each cell in the parallel tracker must reference the exact same tile
    // object as the grid's model.
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        expect(sprites[r][c]).toBe(g.get(r, c));
      }
    }
  });

  it('walls and stones are not considered matchable', () => {
    // Three walls in a row: no match
    const g = new Grid(1, 3);
    g.set(0, 0, { color: 0, kind: 'wall' });
    g.set(0, 1, { color: 0, kind: 'wall' });
    g.set(0, 2, { color: 0, kind: 'wall' });
    expect(MatchDetector.hasAnyMatch(g)).toBe(false);
  });

  it('findPlayableMoves ignores walls/stones', () => {
    // Row with a stone in the middle; both sides could match but the stone blocks
    const g = new Grid(2, 4);
    g.set(0, 0, tile(1));
    g.set(0, 1, tile(1));
    g.set(0, 2, { color: 0, kind: 'stone' });
    g.set(0, 3, tile(2));
    g.set(1, 0, tile(2));
    g.set(1, 1, tile(3));
    g.set(1, 2, tile(2));
    g.set(1, 3, tile(3));
    const moves = MatchDetector.findPlayableMoves(g);
    for (const m of moves) {
      const ta = g.get(m.a.row, m.a.col);
      const tb = g.get(m.b.row, m.b.col);
      expect(ta?.kind).not.toBe('stone');
      expect(ta?.kind).not.toBe('wall');
      expect(tb?.kind).not.toBe('stone');
      expect(tb?.kind).not.toBe('wall');
    }
  });
});
