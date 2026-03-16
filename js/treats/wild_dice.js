'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: wild_dice
//  ×N one random cat group
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['wild_dice'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      if (!cats.length) return { gids: [], m: 1 };
      const chosen = cats[Math.floor(Math.random() * cats.length)];
      return { gids: [chosen.gid], m };
    };
  },
};
