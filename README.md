# Match-3

Match-3 game built with **PixiJS 8**, **TypeScript**, **Vite** and **GSAP**.
Project skeleton: fully playable core loop (swap, match, cascade, refill, score) with clean logic/rendering separation.

## Quickstart

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Typecheck + production build (outputs to `dist/`) |
| `npm run preview` | Preview the prod build locally |
| `npm test` | Run unit tests once |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run typecheck` | Type-check only (no emit) |

## Architecture

Strict separation between **logic** (pure, testable, no Pixi) and **rendering** (Pixi + GSAP).

```
src/
├── config.ts                 # Grid size, colors, animation timings
├── core/                     # Pure logic — no Pixi, no DOM, unit-testable
│   ├── types.ts
│   ├── Grid.ts               # Matrix state, swap/gravity/fill
│   ├── MatchDetector.ts      # 3+ runs, playable-move check
│   └── GridGenerator.ts      # Initial grid with no starting matches
├── game/                     # Rendering + orchestration
│   ├── Game.ts               # Main loop: swap → match → cascade
│   ├── BoardView.ts          # Draws the grid, runs animations
│   ├── TileView.ts           # One tile sprite
│   ├── InputController.ts    # Mouse/touch selection + swap
│   └── AnimationQueue.ts     # Serializes async game steps
├── ui/
│   └── Hud.ts                # Score display
├── utils/
│   └── tween.ts              # Promise-wrapped GSAP tween
└── main.ts                   # Bootstraps the Pixi Application

tests/
└── Grid.test.ts              # Vitest unit tests on core logic
```

The critical rule: `core/` never imports Pixi. You could run the entire game loop headless in a Node test if you wanted to.

## Implemented

- **Responsive scaling** — the canvas keeps its logical size but is CSS-scaled to fit the viewport (centered, capped at 2.5× to avoid blurry upscales). Resize the window and it re-fits.
- **Shop / boutique in-game** — right-side panel during play, coin balance + 3 buyable items:
  - **+5 Coups** (100 🪙) — adds 5 moves to the current level
  - **Pluie de bombes** (200 🪙) — plants 5 color bombs at random cells; swap to detonate
  - **Marteau** (75 🪙) — next click destroys the chosen tile (hammer cursor + board tint to telegraph)
  - Unaffordable cards grey out; insufficient funds triggers a shake + status message
- **Economy** — 150 🪙 at start; level wins earn 50 + 5×levelId, losses earn 10; tracked in localStorage
- **Coin reward line** on the results screen with animated running total
- **Main menu** with Niveaux / Mode Infini / Reset progression
- **Mario-style world map** — nodes on a serpentine path, difficulty-colored medallions, pulsing next-to-beat level, dashed-golden path for completed segments
- **Level mode**: move counter, objective (score or destroy stones), win/loss screen with Retry / Next / Menu
- **Infinite mode**: the classic open-ended play
- **Obstacles**
  - **Walls** — indestructible; act as floor for gravity; block refill columns below them
  - **Stones** — destroyed in one hit when a match clears an adjacent cell (or hammer directly)
- **Progress persistence** — highest unlocked, best scores, sound pref, coin balance
- 9×9 grid, 6 tile colors
- Match detection (horizontal + vertical, runs of 3+), with length and L/T intersection info
- Cascade pipeline: remove → gravity → refill → re-detect
- **Special candies** — Rayé (4), Emballé (L/T), Bombe (5)
- **Special × Special combos** — all 7 combinations implemented
- **Match feedback** — flash + pop + scale + spin, floating score popups, combo multiplier banner
- **Procedural sound** via Web Audio API, **Clickable SON ON/OFF button**, **← MENU** button during play
- **Hint system** — 5 s of idle pulses a playable swap
- **LevelPanel** (left) — objective + moves + legend of special tiles
- **Fly-to-score animation** — cleared tiles fly to the HUD score, which pulses
- **Deadlock detection** — reshuffle preserves walls & stones in place
- Unit tests on Grid, MatchDetector (incl. L/T + obstacles), GridGenerator — **20/20 passing**

## Levels

Displayed on a **Mario-style world map** — nodes linked by a dashed path, color-coded by difficulty.

| # | Name | Moves | Objective | Mechanics |
| --- | --- | --- | --- | --- |
| 1 | Premiers pas | 25 | Score 1 200 | — |
| 2 | Apprenti | 22 | Score 2 200 | — |
| 3 | Entre les murs | 25 | Score 2 800 | 3 murs (les tuiles glissent autour) |
| 4 | En T | 26 | Score 3 500 | **Grille en T** |
| 5 | Briseur de pierres | 22 | 4 pierres | 4 pierres |
| 6 | En U | 24 | 5 pierres | **Grille en U** + 5 pierres |
| 7 | Croix | 26 | Score 4 500 | **Grille en croix** + 1 mur central |
| 8 | Grand final | 28 | 8 pierres | 8 pierres + 2 murs |

**Diagonal-slide gravity**: when a wall blocks a column, tiles from neighboring columns slide diagonally to fill the gap. The board never stays half-empty under an obstacle.

**Shaped grids**: levels 4, 6, 7 use void cells to define the playfield outline (T, U, cross). Tiles, matches, and refill all respect the shape.
- Unit tests on Grid, MatchDetector (incl. L/T), GridGenerator

## Roadmap

1. **Swap-to-activate color bomb** — swapping a color bomb with any tile clears that color (no match needed)
2. **Special × special combos** — striped + striped, striped + wrapped, wrapped + wrapped, anything + color bomb
3. **Game feel** — screen shake on big combos, particles on explode, easing tuning on cascades
4. **Deadlock detection** — `MatchDetector.hasPlayableMove` already exists; wire it to a reshuffle animation
5. **Level system** — JSON level data, objectives (score / clear tiles / drop ingredients), move limit
6. **Save** — localStorage for progress, unlocked levels
7. **Art pass** — replace flat shapes with sprites (Kenney.nl, itch.io, or custom)

## Design notes

- **AnimationQueue** serializes every game step so a fast double-click can't interleave a second swap mid-cascade.
- **GridGenerator** retries each cell until a legal color is found — guarantees no starting matches without using a math formula (which only works for simple cases).
- **BoardView** reassigns tile references **before** tweening in `animateGravity`, so overlapping moves in the same column don't collide.
- **`hasPlayableMove`** is O(rows·cols) with swap/revert — cheap enough to run after every cascade settles.

## Notes

"Match-3" is the genre. If you ever ship this publicly, pick an original name and visual identity — don't call it Candy Crush.
