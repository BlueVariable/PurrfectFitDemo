'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: catnado
//  ×N score multiplier, increases by increment each time played
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['catnado'] = {
  buildFn(ef, phase, addEf) {
    const baseM = extractMul(ef);
    let increment = 0;
    if (addEf) {
      const im = addEf.match(/([\d.]+)/);
      if (im) increment = parseFloat(im[1]);
    }
    return (b, cats, ts, p, cs) => {
      const plays = G.treatPlayCounts.catnado || 0;
      const m = Math.round((baseM + plays * increment) * 100) / 100;
      G.treatPlayCounts.catnado = plays + 1;
      return { scoreMultiplier: true, m };
    };
  },
};
