import {
  Container,
  Graphics,
  Text,
  TextStyle,
  type FederatedPointerEvent,
} from 'pixi.js';
import { gsap } from 'gsap';
import { Button } from '@/ui/Button';
import { SaveData } from '@/save/SaveData';
import { LEVELS, type LevelDef } from '@/levels/levels';

interface LevelSelectOptions {
  width: number;
  height: number;
  onBack: () => void;
  onSelect: (def: LevelDef) => void;
}

const HEADER_H = 76;
const NODE_RADIUS = 38;
/** Levels per row; 5×5 = 25. */
const COLS = 5;
/** Vertical spacing between rows. Generous padding for legibility. */
const ROW_HEIGHT = 130;
/** Reserved bottom space for the preview panel. */
const PREVIEW_H = 180;
/** Top padding of the first row inside the scrollable area. */
const GRID_TOP_PADDING = 60;

interface NodeBand {
  base: number;
  border: number;
  hover: number;
}

/** Color band by difficulty tier. */
function bandForLevel(id: number): NodeBand {
  if (id <= 5) return { base: 0x2ed573, border: 0x21b560, hover: 0x3edc81 };
  if (id <= 10) return { base: 0xffa502, border: 0xd98b00, hover: 0xffb733 };
  if (id <= 15) return { base: 0xff6b6b, border: 0xd94747, hover: 0xff8585 };
  if (id <= 20) return { base: 0xa55eea, border: 0x8042c7, hover: 0xbb7dfa };
  return { base: 0x4a8df2, border: 0x2f6ec9, hover: 0x6ba5fa }; // boss tier
}

/**
 * Vertical-scrolling level grid. 5 columns × 5 rows. Bottom row = lowest levels
 * (1–5), top row = boss tier (21–25). Rows alternate left-to-right and
 * right-to-left so the progression path snakes upward — the player feels like
 * they're climbing.
 *
 * Levels beyond `highestUnlocked` are rendered as silhouettes (no number, dim
 * colors). The scroll auto-centers on the next-to-play level on arrival.
 */
export class LevelSelectScene extends Container {
  private width0: number;
  private height0: number;
  private onSelect: (def: LevelDef) => void;
  private previewContainer: Container | null = null;
  private nodeContainers: Map<number, Container> = new Map();

  /** Inner container holding path + nodes; scrolls vertically inside the viewport. */
  private mapContainer: Container;
  /** Total scrollable height (logical). */
  private mapContentHeight: number;
  /** Visible viewport height for the map. */
  private mapViewportHeight: number;
  private mapViewportTop: number;

  private scrollY = 0;
  private dragging = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;
  private dragMoved = false;
  private wheelHandler: ((e: WheelEvent) => void) | null = null;

  constructor(opts: LevelSelectOptions) {
    super();
    this.width0 = opts.width;
    this.height0 = opts.height;
    this.onSelect = opts.onSelect;

    // Background — three distinct zones aligned with the layout:
    //   1. Dark base (full screen)
    //   2. Lighter map zone (between header and preview) — this is where the
    //      scrollable nodes live, so the lighter shade frames them naturally
    //   3. Header band (a touch darker than the base for separation)
    //
    // The map-zone rect is sized to `mapViewportTop` and `mapViewportHeight`,
    // so it stays consistent with the mask geometry. If we ever change the
    // header or preview heights, both the visuals and the clipping update
    // together.
    const bg = new Graphics();
    bg.rect(0, 0, opts.width, opts.height).fill(0x0e0e1a);
    this.addChild(bg);

    const mapZoneTop = HEADER_H;
    const mapZoneHeight = opts.height - HEADER_H - PREVIEW_H;
    const mapZoneBg = new Graphics();
    mapZoneBg.rect(0, mapZoneTop, opts.width, mapZoneHeight).fill(0x141422);
    this.addChild(mapZoneBg);

    // Header
    const headerBg = new Graphics();
    headerBg.rect(0, 0, opts.width, HEADER_H).fill({ color: 0x000000, alpha: 0.4 });
    this.addChild(headerBg);

    const back = new Button({
      label: '← MENU',
      width: 110,
      height: 36,
      fontSize: 14,
      bgColor: 0x3a3a45,
      hoverColor: 0x55555f,
      onClick: opts.onBack,
    });
    back.x = 20;
    back.y = (HEADER_H - 36) / 2;
    this.addChild(back);

    const title = new Text({
      text: 'CARTE DES NIVEAUX',
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 24,
        fill: 0xffffff,
        fontWeight: 'bold',
        letterSpacing: 4,
      }),
    });
    title.anchor.set(0.5, 0.5);
    title.x = opts.width / 2;
    title.y = HEADER_H / 2;
    this.addChild(title);

    // ---- Scrollable grid area -------------------------------------------
    this.mapViewportTop = HEADER_H;
    this.mapViewportHeight = opts.height - HEADER_H - PREVIEW_H;
    const numRows = Math.ceil(LEVELS.length / COLS);
    this.mapContentHeight = GRID_TOP_PADDING + numRows * ROW_HEIGHT + 40;

    // Architecture:
    //   mapViewport (fixed position, holds the mask) →
    //     mapContainer (scrolls vertically; clipped by mask)
    //
    // The mask MUST live in the same parent as the masked content but with a
    // transform that does NOT scroll. If we put the mask directly on `this`
    // and apply it to mapContainer, Pixi composes the transforms and the mask
    // ends up scrolling along with mapContainer. The intermediate viewport
    // container fixes that: its y is constant, the mask sits at y=0 in its
    // local frame, and only mapContainer moves inside it.
    const mapViewport = new Container();
    mapViewport.x = 0;
    mapViewport.y = this.mapViewportTop;
    this.addChild(mapViewport);

    this.mapContainer = new Container();
    this.mapContainer.x = 0;
    this.mapContainer.y = 0;
    mapViewport.addChild(this.mapContainer);

    const maskGfx = new Graphics();
    maskGfx.rect(0, 0, opts.width, this.mapViewportHeight).fill(0xffffff);
    mapViewport.addChild(maskGfx);
    this.mapContainer.mask = maskGfx;

    // Drag-catcher: an invisible rect behind the path/nodes that captures
    // pointer events in EMPTY areas of the map. Critical detail: this lives
    // INSIDE mapContainer (so it scrolls with content), but it's added first
    // so its z-order is below nodes. Nodes intercept their own pointer events
    // before they reach the catcher, so `pointertap` on a node still works.
    //
    // Why not `mapContainer.hitArea`? Setting hitArea on the parent shadows
    // its children — events stop at the parent and never reach the nodes.
    // A sibling Graphics with its own bounds keeps the natural propagation.
    const dragCatcher = new Graphics();
    dragCatcher
      .rect(0, 0, opts.width, this.mapContentHeight)
      .fill({ color: 0x000000, alpha: 0 }); // fully transparent but interactive
    dragCatcher.eventMode = 'static';
    dragCatcher.on('pointerdown', this.onDragStart);
    dragCatcher.on('pointermove', this.onDragMove);
    dragCatcher.on('pointerup', this.onDragEnd);
    dragCatcher.on('pointerupoutside', this.onDragEnd);
    this.mapContainer.addChild(dragCatcher);

    // Wheel scroll on the canvas
    this.wheelHandler = (e: WheelEvent) => {
      if (!this.parent) return;
      e.preventDefault();
      this.applyScroll(this.scrollY + e.deltaY);
    };
    window.addEventListener('wheel', this.wheelHandler, { passive: false });

    // ---- Compute node positions in grid --------------------------------
    const nodePositions = LEVELS.map((_, i) => this.gridPositionFor(i));

    // Path between consecutive nodes (drawn behind nodes)
    this.drawPath(nodePositions);

    // Nodes
    for (let i = 0; i < LEVELS.length; i++) {
      const def = LEVELS[i];
      const pos = nodePositions[i];
      const node = this.buildNode(def, pos.x, pos.y);
      this.mapContainer.addChild(node);
      this.nodeContainers.set(def.id, node);
    }

    // ---- Auto-scroll to the next-to-beat level -------------------------
    const progress = SaveData.get();
    const target =
      LEVELS.find((l) => l.id === progress.highestUnlocked) ?? LEVELS[0];
    const targetPos = this.gridPositionFor(target.id - 1);
    // Center the target within the viewport
    this.applyScroll(targetPos.y - this.mapViewportHeight / 2, false);
    this.showPreview(target);

    // Scroll hint at the bottom
    const hint = new Text({
      text: 'Glisse vers le haut pour voir la suite • Molette pour défiler',
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 11,
        fill: 0x6a6a7e,
      }),
    });
    hint.anchor.set(0.5, 1);
    hint.x = opts.width / 2;
    hint.y = opts.height - 12;
    this.addChild(hint);
  }

  /**
   * Position of the node for `levelIndex` (0-based) in the scrollable grid.
   * Bottom row holds levels 1–5 (highest Y), top row holds 21–25 (lowest Y).
   * Even rows (counting from the bottom) go left-to-right; odd rows reverse.
   * This creates a snaking path from bottom-left up to top-right (or top-left).
   */
  private gridPositionFor(levelIndex: number): { x: number; y: number } {
    const rowFromBottom = Math.floor(levelIndex / COLS);
    const colInRow = levelIndex % COLS;
    // Snake: alternate rows reverse direction.
    const reversed = rowFromBottom % 2 === 1;
    const effectiveCol = reversed ? COLS - 1 - colInRow : colInRow;

    const totalRows = Math.ceil(LEVELS.length / COLS);
    // Y: bottom row at the bottom of the scrollable area, top row at the top.
    const yFromTop =
      GRID_TOP_PADDING + (totalRows - 1 - rowFromBottom) * ROW_HEIGHT;
    // X: equal spacing across the viewport width
    const colWidth = this.width0 / COLS;
    const x = colWidth / 2 + effectiveCol * colWidth;

    return { x, y: yFromTop };
  }

  // -------- Drag-to-scroll --------------------------------------------------

  private onDragStart = (e: FederatedPointerEvent): void => {
    this.dragging = true;
    this.dragStartY = e.global.y;
    this.dragStartScrollY = this.scrollY;
    this.dragMoved = false;
  };

  private onDragMove = (e: FederatedPointerEvent): void => {
    if (!this.dragging) return;
    const dy = e.global.y - this.dragStartY;
    // Drag threshold: until the pointer has moved 8 pixels, treat the gesture
    // as a potential click and DO NOT scroll. This avoids two problems:
    //   1. Tiny mouse jitters between pointerdown and pointerup canceling clicks
    //   2. The map "scrolling by 0.5px" on every click, which feels broken.
    if (Math.abs(dy) <= 8) return;
    this.dragMoved = true;
    this.applyScroll(this.dragStartScrollY - dy, false);
  };

  private onDragEnd = (): void => {
    this.dragging = false;
    // Defer the reset so any synchronous click handler (node pointerup) can
    // still see the dragMoved flag set. We clear it on the next animation
    // frame so the very next interaction starts fresh.
    requestAnimationFrame(() => {
      this.dragMoved = false;
    });
  };

  /** Clamps scroll to [0, contentHeight - viewportHeight]. */
  private applyScroll(target: number, animated = false): void {
    const max = Math.max(0, this.mapContentHeight - this.mapViewportHeight);
    const clamped = Math.max(0, Math.min(max, target));
    this.scrollY = clamped;
    // mapContainer lives inside the fixed-position mapViewport, so y here is
    // a local offset (negative = scrolled up). The mask is anchored to the
    // viewport, not the content, so it doesn't move with this.
    const targetY = -clamped;
    if (animated) {
      gsap.to(this.mapContainer, {
        y: targetY,
        duration: 0.4,
        ease: 'power2.out',
      });
    } else {
      this.mapContainer.y = targetY;
    }
  }

  // -------- Path -----------------------------------------------------------

  private drawPath(positions: { x: number; y: number }[]): void {
    const path = new Graphics();
    const progress = SaveData.get();
    for (let i = 0; i < positions.length - 1; i++) {
      const a = positions[i];
      const b = positions[i + 1];
      const completed = LEVELS[i + 1].id <= progress.highestUnlocked;
      const visible = LEVELS[i].id <= progress.highestUnlocked;
      // Hide path beyond the player's progression so the future stays mysterious.
      if (!visible) continue;
      const color = completed ? 0xffd95e : 0x44445a;
      const alpha = completed ? 0.85 : 0.4;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const steps = Math.max(2, Math.floor(dist / 16));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const x = a.x + dx * t;
        const y = a.y + dy * t;
        path.circle(x, y, 3).fill({ color, alpha });
      }
    }
    this.mapContainer.addChild(path);
  }

  // -------- Node building --------------------------------------------------

  private buildNode(def: LevelDef, cx: number, cy: number): Container {
    const wrap = new Container();
    wrap.x = cx;
    wrap.y = cy;

    const progress = SaveData.get();
    const unlocked = SaveData.isUnlocked(def.id);
    const best = SaveData.bestScore(def.id);
    /**
     * "Hidden" levels are anything beyond `highestUnlocked`. We render a
     * silhouette without a number; the player only sees what's earned + the
     * next challenge.
     */
    const hidden = def.id > progress.highestUnlocked;

    const band = unlocked && !hidden
      ? bandForLevel(def.id)
      : { base: 0x2a2a35, border: 0x1a1a25, hover: 0x2a2a35 };

    const shadow = new Graphics();
    shadow.circle(0, 5, NODE_RADIUS).fill({ color: 0x000000, alpha: 0.4 });
    wrap.addChild(shadow);

    const circle = new Graphics();
    circle.circle(0, 0, NODE_RADIUS).fill(band.base);
    circle.circle(0, 0, NODE_RADIUS).stroke({ color: band.border, width: 4 });
    wrap.addChild(circle);

    if (hidden) {
      // Silhouette: 🔒 emoji, no number. Reduced alpha for "fog".
      const lock = new Text({
        text: '🔒',
        style: new TextStyle({
          fontFamily: 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
          fontSize: 30,
        }),
      });
      lock.anchor.set(0.5);
      wrap.addChild(lock);
      wrap.alpha = 0.55;
    } else if (unlocked) {
      // Highlight gloss
      const gloss = new Graphics();
      gloss
        .ellipse(-NODE_RADIUS * 0.3, -NODE_RADIUS * 0.4, NODE_RADIUS * 0.6, NODE_RADIUS * 0.3)
        .fill({ color: 0xffffff, alpha: 0.32 });
      wrap.addChild(gloss);

      // Level number
      const num = new Text({
        text: String(def.id),
        style: new TextStyle({
          fontFamily: 'system-ui, Arial, sans-serif',
          fontSize: 28,
          fill: 0xffffff,
          fontWeight: 'bold',
          stroke: { color: 0x000000, width: 2 },
        }),
      });
      num.anchor.set(0.5);
      wrap.addChild(num);

      // Best-score star (below the node)
      if (best > 0) {
        const star = new Text({
          text: `★ ${best}`,
          style: new TextStyle({
            fontFamily: 'system-ui, Arial, sans-serif',
            fontSize: 12,
            fill: 0xffd95e,
            fontWeight: 'bold',
          }),
        });
        star.anchor.set(0.5, 0);
        star.y = NODE_RADIUS + 8;
        wrap.addChild(star);
      }
    } else {
      // Locked-but-known levels (defensive; the hidden branch above usually catches these)
      const lock = new Text({
        text: '🔒',
        style: new TextStyle({
          fontFamily: 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
          fontSize: 30,
        }),
      });
      lock.anchor.set(0.5);
      wrap.addChild(lock);
    }

    if (unlocked && !hidden) {
      wrap.eventMode = 'static';
      wrap.cursor = 'pointer';
      wrap.on('pointerover', () => {
        circle.clear();
        circle.circle(0, 0, NODE_RADIUS).fill(band.hover);
        circle.circle(0, 0, NODE_RADIUS).stroke({ color: band.border, width: 4 });
        gsap.to(wrap.scale, { x: 1.1, y: 1.1, duration: 0.15, ease: 'power2.out' });
      });
      wrap.on('pointerout', () => {
        circle.clear();
        circle.circle(0, 0, NODE_RADIUS).fill(band.base);
        circle.circle(0, 0, NODE_RADIUS).stroke({ color: band.border, width: 4 });
        gsap.to(wrap.scale, { x: 1, y: 1, duration: 0.15, ease: 'power2.out' });
      });
      // Use pointerup (not pointertap) to be robust to the cursor moving
      // slightly during the click — pointertap is more strict about the
      // pointerdown and pointerup landing on the same target, which fails
      // when GSAP scales the node up on hover. Pointerup on the node fires
      // as long as the cursor is over the node when the button releases.
      wrap.on('pointerup', () => {
        if (this.dragMoved) return;
        this.showPreview(def);
      });

      // Idle pulse on the next-to-beat level
      if (def.id === progress.highestUnlocked && best === 0) {
        gsap.to(wrap.scale, {
          x: 1.12,
          y: 1.12,
          duration: 0.9,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      }
    }

    return wrap;
  }

  // -------- Preview panel --------------------------------------------------

  private showPreview(def: LevelDef): void {
    if (this.previewContainer) {
      this.removeChild(this.previewContainer);
      this.previewContainer.destroy({ children: true });
      this.previewContainer = null;
    }

    const panel = new Container();
    const panelW = Math.min(560, this.width0 - 80);
    const panelH = 140;
    const panelX = (this.width0 - panelW) / 2;
    const panelY = this.height0 - PREVIEW_H + 20;

    const bg = new Graphics();
    bg.roundRect(panelX, panelY, panelW, panelH, 14).fill({ color: 0x1f1f36, alpha: 0.95 });
    bg.roundRect(panelX, panelY, panelW, panelH, 14).stroke({ color: 0xffd95e, width: 2 });
    panel.addChild(bg);

    const titleText = new Text({
      text: `NIVEAU ${def.id} — ${def.name.toUpperCase()}`,
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 16,
        fill: 0xffd95e,
        fontWeight: 'bold',
        letterSpacing: 1,
      }),
    });
    titleText.x = panelX + 20;
    titleText.y = panelY + 14;
    panel.addChild(titleText);

    const desc = new Text({
      text: def.description,
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 13,
        fill: 0xc4c4d4,
        wordWrap: true,
        wordWrapWidth: panelW - 200,
      }),
    });
    desc.x = panelX + 20;
    desc.y = panelY + 40;
    panel.addChild(desc);

    // Stats row
    const stats = new Text({
      text: `Coups : ${def.moves}    ${this.objectiveLabel(def)}`,
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 12,
        fill: 0x8a8a9e,
      }),
    });
    stats.x = panelX + 20;
    stats.y = panelY + panelH - 28;
    panel.addChild(stats);

    // Best
    const best = SaveData.bestScore(def.id);
    if (best > 0) {
      const bestText = new Text({
        text: `★ Meilleur : ${best}`,
        style: new TextStyle({
          fontFamily: 'system-ui, Arial, sans-serif',
          fontSize: 12,
          fill: 0xffd95e,
          fontWeight: 'bold',
        }),
      });
      bestText.x = panelX + 20;
      bestText.y = panelY + panelH - 48;
      panel.addChild(bestText);
    }

    // PLAY button
    const play = new Button({
      label: '▶ JOUER',
      width: 130,
      height: 44,
      fontSize: 16,
      bgColor: 0x2ed573,
      hoverColor: 0x3edc81,
      onClick: () => this.onSelect(def),
    });
    play.x = panelX + panelW - 150;
    play.y = panelY + (panelH - 44) / 2;
    panel.addChild(play);

    this.addChild(panel);
    this.previewContainer = panel;

    // Subtle entrance
    panel.alpha = 0;
    gsap.to(panel, { alpha: 1, duration: 0.18, ease: 'power2.out' });
  }

  private objectiveLabel(def: LevelDef): string {
    const obj = def.objective;
    if (obj.type === 'score') return `Objectif : ${obj.target} pts`;
    if (obj.type === 'destroy-stones') return `Objectif : ${obj.target} pierres`;
    return `Objectif : ${obj.target} tuiles`;
  }

  destroy(options?: Parameters<Container['destroy']>[0]): void {
    if (this.wheelHandler) {
      window.removeEventListener('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
    super.destroy(options);
  }
}
