'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: opening_act
//  ×N the NEXT cat in SCAN ORDER
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['opening_act'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      if (!cats.length) return {};
      return { gids: [cats[0].gid], m };
    };
  },
};
