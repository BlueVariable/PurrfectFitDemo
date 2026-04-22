'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: purebred
//  ×1.2 score multiplier, +0.2 per trigger — req: all cats same type
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['purebred'] = {
  buildFn(ef, phase, addEf) {
    const baseM = extractMul(ef);
    let increment = 0;
    if (addEf) { const im = addEf.match(/([\d.]+)/); if (im) increment = parseFloat(im[1]); }
    return (b, cats, ts, p, cs) => {
      const plays = G.treatPlayCounts.purebred || 0;
      const m = Math.round((baseM + plays * increment) * 100) / 100;
      G.treatPlayCounts.purebred = plays + 1;
      return { scoreMultiplier: true, m };
    };
  },
};
