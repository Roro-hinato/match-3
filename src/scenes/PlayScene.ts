import { Application, Container } from 'pixi.js';
import { GAME_CONFIG } from '@/config';
import { Game, type GameMode } from '@/game/Game';
import type { SoundManager } from '@/audio/SoundManager';
import { Hud } from '@/ui/Hud';
import { LevelPanel } from '@/ui/LevelPanel';
import { ShopPanel, type PurchaseResult } from '@/ui/ShopPanel';
import { SaveData } from '@/save/SaveData';
import { SHOP_ITEMS, type ShopItemKey } from '@/shop/items';

export interface PlayResult {
  won: boolean;
  score: number;
  stonesDestroyed: number;
}

interface PlaySceneOptions {
  app: Application;
  sound: SoundManager;
  mode: GameMode;
  onComplete: (result: PlayResult) => void;
  onMenu: () => void;
}

/** One play session: LevelPanel (left) + Board (center) + ShopPanel (right) + HUD (bottom). */
export class PlayScene extends Container {
  private panel: LevelPanel;
  private hud: Hud;
  private shop: ShopPanel;
  private game: Game;

  constructor(opts: PlaySceneOptions) {
    super();

    this.panel = new LevelPanel(GAME_CONFIG.canvas.legendWidth, GAME_CONFIG.canvas.height);
    this.panel.x = 0;
    this.panel.y = 0;
    this.addChild(this.panel);

    // Shop panel on the right.
    this.shop = new ShopPanel({
      width: GAME_CONFIG.canvas.shopWidth,
      height: GAME_CONFIG.canvas.height,
      getCoins: () => SaveData.getCoins(),
      onPurchase: (key) => this.handlePurchase(key),
    });
    this.shop.x = GAME_CONFIG.canvas.legendWidth + GAME_CONFIG.canvas.width;
    this.shop.y = 0;
    this.addChild(this.shop);

    this.hud = new Hud(GAME_CONFIG.canvas.totalWidth);
    this.hud.y = GAME_CONFIG.canvas.height;
    this.hud.setMenuVisible(true);
    this.hud.setOnMenuClick(opts.onMenu);
    this.hud.setOnToggle(() => {
      opts.sound.unlock();
      const enabled = opts.sound.toggle();
      this.hud.setSoundEnabled(enabled);
    });
    this.hud.setSoundEnabled(opts.sound.enabled);
    this.addChild(this.hud);

    this.game = new Game({
      app: opts.app,
      sound: opts.sound,
      hud: this.hud,
      panel: this.panel,
      boardOffset: { x: GAME_CONFIG.canvas.legendWidth, y: 0 },
      mode: opts.mode,
      parent: this,
      onComplete: opts.onComplete,
      onHammerConsumed: () => this.shop.setHammerArmed(false),
      onCoinsChange: () => this.shop.refresh(),
    });
    this.game.setScoreListener((s) => this.hud.setScore(s));
  }

  async start(): Promise<void> {
    await this.game.start();
  }

  getScore(): number {
    return this.game.getScore();
  }

  /** Called by ShopPanel when the user clicks an item. */
  private handlePurchase(key: ShopItemKey): PurchaseResult {
    const item = SHOP_ITEMS.find((i) => i.key === key);
    if (!item) return 'fail';

    // Re-click on hammer while it's already armed: cancel + refund instead of re-buying.
    // (Bombs are already placed on the board — can't be "undone" — and extra-moves
    // applies instantly. Only the hammer has a stateful "armed" phase.)
    if (key === 'hammer' && this.game.isHammerActive()) {
      this.game.cancelHammer();
      this.shop.setHammerArmed(false);
      SaveData.addCoins(item.cost);
      this.shop.refresh();
      this.shop.setStatus('Annulé, remboursé', 0xffd95e);
      return 'silent';
    }

    // "extra-moves" only makes sense in level mode
    if (key === 'extra-moves') {
      const mode = (this.game as unknown as { mode: GameMode }).mode;
      if (mode.type !== 'level') return 'fail';
    }

    const newBalance = SaveData.trySpend(item.cost);
    if (newBalance < 0) {
      this.shop.refresh();
      return 'fail';
    }
    const accepted = this.game.applyShopEffect(key);
    if (!accepted) {
      SaveData.addCoins(item.cost);
      this.shop.refresh();
      return 'fail';
    }
    if (key === 'hammer') {
      this.shop.setHammerArmed(true);
    }
    this.shop.refresh();
    return 'ok';
  }

  destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.game.destroy();
    super.destroy(options);
  }
}
