'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: lucky_penny
//  +$2 cash each trigger, 50% chance to reappear after use
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['lucky_penny'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const selfTdef = ts.find(t => t.tdef.id === 'lucky_penny')?.tdef;
      if (selfTdef) { if (Math.random() >= 0.5) selfTdef._expired = true; else selfTdef._reappear = true; }
      G.cash += 2;
      return { type: 'x', cashGained: 2 };
    };
  },
};
