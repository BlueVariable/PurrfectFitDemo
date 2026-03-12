'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: sibling_rivalry
//  +N per cat TYPE that has 2+ groups on the board
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['sibling_rivalry'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const typeCounts = {};
      cats.forEach(grp => { typeCounts[grp.type] = (typeCounts[grp.type] || 0) + 1; });
      const qualifying = Object.values(typeCounts).filter(n => n >= 2).length;
      if (!qualifying) return { bonusMap: {} };
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = qualifying * amt; });
      return { bonusMap };
    };
  },
};
