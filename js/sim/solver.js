'use strict';
// ══════════════════════════════════════════════════════
//  SIM: branch-and-bound max-coverage board solver ("solver" bot)
//
//  Ported from AGENT_PLAYBOOK.md §7 (the reusable solver+applier) and §12
//  (the "fast solver core": group identical cat shapes into one piece with
//  a count to kill duplicate-permutation branching; try larger pieces
//  first; prune hard once a perfect fill is found; bound search depth).
//  Generalized to run from the parent page against a live game iframe
//  (`win` = iframe.contentWindow, `bridge` = injected SIM_BRIDGE — see
//  js/sim/bridge.js) instead of being pasted into the page's own console.
//
//  Treats are OPTIONAL pieces in the SAME single max-coverage search as the
//  hand's cats (never mandatory — AGENT_PLAYBOOK.md §13: making them
//  mandatory clogs the board and starves cats, and doFit() refuses a
//  zero-cat fit). Scan-order pinning ("Type B add treats -> top-left/early,
//  mul treats -> bottom-right/late", playbook §10/§12 PF.smart) is
//  approximated by *ordering* the candidate pieces tried at each open cell:
//  early treats first, then cat groups (largest first), then late (mul)
//  treats last. Because the DFS always resolves the lowest-index open
//  board cell first (top-left -> bottom-right) and the first piece order
//  that reaches a perfect (or best) fill becomes `best` and is never
//  overwritten by an equally-good alternative (strict `>` comparison), this
//  reliably pushes early treats toward the earliest cells they can occupy
//  and reserves late treats for whatever's left after cats/early-treats
//  have first pick — a good approximation of PF.smart's explicit pinning
//  without a full rewrite of the DFS into a two-pass placer. This is a
//  documented simplification, not a mathematically guaranteed placement.
// ══════════════════════════════════════════════════════

const SIM_SOLVER_NODE_CAP = 100000;
// Wall-clock cap per solve. The node cap alone can still take a while when
// each node is expensive (many pieces x many rotations on big late-game
// boards), so both caps apply; whichever trips first stops the search and
// the best solution found so far is used.
const SIM_SOLVER_TIME_BUDGET_MS = 1500;
// At most this many backpack treats are offered to a single solve as
// optional pieces. Treats carry over between rounds, so the backpack grows
// all run long, and every extra optional piece multiplies the branching
// factor at every open cell — an uncapped late-game backpack (8+ treats)
// blows the search space up even under the node cap. The largest treats
// are kept: they contribute the most board coverage per piece toward the
// purrfect bonus.
const SIM_SOLVER_MAX_TREAT_PIECES = 4;

// Group identical-rotation-set hand cats into one piece + a pool of ids
// (kills duplicate-permutation branching — playbook §12 change #1).
function simGroupHandPieces(win, hand){
  const byKey = new Map();
  const order = [];
  hand.forEach(cat => {
    const rots = simRotationsFor(win, cat.cells);
    const key = JSON.stringify(rots);
    if (!byKey.has(key)){
      const g = { kind: 'cat', rots, ids: [], size: simCellCount(cat.cells) };
      byKey.set(key, g); order.push(g);
    }
    byKey.get(key).ids.push(cat.id);
  });
  order.sort((a, b) => b.size - a.size); // larger pieces first (playbook §12 change #2 helper)
  return order;
}

// Backpack treats eligible for this hand. Only FIRST HAND / LAST HAND
// timing requirements are gated here (per task spec); any other
// requirement (e.g. "ALL SAME TYPE") is left for the game engine to
// silently no-op if unmet when doFit() scans it — the treat still helps
// fill the board even on a hand where its bonus doesn't fire. This is a
// deliberate scope simplification (see report).
function simEligibleTreats(bridge){
  const G = bridge.getG();
  return G.bpGroups.filter(grp => {
    const req = grp.tdef.req;
    // js/treats/requirements.js defines both spellings for the "last hand"
    // gate ('LAST HAND' and 'LAST HAND only') but only one for "first hand"
    // ('FIRST HAND only') — matched exactly here against that source of truth.
    if (req === 'FIRST HAND only') return G.hands === G.maxHands;
    if (req === 'LAST HAND only' || req === 'LAST HAND') return G.hands === 1;
    return true;
  });
}

function simBuildTreatPiece(win, grp, bucket){
  return {
    kind: 'treat', bucket, gid: grp.gid, tdef: grp.tdef,
    rots: simRotationsFor(win, grp.tdef.bpS), size: simCellCount(grp.tdef.bpS), used: false
  };
}

// Solve the current hand + board for maximum coverage. Returns
// { filled, total, placements } where placements is an ordered list of
// { kind:'cat', id, abs } | { kind:'treat', gid, abs }.
function simSolveHand(win, bridge){
  const G = bridge.getG();
  const R = G.bsr, C = G.bsc;
  const playable = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++){
    const b = G.board[r][c];
    if (!b.blocked && !b.offShape) playable.push([r, c]);
  }
  const total = playable.length;
  const occ = {};
  playable.forEach(([r, c]) => { occ[r + ',' + c] = false; });

  const catPieces = simGroupHandPieces(win, G.hand);
  // Cap the optional-treat set per solve (largest first) so the search
  // space stays bounded no matter how big the carried-over backpack gets.
  const eligible = simEligibleTreats(bridge)
    .sort((a, b) => simCellCount(b.tdef.bpS) - simCellCount(a.tdef.bpS))
    .slice(0, SIM_SOLVER_MAX_TREAT_PIECES);
  const earlyTreats = eligible.filter(g => g.tdef.phase !== 'mul').map(g => simBuildTreatPiece(win, g, 'early'));
  const lateTreats = eligible.filter(g => g.tdef.phase === 'mul').map(g => simBuildTreatPiece(win, g, 'late'));

  // Try order: early treats first, then cats (largest-first), then late treats.
  const pieces = [...earlyTreats, ...catPieces, ...lateTreats];

  const cur = [];
  let filled = 0;
  let resolved = 0; // cells either filled by a piece OR deliberately skipped this branch
  let best = { filled: -1, placements: [] };
  let nodeCount = 0;
  let stop = false;
  const tSolve0 = Date.now();

  function firstOpen(){
    for (const [r, c] of playable){ const k = r + ',' + c; if (!occ[k]) return [r, c]; }
    return null;
  }
  function canPlace(abs){
    return abs.every(([r, c]) => r >= 0 && c >= 0 && r < R && c < C &&
      !G.board[r][c].blocked && !G.board[r][c].offShape && !occ[r + ',' + c]);
  }
  function snapshot(){
    return cur.map(p => ({ kind: p.kind, id: p.id, gid: p.gid, abs: p.abs.slice() }));
  }

  function dfs(){
    nodeCount++;
    if (nodeCount > SIM_SOLVER_NODE_CAP){ stop = true; return; }
    if ((nodeCount & 2047) === 0 && Date.now() - tSolve0 > SIM_SOLVER_TIME_BUDGET_MS){ stop = true; return; }
    if (filled > best.filled) best = { filled, placements: snapshot() };
    if (filled === total){ stop = true; return; } // perfect fill — stop the whole search
    // Bound: even filling every still-open cell can't beat the current best.
    if (filled + (total - resolved) <= best.filled) return;
    const fu = firstOpen();
    if (!fu) return;
    const [r, c] = fu;

    for (const p of pieces){
      if (stop) return;
      const avail = p.kind === 'cat' ? p.ids.length > 0 : !p.used;
      if (!avail) continue;
      for (const rt of p.rots){
        const a = rt[0], or = r - a[0], oc = c - a[1];
        const abs = rt.map(([dr, dc]) => [or + dr, oc + dc]);
        if (!canPlace(abs)) continue;
        abs.forEach(([rr, cc]) => { occ[rr + ',' + cc] = true; });
        filled += abs.length; resolved += abs.length;
        let placedId;
        if (p.kind === 'cat'){ placedId = p.ids.pop(); } else { p.used = true; }
        cur.push({ kind: p.kind, id: placedId, gid: p.gid, abs });

        dfs();

        cur.pop();
        if (p.kind === 'cat'){ p.ids.push(placedId); } else { p.used = false; }
        filled -= abs.length; resolved -= abs.length;
        abs.forEach(([rr, cc]) => { occ[rr + ',' + cc] = false; });
        if (stop) return;
      }
    }
    if (stop) return;
    // Branch: leave this cell empty.
    occ[r + ',' + c] = true; resolved += 1;
    dfs();
    occ[r + ',' + c] = false; resolved -= 1;
  }

  dfs();
  return { filled: best.filled, total, placements: best.placements };
}

// Apply a solved plan via the real game functions (see js/sim/placement.js
// for simPlaceCatAtAbsCells / simPlaceTreatAtAbsCells).
function simApplySolution(win, bridge, solution){
  const applied = { cats: 0, treats: 0 };
  solution.placements.forEach(pl => {
    if (pl.kind === 'cat'){
      if (simPlaceCatAtAbsCells(win, bridge, pl.id, pl.abs)) applied.cats++;
    } else {
      if (simPlaceTreatAtAbsCells(win, bridge, pl.gid, pl.abs)) applied.treats++;
    }
  });
  return applied;
}
