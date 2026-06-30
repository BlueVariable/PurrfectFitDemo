'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: piggy_bank
//  +$4 to cash each time triggered (matches sheet card)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['piggy_bank'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef) || 4;
    return (b, cats, ts, p, cs) => {
      G.cash += amt;
      return { type: 'x', cashGained: amt };
    };
  },
};
