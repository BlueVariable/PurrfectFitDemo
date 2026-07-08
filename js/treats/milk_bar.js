'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: milk_bar
//  All SURROUNDING cats count as the MAJORITY type this fit.
//
//  Surrounding = 8-neighbour ring around every milk_bar cell (same
//  convention as surrAdd/frenzy). MAJORITY type = the most common type
//  among ALL cat groups on the board (G.cats) at fire time.
//  Tie-break: (1) highest count across all cats on the board;
//  (2) among tied types, highest count among the SURROUNDING cats
//  themselves; (3) still tied → the type of the earliest cat on the
//  board in plain row-major scan order (topmost-then-leftmost trigger
//  cell, independent of mirror_mood's scan reversal).
//
//  The override mutates grp.type AND the group's board cells'
//  col/em/type (siamese_twins convention) so every later type-reader
//  in the same scan — frenzy, potluck, typeMul treats (cotton_cloud/
//  tabby_pack/tuna_can/shadow_feast/silver_lining), requirement
//  rechecks — sees the new types. It is TEMPORARY: a restore closure
//  is pushed onto G._fitCleanups, which doFit runs LIFO right after
//  the scan loop, so types revert before the score animation and
//  before the next hand. projectScore() scans restore types/board in
//  their own finally and never run these closures (doFit discards
//  stale ones at the start of each real fit).
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['milk_bar'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      // 8-neighbour surrounding cat groups (same convention as surrAdd/frenzy)
      const allTCells = Array.isArray(p[0]) ? p : [p];
      const adjGids = new Set();
      allTCells.forEach(([tr, tc]) => {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = tr + dr, cc = tc + dc;
          if (rr >= 0 && rr < G.bsr && cc >= 0 && cc < G.bsc && b[rr][cc].kind === 'cat' && b[rr][cc].gid)
            adjGids.add(b[rr][cc].gid);
        }
      });
      const adjCats = [...adjGids].map(gid => G.cats.find(c => c.gid === gid)).filter(Boolean);
      if (!adjCats.length) return { type: 'x', announce: 'no cats nearby' };

      // MAJORITY type across ALL cat groups on the board
      const countBy = grps => {
        const n = {};
        grps.forEach(g => { n[g.type] = (n[g.type] || 0) + 1; });
        return n;
      };
      const allCounts = countBy(G.cats);
      const maxAll = Math.max(...Object.values(allCounts));
      let candidates = Object.keys(allCounts).filter(t => allCounts[t] === maxAll);
      if (candidates.length > 1) {
        // tie-break: most common among the surrounding cats themselves
        const adjCounts = countBy(adjCats);
        const maxAdj = Math.max(...candidates.map(t => adjCounts[t] || 0));
        candidates = candidates.filter(t => (adjCounts[t] || 0) === maxAdj);
      }
      let majType = candidates[0];
      if (candidates.length > 1) {
        // final tie-break: earliest cat in row-major scan order among tied types
        const trig = grp => grp.cells.reduce((best, [r, c]) =>
          (r < best[0] || (r === best[0] && c < best[1])) ? [r, c] : best, [Infinity, Infinity]);
        const ordered = [...G.cats].sort((g1, g2) => {
          const t1 = trig(g1), t2 = trig(g2);
          return (t1[0] - t2[0]) || (t1[1] - t2[1]);
        });
        const first = ordered.find(grp => candidates.includes(grp.type));
        if (first) majType = first.type;
      }

      // Override every surrounding cat to majType for the rest of THIS fit,
      // saving originals (group type + each board cell's col/em/type) so the
      // G._fitCleanups closure can restore them when the scan completes.
      const saved = [];
      const changedGids = [];
      adjCats.forEach(grp => {
        if (grp.type === majType) return;
        const cellSaves = [];
        grp.cells.forEach(([r, c]) => {
          const cell = b[r][c];
          if (cell.gid !== grp.gid) return;
          cellSaves.push({ cell, col: cell.col, em: cell.em, type: cell.type });
          cell.col = COLS[majType] || cell.col;
          cell.em = EMS[majType] || cell.em;
          cell.type = majType;
        });
        saved.push({ grp, type: grp.type, cellSaves });
        grp.type = majType;
        changedGids.push(grp.gid);
      });
      if (saved.length) {
        (G._fitCleanups || (G._fitCleanups = [])).push(() => {
          saved.forEach(({ grp, type, cellSaves }) => {
            grp.type = type;
            cellSaves.forEach(s => { s.cell.col = s.col; s.cell.em = s.em; s.cell.type = s.type; });
          });
        });
      }

      const n = changedGids.length;
      const em = EMS[majType] || '🐱';
      const announce = n
        ? `${n} cat${n === 1 ? '' : 's'} joined the ${em} ${majType} tribe`
        : `everyone nearby is already ${em} ${majType}`;
      return { type: 'x', majType, changedGids, announce };
    };
  },
};
