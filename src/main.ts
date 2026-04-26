import { Application } from 'pixi.js';
import { SoundManager } from './audio/SoundManager';
import { GAME_CONFIG } from './config';
import { LEVELS, type LevelDef } from './levels/levels';
import { SaveData } from './save/SaveData';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { PlayScene, type PlayResult } from './scenes/PlayScene';
import { ResultsScene } from './scenes/ResultsScene';
import { SceneManager } from './scenes/SceneManager';
import { coinsForResult } from './shop/items';

async function bootstrap(): Promise<void> {
  const app = new Application();
  // Logical canvas size — layout math stays simple.
  // Physical size is fixed; we scale visually via CSS transform below.
  const LOGICAL_W = GAME_CONFIG.canvas.totalWidth;
  const LOGICAL_H = GAME_CONFIG.canvas.height + GAME_CONFIG.canvas.hudHeight;

  await app.init({
    width: LOGICAL_W,
    height: LOGICAL_H,
    background: GAME_CONFIG.colors.background,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio, 2),
    autoDensity: true,
  });

  const host = document.getElementById('game');
  if (!host) throw new Error('Missing #game element');
  host.appendChild(app.canvas);

  // --- Responsive scaling ----------------------------------------------------
  // Strategy: instead of CSS-stretching the canvas (which produces a blurry
  // upscale), we ask Pixi to render at the *target on-screen pixel density*.
  //
  //   - The renderer's resolution is set to (cssScale * devicePixelRatio).
  //     On a regular display this gives crisp upscales; on retina it stays
  //     pixel-perfect.
  //   - Game coordinates never change — we only call resize() with the same
  //     logical dimensions; Pixi multiplies internally by `resolution` to pick
  //     the actual canvas backing-store size.
  //   - The canvas's CSS box is set to the on-screen scaled size so layout
  //     centers it. autoDensity (passed to init) handles the inverse scaling
  //     of the canvas's `style.width/height` for us — but we also force them
  //     after each resize for safety.
  const MIN_MARGIN = 24;
  const dpr = window.devicePixelRatio || 1;
  function applyScale(): void {
    const availW = window.innerWidth - MIN_MARGIN * 2;
    const availH = window.innerHeight - MIN_MARGIN * 2;
    const cssScale = Math.min(availW / LOGICAL_W, availH / LOGICAL_H, 3);

    // Tell Pixi to render at the higher resolution. This actually allocates
    // more backing pixels — no blur. The renderer keeps the *logical* size
    // (LOGICAL_W × LOGICAL_H), so all in-game coordinates remain identical.
    app.renderer.resolution = cssScale * dpr;
    app.renderer.resize(LOGICAL_W, LOGICAL_H);

    const canvas = app.canvas as HTMLCanvasElement;
    // Cancel any leftover transform from previous attempts.
    canvas.style.transform = '';
    // Set the *display* size to the scaled box. autoDensity normally does this,
    // but we re-assert to be sure layout matches our host sizing.
    canvas.style.width = `${LOGICAL_W * cssScale}px`;
    canvas.style.height = `${LOGICAL_H * cssScale}px`;

    host!.style.width = `${LOGICAL_W * cssScale}px`;
    host!.style.height = `${LOGICAL_H * cssScale}px`;
  }
  applyScale();
  window.addEventListener('resize', applyScale);

  // --- Audio + save state ----------------------------------------------------
  const sound = new SoundManager();
  sound.setEnabled(SaveData.get().soundEnabled);

  // --- Scene orchestration ---------------------------------------------------
  const mgr = new SceneManager(app);
  const W = LOGICAL_W;
  const H = LOGICAL_H;

  function showMenu(): void {
    mgr.set(
      new MainMenuScene({
        width: W,
        height: H,
        onPlayLevels: showLevelSelect,
        onPlayInfinite: () => startPlay({ type: 'infinite' }, null),
        onReset: () => {
          SaveData.reset();
          showMenu();
        },
      }),
    );
  }

  function showLevelSelect(): void {
    mgr.set(
      new LevelSelectScene({
        width: W,
        height: H,
        onBack: showMenu,
        onSelect: (def) => startPlay({ type: 'level', def }, def),
      }),
    );
  }

  function startPlay(
    mode: { type: 'infinite' } | { type: 'level'; def: LevelDef },
    def: LevelDef | null,
  ): void {
    const scene = new PlayScene({
      app,
      sound,
      mode,
      onMenu: () => {
        if (def) SaveData.recordScore(def.id, scene.getScore());
        showMenu();
      },
      onComplete: (result: PlayResult) => {
        if (def) {
          const nextId = def.id + 1;
          if (result.won) {
            SaveData.recordWin(def.id, result.score, nextId);
          } else {
            SaveData.recordScore(def.id, result.score);
          }
          // Award coins based on result.
          const earned = coinsForResult(result.won, def.id);
          SaveData.addCoins(earned);
          const hasNext = result.won && LEVELS.some((l) => l.id === nextId);
          mgr.set(
            new ResultsScene({
              width: W,
              height: H,
              def,
              won: result.won,
              score: result.score,
              best: SaveData.bestScore(def.id),
              coinsEarned: earned,
              totalCoins: SaveData.getCoins(),
              hasNext,
              sound,
              onMenu: showMenu,
              onRetry: () => startPlay({ type: 'level', def }, def),
              onNext: hasNext
                ? () => {
                    const next = LEVELS.find((l) => l.id === nextId)!;
                    startPlay({ type: 'level', def: next }, next);
                  }
                : undefined,
            }),
          );
        }
      },
    });
    mgr.set(scene);
    void scene.start();
  }

  showMenu();

  window.addEventListener('beforeunload', () => {
    SaveData.setSoundEnabled(sound.enabled);
  });
}

void bootstrap();
