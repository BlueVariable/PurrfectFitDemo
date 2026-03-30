'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: lean_larder
//  +N per card remaining in deck to ALL cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['lean_larder'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats) => {
      const remaining = G.deck.length;
      const bonus = amt * remaining;
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = bonus; });
      return { bonusMap };
    };
  },
};
