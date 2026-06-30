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

*Maintained by Claude. If you discover new treats, board behaviours, or better
strategies while playing, append them here for the next agent.*
