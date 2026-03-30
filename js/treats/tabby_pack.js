'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: tabby_pack
//  ×N all TABBY cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['tabby_pack'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const gids = Object.keys(cs).filter(gid => {
        const grp = cats.find(c => c.gid === gid);
        return grp && grp.type === 'tabby';
      });
      return { gids, m };
    };
  },
};
