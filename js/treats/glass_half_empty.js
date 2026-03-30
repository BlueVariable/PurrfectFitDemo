'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: glass_half_empty
//  +N per card drawn from deck this round (deck_size - G.deck.length)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['glass_half_empty'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats) => {
      const missing = (CFG.deck_card_count || 30) - G.deck.length;
      const bonus = amt * missing;
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = bonus; });
      return { bonusMap };
    };
  },
};
