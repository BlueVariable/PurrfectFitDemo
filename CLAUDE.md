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
| `js/scoring.js` | `doFit()`, `runScoreSequence()`, `endScoreSequence()` — scan-order scoring: pieces processed top-left→bottom-right; Type A treats buffer per-cat bonuses/multipliers; Type B treats apply directly to a running total; board fill bonus added at end |
| `js/branches.js` | World map progression, unlock logic, `renderBranches()`, `selectBranch()`, progress persistence via localStorage |
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
- **Continents** are derived from `BRANCHES` (loaded from Google Sheets, with local `sheets/` CSV fallback). Each continent has an emoji, name, and ordered list of branches
- **Branch cards** show status (✅ completed / 🔓 unlocked / 🔒 locked), city name, deck emoji+name (from `DECK_META`), modifier labels, description, and a Play/Replay/Locked button
- **Unlock logic** (`isBranchUnlocked`): first branch of first continent is always open; within a continent, previous branch must be completed; first branch of a new continent requires all branches of the previous continent completed
- **Progress** stored in localStorage key `pf-progress` as `{completed: [branchId, ...]}`
- **Modifiers** (`MOD_LABELS`): `hands-1` → "-1 Hand", `no-discard` → "No Discards", `bp-small` → "3×3 Backpack", `cash-2` → "-$2 Starting Cash". Multiple mods joined with " · "
- Selecting a branch calls `selectBranch(id)` → `newGameFromBranch(id)` → `openRounds()`
- Branch win overlay (`ov-branch-win`): shown on completing all rounds, with "Back to World Map" button

## Gameplay Loop

`doFit()` triggers the score sequence → `runScoreSequence()` animates phases → `endScoreSequence()` checks win/loss → `roundWin()` or next hand dealt via `dealHand()`.

Scoring processes all pieces in scan order (top-left → bottom-right). A running total (`runningTotal`) accumulates as cats are scored. Treats that fire mid-scan are either:
- **Type A** (affect individual cat scores): buffered in `treatBuffer`; applied when each cat fires. Return `{ bonus }` / `{ bonusMap }` (add) or `{ gids, m }` (mul).
- **Type B** (affect the overall score): applied directly to `runningTotal` at their scan position. Return `{ scoreBonus: N }` (add) or `{ scoreMultiplier: true, m: N }` (mul).

## Treat System

### Treat lifecycle (per round)

A treat in the player's inventory (`G.bp`) can be placed on the board for a given fit. After the player triggers the fit and scoring runs, every treat that was on the board is moved to `G.usedTreats` and **removed from the inventory for the rest of the round** — it cannot be placed in subsequent fits in the same round. At the end of the round (`roundWin` in `scoring.js`), all non-expired treats in `usedTreats` are restored to the inventory via `bpAutoPlace`. Net effect: **each treat triggers at most once per round**, regardless of how many hands/fits a round has. This bounds scaling treats (e.g. `piggy_bank` `+$4 per trigger` fires up to 15 times across a 15-round run, not 60). Treats that mark `_expired` (e.g. `lone_kitty`, `purebred`, `one_shot`, `second_breakfast`, `treat_encore`) are filtered out and not restored after their final use.

Every treat in the sheet has its own file at `js/treats/<id>.js`. Each file registers into `TREAT_REGISTRY`:

```js
TREAT_REGISTRY['id'] = {
  buildFn(ef, phase) {
    // return a function (b, cats, ts, p, cs) => result
  }
};
```

`buildTreatFn(id, ef, phase, addEf)` in `config.js` checks the registry first; falls back to generic pattern matching only for treats without a registry entry.

### Return shapes by treat type

| Type | When | Return shape |
|------|------|-------------|
| Add Type A | effect targets specific cats ("to ALL cats", "in same ROW", etc.) | `{ bonus, desc }` or `{ bonusMap: {gid: N} }` |
| Add Type B | effect adds to overall score (just "+N") | `{ scoreBonus: N }` |
| Mul Type A | effect targets specific cat types/shapes ("×N all ORANGE cats") | `{ gids: [...], m: N }` |
| Mul Type B | effect multiplies the accumulated score ("×N" with no cat type) | `{ scoreMultiplier: true, m: N }` |
| x-phase | special effects | custom (see individual treat files) |

**Type A** treats are buffered and applied per-cat when each cat fires. **Type B** treats apply directly to `runningTotal` at their scan position and are NOT buffered.

### Animations

| Type | Animation |
|------|-----------|
| Add Type A | Cyan pulse on each affected cat cell + cyan badge |
| Add Type B | Score counter glows cyan + floating +N badge |
| Mul Type A | Gold pulse on each matching cat cell + gold badge |
| Mul Type B | Old score number shrinks out → new number slams in gold |

### All treats (from Google Sheet)

| ID | Name | Phase | Type | Effect | Additional Effects | Requirement |
|----|------|-------|------|--------|--------------------|-------------|
| milk | WARM MILK | add | A | +10 to ALL cats | — | — |
| catnip | CATNIP | add | A | +30 to cats in same ROW | — | — |
| feather | FEATHER | add | A | +30 to cats in same COL | — | — |
| big_bite | BIG BITE | add | B | +100 to score | −1 per cat already scored | — |
| lone_kitty | LONE KITTY | mul | B | ×2 score | — | NO SAME TYPE ADJACENT |
| purebred | PUREBRED | mul | B | ×2 score | — | ALL SAME TYPE |
| brownies | BROWNIES | x | — | add duplicate of one random surrounding cat to deck | — | — |
| sardine_tin | SARDINE TIN | x | — | destroy one random surrounding cat from deck | — | — |
| laser | LASER POINTER | x | — | copies ability of one other random treat | — | — |
| jumping_ball | JUMPING BALL | x | — | disable one random treat's requirement | — | — |
| all_or_nothing | ALL OR NOTHING | mul | B | ×1.5 score | +0.1 per play | BOARD FULL |
| encore | ENCORE | x | — | retrigger one random treat | — | — |
| wild_dice | WILD DICE | mul | B | ×5 score | — | 1 in 6 trigger chance |
| loaded_dice | LOADED DICE | x | — | trigger Wild Dice again | — | — |
| second_breakfast | SECOND BREAKFAST | x | — | retrigger all cats | disappears after 3 uses | — |
| treat_encore | TREAT ENCORE | x | — | retrigger all treats | disappears after 3 uses | — |
| cotton_cloud | COTTON CLOUD | mul | A | ×2 all WHITE cats | — | — |
| tabby_pack | TABBY PACK | mul | A | ×2 all TABBY cats | — | — |
| tuna_can | TUNA CAN | mul | A | ×2 all ORANGE cats | — | — |
| shadow_feast | SHADOW FEAST | mul | A | ×2 all BLACK cats | — | — |
| catnado | CATNADO | mul | B | ×1 score | +0.1 per play | — |

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
