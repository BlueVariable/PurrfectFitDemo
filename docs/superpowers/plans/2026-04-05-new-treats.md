# New Treats (7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill in sheet data and implement JS logic for 7 new treats in rows 1–5 and 17–18 of the Treats tab.

**Architecture:** Each treat gets one JS file in `js/treats/<id>.js` registered in `TREAT_REGISTRY`. Sheet rows are written via MCP. New requirement added to `requirements.js`. Seven `<script>` tags added to `index.html`.

**Tech Stack:** Plain JS (no build step), Google Sheets MCP (`mcp__google-sheets__sheets_update_values`), spreadsheet ID `1qEr42p9HsQFPrBip1TqYB2DBehKPgyT_e0CwmNP_Cd4`

---

## Files

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `js/treats/requirements.js` | Add `NO SAME TYPE ADJACENT` requirement |
| Create | `js/treats/lone_kitty.js` | ×2 ALL cats, req: no same-type adjacent |
| Create | `js/treats/purebred.js` | ×2 ALL cats, req: all cats same type |
| Create | `js/treats/big_bite.js` | +100 to ALL cats, −1 per cat already scored |
| Create | `js/treats/second_breakfast.js` | Retrigger all cats (base score), expires after 3 uses |
| Create | `js/treats/treat_encore.js` | Retrigger all add treats (mirror-style), expires after 3 uses |
| Create | `js/treats/loaded_dice.js` | Trigger Wild Dice again |
| Create | `js/treats/encore.js` | Retrigger one random non-x treat |
| Modify | `index.html` | Add 7 script tags after `tabby_pack.js` |
| Remote | Google Sheets Treats tab | Fill rows 2–6 and 18–19 with treat data |

---

## Task 1: Write sheet data for rows 2–6 (first 5 new treats)

**Files:**
- Remote: Google Sheets Treats tab, rows 2–6

Sheet column order (A–P): `Enabled, Status, Strategy, Phase, ID, Name, Emoji, Rarity, Shape ID, Effect, Additional Effects, Requirement, Buy Price, Description, Claude Notes, Proposition Decline Reason`

- [ ] **Step 1: Update rows 2–6 via MCP**

Call `mcp__google-sheets__sheets_update_values` with:
- spreadsheetId: `1qEr42p9HsQFPrBip1TqYB2DBehKPgyT_e0CwmNP_Cd4`
- range: `Treats!A2:P6`
- values:
```json
[
  ["TRUE","Approved","cat type","mul","lone_kitty","LONE KITTY","🐾","epic","L","×2 ALL cats","","NO SAME TYPE ADJACENT","7","outsider by choice","","−"],
  ["TRUE","Approved","cat type","mul","purebred","PUREBRED","🏅","epic","J","×2 ALL cats","","ALL SAME TYPE","7","pedigree pays off","","−"],
  ["TRUE","Approved","stacked","add","big_bite","BIG BITE","🍖","common","trio","+100 to ALL cats","-1 per cat already scored","","3","first bite hits hardest","","−"],
  ["TRUE","Approved","stacked","misc","second_breakfast","SECOND BREAKFAST","🍳","legendary","chonk","Retrigger all cats","Disappears after 3 uses","","12","one meal is never enough","","−"],
  ["TRUE","Approved","stacked","misc","treat_encore","TREAT ENCORE","🎭","legendary","chonk","Retrigger all treats","Disappears after 3 uses","","12","takes a bow, then does it again","","−"]
]
```

---

## Task 2: Write sheet data for rows 18–19 (last 2 new treats)

**Files:**
- Remote: Google Sheets Treats tab, rows 18–19

- [ ] **Step 1: Update rows 18–19 via MCP**

Call `mcp__google-sheets__sheets_update_values` with:
- spreadsheetId: `1qEr42p9HsQFPrBip1TqYB2DBehKPgyT_e0CwmNP_Cd4`
- range: `Treats!A18:P19`
- values:
```json
[
  ["TRUE","Approved","luck","misc","loaded_dice","LOADED DICE","🎰","legendary","uno","Trigger Wild Dice again","","","8","the house never loses","","−"],
  ["TRUE","Approved","luck","misc","encore","ENCORE","🎤","epic","chonk","Retrigger one random treat","","","7","they want more","","−"]
]
```

---

## Task 3: Add NO SAME TYPE ADJACENT requirement

**Files:**
- Modify: `js/treats/requirements.js`

- [ ] **Step 1: Add the requirement function**

In `js/treats/requirements.js`, add `'NO SAME TYPE ADJACENT'` to `REQUIREMENT_FNS` after `'NO OTHER TREAT'`:

```js
'NO SAME TYPE ADJACENT': () => {
  for (const cat of G.cats) {
    for (const other of G.cats) {
      if (cat.gid === other.gid || cat.type !== other.type) continue;
      const adj = cat.cells.some(([r, c]) =>
        other.cells.some(([r2, c2]) => Math.abs(r - r2) <= 1 && Math.abs(c - c2) <= 1)
      );
      if (adj) return true;
    }
  }
  return false;
},
```

Full updated file:
```js
'use strict';
const REQUIREMENT_FNS = {
  'NO OTHER TREAT': () => G.treats.length > 1,
  'NO SAME TYPE ADJACENT': () => {
    for (const cat of G.cats) {
      for (const other of G.cats) {
        if (cat.gid === other.gid || cat.type !== other.type) continue;
        const adj = cat.cells.some(([r, c]) =>
          other.cells.some(([r2, c2]) => Math.abs(r - r2) <= 1 && Math.abs(c - c2) <= 1)
        );
        if (adj) return true;
      }
    }
    return false;
  },
  'NEEDS ORANGE':   () => !G.cats.some(c => c.type === 'orange'),
  'ALL SAME TYPE':  () => {
    const types = [...new Set(G.cats.map(c => c.type))];
    return types.length > 1;
  },
  'BOARD FULL': () => G.board.flat().filter(c=>c.filled).length < G.bsr*G.bsc,
  'LAST HAND':            () => G.hands > 1,
  'NO DISCARDS REMAINING': () => G.disc > 0,
};

function requirementFails(req) {
  if (!req) return false;
  const fn = REQUIREMENT_FNS[req];
  return fn ? fn() : false;
}
```

---

## Task 4: Create lone_kitty.js

**Files:**
- Create: `js/treats/lone_kitty.js`

`buildFn` returns `allMulCS` for all cats. The `NO SAME TYPE ADJACENT` requirement is enforced centrally by `doFit()` — no check needed in the fn itself.

- [ ] **Step 1: Create the file**

```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: lone_kitty
//  ×2 ALL cats — req: no same-type cats are adjacent
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['lone_kitty'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => allMulCS(cats, cs, m);
  },
};
```

---

## Task 5: Create purebred.js

**Files:**
- Create: `js/treats/purebred.js`

- [ ] **Step 1: Create the file**

```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: purebred
//  ×2 ALL cats — req: all cats are the same type
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['purebred'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => allMulCS(cats, cs, m);
  },
};
```

---

## Task 6: Create big_bite.js

**Files:**
- Create: `js/treats/big_bite.js`

Fires at its scan position. Counts cats already scored (`G.cats.length − futureCats.length`) and returns a flat bonus of `max(0, 100 − alreadyScored)` to all remaining future cats. Early placement = higher bonus.

- [ ] **Step 1: Create the file**

```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: big_bite
//  +100 to ALL cats, −1 per cat already scored when treat fires
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['big_bite'] = {
  isDecreasing: true,
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const alreadyScored = G.cats.length - cats.length;
      const amt = Math.max(0, 100 - alreadyScored);
      if (!amt) return { bonusMap: {} };
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = amt; });
      return { bonusMap };
    };
  },
};
```

---

## Task 7: Create second_breakfast.js

**Files:**
- Create: `js/treats/second_breakfast.js`

Misc/x phase. Adds each future cat's base score (`cells.length × 10`) as a bonus. Tracks total plays in `G.treatPlayCounts.second_breakfast`. On the 3rd play, sets `tdef._expired = true` so `endScoreSequence` does not return the treat to the backpack.

Returns `{ type: 'x', subPhase: 'mirror', bonusMap, totalBonus }` so `getAddBonusForCat` applies the bonusMap to future cats.

- [ ] **Step 1: Create the file**

```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: second_breakfast
//  Retrigger all cats (add base score for future cats).
//  Disappears after 3 uses.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['second_breakfast'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const selfTdef = ts.find(t => t.tdef.id === 'second_breakfast')?.tdef;
      const plays = (G.treatPlayCounts.second_breakfast || 0) + 1;
      G.treatPlayCounts.second_breakfast = plays;
      if (plays >= 3 && selfTdef) selfTdef._expired = true;
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = grp.cells.length * 10; });
      const totalBonus = Object.values(bonusMap).reduce((a, b) => a + b, 0);
      return { type: 'x', subPhase: 'mirror', bonusMap, totalBonus };
    };
  },
};
```

---

## Task 8: Create treat_encore.js

**Files:**
- Create: `js/treats/treat_encore.js`

Misc/x phase. Re-fires all add-phase treats for future cats (identical logic to `mirror.js`). Tracks plays in `G.treatPlayCounts.treat_encore` and sets `_expired` after 3 uses. Saves/restores `G.treatPlayCounts` so scaling treats (e.g. catnado) don't double-increment.

- [ ] **Step 1: Create the file**

```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: treat_encore
//  Retrigger all add-phase treats for remaining cats.
//  Disappears after 3 uses.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['treat_encore'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const selfTdef = ts.find(t => t.tdef.id === 'treat_encore')?.tdef;
      const plays = (G.treatPlayCounts.treat_encore || 0) + 1;
      G.treatPlayCounts.treat_encore = plays;
      if (plays >= 3 && selfTdef) selfTdef._expired = true;
      const addTreats = ts.filter(t => t.tdef.id !== 'treat_encore' && t.tdef.phase === 'add');
      if (!addTreats.length) return { type: 'x', skip: true };
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = 0; });
      const savedPlayCounts = Object.assign({}, G.treatPlayCounts);
      addTreats.forEach(at => {
        const res = at.tdef.fn(b, cats, ts, at.cells, cs);
        if (!res) return;
        if (res.bonusMap) {
          Object.entries(res.bonusMap).forEach(([gid, amt]) => {
            if (bonusMap[gid] !== undefined) bonusMap[gid] += amt;
          });
        } else if (res.bonus) {
          const ef2 = at.tdef.ef;
          const amt2 = extractNum(ef2);
          const [tRow, tCol] = at.cells[0];
          cats.forEach(grp => {
            let hit = false;
            if (ef2.includes('ALL')) hit = true;
            else if (ef2.includes('ROW')) hit = grp.cells.some(([r]) => r === tRow);
            else if (ef2.includes('COL')) hit = grp.cells.some(([,c]) => c === tCol);
            else if (ef2.includes('SURR') || ef2.includes('surrounding'))
              hit = at.cells.some(([tr,tc]) => grp.cells.some(([r,c]) => Math.abs(r-tr)<=1&&Math.abs(c-tc)<=1));
            else hit = true;
            if (hit && bonusMap[grp.gid] !== undefined) bonusMap[grp.gid] += amt2;
          });
        }
      });
      Object.assign(G.treatPlayCounts, savedPlayCounts);
      Object.entries(bonusMap).forEach(([gid, amt]) => {
        if (cs[gid] !== undefined) cs[gid] += amt;
      });
      const totalBonus = Object.values(bonusMap).reduce((a, b) => a + b, 0);
      return { type: 'x', subPhase: 'mirror', bonusMap, totalBonus };
    };
  },
};
```

---

## Task 9: Create loaded_dice.js

**Files:**
- Create: `js/treats/loaded_dice.js`

Misc/x phase. Finds Wild Dice in `ts` and calls its fn again — a second independent random pick. Returns `{ type: 'x', subPhase: 'mul', result, copiedFrom, laserCells }` so `getMulFactorForCat` applies the second ×5 to the chosen cat. Skips if Wild Dice isn't on the board.

- [ ] **Step 1: Create the file**

```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: loaded_dice
//  Trigger Wild Dice again (second independent roll)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['loaded_dice'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const wildDice = ts.find(t => t.tdef.id === 'wild_dice');
      if (!wildDice) return { type: 'x', skip: true };
      const result = wildDice.tdef.fn(b, cats, ts, p, cs);
      return { type: 'x', subPhase: 'mul', result, copiedFrom: wildDice.tdef, laserCells: p };
    };
  },
};
```

---

## Task 10: Create encore.js

**Files:**
- Create: `js/treats/encore.js`

Misc/x phase. Picks one random non-x treat from the board (excluding self) and fires its fn again. Returns the same result envelope as `laser.js` so scoring already handles add/mul subPhases. Filters out x-phase treats to prevent infinite loops.

- [ ] **Step 1: Create the file**

```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: encore
//  Retrigger one random non-x treat on the board
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['encore'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const pool = ts.filter(t => t.tdef.id !== 'encore' && t.tdef.phase !== 'x');
      if (!pool.length) return { type: 'x', skip: true };
      const target = pool[Math.floor(Math.random() * pool.length)];
      const result = target.tdef.fn(b, cats, ts, target.cells, cs);
      return { type: 'x', subPhase: target.tdef.phase, result, copiedFrom: target.tdef, laserCells: p };
    };
  },
};
```

---

## Task 11: Add 7 script tags to index.html

**Files:**
- Modify: `index.html` lines ~320–322 (after the `tabby_pack.js` script tag)

- [ ] **Step 1: Add script tags after tabby_pack.js**

Find the line `<script src="js/treats/tabby_pack.js"></script>` and insert immediately after it:

```html
<script src="js/treats/lone_kitty.js"></script>
<script src="js/treats/purebred.js"></script>
<script src="js/treats/big_bite.js"></script>
<script src="js/treats/second_breakfast.js"></script>
<script src="js/treats/treat_encore.js"></script>
<script src="js/treats/loaded_dice.js"></script>
<script src="js/treats/encore.js"></script>
```

---

## Task 12: Commit and push

- [ ] **Step 1: Stage all changes**

```bash
git add js/treats/requirements.js js/treats/lone_kitty.js js/treats/purebred.js js/treats/big_bite.js js/treats/second_breakfast.js js/treats/treat_encore.js js/treats/loaded_dice.js js/treats/encore.js index.html
```

- [ ] **Step 2: Commit**

```bash
git commit -m "Add 7 new treats: lone_kitty, purebred, big_bite, second_breakfast, treat_encore, loaded_dice, encore"
```

- [ ] **Step 3: Push**

```bash
git push
```

---

## Verification

After pushing, open `index.html` in a browser, click "↺ Reload Config", and verify:

1. **lone_kitty / purebred** — place treat + cats, check requirement warning shows when condition isn't met; confirm ×2 fires when condition is met
2. **big_bite** — place treat at start of board (top-left): all cats get +100. Place it after 5 cats are scored: remaining cats get +95
3. **second_breakfast** — play 3 times; on 3rd play the treat should not return to the backpack
4. **treat_encore** — place alongside milk (WARM MILK); encore should add another +10 per cat for remaining cats
5. **loaded_dice** — place alongside wild_dice; both should independently pick a random cat for ×5
6. **encore** — place alongside any treat; the random treat fires twice
