'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: head_scritches
//  ×N the NEXT cat in SCAN ORDER
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['head_scritches'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      if (!cats.length) return {};
      return { gids: [cats[0].gid], m };
    };
  },
};
