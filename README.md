# Match-3

Un match-3 fait à la main avec **TypeScript**, **PixiJS 8**, **Vite** et **GSAP**.

25 niveaux, mode infini, boutique avec économie de pièces, formes de grille variées (T, U, croix, sablier, losange, anneau, H, escalier), pierres résistantes et bombes spéciales.

## Démarrer

```bash
npm install
npm run dev
```

Puis http://localhost:5173.

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de dev avec HMR |
| `npm run build` | Typecheck + build de production dans `dist/` |
| `npm run preview` | Aperçu local du build |
| `npm test` | Tests unitaires |

## Comment on joue

Clic sur une tuile, clic sur une tuile adjacente pour swap. Aligner 3+ tuiles de la même couleur les détruit. Les cascades enchaînent un combo multiplicateur sur le score.

**Tuiles spéciales** :
- 4 alignées → **Rayé** : détruit toute une ligne ou colonne
- L/T → **Emballé** : détruit une zone 3×3
- 5 alignées → **Bombe** : détruit toutes les tuiles d'une couleur

Combiner deux spéciales en swap déclenche un effet renforcé (toutes les paires couvertes).

**Obstacles** :
- **Murs** : indestructibles, bloquent la chute mais les tuiles glissent en diagonale autour
- **Pierres** : se cassent en 1, 2 ou 3 coups par adjacence avec un match (le compteur s'affiche)
- **Void** : zones hors de la grille (visibles en gris foncé) — pour les formes T, U, croix, etc.

## Mode niveau vs mode infini

**Niveaux** : 25 paliers progressifs. Chacun a un objectif (score, casser N pierres, ou collecter N tuiles d'une couleur), un nombre de coups limité, parfois une forme spéciale ou des obstacles. Une carte de progression style Mario montre le chemin.

**Infini** : pas d'objectif, pas de fin. Sert à **farmer des pièces** (1 pièce gagnée tous les 500 points) pour acheter des items à la boutique.

## Boutique

Pendant une partie, panneau de droite. 3 items utilisables :

| Item | Prix | Effet |
| --- | --- | --- |
| **+5 Coups** | 100 🪙 | Ajoute 5 coups au niveau en cours |
| **Pluie de bombes** | 200 🪙 | Place 5 bombes de couleur au hasard |
| **Marteau** | 75 🪙 | Le prochain clic détruit une tuile (re-cliquer la carte annule + rembourse) |

Économie : 150 🪙 au démarrage, 50+5×levelId pour gagner un niveau, 10 pour le perdre, ou farm en mode infini.

## Architecture

Le code est strictement séparé en deux couches :

```
src/core/      Logique pure : grille, matchs, gravité. Aucun import Pixi. Testable en Node.
src/game/      Rendu et orchestration : Pixi + GSAP, anime les états du core.
src/ui/        Panneaux UI (HUD, légende, boutique).
src/scenes/    Écrans : menu, sélection de niveau, partie, résultats.
src/levels/    Données des 25 niveaux + helpers de formes.
src/save/      Persistance localStorage (progression, pièces, son).
src/audio/     Sons procéduraux Web Audio (pas de fichiers audio).
src/shop/      Catalogue des items + récompenses en pièces.
```

La règle d'or : `core/` n'importe jamais Pixi. La logique du jeu peut tourner sans rendu, ce qui rend les tests simples et rapides.

## Tests

```bash
npm test
```

25 tests unitaires sur la grille, la détection de matchs (avec L/T et obstacles), la gravité avec glissade diagonale, la génération initiale et les formes.

## Déploiement (GitHub Pages)

Push sur `main`, le workflow `.github/workflows/deploy.yml` build et publie automatiquement. Active **Settings → Pages → Source: GitHub Actions** sur ton repo. URL finale : `https://<pseudo>.github.io/<nom-du-repo>/`.

## Notes

"Match-3" est le nom du genre, pas un titre. Pour publier ce projet quelque part, choisis un nom et une identité visuelle qui t'appartiennent.
