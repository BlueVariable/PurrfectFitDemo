# Purrfect Fit — Claude Code Handoff Context

## What This Is
A single-file browser game (`purrfect-fit-demo.html`) — a Tetris-meets-Balatro tile placement puzzle.
Players place cat-shaped pieces on a grid board, place treat tiles as score modifiers, then hit "FIT!" 
to score. Game progresses through rounds with increasing board sizes and score targets.
Between rounds players visit a shop to buy treats using coins earned from winning rounds.

All game configuration (rounds, treats, decks, cat types, shapes) is loaded at runtime from 
**Google Sheets** via an Apps Script JSON relay. There is a full embedded fallback if sheets fail.

---

## File Structure
Single HTML file (~2480 lines):
- Lines 1–686: CSS (all inline in `<style>`)
- Lines 687–2485: JavaScript (all inline in `<script>`)
- Screens are `<div class="scr">` elements toggled with `.on` class

### Screens
| ID | Description |
|----|-------------|
| `s-loading` | Shown on boot while sheets load |
| `s-title` | Title/deck selection screen |
| `s-rounds` | Between-round hub (round info, shop button, play button) |
| `s-game` | Main gameplay screen |
| `s-shop` | Shop screen |
| `ov-win` | Round win overlay |
| `ov-fail` | Round fail overlay |
| `ov-deck` | Deck preview popup |
| `ov-score-seq` | Animated scoring sequence overlay |

---

## Key External Resources
- **Google Sheet**: https://docs.google.com/spreadsheets/d/1qEr42p9HsQFPrBip1TqYB2DBehKPgyT_e0CwmNP_Cd4/
- **Apps Script relay**: https://script.google.com/macros/s/AKfycbzwbOwIorizFvR5NR1gw5I4ZWCt34MLlcpszclCPyt1NKJgSu_Ad9c-5Z835ILd2hmN/exec
  - Called as `?sheet=Sheet+Name` → returns JSON array of row objects
- **Fonts**: Fredoka One (headings/numbers), Nunito (body) via Google Fonts

---

## Google Sheets Structure

### General Config
| Setting | Value |
|---------|-------|
| hand_count | 7 |
| discard_count | 3 |
| deck_card_count | 30 |
| starting_cash | 5 |
| reroll_cost | 1 |
| base_score_per_cell | 10 |
| board_fill_bonus | 5 |
| backpack_rows | 4 |
| backpack_cols | 4 |

### Rounds Config
Columns: `Target Score`, `Board Rows`, `Board Cols`, `Earn (coins)`, `Hands per Round`
(Also accepts legacy `Board Size` for square boards)

### Cat Types
Columns: `Type`, `Color (hex)`, `Emoji`
Populates `COLS` and `EMS` maps.

### Treats
Columns: `ID`, `Name`, `Emoji`, `Rarity`, `Phase`, `Effect`, `BP Shape`, `Buy Price`, `Sell Price`, `Requirement`, `Flavor`
- `Phase`: `add` or `mul`
- `BP Shape`: e.g. `1×1`, `1×2`, `2×2`
- `Rarity`: common / rare / epic / legendary
- `Requirement`: `NO OTHER TREAT`, `NEEDS ORANGE`, `ALL SAME TYPE`, or empty

### Decks Config
Columns: `Deck ID`, `Deck Name`, `Emoji`, `Description`, `Cat Types (pool)`, `Shapes (pool, 30 cards cycling)`
- Types and shapes are comma-separated

### Cat Shapes (optional)
Columns: `Shape Name`, `Grid (rows, comma-sep)`
- Grid format: rows separated by `|`, cells by `,`
- Example: `1,1,1|0,1,0` → T-shape
- If sheet missing, falls back to hardcoded `CSHAPES`

---

## Global Variables

### Config (populated by loadConfig)
```js
let TDEFS = [];      // treat definitions array
let COLS  = {};      // {type: hexColor}
let EMS   = {};      // {type: emoji}
let DECKS = {};      // {deckId: {ty:[...], sh:[...]}}
let RCFG  = [];      // [{tgt, bsr, bsc, earn, h}, ...] one per round
let CFG   = {};      // general config key/value map
const DECK_META = {} // {deckId: {name, em, desc}} — seeded with defaults, overwritten by sheet
```

### Runtime State
```js
let G = {
  round,          // current round number (1-indexed)
  score,          // score this round
  tgt,            // target score to win round
  bsr, bsc,       // board rows, board cols
  earn,           // coins earned on round win
  hands,          // hands remaining this round
  disc,           // discards remaining this hand
  cash,           // player's coin balance
  deckId,         // active deck ID string
  deck,           // remaining draw pile [{id,name,type,shape,cells,col,em}]
  hand,           // current hand [{id,name,type,shape,cells,col,em}]
  board,          // G.bsr×G.bsc 2D array of cell objects
  cats,           // placed cat groups [{cells,col,shape,type,cat,gid}]
  treats,         // placed board treats [{cells,gid,tdef}]
  bp,             // getBPR()×getBPC() 2D array of BP cell objects
  bpGroups,       // [{gid, tdef, cells:[...]}]
  lastScore,      // score from last scored hand
  selBpGid,       // selected BP group gid (for tooltip)
  firstShop,      // bool
  visitedShop,    // bool — has player visited shop at least once
  shopVisitedThisRound, // bool
  newCardIndices, // Set of hand indices for deal animation
}

let H = {          // HELD — what cursor is carrying
  kind,            // null | 'cat' | 'treat' | 'shop-treat'
  source,          // 'hand' | 'board' | 'bp' | 'shop'
  data,            // the cat or tdef object
  cells,           // current rotated cell grid (2D array)
  rot,             // rotation index 0–3
  color,           // hex color string
  em,              // emoji string
  handIdx,         // index in G.hand (cats only)
  boardGid,        // gid if picked up from board
  bpGid,           // gid if picked up from backpack
  grabDr, grabDc,  // grab offset within shape (for placement anchoring)
  dragging,        // bool — true if mouse-dragged vs clicked
  _lastBoardR,     // last hovered board row (for rotate re-preview)
  _lastBoardC,
  _lastBpR,        // last hovered BP row
  _lastBpC,
}

let gameInProgress = false;
let curDeck = 'classic';
```

### Board Cell Object
```js
// empty:
{ filled:false, col:null, kind:null, em:null, gid:null, shape:null, type:null }
// filled:
{ filled:true, col:'#hex', kind:'cat'|'treat', em:'emoji', gid:'uid', shape:'L'|null, type:'orange'|null }
```
Use `emptyCell()` helper to create an empty cell.

### BP Cell Object
```js
{ filled:false, col:null, em:null, gid:null, tdef:null }
// filled:
{ filled:true, col:'#hex', em:'emoji', gid:'uid', tdef: <treat def> }
```

### Treat Definition Object (`TDEFS` entries)
```js
{
  id,    // string key e.g. 'milk'
  nm,    // display name
  em,    // emoji
  rar,   // 'common'|'rare'|'epic'|'legendary'
  col,   // rarity-based hex color
  phase, // 'add' | 'mul'
  bpS,   // backpack shape 2D array e.g. [[1,1],[1,0]]
  ef,    // effect string e.g. '+8 to ALL cats'
  req,   // requirement string or ''
  pr,    // buy price (coins)
  sp,    // sell price (coins)
  fl,    // flavor text
  fn,    // scoring function (see Scoring Engine below)
}
```

---

## Key Functions Reference

### Initialization
| Function | Description |
|----------|-------------|
| `loadConfig()` | Boot: fetches all sheets, falls back after 3s on failure |
| `loadConfigData(onStatus?)` | Core fetch logic, shared by boot and reload button |
| `loadFallbackConfig()` | Hardcoded data used when sheets unavailable |
| `reloadConfig()` | Title-screen ↺ button — re-fetches all sheets live |
| `newGame(deckId)` | Initializes G state for a fresh game |
| `mkDeck()` | Builds and shuffles G.deck from DECKS config |
| `dealHand()` | Fills hand to hand_count, resets board, clears H |
| `mkBoard()` | Creates fresh G.board grid |

### Game Flow
| Function | Description |
|----------|-------------|
| `startGame()` | Play button → newGame + openRounds |
| `openRounds()` | Shows rounds hub screen |
| `startRound()` | Rounds hub → game screen (warns if shop not visited) |
| `openShop()` | Opens shop screen |
| `leaveShop()` | Returns to rounds hub |
| `goShop()` | After round win: advance round, reset state, go to rounds |
| `roundWin()` | Score ≥ target: show win overlay |
| `roundFail()` | Hands exhausted without hitting target |
| `restart()` | Fail overlay → title screen |
| `doFit()` | Score button: run scoring sequence |
| `endScoreSequence(total)` | After animation: decrement hands, check win/fail/continue |

### Held Item Mechanics
| Function | Description |
|----------|-------------|
| `resetH()` | Returns a fresh empty H object |
| `pickupCat(idx)` | Click a hand card |
| `pickupCatWithGrab(idx,dr,dc)` | Mousedown drag from hand card |
| `pickupCatFromBoard(r,c)` | Click a placed cat to lift it |
| `pickupTreat()` | "Place on board" button from BP tooltip |
| `dropHeld()` | Cancel/escape — returns item to origin |
| `rotate()` | R key or right-click — rotate held item 90° CW |
| `placeCatOnBoard(r,c)` | Place held cat at board position |
| `placeTreatOnBoard(r,c)` | Place held treat at board position |

### Board Interaction
| Function | Description |
|----------|-------------|
| `onBoardClick(r,c)` | Click on board cell |
| `onBoardEnter(r,c)` | Hover — show placement preview |
| `onBoardLeave()` | Clear preview |
| `boardCanPlace(cells,r,c)` | Check if shape fits at offset |
| `clrBoardPrev()` | Clear ok/bad highlight classes |
| `getBCell(r,c)` | Get board DOM cell element |

### Backpack Interaction
| Function | Description |
|----------|-------------|
| `onBPEnter(r,c)` | Hover — show BP placement preview |
| `onBPMouseUp(r,c)` | Drop treat onto BP cell |
| `bpAutoPlace(tdef)` | Find first available BP slot and place |
| `bpCanAt(cells,r,c)` | Check if shape fits at BP offset |
| `bpCanFit(shape)` | Any slot available for shape? |
| `bpPlaceAt(tdef,cells,r,c)` | Place treat at specific BP position |
| `removeBpGid(gid)` | Remove treat group from BP |
| `getBPCell(r,c)` | Get BP DOM cell element |
| `getBPR()` | Backpack rows (from CFG) |
| `getBPC()` | Backpack cols (from CFG) |

### Rendering
| Function | Description |
|----------|-------------|
| `renderAll()` | renderStats + renderBoard + renderHand + renderBP + updFit |
| `renderBoard()` | Rebuild board DOM |
| `renderHand()` | Rebuild hand DOM |
| `renderBP()` | Rebuild game-screen BP DOM |
| `renderStats()` | Update stat displays (score, hands, etc.) |
| `renderShopFull()` | Rebuild entire shop screen |
| `renderShopBPGrid()` | Shop BP grid |
| `renderShopBPList()` | Shop inventory list with sell buttons |
| `renderTreatsRow()` | Shop treat cards |
| `renderRoundsTrack()` | Rounds hub pips and stats |
| `updateGhost()` | Rebuild cursor ghost shape |
| `shpHTML(cells,col,sz)` | Generate shape preview HTML |
| `initDeckCarousel()` | Build deck selection carousel from DECKS |
| `renderDeckCarousel()` | Update carousel scroll/selection/dots |

### Scoring Engine
```
doFit() flow:
  1. Base scores: catScores[gid] = cells.length × CFG.base_score_per_cell
  2. Add phase: for each add-treat, call tdef.fn() → {bonus, desc}
                applyAddResult() distributes bonus to affected cats
                (each affected cat gets amt × its own cell count)
  3. Mul phase: for each mul-treat, call tdef.fn() → {gids:[], m:N}
                applyMulResult() multiplies catScores[gid] by m
  4. Board fill bonus: if ALL cells filled → bsr×bsc × CFG.board_fill_bonus
  5. Total = sum(catScores) + boardBonus
  6. runScoreSequence() animates each step
  7. endScoreSequence() → decrement hands, check win/fail
```

#### Add Treat fn signature:
```js
fn(board, cats, treats, treatPos, catScores) → { bonus: N, desc: string }
```
#### Mul Treat fn signature:
```js
fn(board, cats, treats, treatPos, catScores) → { gids: [...], m: N }
```

#### Add helpers:
- `allAdd(cats, amt)` — all cat cells × amt
- `rowAdd(board, pos, amt)` — cat cells in same row × amt
- `colAdd(board, pos, amt)` — cat cells in same col × amt
- `surrAdd(board, pos, amt)` — cat cells in adjacent groups × amt

#### Mul helpers:
- `allMulCS(cats, catScores, m)` — all cats × m
- `colMul(board, cats, pos, m)` — cats in same col × m
- `surrMulCS(board, cats, pos, m, catScores)` — adjacent cats × m
- `shapeMul(cats, shapes[], m)` — cats with matching shape × m

### Treat Requirements (checked at scoring and display time)
```js
treatReqFails(tdef) → bool
// 'NO OTHER TREAT' → fails if G.treats.length > 1
// 'NEEDS ORANGE'   → fails if no orange cat on board
// 'ALL SAME TYPE'  → fails if more than one cat type on board
```

### Utilities
| Function | Description |
|----------|-------------|
| `rotC(cells, rot)` | Rotate 2D cell grid 0–3 times CW |
| `sfl(array)` | Fisher-Yates shuffle in-place |
| `cap(str)` | Capitalize first letter |
| `g(id)` | `document.getElementById` alias |
| `uid()` | Random 7-char alphanumeric ID |
| `mk2d(r,c,init)` | Create r×c 2D array with init function |
| `emptyCell()` | Empty board cell object |
| `extractNum(ef)` | Parse `+N` from effect string |
| `extractMul(ef)` | Parse `×N` from effect string |
| `parseBpShape(str)` | Parse `"2×3"` → `[[1,1,1],[1,1,1]]` |
| `rarCol(rar)` | Rarity string → hex color |
| `buildTreatFn(id,ef,phase)` | Build scoring fn from sheet effect string |

---

## Input / Event Model

### Global listeners (document level)
- `contextmenu` → `rotate()`
- `keydown` R/r → `rotate()`
- `keydown` Escape → `dropHeld()`
- `keydown` ArrowLeft/Right → deck nav (title screen only)
- `mouseup` (left) → unified drag-drop handler for cats and treats
- `mousemove` → ghost follows cursor

### Drag-drop flow
1. `mousedown` on card/BP cell → set `H.dragging=true`, build H state
2. `mousemove` → `updateGhost()` moves ghost element
3. `mouseenter` on board/BP cells → show placement preview (ok/bad highlights)
4. `mouseup` on board → find cell under cursor, call `placeTreatOnBoard()` or return to BP
5. `mouseup` on BP cell → `onBPMouseUp()` or `shopDropOnBP()`
6. `mouseup` outside all targets → return item to origin

---

## CSS Variables
```css
--bg: #9aa5b8      /* page background */
--panel: #fff      /* card/panel background */
--navy: #4a5a8a    /* primary dark blue */
--navy2: #3a4a7a   /* darker navy (shadows) */
--bbg: #7a8aaa     /* board background */
--bborder: #5878c8 /* board border/accent */
--cbg: #eef0f8     /* empty cell background */
--cborder: #c8d0e8 /* empty cell border */
--or: #f5a623      /* orange/gold (coins, earnings) */
--or2: #d88a10     /* orange shadow */
--gr: #72cc60      /* green (play buttons, win) */
--gr2: #52a840     /* green shadow */
--co: #e8785a      /* coral (round counter, discard) */
--pk: #f060a8      /* pink (treat names) */
--ye: #f5d020      /* yellow (selected treats) */
--re: #e04848      /* red (error, danger) */
--tx: #1a2236      /* primary text */
--mu: #6a7a9a      /* muted text */
```

---

## Known Patterns / Conventions

- **All config values have fallbacks**: `CFG.hand_count||7`, `CFG.base_score_per_cell||10`, etc.
- **Sheet column names are read defensively**: tries multiple spellings e.g. `r['Effect']||r['Effect ']||''`
- **GIDs**: every placed group (cat or treat, on board or BP) gets a `uid()` string as its group ID
- **Rotation**: `H.rot` is 0–3; `rotC(cells, rot)` applies CW rotations
- **Grab offset**: `H.grabDr/grabDc` = which cell within the shape the user grabbed, so placement anchors to that cell under the cursor
- **Two board placement paths**: click (`onBoardClick`) and drag-drop (`document mouseup`) — both call `placeCatOnBoard`/`placeTreatOnBoard`
- **Shop treat kind**: `H.kind='shop-treat'` while dragging from shop; becomes permanent in BP only on `shopDropOnBP` success
- **Score sequence**: `runScoreSequence()` is purely visual; all math is done in `doFit()` before it's called
- **`G.treats` is board treats only** (placed this hand); backpack treats are `G.bpGroups`
- **Round advance**: `goShop()` → increments `G.round`, resets `G.score=0`, rebuilds deck, clears cats/treats/hand, then `dealHand()`

---

## Recent Bug Fixes Applied (don't reintroduce)
1. `DECK_META` moved before `loadConfigData` (was in temporal dead zone)
2. `sellTreatFromShop` was calling `buildShop()` (non-existent) → fixed to `renderShopFull()`
3. `shopDropOnBP` rearrange path now applies grab offset before `bpCanAt`/`bpPlaceAt`
4. `goShop` now clears `G.cats`, `G.treats`, `G.hand` before `dealHand()` (prevented double-BP placement)
5. `animateCounter` now clears previous interval before starting (prevented overlapping score animations)
6. `placeCatOnBoard` and `placeTreatOnBoard` extracted as helpers (deduplication)
7. Board fill bonus, score sequence labels, and `showBoardTip` all use `CFG.base_score_per_cell` / `CFG.board_fill_bonus` instead of hardcoded values
8. `resetH()` and `emptyCell()` helpers defined before first use
9. `parseCSV` dead code removed

---

## Testing Locally
```bash
# Serve the file locally (required — fetch() won't work on file://)
python3 -m http.server 8080
# Then open http://localhost:8080/purrfect-fit-demo.html
```

If sheets are unreachable (network/CORS), the game auto-falls back to hardcoded data after 3 seconds.
The ↺ Reload Config button on the title screen re-fetches all sheets live.
