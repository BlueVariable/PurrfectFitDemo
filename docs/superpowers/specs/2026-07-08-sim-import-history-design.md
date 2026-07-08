# Simulator: Import JSON + Previous-runs history

**Date:** 2026-07-08
**Status:** Approved (design), ready to implement

## Goal

Add two capabilities to the balance simulator (`sim.html` + `js/sim/`):

1. **Import JSON** — load a previously-exported results JSON file from disk and render its dashboard.
2. **Previous runs list** — an in-app, clickable history of past runs. Click a record to
   re-view its dashboard; delete records you no longer want.

## Key insight

`simRenderDashboard(container, results, maxRound)` already renders entirely from a plain
`results` array (it even re-derives boss rounds from the data). So both features reduce to
"feed a saved `results` array back into the dashboard." No engine or dashboard rewrite is needed.

The export/save payload shape is already:

```
{ stamp: { exportedAt, configHash }, results: [ ...perGameResult ] }
```

## Design

### 1. "Currently displayed results" (`js/sim/main.js`)

Introduce one module-scoped variable, `displayedPayload`, that the dashboard and **Export JSON**
both read from. It is set by three paths:

- running a live batch,
- clicking a history row,
- importing a file.

Export exports whatever is currently displayed. A live batch also keeps updating the dashboard
incrementally as today; on completion its payload becomes `displayedPayload`.

### 2. IndexedDB history (`js/sim/store.js`)

- Add a second object store `runs` to the existing `pf-sim-store` DB. **Bump DB version 1 → 2**;
  the `onupgradeneeded` handler must create `runs` if missing while leaving the existing `kv`
  store (folder handle) intact. `runs` uses `keyPath: 'id'`, `autoIncrement: true`, plus an index
  on `savedAt`.
- Record shape: `{ id, savedAt (ISO string), summary, payload }`.
  - `payload` = the existing `{ stamp, results }` object.
  - `summary` = small precomputed blob so the list renders without re-aggregating every record:
    `{ branchId, profiles:[...], profileInitials, gamesPerProfile, baseSeed, configHash,
       maxRound, partial, totalGames, winRateByProfile:{profile:pct}, source:'batch'|'import' }`.
- New helpers (all promise-based, mirroring the existing `simIdb*` style):
  - `simHistoryAdd(payload, summary) -> id`
  - `simHistoryList() -> [{ id, savedAt, summary }]` (metadata only, newest first — does NOT
    return full `results`, to keep the list cheap).
  - `simHistoryGet(id) -> { id, savedAt, summary, payload }`
  - `simHistoryDelete(id)`
  - `simHistoryClear()`
- `savedAt` is stamped by the **caller** (`new Date().toISOString()` in main.js at save time),
  because `Date`/`Date.now` are only banned inside workflow scripts, not in the browser app.

### 3. `maxRound` for replay

Imported/historical data has no live game bridge to ask for the round count. Resolve `maxRound`
in this order:

1. `summary.maxRound` (stored going forward),
2. else derive `Math.max(round)` across all `results[].rounds[].round` (same technique the
   dashboard already uses for boss rounds),
3. else `0` (empty → dashboard shows its "no games" state).

A `simResolveMaxRound(payload, fallbackMaxRound)` helper centralizes this.

### 4. Import JSON (`js/sim/main.js` + hidden file input in `sim.html`)

- New **Import JSON** button in the existing button row; it triggers a hidden
  `<input type="file" accept="application/json,.json">`.
- On file select: read text, `JSON.parse`, then **validate** via `simValidatePayload(obj)`:
  accepts either the wrapped `{ results: [...] }` shape or a bare `[...]` array; each game must
  look like a result (`profile` string, `rounds` array). Normalizes a bare array into
  `{ stamp:{importedAt}, results }`.
- On success: set `displayedPayload`, render, and **add to history** with
  `summary.source = 'import'`. Status line confirms.
- On failure (not JSON, wrong shape, empty): status-line error, no crash, dashboard unchanged.

### 5. UI (`sim.html`)

- **Import JSON** button beside **Export JSON**.
- Hidden `<input type="file" id="inp-import">`.
- New **"Previous runs"** panel (`.sim-panel`) between the controls panel and `#sim-dashboard`:
  - A compact `.sim-table`, newest first: columns `When`, `Branch`, `Profiles`, `Games`, `Seed`,
    `Win rate`, and an action cell (Load / ✕ delete).
  - Row click (or a "Load" affordance) loads that record into the dashboard.
  - A **Clear all** button; disabled when empty.
  - Empty state: muted "No previous runs yet — run a batch or import a file."
  - A "Viewing: …" note shown when the dashboard is displaying a loaded/imported run rather than
    the most recent live batch.
- Reuse existing CSS classes; add minimal new rules only where needed (clickable row hover,
  small delete button).

### 6. Recording rules

- Record a completed batch to history **always** (independent of the folder-auto-save checkbox —
  history is the point of this feature). This is separate from and additional to the existing
  folder/download auto-save, which is unchanged.
- Partial/stopped batches with ≥1 result are recorded too (`summary.partial = true`).
- Store `maxRound` (from the live bridge's `getRCFG().length`) into the summary at record time.

## Files touched

- `sim.html` — Import button, hidden file input, Previous-runs panel markup, a few CSS rules.
- `js/sim/store.js` — DB v2 + `runs` store + `simHistory*` helpers + `simResolveMaxRound` +
  `simValidatePayload`/normalize.
- `js/sim/main.js` — `displayedPayload`, import handler, history record on batch complete,
  render + wire the Previous-runs panel, Export reads `displayedPayload`.
- `docs/sim.md` — short note documenting Import + Previous runs (optional but nice).

Dashboard (`js/sim/dashboard.js`) and engine are **unchanged**.

## Edge cases

- Empty history → muted empty state; Clear all disabled.
- IndexedDB unavailable/blocked → history helpers fail soft (log + return empty), Import and live
  runs still work; only persistence of history is lost.
- Malformed import → graceful status-line error.
- Deleting the record currently being viewed → dashboard stays as-is (no forced clear).
- Old exported files without `summary.maxRound` → maxRound derived from data.
- DB upgrade from an existing v1 (folder handle already stored) → `kv` preserved, `runs` added.

## Out of scope (YAGNI)

- Retention cap / auto-prune (manual delete + Clear all only).
- Reading/browsing the results folder as a source (chose IndexedDB history instead).
- Cross-device sync, comparing/diffing two runs, renaming records.

## Testing (manual, over HTTP)

Served via `python -m http.server` (never `file://`):

1. Run a small batch → appears in Previous runs; dashboard shows it.
2. Reload page → history persists (IndexedDB).
3. Click an older run → its dashboard renders; "Viewing:" note appears.
4. Export a run, then Import that file → round-trips to an identical dashboard; appears in history
   tagged as an import.
5. Import a garbage file → graceful error, no crash.
6. Delete a record and Clear all → list updates correctly.
7. Confirm existing folder auto-save + Export behavior is unchanged.
