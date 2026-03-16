'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: catnado
//  ×N ALL cats, increases by increment each time played
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
      const m = baseM + plays * increment;
      G.treatPlayCounts.catnado = plays + 1;
      return allMulCS(cats, cs, m);
    };
  },
};
