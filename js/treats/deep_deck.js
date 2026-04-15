'use strict';
TREAT_REGISTRY['deep_deck'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const remaining = (G.deck && G.deck.length) || 0;
      return { scoreBonus: amt * remaining };
    };
  },
};
