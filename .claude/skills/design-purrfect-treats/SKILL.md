---
name: design-purrfect-treats
description: Use when designing new treats for PurrfectFitDemo — e.g. "design a treat", "new treat idea", "create a treat", "propose a treat", "add a treat to the game". Guides concept, mechanics, balance, sheet row output, and full implementation.
allowed-tools: [mcp__google-sheets__sheets_get_values, mcp__google-sheets__sheets_update_values]
---

# Design Purrfect Treats

## Overview

Structured process for designing new treats for PurrfectFitDemo. Produces a complete, balanced, uniquely-themed treat ready for the Google Sheet and code implementation.

## Process

### 1. Brainstorm Concept

Ask the user (or propose) a **theme** — the cat item or situation the treat is inspired by. Every treat should have a charming cat-world personality.

Identify the **strategy tag** — existing ones or invent new ones:
- `placement` — rewards where cats are placed (edges, corners, rows, cols, surrounding)
- `cat type` — rewards specific cat types (orange, black, white, grey, tabby)
- `cat shape` — rewards specific cat shapes (L, T, duo, chonk, etc.)
- `misc` — everything else (deck manipulation, treat synergies, wildcards)
- **New strategies welcome** — e.g. `timing` (per-round scaling), `count` (rewards quantity), `combo` (two conditions), `deck` (draw pile manipulation)

### 2. Design Mechanics

Choose **phase**: `add`, `mul`, or `x`

- `add` — flat bonus points to specific cats
- `mul` — multiply specific cats' scores (applied after all add phases)
- `x` — special one-off effects (deck manipulation, copying, transforming)

**Add phase power benchmarks:**
| Scope | Typical Value |
|-------|--------------|
| ALL cats | +8–10 |
| Row / Col / Surrounding | +25–35 |
| Edge / Corner cats | +40–60 |
| Per empty cell / per treat | +15–25 |
| Per unique cat type | +25–35 |

**Mul phase benchmarks:**
| Scope | Typical Multiplier |
|-------|-------------------|
| ALL cats (no req) | ×1.5–2 |
| ALL cats (hard req) | ×2–5 |
| Specific type/shape | ×2–3 |
| Single random cat | ×3–4 |
| Surrounding cats | ×2–3 |
| Scaling (per condition) | starts low, grows |

**x-phase effects** are free-form but must be clearly resolvable (no ambiguous targeting).

**Inventing new effect types is encouraged.** Don't be limited to existing patterns. Novel ideas:
- Count-based: "×2 per cat on board"
- Majority: "×2 if you have more of one type than any other"
- Streak: "×3 to cats in the longest connected group"
- Threshold: "+100 if 5+ cats placed this round"
- Negative space: "×2 ALL cats if board is less than half full"
- Underdog: "×4 to the cat with the lowest score"

**Declined mechanics — do not propose:**
- **Diagonal placement** — confusing for players; diagonal alignment is hard to read on the board
- **Center cell placement** — not challenging or fun enough; doesn't create meaningful decisions

New effect types require a new `js/treats/<id>.js` implementation — flag this in output.

### 3. Choose Requirement (Optional)

Requirements gate power — higher multipliers or broader effects need them.

**Existing requirements (in `js/treats/requirements.js`):**
- `NO OTHER TREAT` — treat must be alone on board
- `BOARD FULL` — all board cells filled
- `ALL SAME TYPE` — all cats on board are same type

**New requirements welcome** — e.g.:
- `NO DUPLICATES` — no two cats of the same type
- `5+ CATS` — at least 5 cats placed
- `ALL CORNERS FILLED` — all four corner cells occupied

Leave blank for most treats. New requirement strings need an entry in `js/treats/requirements.js` — flag this.

### 3b. Balance Check — Board Fill Bias

Players fill the board to maximize score. Keep this in mind:

- **Adjacency/clustering effects** are near-trivially satisfied on a full board — add a constraint to create real decisions.
- **Emptiness effects** (e.g. PERSONAL SPACE) are naturally gated by the fill incentive — genuine tension.
- **Zone effects** (edges, corners) remain meaningful on a full board since not all cats can occupy those zones.
- **Threshold effects** (e.g. "if board less than half full") invert the fill incentive — powerful counter-strategy.

### 4. Assign Rarity & Price

| Rarity | Buy Price | Power Level |
|--------|-----------|-------------|
| common | $2–3 | Simple flat bonus, no req |
| rare | $4–6 | Placement/shape bonus, moderate |
| epic | $7–8 | Strong, may have requirement |
| legendary | $10+ | Game-changing, often has req |

### 5. Pick Shape ID

Valid treat shapes: `uno`, `duo`, `trio`, `corner`, `straight`, `L`, `J`, `Z`, `S`, `T`, `chonk`, `cross`

> Note: `chonker` and `chonkest` are cat-only shapes — do not use for treats.

Match shape to theme and rarity — bigger shapes = rarer feels.

### 6. Name, Emoji, Tagline

- **Name**: ALL CAPS, 2–3 words, cat-world themed
- **Emoji**: single emoji that fits the item
- **Tagline**: lowercase, witty, ≤5 words, cat pun optional

### 7. Check Uniqueness

The goal is a **meaningfully different** effect. Same mechanic + different number = not unique enough.

**Existing add effects (avoid direct duplicates):**
ALL cats · same ROW · same COL · SURROUNDING · EDGES · per UNIQUE type · per EMPTY cell · per TREAT · per CELL

**Existing mul effects (avoid direct duplicates):**
L-shape · DUO-shape · T-shape · CHONK-shape · CORNERS · ALL (×2 no req) · ALL (×5 board full) · ALL (×1.5 scaling) · ORANGE cats · BLACK cats · WHITE cats · TABBY cats · SURROUNDING (req: all same type) · per TREAT count · ×4 one random ×½ others · ×3 one random · most common type · ×(unique type count) · ×(9 − treat count) · ×4 lowest-scoring cat

A new effect that introduces a new **axis** (connected group, majority, threshold, etc.) is always valid even if phase/scope overlaps.

### 8. Output Sheet Row

Actual column order for the Treats sheet:
```
Enabled | Status | Strategy | Phase | ID | Name | Emoji | Rarity | Shape ID | Effect | Additional Effects | Requirement | Buy Price
```

Example row:
```
TRUE, Proposed, cat shape, mul, chonk_champ, CHONK CHAMP, 🏆, epic, chonk, ×3 CHONK shaped cats, , , 8
```

**Field rules:**
- `Enabled`: always `TRUE` for new proposals
- `Status`: always `Proposed` for new designs
- `id`: snake_case, unique, descriptive
- `Effect`: use existing style OR invent new phrasing — be specific and unambiguous
- `Additional Effects`: scaling mechanic if any (e.g. "Increases by 10 every time played"), else blank
- `Requirement`: blank, existing string, or new string
- Leave `Additional Effects` and `Requirement` blank (empty, not null) if unused

**If proposing a new effect, requirement, or additional effect**, add an implementation note:
> ⚠️ New mechanic — needs `js/treats/<id>.js` implementation (and `js/treats/requirements.js` entry if new requirement)

### 9. Add to Sheet

**Spreadsheet ID:** `1qEr42p9HsQFPrBip1TqYB2DBehKPgyT_e0CwmNP_Cd4`

1. Use `mcp__google-sheets__sheets_get_values` to find the next empty row:
   - Range: `Treats!A1:A60`
   - Scan for the first row after all named treats where column A is `FALSE` with no ID in column E
2. Use `mcp__google-sheets__sheets_update_values` to write the full row:
   - Range: `Treats!A<row>:M<row>`
   - `valueInputOption`: `RAW`

**Review & approval flow:**
- `Proposed` — designed; awaiting user review in sheet
- `Approved` — user signed off; ready to implement
- `WIP` — implementation in progress

### 10. Implement (when approved)

Only do this step when the user explicitly asks to implement/add the treat.

1. **Create `js/treats/<id>.js`:**
```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: <id>
//  <one-line description>
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['<id>'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      // return { gids, m } for mul phase
      // return { bonus, desc } or { bonusMap } for add phase
    };
  },
};
```

2. **Add script tag in `index.html`** after the last treat script (before `config.js`):
```html
<script src="js/treats/<id>.js"></script>
```

3. **Update sheet row** — change `Status` from `Proposed` to `Approved`, `Enabled` to `TRUE`

4. **Commit and push:**
```
git add js/treats/<id>.js index.html
git commit -m "Add <NAME> <rarity> treat\n\n<one-line mechanic description>.\nAdded to Treats sheet row <N>."
git push
```

### Helper Functions Reference

From `js/treat-effects.js`:

| Function | Returns | Use for |
|----------|---------|---------|
| `allAdd(cats, amt)` | `{bonus, desc}` | +amt to all cat groups |
| `rowAdd(b, cells, amt)` | `{bonus, desc}` | +amt to cats in same row |
| `colAdd(b, cells, amt)` | `{bonus, desc}` | +amt to cats in same col |
| `surrAdd(b, cells, amt)` | `{bonus, desc}` | +amt to adjacent cats |
| `allMulCS(cats, cs, m)` | `{gids, m}` | ×m all cats |
| `colMul(b, cats, cells, m)` | `{gids, m}` | ×m cats in treat's col |
| `surrMulCS(b, cats, cells, m, cs)` | `{gids, m}` | ×m adjacent cats |
| `shapeMul(cats, shapes, m)` | `{gids, m}` | ×m cats matching shape(s) |
| `extractNum(ef)` | `number` | Parse +N from effect string |
| `extractMul(ef)` | `number` | Parse ×N from effect string |

### Scoring function signature

```js
(b, cats, ts, p, cs) => result
// b    = board[][]
// cats = [{gid, type, shape, cells:[...]}]
// ts   = active treats [{tdef, cells}]
// p    = this treat's cells
// cs   = catScores {gid: number} — mutate directly for x-phase treats
```

## Example

**Concept:** Trophy treat that rewards the largest cat shape on the board

Sheet row:
```
TRUE, Approved, cat shape, mul, chonk_champ, CHONK CHAMP, 🏆, epic, chonk, ×3 CHONK shaped cats, , , 8
```

Implementation:
```js
TREAT_REGISTRY['chonk_champ'] = {
  buildFn(ef, phase) {
    return (b, cats) => shapeMul(cats, ['chonk'], extractMul(ef));
  },
};
```

Design rationale: L/DUO/T shapes all have multipliers but CHONK does not — fills the gap. ×3 mirrors CORNER NAPPER. Epic with no req since chonk cats require a 2×2 shape which is already harder to fit.
