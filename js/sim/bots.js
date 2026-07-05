'use strict';
// ══════════════════════════════════════════════════════
//  SIM: bot profiles — solver / greedy / casual
//
//  Each bot implements:
//    shopPhase(ctx)          — buy/skip decisions for the current shop visit
//    playHand(ctx)           — place cats (+ maybe treats) for the current
//                               hand; does NOT call doFit() itself (the
//                               harness in js/sim/engine.js does that once,
//                               after ensuring at least one cat can/did get
//                               placed — see simEnsurePlaceable there).
//    pickDiscardIndex(G,rng) — which hand index to discard when the
//                              harness's universal "nothing fits, burn a
//                              discard" fallback kicks in (see task spec:
//                              "All bots: always place at least one cat
//                              before calling doFit... if literally no hand
//                              cat fits anywhere, burn a discard if
//                              available; if none remain, abort").
//
//  ctx = { win, bridge, rng, roundLog } — `roundLog` is the same object for
//  every call within one round (shopPhase, then one playHand per hand of
//  that round), so bots may stash private per-round scratch state on it
//  under an underscore-prefixed key (see greedy's `_boughtIdsThisVisit`).
// ══════════════════════════════════════════════════════

const SIM_BOTS = {};

// ── solver ("perfect") ──────────────────────────────────────────────────
const SIM_SOLVER_SHOP_PRIORITY = [
  'big_bite', 'quick_paws', 'deep_deck', 'catnip',
  'bench_warmer', 'poker_face', 'all_or_nothing', 'morning_stretch'
];

SIM_BOTS.solver = {
  shopPhase(ctx){
    const { win, bridge, roundLog } = ctx;
    const pool = bridge.getShopPool();
    SIM_SOLVER_SHOP_PRIORITY.forEach(id => {
      const td = pool.find(t => t.id === id);
      if (!td) return;
      const G = bridge.getG();
      if (G.cash < td.pr || !win.bpCanFit(td.bpS)) return;
      simAttemptBuy(win, bridge, td, roundLog);
    });
  },
  playHand(ctx){
    const { win, bridge } = ctx;
    const solution = simSolveHand(win, bridge);
    simApplySolution(win, bridge, solution);
  },
  pickDiscardIndex(G){
    // No proactive discard strategy is specified for the solver beyond the
    // universal "nothing fits" fallback (playbook §7's "discard only to
    // complete a fill" tactic is out of scope here) — discard the smallest
    // hand piece, since it's the least likely to be pulling its own weight.
    let idx = 0, best = Infinity;
    G.hand.forEach((cat, i) => { const s = simCellCount(cat.cells); if (s < best){ best = s; idx = i; } });
    return idx;
  }
};

// ── greedy ("decent player, ~80% fills") ────────────────────────────────
SIM_BOTS.greedy = {
  shopPhase(ctx){
    const { win, bridge, roundLog } = ctx;
    const pool = bridge.getShopPool();
    const G = bridge.getG();
    const affordable = pool.filter(td => G.cash >= td.pr && win.bpCanFit(td.bpS));
    if (!affordable.length) return;
    affordable.sort((a, b) => a.pr - b.pr);
    const td = affordable[0];
    if (simAttemptBuy(win, bridge, td, roundLog)){
      ctx._boughtIdsThisVisit = (ctx._boughtIdsThisVisit || []).concat(td.id);
    }
  },
  playHand(ctx){
    const { win, bridge } = ctx;
    // Cats: largest-first, first legal position (all 4 rotations tried at
    // every anchor in scan order).
    let guard = 0;
    while (true){
      guard++; if (guard > 60) break;
      const G = bridge.getG();
      if (!G.hand.length) break;
      const sorted = [...G.hand].sort((a, b) => simCellCount(b.cells) - simCellCount(a.cells));
      let placedAny = false;
      for (const cat of sorted){
        const pl = simFindFirstLegalPlacement(win, bridge, cat.cells);
        if (pl){
          simPlaceCatAtAbsCells(win, bridge, cat.id, simAbsFromAnchor(pl));
          placedAny = true;
          break;
        }
      }
      if (!placedAny) break;
    }
    // Treats bought this shop visit: same first-legal-position policy,
    // tried after cats. Self-limiting across the round's hands — once a
    // treat is placed it leaves G.bpGroups until the round ends.
    const ids = ctx._boughtIdsThisVisit || [];
    ids.forEach(id => {
      const G = bridge.getG();
      const grp = G.bpGroups.find(g => g.tdef.id === id);
      if (!grp) return;
      const pl = simFindFirstLegalPlacement(win, bridge, grp.tdef.bpS);
      if (!pl) return;
      simPlaceTreatAtAbsCells(win, bridge, grp.gid, simAbsFromAnchor(pl));
    });
  },
  pickDiscardIndex(G){
    // "never discards" describes greedy's normal play; this is only ever
    // consulted by the harness's emergency fallback (nothing fits at all).
    let idx = 0, worst = Infinity;
    G.hand.forEach((cat, i) => { const s = simCellCount(cat.cells); if (s < worst){ worst = s; idx = i; } });
    return idx;
  }
};

// ── casual ("~65% fills") ────────────────────────────────────────────────
const SIM_CASUAL_STOP_FILL_RATIO = 0.7;
const SIM_CASUAL_STOP_PROB = 0.5; // once >= ratio filled, roll this each step
const SIM_CASUAL_PRESHOP_DISCARD_PROB = 0.25;
const SIM_CASUAL_SHOP_BUY_PROB = 0.5;

SIM_BOTS.casual = {
  shopPhase(ctx){
    const { win, bridge, rng, roundLog } = ctx;
    if (rng.next() >= SIM_CASUAL_SHOP_BUY_PROB) return;
    const pool = bridge.getShopPool();
    const G = bridge.getG();
    const affordable = pool.filter(td => G.cash >= td.pr && win.bpCanFit(td.bpS));
    if (!affordable.length) return;
    const pick = affordable[Math.floor(rng.next() * affordable.length)];
    simAttemptBuy(win, bridge, pick, roundLog);
  },
  playHand(ctx){
    const { win, bridge, rng } = ctx;
    // Occasionally burn a discard on a random hand piece before placing.
    if (rng.next() < SIM_CASUAL_PRESHOP_DISCARD_PROB){
      const G = bridge.getG();
      if (G.disc > 0 && G.hand.length > 0){
        const idx = Math.floor(rng.next() * G.hand.length);
        win.pickupCat(idx);
        win.doDiscard();
      }
    }
    let guard = 0;
    while (true){
      guard++; if (guard > 80) break;
      const G = bridge.getG();
      if (!G.hand.length) break;
      const filled = simCountFilled(G.board), playable = simCountPlayable(G.board);
      if (playable > 0 && (filled / playable) >= SIM_CASUAL_STOP_FILL_RATIO && rng.next() < SIM_CASUAL_STOP_PROB) break;
      // Random legal placement: shuffle hand order, take the first piece
      // that has any legal spot, then pick a uniformly random legal spot.
      const order = [...Array(G.hand.length).keys()];
      for (let i = order.length - 1; i > 0; i--){
        const j = Math.floor(rng.next() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      let chosenCat = null, chosenPl = null;
      for (const idx of order){
        const cat = G.hand[idx];
        const opts = simFindAllLegalPlacements(win, bridge, cat.cells);
        if (opts.length){ chosenCat = cat; chosenPl = opts[Math.floor(rng.next() * opts.length)]; break; }
      }
      if (!chosenCat) break;
      simPlaceCatAtAbsCells(win, bridge, chosenCat.id, simAbsFromAnchor(chosenPl));
    }
  },
  pickDiscardIndex(G, rng){
    return Math.floor(rng.next() * G.hand.length);
  }
};

// Expand a {r,c,cells} anchor+rotation result (as returned by
// simFindFirstLegalPlacement/simFindAllLegalPlacements) into absolute
// board [r,c] cells, for feeding simPlaceCatAtAbsCells/simPlaceTreatAtAbsCells.
function simAbsFromAnchor(pl){
  const abs = [];
  pl.cells.forEach((row, dr) => row.forEach((v, dc) => { if (v) abs.push([pl.r + dr, pl.c + dc]); }));
  return abs;
}
