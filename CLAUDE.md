# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Asked to _play_ the game (not edit it)?** Read [`AGENT_PLAYBOOK.md`](AGENT_PLAYBOOK.md)
> first — it documents launching via a local server, the verified scoring
> formula, the per-round board reshaping ("Wildcat Chaos"), treat tactics, and a
> ready-to-run board-packing solver/applier driven through the game's own functions.

## Running the Application

No build step required. Open `index.html` directly in a modern browser. There are no npm packages, build tools, or dependencies.

Configuration is loaded at runtime from published Google Sheets CSV URLs (see `js/config.js` → `SHEET_URLS`). A "↺ Reload Config" button on the title screen re-fetches it.

For balance testing, `sim.html` (+ `js/sim/`) runs the real game headlessly in a hidden iframe across many seeded games with three scripted bot profiles (solver/greedy/casual) and reports clear rates, scoring, economy, and treat pick-rate stats. It must be served over HTTP like the game itself (not `file://`); see `docs/sim.md` for usage and how it drives the game.

## Architecture

The game is split across `index.html` (markup + inline styles) and multiple JS files under `js/`. Script load order in `index.html` matters: utils → treat-effects → registry → requirements → treat files → config → branches → state → board → backpack → held → devfit → render → scoring → projection → shop → cafe → calendar.

Global game state lives in `G` (see `js/state.js`). Held/dragged piece state lives in `H`.

## Gameplay Loop

`doFit()` triggers the score sequence → `runScoreSequence()` animates phases → `endScoreSequence()` checks win/loss → `roundWin()` or next hand dealt via `dealHand()`.

Between rounds the player lands on the **work-week calendar** (`s-calendar`, `js/calendar.js`) — the run laid out as 5 days × 3 rounds (2 regular + 1 boss "deadline" on rounds 3/6/9/12/15, per `General!modifier_rounds`), with past rounds stamped by hands-to-clear (`G.roundLog`; a `☕` stamp for a coffee-break'd round). It is the fork point: 🏪 **Go to Shop** (→ the shop/prep screen, then Play) or ☕ **Coffee Break** (skip, see `js/cafe.js`). `openCalendar()` delegates to `openRounds()` for all state setup, so `goShop()` / `selectBranch()` / `cafeFinish()` / `menuContinue()` route through it without changing the shop-pool generation or single per-round RNG draw the headless sim depends on.

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

### All treats

The Treats tab in the Google Sheet is the source of truth — do not maintain a list here.
To inspect the current set, fetch `SHEET_URLS.Treats` (or use the `mcp__google-sheets__sheets_get_values` tool against `Treats!A:P` — the treat list has outgrown any fixed row bound). Each enabled row needs a corresponding `js/treats/<id>.js` registry entry; treats without a file silently no-op via the warning in `buildTreatFn`.

## Sheet Workflow

The Google Sheet is the single source of truth for all configuration. There is no local CSV mirror — do not create a `sheets/` directory.

**Editing the sheet:** use the `mcp__google-sheets__sheets_*` tools (spreadsheet ID `1qEr42p9HsQFPrBip1TqYB2DBehKPgyT_e0CwmNP_Cd4`). Reading via `sheets_get_values` and writing via `sheets_update_values` is the standard path. The runtime fetches the published-to-web CSV and falls back to in-memory cache; it does not consult any local files.

**When the user changes a treat or other sheet data:**

1. (Optional) Read the relevant range with `sheets_get_values` to confirm the current state.
2. Implement the required code change (new treat file in `js/treats/<id>.js`, registry entry, script tag in `index.html`).
3. Commit and push.

If a sheet edit is required as part of the implementation (e.g. flipping `Status` to `Approved`), do it via the MCP tool — never via a local CSV.

**ToBeImplemented treats with empty fields:** When implementing treats marked `ToBeImplemented` that have empty fields (missing ID, name, emoji, phase, shape, price, or description), always design and fill in the missing fields directly — do not ask the user. Use the `design-purrfect-treats` skill for guidance, then update the sheet row via MCP with the complete data before implementing.
