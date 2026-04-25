/**
 * Persists player progress in localStorage under a single key.
 * All mutations go through SaveData so nothing outside this module
 * needs to know the storage layout.
 */

const KEY = 'match3:progress:v1';

interface Progress {
  highestUnlocked: number;
  bestScores: Record<number, number>;
  soundEnabled: boolean;
  coins: number;
}

function defaults(): Progress {
  return { highestUnlocked: 1, bestScores: {}, soundEnabled: true, coins: 150 };
}

function safeRead(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    return { ...defaults(), ...parsed };
  } catch {
    return defaults();
  }
}

function safeWrite(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode, quota, etc. Save silently fails. */
  }
}

export const SaveData = {
  get(): Progress {
    return safeRead();
  },

  isUnlocked(levelId: number): boolean {
    return levelId <= safeRead().highestUnlocked;
  },

  bestScore(levelId: number): number {
    return safeRead().bestScores[levelId] ?? 0;
  },

  recordWin(levelId: number, score: number, nextLevelId: number): void {
    const p = safeRead();
    p.highestUnlocked = Math.max(p.highestUnlocked, nextLevelId);
    p.bestScores[levelId] = Math.max(p.bestScores[levelId] ?? 0, score);
    safeWrite(p);
  },

  recordScore(levelId: number, score: number): void {
    const p = safeRead();
    p.bestScores[levelId] = Math.max(p.bestScores[levelId] ?? 0, score);
    safeWrite(p);
  },

  setSoundEnabled(enabled: boolean): void {
    const p = safeRead();
    p.soundEnabled = enabled;
    safeWrite(p);
  },

  getCoins(): number {
    return safeRead().coins;
  },

  addCoins(n: number): number {
    const p = safeRead();
    p.coins = Math.max(0, p.coins + n);
    safeWrite(p);
    return p.coins;
  },

  /** Attempt to spend coins. Returns the new balance, or -1 if insufficient. */
  trySpend(cost: number): number {
    const p = safeRead();
    if (p.coins < cost) return -1;
    p.coins -= cost;
    safeWrite(p);
    return p.coins;
  },

  reset(): void {
    safeWrite(defaults());
  },
};
