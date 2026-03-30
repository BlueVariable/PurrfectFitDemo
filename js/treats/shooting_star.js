'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: shooting_star
//  +N to ALL cats, decreases by decrement each play (min 0)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['shooting_star'] = {
  buildFn(ef, phase, addEf) {
    const baseAmt = extractNum(ef);
    let decrease = 0;
    if (addEf) {
      const im = addEf.match(/(\d+)/);
      if (im) decrease = parseInt(im[1]);
    }
    return (b, cats) => {
      const plays = G.treatPlayCounts.shooting_star || 0;
      const amt = Math.max(0, baseAmt - plays * decrease);
      G.treatPlayCounts.shooting_star = plays + 1;
      if (!amt) return { bonusMap: {} };
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = amt; });
      return { bonusMap };
    };
  },
};
