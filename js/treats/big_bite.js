'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: big_bite
//  +100 to score, -1 per cat already scored when treat fires
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['big_bite'] = {
  isDecreasing: true,
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const alreadyScored = G.cats.length - cats.length;
      const amt = Math.max(0, 100 - alreadyScored);
      return { scoreBonus: amt };
    };
  },
};
