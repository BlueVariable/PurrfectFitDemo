# Treat Archetypes — a fresh pass

A from-scratch re-categorization of all 90 treats in the Treats sheet (80 enabled,
10 ToBeImplemented), done blind to the earlier proposal in `treat-archetypes.md`.
Nothing here has been applied — the sheet's Archetype column (column G) is untouched.

## The rule that makes the taxonomy

Every treat's payoff **reads** exactly one kind of game state. That read is the
archetype. Everything else — how it grows, whether it reappears, whether it expires,
whether a Requirement gates it — is a cross-cutting *tag*, not a family.

| The payoff reads… | Archetype |
|---|---|
| filled / empty cells | **Purrfect Engine** |
| rows, columns, corners, edges, adjacency, blocked cells | **Floor Plan** |
| scan order position | **Center Stage** |
| cat **types** | **Pedigree** |
| cat **shapes / sizes** | **Sculptors** |
| hands, discards, deck, the round clock | **Shift Work** |
| coins | **Scrooge** |
| the treat inventory itself, or a die roll | **Wildcards** |
| nothing (or only its own history) | **Flat Freight** |

This rule is also the maintenance test: when a new treat is designed, its Effect text
names a noun, and the noun places it. No judgment calls, no drift.

Why the current 8 families creak: **Clutch** is a junk drawer (scan-order treats,
discard payoffs, run-scalers, and round-savers share nothing a player drafts around);
**Flat Freight** mixes true flats with resource counters that are really tempo plays;
**Huddle** hides type- and shape-matching treats behind their adjacency preposition
("adjacent to a cat of the SAME TYPE" is a type treat that happens to use adjacency);
**Tribal & Sculptors** admits in its own name that it is two families; and **Gambler**
is really "treats about treats" with dice on top.

The fix in one sentence: **the condition's noun wins over its preposition.** `frenzy`
("all SURROUNDING cats must be SAME TYPE") reads types → Pedigree, not Huddle.
`copycat` (same, but SHAPE) reads shapes → Sculptors. `milk` ("+50 for EACH
SURROUNDING cat") reads only adjacency → Floor Plan.

## The nine families

Sizes below count all 90 rows; `†` marks currently-disabled (ToBeImplemented) treats.

### 1. Flat Freight — "no strings attached" (7)

Value with no in-hand puzzle. The draft identity for players who don't want
conditions: sticker price, sticker payout. Scaling-over-the-run belongs here when it
is *passive* (nothing you do in a hand changes it).

`fish_flakes` (C, +40) · `crowd_pleaser` (R, +25/cat) · `seniority` (R, +30 growing
+15/trigger) · `big_bite` (R, +200 decaying) · `frequent_flyer` (E, ×1 +0.05/hand won)
· `trophy_shelf`† (R, +20/round won) · `hot_streak`† (E, consecutive-round streak)

- **In:** `crowd_pleaser`, `frequent_flyer` from Clutch — neither asks a clutch
  question; they pay out regardless of what you do this hand.
- **Out:** the resource counters (`bench_warmer`, `deep_deck`, `poker_face`,
  `quick_paws`) and the gated flats (`nine_lives`, `toy_mouse`, `fashionably_late`) —
  all of those pay you for a *decision*, which is the opposite of this family's pitch.
- **Internal tension:** `seniority` grows, `big_bite` decays — buy-and-hold vs.
  buy-and-spend, same shelf.

### 2. Shift Work — the round's resources and clock (13)

Hands, discards, deck, first/last hand, extra hands, saved rounds. Everything here
answers "how do you spend the round?" — the work-week fiction's home family.

`quick_paws` (R, +50/hand remaining) · `bench_warmer` (R, +30/cat in hand) ·
`deep_deck` (R, +8/card in deck) · `poker_face` (R, +50/discard remaining) ·
`second_chance` (C, +40 if discarded this hand) · `fence_sitter` (R, +40/discard used
this round) · `nine_lives` (C, +100 last hand) · `morning_stretch` (E, ×1.5 first
hand) · `sprint_finish` (E, ×1.5 last hand, scaling) · `second_wind` (L, +1 hand) ·
`soft_landing` (L, saves the round) · `brownies` (E, add a cat to deck) ·
`sardine_tin` (E, destroy a cat from deck)

- **In:** five from Clutch (`second_chance`, `fence_sitter`, `sprint_finish`,
  `soft_landing`, `second_wind`), five from Flat Freight (`nine_lives`, `quick_paws`,
  `bench_warmer`, `deep_deck`, `poker_face`), `morning_stretch` from Purrfect Engine
  (it reads the clock, not the fill), and the deck sculptors `brownies`/`sardine_tin`
  from Tribal & Sculptors (the deck is a resource; these write it, `deep_deck` reads it).
- **Internal tension:** `poker_face` pays you for hoarding discards, `fence_sitter`
  for burning them; `quick_paws` for shipping early, `nine_lives`/`sprint_finish` for
  going the distance. The family argues with itself, which is what makes it draftable
  from both sides.

### 3. Center Stage — scan order (6)

The scan is a parade; these treats stage it. Skill expression is *where the treat
sits relative to cats* in top-left → bottom-right reading order (and it inverts
under `mirror_mood`).

`head_scritches` (C, ×2 next cat) · `opening_act` (R, ×3 next cat) · `red_carpet`
(C, +80 next cat) · `diva` (L, ×1.5 next cat, scaling) · `toy_mouse` (C, +25/cat
after) · `fashionably_late` (C, +25/cat before)

- **In:** four from Clutch, two from Flat Freight. Together they were invisible;
  side by side they're obviously one family with one skill.
- This is the smallest family and deliberately so — see the gaps section; the design
  space (last-in-scan, bookends, gaps between treats) is wide open and currently
  four-fifths common.

### 4. Floor Plan — board geometry (14)

Rows, columns, corners, edges, adjacency-as-such, and blocked-cell terrain. One
family for "WHERE did you put it" — merging Lines & Terrain with the genuinely
geometric half of Huddle. A player drafting Floor Plan is drafting the board itself.

Lines & positions: `catnip` (C, row) · `feather` (C, column) · `window_seat` (C, top
row) · `high_rise` (R, rows with a cat) · `corner_office` (C, corner) · `full_house`
(E, ×1.5 if every row has a cat) · `alley_gang` (E, ×2 edge cats)
Adjacency: `milk` (C, +50/surrounding cat) · `snack_stack` (R, +40/adjacent treat) ·
`cat_pile` (R, largest connected pile) · `lap_cat` (E, ×2 cats hugging on 2+ sides)
Terrain: `roadblock_party` (C, +20/blocked cell) · `zoomies` (E, removes blocked
cells) · `demolition_crew`† (R, +60/adjacent blocked cell)

- **In:** `milk`, `snack_stack`, `cat_pile`, `lap_cat`, `alley_gang` from Huddle.
- **Out:** `personal_space` → Purrfect Engine (it reads *empty cells*, the fill
  axis); `rainbow_row` → Pedigree (its noun is cat types).
- **Internal tension:** `roadblock_party` loves blocked cells, `zoomies` deletes
  them — and `zoomies` quietly grows the purrfect payout (more playable cells), a
  cross-family bridge worth surfacing in shop copy someday.

### 5. Purrfect Engine — the fill axis (8)

Everything that reads filled or empty cells. Unchanged in spirit, sharpened at the
edges. Note the design invariant: these treats pay through normal treat scoring,
which is fine — the *board-fill bonus itself* stays outside multipliers and the
k ≳ 1.15 rule on the Rounds sheet is untouched by any re-labeling.

`biscuit` (C, +5/filled cell) · `clean_plate` (R, +120 on purrfect) · `gold_star`
(R, +50/purrfect this round) · `cuddle_puddle` (E, +120 if all surrounding cells
filled) · `string_theory` (E, +50/full row+col touched) · `all_or_nothing` (E, ×1.2
on purrfect, scaling) · `purrfect_record` (E, ±0.2 by purrfect) · `personal_space`
(R, +25/**empty** cell)

- **In:** `personal_space` as the family's built-in heretic — the anti-fill build
  (ship sparse, ship fast) living on the same shelf as the fill chasers. Archetypes
  are stronger when they contain their own inversion (see `empty_bowl` vs `fat_cat`).
- **Out:** `morning_stretch` → Shift Work (first-hand timing, zero fill in its text).

### 6. Pedigree — cat types (14)

Everything whose noun is TABBY / ORANGE / SIAMESE / GRAY or "type". The drafting
decision is deck composition: go mono, go rainbow, or space your twins.

Mono wing: `purebred` (E, all same type, scaling) · `frenzy` (E, surrounding same
type) · `litter_mates` (R, +30/cat adjacent to same type) · `tabby_pack` /
`tuna_can` / `shadow_feast` / `silver_lining` (L, ×2 one named type) · `top_cat`†
(L, ×2 majority type) · `family_portrait`† (R, +50/majority-type cat past the first)
· `milk_bar`† (E, surrounding cats count as majority type)
Rainbow wing: `potluck` (R, +40/distinct surrounding type) · `rainbow_row` (R,
+30/row with 2+ types) · `no_strays`† (L, ×2.5 if no type is a singleton)
Spacing twist: `lone_kitty` (E, same types can't touch, scaling)

- **In:** `frenzy`, `litter_mates`, `potluck` from Huddle; `rainbow_row` from
  Lines & Terrain. The mono-vs-rainbow argument now lives in one place instead of
  being scattered across three families.

### 7. Sculptors — cat shapes and sizes (9)

Everything whose noun is SHAPE or cell count. The other half of Tribal & Sculptors,
finally on its own — plus the shape-matchers Huddle was hiding.

`one_shot` (E, all same shape, scaling) · `matching_set` (E, 3+ same shape) ·
`copycat` (E, surrounding same shape) · `twin_paws` (L, ×2 cats adjacent to same
shape) · `gentle_giant` (E, ×2 cats 4+ cells) · `smol_bean` (E, ×2 cats ≤3 cells) ·
`show_cat` (E, ×2 largest cat) · `mittens`† (C, +50/pair sharing a shape) ·
`hand_me_downs`† (E, ×1.5 cats sharing a shape)

- **In:** `copycat`, `twin_paws` from Huddle.
- This family has the worst rarity curve in the game — see gaps.

### 8. Scrooge — coins (9)

Already coherent; the one family the current sheet got fully right. Rule refinement:
if the payoff **currency** is coins, it's Scrooge, whatever it reads (`paid_leave`
reads discards but pays $; `coin_purse` reads the last hand but pays $).

Generators: `gift_wrap` (C, +$1/trigger) · `paycheck_advance` (C, +$1/hand
remaining) · `piggy_bank` (R, +$4) · `lucky_penny` (R, +$2, reappears) ·
`paid_leave` (R, +$1/discard remaining) · `coin_purse` (E, +$10 last hand)
Converters: `empty_bowl` (R, +20 per $1 below $10) · `fat_cat` (E, ×1 +0.1/$10 held)
Capacity: `bottomless_tote`† (L, +1 backpack column)

- **Internal tension** (keep it): `empty_bowl` pays poverty, `fat_cat` pays wealth —
  spend-it-all and hoard-it-all are both real Scrooge builds.

### 9. Wildcards — dice and treats-about-treats (10)

Payoffs that read the treat inventory, or a die. Renamed from Gambler because half
the family never gambles — it copies, retriggers, and duplicates.

Puppeteers: `laser` (E, copy a random treat) · `encore` (E, retrigger a random
treat) · `standing_ovation` (E, duplicate a random treat) · `jumping_ball` (E,
disable a random requirement) · `treat_encore` (L, retrigger all treats) · `bell`
(C, ×1.5 with NO other treat — the anti-treat heretic)
Dice: `wild_dice` (L, ×3 at 1-in-3) · `loaded_dice` (L, re-trigger wild_dice) ·
`second_breakfast` (L, retrigger all cats) · `catnado` (L, ×2, destroy a treat)

- **In:** `jumping_ball` from Clutch (it reads a treat's requirement — pure
  treat-manipulation); `bell` from Huddle (its condition is about *treats*, not
  neighbors, and it reads beautifully as the family's contrarian: the anti-combo
  treat shelved among the combo engines).

## Full mapping (all 90)

Only the Archetype value changes; ~36 rows move. `→` marks a move.

| Treat | Current | Proposed |
|---|---|---|
| second_chance | Clutch | → Shift Work |
| head_scritches | Clutch | → Center Stage |
| opening_act | Clutch | → Center Stage |
| diva | Clutch | → Center Stage |
| red_carpet | Clutch | → Center Stage |
| crowd_pleaser | Clutch | → Flat Freight |
| fence_sitter | Clutch | → Shift Work |
| jumping_ball | Clutch | → Wildcards |
| sprint_finish | Clutch | → Shift Work |
| frequent_flyer | Clutch | → Flat Freight |
| soft_landing | Clutch | → Shift Work |
| second_wind | Clutch | → Shift Work |
| fish_flakes | Flat Freight | Flat Freight |
| toy_mouse | Flat Freight | → Center Stage |
| fashionably_late | Flat Freight | → Center Stage |
| nine_lives | Flat Freight | → Shift Work |
| seniority | Flat Freight | Flat Freight |
| big_bite | Flat Freight | Flat Freight |
| bench_warmer | Flat Freight | → Shift Work |
| deep_deck | Flat Freight | → Shift Work |
| poker_face | Flat Freight | → Shift Work |
| quick_paws | Flat Freight | → Shift Work |
| trophy_shelf † | Flat Freight | Flat Freight |
| hot_streak † | Flat Freight | Flat Freight |
| laser | Gambler | Wildcards (rename) |
| encore | Gambler | Wildcards (rename) |
| standing_ovation | Gambler | Wildcards (rename) |
| wild_dice | Gambler | Wildcards (rename) |
| loaded_dice | Gambler | Wildcards (rename) |
| second_breakfast | Gambler | Wildcards (rename) |
| treat_encore | Gambler | Wildcards (rename) |
| catnado | Gambler | Wildcards (rename) |
| milk | Huddle | → Floor Plan |
| bell | Huddle | → Wildcards |
| snack_stack | Huddle | → Floor Plan |
| cat_pile | Huddle | → Floor Plan |
| potluck | Huddle | → Pedigree |
| litter_mates | Huddle | → Pedigree |
| frenzy | Huddle | → Pedigree |
| copycat | Huddle | → Sculptors |
| alley_gang | Huddle | → Floor Plan |
| lap_cat | Huddle | → Floor Plan |
| twin_paws | Huddle | → Sculptors |
| catnip | Lines & Terrain | Floor Plan (rename) |
| feather | Lines & Terrain | Floor Plan (rename) |
| roadblock_party | Lines & Terrain | Floor Plan (rename) |
| window_seat | Lines & Terrain | Floor Plan (rename) |
| corner_office | Lines & Terrain | Floor Plan (rename) |
| personal_space | Lines & Terrain | → Purrfect Engine |
| rainbow_row | Lines & Terrain | → Pedigree |
| high_rise | Lines & Terrain | Floor Plan (rename) |
| zoomies | Lines & Terrain | Floor Plan (rename) |
| full_house | Lines & Terrain | Floor Plan (rename) |
| demolition_crew † | Lines & Terrain | Floor Plan (rename) |
| biscuit | Purrfect Engine | Purrfect Engine |
| gold_star | Purrfect Engine | Purrfect Engine |
| clean_plate | Purrfect Engine | Purrfect Engine |
| cuddle_puddle | Purrfect Engine | Purrfect Engine |
| morning_stretch | Purrfect Engine | → Shift Work |
| string_theory | Purrfect Engine | Purrfect Engine |
| all_or_nothing | Purrfect Engine | Purrfect Engine |
| purrfect_record | Purrfect Engine | Purrfect Engine |
| gift_wrap | Scrooge | Scrooge |
| paycheck_advance | Scrooge | Scrooge |
| piggy_bank | Scrooge | Scrooge |
| lucky_penny | Scrooge | Scrooge |
| empty_bowl | Scrooge | Scrooge |
| paid_leave | Scrooge | Scrooge |
| coin_purse | Scrooge | Scrooge |
| fat_cat | Scrooge | Scrooge |
| bottomless_tote † | Scrooge | Scrooge |
| lone_kitty | Tribal & Sculptors | → Pedigree |
| one_shot | Tribal & Sculptors | → Sculptors |
| purebred | Tribal & Sculptors | → Pedigree |
| brownies | Tribal & Sculptors | → Shift Work |
| sardine_tin | Tribal & Sculptors | → Shift Work |
| gentle_giant | Tribal & Sculptors | → Sculptors |
| smol_bean | Tribal & Sculptors | → Sculptors |
| matching_set | Tribal & Sculptors | → Sculptors |
| tabby_pack | Tribal & Sculptors | → Pedigree |
| tuna_can | Tribal & Sculptors | → Pedigree |
| shadow_feast | Tribal & Sculptors | → Pedigree |
| silver_lining | Tribal & Sculptors | → Pedigree |
| show_cat | Tribal & Sculptors | → Sculptors |
| mittens † | Tribal & Sculptors | → Sculptors |
| milk_bar † | Tribal & Sculptors | → Pedigree |
| family_portrait † | Tribal & Sculptors | → Pedigree |
| hand_me_downs † | Tribal & Sculptors | → Sculptors |
| top_cat † | Tribal & Sculptors | → Pedigree |
| no_strays † | Tribal & Sculptors | → Pedigree |

Family-level summary: **Clutch dissolves** (its 12 treats split 5/4/2/1 into Shift
Work / Center Stage / Flat Freight / Wildcards); **Tribal & Sculptors splits** into
Pedigree + Sculptors; **Huddle and Lines & Terrain merge** into Floor Plan (after
their type/shape/fill treats go home); **Gambler renames** to Wildcards; **Flat
Freight narrows** to true unconditionals; **Purrfect Engine and Scrooge survive**
nearly intact. 8 families become 9, sized 6–14.

## Cross-cutting tags (the Strategy column, formalized)

These recur in every family and must never become archetypes:

- **scaling** — grows per trigger / per round: `diva`, `seniority`, `sprint_finish`,
  `frequent_flyer`, `lone_kitty`, `one_shot`, `purebred`, `all_or_nothing`,
  `purrfect_record`, `brownies`, `sardine_tin`, `hot_streak`, `trophy_shelf`
  (and `big_bite`, scaling's evil twin)
- **reappear** — 1-in-2 back to inventory: `second_chance`, `crowd_pleaser`,
  `gold_star`, `lucky_penny`
- **expire** — leaves the run: `soft_landing`, `second_breakfast`, `treat_encore`
  (self), `catnado` (someone else)
- **gated** — has a Requirement string: `bell`, `frenzy`, `copycat`, `clean_plate`,
  `cuddle_puddle`, `all_or_nothing`, `matching_set`, `full_house`, `nine_lives`,
  `sprint_finish`, `morning_stretch`, `coin_purse`, `wild_dice`, `lone_kitty`,
  `one_shot`, `purebred`, `no_strays`†

Suggested Strategy-column vocabulary: keep it to these four mechanics plus the
family's own keyword, instead of today's free-form mix ("placement, timing" etc.).

## What's missing — the gaps the new shelves expose

Lining the 90 treats up by family × rarity is the real payoff of re-shelving.
Rarity curve per proposed family (enabled treats only; † counted separately):

| Family | C | R | E | L | Hole |
|---|---|---|---|---|---|
| Flat Freight | 1 | 3 (+1†) | 1 (+1†) | 0 | **no legendary** |
| Shift Work | 2 | 5 | 4 | 2 | none — best curve in the game |
| Center Stage | 4 | 1 | 0 | 1 | **no epic**, thin overall |
| Floor Plan | 6 | 3 (+1†) | 4 | 0 | **no legendary** |
| Purrfect Engine | 1 | 3 | 4 | 0 | **no legendary** |
| Pedigree | 0 | 3 (+1†) | 3 (+1†) | 4 (+2†) | **no commons** |
| Sculptors | 0 (+1†) | 0 | 6 (+1†) | 1 | **no on-ramp at all** |
| Scrooge | 2 | 4 | 2 | 0 (+1†) | fine once tote ships |
| Wildcards | 1 | 0 | 4 | 5 | **no rares** |

Two findings jump out:

1. **The composition families have no on-ramp.** A new player never meets type-play
   or shape-play at 3 coins. Pedigree starts at rare, Sculptors effectively at epic
   (7 of its 9 are epic). Meanwhile geometry has six commons. This skews early shops
   hard toward Floor Plan/Center Stage and teaches nobody to draft around their deck.
2. **Three families have no legendary chase.** Flat Freight, Floor Plan, and Purrfect
   Engine all top out at epic — there is no "I found my build" moment for a fill
   player or a geometry player.

**Cheapest fixes first — five of the ten disabled rows already plug holes.** Enable
priority by gap: `mittens` (the Sculptors common on-ramp, exactly), `demolition_crew`
(Floor Plan rare), `family_portrait` (Pedigree rare), `bottomless_tote` (Scrooge
legendary), `top_cat`/`no_strays` (Pedigree legendaries beyond the four fixed-type
×2s — `top_cat` is the flexible version and arguably obsoletes drafting a wrong-type
`tuna_can`; ship at most one of the two first).

**New treat sketches** for the holes no disabled row covers (names/numbers are
placeholders; k-invariant unaffected — none of these touch the fill bonus itself):

| Sketch | Family / rarity | Effect sketch | Why |
|---|---|---|---|
| `look_alike` | Pedigree C, $3 | +50 if 3+ cats share a TYPE | mono on-ramp |
| `mixed_bowl` | Pedigree C, $3 | +25 per DISTINCT cat type on board | rainbow on-ramp |
| `runt_of_litter` | Sculptors R, $5 | +40 per cat with 3 or fewer CELLS | add-side bridge to `smol_bean` |
| `odd_one_out` | Sculptors R, $5 | +80 if NO two cats share a SHAPE | shape-diversity payoff — currently zero treats reward it |
| `grand_finale` | Center Stage E, $7 | ×2 the LAST cat in SCAN ORDER | the missing epic; mirror of `head_scritches`, teaches bottom-right staging, flips under `mirror_mood` |
| `bookends` | Center Stage R, $5 | +40 to the FIRST and LAST cat in scan order | fills the rare slot |
| `four_corners` | Floor Plan L, $10 | ×2 every cat touching a board CORNER | the geometry chase |
| `homebody` | Floor Plan E, $7 | ×1.5 cats NOT touching the board edge | interior heretic; anti-`alley_gang` |
| `purrfectionist` | Purrfect Engine L, $10 | ×1.5 score on PURRFECT FIT | the fill build's legendary; multiplies treat/cat total only, never the fill bonus — invariant safe, but sim its clear-rate before pricing |
| `pension` | Flat Freight L, $10 | +15 × current ROUND number | unconditional legendary that stays relevant on Friday |
| `raffle_ticket` | Wildcards R, $5 | 1-in-4 chance: +200 | variance at a rare price point; teaches the family before `wild_dice` money |

Also missing, noted but not sketched: a column twin for `high_rise` (rows have three
treats reading them, columns have one), a discard-themed Scrooge epic beyond
`paid_leave`, and any treat that reads the *shop* (reroll/price interaction) — a
whole shelf Scrooge could grow if the shop ever wants its own decisions.

## What archetypes could power next

The column lost its café consumer and is currently pure taxonomy. With clean
families it can carry weight again, in ascending order of ambition:

1. **Shop copy** — show the family name as a chip on shop cards; nine crisp names
   teach the game's axes for free.
2. **Shop-pool shaping** — soft pity: if the player owns 2+ treats of a family,
   weight one shop slot toward it. Needs the families to be decision-coherent,
   which is the point of this pass.
3. **Deadline modifiers that name families** — "Purrfect Engine treats are disabled
   today" / "Floor Plan treats trigger twice" reads instantly *if* the families are
   honest; today "Clutch is disabled" would hit six unrelated mechanics.

## Migration notes

- This is a **column-G-only sheet edit** (~36 cells) plus renames; no code reads
  Archetype today, so there is zero runtime risk and no sim impact.
- Do it via the MCP sheets tools, re-reading the header row first (column order has
  changed before).
- The Strategy column cleanup (tags section above) is optional and separable.
- Nothing here changes board sizes, fill math, targets, or hands-per-round — the
  `Target ÷ PerfectFit (k)` column is unaffected.
