'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: tuna_can
//  ×N all orange cat groups
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['tuna_can'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const gids = Object.keys(cs).filter(gid => {
        const grp = cats.find(c => c.gid === gid);
        return grp && grp.type === 'orange';
      });
      return { gids, m };
    };
  },
};
