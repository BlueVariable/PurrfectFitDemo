# Design: Merge Rounds & Shop Screens

## Context

The game currently has two separate screens — `s-rounds` (round info + "PET STORE" button) and `s-shop` (full shop with backpack + treat cards). The user wants them merged into one screen so shop and round info are always visible together, eliminating the extra navigation step.

## Chosen Approach: Equal Split (Two-Column Layout)

Round info on the left, shop on the right. Both feel first-class. Natural left-to-right read order mirrors the game's flow: see round → buy treats → play.

## Layout

The combined screen reuses the `s-rounds` div, restyled to a two-column layout matching the current shop's dark aesthetic.

**Left column:**
- Top bar: `← Menu` button, `PURRFECT FIT` title, cash badge (`🪙 N`)
- Progress pips row
- Round card: round number, target score, earn amount, board size
- `▶ PLAY ROUND` button

**Right column:**
- "🏪 PET STORE" section header with first-visit quote
- Backpack grid (draggable) + inventory list with Sell buttons
- Three treat cards row + Reroll button

## Element ID Mapping

All shop render functions target the following IDs. The new HTML in `s-rounds` must use these exact IDs (shop IDs are kept as-is; rounds IDs that move into the new layout are reused):

| Old location | Old ID / class | New ID / class | Notes |
|---|---|---|---|
| s-shop left | `shop-cash` | `shop-cash` | Kept; cash badge moves to top bar of merged screen |
| s-shop center | `shop-bpg` | `shop-bpg` | Kept |
| s-shop center | `shop-bp-list` | `shop-bp-list` | Kept |
| s-shop right | `treats-row` | `treats-row` | Kept |
| s-shop right | `treats-reroll` | `treats-reroll` | Kept |
| s-shop right | `reroll-cost` | `reroll-cost` | Kept |
| s-shop right | `treats-flavor` | `treats-flavor` | Kept |
| s-shop left | `shop-sub` | `shop-sub` | Kept; first-visit quote |
| s-shop BP cells | `.sp-bpc` | `.sp-bpc` | Kept; drag-hover logic depends on this class |
| s-rounds | `rds-pips` | `rds-pips` | Kept |
| s-rounds | `rds-play-num` | `rds-play-num` | Kept |
| s-rounds | `rds-tgt` | `rds-tgt` | Kept |
| s-rounds | `rds-earn` | `rds-earn` | Kept |
| s-rounds | `rds-board` | `rds-board` | Kept |
| s-rounds | `rds-hint` | `rds-hint` | Kept (can be hidden or removed if unused) |
| s-rounds | `rds-cash` | **removed** | Cash is now rendered to `shop-cash` in the top bar |

`renderRoundsTrack()` currently writes to `rds-cash`. It must be updated to write to `shop-cash` instead. `openRounds()` currently sets `rds-cash`; same update.

## Files Modified

- `index.html` — replace `s-rounds` HTML with merged two-column layout; delete `s-shop` HTML entirely
- `js/render.js` — update `openRounds()` and `renderRoundsTrack()`; remove `openShopFromRounds()`; remove `showShopWarning()`; update `startRound()`
- `js/shop.js` — remove `openShop()` and `leaveShop()`; update `renderShopFull()` to remove `shop-cash` write (cash is set by `openRounds`); `generateShopPool()` called from `openRounds()`
- `js/scoring.js` — remove `G.firstShop = false` assignment from `goShop()` (it already calls `openRounds()` directly — no other change needed)
- `js/state.js` — remove `G.shopVisitedThisRound`; remove `G.firstShop`

## Functions Removed

| Function | File | Reason |
|---|---|---|
| `openShop()` | shop.js | Logic absorbed into `openRounds()` |
| `leaveShop()` | shop.js | No separate screen to leave |
| `openShopFromRounds()` | render.js | No longer needed |
| `showShopWarning()` | render.js | Warning removed (shop always visible) |

## State Changes

- `G.shopVisitedThisRound` — **removed**. Shop is always visible; the "you haven't visited the shop" warning in `startRound()` is deleted.
- `G.firstShop` — **removed**. Set in `startRound`, `goShop`, and `state.js` initialisation, but **never read anywhere** in the codebase (dead state). Safe to delete all three assignments and the initialisation without any downstream breakage.
- `G.visitedShop` — **kept**. Still used for the first-visit quote. Set to `true` inside `openRounds()` on first call (guarded by `if (!G.visitedShop)`), replacing the `openShop()` assignment.

## `shopBoughtIds` Reset

`shopBoughtIds = new Set()` currently runs inside `openShop()`. It moves to `openRounds()`, executing every time the combined screen opens (i.e. at round start and after winning a round via `goShop()`). This preserves the existing behavior: each shop visit (now each round) gets a fresh pool with no purchased treats shown.

## Quote Logic

`openShop()` currently sets `shop-sub` based on `G.round === 1 && !G.visitedShop`. This logic moves into `openRounds()`:

```
if (!G.visitedShop) → "stock up before the round!"
else → "back for more treats!"
```

This runs before `G.visitedShop` is set to `true`, so the first-visit message shows correctly on round 1.

## `startRound()` Changes

- Remove `G.shopVisitedThisRound` guard and `showShopWarning()` call
- Add: if `H.kind === 'shop-treat'`, cancel the held treat (drop it) before transitioning to `s-game` — same logic as `leaveShop()` currently uses

## `renderShopFull()` Changes

Remove the `g('shop-cash').textContent = G.cash` line from `renderShopFull()`. This is a cleanup: `openRounds()` / `renderRoundsTrack()` owns cash display by writing to `shop-cash`. Leaving the line in would cause a harmless double-write, but it should be removed for clarity. Note that `renderShopFull()` is also called mid-session by `rerollTreats()` and `shopDropOnBP()` — cash display will remain correct since `openRounds()` sets it on entry.

## `sellTreatFromShop`

`renderShopBPList()` renders sell buttons that call `sellTreatFromShop(gid)`. This function lives in `js/shop.js` and calls `renderShopFull()` at the end to refresh the UI. It does **not** reference any `s-shop`-specific elements — it writes to `G.cash` and `G.bpGroups`, then calls `renderShopFull()`. No changes are needed to this function; it will work correctly after the merge.

## `rds-hint` Placement

`rds-hint` is currently used to show "Visit the shop before playing!" warnings. Since `showShopWarning()` is removed, this element has no more content. Place it as a small text area beneath the PLAY button in the left column (or omit it entirely from the new HTML). If kept, it will always be empty.

## Screen Flow After Change

```
s-title → s-rounds (combined) → s-game → s-rounds (combined) → ...
```

`goShop()` in scoring.js already calls `openRounds()` directly — no path change needed there. `continueGame()` in render.js also calls `openRounds()` directly — no change needed.

## Verification

Open `index.html` in browser and verify:
- Round info and shop treats appear on the same screen at game start
- First round shows "stock up before the round!" quote; subsequent rounds show "back for more treats!"
- Buying a treat deducts cash; treat card disappears from pool
- Selling a treat refunds cash; sold treat can be re-purchased
- Reroll deducts $1 and shows 3 new treat cards
- Dragging a treat to backpack works; `.sp-bpc` hover highlights fire
- Clicking ▶ PLAY ROUND with a held shop-treat cancels the drag and starts the round
- After winning a round, the combined screen shows updated round number, new target, and fresh treat pool
- `continueGame()` (resume from title screen) opens the combined screen correctly
- `goShop()` (win overlay → continue) opens the combined screen with the next round's info
- Resuming a game mid-run and opening the combined screen shows correct round number and cash
