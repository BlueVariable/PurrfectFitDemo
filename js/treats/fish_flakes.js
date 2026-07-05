'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: fish_flakes
//  +N flat score bonus (vanilla baseline)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['fish_flakes'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => ({ scoreBonus: extractNum(ef) });
  },
};
