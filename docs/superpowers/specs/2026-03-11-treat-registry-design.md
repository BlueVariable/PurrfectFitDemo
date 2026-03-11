# Treat Registry Design

## Goal
Move each treat's effect function and requirement logic into its own file, making custom treats self-contained and easy to add without modifying shared files.

## Architecture

### Current State
- `config.js` — `buildTreatFn(id, ef, phase)` hardcodes custom logic for `tuna`, `nap`, `frenzy` by ID
- `treat-effects.js` — generic helpers: surrAdd, rowAdd, colAdd, allAdd, allMulCS, colMul, surrMulCS, shapeMul
- `render.js` — `treatReqFails(td)` checks requirement strings: `NO OTHER TREAT`, `NEEDS ORANGE`, `ALL SAME TYPE`

### Target State
```
js/
  treats/
    registry.js        — defines TREAT_REGISTRY = {}
    requirements.js    — requirementFails(req) replacing inline string logic in render.js
    tuna.js            — TREAT_REGISTRY['tuna'] = { buildFn(ef, phase) }
    nap.js             — TREAT_REGISTRY['nap']  = { buildFn(ef, phase) }
    frenzy.js          — TREAT_REGISTRY['frenzy'] = { buildFn(ef, phase) }
  treat-effects.js     — unchanged generic helpers
  config.js            — buildTreatFn checks TREAT_REGISTRY[id].buildFn first
  render.js            — treatReqFails delegates to requirementFails() from requirements.js
  index.html           — add <script> tags for new files
```

### Key Interface
`TREAT_REGISTRY[id].buildFn(ef, phase)` — factory called at config-parse time, receives the effect string from the sheet so multiplier values still flow from config. Returns a function `(b, cats, ts, cells, catScores) => result`.

## Decisions
- Registry pattern: fallback for unregistered treats uses existing string-parsing in buildTreatFn unchanged
- Requirements as a map: `REQUIREMENT_FNS['NO OTHER TREAT'] = (G) => G.treats.length > 1` in requirements.js
- No build step: all files loaded via `<script>` tags in index.html, registry.js loaded first
