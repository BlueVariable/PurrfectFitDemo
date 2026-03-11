# Treat Registry Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move each treat's effect function and requirement logic into its own file using a registry pattern, so custom treats are self-contained and adding a new treat means adding one file.

**Architecture:** A global `TREAT_REGISTRY` object maps treat IDs to `{ buildFn(ef, phase) }` factories. When `buildTreatFn` is called during config parsing, it checks the registry first and falls back to generic string parsing. Requirement string logic moves from `render.js` into `js/treats/requirements.js`.

**Tech Stack:** Vanilla JS, no build tools. All files loaded via `<script>` tags in `index.html`. Registry file must load before treat files.

---

## Chunk 1: Registry infrastructure

### Task 1: Create `js/treats/` directory and registry

**Files:**
- Create: `js/treats/registry.js`

- [ ] Create the directory `js/treats/`
- [ ] Create `js/treats/registry.js` with this exact content:

```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT REGISTRY
//  Maps treat IDs to { buildFn(ef, phase) } factories.
//  buildFn is called at config-parse time with the effect
//  string from the sheet, returning the runtime fn.
// ══════════════════════════════════════════════════════
const TREAT_REGISTRY = {};
```

- [ ] Commit: `git add js/treats/registry.js && git commit -m "feat: add TREAT_REGISTRY skeleton"`

---

### Task 2: Create `js/treats/requirements.js`

Move the requirement string logic out of `render.js:treatReqFails` into a dedicated file.

**Files:**
- Create: `js/treats/requirements.js`
- Modify: `js/render.js`

- [ ] Create `js/treats/requirements.js`:

```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT REQUIREMENTS
//  requirementFails(req) → true if the requirement is
//  NOT currently met (treat should show warning).
//  req is the string from the sheet's Requirement column.
// ══════════════════════════════════════════════════════
const REQUIREMENT_FNS = {
  'NO OTHER TREAT': () => G.treats.length > 1,
  'NEEDS ORANGE':   () => !G.cats.some(c => c.type === 'orange'),
  'ALL SAME TYPE':  () => {
    const types = [...new Set(G.cats.map(c => c.type))];
    return types.length > 1;
  },
};

function requirementFails(req) {
  if (!req) return false;
  const fn = REQUIREMENT_FNS[req];
  return fn ? fn() : false;
}
```

- [ ] In `js/render.js`, replace the `treatReqFails` function body so it delegates:

Old (lines 197–207):
```js
function treatReqFails(td){
  // Check if this treat's requirement is not met given current board state
  if(!td.req)return false;
  if(td.req==='NO OTHER TREAT') return G.treats.length>1;
  if(td.req==='NEEDS ORANGE') return !G.cats.some(c=>c.type==='orange');
  if(td.req==='ALL SAME TYPE'){
    const types=[...new Set(G.cats.map(c=>c.type))];
    return types.length>1;
  }
  return false;
}
```

New:
```js
function treatReqFails(td){
  return requirementFails(td.req);
}
```

- [ ] Commit: `git add js/treats/requirements.js js/render.js && git commit -m "feat: extract requirement logic to treats/requirements.js"`

---

## Chunk 2: Named treat files

### Task 3: Create `js/treats/tuna.js`

Tuna multiplies all orange cats by the `×N` value in its effect string.

**Files:**
- Create: `js/treats/tuna.js`

- [ ] Create `js/treats/tuna.js`:

```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: tuna
//  Multiplies all orange cat groups by ×N
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['tuna'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const gids = Object.keys(cs).filter(gid => {
        const grp = cats.find(c => c.gid === gid);
        return grp && grp.type === 'orange';
      });
      return { gids, m };
    };
  },
};
```

- [ ] Commit: `git add js/treats/tuna.js && git commit -m "feat: add tuna treat file"`

---

### Task 4: Create `js/treats/nap.js`

Nap multiplies ALL cats, but only if there is at most 1 treat on the board (itself).

**Files:**
- Create: `js/treats/nap.js`

- [ ] Create `js/treats/nap.js`:

```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: nap
//  Multiplies all cats by ×N, only if ≤1 treat on board
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['nap'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => ts.length <= 1 ? allMulCS(cats, cs, m) : { gids: [], m: 1 };
  },
};
```

- [ ] Commit: `git add js/treats/nap.js && git commit -m "feat: add nap treat file"`

---

### Task 5: Create `js/treats/frenzy.js`

Frenzy multiplies surrounding cats by ×N, but only if ALL cats on the board are the same type.

**Files:**
- Create: `js/treats/frenzy.js`

- [ ] Create `js/treats/frenzy.js`:

```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: frenzy
//  Multiplies surrounding cats by ×N only if all cats
//  on the board are the same type
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['frenzy'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      if ([...new Set(cats.map(c => c.type))].length > 1) return { gids: [], m: 1 };
      return surrMulCS(b, cats, p, m, cs);
    };
  },
};
```

- [ ] Commit: `git add js/treats/frenzy.js && git commit -m "feat: add frenzy treat file"`

---

## Chunk 3: Wire up registry in buildTreatFn and load scripts

### Task 6: Update `buildTreatFn` to check registry first

**Files:**
- Modify: `js/config.js`

- [ ] In `js/config.js`, replace `buildTreatFn` so it checks `TREAT_REGISTRY[id]` before the existing logic:

Old (`buildTreatFn` starting at line 40):
```js
function buildTreatFn(id, ef, phase){
  // add-phase fns
  if(phase==='add'){
    if(ef.includes('ALL'))      return (b,cats)=>allAdd(cats, extractNum(ef));
    if(ef.includes('ROW'))      return (b,c,t,p)=>rowAdd(b,p, extractNum(ef));
    if(ef.includes('COL'))      return (b,c,t,p)=>colAdd(b,p, extractNum(ef));
    if(ef.includes('SURR'))     return (b,c,t,p)=>surrAdd(b,p, extractNum(ef));
    return (b,cats)=>allAdd(cats, extractNum(ef));
  }
  // mul-phase fns
  const m = extractMul(ef);
  if(id==='tuna')   return (b,cats,ts,p,cs)=>{const gids=Object.keys(cs).filter(gid=>{const grp=cats.find(c=>c.gid===gid);return grp&&grp.type==='orange';});return{gids,m};};
  if(id==='nap')    return (b,cats,ts,p,cs)=>ts.length<=1?allMulCS(cats,cs,m):{gids:[],m:1};
  if(id==='frenzy') return (b,cats,ts,p,cs)=>{if([...new Set(cats.map(c=>c.type))].length>1)return{gids:[],m:1};return surrMulCS(b,cats,p,m,cs);};
  if(ef.includes('COL')) return (b,cats,t,p,cs)=>colMul(b,cats,p,m);
  if(ef.includes('/')){
    // parse shape list from effect like "×2 L/J/T/curl/chonk cats"
    const shapeMatch=ef.match(/([A-Za-z][A-Za-z0-9]*(?:\/[A-Za-z][A-Za-z0-9]*)+)/);
    const shapes=shapeMatch?shapeMatch[1].split('/'):['L','J','T','curl','chonk'];
    return (b,cats)=>shapeMul(cats,shapes,m);
  }
  return (b,cats,ts,p,cs)=>allMulCS(cats,cs,m);
}
```

New:
```js
function buildTreatFn(id, ef, phase){
  // Registry-first: named treats define their own factory
  if(TREAT_REGISTRY[id]) return TREAT_REGISTRY[id].buildFn(ef, phase);

  // add-phase fns
  if(phase==='add'){
    if(ef.includes('ALL'))      return (b,cats)=>allAdd(cats, extractNum(ef));
    if(ef.includes('ROW'))      return (b,c,t,p)=>rowAdd(b,p, extractNum(ef));
    if(ef.includes('COL'))      return (b,c,t,p)=>colAdd(b,p, extractNum(ef));
    if(ef.includes('SURR'))     return (b,c,t,p)=>surrAdd(b,p, extractNum(ef));
    return (b,cats)=>allAdd(cats, extractNum(ef));
  }
  // mul-phase fns
  const m = extractMul(ef);
  if(ef.includes('COL')) return (b,cats,t,p,cs)=>colMul(b,cats,p,m);
  if(ef.includes('/')){
    // parse shape list from effect like "×2 L/J/T/curl/chonk cats"
    const shapeMatch=ef.match(/([A-Za-z][A-Za-z0-9]*(?:\/[A-Za-z][A-Za-z0-9]*)+)/);
    const shapes=shapeMatch?shapeMatch[1].split('/'):['L','J','T','curl','chonk'];
    return (b,cats)=>shapeMul(cats,shapes,m);
  }
  return (b,cats,ts,p,cs)=>allMulCS(cats,cs,m);
}
```

- [ ] Commit: `git add js/config.js && git commit -m "feat: buildTreatFn checks TREAT_REGISTRY first"`

---

### Task 7: Add new `<script>` tags to `index.html`

**Files:**
- Modify: `index.html`

Scripts must load in this order:
1. `treat-effects.js` (helpers used by treat files) — already present
2. `js/treats/registry.js` — defines `TREAT_REGISTRY`
3. `js/treats/requirements.js` — defines `requirementFails`
4. `js/treats/tuna.js`, `nap.js`, `frenzy.js` — register into `TREAT_REGISTRY`
5. `config.js` — calls `buildTreatFn` which reads `TREAT_REGISTRY`
6. Remaining files — already in correct order

- [ ] In `index.html`, replace the current script block:

Old:
```html
<script src="js/utils.js"></script>
<script src="js/treat-effects.js"></script>
<script src="js/config.js"></script>
```

New:
```html
<script src="js/utils.js"></script>
<script src="js/treat-effects.js"></script>
<script src="js/treats/registry.js"></script>
<script src="js/treats/requirements.js"></script>
<script src="js/treats/tuna.js"></script>
<script src="js/treats/nap.js"></script>
<script src="js/treats/frenzy.js"></script>
<script src="js/config.js"></script>
```

- [ ] Open `index.html` in a browser and verify the game loads, tuna/nap/frenzy treats work, and requirement warnings show correctly.
- [ ] Commit: `git add index.html && git commit -m "feat: load treat registry and per-treat files in index.html"`
- [ ] Push: `git push`
