'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: final_feast
//  ×N ALL cats — self-destructs after 2 plays
//  On the last play, marks tdef._expired so goShop
//  does not return it to the backpack.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['final_feast'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    const maxPlays = 2;
    return (b, cats, ts, p, cs) => {
      const plays = G.treatPlayCounts.final_feast || 0;
      G.treatPlayCounts.final_feast = plays + 1;
      // On the final allowed play, mark this treat as expired
      if (plays + 1 >= maxPlays) {
        const self = ts.find(t => t.cells === p);
        if (self) self.tdef._expired = true;
      }
      return allMulCS(cats, cs, m);
    };
  },
};
