'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: bell
//  Type B multiplier: ×N the accumulated running total at
//  its scan position. Requirement 'NO OTHER TREAT' is
//  enforced centrally via REQUIREMENT_FNS (requirements.js),
//  making it the anti-build solo line.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['bell'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => ({ scoreMultiplier: true, m });
  },
};
