'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: piggy_bank
//  +$1 to cash each time triggered
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['piggy_bank'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      G.cash += 1;
      return { type: 'x', cashGained: 1 };
    };
  },
};
