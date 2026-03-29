'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: pack_leader
//  ×N cats of the MOST PLACED type
//  Tiebreak: type whose first cell is top-left-most
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['pack_leader'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      // Count groups per type and track each type's top-left-most cell
      const typeCounts = {};
      const typeFirstCell = {};
      for (const grp of cats) {
        const t = grp.type;
        typeCounts[t] = (typeCounts[t] || 0) + 1;
        for (const [r, c] of grp.cells) {
          if (!typeFirstCell[t] || r < typeFirstCell[t][0] || (r === typeFirstCell[t][0] && c < typeFirstCell[t][1])) {
            typeFirstCell[t] = [r, c];
          }
        }
      }
      // Find the highest count
      const maxCount = Math.max(...Object.values(typeCounts));
      // Collect tied types, sort by top-left-most cell
      const tied = Object.keys(typeCounts)
        .filter(t => typeCounts[t] === maxCount)
        .sort((a, b) => {
          const [ra, ca] = typeFirstCell[a];
          const [rb, cb] = typeFirstCell[b];
          return ra !== rb ? ra - rb : ca - cb;
        });
      const winner = tied[0];
      const gids = cats.filter(grp => grp.type === winner).map(grp => grp.gid);
      return { gids, m };
    };
  },
};
