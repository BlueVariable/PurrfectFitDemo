'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: catnado
//  ×2 score multiplier, destroys 1 random inventory treat
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['catnado'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      if (G.bpGroups.length > 0) {
        const idx = Math.floor(Math.random() * G.bpGroups.length);
        const grp = G.bpGroups[idx];
        removeBpGid(grp.gid);
      }
      return { scoreMultiplier: true, m };
    };
  },
};
