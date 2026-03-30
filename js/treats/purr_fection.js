'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: purr_fection
//  ×N ALL cats only if score already ≥ target this round
//  Grows by increment each time successfully triggered
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['purr_fection'] = {
  buildFn(ef, phase, addEf) {
    const baseM = extractMul(ef);
    let increment = 0;
    if (addEf) {
      const im = addEf.match(/([\d.]+)/);
      if (im) increment = parseFloat(im[1]);
    }
    return (b, cats, ts, p, cs) => {
      if (G.score < G.tgt) return { gids: [], m: 1 };
      const triggers = G.treatPlayCounts.purr_fection || 0;
      const m = baseM + triggers * increment;
      G.treatPlayCounts.purr_fection = triggers + 1;
      return allMulCS(cats, cs, m);
    };
  },
};
