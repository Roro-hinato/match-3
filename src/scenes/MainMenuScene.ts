import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Button } from '@/ui/Button';

interface MainMenuOptions {
  width: number;
  height: number;
  onPlayLevels: () => void;
  onPlayInfinite: () => void;
  onReset: () => void;
}

/** Main menu: title + play-mode buttons + reset progression footer. */
export class MainMenuScene extends Container {
  constructor(opts: MainMenuOptions) {
    super();
    const { width, height } = opts;

    const bg = new Graphics();
    bg.rect(0, 0, width, height).fill(0x12121e);
    this.addChild(bg);

    const title = new Text({
      text: 'MATCH-3',
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 64,
        fill: 0xffffff,
        fontWeight: 'bold',
        letterSpacing: 6,
        stroke: { color: 0x2ed573, width: 3 },
      }),
    });
    title.anchor.set(0.5);
    title.x = width / 2;
    title.y = height / 2 - 170;
    this.addChild(title);

    const subtitle = new Text({
      text: 'Alignements, cascades, combos',
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 16,
        fill: 0xb0b0c8,
        letterSpacing: 2,
      }),
    });
    subtitle.anchor.set(0.5);
    subtitle.x = width / 2;
    subtitle.y = title.y + 54;
    this.addChild(subtitle);

    const btnW = 240;
    const btnH = 56;
    const btnX = (width - btnW) / 2;

    const levelsBtn = new Button({
      label: 'NIVEAUX',
      width: btnW,
      height: btnH,
      fontSize: 22,
      bgColor: 0x2ed573,
      hoverColor: 0x3edc81,
      onClick: opts.onPlayLevels,
    });
    levelsBtn.x = btnX;
    levelsBtn.y = height / 2 - 20;
    this.addChild(levelsBtn);

    const infiniteBtn = new Button({
      label: 'MODE INFINI',
      width: btnW,
      height: btnH,
      fontSize: 22,
      bgColor: 0x1e90ff,
      hoverColor: 0x4aa8ff,
      onClick: opts.onPlayInfinite,
    });
    infiniteBtn.x = btnX;
    infiniteBtn.y = height / 2 + 50;
    this.addChild(infiniteBtn);

    const resetBtn = new Button({
      label: 'RÉINIT. PROGRESSION',
      width: 220,
      height: 32,
      fontSize: 12,
      bgColor: 0x2a2a33,
      hoverColor: 0x3a3a45,
      onClick: opts.onReset,
    });
    resetBtn.x = (width - 220) / 2;
    resetBtn.y = height - 48;
    this.addChild(resetBtn);
  }
}
