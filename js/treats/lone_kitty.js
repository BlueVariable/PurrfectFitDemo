'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: lone_kitty
//  ×2 score multiplier — req: no same-type cats adjacent
//  Expires after 3 uses
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['lone_kitty'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const selfTdef = ts.find(t => t.tdef.id === 'lone_kitty')?.tdef;
      const plays = (G.treatPlayCounts.lone_kitty || 0) + 1;
      G.treatPlayCounts.lone_kitty = plays;
      if (plays >= 3 && selfTdef) selfTdef._expired = true;
      return { scoreMultiplier: true, m };
    };
  },
};
