'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: tuna
//  Multiplies all orange cat groups by ×N
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['tuna'] = {
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
