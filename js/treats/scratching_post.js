'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: scratching_post
//  +N per CELL in each cat group
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['scratching_post'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = grp.cells.length * amt; });
      return { bonusMap };
    };
  },
};
