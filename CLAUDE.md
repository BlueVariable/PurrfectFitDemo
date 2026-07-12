# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Asked to _play_ the game (not edit it)?** Read [`AGENT_PLAYBOOK.md`](AGENT_PLAYBOOK.md)
> first — it covers launching over a local server, the current scoring formula,
> the ready-made `agent/pf-harness.js` solver/driver, and the traps.

## The design principle (do not undo this)

**Treats and packing strategy are the real heroes. The purrfect-fit bonus must be
meaningful in every round — a real prize you always chase — but it must never be
able to carry a round on its own.**

The invariant the design owner enforces: **four purrfect fills must never cover a
round's target.** The Rounds sheet has a helper column `Target ÷ PerfectFit (k)`
= `target ÷ (hands_per_round × one purrfect fill)`; the rule is **k ≳ 1.15 on
every round** (live floor: 1.14 on R7). If you change board sizes, the fill
formula, `fill_bonus_base`, hands-per-round, or targets, **re-check that column**
and report the new k values before shipping.

## Running the Application

No build step. Open `index.html` in a modern browser — no npm packages, no bundler.

Config is fetched at runtime from published Google Sheets CSVs (`js/config.js` →
`SHEET_URLS`). The title screen has a "↺ Reload Config" button.

`sim.html` (+ `js/sim/`) batch-runs the real game headlessly in a hidden iframe
across seeded games with three scripted bot profiles (solver/greedy/casual) and
reports clear rates, scoring, economy and treat pick rates. It must be served over
HTTP (not `file://`); see `docs/sim.md`.

## Architecture

`index.html` (markup + inline styles) + JS under `js/`. Script load order in
`index.html` matters: utils → treat-effects → registry → requirements → treat files
→ config → catart → branches → state → treat-loss → board → backpack → held →
devfit → render → scoring → projection → shop → cafe → calendar.

Global game state lives in `G` (`js/state.js`). Held/dragged piece state lives in `H`.

## Gameplay Loop

`doFit()` → `runScoreSequence()` animates phases → `endScoreSequence()` checks
win/loss → `roundWin()` or next hand via `dealHand()`.

Between rounds the player lands on the **work-week calendar** (`s-calendar`,
`js/calendar.js`) — the run as 5 days × 3 rounds (2 regular + 1 boss "deadline" on
rounds 3/6/9/12/15, per `General!modifier_rounds`), past rounds stamped by
hands-to-clear (`G.roundLog`; `☕` for a coffee-break'd round). It is the fork point:
🏪 **Go to Shop** (→ shop/prep screen, then Play) or ☕ **Coffee Break** (skip, see
`js/cafe.js`). `openCalendar()` delegates to `openRounds()` for all state setup, so
`goShop()` / `selectBranch()` / `cafeFinish()` / `menuContinue()` route through it
without changing shop-pool generation or the single per-round RNG draw the headless
sim depends on.

## Scoring

Pieces (cats + treats) are processed in scan order (top-left → bottom-right; the
`mirror_mood` modifier reverses it via `scanCompare`). A running total accumulates
as cats fire. Treats are:

- **Type A** (affect individual cat scores): buffered in `treatBuffer`, applied when
  each cat fires. Return `{ bonus }` / `{ bonusMap }` (add) or `{ gids, m }` (mul).
- **Type B** (affect the overall score): applied directly to `runningTotal` at their
  scan position. Return `{ scoreBonus: N }` (add) or `{ scoreMultiplier: true, m: N }` (mul).

### Purrfect (board-fill) bonus — day-scaled

Filling every playable cell pays `playableCells × perCell`, where **`perCell` scales
with the work-week DAY**:

```
day     = ceil(round / CAL_ROUNDS_PER_DAY)      // rounds 1-3 = day 1 … 13-15 = day 5
perCell = CFG.fill_bonus_base × day             // base 5 → MON 5, TUE 10, WED 15, THU 20, FRI 25
```

Helpers: `purrfectDay(round)` / `purrfectPerCell(round)` in `js/scoring.js`. Fallback
chain: `fill_bonus_base` finite → `base × day`; else the LEGACY flat
`CFG.board_fill_bonus`; else 10. There is **no** `fill_bonus_per_round` key — it does
not exist in the sheet, don't reintroduce it.

The bonus is **added at the very end and is never multiplied by treat multipliers**
(only the `fill_bonus_mult` boss modifier scales it, via `boardFillBonus()`). That
anti-runaway property is deliberate: it is what stops a fill-only build from
snowballing. Do not "fix" it by folding the bonus into `runningTotal`.

`js/projection.js` calls the same `purrfectPerCell` helper, so `projectScore(null).total`
stays exactly equal to the next `doFit()` total. Any change to the formula must be made
in the shared helper, not duplicated.

Player-visible: prep-screen chip `#rds-purrfect` ("✨ DAY N · PURRFECT +N/cell"),
in-game chip `#g-purrfect-rate`, and the FIT projection chip's tooltip (all in
`js/render.js`).

## Treat System

### Treat lifecycle (per round)

A treat in the inventory (`G.bp` / `G.bpGroups`) can be placed on the board for a fit.
After scoring, every treat that was on the board moves to `G.usedTreats` and is
**removed from the inventory for the rest of the round** — it cannot be placed again
this round. At round end (`goShop` in `js/scoring.js`) all non-`_expired` used treats
are restored via `bpRestoreUsedTreats()`. Net effect: **each treat triggers at most
once per round** (≤15 triggers over a run, not once per hand), which bounds scaling
treats.

Two variations, both verified in `doFit()`:

- **REAPPEAR** (treats whose Additional Effects text contains "REAPPEAR"): a 1-in-2
  flip per placed instance. On success the treat goes **straight back into the
  inventory** (via `bpPlaceHomeOrAuto`) and can be played again in the same round.
  **A failed flip does NOT destroy it** — it just takes the normal `usedTreats` path
  and is restored at round end. The only thing forfeited is mid-round reuse.
- **Self-expiry**: treats that set `tdef._expired` are filtered out of the round-end
  restore and are gone for good. The real list (grep `_expired` in `js/treats/`):
  **`final_feast`, `hiss_and_miss`, `second_breakfast`, `treat_encore`** — plus
  `soft_landing`, which burns itself in `endScoreSequence()` to convert a fail into a win.

The only other permanent loss is **`catnado`**, which removes a random inventory treat
outright.

### Treat files

Every treat in the sheet has a file at `js/treats/<id>.js` registering into `TREAT_REGISTRY`:

```js
TREAT_REGISTRY['id'] = {
  buildFn(ef, phase) {
    // return a function (b, cats, ts, p, cs) => result
  }
};
```

`buildTreatFn(id, ef, phase, addEf)` in `config.js` checks the registry first and falls
back to generic pattern matching only for treats without an entry (with a console warning).

| Type | When | Return shape |
|------|------|-------------|
| Add Type A | effect targets specific cats ("to ALL cats", "in same ROW"…) | `{ bonus, desc }` or `{ bonusMap: {gid: N} }` |
| Add Type B | effect adds to the overall score (just "+N") | `{ scoreBonus: N }` |
| Mul Type A | effect targets specific cat types/shapes ("×N all ORANGE cats") | `{ gids: [...], m: N }` |
| Mul Type B | effect multiplies the accumulated score ("×N", no cat type) | `{ scoreMultiplier: true, m: N }` |
| x / misc | special effects | custom (see individual treat files) |

The Treats tab in the Google Sheet is the source of truth for the treat list — do not
maintain one here. Inspect it with `mcp__google-sheets__sheets_get_values` against
`Treats!A:P`.

## Backpack (player-managed — never reshuffle, never destroy)

The backpack arrangement belongs to the player: treats can be picked up, **rotated**
(R key / right-click, same idiom as held pieces) and re-placed, on both the game and
shop screens. Every `bpGroups` entry remembers its pose (`or`, `oc`, `shape`, `rot`),
and that pose travels with the treat — `H.bpOrigin` across a drag, `tInst.bpHome`
across a board trip, `G.bpHomes` across the `usedTreats` round-trip.

Every return path funnels through **`bpReturnTreat(tdef, home)`** (`js/backpack.js`):

```
exact remembered pose → rotation-aware auto-fit (bpAutoPlaceRot) → G.bpPending overflow queue
```

A treat that fits nowhere is **parked in `G.bpPending` (still owned), never destroyed**,
logged as a `no-room` loss event, shown as a dimmed "no room — make space" row in the
shop inventory, and re-seated automatically by `bpRetryPending()` whenever space frees
(sell, rearrange drop, round end). `clearBoard()`, `dealHand()`, `dropHeld()`, failed
drops, and the round-end restore all use this path.

**`bpRepackAll()` still destroys treats that don't re-fit and has ZERO game callers** —
it is a debug utility only. Never wire it back into a game path (buy fallback, restore,
width change…). `bpAutoPlace()` (rotation-less, greedy) is likewise not a safe return
path; callers must handle its `false`.

`bpReconcileWidth()` handles `bottomless_tote` growing/shrinking the bag: it relocates
only the occupants of a doomed column, and if they don't fit it keeps the bag wide
(`G._bpGraceC`) and retries later — a width change must never reshuffle the player's
arrangement or lose a treat.

## Treat loss ceremony (`js/treat-loss.js`)

Recording is decentralized and **pure state**: every path that takes a treat out of the
player's possession pushes onto `G.treatLossEvents` (`bpSendToPending`, `goShop`'s
`_expired` filter, `endScoreSequence`'s `soft_landing` burn, `js/treats/catnado.js`).
Display is `treatLossFlush()`, called at flush points (end of `doFit`'s scan, `goShop`,
`bpSendToPending`); it drains the queue and pops one toast per event, no-ops under the
headless sim (`SIM_BRIDGE`) and in DOM-less contexts.

If you add a new way to lose a treat, push an event (`reason`: `destroyed` / `expired` /
`no-room`) — and make sure `projectScore()` keeps truncating `G.treatLossEvents` back to
its entry length so hover previews can't emit phantom toasts.

## Sheet Workflow

The Google Sheet is the single source of truth for all configuration. There is no local
CSV mirror — do not create a `sheets/` directory.

**Editing the sheet:** use the `mcp__google-sheets__sheets_*` tools (spreadsheet ID
`1qEr42p9HsQFPrBip1TqYB2DBehKPgyT_e0CwmNP_Cd4`). Read via `sheets_get_values`, write via
`sheets_update_values`. The runtime fetches the published-to-web CSV (which lags a few
minutes behind an edit) and falls back to an in-memory cache; it never reads local files.

**When the user changes a treat or other sheet data:**

1. (Optional) Read the relevant range with `sheets_get_values` to confirm current state.
2. Implement the code change (new treat file in `js/treats/<id>.js`, registry entry,
   script tag in `index.html`).
3. Commit and push.

If a sheet edit is part of the implementation (e.g. flipping `Status` to `Approved`), do it
via the MCP tool — never via a local CSV.

**ToBeImplemented treats with empty fields:** design and fill in the missing fields
yourself (ID, name, emoji, phase, shape, price, description) — do not ask the user. Use the
`design-purrfect-treats` skill for guidance, then update the sheet row via MCP with the
complete data before implementing.
