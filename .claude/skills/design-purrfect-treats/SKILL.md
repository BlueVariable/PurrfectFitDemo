---
name: design-purrfect-treats
description: Use when designing new treats for PurrfectFitDemo — e.g. "design a treat", "new treat idea", "create a treat", "propose a treat", "add a treat to the game". Guides concept, mechanics, balance, sheet row output, and full implementation.
allowed-tools: [mcp__google-sheets__sheets_get_values, mcp__google-sheets__sheets_update_values]
---

# Design Purrfect Treats

Structured process for designing new treats. Produces a complete, balanced, uniquely-themed treat ready for the Google Sheet and code.

## 1. Brainstorm Concept

Propose a **theme** — the cat item or situation the treat is inspired by. Every treat should have a charming cat-world personality.

**Strategy tags:** `placement`, `cat type`, `cat shape`, `timing`, `coin`, `luck`, `stacked`, `deck manipulation`, `treat manipulation`, `purrfect fit`, `discard`, `expire`. New tags welcome.

## 2. Design Mechanics

**Phase**: `add`, `mul`, or `misc` (special/x-phase effects)

**Type A vs Type B:**
- **Type A** — targets specific cats ("to ALL cats", "in same ROW", "all ORANGE cats"). Buffered per-cat.
- **Type B** — flat score bonus or multiplier with no cat targeting. Applied to running total.

**Add benchmarks:**
| Scope | Value |
|-------|-------|
| ALL cats | +8–10 |
| Row / Col / Surrounding | +25–50 |
| Per condition (empty cell, discard, hand, etc.) | +15–50 |

**Mul benchmarks:**
| Scope | Multiplier |
|-------|-----------|
| ALL cats (no req) | ×1.5–2 |
| ALL cats (hard req) | ×2–5 |
| Specific type/shape | ×2–3 |
| Scaling (per condition) | starts low, grows |

**Implemented mechanic patterns (reuse):**

**Reappear** (LUCKY PENNY, FENCE SITTER, GOLD STAR, POKER FACE, CROWD PLEASER) — 50% chance to survive after use. Mark `_expired` on coin flip.
```js
const selfTdef = ts.find(t => t.tdef.id === 'my_treat')?.tdef;
if (Math.random() >= 0.5 && selfTdef) selfTdef._expired = true;
```
Sheet Additional Effects: `"1 in 2 chance REAPPEAR in inventory after use"`

**Degrading** (SHOOTING STAR) — weakens each play via `G.treatPlayCounts`.
Sheet Additional Effects: `"Decreases by −N every time played"`

**Self-destructing** (FINAL FEAST) — fires N times then marks `_expired`.
Sheet Additional Effects: `"Self-destructs after N plays"`

**Scaling multiplier** (LONE KITTY, SPRINT FINISH) — grows via `G.treatPlayCounts`, marks `_expired`.
Sheet Additional Effects: `"+0.2 each time TRIGGERED"`

**Declined mechanics — do not propose:**
- Diagonal placement — confusing for players
- Center cell placement — not meaningful
- Above-average scoring cat — boring
- Used treats this run (`G.usedTreats`) — hard for players to track
- Round number (`G.round`) — trivially good buy in later rounds

## 3. Choose Requirement (Optional)

**Existing requirements (in `js/treats/requirements.js`):**
- `NO OTHER TREAT` — treat must be alone on board
- `BOARD FULL` / `All BOARD cells are FULL`
- `ALL SAME TYPE` / `All cats must be of the SAME TYPE`
- `All cats must be of the SAME SHAPE`
- `SAME TYPE cats can't be adjacent to each other` / `NO SAME TYPE ADJACENT`
- `LAST HAND` / `LAST HAND only`
- `FIRST HAND only`
- `NO DISCARDS REMAINING`
- `NEEDS ORANGE`
- `PURRFECT FIT!`
- `1 in 6 trigger CHANCE`
- `All SURROUNDING cats must be of the SAME TYPE`
- `All SURROUNDING cats must be of the SAME SHAPE`
- `TRIGGERS after 3 use`

New requirement strings need an entry in `js/treats/requirements.js`.

**Board fill bias:** Players fill the board to maximize score. Adjacency effects are near-trivially satisfied on a full board — add a constraint. Emptiness effects create genuine tension. Threshold effects ("less than half full") invert the fill incentive.

## 4. Assign Rarity & Price

| Rarity | Price | Power |
|--------|-------|-------|
| common | $2–3 | Simple flat bonus |
| rare | $4–6 | Moderate, placement/shape |
| epic | $7–8 | Strong, may have requirement |
| legendary | $10+ | Game-changing |

## 5. Pick Shape ID

Valid: `uno`, `duo`, `trio`, `corner`, `straight`, `L`, `J`, `Z`, `S`, `T`, `chonk`, `cross`

`chonker` and `chonkest` are cat-only — do not use for treats.

## 6. Name, Emoji, Tagline

- **Name**: ALL CAPS, 2–3 words, cat-world themed
- **Emoji**: single emoji
- **Tagline**: lowercase, witty, ≤5 words

## 7. Check Uniqueness

Same mechanic + different number = not unique. A new **axis** is always valid.

**Existing add effects:**
SURROUNDING (+50) · same ROW (+50) · same COL (+50) · +200 (−10 per cat scored) · +25 per CAT · +50 per HAND remaining · +50 per cat in HAND · +15 per cat in DECK · +15 per EMPTY cell · +20 per DISCARD USED this round · +50 per PURRFECT FIT this round · +50 per DISCARD remaining · EDGES · per UNIQUE type · per TREAT · per CELL · per DECK CARD · per MISSING DECK CARD · per $1 HELD · SURROUNDING (degrading) · ISOLATED cats

**Existing mul effects:**
×2 each WHITE/TABBY/ORANGE/BLACK/GRAY cat · ×1.2 scaling (req: no same type adjacent / all same type / all same shape / purrfect fit) · ×1.5 scaling (req: LAST HAND) · ×1.5 (req: FIRST HAND) · ×6 (1-in-6 chance) · ×2 scaling (catnado, destroys treat) · L/DUO/T/CHONK shape · CORNERS · SURROUNDING (req: all same type) · per TREAT count · ×4 one random ×½ others · most common type · ×(unique type count) · ×(unique shape count) · ×(9 − treat count) · ×4 lowest-scoring cat · self-destruct ×4/×8 · cats in same COL (scaling) · ×2 per card in hand · ×2 cats with 5+ cells · ×(empty BP cells ÷ 4) · ×(discards remaining +1) · ×(cash ÷ 5) · ×N if score ≥ target · ×4 (req: NO DISCARDS REMAINING)

**Existing misc/x-phase effects:**
+$4/+$2/+$10 cash · DUPLICATE cat to DECK · DESTROY cat from DECK · COPY random treat · DISABLE requirement · RETRIGGER 1 treat · RETRIGGER all cats · RETRIGGER all treats · DUPLICATE treat from inventory · Trigger WILD DICE again

## 8. Design Principles

1. **Best treats change HOW you play**, not just score. Rewards for holding cash, saving discards, or specific placement patterns restructure decisions.
2. **Power inversely proportional to reliability.** Unconditional ×2 = common. Conditional ×5 = epic/legendary.
3. **Mul treats compound exponentially** — two ×3 = ×9. Conditions/costs must scale with power.
4. **Scaling treats need a ceiling** or self-destruct endpoint.
5. **Spatial axes are PurrfectFit's differentiator** from Balatro — lean into adjacency, placement, and board geometry.
6. **Emergent synergies > designed combos.** Build around independent axes, let players discover interactions.

**Patterns to avoid:**
- Unconditional multipliers above ×3 — attach a cost or condition
- More pure-randomness treats — wild_dice/lucky_paw are enough
- Full retrigger mechanics — exponential compounding with mul treats
- Copy/mirror self-reference loops — any copying treat must exclude itself
- Cross-round persistent scaling with no cap

**Unexplored high-priority axes:**
- Adjacent treat bonus — "+N per OTHER treat adjacent to this one"
- Per total cat cells — "×(total cells ÷ 6)"
- Backpack full condition — "×4, only if backpack full"
- Poverty scaling — "×(max(1, 5 − cash))", anti-synergy with coin treats
- Sell-value scaling — "×(count of rare/legendary treats in backpack)"

## 9. Sheet Row Format

**Spreadsheet ID:** `1qEr42p9HsQFPrBip1TqYB2DBehKPgyT_e0CwmNP_Cd4`

Column order (A → P):
```
Enabled | ID | Name | Emoji | Rarity | Strategy | Phase | Shape ID | Effect | Additional Effects | Requirement | Buy Price | Description | Status | Claude Notes | Proposition Decline Reason
```

- `Enabled`: `FALSE` for proposals, `TRUE` at implementation
- `Status`: `Proposed` → `ToBeImplemented` → `Approved` (code live)
- `ID`: snake_case, unique

Find the next empty row via `sheets_get_values` on `Treats!B1:B60`, then write with `sheets_update_values`.

## 10. Implement

1. Create `js/treats/<id>.js`:
```js
'use strict';
TREAT_REGISTRY['<id>'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      // return shape based on type (see CLAUDE.md Treat System)
    };
  },
};
```

2. Add `<script src="js/treats/<id>.js"></script>` in `index.html` before `config.js`.

3. Update sheet row via MCP — `Enabled` → `TRUE`, `Status` → `Approved`.

4. Commit and push.

## Helper Functions

From `js/treat-effects.js`:

| Function | Returns | Use for |
|----------|---------|---------|
| `allAdd(cats, amt)` | `{bonus, desc}` | +amt to all cats |
| `rowAdd(b, cells, amt)` | `{bonus, desc}` | +amt same row |
| `colAdd(b, cells, amt)` | `{bonus, desc}` | +amt same col |
| `surrAdd(b, cells, amt)` | `{bonus, desc}` | +amt adjacent |
| `allMulCS(cats, cs, m)` | `{gids, m}` | ×m all cats (Type A) |
| `colMul(b, cats, cells, m)` | `{gids, m}` | ×m same col |
| `surrMulCS(b, cats, cells, m, cs)` | `{gids, m}` | ×m adjacent |
| `shapeMul(cats, shapes, m)` | `{gids, m}` | ×m matching shapes |
| `extractNum(ef)` | `number` | Parse +N |
| `extractMul(ef)` | `number` | Parse ×N |

**Type B returns** (no helper needed):
```js
return { scoreBonus: N };              // Add Type B
return { scoreMultiplier: true, m };   // Mul Type B
```

**Scoring function signature:** `(b, cats, ts, p, cs) => result`
- `b` = board[][], `cats` = [{gid, type, shape, cells}], `ts` = active treats [{tdef, cells}], `p` = this treat's cells, `cs` = catScores {gid: number}

**Round-level counters available:** `G.disc` (discards remaining), `G.discUsedRound`, `G.purrfectsThisRound`, `G.hands` (hands remaining), `G.maxHands`, `G.totalFits`, `G.totalPurrfects`, `G.treatPlayCounts`
