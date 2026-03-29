---
name: design-purrfect-treats
description: Use when designing new treats for PurrfectFitDemo — e.g. "design a treat", "new treat idea", "create a treat", "add a treat to the game". Guides concept, mechanics, balance, and CSV output.
---

# Design Purrfect Treats

## Overview

Structured process for designing new treats for PurrfectFitDemo. Produces a complete, balanced, uniquely-themed treat ready to paste into the Google Sheet.

## Process

### 1. Brainstorm Concept

Ask the user (or propose) a **theme** — the cat item or situation the treat is inspired by. Every treat should have a charming cat-world personality.

Identify the **strategy tag** — existing ones or invent new ones that describe the mechanic:
- `placement` — rewards where cats are placed (edges, corners, rows, cols, surrounding)
- `cat type` — rewards specific cat types (orange, black, white, grey, tabby)
- `cat shape` — rewards specific cat shapes (L, T, duo, chonk, etc.)
- `misc` — everything else (deck manipulation, treat synergies, wildcards)
- **New strategies welcome** — e.g. `timing` (per-round scaling), `count` (rewards quantity of cats), `combo` (requires two conditions), `deck` (manipulates draw pile), etc.

### 2. Design Mechanics

Choose **phase**: `add`, `mul`, or `misc`

- `add` — flat bonus points to specific cats
- `mul` — multiply specific cats' scores (applied after all add phases)
- `misc` — special one-off effects (deck manipulation, copying, transforming)

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

**Misc effects** are free-form but should be clearly resolvable (no ambiguous targeting).

**Inventing new effect types is encouraged.** Don't be limited to existing patterns. Novel ideas:
- Count-based: "+5 per cat on board" (scales with density)
- Diagonal: "+30 to cats on DIAGONALS"
- Majority: "×2 if you have more of one type than any other"
- Streak: "×3 to cats in the longest connected group"
- Threshold: "+100 if 5+ cats placed this round"
- Negative space: "×2 ALL cats if board is less than half full"

New effect types require a new `js/treats/<id>.js` implementation — flag this in output.

### 3. Choose Requirement (Optional)

Requirements gate power — higher multipliers or broader effects need them. Use existing ones or **invent new ones**:

**Existing requirements:**
- `NO OTHER TREAT` — treat must be alone in backpack
- `BOARD FULL` — all board cells filled
- `ALL SAME TYPE` — all cats on board are same type

**New requirements welcome** — e.g.:
- `NO DUPLICATES` — no two cats of the same type on board
- `5+ CATS` — at least 5 cats placed
- `ALL CORNERS FILLED` — all four corner cells occupied
- `SINGLE ROW` — all cats in the same row
- Any clear, binary condition that can be checked at score time

Leave blank for most treats. Only use for epic/legendary with high power. New requirement strings need a corresponding entry in `js/treats/requirements.js` — flag this in output.

### 3b. Balance Check — Board Fill Bias

Players fill the board to maximize score. Keep this in mind when evaluating effects:

- Effects that reward **clustering, adjacency, or connectivity** are near-trivially satisfied on a full board — almost all cats will be touching. These mechanics only create real decisions if the board is sparse or if placement order matters.
- Effects that reward **emptiness** (e.g. PERSONAL SPACE) are naturally gated by the fill incentive — they create genuine tension.
- Effects that reward **specific zones** (edges, corners, diagonals) remain meaningful on a full board because not all cats can occupy those zones.
- **Threshold effects** (e.g. "if board is less than half full") invert the fill incentive — powerful but creates a strong counter-strategy.

When designing a connectivity or adjacency-based effect, consider whether it's trivially active on a full board. If yes, add a constraint (requirement, threshold, or narrow zone) to restore the strategic decision.

### 4. Assign Rarity & Price

| Rarity | Drop Rate | Buy Price | Power Level |
|--------|-----------|-----------|-------------|
| common | 40% | $2–3 | Simple flat bonus, no req |
| rare | 30% | $4–6 | Placement/shape bonus, moderate |
| epic | 20% | $7–8 | Strong, may have requirement |
| legendary | 10% | $10+ | Game-changing, often has req |

### 5. Pick Shape

Treat-valid shapes: `uno`, `duo`, `trio`, `corner`, `straight`, `L`, `J`, `Z`, `S`, `T`, `chonk`, `cross`
(Note: `chonker` and `chonkest` are cat-only — cannot be used for treats)

Match shape to theme and rarity — bigger shapes = rarer feels.

### 6. Name, Emoji, Tagline

- **Name**: ALL CAPS, 2–3 words, cat-world themed
- **Emoji**: single emoji that fits the item
- **Tagline**: lowercase, witty, ≤5 words, cat pun optional

### 7. Check Uniqueness

The goal is a **meaningfully different** effect — not just a reskin of an existing one. Same mechanic + different number = not unique enough.

**Existing add effects (avoid direct duplicates):** ALL cats, same ROW, same COL, SURROUNDING, EDGES, per UNIQUE type, per EMPTY cell, per TREAT, per CELL

**Existing mul effects (avoid direct duplicates):** L-shape, DUO-shape, T-shape, CORNERS, ALL (×2 no req), ALL (×5 board full), ALL (×1.5), ORANGE, BLACK, SURROUNDING (req: all same type), per TREAT count, ×4 one random ×½ others, ×3 one random

**Existing additional effects:** per-play flat increase, per-play multiplier increase

A new effect that introduces a new **axis** (diagonal, connected group, majority, threshold, center, etc.) is always valid even if the phase or scope overlaps.

### 8. Output CSV Row

```
TRUE,{strategy},{phase},{id},{NAME},{emoji},{rarity},{shapeId},{effect},{additionalEffects},{requirement},{buyPrice},{tagline}
```

**Field rules:**
- `id`: snake_case, unique, descriptive
- `effect`: use existing effect style OR invent new phrasing — be specific and unambiguous
- `additionalEffects`: scaling mechanic if any — existing or new (e.g. "Doubles every 3 rounds", "−1 per treat in backpack"), else blank
- `requirement`: blank, existing string, or new string — be exact, it must be evaluable at score time
- Leave `additionalEffects` and `requirement` blank (not null — just empty) if unused

**If proposing a new effect, requirement, or additional effect**, add an implementation note after the CSV row:
> ⚠️ New mechanic — needs `js/treats/<id>.js` implementation (and `js/treats/requirements.js` entry if new requirement)

## Example

**Concept:** Cozy cat bed that rewards cats near the center of the board

```
TRUE,placement,add,cat_bed,CAT BED,🛏️,rare,chonk,+40 to cats adjacent to CENTER,,,$5,snooze in style
```
