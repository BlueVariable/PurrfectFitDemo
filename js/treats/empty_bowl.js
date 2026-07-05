'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: empty_bowl
//  +N for each $1 of CASH below a threshold ($10 default)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['empty_bowl'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    const tm = ef.match(/below \$(\d+)/);
    const threshold = tm ? parseInt(tm[1]) : 10;
    return (b, cats, ts, p, cs) => {
      const deficit = Math.max(0, threshold - (G.cash || 0));
      return { scoreBonus: amt * deficit };
    };
  },
};
