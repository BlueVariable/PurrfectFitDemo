'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: slow_blink
//  +N per discard remaining to ALL cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['slow_blink'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats) => {
      const bonus = amt * G.disc;
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = bonus; });
      return { bonusMap };
    };
  },
};
