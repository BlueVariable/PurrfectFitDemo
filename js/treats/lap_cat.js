'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: lap_cat
//  ×N each cat HUGGING this treat on 2+ sides
//  Uno treat: checks its 4 ORTHOGONAL neighbours; every cat occupying
//  2 or more of them is multiplied — at most two cats can qualify
//  (2+2 of 4 sides), and both being rewarded is the design: a lap has
//  room for two determined cats. Off-grid neighbours don't count.
//  History: "3+ sides, ONE cat" was verified impossible 2026-08-01 (no
//  deck shape can wrap three orthogonal sides — that needs a U-notch);
//  briefly "2+ sides, one winner by tie-break" before the design owner
//  chose to reward every hugger instead.
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
      const gids = [...sides].filter(([gid, n]) => n >= 2).map(([gid]) => gid);
      if (gids.length) return { gids, m };
      return {};
    };
  },
};
