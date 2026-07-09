'use strict';
// ══════════════════════════════════════════════════════
//  COFFEE BREAK ☕ — skip a non-boss round, draft a rarity-boosted treat
//
//  Flow: prep-screen "COFFEE BREAK ☕" button (two-click confirm) opens the
//  s-cafe screen. Step 1: pick a "blend" (a treat archetype from the sheet's
//  Archetype column). Step 2: draft 1 of N options rolled from that
//  archetype with rarity-boosted weights (rare/epic/legendary only —
//  commons never appear), free.
//
//  Cost of the skip: round N's earnings are forfeited (it is never played —
//  no hands, treat lifecycle untouched, purrfect streak preserved) and the
//  NEXT prep screen's shop is closed (G.shopClosed: buying/rerolling
//  disabled, selling still open; cleared by goShop() on the next real
//  round win, so it lasts exactly one prep screen).
//
//  The round advance itself goes through advanceRoundSetup() (scoring.js),
//  the same seam the normal round-win path uses — a skip is "a win minus
//  the payout".
// ══════════════════════════════════════════════════════

// ── Config knobs — General-tab overridable like other CFG values; the code
//    defaults below keep the feature fully functional with no sheet rows. ──
function cafeCfgNum(key,def){
  const v=CFG[key];
  if(v===undefined||v===null||v==='')return def;
  const n=Number(v);
  return isNaN(n)?def:n;
}
function coffeeBreakEnabled(){
  const v=CFG.coffee_break_enabled;
  if(v===undefined||v===null||v==='')return true; // default: enabled (1)
  return!(Number(v)===0||String(v).trim().toLowerCase()==='false');
}
function cafeOptionCount(){return Math.max(1,Math.round(cafeCfgNum('coffee_break_options',3)));}
function cafeRarityWeights(){
  return{
    rare:cafeCfgNum('coffee_break_w_rare',50),
    epic:cafeCfgNum('coffee_break_w_epic',35),
    legendary:cafeCfgNum('coffee_break_w_legendary',15),
  };
}

// ── Blend (archetype) card flavor. Archetypes themselves come from the
//    sheet (TDEFS[].arch); this map only decorates known families — an
//    archetype added to the sheet later still gets a card via the fallback. ──
const CAFE_BLEND_META={
  'Clutch':            {em:'🎯',desc:'Timing plays — discards, streaks, and the exact right moment.'},
  'Flat Freight':      {em:'📦',desc:'No strings attached: plain, honest points every hand.'},
  'Gambler':           {em:'🎲',desc:'Dice, coin flips and long odds. Feeling lucky, kitten?'},
  'Huddle':            {em:'🤗',desc:'Cats that love company — neighbors, clusters, cuddle piles.'},
  'Lines & Terrain':   {em:'📐',desc:'Work the board itself — rows, columns, corners and edges.'},
  'Purrfect Engine':   {em:'⚙️',desc:'Compounding engines fueled by purrfect fits.'},
  'Scrooge':           {em:'💰',desc:'Cold hard coin — treats that pay your wallet, then pay off.'},
  'Tribal & Sculptors':{em:'🗿',desc:'Type loyalty and deck sculpting — reshape the cats themselves.'},
};
const CAFE_BLEND_FALLBACK={em:'☕',desc:'A house specialty blend.'};

// ── Availability: enabled via config, the upcoming round has NO modifier
//    (boss rounds are unskippable — checked by modifier presence, never by
//    round number), and a next-round prep actually exists to advance to. ──
function coffeeBreakAvailable(){
  return coffeeBreakEnabled()
    &&!G.roundModifier
    &&G.round<RCFG.length;
}

// ── Prep-screen button + lightweight two-step confirm ──
let _cbArmed=false,_cbArmTimer=null;
function updateCoffeeBreakButton(){
  const btn=g('btn-coffee-break');if(!btn)return;
  _cbArmed=false;
  if(_cbArmTimer){clearTimeout(_cbArmTimer);_cbArmTimer=null;}
  btn.textContent='COFFEE BREAK ☕';
  btn.classList.remove('armed');
  btn.style.display=coffeeBreakAvailable()?'':'none';
}
function coffeeBreakClick(){
  if(!coffeeBreakAvailable())return;
  const btn=g('btn-coffee-break');if(!btn)return;
  if(!_cbArmed){
    _cbArmed=true;
    btn.textContent='Skip this round? ☕';
    btn.classList.add('armed');
    if(_cbArmTimer)clearTimeout(_cbArmTimer);
    _cbArmTimer=setTimeout(updateCoffeeBreakButton,4000); // disarm if not confirmed
    return;
  }
  openCafe();
}

// ── Café screen state ──
// _cafeRolls caches the rolled menu per archetype for THIS visit, so backing
// out to the blend list and returning shows the same 3 options (no re-roll
// fishing). _cafeDone guards double-clicks after a pick/decline resolves.
let _cafeRolls={},_cafeDone=false;

function openCafe(){
  if(!coffeeBreakAvailable())return;
  // Never enter the café carrying something: an unpaid shop copy just
  // evaporates (same as startRound), an owned treat goes back into the bag.
  if(H.kind==='treat')dropHeld();
  else if(H.kind){H=resetH();updateGhost();hideHUD();}
  _cafeRolls={};_cafeDone=false;
  renderCafeBlends();
  show('s-cafe');
}

// ── Pools. Same enabled-gate as the shop (generateShopPool); commons are
//    excluded from café pools entirely. ──
function cafePoolFor(arch){
  return TDEFS.filter(td=>td.enabled&&td.arch===arch&&td.rar!=='common');
}
function cafeArchetypes(){
  const seen=[];
  TDEFS.forEach(td=>{if(td.enabled&&td.arch&&!seen.includes(td.arch))seen.push(td.arch);});
  return seen.filter(a=>cafePoolFor(a).length).sort((a,b)=>a.localeCompare(b));
}

// ── Per-slot rarity roll + tier fallback. Uses the shop's randomness source
//    (weightedSample → Math.random) so seeded sim runs stay reproducible. ──
const CAFE_TIER_ORDER=['rare','epic','legendary'];
function cafeRollTier(){
  const w=cafeRarityWeights();
  const tiers=CAFE_TIER_ORDER.map(t=>({t,w:w[t]})).filter(x=>x.w>0);
  if(!tiers.length)return'rare';
  return weightedSample(tiers,1,x=>x.w)[0].t;
}
// If the archetype has no treats of the rolled tier, step DOWN a tier
// (legendary→epic→rare); if nothing at-or-below the roll exists either
// (e.g. Gambler has no rares), step UP so the slot never comes back empty.
function cafeTierPool(arch,tier){
  const pool=cafePoolFor(arch);
  const idx=CAFE_TIER_ORDER.indexOf(tier);
  for(let i=idx;i>=0;i--){
    const p=pool.filter(td=>td.rar===CAFE_TIER_ORDER[i]);
    if(p.length)return p;
  }
  for(let i=idx+1;i<CAFE_TIER_ORDER.length;i++){
    const p=pool.filter(td=>td.rar===CAFE_TIER_ORDER[i]);
    if(p.length)return p;
  }
  return[];
}
function cafeRollMenu(arch){
  const n=cafeOptionCount();
  const picks=[];
  for(let i=0;i<n;i++){
    const pool=cafeTierPool(arch,cafeRollTier());
    if(!pool.length)break;
    // Options distinct by id when the pool allows; duplicates of treats the
    // player already OWNS are fine (dup-stacking is a legit strategy).
    let fresh=pool.filter(td=>!picks.some(p=>p.id===td.id));
    if(!fresh.length){
      // The rolled tier is exhausted by earlier picks — widen to the whole
      // archetype pool so the menu stays distinct while any option remains.
      fresh=cafePoolFor(arch).filter(td=>!picks.some(p=>p.id===td.id));
    }
    const from=fresh.length?fresh:pool; // archetype truly exhausted: dups allowed
    picks.push(weightedSample(from,1,()=>1)[0]);
  }
  return picks;
}

// ── Rendering ──
function renderCafeBlends(){
  const cashEl=g('cafe-cash');if(cashEl)cashEl.textContent=G.cash;
  const title=g('cafe-title');if(title)title.textContent='☕ Choose your blend';
  const sub=g('cafe-sub');if(sub)sub.textContent=`Round ${G.round} skipped — pick a treat family, then draft 1 of ${cafeOptionCount()}. On the house.`;
  const grid=g('cafe-grid');if(!grid)return;
  grid.innerHTML='';
  cafeArchetypes().forEach(arch=>{
    const meta=CAFE_BLEND_META[arch]||CAFE_BLEND_FALLBACK;
    const card=document.createElement('div');
    card.className='cafe-blend';
    card.innerHTML=`<div class="cafe-blend-em">${meta.em}</div><div class="cafe-blend-nm">${arch}</div><div class="cafe-blend-ds">${meta.desc}</div>`;
    card.addEventListener('click',()=>cafeChooseBlend(arch));
    grid.appendChild(card);
  });
  renderCafeFoot(1,null);
}
function cafeChooseBlend(arch){
  if(_cafeDone)return;
  if(!_cafeRolls[arch])_cafeRolls[arch]=cafeRollMenu(arch);
  renderCafeMenu(arch);
}
function renderCafeMenu(arch){
  const title=g('cafe-title');if(title)title.textContent=`📋 Today's menu — ${arch}`;
  const sub=g('cafe-sub');if(sub)sub.textContent='Take one, on the house — or take nothing and head to the next round.';
  const grid=g('cafe-grid');if(!grid)return;
  grid.innerHTML='';
  (_cafeRolls[arch]||[]).forEach(td=>{
    const noRoom=!bpCanFitRot(td.bpS);
    const card=document.createElement('div');
    card.className='tc cafe-card'+(noRoom?' cafe-noroom':'');
    // Backpack shape mini grid — adapted from the shop card (renderTreatsRow)
    const cols=td.bpS[0].length;
    let shapeHtml=`<div class="tc-shape"><div style="display:grid;grid-template-columns:repeat(${cols},28px);gap:2px;background:rgba(0,0,0,.07);padding:4px;border-radius:6px;">`;
    td.bpS.forEach(row=>row.forEach(v=>{
      shapeHtml+=`<div style="width:28px;height:28px;border-radius:3px;background:${v?td.col+'ee':'rgba(0,0,0,.08)'};border:1px solid ${v?td.col+'88':'rgba(0,0,0,.08)'}"></div>`;
    }));
    shapeHtml+='</div></div>';
    card.innerHTML=`
      <div class="cafe-rar" style="background:${td.col};">${td.rar}</div>
      <div class="tc-em">${td.em}</div>
      ${shapeHtml}
      <div class="tc-info">
        <div class="tc-nm">${td.nm}</div>
        <div class="tc-ef">${td.ef}</div>
        ${td.addEf?`<div style="font-size:12px;color:#9a7ed7;font-weight:800;margin-top:1px;">${td.addEf}</div>`:''}
        ${td.req?`<div style="font-size:12px;color:var(--or);font-weight:800;margin-top:1px;">${td.req}</div>`:''}
      </div>
      <div class="cafe-price"><span class="cafe-strike"><span class="tc-price-coin">🪙</span>${td.pr}</span><span>FREE</span></div>`;
    if(!noRoom){
      card.addEventListener('click',()=>cafeTakeTreat(td,arch));
    }
    grid.appendChild(card);
  });
  renderCafeFoot(2,arch);
}
function renderCafeFoot(step,arch){
  const foot=g('cafe-foot');if(!foot)return;
  foot.innerHTML='';
  if(step===2){
    const back=document.createElement('button');
    back.className='cafe-back-blends';
    back.textContent='← Back to blends';
    back.addEventListener('click',()=>{if(!_cafeDone)renderCafeBlends();});
    foot.appendChild(back);
  }
  const dec=document.createElement('button');
  dec.className='cafe-decline';
  dec.textContent='Decline — back to work 🐾';
  dec.addEventListener('click',cafeDecline);
  foot.appendChild(dec);
}

// ── Resolution ──
function cafeTakeTreat(td,arch){
  if(_cafeDone)return;
  // Rotation-aware auto-place, same as the round-end restore path. NEVER
  // falls back to bpRepackAll — if it can't fit, nothing is consumed and
  // the menu re-renders with fresh no-room flags.
  if(!bpAutoPlaceRot(td)){renderCafeMenu(arch);return;}
  _cafeDone=true;
  cafeFinish();
}
function cafeDecline(){
  if(_cafeDone)return;
  _cafeDone=true;
  cafeFinish();
}
function cafeFinish(){
  // The skip: round N is never played — no earnings, no hands, treat
  // lifecycle untouched, purrfect streak preserved. Advance to round N+1's
  // prep exactly as if N had been won minus the payout, with the shop
  // boarded up for that one prep screen.
  G.shopClosed=true;
  G.round++;
  advanceRoundSetup();
  openRounds();
}
