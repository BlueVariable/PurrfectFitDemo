'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: red_carpet
//  +N to the NEXT cat in SCAN ORDER — the flat twin of head_scritches'
//  ×2: feeds the star's base BEFORE single-cat multipliers compound on
//  it (score = (base + adds) × muls). Clutch entry rung.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['red_carpet'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      if (!cats.length) return {};
      return { bonusMap: { [cats[0].gid]: amt } };
    };
  },
};
