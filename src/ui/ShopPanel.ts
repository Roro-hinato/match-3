import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import { SHOP_ITEMS, type ShopItemKey } from '@/shop/items';

const PADDING_X = 12;
const CARD_HEIGHT = 92;
const CARD_GAP = 10;

/** Return value of the onPurchase callback: 'ok' triggers a success bounce + default
 * message, 'fail' triggers a shake + insufficient-funds message, 'silent' does
 * neither (the caller has already set its own status). */
export type PurchaseResult = 'ok' | 'fail' | 'silent';

interface ShopPanelOptions {
  width: number;
  height: number;
  onPurchase: (key: ShopItemKey) => PurchaseResult;
  getCoins: () => number;
}

/** Right-side shop panel with the coin balance and 3 buyable items. */
export class ShopPanel extends Container {
  private width0: number;
  private coinText: Text;
  private coinFlash: Graphics;
  private cards: Map<ShopItemKey, Container> = new Map();
  private getCoins: () => number;
  private onPurchase: (key: ShopItemKey) => PurchaseResult;
  private statusText: Text;
  private armedKey: ShopItemKey | null = null;

  constructor(opts: ShopPanelOptions) {
    super();
    this.width0 = opts.width;
    this.onPurchase = opts.onPurchase;
    this.getCoins = opts.getCoins;

    const bg = new Graphics();
    bg.roundRect(0, 0, opts.width, opts.height, 12).fill(0x242444);
    this.addChild(bg);

    const titleStyle = new TextStyle({
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize: 13,
      fill: 0x8a8a9e,
      fontWeight: 'bold',
      letterSpacing: 1,
    });
    const title = new Text({ text: 'BOUTIQUE', style: titleStyle });
    title.x = PADDING_X;
    title.y = 14;
    this.addChild(title);

    // --- Coin balance pill ---
    const pillY = 34;
    const pillH = 34;
    this.coinFlash = new Graphics();
    this.coinFlash
      .roundRect(PADDING_X, pillY, opts.width - PADDING_X * 2, pillH, 8)
      .fill(0x1a1a2a);
    this.coinFlash
      .roundRect(PADDING_X, pillY, opts.width - PADDING_X * 2, pillH, 8)
      .stroke({ color: 0xffd95e, width: 2 });
    this.addChild(this.coinFlash);

    const coinIcon = new Text({
      text: '🪙',
      style: new TextStyle({ fontFamily: 'system-ui', fontSize: 18 }),
    });
    coinIcon.anchor.set(0, 0.5);
    coinIcon.x = PADDING_X + 8;
    coinIcon.y = pillY + pillH / 2;
    this.addChild(coinIcon);

    this.coinText = new Text({
      text: String(this.getCoins()),
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 20,
        fill: 0xffd95e,
        fontWeight: 'bold',
      }),
    });
    this.coinText.anchor.set(1, 0.5);
    this.coinText.x = opts.width - PADDING_X - 8;
    this.coinText.y = pillY + pillH / 2;
    this.addChild(this.coinText);

    // --- Item cards ---
    let y = pillY + pillH + 14;
    for (const item of SHOP_ITEMS) {
      const card = this.buildCard(item.key, item.icon, item.label, item.description, item.cost);
      card.x = PADDING_X;
      card.y = y;
      this.addChild(card);
      this.cards.set(item.key, card);
      y += CARD_HEIGHT + CARD_GAP;
    }

    // Status footer — purchase feedback ("Coins insuffisants", "Acheté !")
    this.statusText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 12,
        fill: 0xff6b6b,
        fontWeight: 'bold',
        wordWrap: true,
        wordWrapWidth: opts.width - PADDING_X * 2,
        align: 'center',
      }),
    });
    this.statusText.anchor.set(0.5, 1);
    this.statusText.x = opts.width / 2;
    this.statusText.y = opts.height - 10;
    this.addChild(this.statusText);

    this.refreshAffordability();
  }

  /** Updates the coin display and item card affordability. Called by Game after any coin event. */
  refresh(): void {
    this.coinText.text = String(this.getCoins());
    this.refreshAffordability();
  }

  /**
   * Visually mark the hammer card as armed (label "ANNULER", amber border).
   * The card stays clickable so the user can re-click to cancel the action.
   */
  setHammerArmed(armed: boolean): void {
    const card = this.cards.get('hammer');
    if (!card) return;
    this.armedKey = armed ? 'hammer' : null;
    const cardWithBg = card as Container & {
      _bg: Graphics;
      _costBg: Graphics;
      _costText: Text;
    };
    const cardW = this.width0 - PADDING_X * 2;

    if (armed) {
      cardWithBg._bg.clear();
      cardWithBg._bg.roundRect(0, 0, cardW, CARD_HEIGHT, 10).fill(0x4a3a1a);
      cardWithBg._bg.roundRect(0, 0, cardW, CARD_HEIGHT, 10).stroke({ color: 0xffa502, width: 2 });
      cardWithBg._costText.text = '✕ ANNULER';
      cardWithBg._costText.style.fill = 0xff6b6b;
    } else {
      cardWithBg._bg.clear();
      cardWithBg._bg.roundRect(0, 0, cardW, CARD_HEIGHT, 10).fill(0x1a1a2e);
      cardWithBg._bg.roundRect(0, 0, cardW, CARD_HEIGHT, 10).stroke({ color: 0x3a3a55, width: 1 });
      const item = SHOP_ITEMS.find((i) => i.key === 'hammer');
      if (item) {
        cardWithBg._costText.text = `${item.cost} 🪙`;
        cardWithBg._costText.style.fill = 0xffd95e;
      }
    }
  }

  /** Coin balance just got a boost — flash the pill to draw attention. */
  pulseCoin(): void {
    gsap.killTweensOf(this.coinText.scale);
    gsap.to(this.coinText.scale, {
      x: 1.3,
      y: 1.3,
      duration: 0.1,
      ease: 'back.out',
      onComplete: () => gsap.to(this.coinText.scale, { x: 1, y: 1, duration: 0.25 }),
    });
  }

  private buildCard(
    key: ShopItemKey,
    icon: string,
    label: string,
    description: string,
    cost: number,
  ): Container {
    const cardW = this.width0 - PADDING_X * 2;
    const card = new Container();

    const bg = new Graphics();
    bg.roundRect(0, 0, cardW, CARD_HEIGHT, 10).fill(0x1a1a2e);
    bg.roundRect(0, 0, cardW, CARD_HEIGHT, 10).stroke({ color: 0x3a3a55, width: 1 });
    card.addChild(bg);
    (card as Container & { _bg: Graphics })._bg = bg;

    const iconText = new Text({
      text: icon,
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 22,
        fill: 0xffffff,
        fontWeight: 'bold',
      }),
    });
    iconText.anchor.set(0.5);
    iconText.x = 26;
    iconText.y = 24;
    card.addChild(iconText);

    const labelText = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 13,
        fill: 0xffffff,
        fontWeight: 'bold',
      }),
    });
    labelText.x = 52;
    labelText.y = 8;
    card.addChild(labelText);

    const descText = new Text({
      text: description,
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 10,
        fill: 0xb0b0c8,
        wordWrap: true,
        wordWrapWidth: cardW - 60,
      }),
    });
    descText.x = 52;
    descText.y = 28;
    card.addChild(descText);

    // Cost pill at the bottom
    const costBg = new Graphics();
    const costW = cardW - 16;
    costBg.roundRect(8, CARD_HEIGHT - 28, costW, 22, 6).fill(0x2a2a45);
    card.addChild(costBg);
    (card as Container & { _costBg: Graphics })._costBg = costBg;

    const costText = new Text({
      text: `${cost} 🪙`,
      style: new TextStyle({
        fontFamily: 'system-ui, Arial, sans-serif',
        fontSize: 12,
        fill: 0xffd95e,
        fontWeight: 'bold',
      }),
    });
    costText.anchor.set(0.5);
    costText.x = cardW / 2;
    costText.y = CARD_HEIGHT - 17;
    card.addChild(costText);
    (card as Container & { _costText: Text })._costText = costText;

    card.eventMode = 'static';
    card.cursor = 'pointer';
    card.on('pointerover', () => {
      if (this.armedKey === key) return; // Skip hover redraw on armed card
      if (card.alpha >= 1) {
        bg.clear();
        bg.roundRect(0, 0, cardW, CARD_HEIGHT, 10).fill(0x2a2a55);
        bg.roundRect(0, 0, cardW, CARD_HEIGHT, 10).stroke({ color: 0xffd95e, width: 1.5 });
      }
    });
    card.on('pointerout', () => {
      if (this.armedKey === key) return;
      bg.clear();
      bg.roundRect(0, 0, cardW, CARD_HEIGHT, 10).fill(0x1a1a2e);
      bg.roundRect(0, 0, cardW, CARD_HEIGHT, 10).stroke({ color: 0x3a3a55, width: 1 });
    });
    card.on('pointerdown', () => {
      const result = this.onPurchase(key);
      if (result === 'ok') {
        this.showStatus('Acheté !', 0x2ed573);
        gsap.fromTo(card.scale, { x: 0.92, y: 0.92 }, { x: 1, y: 1, duration: 0.25, ease: 'back.out' });
      } else if (result === 'fail') {
        this.showStatus('Pièces insuffisantes', 0xff6b6b);
        const origX = card.x;
        gsap.to(card, {
          x: origX - 6,
          duration: 0.05,
          yoyo: true,
          repeat: 3,
          onComplete: () => {
            card.x = origX;
          },
        });
      }
      // 'silent' → do nothing, the caller set its own status.
    });

    return card;
  }

  /** Grey out unaffordable cards based on current coin balance. */
  private refreshAffordability(): void {
    const coins = this.getCoins();
    for (const item of SHOP_ITEMS) {
      const card = this.cards.get(item.key);
      if (!card) continue;
      const affordable = coins >= item.cost;
      card.alpha = affordable ? 1 : 0.55;
      card.cursor = affordable ? 'pointer' : 'not-allowed';
    }
  }

  /** Public hook so PlayScene can replace the default "Acheté !" message after a special action. */
  setStatus(text: string, color: number): void {
    this.showStatus(text, color);
  }

  private showStatus(text: string, color: number): void {
    this.statusText.text = text;
    this.statusText.style.fill = color;
    gsap.killTweensOf(this.statusText);
    this.statusText.alpha = 1;
    gsap.to(this.statusText, { alpha: 0, duration: 0.4, delay: 1.5, ease: 'power2.in' });
  }
}
