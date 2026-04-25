import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Button } from '@/ui/Button';
import type { LevelDef } from '@/levels/levels';

interface ResultsOptions {
  width: number;
  height: number;
  def: LevelDef;
  won: boolean;
  score: number;
  best: number;
  coinsEarned: number;
  totalCoins: number;
  hasNext: boolean;
  onRetry: () => void;
  onNext?: () => void;
  onMenu: () => void;
}

export class ResultsScene extends Container {
  constructor(opts: ResultsOptions) {
    super();
    const { width, height } = opts;

    // Dim backdrop
    const bg = new Graphics();
    bg.rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.7 });
    this.addChild(bg);

    // Panel
    const panelW = 420;
    const panelH = 380;
    const panelX = (width - panelW) / 2;
    const panelY = (height - panelH) / 2;

    const panel = new Graphics();
    panel
      .roundRect(panelX, panelY, panelW, panelH, 16)
      .fill(0x242444)
      .roundRect(panelX, panelY, panelW, panelH, 16)
      .stroke({ color: opts.won ? 0x2ed573 : 0xff4757, width: 3 });
    this.addChild(panel);

    // Title
    const title = new Text({
      text: opts.won ? 'NIVEAU RÉUSSI !' : 'NIVEAU PERDU',
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 32,
        fill: opts.won ? 0x2ed573 : 0xff4757,
        fontWeight: 'bold',
        letterSpacing: 2,
      }),
    });
    title.anchor.set(0.5);
    title.x = width / 2;
    title.y = panelY + 50;
    this.addChild(title);

    // Level name
    const name = new Text({
      text: `Niveau ${opts.def.id} — ${opts.def.name}`,
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 16,
        fill: 0xb0b0c8,
      }),
    });
    name.anchor.set(0.5);
    name.x = width / 2;
    name.y = panelY + 88;
    this.addChild(name);

    // Score line
    const scoreLine = new Text({
      text: `Score : ${opts.score}`,
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 24,
        fill: 0xffffff,
        fontWeight: 'bold',
      }),
    });
    scoreLine.anchor.set(0.5);
    scoreLine.x = width / 2;
    scoreLine.y = panelY + 135;
    this.addChild(scoreLine);

    // Best
    const bestLine = new Text({
      text: opts.best > 0 ? `Meilleur : ${opts.best}` : 'Nouveau record !',
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 14,
        fill: opts.score >= opts.best ? 0xffd700 : 0x8a8a9e,
      }),
    });
    bestLine.anchor.set(0.5);
    bestLine.x = width / 2;
    bestLine.y = panelY + 168;
    this.addChild(bestLine);

    // Coin reward line
    const coinLine = new Text({
      text: `+${opts.coinsEarned} 🪙   (Total : ${opts.totalCoins})`,
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 16,
        fill: 0xffd95e,
        fontWeight: 'bold',
      }),
    });
    coinLine.anchor.set(0.5);
    coinLine.x = width / 2;
    coinLine.y = panelY + 198;
    this.addChild(coinLine);

    // Buttons
    const btnW = 150;
    const btnH = 46;
    const btnGap = 12;
    const menuBtn = new Button({
      label: 'MENU',
      width: btnW,
      height: btnH,
      fontSize: 16,
      bgColor: 0x3a3a45,
      hoverColor: 0x55555f,
      onClick: opts.onMenu,
    });
    const retryBtn = new Button({
      label: 'REJOUER',
      width: btnW,
      height: btnH,
      fontSize: 16,
      bgColor: 0x1e90ff,
      hoverColor: 0x4aa8ff,
      onClick: opts.onRetry,
    });

    if (opts.won && opts.hasNext && opts.onNext) {
      const nextBtn = new Button({
        label: 'SUIVANT →',
        width: btnW,
        height: btnH,
        fontSize: 16,
        bgColor: 0x2ed573,
        hoverColor: 0x3edc81,
        onClick: opts.onNext,
      });
      const totalW = btnW * 3 + btnGap * 2;
      const baseX = width / 2 - totalW / 2;
      const y = panelY + panelH - btnH - 28;
      menuBtn.x = baseX;
      retryBtn.x = baseX + btnW + btnGap;
      nextBtn.x = baseX + (btnW + btnGap) * 2;
      menuBtn.y = retryBtn.y = nextBtn.y = y;
      this.addChild(menuBtn, retryBtn, nextBtn);
    } else {
      const totalW = btnW * 2 + btnGap;
      const baseX = width / 2 - totalW / 2;
      const y = panelY + panelH - btnH - 28;
      menuBtn.x = baseX;
      retryBtn.x = baseX + btnW + btnGap;
      menuBtn.y = retryBtn.y = y;
      this.addChild(menuBtn, retryBtn);
    }
  }
}
