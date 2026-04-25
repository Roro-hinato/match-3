/** Level data types. Levels are static data — no runtime state lives here. */

export type Objective =
  | { type: 'score'; target: number }
  | { type: 'destroy-stones'; target: number }
  | { type: 'collect-color'; color: number; target: number };

export interface ObstacleLayout {
  walls?: [number, number][];
  /** Single-hit stones. Each entry is [row, col]. */
  stones?: [number, number][];
  /** Multi-hit stones. Each entry is [row, col, hits]. */
  toughStones?: [number, number, number][];
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

/* -------------------------------------------------------------------------- */
/* Shape helpers                                                              */
/* -------------------------------------------------------------------------- */

function rect(rows: number[], cols: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const r of rows) for (const c of cols) out.push([r, c]);
  return out;
}

function tShape(): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 4; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (c < 3 || c > 5) cells.push([r, c]);
    }
  }
  return cells;
}

function uShape(): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < 9; r++) {
    cells.push([r, 0]);
    cells.push([r, 8]);
  }
  for (let r = 0; r < 6; r++) {
    for (let c = 3; c <= 5; c++) cells.push([r, c]);
  }
  return cells;
}

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

function hourglassShape(): [number, number][] {
  const cells: [number, number][] = [];
  const widths = [9, 7, 5, 3, 1, 3, 5, 7, 9];
  for (let r = 0; r < 9; r++) {
    const w = widths[r];
    const padding = (9 - w) / 2;
    for (let c = 0; c < 9; c++) {
      if (c < padding || c >= 9 - padding) cells.push([r, c]);
    }
  }
  return cells;
}

/** Diamond shape: rhombus inscribed in the 9×9 square. */
function diamondShape(): [number, number][] {
  const cells: [number, number][] = [];
  const center = 4;
  for (let r = 0; r < 9; r++) {
    const halfWidth = 4 - Math.abs(r - center);
    for (let c = 0; c < 9; c++) {
      if (c < center - halfWidth || c > center + halfWidth) cells.push([r, c]);
    }
  }
  return cells;
}

/** Two-island shape: a 4-wide column on the left and on the right, void center. */
function twoIslandsShape(): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < 9; r++) {
    cells.push([r, 4]); // void only the center column
  }
  return cells;
}

/** Staircase: top-left rectangular block + bottom-right rectangular block, connected by one cell. */
function staircaseShape(): [number, number][] {
  const cells: [number, number][] = [];
  // Top-right quadrant void
  for (let r = 0; r < 4; r++) {
    for (let c = 5; c < 9; c++) cells.push([r, c]);
  }
  // Bottom-left quadrant void
  for (let r = 5; r < 9; r++) {
    for (let c = 0; c < 4; c++) cells.push([r, c]);
  }
  return cells;
}

/** O / ring shape: empty 3×3 hole in the middle. */
function ringShape(): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 3; r <= 5; r++) {
    for (let c = 3; c <= 5; c++) cells.push([r, c]);
  }
  return cells;
}

/** H shape: two full columns (1-2 and 6-7) + a 3-row middle horizontal bar. */
function hShape(): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const isLeftPillar = c >= 1 && c <= 2;
      const isRightPillar = c >= 6 && c <= 7;
      const isMiddleBar = r >= 3 && r <= 5;
      if (!isLeftPillar && !isRightPillar && !isMiddleBar) cells.push([r, c]);
    }
  }
  return cells;
}

/* -------------------------------------------------------------------------- */
/* The 25 levels                                                               */
/* -------------------------------------------------------------------------- */

export const LEVELS: LevelDef[] = [
  // 1–3 : tutoriel doux
  {
    id: 1,
    name: 'Premiers pas',
    moves: 25,
    objective: { type: 'score', target: 1000 },
    description: 'Aligne 3 tuiles pour atteindre 1000 points.',
    mapPos: { x: 0.08, y: 0.88 },
  },
  {
    id: 2,
    name: 'Apprenti',
    moves: 24,
    objective: { type: 'score', target: 1500 },
    description: 'Enchaîne les combos : 1500 points.',
    mapPos: { x: 0.18, y: 0.82 },
  },
  {
    id: 3,
    name: 'Premier mur',
    moves: 26,
    objective: { type: 'score', target: 2000 },
    obstacles: { walls: [[3, 4], [4, 4], [5, 4]] },
    description: 'Un mur partage la grille — les tuiles glissent autour.',
    mapPos: { x: 0.3, y: 0.88 },
  },

  // 4–6 : nouvelles mécaniques
  {
    id: 4,
    name: 'Pierres fragiles',
    moves: 22,
    objective: { type: 'destroy-stones', target: 4 },
    obstacles: { stones: [[3, 3], [3, 5], [5, 3], [5, 5], [4, 4]] },
    description: 'Casse 4 pierres en alignant à côté.',
    mapPos: { x: 0.42, y: 0.82 },
  },
  {
    id: 5,
    name: 'Couleur dominante',
    moves: 24,
    objective: { type: 'collect-color', color: 0, target: 25 },
    description: 'Collecte 25 tuiles rouges.',
    mapPos: { x: 0.52, y: 0.88 },
  },
  {
    id: 6,
    name: 'En T',
    moves: 28,
    objective: { type: 'score', target: 2500 },
    voidCells: tShape(),
    description: 'Grille en T. Concentre tes combos.',
    mapPos: { x: 0.62, y: 0.82 },
  },

  // 7–9 : pierres robustes + formes
  {
    id: 7,
    name: 'Pierres tenaces',
    moves: 22,
    objective: { type: 'destroy-stones', target: 4 },
    obstacles: {
      toughStones: [
        [3, 3, 2],
        [3, 5, 2],
        [5, 3, 2],
        [5, 5, 2],
      ],
    },
    description: 'Pierres à 2 coups : il faut taper deux fois.',
    mapPos: { x: 0.74, y: 0.88 },
  },
  {
    id: 8,
    name: 'Verts en série',
    moves: 25,
    objective: { type: 'collect-color', color: 1, target: 30 },
    obstacles: { walls: [[2, 4], [6, 4]] },
    description: 'Collecte 30 tuiles vertes avec deux murs.',
    mapPos: { x: 0.84, y: 0.82 },
  },
  {
    id: 9,
    name: 'En U',
    moves: 24,
    objective: { type: 'destroy-stones', target: 5 },
    voidCells: uShape(),
    obstacles: { stones: [[2, 1], [4, 1], [2, 7], [4, 7], [7, 4]] },
    description: 'Grille en U : 5 pierres dans les bras et au fond.',
    mapPos: { x: 0.9, y: 0.7 },
  },

  // 10–12 : montée mid-game
  {
    id: 10,
    name: 'Diamant bleu',
    moves: 26,
    objective: { type: 'collect-color', color: 2, target: 35 },
    voidCells: diamondShape(),
    description: 'Grille en losange : 35 tuiles bleues.',
    mapPos: { x: 0.84, y: 0.6 },
  },
  {
    id: 11,
    name: 'Croix',
    moves: 28,
    objective: { type: 'score', target: 3000 },
    voidCells: crossShape(),
    obstacles: { walls: rect([4], [4]) },
    description: 'Croix avec un mur central. Les bras sont étroits.',
    mapPos: { x: 0.74, y: 0.55 },
  },
  {
    id: 12,
    name: 'Mosaïque',
    moves: 26,
    objective: { type: 'destroy-stones', target: 6 },
    obstacles: {
      stones: [[1, 1], [1, 7], [7, 1], [7, 7]],
      toughStones: [
        [4, 4, 3],
        [3, 4, 2],
        [5, 4, 2],
      ],
    },
    description: 'Mélange de pierres simples et tenaces.',
    mapPos: { x: 0.62, y: 0.6 },
  },

  // 13–15 : avancé
  {
    id: 13,
    name: 'Sablier',
    moves: 30,
    objective: { type: 'score', target: 4000 },
    voidCells: hourglassShape(),
    description: 'Grille en sablier : passage étroit au centre.',
    mapPos: { x: 0.5, y: 0.55 },
  },
  {
    id: 14,
    name: 'Anneau',
    moves: 28,
    objective: { type: 'collect-color', color: 3, target: 40 },
    voidCells: ringShape(),
    description: 'Trou central en forme d\'anneau : 40 tuiles oranges.',
    mapPos: { x: 0.38, y: 0.6 },
  },
  {
    id: 15,
    name: 'Citadelle',
    moves: 28,
    objective: { type: 'destroy-stones', target: 7 },
    obstacles: {
      toughStones: [
        [1, 4, 2],
        [4, 1, 2],
        [4, 7, 2],
        [7, 4, 2],
      ],
      stones: [[3, 3], [3, 5], [5, 3], [5, 5]],
      walls: [[4, 4]],
    },
    description: 'Forteresse de pierres autour d\'un mur central.',
    mapPos: { x: 0.26, y: 0.55 },
  },

  // 16–18 : mécaniques complexes
  {
    id: 16,
    name: 'Deux îles',
    moves: 30,
    objective: { type: 'score', target: 4500 },
    voidCells: twoIslandsShape(),
    description: 'Grille coupée en deux. Chaque côté est isolé.',
    mapPos: { x: 0.16, y: 0.6 },
  },
  {
    id: 17,
    name: 'Roches violettes',
    moves: 26,
    objective: { type: 'collect-color', color: 4, target: 45 },
    obstacles: {
      walls: [[3, 2], [3, 6], [5, 2], [5, 6]],
      stones: [[4, 4]],
    },
    description: '45 tuiles violettes à collecter, le centre est piégé.',
    mapPos: { x: 0.1, y: 0.45 },
  },
  {
    id: 18,
    name: 'Escalier',
    moves: 30,
    objective: { type: 'destroy-stones', target: 6 },
    voidCells: staircaseShape(),
    obstacles: {
      toughStones: [
        [0, 0, 2],
        [3, 4, 3],
        [5, 4, 3],
        [8, 8, 2],
      ],
      stones: [[2, 2], [6, 6]],
    },
    description: 'Forme en escalier avec pierres résistantes.',
    mapPos: { x: 0.18, y: 0.32 },
  },

  // 19–21 : end-game
  {
    id: 19,
    name: 'Le H',
    moves: 28,
    objective: { type: 'score', target: 5000 },
    voidCells: hShape(),
    description: 'Forme en H : deux piliers reliés par une barre.',
    mapPos: { x: 0.3, y: 0.4 },
  },
  {
    id: 20,
    name: 'Triple jaune',
    moves: 24,
    objective: { type: 'collect-color', color: 5, target: 50 },
    obstacles: {
      walls: [[2, 2], [2, 6], [6, 2], [6, 6]],
      toughStones: [[4, 4, 3]],
    },
    description: '50 tuiles jaunes en 24 coups.',
    mapPos: { x: 0.42, y: 0.32 },
  },
  {
    id: 21,
    name: 'Forteresse de pierre',
    moves: 28,
    objective: { type: 'destroy-stones', target: 9 },
    obstacles: {
      toughStones: [
        [1, 1, 2],
        [1, 7, 2],
        [7, 1, 2],
        [7, 7, 2],
        [4, 4, 3],
      ],
      stones: [[1, 4], [4, 1], [4, 7], [7, 4]],
    },
    description: '9 pierres dont une centrale très résistante.',
    mapPos: { x: 0.54, y: 0.4 },
  },

  // 22–25 : niveaux boss
  {
    id: 22,
    name: 'Labyrinthe',
    moves: 32,
    objective: { type: 'score', target: 6500 },
    obstacles: {
      walls: [
        [1, 2], [2, 2], [3, 2],
        [1, 6], [2, 6], [3, 6],
        [5, 2], [6, 2], [7, 2],
        [5, 6], [6, 6], [7, 6],
        [4, 4],
      ],
    },
    description: 'Couloirs symétriques. Beaucoup de murs, peu de matchs.',
    mapPos: { x: 0.66, y: 0.32 },
  },
  {
    id: 23,
    name: 'Sablier brisé',
    moves: 30,
    objective: { type: 'destroy-stones', target: 6 },
    voidCells: hourglassShape(),
    obstacles: {
      toughStones: [
        [0, 0, 2],
        [0, 8, 2],
        [8, 0, 2],
        [8, 8, 2],
      ],
      stones: [[4, 4], [3, 4]],
    },
    description: 'Sablier piégé. Les pierres sont aux extrémités.',
    mapPos: { x: 0.78, y: 0.4 },
  },
  {
    id: 24,
    name: 'Pluie de roses',
    moves: 26,
    objective: { type: 'collect-color', color: 0, target: 60 },
    voidCells: ringShape(),
    obstacles: {
      walls: [[2, 4], [6, 4], [4, 2], [4, 6]],
    },
    description: '60 tuiles rouges, anneau au centre, murs en croix.',
    mapPos: { x: 0.86, y: 0.28 },
  },
  {
    id: 25,
    name: "L'épreuve finale",
    moves: 35,
    objective: { type: 'destroy-stones', target: 12 },
    obstacles: {
      toughStones: [
        [1, 1, 3], [1, 7, 3], [7, 1, 3], [7, 7, 3],
        [4, 4, 3],
      ],
      stones: [
        [1, 4], [4, 1], [4, 7], [7, 4],
        [3, 3], [3, 5], [5, 3],
      ],
      walls: [
        [2, 4], [6, 4], [4, 2], [4, 6],
      ],
    },
    description: '12 pierres, 4 murs, 35 coups. La consécration.',
    mapPos: { x: 0.7, y: 0.18 },
  },
];
