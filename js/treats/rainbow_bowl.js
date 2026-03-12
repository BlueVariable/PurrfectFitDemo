'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: rainbow_bowl
//  +N per unique cat type on board, to ALL cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['rainbow_bowl'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const uniqueTypes = new Set(cats.map(c => c.type)).size;
      if (!uniqueTypes) return { bonusMap: {} };
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = uniqueTypes * amt; });
      return { bonusMap };
    };
  },
};
