'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: coin_purr
//  +N per $1 held to ALL cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['coin_purr'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats) => {
      const bonus = amt * G.cash;
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = bonus; });
      return { bonusMap };
    };
  },
};
