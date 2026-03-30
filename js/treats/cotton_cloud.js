'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: cotton_cloud
//  ×N all WHITE cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['cotton_cloud'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const gids = Object.keys(cs).filter(gid => {
        const grp = cats.find(c => c.gid === gid);
        return grp && grp.type === 'white';
      });
      return { gids, m };
    };
  },
};
