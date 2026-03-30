'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: quick_paws
//  +N per hand remaining this round to ALL cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['quick_paws'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats) => {
      const bonus = amt * G.hands;
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = bonus; });
      return { bonusMap };
    };
  },
};
