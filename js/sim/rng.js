'use strict';
// ══════════════════════════════════════════════════════
//  SIM: seeded PRNG (mulberry32)
//  Used two ways:
//    1. Installed as the iframe's Math.random so the GAME's own randomness
//       (deck shuffle, board polyomino shape, blocked cells, shop pool,
//       weighted rarity sampling, treat coin-flips like poker_face's
//       reappear roll) is fully deterministic per game seed.
//    2. A second independent stream drives the BOT's own decisions (which
//       random legal placement to pick, whether to buy this shop, etc.) so
//       bot randomness never perturbs game randomness or vice versa.
// ══════════════════════════════════════════════════════
function simMulberry32(seed){
  let a = seed >>> 0;
  const rng = function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.next = rng; // allow both rng() and rng.next() call styles
  return rng;
}

// Derive a reproducible per-game seed from (baseSeed, profile, index-within-profile).
// Documented + stable so re-running the same batch config reproduces the same games.
function simDeriveSeed(baseSeed, profile, idx){
  const profileTag = profile === 'solver' ? 1 : profile === 'greedy' ? 2 : profile === 'casual' ? 3 : 9;
  return ((baseSeed >>> 0) * 1000003 + profileTag * 100003 + idx * 37) >>> 0;
}

// A small wrapper object exposing .next() for readability at call sites
// that treat the RNG as a stream rather than a bare function.
function simRngStream(seed){
  const fn = simMulberry32(seed);
  return { next: () => fn() };
}
