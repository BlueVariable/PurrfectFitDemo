'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: bell
//  +N flat score bonus. Requirement 'NO OTHER TREAT' is
//  enforced centrally via REQUIREMENT_FNS (requirements.js).
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['bell'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => ({ scoreBonus: extractNum(ef) });
  },
};
