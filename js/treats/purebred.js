'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: purebred
//  ×2 score multiplier — req: all cats same type
//  Expires after 3 uses
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['purebred'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const selfTdef = ts.find(t => t.tdef.id === 'purebred')?.tdef;
      const plays = (G.treatPlayCounts.purebred || 0) + 1;
      G.treatPlayCounts.purebred = plays;
      if (plays >= 3 && selfTdef) selfTdef._expired = true;
      return { scoreMultiplier: true, m };
    };
  },
};
