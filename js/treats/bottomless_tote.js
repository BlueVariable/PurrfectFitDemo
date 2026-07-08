'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: bottomless_tote
//  Passive: +1 backpack COLUMN while owned (does not stack).
//  The real effect lives in the engine, not here: getBPC()
//  (state.js) adds a column whenever bpToteOwned() sees the
//  tote anywhere in the player's possession — inventory,
//  board, usedTreats, or on the cursor — and bpEnsureWidth /
//  bpReconcileWidth (backpack.js) keep the physical G.bp grid
//  in sync, reflowing (never destroying) treats on shrink.
//  At scoring time it does nothing; the fn just announces
//  itself in the score log like other x-phase passives.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['bottomless_tote'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      return { type: 'x', announce: 'holding the bags (+1 backpack column)' };
    };
  },
};
