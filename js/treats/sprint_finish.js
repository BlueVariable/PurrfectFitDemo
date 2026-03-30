'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: sprint_finish
//  ×N ALL cats on LAST HAND, grows by increment each trigger
//  Requirement "LAST HAND" enforced centrally — fn only called when met
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['sprint_finish'] = {
  buildFn(ef, phase, addEf) {
    const baseM = extractMul(ef);
    let increment = 0;
    if (addEf) {
      const im = addEf.match(/([\d.]+)/);
      if (im) increment = parseFloat(im[1]);
    }
    return (b, cats, ts, p, cs) => {
      const triggers = G.treatPlayCounts.sprint_finish || 0;
      const m = baseM + triggers * increment;
      G.treatPlayCounts.sprint_finish = triggers + 1;
      return allMulCS(cats, cs, m);
    };
  },
};
