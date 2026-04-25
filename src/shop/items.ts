export type ShopItemKey = 'extra-moves' | 'bomb-rain' | 'hammer';

export interface ShopItem {
  key: ShopItemKey;
  icon: string;
  label: string;
  description: string;
  cost: number;
}

/**
 * Shop catalog. Prices and effects are exposed as data so Game and ShopPanel
 * agree without cross-imports. Game consumes the key in a switch; ShopPanel
 * only cares about rendering.
 */
export const SHOP_ITEMS: ShopItem[] = [
  {
    key: 'extra-moves',
    icon: '+5',
    label: '+5 Coups',
    description: 'Ajoute 5 coups au niveau en cours.',
    cost: 100,
  },
  {
    key: 'bomb-rain',
    icon: '💣',
    label: 'Pluie de bombes',
    description: '5 bombes de couleur placées au hasard sur la grille.',
    cost: 200,
  },
  {
    key: 'hammer',
    icon: '🔨',
    label: 'Marteau',
    description: 'Clique sur une tuile pour la détruire.',
    cost: 75,
  },
];

/** Coin reward granted by the results screen. */
export function coinsForResult(won: boolean, levelId: number): number {
  if (won) return 50 + levelId * 5; // +5 per level tier as a gentle ramp
  return 10;
}
