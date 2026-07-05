'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: second_chance
//  +N if you USED a DISCARD this hand (G.discUsedHand,
//  a per-hand counter reset in dealHand() and incremented
//  in doDiscard() alongside the per-round G.discUsedRound).
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['second_chance'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => ({ scoreBonus: (G.discUsedHand || 0) > 0 ? amt : 0 });
  },
};
