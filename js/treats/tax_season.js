'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: tax_season
//  −$1 from current cash for EVERY treat played this fit
//  (itself included). Cash is allowed to drop below zero —
//  a deliberate "poverty engine" that pairs with cash-hungry
//  and low-cash-scaling treats. Pure economic cost: it never
//  touches the score directly, so it buffers as a no-op for
//  cats (phase 'misc' → 0 add / ×1 mul in the scan).
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['tax_season'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const n = ts.length;      // every treat on the board this fit, incl. this one
      G.cash -= n;
      return { type: 'x', cashLost: n };
    };
  },
};
