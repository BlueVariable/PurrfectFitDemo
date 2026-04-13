'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: crowd_pleaser
//  +30 per cat placed on the board
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['crowd_pleaser'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const bonus = 30 * G.cats.length;
      return { scoreBonus: bonus };
    };
  }
};
