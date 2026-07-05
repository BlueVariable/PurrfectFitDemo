'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: gift_wrap
//  +$N cash each time triggered (matches sheet card; mirror
//  of piggy_bank.js — amount parsed from the number after
//  the "$" in the effect text).
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['gift_wrap'] = {
  buildFn(ef, phase) {
    const m = ef.match(/\$(\d+)/);
    const amt = m ? parseInt(m[1]) : 1;
    return (b, cats, ts, p, cs) => {
      G.cash += amt;
      return { type: 'x', cashGained: amt };
    };
  },
};
