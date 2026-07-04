# AGENT PLAYBOOK — How to *play* Purrfect Fit (notes for the next Claude)

> This is a hand-off from a previous Claude that played the game via the
> Chrome browser tools. It captures everything that was non-obvious about
> **actually playing** (not editing) the game, so you don't have to
> reverse-engineer it again. Read this **before** you start clicking.
>
> `CLAUDE.md` covers editing the code/sheet. This file covers playing.

---

## 0. TL;DR — the fastest path to playing well

1. **Serve the game over HTTP** (the browser extension refuses `file://`):
   `python -m http.server 8765` in the project dir, then navigate the tab to
   `http://localhost:8765/index.html`.
2. **You do NOT need pixel-perfect mouse tiling.** Placing irregular pieces on
   an irregular, *constantly-reshaping* board by mouse is brutal. Instead, drive
   placement through the game's own functions in JS (`placeCatOnBoard` /
   `placeTreatOnBoard`) — these are exactly what a real click calls, so scoring,
   win/loss, and treat lifecycle all run authentically. Use the mouse for the
   high-level flow (PLAY, FIT, shop drag-buy, navigation) and screenshots to show
   the result.
3. **The board is a packing puzzle.** Use the backtracking solver in §7 to find
   the max-coverage (or perfect) tiling each hand, then the applier to place it.
4. **Filling the whole board ≈ doubles your points** (see §4). Always aim for a
   full "purrfect" fit when possible.

---

## 1. Launch / environment

- **Local file URLs are blocked** by the Claude-in-Chrome extension
  ("Can't interact with browser-internal or unparseable URLs"). Run a static
  server and use `http://localhost:<port>/index.html`.
- The title screen does a live fetch of config from Google Sheets ("Loading
  config… loading Treats…"). Wait ~3 s for it to reach the PLAY screen.
- Flow: **PLAY → World Map → London "PLAY"** (only London/`eu_1` is unlocked at
  start; it's the "Wildcat Chaos" branch with a **+1 Hand** modifier).

## 2. Coordinate scaling (CRITICAL for mouse clicks)

The screenshot/`computer`-tool coordinate space is **not** the page's CSS-pixel
space. On the machine this was played on:

- `window.innerWidth = 2400`, screenshot width `= 1568` → **scale ≈ 0.653**
  (`screenshot_x = css_x * 0.653`, same factor vertically).
- `devicePixelRatio` was `0.8`; don't trust it directly — compute the factor from
  `screenshot_width / window.innerWidth`.

So if you ever click by coordinate, get the element's
`getBoundingClientRect()` center in CSS px and multiply by the scale. **The
window also silently resizes** between some screenshots (1568×699 ↔ 1536×639),
which shifts everything — re-screenshot before precise clicks. This fragility is
the main reason the JS-driven placement approach (below) is preferred.

## 3. Game state model (globals on `window`)

- `G` — all game state. Useful fields:
  - `G.tgt` target score, `G.score` accumulated this round, `G.lastScore`
  - `G.hands` hands left, `G.disc` discards left
  - `G.bsr/G.bsc` board rows/cols (5×5 grid), `G.board[r][c]` cells with
    `{filled, blocked, offShape, kind:'cat'|'treat', type, ...}`
  - `G.hand[]` current cat pieces: `{id, type, shape, cells}` where `cells` is a
    2-D 0/1 grid (e.g. duo `[[1,1]]`, cross `[[0,1,0],[1,1,1],[0,1,0]]`)
  - `G.bpGroups[]` treats in the backpack: `{gid, tdef:{id, bpS, ...}}`
    (`bpS` is the treat's 0/1 shape grid)
  - `G.cats[]`, `G.treats[]` — pieces currently placed on the board this fit
- `H` — the "held" piece while dragging. Placement reads `H.cells`,
  `H.grabDr/grabDc`, `H.handIdx`.
- Key functions (in `js/board.js`, `js/held.js`, `js/utils.js`):
  - `rotC(cells, rot)` — rotate a 0/1 grid 90°·rot **clockwise**
  - `boardCanPlace(cells, or, oc)` — validity check (bounds/blocked/offShape/filled)
  - `placeCatOnBoard(r, c)` — places `H` (a cat) with origin `(r-grabDr, c-grabDc)`
  - `placeTreatOnBoard(r, c)` — same for a treat held in `H`
  - `pickupTreat()` — moves `G.selBpGid` treat from backpack into `H`
  - `doDiscard()` — discards the held cat, draws a replacement
  - `doFit()` — runs the score sequence (or click the **FIT!** button)

## 4. Scoring (verified by playing, not guessed)

Per fit, pieces are scanned **top-left → bottom-right (row-major)**:

- **Each cat scores `cells × base_score_per_cell`**, `base_score_per_cell = 10`.
  (Type/colour gives **no** bonus by itself — only treats key off type.)
- **Board-fill ("purrfect") bonus** when every playable cell is filled:
  `playableCells × board_fill_bonus`, **`board_fill_bonus = 10`**.
- **Treats fill cells too** (`kind:'treat'`), so they count toward "board full."
- **Score accumulates across all hands** in the round toward `G.tgt`.

**The big insight:** because `board_fill_bonus == base_score_per_cell == 10`, a
**full board doubles** the cat base (every filled cell ≈ 10 base + 10 purrfect),
*plus* any treat bonuses. A perfect fit is worth far more than a partial one —
always chase the full fill.

Worked example (Round 1, hand 1): cross(5)+trio(3)+duo(2)+duo(2)=12 cat cells →
120 base; full 16-cell board → 160 purrfect; POKER FACE +150 → **430**. ✔

## 5. The board — "Wildcat Chaos"

- The board is a 5×5 grid with most cells `offShape` (not part of the playable
  silhouette). Playable region is an irregular **diamond/plus** of ~16–18 cells.
- **The shape RE-RANDOMIZES every hand**, not every round. Some cells may also be
  `blocked` (shown with diagonal stripes). So re-read `G.board` each hand; never
  reuse last hand's coordinates.
- Get the current shape cheaply:
  ```js
  (()=>{let g='';for(let r=0;r<G.bsr;r++){let s='';for(let c=0;c<G.bsc;c++){const b=G.board[r][c];s+=(!b.blocked&&!b.offShape)?(b.filled?'#':'.'):' ';}g+=s+'\n';}return g;})()
  ```

## 6. Treats — mechanics that matter for play

- Treats are **bought in the shop** (drag the card onto a backpack cell) and
  later **placed on the board during a fit** (they occupy cells but help fill the
  board for the purrfect bonus).
- **Lifecycle:** a treat triggers **at most once per round**; after a fit it moves
  to `usedTreats` and is gone for the rest of the round, then restored at round
  end (unless it self-expires). Some have a chance to **REAPPEAR** mid-round.
- **Scan order matters for some treats.** Treats fire at their cell's scan
  position. Place "first-mover" treats at the **top-left** of the board.
- Treats seen so far and how to use them:
  - **POKER FACE** 😐 (S-tetromino, 4 cells, ~$5): `+50 per DISCARD remaining`,
    1-in-2 chance to reappear. **Tension:** every discard you spend costs 50 of
    its payout, so hoard discards and solve the board by packing skill instead.
    Bonus: its **S shape fits the S-shaped pocket** these diamond boards keep
    producing — it plugs the hardest gap *and* pays out.
  - **BIG BITE** 🍖 (domino, 2 cells, ~$5): `+200, −10 per cat scored before it`.
    Place it covering the **top-left-most** playable cell so ~0 cats precede it →
    near-full +200. (Got +190 when one cat unavoidably scanned first.)
  - **SHADOW FEAST** 🟣 (cross, 5 cells, ~$10): `×2 each BLACK cat`. Strong only
    if you'll place several black cats; costs a lot of board area.
  - **PUREBRED** 🏅 (×1.2 growing, all cats must be SAME TYPE): very restrictive
    with random hands — skipped it.
  - **CATNADO** 🌪️ (×2 but DESTROY 1 random treat): risky with a small treat set.
- Buying = **drag the shop card onto a backpack cell** (a plain click only
  selects/highlights, it does not buy). Cash is top-right.

## 7. The reusable solver + applier (the workhorse)

Run this in the page (`javascript_tool`) **after a hand is dealt**. It finds the
maximum-coverage tiling of the current board with the current hand and **places
it** via the real game functions. (For an exact/perfect-only search, return early
when `filled===total`.) The "grab 0,0 + grid-from-abs-coords" trick guarantees
each piece lands on the exact cells the solver chose.

```js
(() => {
  const R=G.bsr,C=G.bsc, playable=[];
  for(let r=0;r<R;r++)for(let c=0;c<C;c++){const b=G.board[r][c];if(!b.blocked&&!b.offShape)playable.push([r,c]);}
  const total=playable.length, occ={},skip={};
  playable.forEach(([r,c])=>{occ[r+','+c]=false;skip[r+','+c]=false;});
  const norm=cs=>{const o=[];cs.forEach((row,dr)=>row.forEach((v,dc)=>{if(v)o.push([dr,dc]);}));return o;};
  const rotsFor=cs=>{const seen=new Set(),res=[];for(let rot=0;rot<4;rot++){const fl=norm(rotC(cs,rot));
    const mr=Math.min(...fl.map(p=>p[0])),mc=Math.min(...fl.map(p=>p[1]));
    const nf=fl.map(p=>[p[0]-mr,p[1]-mc]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const k=JSON.stringify(nf);if(!seen.has(k)){seen.add(k);res.push(nf);}}return res;};
  const pieces=G.hand.map(h=>({id:h.id,rots:rotsFor(h.cells),used:false}));
  const cur=[]; let filled=0, best={filled:-1,placements:[]};
  const firstOpen=()=>{for(const [r,c] of playable){const k=r+','+c;if(!occ[k]&&!skip[k])return [r,c];}return null;};
  const canPlace=abs=>abs.every(([r,c])=>r>=0&&c>=0&&r<R&&c<C&&!G.board[r][c].blocked&&!G.board[r][c].offShape&&!occ[r+','+c]);
  function dfs(){
    if(filled>best.filled)best={filled,placements:cur.map(p=>({id:p.id,abs:p.abs.slice()}))};
    if(filled===total)return;                       // <-- perfect fill found
    const fu=firstOpen(); if(!fu)return; const [r,c]=fu;
    for(const p of pieces){if(p.used)continue;for(const rt of p.rots){
      const a=rt[0],or=r-a[0],oc=c-a[1],abs=rt.map(([dr,dc])=>[or+dr,oc+dc]);
      if(canPlace(abs)){abs.forEach(([rr,cc])=>occ[rr+','+cc]=true);filled+=abs.length;p.used=true;cur.push({id:p.id,abs});
        dfs();
        cur.pop();p.used=false;filled-=abs.length;abs.forEach(([rr,cc])=>occ[rr+','+cc]=false);}}}
    skip[r+','+c]=true; dfs(); skip[r+','+c]=false;  // branch: leave this cell empty
  }
  dfs();
  // ---- APPLY best placement via real game logic ----
  const log=[];
  for(const pl of best.placements){
    const idx=G.hand.findIndex(h=>h.id===pl.id); if(idx<0)continue; const cat=G.hand[idx];
    const rs=pl.abs.map(a=>a[0]),cs=pl.abs.map(a=>a[1]);
    const mr=Math.min(...rs),mc=Math.min(...cs),Mr=Math.max(...rs),Mc=Math.max(...cs);
    const grid=Array.from({length:Mr-mr+1},()=>Array(Mc-mc+1).fill(0));
    pl.abs.forEach(([r,c])=>grid[r-mr][c-mc]=1);
    H={kind:'cat',source:'hand',data:cat,cells:grid,rot:0,color:cat.col,em:cat.em,
       handIdx:idx,boardGid:null,bpGid:null,grabDr:0,grabDc:0,dragging:false};
    placeCatOnBoard(mr,mc); log.push(cat.shape+'/'+cat.type+'@'+mr+','+mc);
  }
  const f=G.board.flat().filter(c=>c.filled).length;
  return JSON.stringify({maxCoverage:best.filled,total,filledNow:f,boardFull:f===total,log});
})()
```

Then click the **FIT!** button (mouse) and `wait` ~3–4 s for the score animation.

### Including treats in the tiling

Treats must be placed for their bonus, and they help fill the board. Add them as
**mandatory pieces** to the search (rots from `tdef.bpS`) and require they're all
`used` before accepting a full solution. To apply a treat, route it through the
real pickup so it leaves the backpack:

```js
const grp=G.bpGroups.find(x=>x.tdef.id===TREAT_ID);
G.selBpGid=grp.gid; pickupTreat();             // removes from backpack, fills H
H.cells=grid; H.rot=0; H.grabDr=0; H.grabDc=0; // grid built from chosen abs cells
placeTreatOnBoard(minR,minC);
```

Enumerate several full solutions and pick the one where **BIG BITE's cells are
earliest in row-major order** (maximizes its +200).

### Gotchas learned the hard way

- **`rotC` may return a grid with leading empty rows/cols.** Don't pair the
  solver's normalized `or/oc` with a raw `rotC` grid. Build `H.cells` from the
  exact absolute cells and place with `grabDr=grabDc=0` and origin `=(minR,minC)`.
- **`placeCatOnBoard` splices `G.hand[H.handIdx]`.** If you place by fixed index,
  do it in **descending index order**, or (better) re-`findIndex` by `h.id` each
  time — the applier above does the latter.
- Placing a treat with `placeTreatOnBoard` **does not** remove it from
  `G.bpGroups`; you must `pickupTreat()` first (or it'll exist twice).
- Max coverage is genuinely sometimes < full (e.g. 13/16, 15/18) — the diamond +
  blocked cells + your specific shapes just don't tile. That's fine; score
  accumulates across hands. Consider a discard only if it would *complete* a fill
  (the purrfect bonus, ~+playable×10, easily beats one POKER FACE discard = 50).

## 8. Shopping strategy

- Round 1 had ~$10; Rounds clear for ~$10–13 (base earn + $1 per unused hand).
- Best value found: **POKER FACE** (cheap, reliable, reusable, S-shape plugs the
  hard pocket) and **BIG BITE** (flat +200 if placed top-left). Two flat-bonus
  treats added ~+350/hand for $10 and still helped fill the board.
- Treats eat board cells, but since they fill toward the purrfect bonus, the
  "cost" is mostly the cat coverage you'd otherwise place there. High-value-per-
  cell treats (POKER FACE = +150 for 4 cells) beat raw cats (10/cell).

## 9. Run log (London / `eu_1`, +1 Hand)

| Round | Target | Final | Notes |
|------:|-------:|------:|-------|
| 1 | 700 | **880** | Bought POKER FACE. Perfect fit #1 = 430 (POKER FACE in the S-pocket). Won in 3 of 6 hands. |
| 2 | 800 | **920** | Bought BIG BITE + POKER FACE. Perfect fit #1 = 620 (BIG BITE top-left +190, POKER FACE +150). |

Both rounds won comfortably; reached Round 3 shop with ~$20. Strategy scales:
buy 1–2 flat/multiplier treats, full-fill with the solver, keep discards.

---

# PART II — Scan order, intelligent play, and a fast autopilot

Added after playing through Round 6. Two big themes: (a) **scan order is the
core of high scoring**, and (b) there are **two ways to drive the game** — a fast
heuristic autopilot, and an agent-in-the-loop decision API. Use the latter when
choices actually require judgment (shop value, multiplier timing, discards).

## 10. Scoring, refined (this changes how you place)

Pieces score in **scan order: top-left → bottom-right (row-major)**. A running
total accumulates. Critically:

- **The purrfect (board-fill) bonus is added at the very END and is NOT
  multiplied.** Multipliers only act on the running total of cats + flat treats
  that scanned *before* them.
- So the optimal layout is **positional**:
  - **Flat "+N" treats that scan-first → top-left.** `big_bite` (+200 −10 per cat
    scored before it) specifically wants to be the *first* piece → cover the
    top-left-most cell.
  - **Multiplier treats (×N) → bottom-right.** They multiply everything before
    them, so you want max base + flats already counted. Two `morning_stretch`
    (×1.5) stacked bottom-right compound to ×2.25 over the whole board.
  - **Other flats (`copycat` +100, `quick_paws` +50/hand, `catnip`) go in the
    middle** — before the multipliers so they get multiplied too.
  - **`catnip` (+50 per cat in its ROW) → a row you pack with cats.** Placed in a
    5-cat row that's +250 for one cell. Placed in a treat-only row it's +0
    (watch for this).
- **Counter-intuitive but verified:** one ×1.5 on a *full* board often beats two
  ×1.5 on a *partial* board, because the purrfect bonus is a large flat term and
  the extra cats add multiplied base. In Round 6, `big_bite`+`quick_paws`+`catnip`
  + one `morning_stretch` on a full 26-cell board scored **+1415 in a single
  hand** (target 1200) — and saved the 2nd multiplier + 2nd big_bite + copycat
  for later. Always compare "stack multipliers" vs "one multiplier + full board".

## 11. More mechanics learned

- **Treats carry over between rounds.** At round end, non-expired used treats are
  restored to the backpack (`goShop` → `bpAutoPlace`). So your arsenal compounds
  across a run — **don't re-buy duplicates**, and don't treat each shop as a blank
  slate. By Round 6 the bp held 7 treats from earlier rounds.
- **You can't place your whole arsenal in one hand** (treats eat cells and you
  need cats). Each treat triggers once per round, so **spread deployment across
  the round's hands**, using each where it's strongest (multipliers on the
  highest-base hand; `quick_paws` early when "hands remaining" is highest).
- **Reroll the shop** for **$3** (`getRerollCost()` / `rerollTreats()`) when the
  offerings don't fit your build — cheaper than buying a treat you won't use.
- **Discards** (`doDiscard`, 3/round) swap a held cat for a fresh draw. Worth it
  to *complete* a fill (purrfect ≈ +playable×10) but remember `poker_face` pays
  +50 per *unused* discard, so there's a real cost.

## 12. Two ways to drive the game

### (A) Fast autopilot — `AUTO_ROUND()` (speed)
A self-contained function that plays an **entire round per call**: advances past
the win screen, auto-buys by a priority table, then loops hands solving +
placing + fitting with the **score animation bypassed** (temporarily stub
`runScoreSequence` → `endScoreSequence(total)`; the score is already computed, the
animation is purely visual). Whole round resolves in‑page in **~75 ms**. Treats
are **optional pieces** in a single max-coverage solve (never mandatory — making
them mandatory clogs the board and starves cats; `doFit` needs ≥1 cat). This is
"good, fast, and dumb": fixed heuristics, no judgment.

### (B) Agent-in-the-loop — the `PF` decision API (intelligence)
Thin layer that **surfaces the situation + candidate plans and executes the
agent's choices**, so *you* make the calls:
- `PF.state()` → phase, round, target, score, need, hands, discards, cash,
  `bpTreats` (with **effect text**), `hand`, `shop` (when in prep, with
  effect/price/affordable/owned), `boardAscii`.
- `PF.candidates()` → ready plans (`fill`, `fillNoTreats`, `bigbiteFirst`) each
  with an ASCII preview + filled/total/treatsUsed.
- `PF.smart({early:[ids], late:[ids], fillTreats:'all'|[ids]})` → scan-order-aware
  plan: `early` treats pinned top-left (scan first), `late` pinned bottom-right
  (multipliers), the rest filled with cats + chosen treats. Returns ASCII preview.
- `PF.commit(key)` / `PF.commitSmart()` → apply a previewed plan + fit (instant).
- `PF.buy(id)`, `PF.sell(id)`, `PF.reroll()`, `PF.play()` (start round),
  `PF.nextRound()` (goShop), `PF.discard(pieceId)`.

Loop: `state()` → reason about shop (buy/reroll) → `play()` → per hand,
`smart(...)` with your scan-order intent → eyeball the ASCII → `commitSmart()`.
This costs more round-trips than the autopilot but every decision is yours.

### The fast solver core (used by both)
Branch-and-bound max-coverage. Two changes made it ~175× faster (13 s → 75 ms):
1. **Group identical cat shapes** (same rotation-set) into one piece with a count
   — kills duplicate-permutation branching.
2. **Prune hard:** stop the moment `best.filled === total` (perfect fill found);
   and bound with `if (total - skipped <= best.filled) return` (remaining open
   cells can't beat the best). Try **larger pieces first** so a high `best` is
   found early and prunes more.

## 13. Gotchas added in Part II

- Treats as **mandatory** solver pieces → board clogs, no room for cats →
  `doFit` aborts (it early-returns on `!G.cats.length`). Keep treats **optional**;
  if you want a specific treat placed, pre-place it (`PF.smart` early/late) rather
  than marking it mandatory.
- Autobuy must **dedupe against carried-over treats** and cap total, or it
  re-buys what you already own.
- After bypassing the animation, `endScoreSequence` runs synchronously and itself
  calls `dealHand()` (next hand) or `roundWin()`. Detect round end via
  `G.score >= G.tgt` or `#win-inline.classList.contains('visible')`.

## 14. Run log (cont.)

| Round | Target | Final | How |
|------:|-------:|------:|-----|
| 3 | 900 | **980** | `AUTO_ROUND()` — full round in 1 call, 213 ms |
| 4 | 1000 | **1228** | autopilot; exposed the "treats mandatory" bug → fixed to optional |
| 5 | 1100 | **1285** | autopilot after solver speed-up (74 ms, both hands PURRFECT) |
| 6 | 1200 | **1415** | **agent-driven** (`PF`): reasoned shop buys + scan-order placement, 1-hand win |

Run record so far: **6/6 rounds won** on London (`eu_1`), every round cleared
with hands to spare.

---

# PART III — Post-nerf full run (2026-07-05), duplicate stacking, and bug traps

Config changed: **deep_deck nerfed +15 → +8 per deck card** (sheet-only; code
parses the number from the effect text). **all_or_nothing increment reduced
+0.2 → +0.1 per trigger** (user edit). Round targets were rebalanced before
this session too (R1 = 450, R15 = 1900) — ignore Part I/II target numbers.

## 15. Full-run log (London `eu_1`, all 15 rounds WON, optimal-solver play)

| R | Target | Final | Hands | Notes |
|--:|-------:|------:|:-----:|-------|
| 1 | 450 | 580 | 2 | Perfect hand 1 = 430 — **one-hand clear now impossible** |
| 2 | 550 | 580 | 2 | crowd_pleaser died on first reappear flip |
| 3 | 650 | 670 | 2 | gold_star paid +0 on a purrfect (see §16) |
| 4 | 750 | 984 | 3 | nerfed deep_deck = +184; wild_dice missed (×1) |
| 5 | 875 | 1184 | 3 | catnip +150; encore did nothing visible |
| 6 | 1000 | 1034 | 1 | flat-add stack online: bb+qp+dd+catnip = +684 |
| 7 | 1100 | 1488 | 2 | **duplicate deep_deck bought & stacked: +184 ×2** |
| 8 | 1200 | 1678 | 2 | hand 1 = 1198/1200, so close |
| 9 | 1300 | 1466 | 1 | bought all_or_nothing (+0.1 era) |
| 10 | 1350 | 1504 | 1 | aon ×1.3 |
| 11 | 1450 | 1689 | 1 | treat_encore placed with 5 add treats: **+0** (see §16) |
| 12 | 1500 | 1692 | 1 | aon ×1.5 |
| 13 | 1600 | 1678 | 3 | 9% blocked cells → 2 imperfect boards; aon correctly SKIPPED |
| 14 | 1750 | 1905 | 1 | aon ×1.6 |
| 15 | 1900 | 1985 | 1 | aon ×1.7 — final margin only 4.5% vs maxed engine |

Economy: $10 start → **$245 end** with everything I wanted bought. Cash is
never the constraint — the **backpack is** (see §16).

## 16. Bug traps & mechanics discovered this run (verify before relying on)

- **Shop sells duplicates of treats you own.** Two deep_decks both trigger
  (+184 each, same hand). Best stacking line in the game right now.
- **Silent treat loss at round end.** `goShop` restores used treats via
  `bpAutoPlace`, which scans greedily with **no rotations** and **ignores
  failure** — a fragmented backpack ate my $10 wild_dice with zero feedback.
  Keep the backpack tidy; sell dead treats before round end. Buys also fail
  (`no-bp-room`) even with enough total free cells if they're fragmented.
- **gold_star can never count the purrfect fit it's placed in** — the
  purrfect counter increments in `doFit` *after* the treat scan runs (the
  sheet Explanation claims otherwise). Placed hand 1 it pays +0; place it
  hand 2+ after banking purrfects.
- **encore / treat_encore ignore Type B results.** Their re-fire wrappers
  handle `bonus`/`bonusMap`/`gids` (Type A) but not `scoreBonus` (Type B) —
  and nearly all flat adds (big_bite, deep_deck, quick_paws, catnip, milk,
  feather) are Type B. Both cards visibly did nothing across multiple hands.
- **50% reappear flips are brutal:** 4 of 6 flips this run killed the treat
  on first use (poker_face, crowd_pleaser, gold_star eventually).
- Blocked-cell probability (up to ~10% late) genuinely breaks perfect fills —
  hand shapes + blocked geometry made 2 of 3 hands imperfect in R13.

## 17. Post-nerf strategy that won 15/15

1. Rounds 1–5: buy the best cheap flat add each shop (poker_face, catnip,
   bench_warmer class); expect 2–3 hands per round; margins are thin — a
   perfect fill every hand matters (fill bonus ≈ 30–60% of a hand's value).
2. Round 6+: assemble the **flat-add stack** — big_bite (+200), quick_paws
   (+250 on hand 1 with London's 5 hands), deep_deck ×2 (+368), catnip — all
   pinned early/top-left, then **all_or_nothing pinned bottom-right** (×1.2
   growing +0.1/purrfect-trigger; it skips safely on imperfect boards).
3. Sell treats that don't earn their backpack cells (rainbow_row paid +0 in
   every single fit across both runs; encore/treat_encore are broken — skip).
4. The `PF` harness (v2, this session) handles duplicate treat ids in
   early/late/use lists and auto-schedules FIRST/LAST-HAND treats.

---

*Maintained by Claude. If you discover new treats, board behaviours, or better
strategies while playing, append them here for the next agent.*
