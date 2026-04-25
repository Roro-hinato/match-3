import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_CONFIG } from '@/config';
import type { TileKind } from '@/core/types';
import type { LevelDef } from '@/levels/levels';
import { TileView } from '@/game/TileView';

const PADDING_X = 12;

/**
 * Left panel shown during play. Top block shows mode-specific info
 * (moves + objective in level mode, or a neutral label in infinite mode).
 * Bottom block is a compact legend of special tile kinds.
 */
export class LevelPanel extends Container {
  private topContainer: Container;
  private infoTitle: Text;
  private infoBody: Text;
  private movesValue: Text;
  private objectiveLabel: Text;
  private objectiveProgress: Text;

  constructor(width: number, height: number) {
    super();

    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, 12).fill(GAME_CONFIG.colors.boardBg);
    this.addChild(bg);

    // --- Top info block ---
    this.topContainer = new Container();
    this.topContainer.x = 0;
    this.topContainer.y = 0;
    this.addChild(this.topContainer);

    const titleStyle = new TextStyle({
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize: 13,
      fill: 0xb0b0c8,
      fontWeight: 'bold',
      letterSpacing: 1,
    });
    this.infoTitle = new Text({ text: '', style: titleStyle });
    this.infoTitle.x = PADDING_X;
    this.infoTitle.y = 14;
    this.topContainer.addChild(this.infoTitle);

    // "Coups"
    const movesLabelStyle = new TextStyle({
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize: 12,
      fill: 0x8a8a9e,
    });
    const movesLabel = new Text({ text: 'COUPS', style: movesLabelStyle });
    movesLabel.x = PADDING_X;
    movesLabel.y = 38;
    this.topContainer.addChild(movesLabel);

    const movesValueStyle = new TextStyle({
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize: 36,
      fill: 0xffffff,
      fontWeight: 'bold',
    });
    this.movesValue = new Text({ text: '—', style: movesValueStyle });
    this.movesValue.x = PADDING_X;
    this.movesValue.y = 54;
    this.topContainer.addChild(this.movesValue);

    // Objective
    const objLabelStyle = new TextStyle({
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize: 12,
      fill: 0x8a8a9e,
    });
    this.objectiveLabel = new Text({ text: 'OBJECTIF', style: objLabelStyle });
    this.objectiveLabel.x = PADDING_X;
    this.objectiveLabel.y = 106;
    this.topContainer.addChild(this.objectiveLabel);

    const objProgStyle = new TextStyle({
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize: 17,
      fill: 0xffffff,
      fontWeight: 'bold',
      wordWrap: true,
      wordWrapWidth: width - PADDING_X * 2,
    });
    this.objectiveProgress = new Text({ text: '', style: objProgStyle });
    this.objectiveProgress.x = PADDING_X;
    this.objectiveProgress.y = 122;
    this.topContainer.addChild(this.objectiveProgress);

    // Infinite-mode body (shown instead of moves/objective text)
    const bodyStyle = new TextStyle({
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize: 13,
      fill: 0xb0b0c8,
      wordWrap: true,
      wordWrapWidth: width - PADDING_X * 2,
    });
    this.infoBody = new Text({ text: '', style: bodyStyle });
    this.infoBody.x = PADDING_X;
    this.infoBody.y = 38;
    this.infoBody.visible = false;
    this.topContainer.addChild(this.infoBody);

    // --- Legend (bottom block) ---
    this.drawLegend();
  }

  setLevelMode(def: LevelDef): void {
    this.infoTitle.text = `NIVEAU ${def.id} — ${def.name.toUpperCase()}`;
    this.movesValue.visible = true;
    this.objectiveLabel.visible = true;
    this.objectiveProgress.visible = true;
    this.infoBody.visible = false;
    this.setMoves(def.moves);
    if (def.objective.type === 'score') {
      this.setObjectiveText(`Score : 0 / ${def.objective.target}`);
    } else {
      this.setObjectiveText(`Pierres : 0 / ${def.objective.target}`);
    }
  }

  setInfiniteMode(): void {
    this.infoTitle.text = 'MODE INFINI';
    this.movesValue.visible = false;
    this.objectiveLabel.visible = false;
    this.objectiveProgress.visible = false;
    this.infoBody.text = 'Joue sans limite, fais\ntoujours plus de points.';
    this.infoBody.visible = true;
  }

  setMoves(n: number): void {
    this.movesValue.text = String(Math.max(0, n));
  }

  setObjectiveText(text: string): void {
    this.objectiveProgress.text = text;
  }

  private drawLegend(): void {
    const legendTop = 186;
    const legendTitleStyle = new TextStyle({
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize: 13,
      fill: 0x8a8a9e,
      fontWeight: 'bold',
      letterSpacing: 1,
    });
    const legendTitle = new Text({ text: 'BONBONS SPÉCIAUX', style: legendTitleStyle });
    legendTitle.x = PADDING_X;
    legendTitle.y = legendTop;
    this.addChild(legendTitle);

    const entries: {
      kind: TileKind;
      color: number;
      label: string;
      effect: string;
    }[] = [
      { kind: 'striped-h', color: 0, label: 'Rayé', effect: 'Ligne / Colonne' },
      { kind: 'wrapped', color: 3, label: 'Emballé', effect: 'Zone 3×3' },
      { kind: 'color-bomb', color: 4, label: 'Bombe', effect: 'Toute la couleur' },
      { kind: 'wall', color: 0, label: 'Mur', effect: 'Indestructible' },
      { kind: 'stone', color: 0, label: 'Pierre', effect: 'À détruire' },
    ];

    const iconSize = 32;
    const scale = iconSize / GAME_CONFIG.grid.tileSize;
    const entryHeight = 42;
    const startY = legendTop + 22;
    const labelStyle = new TextStyle({
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize: 12,
      fill: 0xffffff,
      fontWeight: 'bold',
    });
    const effectStyle = new TextStyle({
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize: 10,
      fill: 0xb8b8c8,
    });

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const yTop = startY + i * entryHeight;
      const icon = new TileView(e.color, e.kind, { row: 0, col: 0 });
      icon.scale.set(scale);
      icon.x = PADDING_X + iconSize / 2;
      icon.y = yTop + iconSize / 2;
      this.addChild(icon);

      const textX = PADDING_X + iconSize + 8;
      const label = new Text({ text: e.label, style: labelStyle });
      label.x = textX;
      label.y = yTop + 2;
      this.addChild(label);

      const effect = new Text({ text: e.effect, style: effectStyle });
      effect.x = textX;
      effect.y = yTop + 18;
      this.addChild(effect);
    }
  }
}
