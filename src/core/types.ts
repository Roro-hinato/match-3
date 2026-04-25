export type TileColor = number;

/** Every cell is a Tile. Normal/special tiles are matchable; walls & stones are obstacles; void is "no cell". */
export type TileKind =
  | 'normal'
  | 'striped-h'
  | 'striped-v'
  | 'wrapped'
  | 'color-bomb'
  | 'wall' // indestructible
  | 'stone' // destructible: cleared when a match lands on it or adjacent
  | 'void'; // not part of the playable grid (used for shaped levels)

export interface Tile {
  color: TileColor;
  kind: TileKind;
}

export function tile(color: TileColor, kind: TileKind = 'normal'): Tile {
  return { color, kind };
}

export function wall(): Tile {
  return { color: 0, kind: 'wall' };
}

export function stone(): Tile {
  return { color: 0, kind: 'stone' };
}

export function voidCell(): Tile {
  return { color: 0, kind: 'void' };
}

export function isSpecial(t: Tile | null | undefined): boolean {
  if (!t) return false;
  return t.kind === 'striped-h' || t.kind === 'striped-v' || t.kind === 'wrapped' || t.kind === 'color-bomb';
}

/** Can this cell participate in color matches? Walls/stones/void cannot. */
export function isMatchable(t: Tile | null | undefined): boolean {
  return t != null && t.kind !== 'wall' && t.kind !== 'stone' && t.kind !== 'void';
}

/** Does this cell stay put under gravity? Walls/stones/void do. */
export function isImmovable(t: Tile | null | undefined): boolean {
  return t != null && (t.kind === 'wall' || t.kind === 'stone' || t.kind === 'void');
}

/** Does the playfield exist at this cell? Void cells don't render and don't refill. */
export function isPlayable(t: Tile | null | undefined): boolean {
  return t == null || t.kind !== 'void';
}

export interface Position {
  row: number;
  col: number;
}

export type MatchOrientation = 'horizontal' | 'vertical';

export interface Match {
  positions: Position[];
  color: TileColor;
  orientation: MatchOrientation;
  length: number;
}

export type GridData = (Tile | null)[][];

export function posEquals(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

export function posKey(p: Position): string {
  return `${p.row},${p.col}`;
}

export function keyToPos(key: string): Position {
  const [row, col] = key.split(',').map(Number);
  return { row, col };
}
