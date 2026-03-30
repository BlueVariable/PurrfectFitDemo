'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: cardboard_box
//  +N per card in hand to ALL cats, N increases per play
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['cardboard_box'] = {
  buildFn(ef, phase, addEf) {
    const baseAmt = extractNum(ef);
    let increase = 0;
    if (addEf) {
      const im = addEf.match(/(\d+)/);
      if (im) increase = parseInt(im[1]);
    }
    return (b, cats) => {
      const plays = G.treatPlayCounts.cardboard_box || 0;
      const amt = baseAmt + plays * increase;
      G.treatPlayCounts.cardboard_box = plays + 1;
      const bonus = amt * G.hand.length;
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = bonus; });
      return { bonusMap };
    };
  },
};
