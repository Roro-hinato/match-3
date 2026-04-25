import { Application, Container, Graphics } from 'pixi.js';
import { gsap } from 'gsap';
import { GAME_CONFIG } from '@/config';
import { Grid } from '@/core/Grid';
import { GridGenerator } from '@/core/GridGenerator';
import { MatchDetector } from '@/core/MatchDetector';
import {
  isSpecial,
  keyToPos,
  posEquals,
  posKey,
  stone,
  tile,
  wall,
  type Match,
  type Position,
  type Tile,
  type TileColor,
  type TileKind,
} from '@/core/types';
import type { SoundManager } from '@/audio/SoundManager';
import type { Hud } from '@/ui/Hud';
import type { LevelPanel } from '@/ui/LevelPanel';
import type { LevelDef, ObstacleLayout } from '@/levels/levels';
import type { ShopItemKey } from '@/shop/items';
import { AnimationQueue } from './AnimationQueue';
import { BoardView } from './BoardView';
import { InputController } from './InputController';

interface NewSpecial {
  pos: Position;
  kind: TileKind;
  color: TileColor;
}

interface ClearedSnapshot {
  pos: Position;
  color: TileColor;
}

export type GameMode =
  | { type: 'infinite' }
  | { type: 'level'; def: LevelDef };

export interface GameOptions {
  app: Application;
  sound: SoundManager;
  hud: Hud;
  panel: LevelPanel;
  boardOffset: { x: number; y: number };
  mode: GameMode;
  /** Container the board is added to. Defaults to app.stage. Fly-to-score spheres still go on app.stage. */
  parent?: Container;
  onComplete?: (result: { won: boolean; score: number; stonesDestroyed: number }) => void;
  /** Called when the hammer mode is consumed (a tile got destroyed). */
  onHammerConsumed?: () => void;
}

export class Game {
  private app: Application;
  private sound: SoundManager;
  private hud: Hud;
  private panel: LevelPanel;
  private boardOffset: { x: number; y: number };
  private mode: GameMode;
  private parent: Container;
  private onComplete?: GameOptions['onComplete'];
  private onHammerConsumed?: GameOptions['onHammerConsumed'];

  private grid!: Grid;
  private board!: BoardView;
  private queue = new AnimationQueue();
  private score = 0;
  private movesLeft = Infinity;
  private stonesDestroyed = 0;
  private completed = false;
  private onScoreChange?: (s: number) => void;
  private hintTimer: number | null = null;
  private hintActive = false;
  private hammerMode = false;

  constructor(opts: GameOptions) {
    this.app = opts.app;
    this.sound = opts.sound;
    this.hud = opts.hud;
    this.panel = opts.panel;
    this.boardOffset = opts.boardOffset;
    this.mode = opts.mode;
    this.parent = opts.parent ?? opts.app.stage;
    this.onComplete = opts.onComplete;
    this.onHammerConsumed = opts.onHammerConsumed;
  }

  async start(): Promise<void> {
    // Build the void mask (cells that don't exist on this level)
    let voidMask: boolean[][] | undefined;
    if (this.mode.type === 'level' && this.mode.def.voidCells) {
      voidMask = Array.from({ length: GAME_CONFIG.grid.rows }, () =>
        Array.from({ length: GAME_CONFIG.grid.cols }, () => false),
      );
      for (const [r, c] of this.mode.def.voidCells) {
        if (r >= 0 && r < voidMask.length && c >= 0 && c < voidMask[0].length) {
          voidMask[r][c] = true;
        }
      }
    }

    this.grid = GridGenerator.create(
      GAME_CONFIG.grid.rows,
      GAME_CONFIG.grid.cols,
      GAME_CONFIG.grid.numColors,
      Math.random,
      voidMask,
    );

    if (this.mode.type === 'level') {
      this.applyObstacles(this.mode.def.obstacles);
      this.movesLeft = this.mode.def.moves;
      this.panel.setLevelMode(this.mode.def);
      this.updateObjective();
      if (!MatchDetector.hasPlayableMove(this.grid)) {
        let tries = 0;
        while (tries < 20 && !MatchDetector.hasPlayableMove(this.grid)) {
          this.grid.reshuffle();
          tries++;
        }
      }
    } else {
      this.panel.setInfiniteMode();
    }

    this.board = new BoardView(this.grid);
    this.board.x = this.boardOffset.x;
    this.board.y = this.boardOffset.y;
    this.parent.addChild(this.board);

    new InputController(
      this.board,
      (a, b) => this.attemptSwap(a, b),
      () => {
        this.sound.unlock();
        this.resetHintTimer();
      },
      (pos) => this.handleTileTap(pos),
    );

    this.resetHintTimer();
  }

  setScoreListener(cb: (s: number) => void): void {
    this.onScoreChange = cb;
  }

  getScore(): number {
    return this.score;
  }

  /** True while the player is in hammer-targeting mode (next click destroys a tile). */
  isHammerActive(): boolean {
    return this.hammerMode;
  }

  /** Cancels hammer mode without consuming any coin. Returns true if it was active. */
  cancelHammer(): boolean {
    if (!this.hammerMode) return false;
    this.hammerMode = false;
    this.board?.setHammerCursor(false);
    return true;
  }

  /**
   * Called when the player buys an item. Applies the effect, queued behind
   * any in-flight animation so cascades finish before the shop effect runs.
   * Returns true if the effect was accepted.
   */
  applyShopEffect(key: ShopItemKey): boolean {
    if (this.completed) return false;
    switch (key) {
      case 'extra-moves': {
        if (this.mode.type !== 'level') return false;
        this.movesLeft += 5;
        this.panel.setMoves(this.movesLeft);
        return true;
      }
      case 'bomb-rain': {
        this.queue.push(() => this.runBombRain());
        return true;
      }
      case 'hammer': {
        this.enterHammerMode();
        return true;
      }
      default:
        return false;
    }
  }

  /** Places 5 color bombs at random empty-ish cells and triggers a combo wave. */
  private async runBombRain(): Promise<void> {
    this.cancelHint();
    // Pick 5 positions: prefer non-special, non-obstacle cells.
    const candidates: Position[] = [];
    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        const t = this.grid.get(r, c);
        if (!t) continue;
        if (t.kind === 'wall' || t.kind === 'stone') continue;
        if (t.kind !== 'normal') continue; // don't overwrite existing specials
        candidates.push({ row: r, col: c });
      }
    }
    // Shuffle + take 5
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const picks = candidates.slice(0, 5);
    // Convert in model + animate upgrade pulses in parallel.
    const upgradeAnims: Promise<void>[] = [];
    for (const p of picks) {
      const t = this.grid.get(p.row, p.col);
      if (!t) continue;
      this.grid.set(p.row, p.col, { color: t.color, kind: 'color-bomb' });
      upgradeAnims.push(this.board.convertTile(p, 'color-bomb'));
    }
    this.sound.playCombo(3);
    await Promise.all(upgradeAnims);
    // Don't auto-detonate — the player uses them by swapping. That's more fun.
  }

  private enterHammerMode(): void {
    this.hammerMode = true;
    this.cancelHint();
    this.board.setHammerCursor(true);
  }

  /** Returns true if the tap was consumed by hammer mode. */
  private handleTileTap(pos: Position): boolean {
    if (!this.hammerMode) return false;
    if (this.queue.isBusy) return true; // swallow click while animating
    const t = this.grid.get(pos.row, pos.col);
    if (!t) return true;
    if (t.kind === 'wall') {
      // Can't break walls even with a hammer.
      return true;
    }
    this.hammerMode = false;
    this.board.setHammerCursor(false);
    this.queue.push(() => this.swingHammer(pos));
    this.onHammerConsumed?.();
    return true;
  }

  /** Removes the clicked tile, counts stones, and follows up with gravity + refill + cascade. */
  private async swingHammer(pos: Position): Promise<void> {
    const t = this.grid.get(pos.row, pos.col);
    if (!t) return;
    this.sound.playMatch(1);
    if (t.kind === 'stone') {
      this.stonesDestroyed++;
      this.updateObjective();
    }
    this.grid.set(pos.row, pos.col, null);
    await this.board.animateRemove([pos]);

    const moves = this.grid.applyGravity();
    await this.board.animateGravity(moves);
    const filled = this.grid.fillEmpty(this.randomTile);
    await this.board.animateSpawn(filled);

    // Don't run a full cascade loop — a cleared tile can create matches,
    // so resolve them like a regular board settle.
    const follow = MatchDetector.findAll(this.grid);
    if (follow.length > 0) {
      await this.cascadeLoop(follow, []);
    }

    await this.postResolve(false); // hammer doesn't consume a move
  }

  /** Cleanup: called when the play scene exits. */
  destroy(): void {
    this.cancelHint();
    if (this.board && this.board.parent) {
      this.board.parent.removeChild(this.board);
    }
    this.board?.destroy({ children: true });
  }

  private randomColor = (): TileColor =>
    Math.floor(Math.random() * GAME_CONFIG.grid.numColors);

  private randomTile = (): Tile => tile(this.randomColor());

  private applyObstacles(layout?: ObstacleLayout): void {
    if (!layout) return;
    for (const [r, c] of layout.walls ?? []) {
      this.grid.set(r, c, wall());
    }
    for (const [r, c] of layout.stones ?? []) {
      this.grid.set(r, c, stone());
    }
  }

  // -------------------------------------------------------------------------
  // Swap entry point
  // -------------------------------------------------------------------------

  private attemptSwap(a: Position, b: Position): void {
    if (this.completed) return;
    if (this.queue.isBusy) return;

    // Refuse swaps involving walls/stones (they can't move)
    const ta = this.grid.get(a.row, a.col);
    const tb = this.grid.get(b.row, b.col);
    if (!ta || !tb) return;
    if (ta.kind === 'wall' || ta.kind === 'stone') return;
    if (tb.kind === 'wall' || tb.kind === 'stone') return;

    this.cancelHint();
    this.queue.push(async () => {
      const tileA = ta;
      const tileB = tb;

      this.sound.playSwap();
      this.grid.swap(a, b);
      await this.board.animateSwap(a, b);

      // Special-combo fast path
      if (
        (isSpecial(tileA) && isSpecial(tileB)) ||
        tileA.kind === 'color-bomb' ||
        tileB.kind === 'color-bomb'
      ) {
        await this.runSpecialCombo(a, b, tileA, tileB);
        await this.postResolve(true);
        return;
      }

      // Regular match logic
      let matches = MatchDetector.findAll(this.grid);
      if (matches.length === 0) {
        this.sound.playInvalidSwap();
        this.grid.swap(a, b);
        await this.board.animateSwap(a, b);
        this.resetHintTimer();
        return;
      }

      await this.cascadeLoop(matches, [a, b]);
      await this.postResolve(true);
    });
  }

  /** Runs after any *successful* turn. Handles move count, win/loss, deadlock. */
  private async postResolve(countMove: boolean): Promise<void> {
    if (this.mode.type === 'level') {
      if (countMove) {
        this.movesLeft--;
        this.panel.setMoves(this.movesLeft);
      }
      this.updateObjective();
      if (this.isObjectiveMet()) {
        this.completed = true;
        this.onComplete?.({ won: true, score: this.score, stonesDestroyed: this.stonesDestroyed });
        return;
      }
      if (this.movesLeft <= 0) {
        this.completed = true;
        this.onComplete?.({ won: false, score: this.score, stonesDestroyed: this.stonesDestroyed });
        return;
      }
    }
    // Deadlock
    if (!MatchDetector.hasPlayableMove(this.grid)) {
      await this.reshuffle();
    }
    this.resetHintTimer();
  }

  private isObjectiveMet(): boolean {
    if (this.mode.type !== 'level') return false;
    const obj = this.mode.def.objective;
    if (obj.type === 'score') return this.score >= obj.target;
    if (obj.type === 'destroy-stones') return this.stonesDestroyed >= obj.target;
    return false;
  }

  private updateObjective(): void {
    if (this.mode.type !== 'level') return;
    const obj = this.mode.def.objective;
    if (obj.type === 'score') {
      this.panel.setObjectiveText(`Score : ${this.score} / ${obj.target}`);
    } else {
      this.panel.setObjectiveText(`Pierres : ${this.stonesDestroyed} / ${obj.target}`);
    }
  }

  // -------------------------------------------------------------------------
  // Cascade + resolution
  // -------------------------------------------------------------------------

  private async cascadeLoop(initialMatches: Match[], swapPositions: Position[]): Promise<void> {
    let matches = initialMatches;
    let comboCount = 0;
    let isFirst = true;
    while (matches.length > 0) {
      comboCount += matches.length;
      await this.resolveMatches(matches, comboCount, isFirst ? swapPositions : []);
      const moves = this.grid.applyGravity();
      await this.board.animateGravity(moves);
      const filled = this.grid.fillEmpty(this.randomTile);
      await this.board.animateSpawn(filled);
      matches = MatchDetector.findAll(this.grid);
      isFirst = false;
    }
  }

  private async resolveMatches(
    matches: Match[],
    comboCount: number,
    preferredPositions: Position[],
  ): Promise<void> {
    const newSpecials = this.planSpecialCreation(matches, preferredPositions);
    const newSpecialKeys = new Set(newSpecials.map((s) => posKey(s.pos)));

    const seed = new Set<string>();
    for (const m of matches) {
      for (const p of m.positions) {
        const k = posKey(p);
        if (!newSpecialKeys.has(k)) seed.add(k);
      }
    }

    await this.clearWithActivations(seed, newSpecials, comboCount);
  }

  /**
   * Central clearing routine. Runs the activation chain on a seed set, then:
   *   - Adds adjacent stones to the clear-set (1-hit breakage)
   *   - Scores / plays audio / shows popups
   *   - Snapshots cleared tile colors for fly-to-score
   *   - Upgrades new specials and animates their pulse
   *   - Counts destroyed stones for level objectives
   *   - Triggers the explosion + fire-and-forget fly animation
   */
  private async clearWithActivations(
    seed: Set<string>,
    newSpecials: NewSpecial[],
    comboCount: number,
  ): Promise<void> {
    // Activation chain (fixpoint)
    const activated = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const k of Array.from(seed)) {
        if (activated.has(k)) continue;
        const pos = keyToPos(k);
        const t = this.grid.get(pos.row, pos.col);
        if (t && isSpecial(t)) {
          activated.add(k);
          changed = true;
          for (const affected of this.computeActivation(pos, t)) {
            seed.add(posKey(affected));
          }
        }
      }
    }

    // Stone adjacency: any stone bordering a cleared cell takes a hit and is removed.
    const stoneHits = new Set<string>();
    for (const k of Array.from(seed)) {
      const pos = keyToPos(k);
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const r = pos.row + dr;
        const c = pos.col + dc;
        if (!this.grid.inBounds(r, c)) continue;
        const t = this.grid.get(r, c);
        const cellKey = posKey({ row: r, col: c });
        if (t && t.kind === 'stone' && !seed.has(cellKey)) stoneHits.add(cellKey);
      }
    }
    for (const k of stoneHits) seed.add(k);

    const positions = Array.from(seed).map(keyToPos);

    // Snapshots for fly-to-score (exclude walls — they're not cleared anyway)
    const snapshots: ClearedSnapshot[] = [];
    let destroyedStonesThisWave = 0;
    for (const p of positions) {
      const t = this.grid.get(p.row, p.col);
      if (!t) continue;
      if (t.kind === 'wall') continue;
      if (t.kind === 'stone') {
        destroyedStonesThisWave++;
        continue; // stones don't have a color for the fly effect
      }
      snapshots.push({ pos: p, color: t.color });
    }
    this.stonesDestroyed += destroyedStonesThisWave;
    if (destroyedStonesThisWave > 0) this.updateObjective();

    // Filter out walls: walls never clear.
    const clearablePositions = positions.filter((p) => {
      const t = this.grid.get(p.row, p.col);
      return !t || t.kind !== 'wall';
    });

    // Score
    const points = clearablePositions.length * GAME_CONFIG.score.perTile * Math.max(1, comboCount);
    this.addScore(points);
    this.sound.playMatch(Math.min(Math.max(1, comboCount), 11));
    if (comboCount >= 2) this.sound.playCombo(comboCount);

    // Popups
    const centroid = this.centroidPixel(clearablePositions);
    this.board.showScorePopup(
      centroid.x,
      centroid.y,
      points,
      comboColorForMultiplier(Math.max(1, comboCount)),
    );
    if (comboCount >= 2) this.board.showCombo(comboCount);

    // Upgrade new specials
    for (const s of newSpecials) {
      this.grid.set(s.pos.row, s.pos.col, { color: s.color, kind: s.kind });
    }
    const upgradeAnims = newSpecials.map((s) => this.board.convertTile(s.pos, s.kind));

    // Clear cells
    for (const p of clearablePositions) this.grid.set(p.row, p.col, null);

    await Promise.all([...upgradeAnims, this.board.animateRemove(clearablePositions)]);

    this.flyTilesToScore(snapshots);
  }

  // -------------------------------------------------------------------------
  // Special combo pipeline
  // -------------------------------------------------------------------------

  private async runSpecialCombo(
    posA: Position,
    posB: Position,
    tileA: Tile,
    tileB: Tile,
  ): Promise<void> {
    const seed = new Set<string>();
    seed.add(posKey(posA));
    seed.add(posKey(posB));

    const isBombA = tileA.kind === 'color-bomb';
    const isBombB = tileB.kind === 'color-bomb';

    if (isBombA && isBombB) {
      for (let r = 0; r < this.grid.rows; r++) {
        for (let c = 0; c < this.grid.cols; c++) {
          const t = this.grid.get(r, c);
          if (t && t.kind !== 'wall') seed.add(posKey({ row: r, col: c }));
        }
      }
    } else if (isBombA || isBombB) {
      const target = isBombA ? tileB : tileA;
      const targetColor = target.color;
      const convertKind: TileKind | null = isSpecial(target)
        ? target.kind === 'color-bomb'
          ? null
          : target.kind
        : null;

      for (let r = 0; r < this.grid.rows; r++) {
        for (let c = 0; c < this.grid.cols; c++) {
          const t = this.grid.get(r, c);
          if (t && t.color === targetColor && t.kind !== 'wall' && t.kind !== 'stone') {
            if (convertKind) {
              const newKind: TileKind =
                convertKind === 'striped-h'
                  ? (r + c) % 2 === 0
                    ? 'striped-h'
                    : 'striped-v'
                  : convertKind;
              this.grid.set(r, c, { color: t.color, kind: newKind });
            }
            seed.add(posKey({ row: r, col: c }));
          }
        }
      }
    } else {
      const kinds = new Set<TileKind>([tileA.kind, tileB.kind]);
      const pivot = posB;

      if (kinds.has('wrapped') && !kinds.has('striped-h') && !kinds.has('striped-v')) {
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const r = pivot.row + dr;
            const c = pivot.col + dc;
            if (this.grid.inBounds(r, c)) seed.add(posKey({ row: r, col: c }));
          }
        }
      } else if (kinds.has('wrapped')) {
        for (let dr = -1; dr <= 1; dr++) {
          const r = pivot.row + dr;
          if (r >= 0 && r < this.grid.rows) {
            for (let c = 0; c < this.grid.cols; c++) seed.add(posKey({ row: r, col: c }));
          }
        }
        for (let dc = -1; dc <= 1; dc++) {
          const c = pivot.col + dc;
          if (c >= 0 && c < this.grid.cols) {
            for (let r = 0; r < this.grid.rows; r++) seed.add(posKey({ row: r, col: c }));
          }
        }
      } else {
        for (let c = 0; c < this.grid.cols; c++) seed.add(posKey({ row: pivot.row, col: c }));
        for (let r = 0; r < this.grid.rows; r++) seed.add(posKey({ row: r, col: pivot.col }));
      }
    }

    await this.clearWithActivations(seed, [], 2);

    const moves = this.grid.applyGravity();
    await this.board.animateGravity(moves);
    const filled = this.grid.fillEmpty(this.randomTile);
    await this.board.animateSpawn(filled);

    const follow = MatchDetector.findAll(this.grid);
    if (follow.length > 0) {
      await this.cascadeLoop(follow, []);
    }
  }

  // -------------------------------------------------------------------------
  // Special creation + activation
  // -------------------------------------------------------------------------

  private planSpecialCreation(matches: Match[], preferred: Position[]): NewSpecial[] {
    const used = new Set<Match>();
    const out: NewSpecial[] = [];

    for (const lt of MatchDetector.findLTIntersections(matches)) {
      if (used.has(lt.horiz) || used.has(lt.vert)) continue;
      out.push({ pos: lt.intersection, kind: 'wrapped', color: lt.color });
      used.add(lt.horiz);
      used.add(lt.vert);
    }
    for (const m of matches) {
      if (used.has(m)) continue;
      if (m.length >= 5) {
        out.push({ pos: pickPos(m, preferred), kind: 'color-bomb', color: m.color });
        used.add(m);
      }
    }
    for (const m of matches) {
      if (used.has(m)) continue;
      if (m.length === 4) {
        const kind: TileKind = m.orientation === 'horizontal' ? 'striped-h' : 'striped-v';
        out.push({ pos: pickPos(m, preferred), kind, color: m.color });
        used.add(m);
      }
    }
    return out;
  }

  private computeActivation(pos: Position, t: Tile): Position[] {
    const positions: Position[] = [];
    switch (t.kind) {
      case 'striped-h':
        for (let c = 0; c < this.grid.cols; c++) if (c !== pos.col) positions.push({ row: pos.row, col: c });
        break;
      case 'striped-v':
        for (let r = 0; r < this.grid.rows; r++) if (r !== pos.row) positions.push({ row: r, col: pos.col });
        break;
      case 'wrapped':
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = pos.row + dr;
            const c = pos.col + dc;
            if (this.grid.inBounds(r, c)) positions.push({ row: r, col: c });
          }
        }
        break;
      case 'color-bomb':
        for (let r = 0; r < this.grid.rows; r++) {
          for (let c = 0; c < this.grid.cols; c++) {
            if (r === pos.row && c === pos.col) continue;
            const other = this.grid.get(r, c);
            if (other && other.color === t.color && other.kind !== 'wall' && other.kind !== 'stone') {
              positions.push({ row: r, col: c });
            }
          }
        }
        break;
      default:
        break;
    }
    return positions;
  }

  // -------------------------------------------------------------------------
  // Deadlock reshuffle
  // -------------------------------------------------------------------------

  private async reshuffle(): Promise<void> {
    let tries = 0;
    do {
      this.grid.reshuffle();
      tries++;
    } while (
      tries < 20 &&
      (MatchDetector.hasAnyMatch(this.grid) || !MatchDetector.hasPlayableMove(this.grid))
    );
    await this.board.animateReshuffle();
  }

  // -------------------------------------------------------------------------
  // Fly-to-score animation
  // -------------------------------------------------------------------------

  private flyTilesToScore(snapshots: ClearedSnapshot[]): void {
    if (snapshots.length === 0) return;
    const target = this.hud.getScoreStagePosition();
    const items = snapshots.slice(0, 20);
    const tileSize = GAME_CONFIG.grid.tileSize;
    for (let i = 0; i < items.length; i++) {
      const { pos, color } = items[i];
      const fill = GAME_CONFIG.colors.tiles[color % GAME_CONFIG.colors.tiles.length];
      const sphere = new Graphics();
      sphere.circle(0, 0, 11).fill(fill);
      sphere.circle(0, 0, 11).stroke({ color: 0xffffff, width: 2, alpha: 0.7 });
      sphere.x = this.boardOffset.x + pos.col * tileSize + tileSize / 2;
      sphere.y = this.boardOffset.y + pos.row * tileSize + tileSize / 2;
      sphere.alpha = 0;
      this.app.stage.addChild(sphere);
      const delay = i * 0.04;
      const tl = gsap.timeline({
        delay,
        onComplete: () => {
          this.hud.pulseScore();
          if (sphere.parent) this.app.stage.removeChild(sphere);
          sphere.destroy();
        },
      });
      tl.to(sphere, { alpha: 1, duration: 0.08 }, 0)
        .to(sphere, { x: target.x, y: target.y, duration: 0.55, ease: 'power2.in' }, 0)
        .to(sphere.scale, { x: 0.5, y: 0.5, duration: 0.55, ease: 'power2.in' }, 0)
        .to(sphere, { alpha: 0, duration: 0.15 }, '>-0.15');
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private centroidPixel(positions: Position[]): { x: number; y: number } {
    const s = GAME_CONFIG.grid.tileSize;
    if (positions.length === 0) {
      return { x: (this.grid.cols * s) / 2, y: (this.grid.rows * s) / 2 };
    }
    let sx = 0;
    let sy = 0;
    for (const p of positions) {
      sx += p.col * s + s / 2;
      sy += p.row * s + s / 2;
    }
    return { x: sx / positions.length, y: sy / positions.length };
  }

  private addScore(n: number): void {
    this.score += n;
    this.onScoreChange?.(this.score);
    this.updateObjective();
  }

  // -------------------------------------------------------------------------
  // Hint system
  // -------------------------------------------------------------------------

  private resetHintTimer(): void {
    this.cancelHint();
    if (this.completed) return;
    this.hintTimer = window.setTimeout(
      () => this.triggerHint(),
      GAME_CONFIG.hint.idleDelaySec * 1000,
    );
  }

  private cancelHint(): void {
    if (this.hintTimer !== null) {
      window.clearTimeout(this.hintTimer);
      this.hintTimer = null;
    }
    if (this.hintActive) {
      this.board?.clearHint();
      this.hintActive = false;
    }
  }

  private triggerHint(): void {
    this.hintTimer = null;
    if (this.completed) return;
    if (this.queue.isBusy) {
      this.resetHintTimer();
      return;
    }
    const moves = MatchDetector.findPlayableMoves(this.grid);
    if (moves.length === 0) return;
    const pick = moves[Math.floor(Math.random() * moves.length)];
    this.board.showHint(pick.a, pick.b);
    this.hintActive = true;
  }
}

function pickPos(match: Match, preferred: Position[]): Position {
  for (const p of preferred) {
    if (match.positions.some((q) => posEquals(p, q))) return p;
  }
  return match.positions[Math.floor(match.positions.length / 2)];
}

function comboColorForMultiplier(multiplier: number): number {
  if (multiplier >= 5) return 0xff4757;
  if (multiplier >= 4) return 0xff9800;
  if (multiplier >= 3) return 0xffeb3b;
  if (multiplier >= 2) return 0x7bed9f;
  return 0xffffff;
}
