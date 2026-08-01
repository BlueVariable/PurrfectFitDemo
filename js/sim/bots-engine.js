'use strict';
// ══════════════════════════════════════════════════════
//  SIM: the "engine" bot profile — treat-engine play
//
//  Registers SIM_BOTS.engine (same three-method contract as the profiles in
//  js/sim/bots.js: shopPhase / playHand / pickDiscardIndex, plus an optional
//  `timeBudgetMs` the per-game runner honours). Kept in its own file purely
//  for readability — bots.js stays the short "three simple profiles" file.
//
//  WHY A FOURTH PROFILE
//  solver / greedy / casual all maximize CAT placement. That systematically
//  under-prices the whole treat-engine archetype real winning play uses
//  (AGENT_PLAYBOOK.md §0/§3: flat adds early in scan order, multipliers late,
//  the purrfect bonus as a side prize) and it makes requirements like
//  one_shot's "All cats must be of the SAME SHAPE" look unplayable — when the
//  actual line is "place 1-3 same-shape cats and flood the rest of the board
//  with treats". Requirements bind the cats you PLACED, and placing is
//  voluntary. This bot plays that line, so batches finally measure it.
//
//  THREE IDEAS, ALL BORROWED FROM THINGS THAT ALREADY EXIST HERE
//   1. Shop: a tiered priority list (same simAttemptBuy plumbing every other
//      profile uses — there is no second buy path), plus the one extra move a
//      human makes when the bag is full: sell the cheapest flat, never an
//      anchor.
//   2. Play: candidate layouts arbitrated by the game's own
//      projectScore(null).total — the pattern agent/pf-harness.js PF.plan
//      uses. One candidate floods treats around a max-cat pack; one per
//      universal-requirement kind restricts the cat pool to a single
//      shape/type group (simSolveHand's `allowIds`, the port of the harness's
//      solveCats(allowIds)); one is a plain cats-only pack as an honest floor,
//      so the engine can never score below simple packing.
//   3. Scan-order pinning: flats take the earliest legal cell, multipliers the
//      latest, and the multiplier's slot is RESERVED before cats claim the
//      bottom-right corner. mirror_mood (scan_reverse) inverts both.
//      Early/late is decided by `tdef.phase` alone, the same simplification
//      js/sim/solver.js already makes: a Type A multiplier that wants to fire
//      BEFORE something (head_scritches, "×2 the NEXT cat in SCAN ORDER") is
//      still pinned late. projectScore arbitration absorbs most of the cost —
//      a badly-pinned layout simply loses to the plain-pack candidate.
//
//  Determinism: every decision here is a pure function of game state — no
//  Math.random, no ctx.rng draws. Candidate exploration does consume the
//  game's seeded Math.random indirectly (clearBoard → bpReturnTreat →
//  bpPlaceAt → uid()), which is fine: it is the engine game's OWN seeded
//  stream and each game re-seeds it (js/sim/engine.js).
// ══════════════════════════════════════════════════════

// ── Shop priority table ─────────────────────────────────────────────────
// Tier 1a: global (Type B) score multipliers whose condition this bot can
//          actually meet. Tier 1b: SCALING treats, whose whole value is their
//          trigger count (≤1/round, ≤15/run) — so they are worth most bought
//          as EARLY in the run as they are offered, at any price.
const SIM_ENGINE_TIER1_MULS   = ['morning_stretch', 'matching_set', 'full_house', 'cuddle_puddle'];
const SIM_ENGINE_TIER1_SCALER = ['one_shot', 'purebred', 'seniority', 'sprint_finish'];
// Tier 2: strong flat adds — the bodies the multipliers multiply.
const SIM_ENGINE_TIER2_FLATS  = ['poker_face', 'deep_deck', 'biscuit', 'bench_warmer', 'litter_mates'];
// Tier 3: economy, bought with whatever cash tiers 1-2 left behind.
const SIM_ENGINE_TIER3_ECON   = ['piggy_bank', 'paid_leave', 'gift_wrap'];
// Duplicates that genuinely stack (AGENT_PLAYBOOK.md §5 / PART B 2026-07-05):
// every copy of a flat add fires. Everything else is bought once.
const SIM_ENGINE_STACKABLE = new Set(['biscuit', 'deep_deck']);
// Requirements this bot's own play policy structurally contradicts: it floods
// the board with treats, so a "NO OTHER TREAT" treat (bell) can never fire.
const SIM_ENGINE_REQ_DENY = new Set(['NO OTHER TREAT']);
// Never buy: catnado is a ×2 that DESTROYS a random inventory treat when it
// fires (CLAUDE.md "Treat lifecycle") — the one thing that dismantles an
// assembled engine.
const SIM_ENGINE_ID_DENY_BUY = new Set(['catnado']);
// Never deploy: soft_landing converts a failed round into a win from the
// INVENTORY (endScoreSequence, js/scoring.js reads G.bpGroups) — putting it on
// the board is precisely how that save is lost. Owning it is free value.
const SIM_ENGINE_ID_DENY_PLAY = new Set(['soft_landing']);
// The two universal-over-placed-cats requirements — the ones that make
// max-placement actively WRONG and constrained placement right.
const SIM_ENGINE_REQ_SHAPE = 'All cats must be of the SAME SHAPE';
const SIM_ENGINE_REQ_TYPE  = 'All cats must be of the SAME TYPE';
// Requirements that depend only on game STATE (not on the layout being built),
// so the game's own requirementFails() can be trusted about them at deploy
// time. Layout-dependent ones (PURRFECT FIT!, EVERY ROW…) are left to
// projectScore, which prices a whiffed trigger honestly.
const SIM_ENGINE_STATE_REQS = new Set([
  'FIRST HAND only', 'LAST HAND only', 'LAST HAND', 'NO DISCARDS REMAINING'
]);

// Per-candidate solve caps. Deliberately far tighter than the solver bot's
// (100k / 1500ms): the engine runs up to 4 candidates per hand, and its
// solves are over a partially-filled board and/or a restricted cat pool, so
// they are much smaller problems.
const SIM_ENGINE_SOLVE_NODE_CAP = 40000;
const SIM_ENGINE_SOLVE_MS = 400;
// Per-GAME wall clock. Four candidate layouts per hand (each: clearBoard +
// renderAll + placements + a projectScore scan) costs several times a solver
// hand, so the shared 15s default is too tight for this profile alone.
const SIM_ENGINE_GAME_TIME_BUDGET_MS = 45000;
// Never explore more than this many candidate layouts in one hand.
const SIM_ENGINE_MAX_CANDIDATES = 4;

// ── Shop helpers ─────────────────────────────────────────────────────────

// Buy priority for one shop card. 0 = never buy. Lower is better.
function simEngineTier(td){
  if (SIM_ENGINE_REQ_DENY.has(td.req) || SIM_ENGINE_ID_DENY_BUY.has(td.id)) return 0;
  if (SIM_ENGINE_TIER1_MULS.indexOf(td.id) >= 0) return 1;
  if (SIM_ENGINE_TIER1_SCALER.indexOf(td.id) >= 0) return 1;
  // Any multiplier this table doesn't name is still an engine anchor —
  // multipliers are shop-RNG-bound (AGENT_PLAYBOOK.md §6) and never worth
  // walking past.
  if (td.phase === 'mul') return 1;
  if (SIM_ENGINE_TIER2_FLATS.indexOf(td.id) >= 0) return 2;
  if (SIM_ENGINE_TIER3_ECON.indexOf(td.id) >= 0) return 3;
  // Filler: a requirement-free flat add is still a body on the board and can
  // never whiff. Bought last, out of whatever is left.
  if (td.phase === 'add' && !td.req) return 4;
  return 0;
}

// An "anchor" (multiplier or scaler) is what the engine is assembled around
// and is never the thing sold to make room.
function simEngineIsAnchor(td){
  return td.phase === 'mul' ||
    SIM_ENGINE_TIER1_MULS.indexOf(td.id) >= 0 ||
    SIM_ENGINE_TIER1_SCALER.indexOf(td.id) >= 0;
}

// Ids currently owned — bag occupants plus anything parked in the overflow
// queue (still owned, see CLAUDE.md "Backpack"). Used to avoid re-buying what
// carried over from an earlier round (AGENT_PLAYBOOK.md §7 autobuy trap).
function simEngineOwnedIds(bridge){
  const G = bridge.getG();
  const ids = new Set();
  G.bpGroups.forEach(grp => ids.add(grp.tdef.id));
  (G.bpPending || []).forEach(td => ids.add(td.id));
  return ids;
}

// No room for an anchor: sell the LOWEST-VALUE owned flat (never a multiplier
// or a scaler) and retry, at most a couple of times. Uses the real
// sellTreatFromShop(), i.e. exactly the drag-to-SELL-BACK path a player takes.
function simEngineMakeRoom(win, bridge, td){
  for (let guard = 0; guard < 3; guard++){
    if (win.bpCanFit(td.bpS)) return true;
    const sellable = bridge.getG().bpGroups
      .filter(grp => !simEngineIsAnchor(grp.tdef))
      // Cheapest first; among equally cheap, free the most cells.
      .sort((a, b) => (a.tdef.sp - b.tdef.sp) ||
        (simCellCount(b.tdef.bpS) - simCellCount(a.tdef.bpS)));
    if (!sellable.length) return false;
    win.sellTreatFromShop(sellable[0].gid);
  }
  return win.bpCanFit(td.bpS);
}

// ── Deployment helpers ───────────────────────────────────────────────────

// Treats this bot may put on the board THIS hand, as a list of TDEFS entries
// (never bpGroups: every clearBoard() sends bag treats back through
// bpPlaceAt(), which mints a fresh gid, so a gid captured before the candidate
// loop is stale by the second candidate — groups are re-resolved by id at
// placement time instead). Duplicate copies appear once per copy and share a
// tdef reference, which is exactly what the placement resolver expects.
//
// simEligibleTreats (solver.js) already enforces the FIRST HAND / LAST HAND
// timing gates; on top of that:
//   - skip treats with an onPlace hook (zoomies permanently un-blocks board
//     cells and rewrites G.blockedMask), because candidate layouts are thrown
//     away and that side effect would not be thrown away with them;
//   - skip the reqs this bot's play policy contradicts;
//   - re-check the state-only reqs against the game's own requirementFails().
// A deployed treat whose requirement fails wastes its once-per-round trigger.
function simEngineDeployable(win, bridge){
  return simEligibleTreats(bridge).filter(grp => {
    const td = grp.tdef;
    if (td.onPlace) return false;
    if (SIM_ENGINE_ID_DENY_PLAY.has(td.id)) return false;
    if (SIM_ENGINE_REQ_DENY.has(td.req)) return false;
    if (SIM_ENGINE_STATE_REQS.has(td.req)){
      let fails = false;
      try { fails = win.requirementFails(td.req); } catch (e) { fails = false; }
      if (fails) return false;
    }
    return true;
  }).map(grp => grp.tdef);
}

// Ranking for "which treats go out this hand": anchors first, then bigger
// shapes (more board coverage toward the purrfect bonus).
function simEngineDeployRank(a, b){
  return simEngineTier(a) - simEngineTier(b) || simCellCount(b.bpS) - simCellCount(a.bpS);
}

// Each treat triggers at most once per ROUND (CLAUDE.md "Treat lifecycle"), so
// dumping the whole bag on hand 1 leaves hands 2-4 bare. Spread the arsenal
// over the hands that are left — which naturally becomes "play everything" on
// the last hand.
function simEngineSpreadCount(bridge, n){
  const handsLeft = Math.max(1, bridge.getG().hands);
  return Math.max(1, Math.ceil(n / handsLeft));
}

// How many cells of treats this hand can afford to lay down before the
// smallest still-allowed cat can no longer fit. doFit() refuses a zero-cat fit
// (js/scoring.js), so a treat flood that leaves no room for a cat is a wasted
// hand, not a clever one. Necessary, not sufficient (geometry can still bite) —
// a candidate that ends up with zero cats is discarded outright below.
function simEngineTreatCellBudget(bridge, pool){
  const G = bridge.getG();
  const open = G.board.flat().filter(c => !c.blocked && !c.offShape && !c.filled).length;
  let minCat = Infinity;
  G.hand.forEach(cat => {
    if (pool && !pool.has(cat.id)) return;
    const n = simCellCount(cat.cells);
    if (n < minCat) minCat = n;
  });
  if (!isFinite(minCat)) return 0;
  return Math.max(0, open - minCat);
}

// ── Scan-order pinning ───────────────────────────────────────────────────

// A piece fires at its topmost-then-leftmost cell (scanCompare, js/scoring.js).
function simEngineScanKey(bridge, abs){
  const C = bridge.getG().bsc;
  let best = Infinity;
  abs.forEach(([r, c]) => { const k = r * C + c; if (k < best) best = k; });
  return best;
}
// mirror_mood runs the scan bottom-right → top-left, which INVERTS early/late
// pinning (AGENT_PLAYBOOK.md §7).
function simEngineScanReversed(bridge){
  const mod = bridge.getG().roundModifier;
  return !!(mod && mod.effect === 'scan_reverse');
}

// Legal spot for a treat shape that fires as early ('early') or as late
// ('late') in the scan as possible. Returns absolute [r,c] cells, or null.
function simEngineBestTreatSpot(win, bridge, shape, bias){
  const opts = simFindAllLegalPlacements(win, bridge, shape);
  if (!opts.length) return null;
  const wantEarly = (bias === 'early') !== simEngineScanReversed(bridge);
  let bestAbs = null, bestKey = null;
  opts.forEach(pl => {
    const abs = simAbsFromAnchor(pl);
    const key = simEngineScanKey(bridge, abs);
    if (bestKey === null || (wantEarly ? key < bestKey : key > bestKey)){ bestKey = key; bestAbs = abs; }
  });
  return bestAbs;
}

// ── Constrained cat pools ────────────────────────────────────────────────

// The hand's largest same-shape (or same-type) group, as a Set of cat ids —
// the cat pool that lets one_shot / purebred actually fire. Ranked by total
// cells, since that group is all the coverage the constrained hand gets.
function simEngineLargestGroup(bridge, kind){
  const by = {};
  bridge.getG().hand.forEach(cat => {
    const key = kind === 'shape' ? cat.shape : cat.type;
    (by[key] = by[key] || []).push(cat);
  });
  let best = null, bestCells = -1;
  Object.keys(by).forEach(key => {
    const cells = by[key].reduce((s, cat) => s + simCellCount(cat.cells), 0);
    if (cells > bestCells){ bestCells = cells; best = by[key]; }
  });
  return best ? new Set(best.map(cat => cat.id)) : null;
}

// ── Verified placement wrappers ──────────────────────────────────────────
// simPlaceCatAtAbsCells / simPlaceTreatAtAbsCells (js/sim/placement.js) report
// success as "the piece existed", not "the piece landed" — and they are shared
// with the other three profiles, so they are left exactly as they are. The
// engine explores throwaway layouts, so it needs the stronger guarantee AND it
// must never strand a picked-up treat in H (dealHand() would drop H without
// returning it to the bag). dropHeld() puts a held bag treat back at its
// remembered pose.
function simEnginePlaceCat(win, bridge, catId, abs){
  const before = bridge.getG().cats.length;
  if (!simPlaceCatAtAbsCells(win, bridge, catId, abs)) return false;
  if (bridge.getG().cats.length > before) return true;
  win.dropHeld();
  return false;
}
function simEnginePlaceTreat(win, bridge, gid, abs){
  const before = bridge.getG().treats.length;
  if (!simPlaceTreatAtAbsCells(win, bridge, gid, abs)) return false;
  if (bridge.getG().treats.length > before) return true;
  win.dropHeld();
  return false;
}

// ── One candidate layout ─────────────────────────────────────────────────
// Lays a candidate out on the (already cleared) board and returns the plan
// that reproduces it: { treats:[{id, abs}], cats:[{id, abs}] }. Treats are
// recorded by tdef ID, not gid: gids are minted fresh by bpPlaceAt() every
// time a treat returns to the bag, so a replay after clearBoard() has to
// re-look-up by id (the same rule agent/pf-harness.js applySnapshot follows).
//
// cand = { pool: Set|null, deploy: [tdef], label }
function simEngineLayout(win, bridge, pool, deploy, label){
  const plan = { treats: [], cats: [], label };
  const early = [], late = [];
  deploy.forEach(td => (td.phase === 'mul' ? late : early).push(td));
  const bigFirst = (a, b) => simCellCount(b.bpS) - simCellCount(a.bpS);
  early.sort(bigFirst); late.sort(bigFirst);

  let budget = simEngineTreatCellBudget(bridge, pool);
  const usedGids = new Set();
  const deployOne = (td, bias) => {
    const size = simCellCount(td.bpS);
    if (size > budget) return;
    // Resolve a live backpack group NOW — gids are re-minted on every return
    // to the bag. Duplicate copies share a tdef, so usedGids keeps them apart.
    const grp = bridge.getG().bpGroups.find(g => g.tdef.id === td.id && !usedGids.has(g.gid));
    if (!grp) return; // sold, played, or overflow-parked since the hand began
    const abs = simEngineBestTreatSpot(win, bridge, td.bpS, bias);
    if (!abs) return;
    if (!simEnginePlaceTreat(win, bridge, grp.gid, abs)) return;
    usedGids.add(grp.gid);
    budget -= size;
    plan.treats.push({ id: td.id, abs });
  };
  // Multipliers go down FIRST even though they fire LAST: the mul is the piece
  // the hand is built around, and seating it on the last scan cell of an empty
  // board reserves that slot instead of leaving it to whatever is left over.
  // Flats then take the earliest cells, and cats pack the rest.
  late.forEach(td => deployOne(td, 'late'));
  early.forEach(td => deployOne(td, 'early'));

  // maxTreatPieces:0 — this bot chooses its own treat deployment above; the
  // solver must not add more behind its back (and its optional-piece pool
  // isn't filtered for onPlace side effects).
  const sol = simSolveHand(win, bridge, {
    allowIds: pool,
    maxTreatPieces: 0,
    nodeCap: SIM_ENGINE_SOLVE_NODE_CAP,
    timeBudgetMs: SIM_ENGINE_SOLVE_MS
  });
  sol.placements.forEach(pl => {
    if (pl.kind !== 'cat') return; // maxTreatPieces:0 ⇒ cats only
    if (simEnginePlaceCat(win, bridge, pl.id, pl.abs)) plan.cats.push({ id: pl.id, abs: pl.abs });
  });
  return plan;
}

// The treat cell budget is a necessary condition, not a geometric guarantee —
// a flood can still leave only holes no allowed cat fits in, and doFit()
// refuses a zero-cat fit. Halve the flood and try again (deploy is ranked, so
// the lowest-priority treats are the ones dropped, and a constrained
// candidate's pinned treat is first in the list and survives).
function simEnginePlaceCandidate(win, bridge, cand){
  let deploy = cand.deploy;
  for (let attempt = 0; ; attempt++){
    const plan = simEngineLayout(win, bridge, cand.pool, deploy, cand.label);
    if (plan.cats.length || !deploy.length || attempt >= 2) return plan;
    deploy = deploy.slice(0, Math.floor(deploy.length / 2));
    win.clearBoard();
  }
}

// Replay a recorded plan onto a freshly cleared board.
function simEngineApplyPlan(win, bridge, plan){
  const usedGids = new Set();
  plan.treats.forEach(t => {
    const grp = bridge.getG().bpGroups.find(g => g.tdef.id === t.id && !usedGids.has(g.gid));
    if (!grp) return; // overflow-parked since it was planned — skip, never destroy
    usedGids.add(grp.gid);
    simEnginePlaceTreat(win, bridge, grp.gid, t.abs);
  });
  plan.cats.forEach(c => simEnginePlaceCat(win, bridge, c.id, c.abs));
}

// ── The profile ──────────────────────────────────────────────────────────
SIM_BOTS.engine = {
  // Honoured by simRunOneGame (js/sim/engine.js) — see the constant's comment.
  timeBudgetMs: SIM_ENGINE_GAME_TIME_BUDGET_MS,

  shopPhase(ctx){
    const { win, bridge, roundLog } = ctx;
    const owned = simEngineOwnedIds(bridge);
    const wanted = bridge.getShopPool()
      .map(td => ({ td, tier: simEngineTier(td) }))
      .filter(x => x.tier > 0)
      .filter(x => !owned.has(x.td.id) || SIM_ENGINE_STACKABLE.has(x.td.id))
      // Tier order is the priority table; cheapest first inside a tier so one
      // visit can land more of the engine.
      .sort((a, b) => a.tier - b.tier || a.td.pr - b.td.pr);

    wanted.forEach(({ td, tier }) => {
      if (bridge.getG().cash < td.pr) return;
      if (!win.bpCanFit(td.bpS)){
        // Only an anchor is worth clearing space for, and only ever by selling
        // the cheapest flat.
        if (tier > 1) return;
        if (!simEngineMakeRoom(win, bridge, td)) return;
        if (bridge.getG().cash < td.pr) return;
      }
      // Same buy plumbing as every other profile — there is no second path.
      simAttemptBuy(win, bridge, td, roundLog);
    });
  },

  playHand(ctx){
    const { win, bridge, roundLog } = ctx;
    const deployable = simEngineDeployable(win, bridge).sort(simEngineDeployRank);
    // Treats whose requirement is universal over the PLACED cats only fire on a
    // deliberately constrained hand — keep them out of the unconstrained flood
    // so they aren't burned for nothing.
    const isUniversal = td => td.req === SIM_ENGINE_REQ_SHAPE || td.req === SIM_ENGINE_REQ_TYPE;
    const universal = deployable.filter(isUniversal);
    const free = deployable.filter(td => !isUniversal(td));
    // Each treat triggers once per ROUND, so the ordinary hands take a share of
    // the arsenal rather than all of it (that share becomes "everything" on the
    // last hand). The constrained hand is the exception: flooding is the point.
    const spread = free.slice(0, simEngineSpreadCount(bridge, free.length));

    const cands = [];
    cands.push({ pool: null, deploy: spread, label: 'flood' });
    // The constrained hand: one_shot / purebred in the bag turn ONE hand of the
    // round into "place only same-shape (or same-type) cats and flood the rest
    // with treats". The game's own lifecycle enforces the "one hand" part — a
    // played treat leaves the inventory for the rest of the round.
    [[SIM_ENGINE_REQ_SHAPE, 'shape'], [SIM_ENGINE_REQ_TYPE, 'type']].forEach(pair => {
      if (cands.length >= SIM_ENGINE_MAX_CANDIDATES - 1) return;
      const pinned = universal.filter(td => td.req === pair[0]);
      if (!pinned.length) return;
      const pool = simEngineLargestGroup(bridge, pair[1]);
      if (!pool) return;
      cands.push({ pool, deploy: pinned.concat(free), label: 'same-' + pair[1] });
    });
    // Honest floor: plain max-coverage cat packing, no treats at all. The
    // engine can never end up scoring below simple packing, and this candidate
    // always yields at least one cat (simEnsurePlaceable proved one fits).
    cands.push({ pool: null, deploy: [], label: 'pack' });

    let best = null, bestIdx = -1;
    cands.forEach((cand, i) => {
      win.clearBoard();
      const plan = simEnginePlaceCandidate(win, bridge, cand);
      if (!plan.cats.length) return; // doFit() refuses a zero-cat fit
      let proj = -Infinity;
      try { proj = win.projectScore(null).total; } catch (e) { proj = -Infinity; }
      if (!best || proj > best.proj){ best = { proj, plan }; bestIdx = i; }
    });

    if (!best){
      // Every candidate came back cat-less (should be unreachable) — fall back
      // to the plain solver line and let engine.js's force-place net catch it.
      win.clearBoard();
      simApplySolution(win, bridge, simSolveHand(win, bridge));
      return;
    }
    // The last candidate evaluated is still on the board; only replay when the
    // winner is an earlier one.
    if (bestIdx !== cands.length - 1){
      win.clearBoard();
      simEngineApplyPlan(win, bridge, best.plan);
    }

    // Deployment telemetry (engine-only roundLog fields — the dashboard shows
    // them when present). A treat placed on a layout whose requirement fails
    // burns its once-per-round trigger for nothing, which is exactly the thing
    // this profile exists to measure.
    roundLog.treatsPlayed = roundLog.treatsPlayed || [];
    roundLog.treatsWhiffed = roundLog.treatsWhiffed || [];
    (bridge.getG().treats || []).forEach(bt => {
      roundLog.treatsPlayed.push(bt.tdef.id);
      if (!bt.tdef.req) return;
      let fails = false;
      try { fails = win.requirementFails(bt.tdef.req); } catch (e) { fails = false; }
      if (fails) roundLog.treatsWhiffed.push(bt.tdef.id);
    });
  },

  pickDiscardIndex(G){
    // Engine-flavoured pick for the harness's "nothing fits" fallback: drop the
    // cat least useful to a same-shape line — the smallest member of the
    // rarest shape group.
    const counts = {};
    G.hand.forEach(cat => { counts[cat.shape] = (counts[cat.shape] || 0) + 1; });
    let idx = 0, bestKey = null;
    G.hand.forEach((cat, i) => {
      const key = counts[cat.shape] * 1000 + simCellCount(cat.cells);
      if (bestKey === null || key < bestKey){ bestKey = key; idx = i; }
    });
    return idx;
  }
};
