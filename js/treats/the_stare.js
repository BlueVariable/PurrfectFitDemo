'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: the_stare
//  ×4 the cat with the LOWEST score (after add phase)
//  Tiebreak: top-left-most cell wins
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['the_stare'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      if (!cats.length) return { gids: [], m: 1 };
      // Find the cat group with the lowest current score
      let lowestGid = cats[0].gid;
      let lowestScore = cs[cats[0].gid] ?? Infinity;
      for (const grp of cats) {
        const s = cs[grp.gid] ?? Infinity;
        if (s < lowestScore || (s === lowestScore && isTopleft(grp, cats.find(c => c.gid === lowestGid)))) {
          lowestScore = s;
          lowestGid = grp.gid;
        }
      }
      return { gids: [lowestGid], m: 4 };
    };
  },
};

function isTopleft(a, b) {
  const minA = Math.min(...a.cells.map(([r]) => r));
  const minB = Math.min(...b.cells.map(([r]) => r));
  if (minA !== minB) return minA < minB;
  return Math.min(...a.cells.map(([, c]) => c)) < Math.min(...b.cells.map(([, c]) => c));
}
