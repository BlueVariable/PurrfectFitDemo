'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: one_shot
//  ×2 score multiplier — req: all cats same shape
//  Expires after 3 uses
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['one_shot'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const selfTdef = ts.find(t => t.tdef.id === 'one_shot')?.tdef;
      const plays = (G.treatPlayCounts.one_shot || 0) + 1;
      G.treatPlayCounts.one_shot = plays;
      if (plays >= 3 && selfTdef) selfTdef._expired = true;
      return { scoreMultiplier: true, m };
    };
  },
};
