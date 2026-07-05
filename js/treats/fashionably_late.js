'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: fashionably_late
//  +N per cat SCORED BEFORE this treat
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['fashionably_late'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const alreadyScored = G.cats.length - cats.length;
      return { scoreBonus: amt * alreadyScored };
    };
  },
};
