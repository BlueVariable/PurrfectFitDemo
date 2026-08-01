'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: diva
//  ×N the NEXT cat in SCAN ORDER, growing each time triggered — the
//  scaling twin of opening_act. Counter pattern (one_shot precedent):
//  increments on every trigger, INCLUDING a play with no cat after it
//  in scan order (she performed; nobody watched) — place her early.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['diva'] = {
  buildFn(ef, phase, addEf) {
    const baseM = extractMul(ef);
    let inc = 0;
    if (addEf) { const im = addEf.match(/([\d.]+)/); if (im) inc = parseFloat(im[1]); }
    return (b, cats, ts, p, cs) => {
      const plays = G.treatPlayCounts.diva || 0;
      G.treatPlayCounts.diva = plays + 1;
      const m = Math.round((baseM + plays * inc) * 100) / 100;
      if (!cats.length) return {};
      return { gids: [cats[0].gid], m };
    };
  },
  currentValue() {
    const td = TDEFS.find(t => t.id === 'diva');
    if (!td) return null;
    const baseM = extractMul(td.ef);
    let inc = 0;
    if (td.addEf) { const im = td.addEf.match(/([\d.]+)/); if (im) inc = parseFloat(im[1]); }
    const m = Math.round((baseM + (G.treatPlayCounts.diva || 0) * inc) * 100) / 100;
    return `Now: ×${m}`;
  },
};
