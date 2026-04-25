import { Grid } from './Grid';
import { MatchDetector } from './MatchDetector';
import { tile, voidCell } from './types';

export class GridGenerator {
  /**
   * Creates a grid with no starting matches.
   * If `voidMask[r][c]` is true, that cell is set to a void tile (not playable).
   */
  static create(
    rows: number,
    cols: number,
    numColors: number,
    rng: () => number = Math.random,
    voidMask?: boolean[][],
  ): Grid {
    const grid = new Grid(rows, cols);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (voidMask && voidMask[row]?.[col]) {
          grid.set(row, col, voidCell());
          continue;
        }
        let tries = 0;
        let color: number;
        do {
          color = Math.floor(rng() * numColors);
          grid.set(row, col, tile(color));
          tries++;
        } while (MatchDetector.hasAnyMatch(grid) && tries < 40);
      }
    }
    return grid;
  }
}
