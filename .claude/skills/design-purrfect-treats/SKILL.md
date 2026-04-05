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

- `add` — bonus points; either to specific cats (Type A) or to the overall score (Type B)
- `mul` — multiplier; either on specific cat scores (Type A) or on the accumulated score (Type B)
- `x` — special one-off effects (deck manipulation, copying, transforming)

**Type A vs Type B distinction:**
- **Type A** — effect targets cats explicitly ("to ALL cats", "in same ROW", "all ORANGE cats"). Buffered and applied per-cat as each cat fires.
- **Type B** — effect is just "+N" or "×N" with no cat type in the effect text. Applied directly to the running total at the treat's scan position.

The classification matters for both mechanics and animation (see Return Shapes below).

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
- Above-average: "×2 cats whose score exceeds the group average"
- Isolated: "+N to cats with no adjacent cats"

**Special mechanic patterns (implemented, reuse these patterns):**

**Degrading** (SHOOTING STAR) — starts powerful, weakens each play. Use `G.treatPlayCounts.<id>` to track plays. Parse decrement from `addEf`. Clamp at 0.
```js
const plays = G.treatPlayCounts.my_treat || 0;
const amt = Math.max(0, baseAmt - plays * decrease);
G.treatPlayCounts.my_treat = plays + 1;
```
Sheet Additional Effects: `"Decreases by −N every time played"`

**Self-destructing** (FINAL FEAST) — fires N times then vanishes from backpack. Mark `tdef._expired = true` on the final play; `goShop()` in `scoring.js` already filters these out.
```js
const plays = G.treatPlayCounts.my_treat || 0;
G.treatPlayCounts.my_treat = plays + 1;
if (plays + 1 >= maxPlays) {
  const self = ts.find(t => t.cells === p);
  if (self) self.tdef._expired = true;
}
```
Sheet Additional Effects: `"Self-destructs after N plays"`
> No changes to `scoring.js` needed — the `_expired` filter is already in `goShop()`.

**Deck-size as stat** (LEAN LARDER) — scale bonus with `G.deck.length` (cards remaining in draw pile). Returns a `bonusMap` so each cat gets the computed flat bonus.
```js
const bonus = amt * G.deck.length;
const bonusMap = {};
cats.forEach(grp => { bonusMap[grp.gid] = bonus; });
return { bonusMap };
```
Sheet Effect: `"+N per DECK CARD to ALL cats"`

**Declined mechanics — do not propose:**
- **Diagonal placement** — confusing for players; diagonal alignment is hard to read on the board
- **Center cell placement** — not challenging or fun enough; doesn't create meaningful decisions
- **Above-average scoring cat** — boring mechanic, not interesting enough
- **Used treats this run** (`G.usedTreats`) — hard for players to track; not transparent enough
- **Round number** (`G.round`) — always in the player's favor at purchase time (later rounds = more power), making it a trivially good buy regardless of strategy

New effect types require a new `js/treats/<id>.js` implementation — flag this in output.

### 2b. Balatro Design Inspiration

Balatro's joker system is the closest design analog to PurrfectFit treats. Study these patterns when stuck or seeking new ideas.

#### Scoring Formula Parallel

Balatro scores as **Chips × Multiplier**. PurrfectFit mirrors this exactly: the `add` phase sets a baseline, then `mul` treats compound multiplicatively on top. Two ×3 multipliers = ×9 total, not ×6. This means:
- Flat add treats are safe, predictable, never exciting alone
- Mul treats compound exponentially — conditions/costs must scale with power
- The most explosive moments come from stacking multiple mul treats

#### Joker Archetypes → Treat Archetypes

| Balatro Archetype | How It Works | PurrfectFit Equivalent |
|-------------------|--------------|------------------------|
| **Flat bonus** | +X chips unconditionally | milk, window_perch, rainbow_bowl |
| **Per-axis scaling** | +N per [hand size / cash / discard] | coin_purr, slow_blink, quick_paws, cardboard_box |
| **Type multiplier** | ×N to one suit/type | tuna_can, shadow_feast, cotton_cloud, tabby_pack |
| **Shape multiplier** | ×N to one card rank/shape | yarn, kitten_toy, chonk_champ, gentle_giant |
| **Conditional big mul** | ×5 only if [board full / flush] | all_or_nothing, frenzy, nap, last_resort |
| **Ascending scaling** | gains power each play | catnado, cathouse, sprint_finish, purr_fection |
| **Descending/self-destruct** | starts powerful, weakens/dies | shooting_star, whisker_fatigue, hiss_and_miss, final_feast |
| **Opportunity cost** | punishes having more of something | nap (no other treat), nine_lives (×(9−treats)) |
| **Economy** | scales on cash held | coin_purr, deep_pockets |
| **Spatial** | rewards WHERE pieces are placed | corner_napper, scaredy_cat, window_perch, cathouse |
| **Copying** | clones another effect | laser, mirror, cat_phone |
| **Treat synergy** | scales with treat count | cat_nap_stack, nine_lives |

#### Unexplored Axes (High Priority)

These Balatro axes have no PurrfectFit treat yet — strong candidates for new designs:

- **Passive income** — earn +$N at end of each round. Balatro's "Egg" archetype. Completes the economy loop (coin_purr and deep_pockets exist but nothing generates cash).
- **Adjacent treat bonus** — "+N to all cats per OTHER treat adjacent to this one." Spatial treat placement becomes strategic. Balatro has no grid so this axis is uniquely PurrfectFit's.
- **Per total cat cells** — "×(total cells occupied by all cats ÷ 6)." Rewards filling the board with many pieces equally regardless of shape.
- **Backpack full condition** — "×4 ALL cats — only if backpack is completely full." Inverse of empty_nest. Rewards maxing out treat collection.
- **Early-round specialist** — "×3 all cats — only on hand 1." Balatro's "Dusk" (last-hand retrigger) inverted. Rewards immediate play.
- **Per discard USED (ascending)** — "+N per discard used this round." Rewards burning discards aggressively, opposite of slow_blink.
- **Poverty scaling** — "×(max(1, 5 − cash)) all cats." Rewards spending everything; anti-synergy with coin_purr/deep_pockets, creates a completely different economic build.
- **Sell-value scaling** — "×(count of rare/legendary treats in backpack) all cats." Rewards collecting expensive treats. Balatro's Swashbuckler archetype.

#### Core Design Principles from Balatro

1. **The best modifiers change HOW you play, not just how much you score.** A treat that gives +50 flat is boring. A treat that rewards holding cash (+N per $1) changes your spending behavior. Treats that restructure placement, type selection, or resource conservation are always more interesting.

2. **Power should be inversely proportional to reliability.** Unconditional ×2 is weak and fine at common. Conditional ×5 is strong and fine at epic/legendary. Make players earn big numbers.

3. **Opportunity cost treats are excellent design.** nap (×2, no other treat) and nine_lives (×(9−treats)) create genuine philosophy choices: go wide (many cheap treats) vs. go narrow (one powerful treat). Both reward commitment differently.

4. **Scaling treats need a natural ceiling or the build will trivialize late rounds.** Uncapped ascending scaling (like catnado with no max) can become dominant. When designing a scaling treat, consider adding a soft cap (e.g., `Math.min(m, 5.0)`) or a self-destruct endpoint.

5. **Spatial axes are PurrfectFit's biggest differentiator from Balatro.** Balatro has no grid, no adjacency, no placement constraints. Every treat that rewards WHERE a piece is placed (corner, edge, isolated, adjacent to other cats/treats) is uniquely yours — lean into this.

6. **Emergent synergies are better than designed ones.** Don't build treat A to combo with treat B. Build both around independent axes (timing, economy, spatial) and let players discover that the axes amplify each other. The combo should be a discovery, not an intent.

#### Patterns to Avoid (Balatro Lessons)

- **Unconditional high multipliers** — ×5 with no condition is uninteresting. Always attach a cost, condition, or drawback to anything above ×3.
- **Pure randomness without player influence** — wild_dice and lucky_paw can't be planned around. Fine for one or two treats but don't add more in this category.
- **Retrigger mechanics** — Balatro's most explosive axis. If a cat's scoring were re-evaluated (add phase runs twice per cat), the interaction with multiple mul treats causes exponential compounding (e.g., catnado × cat_nap_stack, squared). Do not implement a full retrigger. If ever proposed, limit it strictly to re-running the add phase only, never multipliers.
- **Mirror/laser self-reference loops** — if laser copies mirror, and mirror re-runs all add treats including laser's copied effect, you get infinite recursion. Any copying treat must explicitly exclude itself from the "all treats" scan.
- **Cross-round persistent scaling with no cap** — a treat that grows each round (not each play) would be trivially dominant by the last branch. Avoid unless it has a built-in ceiling.

### 3. Choose Requirement (Optional)

Requirements gate power — higher multipliers or broader effects need them.

**Existing requirements (in `js/treats/requirements.js`):**
- `NO OTHER TREAT` — treat must be alone on board
- `BOARD FULL` — all board cells filled
- `ALL SAME TYPE` — all cats on board are same type
- `LAST HAND` — must be the last hand of the round (`G.hands === 1`)
- `NO DISCARDS REMAINING` — all discards must be spent (`G.disc === 0`)

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
ALL cats (+10) · same ROW (+30) · same COL (+30) · +100 score (−1 per cat already scored) · SURROUNDING · EDGES · per UNIQUE type · per EMPTY cell · per TREAT · per CELL · per DECK CARD remaining · per MISSING DECK CARD · per HAND REMAINING · per $1 HELD · per DISCARD REMAINING · per CARD IN HAND (scaling) · SURROUNDING (degrading) · ISOLATED cats (no neighbors)

**Existing mul effects (avoid direct duplicates):**
WHITE cats (×2) · TABBY cats (×2) · ORANGE cats (×2) · BLACK cats (×2) · score ×2 (req: NO SAME TYPE ADJACENT) · score ×2 (req: ALL SAME TYPE) · score ×1.5 scaling (req: BOARD FULL) · score ×5 1-in-6 chance · score ×1 scaling (catnado) · L-shape · DUO-shape · T-shape · CHONK-shape · CORNERS · SURROUNDING (req: all same type) · per TREAT count · ×4 one random ×½ others · most common type · ×(unique type count) · ×(9 − treat count) · ×4 lowest-scoring cat · ALL (×4, self-destructs after 2 plays) · ALL (×8, self-destructs after 1 play) · cats in same COL (scaling) · ALL (×2, req: LAST HAND) · ALL (×2→growing, req: LAST HAND) · ×2 per card in hand · ×2 cats with 4+ cells · ×(unique shape count) · ×(empty BP cells ÷ 4) · ×(discards remaining +1) · ×(cash ÷ 5) · ×N if score ≥ target (growing) · ×4 req: NO DISCARDS REMAINING

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
      // Add Type A (targets specific cats):  return { bonus, desc } or { bonusMap: {gid: N} }
      // Add Type B (overall score):          return { scoreBonus: N }
      // Mul Type A (targets specific cats):  return { gids: [...], m: N }
      // Mul Type B (overall score):          return { scoreMultiplier: true, m: N }
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
| `allMulCS(cats, cs, m)` | `{gids, m}` | ×m all cats (Type A — per-cat) |
| `colMul(b, cats, cells, m)` | `{gids, m}` | ×m cats in treat's col |
| `surrMulCS(b, cats, cells, m, cs)` | `{gids, m}` | ×m adjacent cats |
| `shapeMul(cats, shapes, m)` | `{gids, m}` | ×m cats matching shape(s) |
| `extractNum(ef)` | `number` | Parse +N from effect string |
| `extractMul(ef)` | `number` | Parse ×N from effect string |

**Type B return shapes** (apply directly to running total, do NOT use `allMulCS`):
```js
// Mul Type B — multiplies accumulated score at this scan position
return { scoreMultiplier: true, m };

// Add Type B — adds flat amount to accumulated score at this scan position
return { scoreBonus: amt };
```

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
