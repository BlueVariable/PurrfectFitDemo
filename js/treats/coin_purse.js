'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: coin_purse
//  +$10 cash when triggered (LAST HAND only)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['coin_purse'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      G.cash += 10;
      return { type: 'x', cashGained: 10 };
    };
  },
};
