# Merge Rounds & Shop Screens Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the separate `s-rounds` and `s-shop` screens into one combined screen — round info on the left, shop on the right — eliminating the PET STORE navigation step.

**Architecture:** Replace the `s-rounds` HTML with a three-panel layout that reuses the shop's existing CSS classes (`.sp-left`, `.sp-center`, `.sp-right`). Move shop initialisation logic (`shopBoughtIds` reset, quote text, `G.visitedShop` flag) into `openRounds()`. Remove the now-dead `openShop()`, `leaveShop()`, `openShopFromRounds()`, and `showShopWarning()` functions.

**Tech Stack:** Vanilla JS, HTML/CSS — no build step. Open `index.html` directly in browser to verify.

**Spec:** `docs/superpowers/specs/2026-03-12-merge-rounds-shop-design.md`

---

## Chunk 1: HTML — Replace s-rounds, Delete s-shop

### Task 1: Replace `s-rounds` HTML with merged layout

**Files:**
- Modify: `index.html` (lines 76–112 replace `s-rounds`, lines 181–223 delete `s-shop`)

The new `s-rounds` reuses the shop's three-panel structure (`.sp-left` / `.sp-center` / `.sp-right`) so the existing shop CSS applies without changes. The left panel contains round info instead of the shop's title/mascot. All required element IDs are preserved.

- [ ] **Step 1: Replace the `s-rounds` block (lines 76–112) with the merged layout**

  Delete from `<!-- ROUNDS SCREEN -->` through the closing `</div>` of `s-rounds` and replace with:

  ```html
  <!-- ROUNDS / SHOP (combined) -->
  <div id="s-rounds" class="scr">
    <!-- LEFT: round info -->
    <div class="sp-left">
      <div class="sp-topbar">
        <button class="sp-back" onclick="exitToMenu()">← Menu</button>
        <div class="rds-title">PURRFECT FIT</div>
        <div class="sp-mon">
          <span class="sp-mon-val"><span class="sp-coin">🪙</span><span id="shop-cash">0</span></span>
        </div>
      </div>
      <div class="sp-quote" id="shop-sub">"stock up before the round!"</div>
      <div class="rds-pip-row" id="rds-pips"></div>
      <div class="rds-round-card">
        <div class="rds-rc-label">ROUND</div>
        <div class="rds-rc-num" id="rds-play-num">1</div>
        <div class="rds-rc-stats">
          <div class="rds-rc-stat"><div class="rds-rc-sv" id="rds-tgt">180</div><div class="rds-rc-sl">Target</div></div>
          <div class="rds-rc-div"></div>
          <div class="rds-rc-stat"><div class="rds-rc-sv" id="rds-earn">+$4</div><div class="rds-rc-sl">Earn</div></div>
          <div class="rds-rc-div"></div>
          <div class="rds-rc-stat"><div class="rds-rc-sv" id="rds-board">4×4</div><div class="rds-rc-sl">Board</div></div>
        </div>
      </div>
      <button class="rds-btn-play" onclick="startRound()">▶ PLAY ROUND</button>
      <div class="rds-hint" id="rds-hint"></div>
    </div>

    <!-- CENTER: backpack -->
    <div class="sp-center">
      <div class="sp-bp-card">
        <div class="sp-bp-hdr">BACKPACK</div>
        <div class="sp-bp-gw"><div class="sp-bpg" id="shop-bpg"></div></div>
        <div class="sp-bp-cap">"bag full of purr-fection"</div>
      </div>
      <div class="sp-bp-inv">
        <div class="sp-bp-inv-hdr">— IN BACKPACK —</div>
        <div class="sp-inv-list" id="shop-bp-list"></div>
      </div>
    </div>

    <!-- RIGHT: treat sections -->
    <div class="sp-right">
      <div class="treat-section blue" id="treats-section">
        <div class="treat-sec-hdr">
          <span class="treat-sec-lbl">TREATS</span>
          <button class="treat-reroll" id="treats-reroll" onclick="rerollTreats()">↺ REROLL <span id="reroll-cost">$1</span></button>
        </div>
        <div class="treat-sec-body">
          <div class="treat-row" id="treats-row"></div>
        </div>
        <div class="treat-sec-flavor" id="treats-flavor"></div>
      </div>
    </div>
  </div>
  ```

- [ ] **Step 2: Delete the `s-shop` block (lines 181–223)**

  Delete from `<!-- SHOP -->` through the closing `</div>` of `id="s-shop"`. The entire `s-shop` div is removed.

- [ ] **Step 3: Commit the HTML changes**

  > **Note:** Do NOT open the browser yet — the JS changes in Chunk 2 must also be applied before the screen will work correctly. In the intermediate state after this commit, `openRounds()` still writes to `rds-cash` (element gone) and `showShopWarning()` still references `.rds-btn-shop` (element gone), so JS errors are expected until Chunk 2 is complete. Apply Chunk 2 first, then do browser verification.

  ```bash
  git add index.html
  git commit -m "feat: replace s-rounds and s-shop with merged three-panel layout"
  ```

---

## Chunk 2: JS — Update Logic, Remove Dead Code

### Task 2: Clean up `state.js` — remove dead state

**Files:**
- Modify: `js/state.js` (line 34 in `newGame()`)

- [ ] **Step 1: Remove `firstShop` and `shopVisitedThisRound` from `newGame()`**

  In `js/state.js`, find the `G={...}` object in `newGame()`. Remove `firstShop:true,` and `shopVisitedThisRound:false,` from it. `visitedShop:false` stays.

  Before:
  ```js
  lastScore:0,selBpGid:null,firstShop:true,visitedShop:false,shopVisitedThisRound:false,newCardIndices:new Set(),purchasedTreatIds:new Set(),
  ```

  After:
  ```js
  lastScore:0,selBpGid:null,visitedShop:false,newCardIndices:new Set(),purchasedTreatIds:new Set(),
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add js/state.js
  git commit -m "refactor: remove dead firstShop and shopVisitedThisRound state"
  ```

---

### Task 3: Update `render.js` — rewrite `openRounds()`, clean up `startRound()`

**Files:**
- Modify: `js/render.js` (lines 116–176 for `openRounds`/`renderRoundsTrack`; lines 130–157 for removed functions; lines 131–143 for `startRound`)

- [ ] **Step 1: Rewrite `openRounds()` (render.js lines 116–129)**

  Replace the entire `openRounds` function. Note: the old `openRounds()` wrote a rotating quote to `rds-hint` (lines 124–127) — this is intentionally dropped; `rds-hint` will always be empty after the merge since `showShopWarning()` is also removed.

  ```js
  function openRounds(){
    shopBoughtIds=new Set();
    g('shop-sub').textContent=G.visitedShop?'"back for more treats!"':'"stock up before the round!"';
    G.visitedShop=true;
    shopPool=generateShopPool();
    renderShopFull();
    renderRoundsTrack();
    g('rds-play-num').textContent=G.round;
    show('s-rounds');
  }
  ```

- [ ] **Step 2: Update `renderRoundsTrack()` — write to `shop-cash` instead of `rds-cash`**

  `renderRoundsTrack()` currently does not write cash (that was `openRounds` line 123: `g('rds-cash').textContent=G.cash`). That line in `openRounds` is replaced by `renderShopFull()` which now owns cash display via `shop-cash`. So no change is needed to `renderRoundsTrack()` itself — the cash update happens through `renderShopFull()`.

  Verify `renderRoundsTrack()` (lines 158–176) has no reference to `rds-cash`. It doesn't — it only writes to `rds-pips`, `rds-play-num`, `rds-tgt`, `rds-earn`, `rds-board`. No change needed.

- [ ] **Step 3: Delete `openShopFromRounds()` (render.js line 130)**

  Remove this line entirely:
  ```js
  function openShopFromRounds(){openShop();}
  ```

- [ ] **Step 4: Rewrite `startRound()` (render.js lines 131–143)**

  Replace the entire `startRound` function:

  ```js
  function startRound(){
    if(H.kind==='shop-treat'){
      H=resetH();
      updateGhost();hideHUD();
    }
    show('s-game');renderAll();
  }
  ```

- [ ] **Step 5: Delete `showShopWarning()` (render.js lines 144–157)**

  Remove the entire `showShopWarning` function (all 14 lines from `function showShopWarning(){` through the closing `}`).

- [ ] **Step 6: Open browser — verify round screen opens correctly**

  Start a new game. The combined screen should show with "stock up before the round!" quote and correct round 1 stats. Click ▶ PLAY ROUND — game screen should open immediately (no warning). Return to verify subsequent rounds show "back for more treats!".

- [ ] **Step 7: Commit**

  ```bash
  git add js/render.js
  git commit -m "refactor: merge shop init into openRounds, remove dead warning functions"
  ```

---

### Task 4: Update `shop.js` — remove `openShop()`, `leaveShop()`, clean up `renderShopFull()`

**Files:**
- Modify: `js/shop.js` (lines 21–41 remove two functions; line 52 remove cash write)

- [ ] **Step 1: Delete `openShop()` (shop.js lines 21–31)**

  Remove the entire `openShop` function. Its logic now lives in `openRounds()`.

- [ ] **Step 2: Delete `leaveShop()` (shop.js lines 33–41)**

  Remove the entire `leaveShop` function. The held-treat cancel logic is now in `startRound()`.

- [ ] **Step 3: Verify the `shop-cash` write in `renderShopFull()` (shop.js line 52) is kept**

  `renderShopFull()` contains:
  ```js
  g('shop-cash').textContent=G.cash;
  ```

  **Do not remove this line.** The spec says to remove it, but that is an error in the spec. `renderShopFull()` is called by `rerollTreats()` and `shopDropOnBP()` after each cash deduction — this line keeps the cash badge current after every buy and reroll. Removing it would leave the badge stale. The `shop-cash` element now lives in `s-rounds`, so this write is correct and necessary.

- [ ] **Step 4: Open browser — verify shop functionality**

  Start a new game. On the combined screen:
  - Cash badge shows starting cash
  - Three treat cards appear
  - Drag a treat to backpack — it should place and deduct cash
  - Click Sell — cash should refund, treat should disappear from backpack
  - Click ↺ REROLL — new treats should appear, $1 deducted

- [ ] **Step 5: Commit**

  ```bash
  git add js/shop.js
  git commit -m "refactor: remove openShop/leaveShop, clean up renderShopFull cash write"
  ```

---

### Task 5: Update `scoring.js` — remove dead `G.firstShop` assignment

**Files:**
- Modify: `js/scoring.js` (`goShop()` function — find the `G.firstShop=false` line)

- [ ] **Step 1: Remove `G.firstShop=false` from `goShop()`**

  Find `goShop()` in `js/scoring.js`. It contains `G.firstShop=false;` — delete that line. `goShop()` already calls `openRounds()` at the end; no other changes needed.

- [ ] **Step 2: Open browser — verify win flow**

  Play a round and score above target. Win overlay appears. Click "Visit Pet Store 🏪" — the combined screen should open with the next round's info and a fresh treat pool. Quote should say "back for more treats!".

- [ ] **Step 3: Commit**

  ```bash
  git add js/scoring.js
  git commit -m "refactor: remove dead G.firstShop assignment from goShop"
  ```

---

## Final Verification

Open `index.html` and run through all paths:

- [ ] New game → combined screen shows round info + shop on same screen
- [ ] First round: quote says "stock up before the round!"
- [ ] Round 2+: quote says "back for more treats!"
- [ ] Buy treat: cash deducts, treat disappears from pool, appears in backpack
- [ ] Sell treat: cash refunds, treat reappears as purchasable
- [ ] Reroll: $1 deducted, 3 new treats shown
- [ ] Drag treat to backpack, `.sp-bpc` hover highlights appear
- [ ] Click ▶ PLAY ROUND while holding shop treat: drag cancels, game starts
- [ ] Click ▶ PLAY ROUND normally: game starts immediately (no warning)
- [ ] Win round → "Visit Pet Store 🏪" → combined screen shows next round + fresh pool
- [ ] Continue Game from title → combined screen opens at current round
- [ ] Exit to Menu and resume → correct round and cash shown
