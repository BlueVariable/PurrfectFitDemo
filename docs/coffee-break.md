# Coffee Break ☕ — round skip

On the prep screen of a **non-boss** round the player may take a *coffee
break*: skip the round entirely in exchange for a free, rarity-boosted treat
draft. Implemented in `js/cafe.js`; the round-advance seam it shares with the
normal win path is `advanceRoundSetup()` in `js/scoring.js`.

## The deal

**You give up**

- Round N's earnings (the round is never played — no hands, no payout).
- Your **next shop visit**: the prep screen for round N+1 opens with the shop
  boarded up (`G.shopClosed`) — no buying, no rerolling. **Selling** from the
  backpack is still allowed. The closure lasts exactly one prep screen; the
  next real round win (`goShop()`) reopens the shop. Consecutive skips are
  legal — each new skip re-closes the next prep.

**You get**

- A visit to the café (`s-cafe` screen): pick a **blend** — one of the treat
  archetypes from the sheet's `Archetype` column — then draft **1 of 3**
  treats rolled from that archetype, free. A "Decline — back to work" button
  is always available and takes nothing.

## Skip semantics

**The skip is committed the moment the café opens** (second confirm click):
`openCafe()` immediately advances the round and runs the next round's setup,
so nothing that happens on the café screen — including any exit added to it
later — can cancel the skip or re-roll a fresh menu. Decline only forfeits
the treat, never the skip.

Skipping round N advances to round N+1's prep **exactly as if N had been won
minus the payout**: fresh board layout roll, fresh modifier draw for N+1,
deck rebuilt, target/earn/hands from the Rounds sheet, and the same
round-end `bpReconcileWidth()` retry the win path performs. Treat lifecycle
is untouched and the purrfect streak is preserved.

Guards:

- **Boss rounds are unskippable.** The button only shows when the upcoming
  round has **no round-modifier** (checked via `G.roundModifier`, never by
  hardcoded round numbers).
- The **final round** is also unskippable — there is no "next round prep" to
  advance to, and skipping into a branch win would be a free victory.
- The prep button uses a two-click confirm ("COFFEE BREAK ☕" → "Skip this
  round? ☕"); it disarms after 4 s.

## Reward math

Each of the 3 menu slots rolls a rarity independently:

| Tier      | Weight (default) |
|-----------|------------------|
| rare      | 50 |
| epic      | 35 |
| legendary | 15 |

- **Commons never appear.**
- If the chosen archetype has no treats of the rolled tier, the roll steps
  **down** a tier (legendary → epic → rare). If nothing exists at or below
  the rolled tier (e.g. *Gambler* has no rares), it steps **up** instead so a
  slot never comes back empty.
- The 3 options are distinct by id when the archetype pool allows; duplicates
  of treats the player already **owns** are allowed (dup-stacking is a
  legitimate strategy).
- Pool = enabled treats only (same gate as the shop). Rolls use the shop's
  randomness source (`weightedSample` → `Math.random`), so seeded sim runs
  stay reproducible.
- The menu for an archetype is rolled **once per café visit** — backing out
  to the blend list and returning shows the same options (no re-roll
  fishing).

Granting uses `bpAutoPlaceRot` (the rotation-aware auto-place used by shop
buys/round-end restores). If an option can't fit the current backpack it is
marked **"No room!"** and is unselectable — the reward is never silently
destroyed, and `bpRepackAll` is never used as a fallback.

Exception: an **unowned Bottomless Tote** is never marked no-room — like its
shop card, it widens the backpack by the very column its shape lands in. The
café grant reuses the shop's held-copy pre-widen mechanism (`bpToteOwned`
counts a held copy) so the tote can be drafted even from a full bag.

## Config knobs (General tab, all optional)

Code defaults make the feature fully functional with no sheet rows; add rows
to the General tab to override.

| Setting | Default | Meaning |
|---|---|---|
| `coffee_break_enabled` | `1` | `0`/`false` hides the feature entirely |
| `coffee_break_options` | `3` | number of drafted menu options |
| `coffee_break_w_rare` | `50` | rare weight per slot roll |
| `coffee_break_w_epic` | `35` | epic weight per slot roll |
| `coffee_break_w_legendary` | `15` | legendary weight per slot roll |

## Sim

Bots never skip: `G.shopClosed` and the café flow are unreachable in
`sim.html` batches, and the flag lives on `G`, which `newGame()` replaces
wholesale — nothing persists across games or leaks between iframe runs.
