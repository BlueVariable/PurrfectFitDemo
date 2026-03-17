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
| `js/config.js` | Fetches Google Sheets CSVs, parses into globals (`CFG`, `RCFG`, `COLS`, `EMS`, `TDEFS`, `CSHAPES`, `DECKS`, `BRANCHES`, `RARITY_WEIGHTS`), calls `buildTreatFn` |
| `js/state.js` | Global mutable state `G` and `H` |
| `js/board.js` | Placement validation (`boardCanPlace`) and committing pieces |
| `js/backpack.js` | Inventory grid management |
| `js/held.js` | Mouse/touch drag-and-drop logic |
| `js/render.js` | All DOM updates (`renderAll`, `renderBoard`, `renderHand`, `renderBP`, `renderShopFull`) |
| `js/scoring.js` | `doFit()`, `runScoreSequence()`, `endScoreSequence()` — four phases: base → add treats → mul treats → board fill bonus |
| `js/branches.js` | World map progression: `BRANCHES_FALLBACK`, unlock logic, `renderBranches()`, `selectBranch()`, progress persistence via localStorage |
| `js/shop.js` | Treat purchasing and reroll logic |

Script load order in `index.html` matters: utils → treat-effects → registry → requirements → treat files → config → branches → state → board → backpack → held → render → scoring → shop.

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

`s-loading` → `s-menu` (main menu) → `s-branches` (world map / branch select) → `s-rounds` (round info + shop combined) → `s-game` (gameplay)

Screens are `display:none` by default and made visible with class `.on`. Overlays (`ov-*`) use class `.off` to hide.

### Menu Screen (`s-menu`)

- Title card with game name and tagline
- **Continue** button (hidden unless `gameInProgress` is true) — resumes at the rounds/shop screen via `menuContinue()` → `openRounds()`
- **Play** button — `menuPlay()` → `goToBranches()` (world map)
- **Settings** button (placeholder, currently no-op)
- **Dev Mode** toggle — shows/hides dev panel with "Reload Config" and "Config Sheet" buttons
- Floating dev button (`btn-dev-float`) is visible on all screens when dev mode is active

### Branches Screen (`s-branches`) — World Map

- Top bar: ← Back button (`exitToMenu()`), "WORLD MAP" title, coin display (shown only if `gameInProgress`)
- Body (`br-body`): rendered by `renderBranches()`, grouped by continent
- **Continents** are derived from `BRANCHES` (sheet data) or `BRANCHES_FALLBACK` (hardcoded). Each continent has an emoji, name, and ordered list of branches
- **Branch cards** show status (✅ completed / 🔓 unlocked / 🔒 locked), city name, deck emoji+name (from `DECK_META`), modifier labels, description, and a Play/Replay/Locked button
- **Unlock logic** (`isBranchUnlocked`): first branch of first continent is always open; within a continent, previous branch must be completed; first branch of a new continent requires all branches of the previous continent completed
- **Progress** stored in localStorage key `pf-progress` as `{completed: [branchId, ...]}`
- **Modifiers** (`MOD_LABELS`): `hands-1` → "-1 Hand", `no-discard` → "No Discards", `bp-small` → "3×3 Backpack", `cash-2` → "-$2 Starting Cash". Multiple mods joined with " · "
- Selecting a branch calls `selectBranch(id)` → `newGameFromBranch(id)` → `openRounds()`
- Branch win overlay (`ov-branch-win`): shown on completing all rounds, with "Back to World Map" button

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

`buildTreatFn(id, ef, phase, addEf)` in `config.js` checks the registry first; falls back to generic pattern matching only for treats without a registry entry.

Add-phase functions return `{ bonus, desc }` or `{ bonusMap }`. Mul-phase functions return `{ gids: [...], m: N }`.

### All treats (from Google Sheet)

| ID | Name | Phase | Effect | Additional Effects | Requirement |
|----|------|-------|--------|--------------------|-------------|
| milk | WARM MILK | add | +8 to ALL cats | — | — |
| catnip | CATNIP | add | +25 to cats in same ROW | — | — |
| feather | FEATHER | add | +25 to cats in same COL | — | — |
| box | BOX | add | +25 to SURROUNDING cats | — | — |
| scratching_post | SCRATCHING POST | add | +6 per CELL | — | — |
| yarn | YARN BALL | mul | ×2 L shaped cats | — | — |
| kitten_toy | KITTEN TOY | mul | ×2 DUO shaped cats | — | — |
| cat_stretch | CAT STRETCH | mul | ×2 T-shaped cats | — | — |
| corner_napper | CORNER NAPPER | mul | x3 cats on CORNER | — | — |
| window_perch | WINDOW PERCH | add | +50 to cats on EDGES | — | — |
| rainbow_bowl | RAINBOW BOWL | add | +25 per UNIQUE cat type | — | — |
| sardine_tin | SARDINE TIN | x | destroy one random surrounding cat from deck | — | — |
| wild_dice | WILD DICE | mul | x3 one random cat | — | — |
| laser | LASER POINTER | x | copies ability of one other random treat | — | — |
| jumping_ball | JUMPING BALL | x | disable one random treat's requirement | — | — |
| brownies | BROWNIES | x | add duplicate of one random surrounding cat to deck | — | — |
| treat_pile | TREAT PILE | add | +20 per TREAT | — | — |
| lucky_paw | LUCKY PAW | x | ×4 one random cat ×½ others | — | — |
| nap | POWER NAP | mul | ×2 ALL cats | — | NO OTHER TREAT |
| cathouse | CATHOUSE | add | +10 to SURROUNDING cats | +10 per play | — |
| frenzy | FRENZY BALL | mul | ×3 SURROUNDING cats | — | ALL SAME TYPE |
| catnado | CATNADO | mul | ×1.5 ALL cats | +0.1 per play | — |
| tuna_can | TUNA CAN | mul | ×2 all ORANGE cats | — | — |
| shadow_feast | SHADOW FEAST | mul | ×2 all BLACK cats | — | — |
| mirror | MIRROR | x | apply all ADD treats again | — | — |
| all_or_nothing | ALL OR NOTHING | mul | ×5 ALL cats | — | BOARD FULL |
| cat_phone | CAT PHONE | x | overwrite self with random backpack treat ability | — | — |
| cat_nap_stack | CAT NAP STACK | mul | ×1.5 per TREAT on board | — | — |
| siamese_twins | SIAMESE TWINS | x | change one random cat type to match adjacent cat | — | — |
| personal_space | PERSONAL SPACE | add | +15 per EMPTY cell | — | — |

## Configuration Data Source

Live data is fetched from published Google Sheets CSV endpoints defined in `SHEET_URLS` in `js/config.js`. Tabs: General, Rounds, Treats, Cats, Shapes, Decks, Rarity, Branches.

## Sheet Snapshots & Change Detection Workflow

Snapshots of all sheets are saved locally in `sheets/` (one CSV per tab):

```
sheets/General.csv
sheets/Rounds.csv
sheets/Treats.csv
sheets/Cats.csv
sheets/Shapes.csv
sheets/Decks.csv
sheets/Rarity.csv
sheets/Branches.csv
```

**When the user says they added or changed a treat (or any sheet data):**

1. Re-fetch all sheets via the `SHEET_URLS` in `js/config.js` (follow the 307 redirects).
2. Diff the new CSV against the saved snapshot to identify exactly what changed.
3. Implement the required code changes (new treat file, updated registry entry, etc.).
4. Overwrite the snapshot files with the new CSV content so they stay current.
5. Commit and push.

This keeps `sheets/` as the source of truth for "last known sheet state" so diffs are always accurate.
