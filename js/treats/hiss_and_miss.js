'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: hiss_and_miss
//  ×N ALL cats — self-destructs immediately after first play
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['hiss_and_miss'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const self = ts.find(t => t.cells === p);
      if (self) self.tdef._expired = true;
      return allMulCS(cats, cs, m);
    };
  },
};
