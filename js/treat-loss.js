'use strict';
// ══════════════════════════════════════════════════════
//  TREAT LOSS CEREMONY — toast display layer
//
//  Recording is decentralized and PURE STATE: every path that takes a treat
//  out of the player's possession pushes {id,name,em,reason,...} onto
//  G.treatLossEvents (bpSendToPending in js/backpack.js, goShop's expired
//  filter + endScoreSequence's soft_landing burn in js/scoring.js, and
//  js/treats/catnado.js). This file is only the display half: flush points
//  call treatLossFlush(), which drains the queue and pops one toast per
//  event. Fail-soft by design — the headless sim (SIM_BRIDGE present) and
//  any DOM-less context still drain the queue but skip the visuals, so
//  events are shown at most once and can never pile up or throw.
//
//  Event reasons:
//    'no-room'        parked in G.bpPending (still owned — the dimmed shop
//                     inventory row is the persistent indicator; this toast
//                     is the one-time announcement)
//    'expired'        an _expired treat dropped at round end, or soft_landing
//                     burning itself to save the round — ev.msg (optional)
//                     overrides the default line
//    'destroyed'      another treat destroyed it (catnado) — ev.byName/byEm
//                     name the destroyer
//    'didnt-reappear' reserved. Verified in code (doFit, js/scoring.js): a
//                     failed REAPPEAR flip only sends the treat down the
//                     normal usedTreats path, restored at round end — it is
//                     never permanently lost today, so nothing records this.
// ══════════════════════════════════════════════════════

const TREAT_LOSS_TOAST_MS=4600;   // auto-dismiss after this long on screen
const TREAT_LOSS_STAGGER_MS=170;  // cascade delay between simultaneous toasts

// One human line + lead icon per event. ev.msg (if present) wins verbatim.
function treatLossLine(ev){
  const name=String(ev.name||ev.id||'A TREAT').toUpperCase();
  const em=ev.em?ev.em+' ':'';
  if(ev.msg)return{icon:ev.em||'✨',text:ev.msg};
  switch(ev.reason){
    case 'destroyed':
      return{icon:ev.byEm||'🌪️',text:`${String(ev.byName||'CATNADO').toUpperCase()} destroyed ${em}${name}!`};
    case 'expired':
      return{icon:ev.em||'✨',text:`${name} is used up — it won't be back`};
    case 'didnt-reappear':
      return{icon:ev.em||'🪙',text:`${name} didn't reappear`};
    case 'no-room':
      return{icon:'🎒',text:`${em}${name} couldn't fit — make space in the backpack`};
    default:
      return{icon:ev.em||'❔',text:`${name} left your backpack`};
  }
}

// Drain G.treatLossEvents and show one toast per event. Safe to call from
// anywhere, any number of times: empty queue -> no-op; sim / missing DOM ->
// drain only; any display error is swallowed. Never touches game state
// beyond emptying the (already-consumed) queue, never blocks input — the
// stack container is pointer-events:none and each toast only captures its
// own clicks (click = dismiss early).
function treatLossFlush(){
  if(typeof G==='undefined'||!G||!G.treatLossEvents||!G.treatLossEvents.length)return;
  const evs=G.treatLossEvents;
  G.treatLossEvents=[]; // shown exactly once — never re-shown on screen changes
  if(typeof SIM_BRIDGE!=='undefined')return; // headless sim: state only, no visuals
  try{
    if(typeof document==='undefined'||!document.body)return;
    let wrap=document.getElementById('treat-loss-toasts');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.id='treat-loss-toasts';
      document.body.appendChild(wrap);
    }
    evs.forEach((ev,i)=>{
      const line=treatLossLine(ev);
      const el=document.createElement('div');
      el.className='treat-loss-toast'+
        (ev.reason==='destroyed'?' tl-destroyed':'')+
        (ev.reason==='no-room'?' tl-no-room':'');
      const ic=document.createElement('span');ic.className='tl-icon';ic.textContent=line.icon;
      const tx=document.createElement('span');tx.className='tl-text';tx.textContent=line.text;
      el.appendChild(ic);el.appendChild(tx);
      let gone=false;
      const dismiss=()=>{
        if(gone)return;gone=true;
        el.classList.remove('show');el.classList.add('tl-hide');
        setTimeout(()=>el.remove(),320);
      };
      el.onclick=dismiss; // click to dismiss early
      wrap.appendChild(el);
      const delay=i*TREAT_LOSS_STAGGER_MS;      // stack cascades in, not all at once
      setTimeout(()=>el.classList.add('show'),20+delay); // pure UI timers only
      setTimeout(dismiss,TREAT_LOSS_TOAST_MS+delay);     // auto-dismiss
    });
  }catch(e){/* the loss ceremony must never break game flow */}
}
