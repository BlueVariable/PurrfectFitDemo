'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: paycheck_advance
//  +$N per HAND remaining each time triggered — the HAND-axis sibling of
//  paid_leave's discard version. G.hands still counts the current hand
//  during the scan, so hand 1 of 4 pays +$4, decaying $1 per later hand:
//  it wants to be played EARLY, competing for hand-1 board space with
//  the scoring stack (the opposite pull of bench_warmer).
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['paycheck_advance'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef) || 1;
    return (b, cats, ts, p, cs) => {
      const gained = amt * Math.max(0, G.hands || 0);
      G.cash += gained;
      return { type: 'x', cashGained: gained };
    };
  },
  currentValue() {
    const td = TDEFS.find(t => t.id === 'paycheck_advance');
    if (!td) return null;
    const per = extractNum(td.ef) || 1;
    return `Now: +$${per * Math.max(0, G.hands || 0)}`;
  },
};
