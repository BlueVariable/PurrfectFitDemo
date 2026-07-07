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
//    PF.buy('treat_id')               → buy from shop (safe: refuses when backpack full)
//    PF.sell('treat_id')              → sell from backpack (shop screen only)
//    PF.reroll()                      → reroll shop
//    PF.playRound()                   → leave shop, deal first hand
//    PF.plan({K:50, treats:[{id:'feather'},{id:'morning_stretch',bias:'late'}]})
//                                     → best-of-K layout via projectScore; LEAVES IT PLACED
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
//    new one in, unpaid). Rotation-aware auto-place only; 'no-bp-room' means
//    sell something first — exactly the choice a human player faces.
//  - PF.plan biases: 'early' pins a treat top-left in scan order (flat adds,
//    big_bite), 'late' pins bottom-right (multipliers). Omit for random restarts.
//  - plan() re-applies its best layout before returning, so proj === the exact
//    doFit total (projectScore treats RNG effects as non-triggering).
//  - Treat gids change every clearBoard(); the harness always re-resolves by
//    tdef.id. Duplicate ids are handled (each copy placed once).
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
  function solveCats() {
    const playable = [];
    for (let r = 0; r < G.bsr; r++) for (let c = 0; c < G.bsc; c++) if (openCell(r, c)) playable.push([r, c]);
    const total = playable.length, occ = new Set(), skip = new Set();
    const groups = [], byKey = {};
    G.hand.forEach(h => {
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

  const api = {};
  api.ascii = ascii;

  api.state = () => {
    const eff = td => { try { return String(treatCurrentEf(td) || td.ef || ''); } catch (e) { return String(td.ef || ''); } };
    return {
      screen: ['s-rounds', 's-game'].filter(id => getComputedStyle(document.getElementById(id)).display !== 'none'),
      round: G.round, tgt: G.tgt, score: G.score, hands: G.hands, disc: G.disc, cash: G.cash,
      mod: G.roundModifier ? String(G.roundModifier.name || G.roundModifier.id || 'mod').slice(0, 80) : null,
      hand: (G.hand || []).map(h => ({ id: h.id, type: h.type, shape: h.shape, n: cellCnt(h.cells) })),
      bp: (G.bpGroups || []).map(g => ({ id: g.tdef.id, ef: eff(g.tdef).slice(0, 70) })),
      shop: (typeof shopPool !== 'undefined' ? shopPool : []).map(t => ({
        id: t.id, nm: t.nm || t.name, pr: t.pr, ef: eff(t).slice(0, 80),
        sold: typeof shopBoughtIds !== 'undefined' && shopBoughtIds.has(t.id)
      })),
      board: ascii()
    };
  };

  // SAFE buy: rotation-aware auto-place only. Never bpRepackAll (destructive —
  // it silently drops treats that don't re-fit and doesn't charge for the new one).
  api.buy = id => {
    const td = (shopPool || []).find(t => t.id === id); if (!td) return 'not-in-shop';
    if (G.cash < td.pr) return 'no-cash';
    if (!bpAutoPlaceRot(td)) return 'no-bp-room';
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
    const b = [...document.querySelectorAll('#s-rounds button')].find(x => /PLAY ROUND/i.test(x.textContent));
    b.click(); return 'started';
  };

  // Best-of-K: random-restart treat placement + exact cat solve, scored with
  // projectScore(null).total. Leaves the best layout ON THE BOARD.
  api.plan = spec => {
    spec = spec || {}; const K = spec.K || 40; const treats = spec.treats || [];
    let best = null;
    for (let k = 0; k < K; k++) {
      clearBoard();
      const usedG = new Set(), tp = [];
      for (const ts of treats) { const p = placeTreat(ts.id, usedG, ts.bias); if (p) { usedG.add(p.gid); tp.push(p); } }
      const sol = solveCats(); applyCats(sol.placements);
      let sc = -1; try { sc = projectScore(null).total; } catch (e) {}
      if (!best || sc > best.score) best = { score: sc, treats: tp.map(t => ({ id: t.id, grid: t.grid, mr: t.mr, mc: t.mc })), cats: sol.placements };
    }
    applySnapshot(best);
    let proj = -1; try { proj = projectScore(null).total; } catch (e) {}
    const filled = G.board.flat().filter(c => c.filled).length;
    const playable = G.board.flat().filter(c => !c.blocked && !c.offShape).length;
    return { proj, filled, playable, full: filled === playable, board: ascii() };
  };

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
