'use strict';
// ══════════════════════════════════════════════════════
//  THE WORK WEEK ☕📅 — calendar hub between rounds
//
//  The landing screen after every round win, at run start, and after a café
//  visit. It lays the whole run out as a work week: days of 3 rounds each
//  (2 regular "fits" + 1 boss "deadline" — bosses land on General!modifier_
//  rounds, kept in sync at 3,6,9,12,15). Past rounds are stamped with the
//  number of hands they took (fewer = faster), a coffee-break'd round gets a
//  ☕ stamp, the current round is highlighted, future rounds are locked.
//  From here the player forks:
//    🏪 Go to Shop   → the existing shop/prep screen, then Play Round
//    ☕ Coffee Break → skip the round & draft a free treat (js/cafe.js)
//
//  SIM-SAFETY: openCalendar() delegates to openRounds() for ALL state setup
//  (shop pool, rounds track, modifier card) exactly as before, then reveals
//  the calendar on top. The headless sim (sim.html) drives rounds by calling
//  selectBranch()/goShop() — which now reach openCalendar → openRounds — so
//  the shop pool is still generated with the identical single Math.random
//  draw per round. The sim reads game state, never the calendar screen, and
//  calls startRound()/goShop() directly, so the extra screen is inert to it.
//  renderCalendar() is pure DOM (no Math.random), preserving sim RNG order.
// ══════════════════════════════════════════════════════

const CAL_ROUNDS_PER_DAY = 3;
const CAL_DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function calDayCount(){ return Math.ceil(RCFG.length / CAL_ROUNDS_PER_DAY); }
function calDayName(dayIdx){ return CAL_DAY_NAMES[dayIdx] || ('DAY ' + (dayIdx + 1)); }
function calDayIndexOf(round){ return Math.floor((round - 1) / CAL_ROUNDS_PER_DAY); }
function calIsBoss(round){ return (typeof isModifierRound === 'function') && isModifierRound(round); }

// ── Entry: run the existing round/shop setup, then show the calendar ──
function openCalendar(){
  if(typeof breakDisarm==='function')breakDisarm();
  openRounds();        // shop pool + shop render + rounds track + show('s-rounds')
  renderCalendar();
  show('s-calendar');  // reveal the week on top (synchronous — s-rounds never paints)
}

// ── Fork actions ──
function goToShopFromCalendar(){
  if(typeof breakDisarm==='function')breakDisarm();
  // The shop was fully set up by the openRounds() inside openCalendar — just
  // reveal it. NOT a fresh openRounds(), so the treat pool never re-rolls when
  // bouncing calendar⇄shop (no free reroll-fishing).
  show('s-rounds');
}
function backToCalendar(){
  if(typeof breakDisarm==='function')breakDisarm();
  renderCalendar();
  show('s-calendar');
}


// ── Render (deck page 7) ───────────────────────────────────────────────────
// One card per round of the CURRENT day: rounds already played show their
// result, the active round shows its order and the WORK / SKIP fork, and later
// rounds show a preview with their modifier if they carry one.
function calStatPill(v, lbl, coin){
  return '<div class="sc-pill"><b>' + v + (coin ? '<img src="assets/ui/coin.png" alt="">' : '') +
         '</b><span>' + lbl + '</span></div>';
}
function calDoneCard(r){
  const log = (G.roundLog && G.roundLog[r]) || {};
  const cfg = (typeof rcfg === 'function') ? rcfg(r) : null;
  const tgt = (cfg ? cfg.tgt : 0) || 0;
  if(log.skipped){
    return '<div class="sc-card sc-past"><div class="sc-tab">#' + ((r-1)%CAL_ROUNDS_PER_DAY+1) +
      '<span>ORDER OF THE DAY</span></div><div class="sc-body">' +
      '<div class="sc-verdict">BREAK</div><div class="sc-sub">day off</div></div></div>';
  }
  const scored = log.score;
  const hands  = log.hands, hmax = log.handsMax || CAL_ROUNDS_PER_DAY;
  const pf = log.purrfects, pfmax = log.purrfectsMax;
  return '<div class="sc-card sc-past"><div class="sc-tab">#' + ((r-1)%CAL_ROUNDS_PER_DAY+1) +
    '<span>ORDER OF THE DAY</span></div><div class="sc-body">' +
    '<div class="sc-verdict">PURRFECT!</div>' +
    '<div class="sc-sub">SCORED</div><div class="sc-score">' + (scored!==undefined?scored:'—') +
      '<small>/' + tgt + '</small></div>' +
    '<div class="sc-mini"><div><span>HANDS</span><b>' + (hands!==undefined?hands:'—') + '/' + hmax + '</b></div>' +
      '<div><span>PURRFECT FITS</span><b>' + (pf!==undefined?pf:'—') + '/' + (pfmax||hmax) + '</b></div></div>' +
    '</div></div>';
}
function calNextCard(r){
  const cfg = (typeof rcfg === 'function') ? rcfg(r) : null;
  // Never roll a future round's modifier here — pickRoundModifier() draws from
  // the shared RNG and the headless sim depends on exactly one draw per round.
  // A future deadline round only advertises that it IS one.
  const tag = calIsBoss(r) ? '<div class="sc-modtag">DEADLINE ROUND</div>' : '';
  return '<div class="sc-card sc-future"><div class="sc-tab">#' + ((r-1)%CAL_ROUNDS_PER_DAY+1) +
    '<span>ORDER OF THE DAY</span></div><div class="sc-body">' +
    '<div class="sc-sub">REACH SCORE</div><div class="sc-target">' + (cfg ? cfg.tgt : '—') + '</div>' +
    '<div class="sc-pills">' + calStatPill(cfg ? (cfg.h || CFG.hand_count || 3) : '—', 'HANDS') +
      calStatPill(CFG.discard_count || 3, 'DISCARDS') + '</div>' +
    '</div>' + tag + '</div>';
}
function calActiveCard(r){
  const offer = (typeof breakOffer === 'function') ? breakOffer(r) : null;
  const armed = (typeof _breakArmed !== 'undefined') && _breakArmed;
  const skip = offer
    ? '<div class="sc-fork-col"><span class="sc-fork-lbl">TAKE A BREAK</span>' +
      '<button class="sc-skip' + (armed ? ' armed' : '') + '" id="cal-skip-btn" onclick="takeBreak()">' +
        (armed ? 'SURE?' : 'SKIP') + '</button>' +
      '<div class="sc-bonus">' + offer.label + '</div></div>'
    : '';
  return '<div class="sc-card sc-now"><div class="sc-tab sc-tab-now">#' + ((r-1)%CAL_ROUNDS_PER_DAY+1) +
    '<span>ORDER OF THE DAY</span></div><div class="sc-body">' +
    '<div class="sc-sub">TARGET SCORE</div><div class="sc-target sc-red">' + (G.tgt || 0) + '</div>' +
    '<div class="sc-pills">' + calStatPill(G.hands || 0, 'HANDS') +
      calStatPill(G.disc || 0, 'DISCARDS') + calStatPill(G.earn || 0, 'EARN', true) + '</div>' +
    (G.roundModifier ? '<div class="sc-modtag sc-modtag-now">' + String(G.roundModifier.name || G.roundModifier.id || '').toUpperCase() + '</div>' : '') +
    '<div class="sc-fork">' +
      '<div class="sc-fork-col"><span class="sc-fork-lbl">CONTINUE TO SHOP</span>' +
        '<button class="sc-work" onclick="goToShopFromCalendar()">WORK</button></div>' +
      skip +
    '</div></div></div>';
}
function renderCalendar(){
  const day = calDayIndexOf(G.round);
  const first = day * CAL_ROUNDS_PER_DAY + 1;
  const wrap = g('cal-week'); if(!wrap) return;
  let html = '';
  for(let i = 0; i < CAL_ROUNDS_PER_DAY; i++){
    const r = first + i;
    if(r > RCFG.length) continue;
    html += r < G.round ? calDoneCard(r) : (r === G.round ? calActiveCard(r) : calNextCard(r));
  }
  wrap.innerHTML = html;

  const br = (typeof BRANCHES !== 'undefined') && BRANCHES.find(b => b.id === G.branchId);
  const nm = g('cal-branch'); if(nm) nm.textContent = (br && br.name) || '';
  const dt = g('cal-daytab');
  if(dt) dt.textContent = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'][day] || ('DAY ' + (day+1));
  const cash = g('cal-cash'); if(cash) cash.textContent = G.cash;
}
// kept as a no-op seam: breaks.js re-renders through it after arming SKIP
function renderCalChoose(){ renderCalendar(); }
