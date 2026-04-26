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
    background: 0x141422,
    boardBg: 0x1f1f36,
    tiles: [
      0xe85a71, // rose-red (warm, dominant red)
      0x3aaf7a, // green
      0x4a8df2, // soft blue
      0xf5a142, // amber-orange
      0xa977e6, // lavender-purple
      0xec5db8, // vivid magenta/pink (clearly separated from red and purple)
    ],
  },
} as const;
