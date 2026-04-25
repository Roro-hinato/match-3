import { Container, Graphics, Text } from 'pixi.js';
import { gsap } from 'gsap';
import { GAME_CONFIG } from '@/config';
import type { Grid } from '@/core/Grid';
import type { Position, TileKind } from '@/core/types';
import { tween } from '@/utils/tween';
import { TileView } from './TileView';

export class BoardView extends Container {
  private tiles: (TileView | null)[][] = [];
  private bg: Graphics;
  public selectionMarker: Graphics;
  private comboText: Text | null = null;
  private hintTiles: TileView[] = [];

  constructor(private grid: Grid) {
    super();

    this.bg = new Graphics();
    const size = GAME_CONFIG.grid.tileSize;
    // Per-cell background squares — skips void cells, so the board takes the
    // shape of the playfield (e.g. T-shape, U-shape, cross).
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const t = grid.get(r, c);
        if (t && t.kind === 'void') continue;
        this.bg
          .roundRect(c * size + 2, r * size + 2, size - 4, size - 4, 6)
          .fill({ color: GAME_CONFIG.colors.boardBg, alpha: 0.85 });
      }
    }
    this.addChild(this.bg);

    this.selectionMarker = new Graphics();
    this.selectionMarker
      .roundRect(-size / 2 + 2, -size / 2 + 2, size - 4, size - 4, 12)
      .stroke({ color: 0xffffff, width: 3 });
    this.selectionMarker.visible = false;
    this.addChild(this.selectionMarker);

    this.buildFromGrid();
  }

  private buildFromGrid(): void {
    this.tiles = Array.from({ length: this.grid.rows }, () =>
      Array.from({ length: this.grid.cols }, () => null),
    );
    for (let row = 0; row < this.grid.rows; row++) {
      for (let col = 0; col < this.grid.cols; col++) {
        const t = this.grid.get(row, col);
        if (t === null) continue;
        // Void tiles ARE rendered (so the grid shape is visible), but they
        // don't accept clicks — pixelToCell returns null on void.
        const tile = new TileView(t.color, t.kind, { row, col });
        const p = this.cellToPixel({ row, col });
        tile.x = p.x;
        tile.y = p.y;
        this.addChild(tile);
        this.tiles[row][col] = tile;
      }
    }
    this.setChildIndex(this.selectionMarker, this.children.length - 1);
  }

  cellToPixel(pos: Position): { x: number; y: number } {
    const s = GAME_CONFIG.grid.tileSize;
    return { x: pos.col * s + s / 2, y: pos.row * s + s / 2 };
  }

  pixelToCell(x: number, y: number): Position | null {
    const s = GAME_CONFIG.grid.tileSize;
    const col = Math.floor(x / s);
    const row = Math.floor(y / s);
    if (row < 0 || row >= this.grid.rows || col < 0 || col >= this.grid.cols) return null;
    const t = this.grid.get(row, col);
    if (t && t.kind === 'void') return null;
    return { row, col };
  }

  getTile(pos: Position): TileView | null {
    return this.tiles[pos.row]?.[pos.col] ?? null;
  }

  showSelection(pos: Position | null): void {
    if (!pos) {
      this.selectionMarker.visible = false;
      return;
    }
    const p = this.cellToPixel(pos);
    this.selectionMarker.x = p.x;
    this.selectionMarker.y = p.y;
    this.selectionMarker.visible = true;
  }

  /** Switches the board cursor between default and hammer-mode. */
  setHammerCursor(on: boolean): void {
    this.cursor = on ? 'crosshair' : 'default';
    // Tint the board background slightly to telegraph hammer mode.
    this.bg.tint = on ? 0xffc979 : 0xffffff;
  }

  async animateSwap(a: Position, b: Position): Promise<void> {
    const ta = this.getTile(a);
    const tb = this.getTile(b);
    if (!ta || !tb) return;
    const pa = this.cellToPixel(a);
    const pb = this.cellToPixel(b);
    this.tiles[a.row][a.col] = tb;
    this.tiles[b.row][b.col] = ta;
    ta.setGridPos(b);
    tb.setGridPos(a);
    await Promise.all([
      tween(ta, { x: pb.x, y: pb.y, duration: GAME_CONFIG.animation.swapDuration, ease: 'power2.out' }),
      tween(tb, { x: pa.x, y: pa.y, duration: GAME_CONFIG.animation.swapDuration, ease: 'power2.out' }),
    ]);
  }

  async animateRemove(positions: Position[]): Promise<void> {
    const tiles = positions
      .map((p) => this.tiles[p.row]?.[p.col])
      .filter((t): t is TileView => t != null);
    await Promise.all(tiles.map((t) => t.playExplodeAnimation()));
    for (const pos of positions) {
      const tile = this.tiles[pos.row]?.[pos.col];
      if (tile) {
        this.removeChild(tile);
        tile.destroy({ children: true });
        this.tiles[pos.row][pos.col] = null;
      }
    }
  }

  async animateGravity(moves: { from: Position; to: Position }[]): Promise<void> {
    // Apply all model updates first; collect a single final target per sprite.
    // Two reasons:
    //   1. Diagonal slides require tweening X as well as Y. The old code only
    //      tweened Y, so slid tiles ended up visually stuck in the wrong column.
    //   2. A sprite can appear in multiple moves in one gravity pass (e.g. it
    //      slides diagonally, then a follow-up vertical pass moves it again).
    //      Stacking two GSAP tweens on the same target causes property conflicts;
    //      we deduplicate by mapping each tile to its final pixel target.
    const targetByTile = new Map<TileView, { x: number; y: number }>();
    for (const m of moves) {
      const tile = this.tiles[m.from.row][m.from.col];
      if (!tile) continue;
      this.tiles[m.to.row][m.to.col] = tile;
      this.tiles[m.from.row][m.from.col] = null;
      tile.setGridPos(m.to);
      targetByTile.set(tile, this.cellToPixel(m.to));
    }
    await Promise.all(
      Array.from(targetByTile.entries()).map(([tile, target]) =>
        tween(tile, {
          x: target.x,
          y: target.y,
          duration: GAME_CONFIG.animation.fallDuration,
          ease: 'bounce.out',
        }),
      ),
    );
  }

  async animateSpawn(positions: Position[]): Promise<void> {
    const created: { tile: TileView; targetY: number }[] = [];
    for (const pos of positions) {
      const t = this.grid.get(pos.row, pos.col);
      if (t === null) continue;
      if (t.kind === 'void') continue;
      const tile = new TileView(t.color, t.kind, pos);
      const target = this.cellToPixel(pos);
      tile.x = target.x;
      tile.y = -GAME_CONFIG.grid.tileSize;
      this.addChild(tile);
      this.tiles[pos.row][pos.col] = tile;
      created.push({ tile, targetY: target.y });
    }
    this.setChildIndex(this.selectionMarker, this.children.length - 1);
    await Promise.all(
      created.map(({ tile, targetY }) =>
        tween(tile, {
          y: targetY,
          duration: GAME_CONFIG.animation.fallDuration,
          ease: 'bounce.out',
        }),
      ),
    );
  }

  /** Upgrades a normal tile to a special kind with a celebration pulse. */
  async convertTile(pos: Position, kind: TileKind): Promise<void> {
    const tile = this.tiles[pos.row]?.[pos.col];
    if (!tile) return;
    tile.setKind(kind);
    await tile.playUpgradeAnimation();
  }

  showScorePopup(x: number, y: number, points: number, color: number): void {
    const text = new Text({
      text: `+${points}`,
      style: {
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 28,
        fill: color,
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 3 },
      },
    });
    text.anchor.set(0.5);
    text.x = x;
    text.y = y;
    text.scale.set(0.4);
    this.addChild(text);
    this.setChildIndex(this.selectionMarker, this.children.length - 1);

    const tl = gsap.timeline({
      onComplete: () => {
        if (text.parent) this.removeChild(text);
        text.destroy();
      },
    });
    tl.to(text.scale, { x: 1.2, y: 1.2, duration: 0.18, ease: 'back.out' })
      .to(text.scale, { x: 1, y: 1, duration: 0.12 })
      .to(text, { y: y - 70, alpha: 0, duration: 0.6, ease: 'power2.in' }, '-=0.1');
  }

  showCombo(multiplier: number): void {
    if (this.comboText) {
      gsap.killTweensOf(this.comboText);
      gsap.killTweensOf(this.comboText.scale);
      if (this.comboText.parent) this.removeChild(this.comboText);
      this.comboText.destroy();
      this.comboText = null;
    }

    const text = new Text({
      text: `COMBO x${multiplier}!`,
      style: {
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 56,
        fill: comboColor(multiplier),
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 5 },
      },
    });
    text.anchor.set(0.5);
    text.x = (this.grid.cols * GAME_CONFIG.grid.tileSize) / 2;
    text.y = (this.grid.rows * GAME_CONFIG.grid.tileSize) / 2;
    text.scale.set(0.2);
    text.alpha = 0;
    this.addChild(text);
    this.setChildIndex(this.selectionMarker, this.children.length - 1);
    this.comboText = text;

    const tl = gsap.timeline({
      onComplete: () => {
        if (text.parent) this.removeChild(text);
        text.destroy();
        if (this.comboText === text) this.comboText = null;
      },
    });
    tl.to(text, { alpha: 1, duration: 0.1 }, 0)
      .to(text.scale, { x: 1.2, y: 1.2, duration: 0.2, ease: 'back.out' }, 0)
      .to(text.scale, { x: 1, y: 1, duration: 0.15 })
      .to(text, { alpha: 0, duration: 0.5, ease: 'power2.in' }, '+=0.35');
  }

  /**
   * Pulses two tiles in a yoyo loop to hint at a playable swap.
   * Safe to call repeatedly: any running hint is cleared first.
   */
  showHint(a: Position, b: Position): void {
    this.clearHint();
    const ta = this.getTile(a);
    const tb = this.getTile(b);
    if (!ta || !tb) return;
    this.hintTiles = [ta, tb];
    for (const t of this.hintTiles) {
      gsap.to(t.scale, {
        x: 1.18,
        y: 1.18,
        duration: 0.45,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    }
  }

  clearHint(): void {
    for (const t of this.hintTiles) {
      gsap.killTweensOf(t.scale);
      gsap.to(t.scale, { x: 1, y: 1, duration: 0.15, ease: 'power2.out' });
    }
    this.hintTiles = [];
  }

  /**
   * Fades out every existing tile, then rebuilds from the (freshly shuffled)
   * grid with a staggered fall from above — same vocabulary as the spawn anim.
   */
  async animateReshuffle(): Promise<void> {
    this.clearHint();
    const existing = this.tiles.flat().filter((t): t is TileView => t != null);
    await Promise.all(
      existing.map((t) =>
        tween(t, { alpha: 0, duration: 0.25, ease: 'power2.in' }),
      ),
    );
    for (const t of existing) {
      this.removeChild(t);
      t.destroy({ children: true });
    }
    this.tiles = Array.from({ length: this.grid.rows }, () =>
      Array.from({ length: this.grid.cols }, () => null),
    );

    const newTiles: { tile: TileView; targetY: number }[] = [];
    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        const t = this.grid.get(r, c);
        if (!t) continue;
        const tile = new TileView(t.color, t.kind, { row: r, col: c });
        const target = this.cellToPixel({ row: r, col: c });
        tile.x = target.x;
        tile.y = -GAME_CONFIG.grid.tileSize - r * 12;
        this.addChild(tile);
        this.tiles[r][c] = tile;
        newTiles.push({ tile, targetY: target.y });
      }
    }
    this.setChildIndex(this.selectionMarker, this.children.length - 1);
    await Promise.all(
      newTiles.map(({ tile, targetY }) =>
        tween(tile, {
          y: targetY,
          duration: GAME_CONFIG.animation.fallDuration * 1.3,
          ease: 'bounce.out',
        }),
      ),
    );
  }
}

function comboColor(multiplier: number): number {
  if (multiplier >= 5) return 0xff4757;
  if (multiplier >= 4) return 0xff9800;
  if (multiplier >= 3) return 0xffeb3b;
  if (multiplier >= 2) return 0x7bed9f;
  return 0xffffff;
}
