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
  _calCbDisarm();
  openRounds();        // shop pool + shop render + rounds track + show('s-rounds')
  renderCalendar();
  show('s-calendar');  // reveal the week on top (synchronous — s-rounds never paints)
}

// ── Fork actions ──
function goToShopFromCalendar(){
  _calCbDisarm();
  // The shop was fully set up by the openRounds() inside openCalendar — just
  // reveal it. NOT a fresh openRounds(), so the treat pool never re-rolls when
  // bouncing calendar⇄shop (no free reroll-fishing).
  show('s-rounds');
}
function backToCalendar(){
  _calCbDisarm();
  renderCalendar();
  show('s-calendar');
}

// ── Coffee Break, driven from the calendar card (lightweight two-click confirm) ──
let _calCbArmed = false, _calCbTimer = null;
function _calCbDisarm(){
  _calCbArmed = false;
  if(_calCbTimer){ clearTimeout(_calCbTimer); _calCbTimer = null; }
}
function calCoffeeBreak(){
  if(typeof coffeeBreakAvailable !== 'function' || !coffeeBreakAvailable()) return;
  if(!_calCbArmed){
    _calCbArmed = true;
    const card = g('cal-cb-card'); if(card) card.classList.add('armed');
    const t = g('cal-cb-title'); if(t) t.textContent = 'Skip today? ☕';
    if(_calCbTimer) clearTimeout(_calCbTimer);
    _calCbTimer = setTimeout(() => { _calCbDisarm(); renderCalChoose(); }, 4000);
    return;
  }
  _calCbDisarm();
  openCafe();  // commits the skip immediately (js/cafe.js)
}

// ── Render ──
function calHandBoxes(used, max){
  const m = Math.max(1, max || 1);
  const u = Math.max(0, Math.min(m, used || 0));
  let h = '<div class="cal-boxes">';
  for(let i = 0; i < m; i++) h += '<span class="cal-box' + (i < u ? ' fill' : '') + '"></span>';
  return h + '</div>';
}

function calCell(r, lg){
  const boss = calIsBoss(r);
  const st = r < G.round ? 'done' : (r === G.round ? 'today' : 'future');
  const cfg = (typeof rcfg === 'function') ? rcfg(r) : null;
  const tgt = (r === G.round ? G.tgt : (cfg ? cfg.tgt : 0)) || 0;

  let top = '<div class="cal-cell-top"><span class="cal-rnum">Round ' + r + '</span>' +
            (boss ? '<span class="cal-boss-tag">😾 boss</span>' : '') + '</div>';

  let mid = '<div class="cal-cell-mid">';
  if(st === 'done'){
    if(lg && lg.skipped)      mid += '<span class="cal-tok skip-tok">☕</span>';
    else if(lg)               mid += calHandBoxes(lg.hands, lg.max) +
                                     '<span class="cal-hands-lbl">' + lg.hands +
                                     ' hand' + (lg.hands === 1 ? '' : 's') + '</span>';
    else                      mid += '<span class="cal-tok">✓</span>';
  } else if(st === 'today'){
    mid += '<span class="cal-tok today-tok">' + (boss ? '😾' : '🐈') + '</span>';
  } else {
    mid += '<span class="cal-tok future-tok">' + (boss ? '😾' : '🔒') + '</span>';
  }
  mid += '</div>';

  const foot = '<div class="cal-cell-foot">🎯 ' + tgt.toLocaleString() + '</div>';
  return '<div class="cal-cell ' + st + (boss ? ' boss' : '') +
         (lg && lg.skipped ? ' skipped' : '') + '">' + top + mid + foot + '</div>';
}

// Compact status summary shown in a collapsed *completed* day's header row.
function calDayMini(rounds, log){
  let h = '<div class="cal-day-mini">';
  rounds.forEach(r => {
    const lg = log[r];
    let cls = 'cal-mini-badge' + (calIsBoss(r) ? ' boss' : ''), txt;
    if(lg && lg.skipped){ cls += ' skip'; txt = '☕'; }
    else if(lg)         { txt = lg.hands + 'h'; }
    else                { txt = '✓'; }
    h += '<span class="' + cls + '">' + txt + '</span>';
  });
  return h + '</div>';
}

// Expand/collapse a completed day (today is fixed-open, future stays locked).
function calToggleDay(d){
  const week = g('cal-week'); if(!week) return;
  const el = week.querySelector('.cal-day[data-day="' + d + '"]');
  if(!el || !el.classList.contains('past')) return;
  el.classList.toggle('open');
  el.classList.toggle('collapsed');
}

function renderCalendar(){
  const cashEl = g('cal-cash'); if(cashEl) cashEl.textContent = G.cash;
  const log = G.roundLog || {};
  const nDays = calDayCount();
  const week = g('cal-week');
  const choose = g('cal-choose');   // captured before innerHTML wipe so we can relocate it
  if(week){
    let html = '';
    for(let d = 0; d < nDays; d++){
      const rounds = [];
      for(let s = 0; s < CAL_ROUNDS_PER_DAY; s++){
        const r = d * CAL_ROUNDS_PER_DAY + s + 1;
        if(r <= RCFG.length) rounds.push(r);
      }
      const isToday = rounds.includes(G.round);
      const isPast = rounds.length > 0 && rounds.every(r => r < G.round);
      const state = isToday ? 'today' : isPast ? 'past' : 'future';
      // Today is always open; completed days start collapsed but can be opened;
      // future days stay collapsed and locked.
      const open = isToday;
      const aff = isToday ? '<span class="cal-day-aff today-aff">● TODAY</span>'
                : isPast  ? '<span class="cal-day-aff toggle-aff">▾</span>'
                          : '<span class="cal-day-aff lock-aff">🔒</span>';
      const right = '<div class="cal-day-right">' + (isPast ? calDayMini(rounds, log) : '') + aff + '</div>';
      html += '<div class="cal-day ' + state + (open ? ' open' : ' collapsed') + '" data-day="' + d + '">' +
                '<div class="cal-day-hdr"' + (isPast ? ' onclick="calToggleDay(' + d + ')"' : '') + '>' +
                  '<span class="cal-day-nm">' + calDayName(d) + '</span>' +
                  '<span class="cal-day-lbl">Day ' + (d + 1) + '</span>' + right +
                '</div>' +
                '<div class="cal-slots">' + rounds.map(r => calCell(r, log[r])).join('') + '</div>' +
              '</div>';
    }
    week.innerHTML = html;
    // Relocate the Shop / Coffee Break fork so it sits directly below today's row.
    if(choose){
      const todayEl = week.querySelector('.cal-day.today');
      if(todayEl) todayEl.after(choose); else week.after(choose);
    }
  }
  renderCalChoose();
}

// ── The fork panel for the current round ──
function renderCalChoose(){
  const r = G.round;
  const boss = calIsBoss(r);
  const cbAvail = (typeof coffeeBreakAvailable === 'function') && coffeeBreakAvailable();
  const dayIdx = calDayIndexOf(r);

  const line = g('cal-round-line');
  if(line) line.innerHTML = '<b>' + calDayName(dayIdx) + '</b> · Round ' + r +
                            ' · 🎯 ' + (G.tgt || 0).toLocaleString() + ' · +$' + (G.earn || 0);

  const mod = g('cal-mod');
  if(mod){
    if(G.roundModifier){
      mod.style.display = '';
      mod.innerHTML = '<span class="cal-mod-em">' + (G.roundModifier.em || '⚠️') + '</span>' +
                      '<span class="cal-mod-tx"><b>' + G.roundModifier.name + '</b> — ' +
                      G.roundModifier.desc + '</span>';
    } else {
      mod.style.display = 'none';
    }
  }

  const shopDesc = g('cal-shop-desc');
  if(shopDesc) shopDesc.textContent = G.shopClosed
    ? "shop's boarded up — sell only, then play"
    : 'buy treats, then play the round';

  // Coffee Break card: onclick is static (calCoffeeBreak guards availability);
  // here we only reset the confirm state and toggle the disabled look/copy.
  _calCbDisarm();
  const cbCard = g('cal-cb-card');
  if(cbCard) cbCard.classList.toggle('disabled', !cbAvail), cbCard.classList.remove('armed');
  const cbTitle = g('cal-cb-title'); if(cbTitle) cbTitle.textContent = 'COFFEE BREAK ☕';
  const cbDesc = g('cal-cb-desc');
  if(cbDesc) cbDesc.textContent = cbAvail
    ? 'skip today — draft one free treat (rare+)'
    : (boss ? 'no skipping a deadline 😾' : "can't skip the final push");
}
