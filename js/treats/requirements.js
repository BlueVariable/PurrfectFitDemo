'use strict';
// ══════════════════════════════════════════════════════
//  TREAT REQUIREMENTS
//  requirementFails(req) → true if the requirement is
//  NOT currently met (treat should show warning).
//  req is the string from the sheet's Requirement column.
// ══════════════════════════════════════════════════════
// A "purrfect" board = every PLAYABLE cell filled (off-shape/blocked cells
// never fill, so comparing against the full grid would never be true).
function _isPurrfect() {
  const cells = G.board.flat();
  const playable = cells.filter(c => !c.blocked && !c.offShape).length;
  const filled = cells.filter(c => c.filled).length;
  return playable > 0 && filled === playable;
}

const REQUIREMENT_FNS = {
  'PURRFECT FIT!': () => !_isPurrfect(),
  'NO OTHER TREAT': () => G.treats.length > 1,
  'NO SAME TYPE ADJACENT': () => {
    for (const cat of G.cats) {
      for (const other of G.cats) {
        if (cat.gid === other.gid || cat.type !== other.type) continue;
        const adj = cat.cells.some(([r, c]) =>
          other.cells.some(([r2, c2]) => Math.abs(r - r2) <= 1 && Math.abs(c - c2) <= 1)
        );
        if (adj) return true;
      }
    }
    return false;
  },
  'NEEDS ORANGE':   () => !G.cats.some(c => c.type === 'orange'),
  'ALL SAME TYPE':  () => {
    const types = [...new Set(G.cats.map(c => c.type))];
    return types.length > 1;
  },
  'BOARD FULL': () => !_isPurrfect(),
  'LAST HAND':            () => G.hands > 1,
  'NO DISCARDS REMAINING': () => G.disc > 0,
  "SAME TYPE cats can't be adjacent to each other": () => {
    for (const cat of G.cats) {
      for (const other of G.cats) {
        if (cat.gid === other.gid || cat.type !== other.type) continue;
        const adj = cat.cells.some(([r, c]) =>
          other.cells.some(([r2, c2]) => Math.abs(r - r2) <= 1 && Math.abs(c - c2) <= 1)
        );
        if (adj) return true;
      }
    }
    return false;
  },
  'All cats must be of the SAME TYPE': () => {
    const types = [...new Set(G.cats.map(c => c.type))];
    return types.length > 1;
  },
  'All cats must be of the SAME SHAPE': () => {
    const shapes = [...new Set(G.cats.map(c => c.shape))];
    return shapes.length > 1;
  },
  // Every board row that has at least one PLAYABLE cell must hold at least
  // one cat cell. Rows that are entirely off-shape/blocked are exempt —
  // the silhouette can't demand a cat where no cat can go.
  'EVERY ROW must contain a CAT': () => {
    const catRows = new Set();
    G.cats.forEach(cat => cat.cells.forEach(([r]) => catRows.add(r)));
    for (let r = 0; r < G.bsr; r++) {
      const playable = G.board[r].some(c => !c.blocked && !c.offShape);
      if (playable && !catRows.has(r)) return true;
    }
    return false;
  },
  'All BOARD cells are FULL': () => !_isPurrfect(),
  'LAST HAND only': () => G.hands > 1,
  'FIRST HAND only': () => G.hands !== G.maxHands,
  '3+ cats must SHARE a SHAPE': () => _lacksTripleShape(),
  // Normalized wording (2026-08-01) — same check; the old string above stays
  // as an alias because req strings are both card text AND lookup keys.
  '3+ cats must be of the SAME SHAPE': () => _lacksTripleShape(),
};

function _lacksTripleShape() {
  const counts = {};
  for (const cat of G.cats) counts[cat.shape] = (counts[cat.shape] || 0) + 1;
  return !Object.values(counts).some(n => n >= 3);
}

function requirementFails(req) {
  if (!req) return false;
  const fn = REQUIREMENT_FNS[req];
  return fn ? fn() : false;
}
