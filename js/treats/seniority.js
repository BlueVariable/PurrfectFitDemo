'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: seniority
//  +N to the score, +M more each time TRIGGERED — the scaling flat add
//  (the add-class sibling of one_shot/purebred's growing multipliers).
//  Counter pattern: G.treatPlayCounts, bounded by once-per-round
//  triggers (≤15/run), so the ceiling is base + 14×inc on Friday.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['seniority'] = {
  buildFn(ef, phase, addEf) {
    const base = extractNum(ef);
    let inc = 0;
    if (addEf) { const im = addEf.match(/([\d.]+)/); if (im) inc = parseFloat(im[1]); }
    return (b, cats, ts, p, cs) => {
      const plays = G.treatPlayCounts.seniority || 0;
      G.treatPlayCounts.seniority = plays + 1;
      return { scoreBonus: base + plays * inc };
    };
  },
  currentValue() {
    const td = TDEFS.find(t => t.id === 'seniority');
    if (!td) return null;
    const base = extractNum(td.ef);
    let inc = 0;
    if (td.addEf) { const im = td.addEf.match(/([\d.]+)/); if (im) inc = parseFloat(im[1]); }
    return `Now: +${base + (G.treatPlayCounts.seniority || 0) * inc}`;
  },
};
