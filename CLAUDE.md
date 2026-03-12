# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Application

No build step required. Open `index.html` directly in a modern browser. There are no npm packages, build tools, or dependencies.

Configuration is loaded at runtime from published Google Sheets CSV URLs (see `js/config.js` → `SHEET_URLS`). A "↺ Reload Config" button on the title screen re-fetches it.

## Architecture

The game is split across `index.html` (markup + inline styles) and multiple JS files under `js/`:

| File | Responsibility |
|------|---------------|
| `js/utils.js` | `rotC` (shape rotation), `sfl` (shuffle), `mkDeck`, `dealHand`, helpers |
| `js/treat-effects.js` | Add/mul helper functions (`surrAdd`, `rowAdd`, `colAdd`, `allAdd`, `allMulCS`, `colMul`, `surrMulCS`, `shapeMul`) |
| `js/treats/registry.js` | `TREAT_REGISTRY = {}` — named treats register here |
| `js/treats/requirements.js` | `REQUIREMENT_FNS` map + `requirementFails(req)` |
| `js/treats/<id>.js` | One file per treat with custom logic (see Treat System below) |
| `js/config.js` | Fetches Google Sheets CSVs, parses into globals (`CFG`, `RCFG`, `COLS`, `EMS`, `TDEFS`, `CSHAPES`, `DECKS`), calls `buildTreatFn` |
| `js/state.js` | Global mutable state `G` and `H` |
| `js/board.js` | Placement validation (`boardCanPlace`) and committing pieces |
| `js/backpack.js` | Inventory grid management |
| `js/held.js` | Mouse/touch drag-and-drop logic |
| `js/render.js` | All DOM updates (`renderAll`, `renderBoard`, `renderHand`, `renderBP`, `renderShopFull`) |
| `js/scoring.js` | `doFit()`, `runScoreSequence()`, `endScoreSequence()` — four phases: base → add treats → mul treats → board fill bonus |
| `js/shop.js` | Treat purchasing and reroll logic |

Script load order in `index.html` matters: utils → treat-effects → registry → requirements → treat files → config → state → board → backpack → held → render → scoring → shop.

## Key Data Structures

**`G` (game state):**
```
round, score, tgt, bsr/bsc (board dims), earn, hands, disc, cash,
deckId, deck[], hand[], board[][] (2D grid of cells), bp[][] (backpack),
bpGroups[], cats[], treats[]
```

**`H` (held piece):**
```
kind ('cat'|'treat'|'shop-treat'|null), source, data,
cells (2D shape), rot (0-3), color, em, handIdx/boardGid/bpGid,
grabDr/grabDc (grab offset within shape), dragging
```

**Board cell:** `{ filled, col, kind, em, gid, shape, type }`

**TDEF (treat definition):** `{ id, nm, em, rar, col, phase, bpS, ef, req, pr, sp, fl, fn }`

## Screen Flow

`s-loading` → `s-title` (deck select) → `s-rounds` (round info + shop) → `s-game` (gameplay) → `s-shop` (between rounds)

Screens are `display:none` by default and made visible with class `.on`.

## Gameplay Loop

`doFit()` triggers the score sequence → `runScoreSequence()` animates phases → `endScoreSequence()` checks win/loss → `roundWin()` or next hand dealt via `dealHand()`.

## Treat System

Every treat in the sheet has its own file at `js/treats/<id>.js`. Each file registers into `TREAT_REGISTRY`:

```js
TREAT_REGISTRY['id'] = {
  buildFn(ef, phase) {
    // return a function (b, cats, ts, p, cs) => { bonus, desc } or { gids, m }
  }
};
```

`buildTreatFn(id, ef, phase)` in `config.js` checks the registry first; falls back to generic pattern matching only for treats without a registry entry.

Add-phase functions return `{ bonus, desc }`. Mul-phase functions return `{ gids: [...], m: N }`.

### All treats (from Google Sheet)

| ID | Name | Phase | Effect | Requirement |
|----|------|-------|--------|-------------|
| milk | WARM MILK | add | +8 to ALL cats | — |
| catnip | CATNIP | add | +25 to cats in same ROW | — |
| feather | FEATHER | add | +25 to cats in same COL | — |
| box | BOX | add | +25 to SURROUNDING cats | — |
| sardine_tin | SARDINE TIN | add | (special) | — |
| yarn | YARN BALL | mul | ×2 L shaped cats | — |
| laser | LASER POINTER | x | copies ability of one other random treat | — |
| jumping_ball | JUMPING BALL | x | disable one random treat's requirement | — |
| brownies | BROWNIES | x | add duplicate of one random surrounding cat to deck | — |
| nap | POWER NAP | mul | ×2 ALL cats | NO OTHER TREAT |
| frenzy | FRENZY BALL | mul | ×3 SURROUNDING cats | ALL SAME TYPE |
| catnado | CATNADO | mul | ×2 ALL cats | ALL SAME TYPE |
| tuna_can | TUNA CAN | mul | ×2 all ORANGE cats | — |

## Configuration Data Source

Live data is fetched from published Google Sheets CSV endpoints defined in `SHEET_URLS` in `js/config.js`. Tabs: General, Rounds, Treats, Cats, Shapes, Decks.

## Sheet Snapshots & Change Detection Workflow

Snapshots of all six sheets are saved locally in `sheets/` (one CSV per tab):

```
sheets/General.csv
sheets/Rounds.csv
sheets/Treats.csv
sheets/Cats.csv
sheets/Shapes.csv
sheets/Decks.csv
```

**When the user says they added or changed a treat (or any sheet data):**

1. Re-fetch all six sheets via the `SHEET_URLS` in `js/config.js` (follow the 307 redirects).
2. Diff the new CSV against the saved snapshot to identify exactly what changed.
3. Implement the required code changes (new treat file, updated registry entry, etc.).
4. Overwrite the snapshot files with the new CSV content so they stay current.
5. Commit and push.

This keeps `sheets/` as the source of truth for "last known sheet state" so diffs are always accurate.
