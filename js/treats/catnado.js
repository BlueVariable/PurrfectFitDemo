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
        // Loss ceremony: record the destruction (pure state push — safe under
        // the headless sim, and projectScore() truncates G.treatLossEvents in
        // its finally so hover previews never leak phantom events). The toast
        // itself fires at doFit()'s flush point right after the scan.
        const self = ts.find(t => t.cells === p);
        (G.treatLossEvents = G.treatLossEvents || []).push({
          id: grp.tdef.id, name: grp.tdef.nm || grp.tdef.id, em: grp.tdef.em || '',
          reason: 'destroyed',
          byName: (self && self.tdef.nm) || 'Catnado', byEm: (self && self.tdef.em) || '🌪️',
        });
      }
      return { scoreMultiplier: true, m };
    };
  },
};
