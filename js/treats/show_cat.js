'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: show_cat
//  ×N the LARGEST cat on the board — deterministic single-target mul:
//  most cells wins, tie → earliest in scan order (topmost-then-leftmost
//  trigger cell). Buffered Type A rule applies as usual: the winner is
//  only multiplied if it scores at/after this treat — place it early.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['show_cat'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      if (!G.cats.length) return {};
      const trig = cat => cat.cells.reduce((best, [r, c]) =>
        (r < best[0] || (r === best[0] && c < best[1])) ? [r, c] : best, [Infinity, Infinity]);
      let best = null;
      for (const cat of G.cats) {
        const n = cat.cells.length;
        if (!best || n > best.n) { best = { cat, n, t: trig(cat) }; continue; }
        if (n === best.n) {
          const t = trig(cat);
          if (t[0] < best.t[0] || (t[0] === best.t[0] && t[1] < best.t[1])) best = { cat, n, t };
        }
      }
      return { gids: [best.cat.gid], m };
    };
  },
};
