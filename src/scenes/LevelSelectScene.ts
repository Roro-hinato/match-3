import { Container, Graphics, Text, TextStyle } from 'pixi.js';
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

const NODE_RADIUS = 36;
const HEADER_H = 76;

interface NodeBand {
  base: number;
  border: number;
  hover: number;
}

/** Color bands by difficulty — echoes classic overworld tile biomes. */
function bandForLevel(id: number): NodeBand {
  if (id <= 2) return { base: 0x2ed573, border: 0x21b560, hover: 0x3edc81 };
  if (id <= 4) return { base: 0xffa502, border: 0xd98b00, hover: 0xffb733 };
  if (id <= 6) return { base: 0xff6b6b, border: 0xd94747, hover: 0xff8585 };
  return { base: 0xa55eea, border: 0x8042c7, hover: 0xbb7dfa };
}

/**
 * Mario-like world map. Nodes are placed at (mapPos.x, mapPos.y) normalized
 * over the playable area (between the header and the footer). They are linked
 * by a dashed path. Unlocked nodes pulse; locked nodes are grey with a lock.
 * Clicking an unlocked node shows the level preview panel and a PLAY button.
 */
export class LevelSelectScene extends Container {
  private width0: number;
  private height0: number;
  private onSelect: (def: LevelDef) => void;
  private previewContainer: Container | null = null;
  private nodeContainers: Map<number, Container> = new Map();

  constructor(opts: LevelSelectOptions) {
    super();
    this.width0 = opts.width;
    this.height0 = opts.height;
    this.onSelect = opts.onSelect;

    // Background with subtle sky gradient (fake: two rects).
    const bg = new Graphics();
    bg.rect(0, 0, opts.width, opts.height).fill(0x1a2b4a);
    this.addChild(bg);
    const bgLower = new Graphics();
    bgLower.rect(0, opts.height * 0.55, opts.width, opts.height * 0.45).fill(0x0f1e38);
    this.addChild(bgLower);

    // Decorative stars
    const stars = new Graphics();
    const rand = mulberry32(42);
    for (let i = 0; i < 60; i++) {
      const x = rand() * opts.width;
      const y = rand() * opts.height * 0.55;
      const r = rand() < 0.8 ? 1 : 2;
      stars.circle(x, y, r).fill({ color: 0xffffff, alpha: 0.2 + rand() * 0.5 });
    }
    this.addChild(stars);

    // Header
    const headerBg = new Graphics();
    headerBg.rect(0, 0, opts.width, HEADER_H).fill({ color: 0x000000, alpha: 0.35 });
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
      text: 'MONDE DES BONBONS',
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 26,
        fill: 0xffffff,
        fontWeight: 'bold',
        letterSpacing: 4,
        stroke: { color: 0x2ed573, width: 2 },
      }),
    });
    title.anchor.set(0.5, 0.5);
    title.x = opts.width / 2;
    title.y = HEADER_H / 2;
    this.addChild(title);

    // Compute absolute node positions once — shared by path + nodes.
    const nodePositions = LEVELS.map((l) => this.nodeToPixel(l));

    // Draw the dashed path between consecutive nodes (behind nodes).
    this.drawPath(nodePositions);

    // Draw nodes
    for (let i = 0; i < LEVELS.length; i++) {
      const def = LEVELS[i];
      const pos = nodePositions[i];
      const node = this.buildNode(def, pos.x, pos.y);
      this.addChild(node);
      this.nodeContainers.set(def.id, node);
    }

    // Auto-select the latest unlocked level so the preview is ready on arrival.
    const progress = SaveData.get();
    const firstUnplayed =
      LEVELS.find((l) => l.id === progress.highestUnlocked) ?? LEVELS[0];
    this.showPreview(firstUnplayed);

    // Footer hint
    const hint = new Text({
      text: 'Clique sur un niveau débloqué',
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 11,
        fill: 0x8a8a9e,
      }),
    });
    hint.anchor.set(0.5, 1);
    hint.x = opts.width / 2;
    hint.y = opts.height - 12;
    this.addChild(hint);
  }

  // ---- Layout ----

  private nodeToPixel(def: LevelDef): { x: number; y: number } {
    // The playable area excludes header and a bottom margin for the preview.
    const topY = HEADER_H + 20;
    const bottomMargin = 180; // keep space for the preview panel
    const areaH = this.height0 - topY - bottomMargin;
    const areaW = this.width0 - 40;
    return {
      x: 20 + def.mapPos.x * areaW,
      y: topY + def.mapPos.y * areaH,
    };
  }

  private drawPath(positions: { x: number; y: number }[]): void {
    const path = new Graphics();
    const progress = SaveData.get();
    for (let i = 0; i < positions.length - 1; i++) {
      const a = positions[i];
      const b = positions[i + 1];
      // Path segment is "completed" when the next node is reachable.
      const completed = LEVELS[i + 1].id <= progress.highestUnlocked;
      const color = completed ? 0xffd95e : 0x44445a;
      const alpha = completed ? 0.85 : 0.6;
      // Dashed line: dots every 10 px along the segment.
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const steps = Math.max(2, Math.floor(dist / 14));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const x = a.x + dx * t;
        const y = a.y + dy * t;
        path.circle(x, y, 3).fill({ color, alpha });
      }
    }
    this.addChild(path);
  }

  // ---- Node building ----

  private buildNode(def: LevelDef, cx: number, cy: number): Container {
    const wrap = new Container();
    wrap.x = cx;
    wrap.y = cy;

    const unlocked = SaveData.isUnlocked(def.id);
    const best = SaveData.bestScore(def.id);
    const band = unlocked ? bandForLevel(def.id) : { base: 0x3a3a45, border: 0x222228, hover: 0x3a3a45 };

    const shadow = new Graphics();
    shadow.circle(0, 5, NODE_RADIUS).fill({ color: 0x000000, alpha: 0.35 });
    wrap.addChild(shadow);

    const circle = new Graphics();
    circle.circle(0, 0, NODE_RADIUS).fill(band.base);
    circle.circle(0, 0, NODE_RADIUS).stroke({ color: band.border, width: 4 });
    wrap.addChild(circle);

    if (unlocked) {
      // Highlight dot
      const gloss = new Graphics();
      gloss
        .ellipse(-10, -12, 14, 8)
        .fill({ color: 0xffffff, alpha: 0.4 });
      wrap.addChild(gloss);

      const numText = new Text({
        text: String(def.id),
        style: new TextStyle({
          fontFamily: 'system-ui, Arial, sans-serif',
          fontSize: 32,
          fill: 0xffffff,
          fontWeight: 'bold',
          stroke: { color: band.border, width: 3 },
        }),
      });
      numText.anchor.set(0.5);
      wrap.addChild(numText);

      // Best score star, shown below the node
      if (best > 0) {
        const bestText = new Text({
          text: `★ ${best}`,
          style: new TextStyle({
            fontFamily: 'system-ui, Arial, sans-serif',
            fontSize: 12,
            fill: 0xffd700,
            fontWeight: 'bold',
            stroke: { color: 0x000000, width: 2 },
          }),
        });
        bestText.anchor.set(0.5, 0);
        bestText.y = NODE_RADIUS + 6;
        wrap.addChild(bestText);
      }

      wrap.eventMode = 'static';
      wrap.cursor = 'pointer';
      let hover = false;
      wrap.on('pointerover', () => {
        hover = true;
        circle.clear();
        circle.circle(0, 0, NODE_RADIUS).fill(band.hover);
        circle.circle(0, 0, NODE_RADIUS).stroke({ color: band.border, width: 4 });
        gsap.to(wrap.scale, { x: 1.08, y: 1.08, duration: 0.15, ease: 'back.out' });
      });
      wrap.on('pointerout', () => {
        if (!hover) return;
        hover = false;
        circle.clear();
        circle.circle(0, 0, NODE_RADIUS).fill(band.base);
        circle.circle(0, 0, NODE_RADIUS).stroke({ color: band.border, width: 4 });
        gsap.to(wrap.scale, { x: 1, y: 1, duration: 0.15, ease: 'power2.out' });
      });
      wrap.on('pointerdown', () => {
        this.showPreview(def);
      });

      // Idle pulse on the next-to-beat level
      const progress = SaveData.get();
      if (def.id === progress.highestUnlocked && best === 0) {
        gsap.to(wrap.scale, {
          x: 1.12,
          y: 1.12,
          duration: 0.7,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      }
    } else {
      const lock = new Text({
        text: '🔒',
        style: new TextStyle({ fontFamily: 'system-ui', fontSize: 26 }),
      });
      lock.anchor.set(0.5);
      wrap.addChild(lock);
    }

    return wrap;
  }

  // ---- Preview panel ----

  /** Renders (or re-renders) the bottom preview panel for the chosen level. */
  private showPreview(def: LevelDef): void {
    if (this.previewContainer) {
      if (this.previewContainer.parent) this.removeChild(this.previewContainer);
      this.previewContainer.destroy({ children: true });
      this.previewContainer = null;
    }

    const w = Math.min(520, this.width0 - 60);
    const h = 140;
    const x = (this.width0 - w) / 2;
    const y = this.height0 - h - 36;

    const panel = new Container();
    const bg = new Graphics();
    bg.roundRect(x, y, w, h, 14).fill({ color: 0x1a1a2e, alpha: 0.92 });
    bg.roundRect(x, y, w, h, 14).stroke({ color: 0xffd95e, width: 2 });
    panel.addChild(bg);

    const unlocked = SaveData.isUnlocked(def.id);
    const best = SaveData.bestScore(def.id);

    // Level N — name
    const nameText = new Text({
      text: `NIVEAU ${def.id} — ${def.name.toUpperCase()}`,
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 16,
        fill: 0xffd95e,
        fontWeight: 'bold',
        letterSpacing: 2,
      }),
    });
    nameText.x = x + 20;
    nameText.y = y + 16;
    panel.addChild(nameText);

    // Description
    const descText = new Text({
      text: def.description,
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 13,
        fill: 0xd0d0e0,
        wordWrap: true,
        wordWrapWidth: w - 200,
      }),
    });
    descText.x = x + 20;
    descText.y = y + 44;
    panel.addChild(descText);

    // Stats
    const movesLine = new Text({
      text: `Coups : ${def.moves}`,
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 12,
        fill: 0x8a8a9e,
      }),
    });
    movesLine.x = x + 20;
    movesLine.y = y + h - 44;
    panel.addChild(movesLine);

    const objLine = new Text({
      text:
        def.objective.type === 'score'
          ? `Objectif : ${def.objective.target} pts`
          : `Objectif : ${def.objective.target} pierres`,
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 12,
        fill: 0x8a8a9e,
      }),
    });
    objLine.x = x + 20;
    objLine.y = y + h - 24;
    panel.addChild(objLine);

    if (best > 0) {
      const bestLine = new Text({
        text: `★ Meilleur : ${best}`,
        style: new TextStyle({
          fontFamily: 'system-ui, Arial, sans-serif',
          fontSize: 12,
          fill: 0xffd700,
          fontWeight: 'bold',
        }),
      });
      bestLine.anchor.set(1, 0);
      bestLine.x = x + w - 20;
      bestLine.y = y + 20;
      panel.addChild(bestLine);
    }

    // Play button on the right
    if (unlocked) {
      const play = new Button({
        label: '▶ JOUER',
        width: 140,
        height: 52,
        fontSize: 18,
        bgColor: 0x2ed573,
        hoverColor: 0x3edc81,
        onClick: () => this.onSelect(def),
      });
      play.x = x + w - 140 - 20;
      play.y = y + h - 52 - 20;
      panel.addChild(play);
    } else {
      const lockedLabel = new Text({
        text: '🔒 Verrouillé',
        style: new TextStyle({
          fontFamily: 'system-ui, Arial, sans-serif',
          fontSize: 14,
          fill: 0x55555f,
          fontWeight: 'bold',
        }),
      });
      lockedLabel.anchor.set(1, 0.5);
      lockedLabel.x = x + w - 20;
      lockedLabel.y = y + h - 52 - 20 + 26;
      panel.addChild(lockedLabel);
    }

    panel.alpha = 0;
    panel.y = 8;
    this.addChild(panel);
    this.previewContainer = panel;
    gsap.to(panel, { alpha: 1, y: 0, duration: 0.2, ease: 'power2.out' });
  }
}
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
