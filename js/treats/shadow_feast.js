'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: shadow_feast
//  ×N all BLACK cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['shadow_feast'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const gids = Object.keys(cs).filter(gid => {
        const grp = cats.find(c => c.gid === gid);
        return grp && grp.type === 'black';
      });
      return { gids, m };
    };
  },
};
