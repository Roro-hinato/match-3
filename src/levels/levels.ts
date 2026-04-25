/** Level data types. Levels are static data — no runtime state lives here. */

export type Objective =
  | { type: 'score'; target: number }
  | { type: 'destroy-stones'; target: number };

export interface ObstacleLayout {
  walls?: [number, number][];
  stones?: [number, number][];
}

export interface LevelDef {
  id: number;
  name: string;
  moves: number;
  objective: Objective;
  obstacles?: ObstacleLayout;
  /** Cells that don't exist on this level's playfield (for shaped grids). */
  voidCells?: [number, number][];
  description: string;
  mapPos: { x: number; y: number };
}

/** Helpers to build common shapes on a 9×9 grid. */
function rect(rows: number[], cols: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const r of rows) for (const c of cols) out.push([r, c]);
  return out;
}

/** T-shape: keep top 4 rows full-width + a center 3-wide column below. */
function tShape(): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 4; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (c < 3 || c > 5) cells.push([r, c]);
    }
  }
  return cells;
}

/** U-shape: keep left col, right col, bottom row; void out the middle. */
function uShape(): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < 7; r++) {
    for (let c = 2; c < 7; c++) cells.push([r, c]);
  }
  return cells;
}

/** Cross/plus shape: keep the center vertical strip (3 cols wide) and middle horizontal strip (3 rows tall). */
function crossShape(): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const inV = c >= 3 && c <= 5;
      const inH = r >= 3 && r <= 5;
      if (!inV && !inH) cells.push([r, c]);
    }
  }
  return cells;
}

/**
 * Eight progressive levels.
 * Difficulty curve: easy → mid → mechanics intro → mid-hard → shaped grids → final.
 */
export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: 'Premiers pas',
    moves: 25,
    objective: { type: 'score', target: 1000 },
    description: 'Fais des matchs pour atteindre 1000 points.',
    mapPos: { x: 0.12, y: 0.78 },
  },
  {
    id: 2,
    name: 'Apprenti',
    moves: 24,
    objective: { type: 'score', target: 1500 },
    description: 'Enchaîne les combos : 1500 points à atteindre.',
    mapPos: { x: 0.28, y: 0.65 },
  },
  {
    id: 3,
    name: 'Entre les murs',
    moves: 27,
    objective: { type: 'score', target: 2000 },
    obstacles: {
      walls: [
        [3, 4],
        [4, 4],
        [5, 4],
      ],
    },
    description: 'Un mur partage la grille — les tuiles glissent autour.',
    mapPos: { x: 0.44, y: 0.78 },
  },
  {
    id: 4,
    name: 'En T',
    moves: 28,
    objective: { type: 'score', target: 2400 },
    voidCells: tShape(),
    description: 'Grille en forme de T. Concentre tes combos !',
    mapPos: { x: 0.6, y: 0.62 },
  },
  {
    id: 5,
    name: 'Briseur de pierres',
    moves: 22,
    objective: { type: 'destroy-stones', target: 3 },
    obstacles: {
      stones: [
        [3, 3],
        [3, 5],
        [5, 3],
        [5, 5],
      ],
    },
    description: 'Détruis 3 pierres en faisant des matchs à côté.',
    mapPos: { x: 0.76, y: 0.72 },
  },
  {
    id: 6,
    name: 'En U',
    moves: 26,
    objective: { type: 'destroy-stones', target: 4 },
    voidCells: uShape(),
    obstacles: {
      stones: [
        [3, 0],
        [3, 8],
        [5, 0],
        [5, 8],
        [7, 4],
      ],
    },
    description: 'Grille en U : casse 4 pierres dans les bras du U.',
    mapPos: { x: 0.84, y: 0.42 },
  },
  {
    id: 7,
    name: 'Croix',
    moves: 28,
    objective: { type: 'score', target: 3000 },
    voidCells: crossShape(),
    obstacles: {
      walls: rect([4], [4]),
    },
    description: 'Grille en croix avec un mur au centre.',
    mapPos: { x: 0.64, y: 0.32 },
  },
  {
    id: 8,
    name: 'Grand final',
    moves: 30,
    objective: { type: 'destroy-stones', target: 6 },
    obstacles: {
      stones: [
        [1, 4],
        [3, 2],
        [3, 6],
        [5, 2],
        [5, 6],
        [7, 4],
        [4, 0],
      ],
      walls: [
        [2, 4],
        [6, 4],
      ],
    },
    description: 'Six pierres, deux murs, trente coups.',
    mapPos: { x: 0.44, y: 0.2 },
  },
];
