# AGENT PLAYBOOK — How to *play* Purrfect Fit (notes for the next Claude)

> Hand-off from previous Claudes who played the game via the Chrome browser tools.
> Everything below is verified against the code as of **2026-07-13**. Read PART A
> (current truth) before you click anything; PART B is compressed history — read it
> only for context on why things are the way they are.
>
> `CLAUDE.md` covers editing the code/sheet. This file covers playing.

---

# PART A — CURRENT TRUTH (read this, play well)

## 0. The design principle you are playing inside

**Treats and packing strategy are the heroes. The purrfect-fit bonus is a real prize
you should chase every hand — but it can never carry a round on its own.** The target
curve is explicitly tuned so that **four purrfect fills (a whole round's hands) do not
cover a round's target** (Rounds sheet helper column `Target ÷ PerfectFit (k)`, k ≳ 1.15
everywhere; at best a full-fill-every-hand run covers ~88% of R7's target). So:
full-fill when you can, but you win rounds with a **treat engine** — scan-order-aware
flat adds early, multipliers late. A "cheap filler treats, no strategy" build no longer
clears the run.

## 1. Launch

- **Serve over HTTP** — the browser extension refuses `file://`:
  `python -m http.server 8765` in the project dir → `http://localhost:8765/index.html`.
  (If a stale server is already on your port it may be serving a *different* checkout —
  use a fresh port and grep the served file for your change.)
- The title screen live-fetches config from Google Sheets; wait ~3 s.
- Flow: **PLAY → World Map → pick an HQ → WORK**. All HQs are unlocked
  (`isBranchUnlocked()` returns true). London (`eu_1`) = wild deck, **+1 Hand**;
  other branches trade that for +1 discard or +$10 start.
- After every branch select / round win / café exit the visible screen is the
  **work-week calendar** (`s-calendar`) — 5 days × 3 rounds, boss "deadline" on rounds
  3/6/9/12/15. It's screen-only for scripted play: state (shop pool, round setup,
  `G.roundModifier`) is already fully set up by `openCalendar()` → `openRounds()`, so
  `startRound()` / `PF.playRound()` and the shop fns work directly.

## 2. Drive the game with the harness — don't re-derive a solver

**`agent/pf-harness.js` is maintained and injectable.** One call in `javascript_tool`:

```js
fetch('/agent/pf-harness.js').then(r=>r.text()).then(eval)
```

Installs `window.PF`:

| call | does |
|------|------|
| `PF.state()` | phase, round, target, score, hands, discards, cash, `hand`, backpack treats (with effect text + `req`), shop (price/affordable/owned), `boardAscii` |
| `PF.plan({K, treats:[{id, bias:'early'\|'late'}]})` | best-of-K layouts scored with `projectScore`; **leaves the winner placed**; returns `{proj, filled, playable, full, board}` |
| `PF.fit()` | `doFit()` — then `wait` ~8 s for the animation |
| `PF.fitFast()` | resolves the hand synchronously (animation bypassed; the score is computed in `doFit` before the animation, so results are authentic) |
| `PF.buy(id)` / `PF.sell(id)` / `PF.reroll()` | shop ops; `buy` returns `'no-bp-room'` rather than destroying anything |
| `PF.playRound()` / `PF.nextRound()` / `PF.discard(catId)` / `PF.ascii()` | flow control |

Rules baked into it — do not "improve" them away:

- **Every injected evaluation must be synchronous.** Never `await` a timer inside a
  `javascript_tool` call — it wedges the CDP channel. Use the computer tool's `wait`.
- **javascript_tool has a ~15-20 s execution budget.** Best-of-K planning with 8+ treats
  on a 26-cell board blows it and can strand treats mid-plan. Keep `K ≤ 25` and do ONE
  plan+fit per call. Stranded treats are recoverable (they're in `G.treats`; the next
  `clearBoard()` returns them to the bag).
- **Never call `bpRepackAll([td])` as a buy fallback.** It rebuilds the bag and silently
  destroys treats that don't re-fit (it has zero game callers now, it's a debug utility).
  `'no-bp-room'` means sell or rearrange first — exactly the choice a human faces.
- **Read `req` before planning.** `all_or_nothing` requires a PURRFECT FIT (placing it on a
  hand that can't full-fill wastes its once-per-round trigger *and* its growth — and its own
  cell is sometimes exactly what makes the fill impossible). `morning_stretch` is
  FIRST-HAND-only. `bell` requires NO OTHER TREAT.
- `projectScore(null).total` **equals** the next `doFit` total exactly — the cheap way to
  compare candidate plans without committing.

### If you need to go under the harness

State (`G`, `js/state.js`): `tgt`/`score`/`lastScore`, `hands`/`disc`, `bsr`/`bsc` +
`board[r][c]` (`{filled, blocked, offShape, kind:'cat'|'treat', type, gid}`), `hand[]`
(`{id, type, shape, cells}` — `cells` is a 0/1 grid), `bpGroups[]`
(`{gid, tdef, cells, or, oc, shape, rot}`), `bpPending[]` (overflowed but owned),
`cats[]`/`treats[]` (placed this fit), `usedTreats[]`, `roundModifier`, `roundLog`.
`H` is the held piece (`cells`, `grabDr/grabDc`, `handIdx`).

Functions: `rotC(cells,rot)` (clockwise), `boardCanPlace(cells,or,oc)`,
`placeCatOnBoard(r,c)` / `placeTreatOnBoard(r,c)` (place `H`, origin `= (r-grabDr, c-grabDc)`),
`pickupTreat()` (moves the `G.selBpGid` treat from the bag into `H` — placing a treat without
this leaves a duplicate in the bag), `doDiscard()`, `clearBoard()`, `doFit()`, `goShop()`.
Two traps if you hand-roll placement: `rotC` can return leading empty rows/cols (build `H.cells`
from the exact absolute cells and place with `grabDr=grabDc=0` at `(minR,minC)`), and
`placeCatOnBoard` splices `G.hand[H.handIdx]` (re-`findIndex` by `h.id` between placements).

## 3. Scoring (verified in `js/scoring.js`)

Pieces are scanned **top-left → bottom-right** (the `mirror_mood` boss modifier reverses it).
A running total accumulates.

- **Each cat scores `cells × 10`** (`base_score_per_cell`). Colour/type gives no bonus by
  itself — only treats key off type.
- **Purrfect (board-fill) bonus** when every playable cell is filled:
  `playableCells × perCell`, where **`perCell` scales with the work-week DAY**:

  ```
  day     = ceil(round / 3)                 // R1-3 = day 1 (MON) … R13-15 = day 5 (FRI)
  perCell = fill_bonus_base × day           // base 5 → MON 5, TUE 10, WED 15, THU 20, FRI 25
  ```

  Read the live value off the UI rather than assuming: prep-screen chip
  "✨ DAY N · PURRFECT +N/cell", the in-game target card chip, and the FIT projection
  tooltip all print it.
- **The purrfect bonus is added at the very END and is NOT multiplied** by any treat
  multiplier (only the `fill_bonus_mult` boss modifier scales it). Multipliers only act on
  cats + flat treats that scanned *before* them. This is what makes positional play matter.
- **Treats fill cells too**, so they count toward "board full".
- Score accumulates across all hands of the round toward `G.tgt`.

**Positional consequences (this is the whole game):**

- **Flat "+N" treats → top-left** (they scan first, then get multiplied by everything after).
- **`big_bite` decays over the whole RUN, not the hand** — its payout is
  `base − dec × (G.catsScoredRun + cats scanned before it this fit)`, and `G.catsScoredRun`
  is cumulative across every fit of the run. It is an **early-run** treat that fades to +0;
  buying it late is close to worthless. (Older notes here promised "+200 if placed top-left"
  — that is only true on your first hands.)
- **Multiplier treats (×N) → bottom-right.** They multiply everything already counted.
- **`catnip`-style "+N per cat in ROW/COL" → a line you actually pack with cats** (in a
  treat-only row it pays +0).
- One multiplier on a **full** board often beats two multipliers on a partial board — the
  purrfect bonus is a big un-multiplied term and the extra cats add multiplied base. Compare
  both with `projectScore` before committing.

## 4. Round curve, board, economy (live sheet values, 2026-07-13)

| R | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|---:|---:|---:|---:|---:|---:|
| **Target** | 450 | 550 | 650 | 900 | 950 | 1100 | 1500 | 1600 | 1700 | 2200 | 2300 | 2400 | 3000 | 3200 | 3400 |
| **Board cells** | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 24 | 25 | 25 | 26 | 27 | 28 |
| **Blocked prob** | 0 | 0 | .02 | .03 | .04 | .05 | .06 | .06 | .07 | .07 | .08 | .08 | .09 | .10 | .10 |
| **One purrfect** | 80 | 85 | 90 | 190 | 200 | 210 | 330 | 345 | 360 | 480 | 500 | 500 | 650 | 675 | 700 |

*(Any target numbers you find in PART B's run logs are historical and superseded — this
table is the current curve.)*

- **Board**: a generated polyomino of that many playable cells (`setupBoardLayout` →
  `generatePolyomino`), **rolled once per round** and fixed for every hand of that round;
  it re-rolls next round. Some cells are `blocked` (striped). The grid dims (`G.bsr/G.bsc`)
  come from the polyomino — don't assume 5×5.
- **Hands**: 4/round (`hand_count`), +1 in London. **Discards**: 3 (+1 in Paris/Bangkok/…).
  **Hand size**: 7 cards. Rounds 3/6/9/12/15 also carry a boss modifier.
- **Economy**: start $5; each round pays $5 + $1 per unused hand. Shop stocks 3 treats;
  reroll costs escalate **3 → 5 → 8 → 12** within a round (resets each round). **Sell-back is
  50% of buy price** (`sell_price_coef`).
- Buying = **drag the shop card onto a backpack cell** (a click only selects). You choose the
  cell *and* the rotation.

## 5. Treats — lifecycle facts that decide your play

- **Each treat triggers at most once per round.** After a fit, every treat that was on the
  board leaves the inventory for the rest of the round and is restored at round end. So
  **spread deployment across the round's hands** — multiplier on the highest-base hand,
  "+N per hand remaining" treats on hand 1.
- **A failed 1-in-2 REAPPEAR flip does NOT destroy the treat.** On a successful flip the treat
  bounces straight back to the bag and can be replayed **this round**; on a failure it just
  takes the normal used-treat path and is **restored at round end**. (Older notes in this file
  claimed these flips "killed" treats — they never did.)
- **Only two things permanently remove a treat:** `catnado` (destroys a random *inventory*
  treat when it fires) and self-expiry — `final_feast`, `hiss_and_miss`, `second_breakfast`,
  `treat_encore` (the last two: 1-in-2 per use), plus `soft_landing`, which burns itself to
  convert a failed round into a win. Each of these pops a **toast** (the "loss ceremony",
  `js/treat-loss.js`) so you can see exactly what left the bag and why.
- **Treats carry over between rounds** — your arsenal compounds. Don't re-buy duplicates
  unless you're deliberately stacking (duplicates of flat adds and Type B muls do both fire;
  `all_or_nothing` copies share one per-round scaler, so a second copy adds ×m, no ladder).
- **`gold_star` can never count the purrfect it is placed in** — `G.purrfectsThisRound`
  increments in `doFit` *after* the treat scan. Play it on hand 2+ after banking a purrfect.

### The backpack is player-managed (and loss-proof)

- Treats in the bag can be **picked up, rotated (R / right-click) and re-placed**, on both the
  game and shop screens. Each treat remembers its cells *and* rotation, and returns to that
  exact pose after a board trip or at round end.
- Every return path (`clearBoard()`, a cancelled drag, a failed drop, `dealHand()`, the
  round-end restore) goes through `bpReturnTreat()`: **remembered pose → rotation-aware
  auto-fit → `G.bpPending` overflow queue**. A treat that fits nowhere is **parked, still
  owned, never destroyed** — it shows as a dimmed "no room — make space" row in the shop
  inventory and re-seats itself automatically when you sell or rearrange.
- Practical upshot: if a buy fails with no room, **defragment the bag** (drag + rotate) rather
  than selling blind. The old warnings that `clearBoard()` / the round-end restore silently ate
  treats are **obsolete** (fixed 2026-07-12) — but `bpRepackAll()` still destroys and must
  never be called.

## 6. Current difficulty photo (2026-07-13, after the target raise)

- **Sim** (30 games × solver/greedy/casual, seed 1, London): solver 100% survival through R6,
  33% still alive entering R10, 3% entering R12, **0% by R13**; greedy dies R4-7; casual dies at
  the R3 boss. Full-run win rate **0%** for all three scripted profiles — the late game demands a
  real treat engine the bots can't assemble. Expert manual play with a good engine is the
  intended way through Days 4-5.
- **Geometry gates purrfects**: even at solver strength with a filler-stuffed bag, only ~50% of
  late hands can be full-filled (7-10% blocked cells + 7-card hand shapes). Never plan a round
  assuming every hand fills.
- **Known open issue (NOT fixed):** multiplier-class treats are shop-RNG-bound — one observed run
  saw a single multiplier offered across 13 shops + rerolls. With the raised targets the treat
  engine is load-bearing on Days 4-5, so a **multiplier pity-timer / guaranteed multiplier slot**
  is the leading proposal. If you play and never see a multiplier, that's the bug, not you.

## 7. Scripted-play traps (still live)

- **Treats as *mandatory* solver pieces clog the board** → no room for cats → `doFit()` aborts
  silently (it early-returns on `!G.cats.length`). Keep treats optional; pin specific ones with
  `PF.plan`'s `bias` instead.
- After any win screen, `#win-inline` stays visible until `goShop()` runs. **`G.score >= G.tgt` is
  the only ground truth** for win detection.
- Boss modifiers are drawn in the round advance — read `G.roundModifier` after advancing. Live
  pool (Modifiers tab): NO SECONDS (0 discards), ROCKSLIDE (2× blocked cells), SLIM PICKINGS
  (−1 card/hand), TIGHT SQUEEZE (−3 board cells), PICKY JUDGE (+15% target), TAX SEASON (−$1 per
  treat played), MIRROR MOOD (scan runs bottom-right → top-left, so your early/late pinning
  **inverts**). ROCKSLIDE / TIGHT SQUEEZE shrink solvable space — expect imperfect fills.
- Autobuy must dedupe against carried-over treats, or it re-buys what you already own.
- **Browser-extension tab groups do not survive MCP reconnects** — the page (and the run) is then
  unrecoverable. There is no save system: budget for restarts, log results as you go, prefer
  fewer/faster calls late in a run.
- Loss screen "Try Again 🔄" **abandons the entire run** (back to the world map), despite the label.

---

# PART B — COMPRESSED HISTORY (why things are the way they are)

Dated results, kept only where they still teach something. **All target numbers quoted below are
from the config of their day and are superseded by the table in §4.**

- **2026-07-05 — post-nerf full run, 15/15 won (old flat fill bonus, R15 target 1900).** Established
  the flat-add stack (`big_bite` + `quick_paws` + `deep_deck`×2 + `catnip` pinned early, multiplier
  pinned late) as the strongest line, and that duplicate treats stack. Also proved cash is never the
  constraint — the **backpack** is.
- **2026-07-05 (later) — difficulty retune + simulator.** Targets steepened, earn flattened,
  `all_or_nothing` fixed to scale once per ROUND (dup copies no longer ladder). `sim.html` +
  `js/sim/` added: batch-runs the REAL game in a hidden iframe with seeded RNG and 3 bot profiles.
  Implementation fact still true: the game's `let/const` globals (G, TDEFS, RCFG…) are NOT on
  `window` — the sim injects `js/sim/bridge.js` into the iframe to reach them, while plain function
  declarations (`doFit`, `goShop`…) are reachable as `iframe.contentWindow.fn`. Run a batch before
  and after any tuning change and diff the exported JSON.
- **2026-07-05 — spatial-treat era.** Ten placement-driven treats went live (`opening_act`,
  `snack_stack`, `cat_pile`, `cuddle_puddle`, `twin_paws`, `string_theory`, …). Lesson: scan-order
  chains work as designed and a spatial build is real, but it finished a notch under the flat-dup
  stack (first loss of that session: R15 2491/3000). `empty_bowl` pays +0 unless you're actually
  broke — buy it last in a shop visit.
- **2026-07-06 — boss rounds + projection.** Per-round modifiers on the boss rounds, the FIT
  projected-score chip (`projectScore`), paw-rating treat hover feedback, purrfect-streak callouts.
- **2026-07-07/08 — the harness.** `agent/pf-harness.js` replaced hand-rolled solvers;
  `PF.fitFast()` made a round 1-2 calls. The destructive-`bpRepackAll` trap and the CDP-timer trap
  were learned here (both still apply — §2).
- **2026-07-12 — backpack made player-managed and loss-proof.** Rotation + rearrange in the bag,
  remembered poses, `G.bpPending` overflow queue, treat-loss toasts. Retired the old "clearBoard
  eats treats" / "round-end restore eats treats" warnings.
- **2026-07-13 — purrfect bonus became day-scaled; targets raised (§3, §4).** Motivation: a
  deliberately dumb "cheapest smallest treats as board filler, chase a purrfect every hand" build
  cleared R1-R14 under the old targets, with the fill bonus contributing **40-51%** of late-round
  scores. Under the new curve four purrfect fills cover at most ~87% of a target, so that exploit is
  dead and the treat engine is mandatory again.
- **Fixed, so stop repeating them:** `encore` / `treat_encore` DO propagate Type B results
  (`scoreBonus` / `scoreMultiplier`) — the old "they do nothing" note is wrong. `rainbow_row` was
  redesigned (+N per row with 2+ types) and now pays. Failed REAPPEAR flips never destroyed
  anything.

---

*Maintained by Claude. If you discover new treats, board behaviours, or better strategies while
playing, update PART A in place (keep it true and short) and add a one-line dated entry to PART B.*
