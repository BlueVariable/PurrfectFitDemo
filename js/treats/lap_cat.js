'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: lap_cat
//  ×N the ONE cat SURROUNDING this treat on 3+ sides
//  Uno treat: checks its 4 ORTHOGONAL neighbours; fires only
//  if a single cat occupies 3 or more of them. Off-grid
//  neighbours don't count, so a corner placement can't fire.
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
      for (const [gid, n] of sides) if (n >= 3) return { gids: [gid], m };
      return {};
    };
  },
};
