// ═══════════════════════════════════════════════════════════════════
//  PF — agent play harness for Purrfect Fit
//
//  For agents PLAYING the game via browser automation (see AGENT_PLAYBOOK.md).
//  NOT loaded by index.html; inject it into the running game page instead.
//
//  Load (game served over HTTP from the project dir):
//    fetch('/agent/pf-harness.js').then(r=>r.text()).then(eval)
//  then drive it:
//    PF.state()                       → round/target/score/hands/cash/hand/bp/shop/board ascii
//    PF.buy('treat_id')               → buy from shop (safe: tries PF.defrag() once on
//                                       no-room, then refuses — never destroys anything)
//    PF.defrag(extraTd)               → backtracking bag rearrange (atomic, lossless);
//                                       optionally proves room for one extra treat def;
//                                       'no-arrangement' if none exists. See below.
//    PF.sell('treat_id')              → sell from backpack (shop screen only)
//    PF.reroll()                      → reroll shop
//    PF.playRound()                   → leave shop, deal first hand
//    PF.plan({K:50, treats:[{id:'feather'},{id:'morning_stretch',bias:'late'}]})
//                                     → best-of-K layout via projectScore; LEAVES IT PLACED.
//                                       Constrained-placement aware: pinning a treat whose req
//                                       is "All cats must be of the SAME SHAPE/TYPE" (one_shot,
//                                       purebred) also tries candidates restricted to one
//                                       shape/type group — deliberately placing FEWER cats so
//                                       the req can fire. Returns reqNotes[] per pinned req.
//    PF.fit()                         → doFit() on whatever is placed; wait ~8s for animation
//    PF.discard(catId)                → discard a hand cat by id
//    PF.nextRound()                   → goShop() after a win
//
//  Rules learned the hard way (keep these):
//  - Every call is synchronous. NEVER `await new Promise(setTimeout)` inside a
//    javascript_tool evaluation — it wedges the CDP channel. Use the computer
//    tool's `wait` between calls (score animation ≈ 8s).
//  - PF.buy must NEVER fall back to bpRepackAll([td]): that rebuilds the
//    backpack and silently DESTROYS treats that don't fit back (and leaves the
//    new one in, unpaid). Rotation-aware auto-place first, then ONE PF.defrag()
//    pass (atomic rearrange of what's already owned — never destructive); only
//    after both fail does 'no-bp-room' mean sell something first — exactly the
//    choice a human player faces.
//  - PF.plan biases: 'early' pins a treat top-left in scan order (flat adds,
//    big_bite), 'late' pins bottom-right (multipliers). Omit for random restarts.
//  - plan() re-applies its best layout before returning, so proj === the exact
//    doFit total (projectScore treats RNG effects as non-triggering).
//  - Treat gids change every clearBoard(); the harness always re-resolves by
//    tdef.id. Duplicate ids are handled (each copy placed once).
//  - Backpack arrangement is player-owned: bpGroups remember {or,oc,shape,rot},
//    used treats restore to their remembered home pose (G.bpHomes), and a
//    treat that truly cannot fit is parked in G.bpPending — never destroyed —
//    and re-seated automatically when space frees (sell/rearrange/round end).
//    bpAutoPlaceRot / pickupTreat signatures are unchanged.
// ═══════════════════════════════════════════════════════════════════
window.PF = (() => {
  const cellCnt = g => g.reduce((s, row) => s + row.filter(Boolean).length, 0);
  const ascii = () => {
    let out = '';
    for (let r = 0; r < G.bsr; r++) {
      for (let c = 0; c < G.bsc; c++) {
        const b = G.board[r][c];
        out += b.offShape ? ' ' : (b.blocked ? 'X' : (b.filled ? (b.kind === 'treat' ? 'T' : '#') : '.'));
      }
      out += '\n';
    }
    return out;
  };
  const norm = cs => { const o = []; cs.forEach((row, dr) => row.forEach((v, dc) => { if (v) o.push([dr, dc]); })); return o; };
  const rotsFor = cs => {
    const seen = new Set(), res = [];
    for (let rot = 0; rot < 4; rot++) {
      const fl = norm(rotC(cs, rot));
      const mr = Math.min(...fl.map(p => p[0])), mc = Math.min(...fl.map(p => p[1]));
      const nf = fl.map(p => [p[0] - mr, p[1] - mc]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const k = JSON.stringify(nf);
      if (!seen.has(k)) { seen.add(k); res.push(nf); }
    }
    return res;
  };
  const openCell = (r, c) => {
    if (r < 0 || c < 0 || r >= G.bsr || c >= G.bsc) return false;
    const b = G.board[r][c];
    return !b.blocked && !b.offShape && !b.filled;
  };

  // Branch-and-bound max-coverage tiling of the open cells with G.hand.
  // Groups identical shapes, prunes on remaining-open bound, caps nodes.
  // allowIds (optional Set): restrict the cat pool — constrained-placement
  // mode for universal reqs like one_shot's "All cats must be of the SAME
  // SHAPE", where max-placement over the whole hand can never satisfy the
  // requirement and the winning line is deliberately placing FEWER cats.
  function solveCats(allowIds) {
    const playable = [];
    for (let r = 0; r < G.bsr; r++) for (let c = 0; c < G.bsc; c++) if (openCell(r, c)) playable.push([r, c]);
    const total = playable.length, occ = new Set(), skip = new Set();
    const groups = [], byKey = {};
    G.hand.forEach(h => {
      if (allowIds && !allowIds.has(h.id)) return;
      const rots = rotsFor(h.cells); const key = JSON.stringify(rots);
      if (byKey[key]) { byKey[key].ids.push(h.id); byKey[key].count++; }
      else { const gp = { rots, ids: [h.id], count: 1, used: 0, size: rots[0].length }; byKey[key] = gp; groups.push(gp); }
    });
    groups.sort((a, b) => b.size - a.size);
    let filled = 0, skipped = 0, nodes = 0; const cur = []; let best = { filled: -1, pl: [] };
    const firstOpen = () => { for (const [r, c] of playable) { const k = r + ',' + c; if (!occ.has(k) && !skip.has(k)) return [r, c]; } return null; };
    const canP = abs => abs.every(([r, c]) => openCell(r, c) && !occ.has(r + ',' + c));
    (function dfs() {
      if (++nodes > 300000) return;
      if (filled > best.filled) best = { filled, pl: cur.map(p => ({ gi: p.gi, abs: p.abs.slice() })) };
      if (best.filled === total || total - skipped <= best.filled) return;
      const fu = firstOpen(); if (!fu) return; const [r, c] = fu;
      for (let gi = 0; gi < groups.length; gi++) {
        const gp = groups[gi]; if (gp.used >= gp.count) continue;
        for (const rt of gp.rots) {
          for (const a of rt) {
            const or = r - a[0], oc = c - a[1];
            const abs = rt.map(([dr, dc]) => [or + dr, oc + dc]);
            if (abs.some(([rr, cc]) => rr === r && cc === c) && canP(abs)) {
              abs.forEach(([rr, cc]) => occ.add(rr + ',' + cc)); filled += abs.length; gp.used++; cur.push({ gi, abs });
              dfs();
              cur.pop(); gp.used--; filled -= abs.length; abs.forEach(([rr, cc]) => occ.delete(rr + ',' + cc));
              if (best.filled === total) return;
            }
          }
        }
      }
      skip.add(r + ',' + c); skipped++; dfs(); skip.delete(r + ',' + c); skipped--;
    })();
    const usedIds = new Set(), out = [];
    best.pl.forEach(p => {
      const gp = groups[p.gi]; const id = gp.ids.find(i => !usedIds.has(i));
      usedIds.add(id); out.push({ id, abs: p.abs });
    });
    return { placements: out, filled: best.filled, total };
  }

  // Place solver output through the real game path (grab 0,0 + grid-from-abs).
  function applyCats(pls) {
    for (const pl of pls) {
      const idx = G.hand.findIndex(h => h.id === pl.id); if (idx < 0) continue;
      const cat = G.hand[idx];
      const rs = pl.abs.map(a => a[0]), cs2 = pl.abs.map(a => a[1]);
      const mr = Math.min(...rs), mc = Math.min(...cs2), Mr = Math.max(...rs), Mc = Math.max(...cs2);
      const grid = Array.from({ length: Mr - mr + 1 }, () => Array(Mc - mc + 1).fill(0));
      pl.abs.forEach(([r, c]) => grid[r - mr][c - mc] = 1);
      H = { kind: 'cat', source: 'hand', data: cat, cells: grid, rot: 0, color: cat.col, em: cat.em,
            handIdx: idx, boardGid: null, bpGid: null, grabDr: 0, grabDc: 0, dragging: false };
      placeCatOnBoard(mr, mc);
    }
  }

  function treatCandidates(td) {
    const cands = [];
    for (const rt of rotsFor(td.bpS)) {
      for (let r = 0; r < G.bsr; r++) for (let c = 0; c < G.bsc; c++) {
        const abs = rt.map(([dr, dc]) => [r + dr, c + dc]);
        if (abs.every(([rr, cc]) => openCell(rr, cc))) cands.push({ abs, key: Math.min(...abs.map(([rr, cc]) => rr * G.bsc + cc)) });
      }
    }
    return cands;
  }

  // Routes through pickupTreat so the treat actually leaves the backpack.
  function placeTreat(id, usedGids, bias) {
    const grp = G.bpGroups.find(x => x.tdef.id === id && !usedGids.has(x.gid)); if (!grp) return null;
    let cands = treatCandidates(grp.tdef); if (!cands.length) return null;
    if (bias === 'early') cands.sort((a, b) => a.key - b.key);
    else if (bias === 'late') cands.sort((a, b) => b.key - a.key);
    else cands.sort(() => Math.random() - 0.5);
    const pick = cands[Math.floor(Math.random() * Math.min(3, cands.length))];
    const rs = pick.abs.map(a => a[0]), cs2 = pick.abs.map(a => a[1]);
    const mr = Math.min(...rs), mc = Math.min(...cs2), Mr = Math.max(...rs), Mc = Math.max(...cs2);
    const grid = Array.from({ length: Mr - mr + 1 }, () => Array(Mc - mc + 1).fill(0));
    pick.abs.forEach(([r, c]) => grid[r - mr][c - mc] = 1);
    G.selBpGid = grp.gid; pickupTreat();
    H.cells = grid; H.rot = 0; H.grabDr = 0; H.grabDc = 0;
    placeTreatOnBoard(mr, mc);
    return { id, gid: grp.gid, abs: pick.abs, grid, mr, mc };
  }

  function applySnapshot(snap) {
    clearBoard();
    const used = new Set();
    for (const t of snap.treats) {
      const grp = G.bpGroups.find(x => x.tdef.id === t.id && !used.has(x.gid)); if (!grp) continue;
      used.add(grp.gid);
      G.selBpGid = grp.gid; pickupTreat();
      H.cells = t.grid; H.rot = 0; H.grabDr = 0; H.grabDc = 0;
      placeTreatOnBoard(t.mr, t.mc);
    }
    applyCats(snap.cats);
  }

  // ── Safe backpack defragmentation ──────────────────────────────────────
  // bpAutoPlaceRot (js/backpack.js) seats ONE new treat into the CURRENT
  // arrangement; when the bag is fragmented (free cells scattered too small
  // for the incoming shape) it returns false even though some legal
  // REARRANGEMENT of the existing treats would open a spot. This is the
  // harness's analogue of a human player dragging + rotating (R) everything
  // in the bag to make room. bpRepackAll is FORBIDDEN (destroys treats that
  // don't re-fit) — this is atomic and lossless instead.
  //
  // Backtracking search: every G.bpGroups treat (rotated off its ORIGINAL
  // tdef.bpS, same convention bpAutoPlaceRot uses — never off its current
  // in-bag pose) plus, optionally, one virtual `extraTd` slot is placed into
  // a fresh getBPR()×getBPC() grid. Pieces go largest-first with a
  // remaining-cells bound (same branch-and-bound shape as solveCats above)
  // and a hard node/time budget so a pathological bag can't blow the ~15s
  // javascript_tool ceiling. The extra slot is a feasibility check only — it
  // is never written back; PF.buy's own bpAutoPlaceRot retry seats it for
  // real, and since that retry is an EXHAUSTIVE rotation×cell scan, it
  // cannot miss a spot this search already proved exists.
  const PF_EXTRA_KEY = '__pf_extra__';
  function defragRotShapes(bpS) {
    const seen = new Set(), out = [];
    for (let rot = 0; rot < 4; rot++) {
      const grid = rotC(bpS, rot);
      const key = JSON.stringify(grid);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ grid, rot, size: grid.reduce((s, row) => s + row.filter(Boolean).length, 0) });
    }
    return out;
  }
  // items: [{key, tdef}, ...] → placements [{key, tdef, grid, rot, or, oc}, ...], or null
  // (no arrangement) / 'budget' (gave up under the node/time cap — treated as none).
  function defragSolve(items, rows, cols) {
    const shapes = items.map(it => defragRotShapes(it.tdef.bpS));
    const order = items.map((_, i) => i).sort((a, b) => shapes[b][0].size - shapes[a][0].size);
    const suffix = new Array(order.length + 1).fill(0);
    for (let i = order.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + shapes[order[i]][0].size;
    const occ = new Set();
    const totalCells = rows * cols;
    const t0 = Date.now();
    let nodes = 0;
    const TIME_BUDGET_MS = 8000, NODE_CAP = 300000; // well under the ~15-20s javascript_tool ceiling
    function dfs(pos) {
      if (pos === order.length) return [];
      if (++nodes > NODE_CAP || Date.now() - t0 > TIME_BUDGET_MS) return 'budget';
      if (totalCells - occ.size < suffix[pos]) return null; // remaining pieces can't possibly fit — fail fast
      const i = order[pos], it = items[i];
      for (const sh of shapes[i]) {
        const rH = sh.grid.length, rW = sh.grid[0].length;
        for (let r = 0; r <= rows - rH; r++) {
          for (let c = 0; c <= cols - rW; c++) {
            const cells = []; let ok = true;
            for (let dr = 0; dr < rH && ok; dr++) for (let dc = 0; dc < rW; dc++) {
              if (!sh.grid[dr][dc]) continue;
              const k = (r + dr) * cols + (c + dc);
              if (occ.has(k)) { ok = false; break; }
              cells.push(k);
            }
            if (!ok) continue;
            cells.forEach(k => occ.add(k));
            const rest = dfs(pos + 1);
            if (rest === 'budget') { cells.forEach(k => occ.delete(k)); return 'budget'; }
            if (rest !== null) return [{ key: it.key, tdef: it.tdef, grid: sh.grid, rot: sh.rot, or: r, oc: c }, ...rest];
            cells.forEach(k => occ.delete(k));
          }
        }
      }
      return null;
    }
    return dfs(0);
  }
  // Object-identity multiset compare: confirms the exact same tdef references,
  // in the exact same quantities, survive a defrag — the "nothing lost" proof.
  function tdefMultiset(list) {
    const m = new Map();
    list.forEach(td => m.set(td, (m.get(td) || 0) + 1));
    return m;
  }
  function multisetsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) if (b.get(k) !== v) return false;
    return true;
  }

  const api = {};
  api.ascii = ascii;

  api.state = () => {
    const eff = td => { try { return String(treatCurrentEf(td) || td.ef || ''); } catch (e) { return String(td.ef || ''); } };
    return {
      screen: ['s-rounds', 's-game'].filter(id => getComputedStyle(document.getElementById(id)).display !== 'none'),
      round: G.round, tgt: G.tgt, score: G.score, hands: G.hands, disc: G.disc, cash: G.cash,
      mod: G.roundModifier ? String(G.roundModifier.name || G.roundModifier.id || 'mod').slice(0, 80) : null,
      hand: (G.hand || []).map(h => ({ id: h.id, type: h.type, shape: h.shape, n: cellCnt(h.cells) })),
      // req matters: 'NO OTHER TREAT' (bell), 'PURRFECT FIT!' (all_or_nothing),
      // 'FIRST HAND only' (morning_stretch)… plan around it or the treat pays 0.
      bp: (G.bpGroups || []).map(g => ({ id: g.tdef.id, ef: eff(g.tdef).slice(0, 70), req: g.tdef.req || undefined })),
      shop: (typeof shopPool !== 'undefined' ? shopPool : []).map(t => ({
        id: t.id, nm: t.nm || t.name, pr: t.pr, ef: eff(t).slice(0, 80), req: t.req || undefined,
        sold: typeof shopBoughtIds !== 'undefined' && shopBoughtIds.has(t.id)
      })),
      board: ascii()
    };
  };

  // Whole-hand resolution without the score animation. The total is computed
  // in doFit before the animation runs, so scores/lifecycle are authentic;
  // only the step-by-step presentation is skipped.
  api.fitFast = () => {
    const orig = runScoreSequence;
    runScoreSequence = (sr, bb, bf, total) => { endScoreSequence(total); };
    try { doFit(); } finally { runScoreSequence = orig; }
    return { score: G.score, tgt: G.tgt, hands: G.hands, won: G.score >= G.tgt };
  };

  // Safe, atomic bag rearrange (search: defragSolve above). Returns
  // 'no-arrangement' if no legal placement of every currently-owned treat
  // (+ optional extraTd, reserved but never written back) exists. Otherwise
  // rewrites G.bp/G.bpGroups from the solved layout and re-renders. Never
  // partial: a failed lossless-assertion reverts to the exact pre-call state.
  api.defrag = extraTd => {
    const rows = getBPR(), cols = getBPC();
    const items = G.bpGroups.map(gr => ({ key: gr.gid, tdef: gr.tdef }));
    const beforeCount = items.length;
    if (extraTd) items.push({ key: PF_EXTRA_KEY, tdef: extraTd });
    const sol = defragSolve(items, rows, cols);
    if (!sol || sol === 'budget') return 'no-arrangement';
    const beforeMultiset = tdefMultiset(G.bpGroups.map(gr => gr.tdef));
    const origBp = G.bp, origGroups = G.bpGroups; // plain refs — neither is mutated in place below, so reverting is just reassigning back
    G.bp = mk2d(rows, cols, () => ({ filled: false, col: null, em: null, gid: null, tdef: null }));
    G.bpGroups = [];
    try {
      for (const p of sol) { if (p.key !== PF_EXTRA_KEY) bpPlaceAt(p.tdef, p.grid, p.or, p.oc, p.rot); }
      if (G.bpGroups.length !== beforeCount) throw new Error('defrag lossy: count mismatch');
      if (!multisetsEqual(beforeMultiset, tdefMultiset(G.bpGroups.map(gr => gr.tdef))))
        throw new Error('defrag lossy: composition mismatch');
    } catch (e) {
      G.bp = origBp; G.bpGroups = origGroups; // atomic revert — every treat exactly as it was
      return 'no-arrangement';
    }
    bpRetryPending(); // harmless: may also seat an unrelated overflowed treat
    if (typeof renderAll === 'function') renderAll();
    if (typeof renderShopFull === 'function') renderShopFull();
    return 'defragged ' + G.bpGroups.length + ' treats' + (extraTd ? ' (room reserved for ' + extraTd.id + ')' : '');
  };

  // SAFE buy: rotation-aware auto-place first, then ONE PF.defrag() pass
  // before giving up — a fragmented bag often has room a naive scan can't
  // see. Still never bpRepackAll (destructive — it silently drops treats
  // that don't re-fit and doesn't charge for the new one).
  api.buy = id => {
    const td = (shopPool || []).find(t => t.id === id); if (!td) return 'not-in-shop';
    if (G.cash < td.pr) return 'no-cash';
    if (!bpAutoPlaceRot(td)) {
      if (api.defrag(td) === 'no-arrangement') return 'no-bp-room';
      if (!bpAutoPlaceRot(td)) return 'no-bp-room'; // defensive; the defrag proof says this shouldn't happen
    }
    G.cash -= td.pr; shopBoughtIds.add(td.id); G.purchasedTreatIds.add(td.id);
    if (td.id === 'purrfect_record' && G.purrfectRecordBuyFits === undefined) {
      G.purrfectRecordBuyFits = G.totalFits || 0;
      G.purrfectRecordBuyPurrfects = G.totalPurrfects || 0;
    }
    renderShopFull(); return 'bought ' + id + ' cash=' + G.cash;
  };

  api.sell = id => {
    const grp = G.bpGroups.find(x => x.tdef.id === id); if (!grp) return 'no-such';
    sellTreatFromShop(grp.gid); return 'sold ' + id + ' cash=' + G.cash;
  };

  api.reroll = () => {
    const c = getRerollCost(); if (G.cash < c) return 'no-cash';
    rerollTreats(); return 'rerolled $' + c + ' left$' + G.cash;
  };

  api.playRound = () => {
    // The prep-screen start button is labelled WORK these days (was PLAY ROUND).
    const b = [...document.querySelectorAll('#s-rounds button')].find(x => /^\s*WORK\s*$|PLAY ROUND/i.test(x.textContent));
    if (!b) { startRound(); return 'started (direct)'; }
    b.click(); return 'started';
  };

  // Best-of-K: random-restart treat placement + exact cat solve, scored with
  // projectScore(null).total. Leaves the best layout ON THE BOARD.
  api.plan = spec => {
    spec = spec || {}; const K = spec.K || 40; const treats = spec.treats || [];
    // Constrained-placement pools: a pinned treat with a universal cat req
    // ("All cats must be of the SAME SHAPE/TYPE") can never fire under
    // max-placement — so alongside the unconstrained candidates, try pools
    // restricted to one shape/type group and let projectScore pick the
    // winner (it prices whiffed reqs, so honest comparison is automatic).
    // Threshold/board reqs (matching_set, full_house…) need no pools: any
    // candidate that happens to satisfy them simply projects higher.
    clearBoard();
    const pools = [null];
    const kinds = new Set();
    for (const ts of treats) {
      const td = TDEFS.find(t => t.id === ts.id);
      const rq = (td && td.req) || '';
      if (/All cats must be of the SAME SHAPE/i.test(rq)) kinds.add('shape');
      if (/All cats must be of the SAME TYPE/i.test(rq)) kinds.add('type');
    }
    kinds.forEach(kind => {
      const byKey = {};
      G.hand.forEach(h => { const key = kind === 'shape' ? h.shape : h.type; (byKey[key] = byKey[key] || []).push(h); });
      Object.values(byKey)
        .sort((a, b) => cellCnt2(b) - cellCnt2(a))
        .slice(0, 3)
        .forEach(grp => pools.push(new Set(grp.map(h => h.id))));
    });
    let best = null;
    for (let k = 0; k < K; k++) {
      clearBoard();
      const usedG = new Set(), tp = [];
      for (const ts of treats) { const p = placeTreat(ts.id, usedG, ts.bias); if (p) { usedG.add(p.gid); tp.push(p); } }
      const sol = solveCats(pools[k % pools.length]); applyCats(sol.placements);
      let sc = -1; try { sc = projectScore(null).total; } catch (e) {}
      if (!best || sc > best.score) best = { score: sc, treats: tp.map(t => ({ id: t.id, grid: t.grid, mr: t.mr, mc: t.mc })), cats: sol.placements };
    }
    applySnapshot(best);
    let proj = -1; try { proj = projectScore(null).total; } catch (e) {}
    // Surface each pinned treat's requirement state on the final layout —
    // a currentlyFails:true note means playing it this fit wastes the trigger.
    const reqNotes = [];
    for (const ts of treats) {
      const td = TDEFS.find(t => t.id === ts.id);
      if (!td || !td.req) continue;
      let fails = null; try { fails = requirementFails(td.req); } catch (e) {}
      reqNotes.push({ id: ts.id, req: td.req, currentlyFails: fails });
    }
    const filled = G.board.flat().filter(c => c.filled).length;
    const playable = G.board.flat().filter(c => !c.blocked && !c.offShape).length;
    return { proj, filled, playable, full: filled === playable, board: ascii(), reqNotes };
  };
  // Total cells across a group of hand cats (pool ranking helper).
  function cellCnt2(grp) { return grp.reduce((s, h) => s + cellCnt(h.cells), 0); }

  api.fit = () => { doFit(); return 'fit-started'; };

  api.discard = id => {
    const idx = G.hand.findIndex(h => h.id === id); if (idx < 0) return 'no-such';
    const cat = G.hand[idx];
    H = { kind: 'cat', source: 'hand', data: cat, cells: cat.cells, rot: 0, color: cat.col, em: cat.em,
          handIdx: idx, boardGid: null, bpGid: null, grabDr: 0, grabDc: 0, dragging: false };
    doDiscard(); return 'discarded ' + id + ' disc=' + G.disc;
  };

  api.nextRound = () => { goShop(); return 'shop'; };

  return api;
})();
'PF installed: ' + Object.keys(window.PF).join(',');
