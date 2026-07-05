# Balance simulator (`sim.html`)

A zero-dependency batch simulator that plays *the real game* headlessly, many
times, with three scripted bot profiles, and reports clear-rate / scoring /
economy / treat-pick-rate stats. No build step, no external libraries — same
ethos as the game itself.

## Running it

Serve the repo over HTTP (the game already requires this for its Google
Sheets fetch; `file://` won't work for the same reason):

```
python -m http.server 8765
```

Then open `http://localhost:8765/sim.html`. It loads a hidden instance of
`index.html` in an iframe, waits for the sheet config to finish fetching, and
becomes ready to run batches.

## Using it

1. Pick a **branch** (defaults to `eu_1` / London if available).
2. Set **games per profile** (1–500, default 50) and a **base seed** (for
   reproducible batches — the same base seed + branch + profile always
   produces the same sequence of games).
3. Check which **profiles** to include: `solver`, `greedy`, `casual`.
4. **Run batch**. The progress line updates every hand (a
   `game / round / hand` heartbeat) and the dashboard refreshes as games
   finish; **Stop** takes effect at the next hand, even mid-game (the
   interrupted game is discarded from the results).
5. **Export JSON** downloads the full raw per-game, per-round results plus a
   stamp (export time + the game's config-cache hash, so you can tell which
   Google Sheet config a run was against) — useful for diffing before/after
   a balance change.

Large batches can take a couple of minutes at 500 games — the game's own
DOM rendering still runs every hand (only the score-sequence *animation* is
bypassed, see below). The engine yields to the browser before every hand
(via `MessageChannel`, which unlike `setTimeout(0)` is not throttled in
background tabs), so the page keeps painting and the Stop button keeps
working throughout. Each game also has a hard wall-clock budget
(15s — Node-VM benchmarks put the worst real game under 1.2s); a game that
somehow exceeds it is recorded as `crashed` with an explanatory message and
the batch continues.

## Bot profiles

- **solver** ("perfect"): the branch-and-bound max-coverage board packer
  (grouped identical cat shapes, largest pieces first, node-capped at 100k
  plus a 1.5s wall-clock cap per solve, stops the instant a perfect fill is
  found). Backpack treats are optional pieces in the same search (never
  mandatory), **capped at the 4 largest per solve** — treats carry over
  between rounds, and an uncapped late-game backpack multiplies the
  branching factor at every open cell (this is what slowed full-pool
  batches to a crawl before the cap). Early (non-multiplier) treats are
  tried before cats and multiplier-phase treats last, biasing them toward
  top-left/early and bottom-right/late scan positions respectively. Shop:
  priority-buys from a fixed list (big_bite, quick_paws, deep_deck, catnip,
  bench_warmer, poker_face, all_or_nothing, morning_stretch) when
  affordable and backpack space allows.
- **greedy** ("decent player, ~80% fills"): largest-cat-first, first legal
  position (all 4 rotations, scanned anchor-by-anchor); buys the single
  cheapest affordable treat each shop and places it the same way after
  cats; never proactively discards.
- **casual** ("~65% fills"): random legal placement per piece, stops early
  with some probability once ~70% of the board is filled, occasionally
  (~25%/hand) burns a discard on a random piece first, and has a 50%
  chance each shop to buy one random affordable treat.

All three share one universal safety rule: if literally no hand piece fits
anywhere, burn a discard (bot-flavored pick of which piece); if none remain,
the game is recorded as `stuck` rather than looping forever.

## How it drives the game

`sim.html` never edits game state directly — it always calls the real game
functions (`selectBranch`, `pickupCat`, `placeCatOnBoard`, `pickupTreat`,
`placeTreatOnBoard`, `doFit`, `shopPickupTreat`, `shopDropOnBP`, `doDiscard`,
`goShop`, ...), same as a human clicking through the UI, so scoring and the
treat lifecycle stay authentic.

Two things worth knowing if you're extending this:

1. **`G`/`H`/`TDEFS`/`CFG`/`RCFG`/`BRANCHES`/`DECKS`/`shopPool` are not
   reachable as `iframe.contentWindow.G`, etc.** They're declared with
   `let`/`const` at the top level of the game's scripts, which the JS spec
   keeps in the lexical (Declarative) global environment — not mirrored
   onto `window` the way `var`/function declarations are. `js/sim/bridge.js`
   is injected as a real `<script src="js/sim/bridge.js">` *inside the
   iframe's own document* (so it shares that lexical scope) and exposes
   `window.SIM_BRIDGE` with read accessors. Every actual game *function*
   (`doFit`, `placeCatOnBoard`, `rotC`, `boardCanPlace`, `bpCanAt`, `getBPR`,
   ...) is a plain function declaration and IS reachable directly as
   `iframeWindow.functionName(...)` — no bridge needed for those.
2. **The score animation is bypassed** by overriding
   `iframeWindow.runScoreSequence` to call `endScoreSequence(total)`
   immediately (the total is already computed by `doFit()` before the
   animation, so scoring stays authentic — only the ~2–3s visual sequence
   is skipped). `markBranchComplete` is also overridden to a no-op so batch
   runs never write to the player's real `localStorage` World Map progress.
   Both are installed once per page load and reused for every game in every
   batch (the iframe itself is also reused — only `selectBranch(branchId)`
   is called between games, which fully resets `G`).

## Known limitations

- Treats gated by requirements other than `FIRST HAND only`/`LAST HAND
  only`/`LAST HAND` (e.g. "ALL SAME TYPE") are still offered to the solver's
  search; if their requirement isn't met on the hand they land in, they
  simply no-op that fire (per the real game's own behavior) while still
  occupying board space and consuming their once-per-round use. Modeling
  every requirement type was out of scope.
- The solver bot has no proactive "discard to complete a fill" tactic
  (AGENT_PLAYBOOK.md §7) — only the universal "nothing fits at all, burn a
  discard" fallback shared by all three bots.
- In the rare case the solver's unified cat+treat search accepts a solution
  with treats but zero cats (should be very unlikely given cats generally
  dominate board coverage), a fallback forces one legal cat placement; if
  the board has since become too constrained even for that, the engine's
  no-progress detector (a fit that neither consumes a hand nor ends the
  round) aborts the game as `crashed` immediately rather than spinning to
  the loop guard.
- Every retry/sampling loop is attempt-bounded (hand loop 100, round loop
  200, discard fallback 30, greedy placement 60, casual placement 80,
  solver node/time caps) and each game has a 15s wall-clock budget, so a
  pathological game degrades to a recorded `crashed` result — never a
  frozen tab.
- Full DOM rendering (`renderAll`, backpack/board/hand grids) still runs
  every hand — only the score-sequence animation is bypassed. This keeps
  the sim's behavior close to the real game with minimal monkeypatching,
  at some throughput cost for very large batches.
- "Treats lost/expired" combines two different underlying causes: designed
  expiry (`_expired`, e.g. `lone_kitty`, `one_shot`, a failed `poker_face`
  reappear roll) and the backpack-restore path silently failing to re-fit a
  treat after a round (which the current game code refunds its sell price
  for, rather than destroying it for nothing) — both surface as one id list
  per round; the export JSON doesn't currently distinguish which.
