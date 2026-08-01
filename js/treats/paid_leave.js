'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: paid_leave
//  +$N per DISCARD remaining each time triggered — cash out the round's
//  unspent discard pool (the coin-axis mirror of poker_face's score bonus).
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['paid_leave'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef) || 1;
    return (b, cats, ts, p, cs) => {
      const gained = amt * Math.max(0, G.disc || 0);
      G.cash += gained;
      return { type: 'x', cashGained: gained };
    };
  },
  currentValue() {
    const td = TDEFS.find(t => t.id === 'paid_leave');
    if (!td) return null;
    const per = extractNum(td.ef) || 1;
    return `Now: +$${per * Math.max(0, G.disc || 0)}`;
  },
};
