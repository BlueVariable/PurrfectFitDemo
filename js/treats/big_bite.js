'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: big_bite
//  +100 to ALL cats, −1 per cat already scored when treat fires
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['big_bite'] = {
  isDecreasing: true,
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const alreadyScored = G.cats.length - cats.length;
      const amt = Math.max(0, 100 - alreadyScored);
      if (!amt) return { bonusMap: {} };
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = amt; });
      return { bonusMap };
    };
  },
};
