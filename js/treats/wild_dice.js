'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: wild_dice
//  ×N score multiplier with a 1-in-K trigger chance — BOTH numbers come
//  from the sheet (Effect "×3", Requirement "1 in 3 trigger CHANCE"),
//  so the card and the coin can never disagree again. Fixed 2026-08-02:
//  the code hardcoded 1-in-6 while the card promised 1-in-3 — half the
//  advertised EV. Misses pay ×1 (the miss is visible in the scan, not
//  a silent skip — wild_dice's own precedent).
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['wild_dice'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const td = TDEFS.find(t => t.id === 'wild_dice');
      const om = td && td.req && String(td.req).match(/1\s*in\s*(\d+)/i);
      const odds = om ? Math.max(1, parseInt(om[1], 10)) : 6;
      const triggered = Math.floor(Math.random() * odds) === 0;
      if (!triggered) return { scoreMultiplier: true, m: 1 };
      return { scoreMultiplier: true, m };
    };
  },
};
