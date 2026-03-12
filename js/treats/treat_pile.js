'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: treat_pile
//  +N per OTHER treat on board, to ALL cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['treat_pile'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const others = ts.length - 1;
      if (!others) return { bonusMap: {} };
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = others * amt; });
      return { bonusMap };
    };
  },
};
