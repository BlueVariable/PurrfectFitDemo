'use strict';
// ══════════════════════════════════════════════════════
//  SIM: shared board/backpack scan + placement helpers
//
//  Used by all three bot profiles (js/sim/bots.js), the solver
//  (js/sim/solver.js) and the per-game harness (js/sim/engine.js). Every
//  function here takes the iframe's `win` (iframe.contentWindow — for
//  calling real game functions like rotC/boardCanPlace/bpCanAt, which are
//  plain function declarations and so ARE reachable as window properties)
//  and/or `bridge` (the injected SIM_BRIDGE — for reaching the game's
//  `let`-scoped G/H, see js/sim/bridge.js for why that indirection exists).
//
//  Placement is always done by re-using the REAL game functions
//  (pickupCat/pickupTreat/placeCatOnBoard/placeTreatOnBoard), overriding
//  the held piece's `cells`/`grabDr`/`grabDc` to the exact absolute cells
//  chosen by the bot with a (0,0) grab origin — the same "grab 0,0 + grid
//  built from absolute coordinates" trick documented in
//  AGENT_PLAYBOOK.md §7, which sidesteps `rotC` sometimes returning a grid
//  with leading empty rows/cols.
// ══════════════════════════════════════════════════════

function simCellCount(cells){
  return cells.reduce((s, row) => s + row.reduce((a, b) => a + (b ? 1 : 0), 0), 0);
}
function simCountFilled(board){ return board.flat().filter(c => c.filled).length; }
function simCountPlayable(board){ return board.flat().filter(c => !c.blocked && !c.offShape).length; }

// Normalize a 0/1 grid to its list of [dr,dc] cells, trimmed to (0,0)-origin
// and sorted row-major. Used to de-duplicate rotations of symmetric shapes.
function simNormCells(cells){
  const flat = [];
  cells.forEach((row, dr) => row.forEach((v, dc) => { if (v) flat.push([dr, dc]); }));
  const minR = Math.min(...flat.map(p => p[0]));
  const minC = Math.min(...flat.map(p => p[1]));
  return flat.map(p => [p[0] - minR, p[1] - minC]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

// All distinct rotations (0/90/180/270) of a shape, normalized + deduped.
function simRotationsFor(win, cellsBase){
  const seen = new Set(), out = [];
  for (let rot = 0; rot < 4; rot++){
    const nf = simNormCells(win.rotC(cellsBase, rot));
    const key = JSON.stringify(nf);
    if (!seen.has(key)){ seen.add(key); out.push(nf); }
  }
  return out;
}

// Build a compact 0/1 grid (grab origin (0,0)) from a list of absolute
// [r,c] board cells, plus the grid's top-left board coordinate.
function simGridFromAbsCells(absCells){
  const rs = absCells.map(a => a[0]), cs = absCells.map(a => a[1]);
  const minR = Math.min(...rs), minC = Math.min(...cs);
  const maxR = Math.max(...rs), maxC = Math.max(...cs);
  const grid = Array.from({ length: maxR - minR + 1 }, () => Array(maxC - minC + 1).fill(0));
  absCells.forEach(([r, c]) => { grid[r - minR][c - minC] = 1; });
  return { grid, minR, minC };
}

// First legal (anchor, rotation) for a piece, scanning anchors in row-major
// board order and, at each anchor, all 4 rotations in order. Matches the
// greedy bot's documented policy ("try all 4 rotations at every anchor in
// scan order, place at the FIRST legal position").
function simFindFirstLegalPlacement(win, bridge, cellsBase){
  const G = bridge.getG();
  for (let r = 0; r < G.bsr; r++){
    for (let c = 0; c < G.bsc; c++){
      for (let rot = 0; rot < 4; rot++){
        const cells = win.rotC(cellsBase, rot);
        if (win.boardCanPlace(cells, r, c)) return { r, c, rot, cells };
      }
    }
  }
  return null;
}

// Every legal (anchor, rotation) for a piece — used by the casual bot to
// pick a uniformly random legal placement.
function simFindAllLegalPlacements(win, bridge, cellsBase){
  const G = bridge.getG();
  const out = [];
  for (let r = 0; r < G.bsr; r++){
    for (let c = 0; c < G.bsc; c++){
      for (let rot = 0; rot < 4; rot++){
        const cells = win.rotC(cellsBase, rot);
        if (win.boardCanPlace(cells, r, c)) out.push({ r, c, rot, cells });
      }
    }
  }
  return out;
}

function simHasAnyLegalPlacement(win, bridge, cellsBase){
  const G = bridge.getG();
  for (let rot = 0; rot < 4; rot++){
    const cells = win.rotC(cellsBase, rot);
    for (let r = 0; r < G.bsr; r++){
      for (let c = 0; c < G.bsc; c++){
        if (win.boardCanPlace(cells, r, c)) return true;
      }
    }
  }
  return false;
}

// Place a single hand cat at the given absolute cells via the real game
// functions (pickupCat sets up H with the right color/em/handIdx/source,
// then we override cells/grab so placeCatOnBoard lands exactly on absCells).
function simPlaceCatAtAbsCells(win, bridge, catId, absCells){
  const G = bridge.getG();
  const idx = G.hand.findIndex(h => h.id === catId);
  if (idx < 0) return false;
  win.pickupCat(idx);
  const H = bridge.getH();
  const { grid, minR, minC } = simGridFromAbsCells(absCells);
  H.cells = grid; H.grabDr = 0; H.grabDc = 0;
  win.placeCatOnBoard(minR, minC);
  return true;
}

// Place a backpack treat (by gid) at the given absolute cells. Routes
// through the real pickupTreat() (which removes it from the backpack) —
// see AGENT_PLAYBOOK.md §7 "placing a treat does not remove it from
// G.bpGroups; you must pickupTreat() first".
function simPlaceTreatAtAbsCells(win, bridge, gid, absCells){
  const G = bridge.getG();
  const grp = G.bpGroups.find(g => g.gid === gid);
  if (!grp) return false;
  G.selBpGid = gid;
  win.pickupTreat();
  const H = bridge.getH();
  const { grid, minR, minC } = simGridFromAbsCells(absCells);
  H.cells = grid; H.grabDr = 0; H.grabDc = 0;
  win.placeTreatOnBoard(minR, minC);
  return true;
}

// Shared shop-buy mechanic (identical for every bot; bots differ only in
// WHICH treat they choose to buy). Mirrors the real drag-buy path exactly:
// shopPickupTreat -> scan backpack cells for a legal spot -> shopDropOnBP,
// or dropHeld() + record a failed buy if nothing fits.
function simAttemptBuy(win, bridge, td, roundLog){
  const G = bridge.getG();
  if (G.cash < td.pr) return false;
  win.shopPickupTreat(td);
  const H = bridge.getH();
  if (!H || H.kind !== 'shop-treat') return false;
  H.grabDr = 0; H.grabDc = 0;
  const R = win.getBPR(), C = win.getBPC();
  for (let r = 0; r < R; r++){
    for (let c = 0; c < C; c++){
      if (win.bpCanAt(H.cells, r, c)){
        win.shopDropOnBP(r, c);
        roundLog.treatsBought.push(td.id);
        return true;
      }
    }
  }
  win.dropHeld();
  roundLog.treatsFailedBuy.push(td.id);
  return false;
}

function simIdMultiset(list, getId){
  const m = {};
  list.forEach(x => { const id = getId(x); m[id] = (m[id] || 0) + 1; });
  return m;
}
