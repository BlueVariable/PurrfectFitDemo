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
function calEsc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }

// ── Deadline detail ────────────────────────────────────────────────────────
// A deadline names its condition on the schedule — the round you are standing
// on and the ones still ahead alike. Nothing is rolled here: the whole week's
// conditions are drawn once at run start into G.modSchedule (rollModSchedule
// in js/state.js), so renderCalendar() stays pure DOM with no RNG draw, and
// the round plays the very modifier its card advertised.
function calModFor(round){
  if(round === G.round && G.roundModifier) return G.roundModifier;
  return (G.modSchedule && G.modSchedule[round]) || null;
}
function calDeadlinePool(){
  return (typeof MODIFIERS !== 'undefined' ? MODIFIERS : []).filter(m => m.enabled);
}
function calModChips(){
  const pool = calDeadlinePool();
  if(!pool.length) return '';
  return '<div class="sc-dl-chips">' + pool.map(m =>
    '<span class="sc-dl-chip" title="' + calEsc(m.name) + ' — ' + calEsc(m.desc) + '">' +
      calEsc(m.em || '⚠️') + '</span>').join('') + '</div>';
}
// Fallback only — a run whose schedule came up empty (Modifiers tab failed to
// load): state the rules of the day and preview the pool it can draw from.
function calDeadlinePreview(){
  return '<div class="sc-dl"><div class="sc-dl-hd">⏰ DEADLINE</div>' +
    '<div class="sc-dl-note">No break — this one gets worked.</div>' +
    '<div class="sc-dl-note">One of these lands on the day:</div>' +
    calModChips() + '</div>';
}
// The deadline itself: name it and say what it does.
function calDeadlineCard(rm, now){
  return '<div class="sc-dl' + (now ? ' sc-dl-now' : '') + '"><div class="sc-dl-hd">⏰ DEADLINE</div>' +
    '<div class="sc-dl-name">' + calEsc(rm.em || '⚠️') + ' ' +
      calEsc(String(rm.name || rm.id || '').toUpperCase()) + '</div>' +
    // .pf-figs: the condition is the one string on the card carrying figures
    // ("TARGET SCORE 15% HIGHER"), and the marker face's % reads as ×.
    (rm.desc ? '<div class="sc-dl-desc pf-figs">' + calEsc(rm.desc) + '</div>' : '') +
    '</div>';
}

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

// ── What a round ahead will ACTUALLY deal ─────────────────────────────────
// A preview card used to print the sheet's raw row, so a branch that grants
// +1 hand showed 5 HANDS on the round being played and 4 on every round after
// it — reading as if the perk were about to be taken away. These mirror what
// the round's own setup will do to that row (applyModifiers() / dealHand() /
// advanceRoundSetup()), so a preview card and the active card it becomes agree.
// All of it is read off state drawn at run start — no Math.random, ever:
// renderCalendar() must stay RNG-free for the headless sim.
function calBranchMods(){
  return (typeof G !== 'undefined' && G.modifiers)
    ? G.modifiers.split('|').map(m => m.trim()).filter(Boolean) : [];
}
// A SKIP taken on the current round pays out to the NEXT one. advanceRoundSetup()
// normally consumes the bonus before the calendar paints (so this is null), but
// honour it when it hasn't been so the preview never lags the state.
function calPendingFor(round){
  return (round === G.round + 1 && G.breakPending) ? G.breakPending : null;
}
function calPreviewHands(round, cfg, rm){
  let h = (cfg && cfg.h) || CFG.hand_count || 3;
  calBranchMods().forEach(mod => {
    if(mod === 'hands-1') h = Math.max(1, h - 1);
    else if(mod.indexOf('hands+') === 0) h += (parseInt(mod.slice(6)) || 0);
  });
  if(typeof applyHandsDelta === 'function') h = applyHandsDelta(h, rm);
  const p = calPendingFor(round);
  if(p && p.hands) h = Math.max(1, h + p.hands);
  return h;
}
function calPreviewDiscards(round, rm){
  const mods = calBranchMods();
  let d = mods.indexOf('no-discard') >= 0 ? 0
        : (CFG.discard_count || 3) + mods.filter(m => m.indexOf('discards+') === 0)
            .reduce((s, m) => s + (parseInt(m.slice(9)) || 0), 0);
  if(typeof applyDiscardsZero === 'function') d = applyDiscardsZero(d, rm);
  const p = calPendingFor(round);
  if(p && p.discards) d = Math.max(0, d + p.discards);
  return d;
}
function calPreviewTarget(round, cfg, rm){
  let t = (cfg && cfg.tgt) || 0;
  if(typeof applyTargetMult === 'function') t = applyTargetMult(t, rm);
  const p = calPendingFor(round);
  if(p && p.target) t = Math.max(1, Math.round(t * (1 + p.target / 100)));
  return t;
}
function calPreviewEarn(cfg, rm){
  const e = (cfg && cfg.earn) || 0;
  return (typeof applyEarnMult === 'function') ? applyEarnMult(e, rm) : e;
}

// ── Purrfect rate ─────────────────────────────────────────────────────────
// What a full box pays per cell, which steps up once per work-week day. The
// prep and in-game chips that print it (#rds-purrfect / #g-purrfect-rate) both
// sit in hidden kept-for-JS containers, so the schedule is the only place the
// player is told. Active card only — it's the rate you're about to play for.
// purrfectPerCell() is pure config maths, so this stays RNG-free.
function calPurrfectChip(round){
  if(typeof purrfectPerCell !== 'function') return '';
  const per = purrfectPerCell(round);
  if(!(per > 0)) return '';
  return '<div class="sc-purrfect">✨ PURRFECT <b>+' + per + '</b>/CELL</div>';
}
function calDoneCard(r){
  const log = (G.roundLog && G.roundLog[r]) || {};
  const cfg = (typeof rcfg === 'function') ? rcfg(r) : null;
  // The target actually played (a deadline's target_mult is already in it);
  // the raw sheet row is only the fallback for logs written before it was kept.
  const tgt = log.tgt || (cfg ? cfg.tgt : 0) || 0;
  if(log.skipped){
    return '<div class="sc-card sc-past"><div class="sc-tab">#' + ((r-1)%CAL_ROUNDS_PER_DAY+1) +
      '<span>ORDER OF THE DAY</span></div><div class="sc-body">' +
      '<div class="sc-verdict">BREAK</div><div class="sc-sub">day off</div></div></div>';
  }
  const scored = log.score;
  // Hands used out of the hands that round actually DEALT — roundWin() stamps
  // both off G.maxHands, which every mid-setup grant (a SKIP bonus's +1 hand)
  // keeps in step. The fallback is the used count itself, never a made-up
  // ceiling: a log with no max is better read as "4/4" than as "4/3".
  const hands  = log.hands, hmax = log.handsMax || log.max || log.hands || 0;
  const pf = log.purrfects, pfmax = log.purrfectsMax;
  // A cleared deadline says so — the stamp is the record of the week.
  const stamp = log.boss ? '<div class="sc-dl-done">⏰ DEADLINE MET' +
    (log.modName ? '<small>' + calEsc(String(log.modName).toUpperCase()) + '</small>' : '') +
    '</div>' : '';
  return '<div class="sc-card sc-past' + (log.boss ? ' sc-boss' : '') + '"><div class="sc-tab">#' +
    ((r-1)%CAL_ROUNDS_PER_DAY+1) +
    '<span>ORDER OF THE DAY</span></div><div class="sc-body">' +
    '<div class="sc-verdict">PURRFECT!</div>' +
    '<div class="sc-sub">SCORED</div><div class="sc-score">' + (scored!==undefined?scored:'—') +
      '<small>/' + tgt + '</small></div>' +
    '<div class="sc-mini"><div><span>HANDS</span><b>' + (hands!==undefined?hands:'—') + '/' + hmax + '</b></div>' +
      '<div><span>PURRFECT FITS</span><b>' + (pf!==undefined?pf:'—') + '/' + (pfmax||hmax) + '</b></div></div>' +
    stamp + '</div></div>';
}
function calNextCard(r){
  const cfg = (typeof rcfg === 'function') ? rcfg(r) : null;
  // A deadline still ahead names the condition it will land with, read from
  // the schedule drawn at run start — never rolled here (renderCalendar must
  // stay RNG-free for the headless sim).
  const boss = calIsBoss(r);
  const rm = boss ? calModFor(r) : null;
  return '<div class="sc-card sc-future' + (boss ? ' sc-boss' : '') + '"><div class="sc-tab">#' +
    ((r-1)%CAL_ROUNDS_PER_DAY+1) + '<span>ORDER OF THE DAY</span></div><div class="sc-body">' +
    '<div class="sc-sub">REACH SCORE</div><div class="sc-target">' +
      (cfg ? calPreviewTarget(r, cfg, rm) : '—') + '</div>' +
    '<div class="sc-pills">' + calStatPill(cfg ? calPreviewHands(r, cfg, rm) : '—', 'HANDS') +
      calStatPill(calPreviewDiscards(r, rm), 'DISCARDS') +
      calStatPill(cfg ? calPreviewEarn(cfg, rm) : '—', 'EARN', true) + '</div>' +
    (rm ? calDeadlineCard(rm, false) : boss ? calDeadlinePreview() : '') +
    '</div></div>';
}
function calActiveCard(r){
  const offer = (typeof breakOffer === 'function') ? breakOffer(r) : null;
  const armed = (typeof _breakArmed !== 'undefined') && _breakArmed;
  const boss = calIsBoss(r);
  const skip = offer
    ? '<div class="sc-fork-col"><span class="sc-fork-lbl">TAKE A BREAK</span>' +
      '<button class="sc-skip' + (armed ? ' armed' : '') + '" id="cal-skip-btn" onclick="takeBreak()">' +
        (armed ? 'SURE?' : 'SKIP') + '</button>' +
      '<div class="sc-bonus">' + ((typeof breakLabel === 'function') ? breakLabel(offer) : offer.label) + '</div></div>'
    : (boss
      ? '<div class="sc-fork-col"><span class="sc-fork-lbl">TAKE A BREAK</span>' +
        '<div class="sc-noskip">NO BREAKS</div>' +
        '<div class="sc-bonus">a deadline gets worked</div></div>'
      : '');
  return '<div class="sc-card sc-now' + (boss ? ' sc-boss' : '') + '"><div class="sc-tab sc-tab-now">#' +
    ((r-1)%CAL_ROUNDS_PER_DAY+1) +
    '<span>ORDER OF THE DAY</span></div><div class="sc-body">' +
    '<div class="sc-sub">TARGET SCORE</div><div class="sc-target sc-red">' + (G.tgt || 0) + '</div>' +
    '<div class="sc-pills">' + calStatPill(G.hands || 0, 'HANDS') +
      calStatPill(G.disc || 0, 'DISCARDS') + calStatPill(G.earn || 0, 'EARN', true) + '</div>' +
    calPurrfectChip(r) +
    (calModFor(r) ? calDeadlineCard(calModFor(r), true) : '') +
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
