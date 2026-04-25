export const GAME_CONFIG = {
  grid: {
    cols: 9,
    rows: 9,
    tileSize: 60,
    numColors: 6,
  },
  canvas: {
    get width() { return GAME_CONFIG.grid.cols * GAME_CONFIG.grid.tileSize; },
    get height() { return GAME_CONFIG.grid.rows * GAME_CONFIG.grid.tileSize; },
    get totalWidth() {
      return GAME_CONFIG.canvas.legendWidth + GAME_CONFIG.canvas.width + GAME_CONFIG.canvas.shopWidth;
    },
    hudHeight: 72,
    legendWidth: 180,
    shopWidth: 200,
  },
  animation: {
    swapDuration: 0.2,
    fallDuration: 0.3,
    matchDuration: 0.25,
  },
  hint: {
    idleDelaySec: 5,
  },
  score: {
    perTile: 10,
  },
  colors: {
    background: 0x1a1a2e,
    boardBg: 0x242444,
    tiles: [
      0xff4757, // red
      0x2ed573, // green
      0x1e90ff, // blue
      0xffa502, // orange
      0xa55eea, // purple
      0xfeca57, // yellow
    ],
  },
} as const;
