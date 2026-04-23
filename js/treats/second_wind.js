'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: second_wind
//  +1 HAND for this round when triggered
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['second_wind'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      G.hands += 1;
      return { scoreMultiplier: true, m: 1 };
    };
  },
};
