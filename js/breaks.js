'use strict';
// ══════════════════════════════════════════════════════
//  BREAKS — the SKIP bonus pool (Breaks sheet tab)
// ══════════════════════════════════════════════════════
// SKIP is the between-rounds fork: the schedule offers WORK or SKIP side by
// side, and SKIP forfeits the round in exchange for one bonus drawn from the
// pool. The bonus is rolled *before* the
// choice and shown under the button — the player is picking a known trade, not
// gambling. It is rolled deterministically from the round number so re-renders
// (and the headless sim) always see the same offer for the same round.
//
// SKIP is not offered on modifier/"deadline" rounds — those are the ones the
// week is built around, so they have to be played.

function breakRoundSeed(round){
  // Small deterministic hash; branch id keeps two runs from offering the same
  // sequence of bonuses on the same rounds.
  const key = String((typeof G!=='undefined' && G.branchId) || '') + '#' + round;
  let h = 2166136261;
  for(let i=0;i<key.length;i++){ h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h>>>0);
}

// The bonus this round's SKIP would grant, or null when SKIP is unavailable.
function breakOffer(round){
  const r = round || (typeof G!=='undefined' ? G.round : 1);
  if(typeof isModifierRound==='function' && isModifierRound(r)) return null;  // deadline round
  if(typeof BREAKS==='undefined' || !BREAKS.length) return null;
  const total = BREAKS.reduce((s,b)=>s+b.weight,0);
  if(total<=0) return null;
  let n = breakRoundSeed(r) % total;
  for(const b of BREAKS){ n -= b.weight; if(n<0) return b; }
  return BREAKS[BREAKS.length-1];
}
function breakAvailable(round){ return !!breakOffer(round); }

// The Breaks sheet writes its labels in the plural ("+1 HANDS NEXT ROUND"), so
// make the counted noun agree with the number in front of it before the chip
// goes on screen. Casing follows the label's own (HANDS/hands), and a label
// with nothing to agree comes back untouched.
function breakLabel(b){
  return String((b && b.label) || '').replace(/(\d+)(\s*)(HANDS?|DISCARDS?)\b/gi, (m, n, sp, w) => {
    const stem = w.replace(/s$/i, '');
    return n + sp + (Number(n) === 1 ? stem : stem + (w === w.toUpperCase() ? 'S' : 's'));
  });
}

// Effects are "<what><+/-><amount>": hands+N, discards+N, cash+N, target-N (percent).
// Round-scoped ones are stashed on G.breakPending and consumed by the next
// round's setup in goShop(); cash lands immediately.
function breakApply(b){
  if(!b) return;
  const m = String(b.effect).match(/^([a-z]+)([+-])(\d+)$/i);
  if(!m) return;
  const [,what,sign,numStr] = m;
  const n = Number(numStr) * (sign==='-'?-1:1);
  if(what==='cash'){ G.cash = Math.max(0, (G.cash||0) + n); return; }
  G.breakPending = G.breakPending || {};
  G.breakPending[what] = (G.breakPending[what]||0) + n;
}

// Called from the next round's setup once the new values are in place.
function breakConsumePending(){
  const p = G.breakPending; if(!p) return;
  if(p.hands){
    const before = G.hands||0;
    G.hands = Math.max(1, before + p.hands);
    // G.maxHands is "hands this round was dealt", and applyModifiers() set it
    // just before this ran — so it has to move with the grant. Without the bump
    // a round dealt 6 hands (5 + this bonus) and cleared in 4 gets stamped
    // "HANDS 3/5" on the schedule, and 'FIRST HAND only' treats never see a
    // first hand (G.hands would start one above G.maxHands, never equal to it).
    G.maxHands = Math.max(1, (G.maxHands||before) + (G.hands - before));
  }
  if(p.discards) G.disc  = Math.max(0, (G.disc||0)  + p.discards);
  if(p.target)   G.tgt   = Math.max(1, Math.round((G.tgt||0) * (1 + p.target/100)));
  G.breakPending = null;
}

// ── Taking the break ────────────────────────────────────────────────────────
// Commit order: drop held → log the skip → width reconcile → advance round →
// shared setup. The round is forfeited the moment this runs.
let _breakArmed = false, _breakTimer = null;
function breakDisarm(){
  _breakArmed = false;
  if(_breakTimer){ clearTimeout(_breakTimer); _breakTimer = null; }
}
function takeBreak(){
  const offer = breakOffer(G.round);
  if(!offer) return;
  // two-click confirm
  if(!_breakArmed){
    _breakArmed = true;
    const btn = g('cal-skip-btn'); if(btn) btn.classList.add('armed');
    if(_breakTimer) clearTimeout(_breakTimer);
    _breakTimer = setTimeout(()=>{ breakDisarm(); if(typeof renderCalChoose==='function') renderCalChoose(); }, 4000);
    if(typeof renderCalChoose==='function') renderCalChoose();
    return;
  }
  breakDisarm();

  if(H.kind==='treat')dropHeld();
  else if(H.kind){H=resetH();updateGhost();hideHUD();}

  const skipped = G.round;
  if(G.roundLog)G.roundLog[skipped]={skipped:true,boss:false};
  breakApply(offer);        // cash lands now; round-scoped bonuses queue for the next setup
  bpReconcileWidth();
  // The shop stays OPEN after a skip. SKIP's cost is the forfeited round (no
  // earnings, no progress) and its price is already paid there — boarding the
  // next prep's shelf up on top of that taxed the same choice twice and made
  // the bonus you were shown a worse trade than it read.
  G.round++;
  advanceRoundSetup();
  openCalendar();
}
