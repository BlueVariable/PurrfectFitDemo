'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: lap_cat
//  ×N the ONE cat HUGGING this treat on 2+ sides
//  Uno treat: checks its 4 ORTHOGONAL neighbours; fires if a single cat
//  occupies 2 or more of them. Off-grid neighbours don't count.
//  Was "3+ sides" — verified impossible 2026-08-01: no cat shape in the
//  deck can wrap three orthogonal sides of an empty cell (that needs a
//  U-notch; the bendiest shapes max out at two). 2+ makes every bent
//  shape (corner, L, J, S, Z, T, cross, chonker) a valid lap.
//  If two cats hug two sides each, the deeper hug wins (more sides),
//  then the bigger cat (more board cells), then scan-neighbour order.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['lap_cat'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const [tr, tc] = Array.isArray(p[0]) ? p[0] : p;
      const sides = new Map();
      [[tr - 1, tc], [tr + 1, tc], [tr, tc - 1], [tr, tc + 1]].forEach(([rr, cc]) => {
        if (rr >= 0 && rr < G.bsr && cc >= 0 && cc < G.bsc && b[rr][cc].kind === 'cat' && b[rr][cc].gid)
          sides.set(b[rr][cc].gid, (sides.get(b[rr][cc].gid) || 0) + 1);
      });
      const cellsOf = gid => {
        let n = 0;
        for (let r = 0; r < G.bsr; r++) for (let c = 0; c < G.bsc; c++)
          if (b[r][c].gid === gid && b[r][c].kind === 'cat') n++;
        return n;
      };
      let best = null;
      for (const [gid, n] of sides) {
        if (n < 2) continue;
        if (!best || n > best.n || (n === best.n && cellsOf(gid) > best.cells))
          best = { gid, n, cells: cellsOf(gid) };
      }
      if (best) return { gids: [best.gid], m };
      return {};
    };
  },
};
