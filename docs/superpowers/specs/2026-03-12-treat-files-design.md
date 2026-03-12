# Treat Files Design

**Date:** 2026-03-12
**Status:** Approved

## Goal

Each treat in the Google Sheet has its own JS file in `js/treats/<id>.js`, registering into `TREAT_REGISTRY`. The generic fallback branches in `buildTreatFn` are removed. X-phase treats are fully implemented with scoring pipeline support.

## Treat Inventory

| ID | File | Phase | Effect |
|----|------|-------|--------|
| milk | `js/treats/milk.js` | add | +8 to ALL cats |
| catnip | `js/treats/catnip.js` | add | +25 to cats in same ROW |
| feather | `js/treats/feather.js` | add | +25 to cats in same COL |
| box | `js/treats/box.js` | add | +25 to SURROUNDING cats |
| sardine_tin | — | — | skipped for now |
| yarn | `js/treats/yarn.js` | mul | ×2 L shaped cats |
| laser | `js/treats/laser.js` | x | copies ability of one random other treat using laser's board position |
| jumping_ball | `js/treats/jumping_ball.js` | x | disables one random treat's requirement for the current hand |
| brownies | `js/treats/brownies.js` | x | adds a duplicate of one random surrounding cat to G.deck |
| nap | `js/treats/nap.js` | mul | ×2 ALL cats (NO OTHER TREAT req) — already exists, no change |
| frenzy | `js/treats/frenzy.js` | mul | ×3 SURROUNDING cats (ALL SAME TYPE req) — already exists, no change |
| catnado | `js/treats/catnado.js` | mul | ×2 ALL cats (ALL SAME TYPE req) |
| tuna_can | `js/treats/tuna_can.js` | mul | ×2 all ORANGE cats — rename from tuna.js, update registry key |

## File Changes

### New/updated treat files

**Simple treats** — each calls the existing helper from `treat-effects.js`:

```
milk.js      → buildFn returns (b, cats) => allAdd(cats, extractNum(ef))
catnip.js    → buildFn returns (b, c, ts, p) => rowAdd(b, p, extractNum(ef))
feather.js   → buildFn returns (b, c, ts, p) => colAdd(b, p, extractNum(ef))
box.js       → buildFn returns (b, c, ts, p) => surrAdd(b, p, extractNum(ef))
yarn.js      → buildFn returns (b, cats) => shapeMul(cats, ['L'], extractMul(ef))
catnado.js   → buildFn returns (b, cats, ts, p, cs) => allMulCS(cats, cs, extractMul(ef))
tuna_can.js  → rename tuna.js; update TREAT_REGISTRY key from 'tuna' to 'tuna_can'
              (sheet already uses ID 'tuna_can' — no sheet change needed)
```

**X-phase treats:**

`laser.js`:
- Candidate pool: treats where `tdef.id !== 'laser'` AND `tdef.phase !== 'x'` (x-phase treats are excluded to avoid unhandled result shapes)
- Picks one candidate at random
- Runs `target.tdef.fn(b, cats, ts, p, cs)` using laser's cells as `p`
- Returns `{ type: 'x', subPhase: target.tdef.phase, result, copiedFrom: target.tdef, laserCells: p }`
- If candidate pool is empty: returns `{ type: 'x', skip: true }`
- Note: if `jumping_ball` has already mutated a tdef's `req` earlier in the same sorted pass, laser will see that mutated state when building its candidate pool — this is acceptable; it is a natural consequence of top-to-bottom execution order.

`jumping_ball.js`:
- Picks a random treat from `ts` where `tdef.id !== 'jumping_ball'` and `tdef.req` is non-empty
- Sets `tdef._origReq = tdef.req`, then `tdef.req = ''`
- Returns `{ type: 'x', disabledTreat: tdef }`
- If no treats with requirements: returns `{ type: 'x', skip: true }`
- Restoration: at the start of `doFit`, iterate over ALL entries in `TDEFS` (the global array) and restore `_origReq` if set. Using `TDEFS` (not just `G.treats`) ensures restoration covers treats that are in the backpack and never replayed.

`brownies.js`:
- Finds all cat gids adjacent to any of brownies' cells using the same adjacency logic as `surrAdd` (reads from `b`, which is still populated at fn-call time inside `doFit`)
- Picks one gid at random from the adjacent set
- Finds the matching cat group in `cats`, then pushes its `id` into `G.deck`
- Returns `{ type: 'x', addedCatId, addedCatEm }`
- If no adjacent cats: returns `{ type: 'x', skip: true }`
- Depends on board not being cleared before treat fns run — this is guaranteed by `doFit`'s current ordering (fns run before board clear).

### `js/config.js` — `buildTreatFn`

Remove all generic fallback branches. Function becomes:

```js
function buildTreatFn(id, ef, phase) {
  if (TREAT_REGISTRY[id]) return TREAT_REGISTRY[id].buildFn(ef, phase);
  console.warn(`No registry entry for treat: ${id}`);
  return () => ({});
}
```

### `js/scoring.js` — changes

**At the top of `doFit`, before sorting:**
```js
// Restore any requirements disabled by jumping_ball in the previous hand
TDEFS.forEach(td => { if (td._origReq !== undefined) { td.req = td._origReq; delete td._origReq; } });
```

**Dispatch in `doFit`:**
```js
if (t.tdef.phase === 'add') applyAddResult(t, res, catScores);
else if (t.tdef.phase === 'mul') applyMulResult(t, res, catScores);
else if (t.tdef.phase === 'x') applyXResult(t, res, catScores);
```

**New `applyXResult(t, res, catScores)`:**
- If `!res || res.skip`: no-op
- If `res.subPhase === 'add'`: call `applyAddResult({ tdef: res.copiedFrom, cells: res.laserCells }, res.result, catScores)` — the synthetic treat object uses `copiedFrom` as the tdef (so `applyAddResult` reads the correct `ef` string) and laser's cells as position (so row/col targeting uses laser's board position)
- If `res.subPhase === 'mul'`: call `applyMulResult(t, res.result, catScores)`
- `jumping_ball` and `brownies` apply their effects as side effects inside their fn; `applyXResult` is a no-op for them

**`runScoreSequence` — `hasEffect` check:**
```js
const hasEffect =
  phase === 'add' ? (result && result.bonus > 0) :
  phase === 'x'   ? (result && !result.skip) :
  /* mul */         (result && result.gids && result.gids.length && result.m > 1);
```

**`runScoreSequence` — animation step for x-phase:**
Add an `else if (phase === 'x')` branch in the `run()` step:
- `laser`: highlight affected cats (re-derive from `res.result`) and log e.g. `"🔴 LASER POINTER → copied 🧶 YARN BALL"`
- `jumping_ball`: log e.g. `"⚽ JUMPING BALL → disabled req for 😴 POWER NAP"`
- `brownies`: log e.g. `"🍫 BROWNIES → added 🐱 [cat name] to deck"`

### `index.html` — script tags

`nap.js` and `frenzy.js` are already present in `index.html`. Replace the old `tuna.js` tag and add new treat tags. Final load order for treat files:

```html
<script src="js/treats/registry.js"></script>
<script src="js/treats/requirements.js"></script>
<script src="js/treats/milk.js"></script>
<script src="js/treats/catnip.js"></script>
<script src="js/treats/feather.js"></script>
<script src="js/treats/box.js"></script>
<script src="js/treats/yarn.js"></script>
<script src="js/treats/catnado.js"></script>
<script src="js/treats/tuna_can.js"></script>
<script src="js/treats/laser.js"></script>
<script src="js/treats/jumping_ball.js"></script>
<script src="js/treats/brownies.js"></script>
<script src="js/treats/nap.js"></script>
<script src="js/treats/frenzy.js"></script>
```

Remove `<script src="js/treats/tuna.js"></script>`.

## Constraints

- No build step; all files are plain JS loaded via `<script>` tags
- Load order must be: `treat-effects.js` → `registry.js` → `requirements.js` → all treat files → `config.js`
- Treat files must not reference `G` or other globals directly, except `brownies.js` which must push to `G.deck` as a necessary side effect (consistent with how `surrMulCS` and other helpers already close over `G`)
