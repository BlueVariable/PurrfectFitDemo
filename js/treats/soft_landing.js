'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: soft_landing
//  Passive — saves the round on failure, then disappears.
//  Real logic lives in endScoreSequence (scoring.js).
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['soft_landing'] = {
  buildFn(ef, phase) {
    return () => ({ scoreMultiplier: true, m: 1 });
  },
};
