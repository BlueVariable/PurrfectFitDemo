'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: lone_kitty
//  ×1.2 score multiplier, +0.2 per trigger — req: no same-type adjacent
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['lone_kitty'] = {
  buildFn(ef, phase, addEf) {
    const baseM = extractMul(ef);
    let increment = 0;
    if (addEf) { const im = addEf.match(/([\d.]+)/); if (im) increment = parseFloat(im[1]); }
    return (b, cats, ts, p, cs) => {
      const plays = G.treatPlayCounts.lone_kitty || 0;
      const m = Math.round((baseM + plays * increment) * 100) / 100;
      G.treatPlayCounts.lone_kitty = plays + 1;
      return { scoreMultiplier: true, m };
    };
  },
};
