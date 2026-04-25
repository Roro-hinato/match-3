import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_CONFIG } from '@/config';
import type { Position, TileColor, TileKind } from '@/core/types';
import { tween } from '@/utils/tween';

export class TileView extends Container {
  public color: TileColor;
  public kind: TileKind;
  public gridPos: Position;
  public hits: number = 1;
  private gfx: Graphics;
  private hitsText: Text | null = null;

  constructor(color: TileColor, kind: TileKind, pos: Position, hits: number = 1) {
    super();
    this.color = color;
    this.kind = kind;
    this.gridPos = pos;
    this.hits = hits;
    this.gfx = new Graphics();
    this.addChild(this.gfx);
    this.redraw();
  }

  setKind(kind: TileKind): void {
    this.kind = kind;
    this.redraw();
  }

  setHits(hits: number): void {
    this.hits = hits;
    this.redraw();
  }

  setGridPos(pos: Position): void {
    this.gridPos = pos;
  }

  private redraw(): void {
    const size = GAME_CONFIG.grid.tileSize;
    const fill = GAME_CONFIG.colors.tiles[this.color % GAME_CONFIG.colors.tiles.length];
    this.gfx.clear();
    if (this.hitsText) {
      this.removeChild(this.hitsText);
      this.hitsText.destroy();
      this.hitsText = null;
    }

    if (this.kind === 'void') {
      this.drawVoid(size);
      this.visible = true;
      return;
    }
    this.visible = true;

    if (this.kind === 'wall') {
      this.drawWall(size);
      return;
    }
    if (this.kind === 'stone') {
      this.drawStone(size);
      if (this.hits > 1) {
        this.hitsText = new Text({
          text: String(this.hits),
          style: new TextStyle({
            fontFamily: 'system-ui, Arial, sans-serif',
            fontSize: 22,
            fill: 0xf5f5fa,
            fontWeight: 'bold',
            stroke: { color: 0x1a1a25, width: 3 },
          }),
        });
        this.hitsText.anchor.set(0.5);
        this.addChild(this.hitsText);
      }
      return;
    }
    if (this.kind === 'color-bomb') {
      this.drawColorBomb(size);
      return;
    }

    // Tile body: a smooth rounded square with a subtle inner highlight + lower-half shadow.
    // Aesthetic upgrade: more depth without abandoning the flat language.
    this.gfx.roundRect(-size / 2 + 4, -size / 2 + 4, size - 8, size - 8, 12).fill(fill);
    // Top highlight (~upper third)
    this.gfx
      .roundRect(-size / 2 + 8, -size / 2 + 8, size - 16, (size - 16) / 2.8, 8)
      .fill({ color: 0xffffff, alpha: 0.2 });
    // Bottom shadow (~lower fifth) for a hint of dimension
    const bottomH = (size - 16) / 5;
    this.gfx
      .roundRect(-size / 2 + 8, size / 2 - 8 - bottomH, size - 16, bottomH, 6)
      .fill({ color: 0x000000, alpha: 0.18 });

    if (this.kind === 'striped-h') {
      this.drawHorizontalStripes(size);
    } else if (this.kind === 'striped-v') {
      this.drawVerticalStripes(size);
    } else if (this.kind === 'wrapped') {
      this.drawWrapper(size, fill);
    }
  }

  private drawWall(size: number): void {
    // Dark bricked slab: no color, no life. The brick pattern signals "obstacle".
    this.gfx.roundRect(-size / 2 + 2, -size / 2 + 2, size - 4, size - 4, 4).fill(0x3a3a45);
    this.gfx.roundRect(-size / 2 + 2, -size / 2 + 2, size - 4, size - 4, 4).stroke({ color: 0x1a1a25, width: 2 });
    const half = size / 2;
    this.gfx.rect(-half + 6, -4, size - 12, 2).fill({ color: 0x1a1a25, alpha: 0.6 });
    this.gfx.rect(-6, -half + 6, 2, half - 10).fill({ color: 0x1a1a25, alpha: 0.6 });
    this.gfx.rect(4, 4, 2, half - 10).fill({ color: 0x1a1a25, alpha: 0.6 });
  }

  private drawVoid(size: number): void {
    // Flatter, darker than a wall — communicates "off the playfield" without
    // looking like an interactable obstacle. No brick lines, dim border.
    this.gfx
      .roundRect(-size / 2 + 4, -size / 2 + 4, size - 8, size - 8, 4)
      .fill(0x1a1a22);
    this.gfx
      .roundRect(-size / 2 + 4, -size / 2 + 4, size - 8, size - 8, 4)
      .stroke({ color: 0x0a0a12, width: 1 });
  }

  private drawStone(size: number): void {
    // Cracked gray block. Has a color but muted — cracks hint it can break.
    this.gfx.roundRect(-size / 2 + 4, -size / 2 + 4, size - 8, size - 8, 8).fill(0x7a7a88);
    this.gfx.roundRect(-size / 2 + 4, -size / 2 + 4, size - 8, size - 8, 8).stroke({ color: 0x4a4a55, width: 2 });
    // Cracks
    const cracks: [number, number, number, number][] = [
      [-14, -6, -4, 2],
      [-4, 2, 6, -2],
      [6, -2, 12, 6],
      [2, 10, 10, 14],
    ];
    for (const [x1, y1, x2, y2] of cracks) {
      this.gfx.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: 0x2a2a33, width: 1.5 });
    }
  }

  private drawHorizontalStripes(size: number): void {
    const inner = size - 16;
    const step = 9;
    const thickness = 3;
    for (let y = -inner / 2 + 4; y <= inner / 2 - 4; y += step) {
      this.gfx
        .rect(-size / 2 + 8, y - thickness / 2, inner, thickness)
        .fill({ color: 0xffffff, alpha: 0.75 });
    }
  }

  private drawVerticalStripes(size: number): void {
    const inner = size - 16;
    const step = 9;
    const thickness = 3;
    for (let x = -inner / 2 + 4; x <= inner / 2 - 4; x += step) {
      this.gfx
        .rect(x - thickness / 2, -size / 2 + 8, thickness, inner)
        .fill({ color: 0xffffff, alpha: 0.75 });
    }
  }

  private drawWrapper(size: number, fill: number): void {
    // White wrapper with a colored core + ribbon cross
    this.gfx
      .roundRect(-size / 2 + 10, -size / 2 + 10, size - 20, size - 20, 6)
      .fill(0xffffff);
    this.gfx
      .roundRect(-size / 2 + 14, -size / 2 + 14, size - 28, size - 28, 4)
      .fill(fill);
    this.gfx.rect(-size / 2 + 14, -2, size - 28, 4).fill({ color: 0xffffff, alpha: 0.9 });
    this.gfx.rect(-2, -size / 2 + 14, 4, size - 28).fill({ color: 0xffffff, alpha: 0.9 });
  }

  private drawColorBomb(size: number): void {
    // Dark sphere with 6 colored sparks around a bright core
    const r = size / 2 - 4;
    this.gfx.circle(0, 0, r).fill(0x0e0e18);
    this.gfx.circle(0, 0, r).stroke({ color: 0xffffff, width: 2, alpha: 0.6 });
    const colors = [0xff4757, 0xffa502, 0xfeca57, 0x2ed573, 0x1e90ff, 0xa55eea];
    const ringRadius = r * 0.55;
    for (let i = 0; i < colors.length; i++) {
      const angle = (i / colors.length) * Math.PI * 2 - Math.PI / 2;
      const dx = Math.cos(angle) * ringRadius;
      const dy = Math.sin(angle) * ringRadius;
      this.gfx.circle(dx, dy, 5).fill(colors[i]);
    }
    this.gfx.circle(0, 0, 7).fill(0xffffff);
  }

  /**
   * Two-phase explode: a quick scale-up with white flash, then shrink + fade + spin.
   * Used when a tile is cleared.
   */
  async playExplodeAnimation(): Promise<void> {
    const size = GAME_CONFIG.grid.tileSize;
    const overlay = new Graphics();
    overlay
      .roundRect(-size / 2 + 4, -size / 2 + 4, size - 8, size - 8, 10)
      .fill(0xffffff);
    overlay.alpha = 0;
    this.addChild(overlay);

    await Promise.all([
      tween(this.scale, { x: 1.3, y: 1.3, duration: 0.08, ease: 'back.out' }),
      tween(overlay, { alpha: 0.9, duration: 0.08 }),
    ]);
    await Promise.all([
      tween(this.scale, { x: 0.05, y: 0.05, duration: 0.18, ease: 'back.in' }),
      tween(this, { alpha: 0, duration: 0.18 }),
      tween(this, { rotation: Math.PI / 3, duration: 0.18 }),
      tween(overlay, { alpha: 0, duration: 0.18 }),
    ]);
  }

  /**
   * Celebration animation played when a normal tile is upgraded into a special.
   * Caller is responsible for calling setKind before or inside this animation.
   */
  async playUpgradeAnimation(): Promise<void> {
    await tween(this.scale, { x: 1.4, y: 1.4, duration: 0.14, ease: 'back.out' });
    await tween(this.scale, { x: 1, y: 1, duration: 0.14, ease: 'power2.out' });
  }
}
