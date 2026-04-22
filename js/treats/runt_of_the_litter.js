'use strict';
TREAT_REGISTRY['runt_of_the_litter'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
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
      const minCount = Math.min(...Object.values(typeCounts));
      const tied = Object.keys(typeCounts)
        .filter(t => typeCounts[t] === minCount)
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
