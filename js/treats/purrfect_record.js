'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: purrfect_record
//  ×(1 + 0.2 per board fill this run) — grows each time
//  the board is completely filled during scoring
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['purrfect_record'] = {
  buildFn(ef, phase, addEf) {
    const baseM = extractMul(ef);
    let increment = 0.2;
    if (addEf) {
      const im = addEf.match(/([\d.]+)/);
      if (im) increment = parseFloat(im[1]);
    }
    return (b, cats, ts, p, cs) => {
      const fills = G.treatPlayCounts.board_fills || 0;
      const filledCount = G.board.flat().filter(c => c.filled).length;
      const boardFull = filledCount === G.bsr * G.bsc;
      if (boardFull) G.treatPlayCounts.board_fills = fills + 1;
      const m = Math.round((baseM + fills * increment) * 100) / 100;
      return { scoreMultiplier: true, m };
    };
  },
};
