'use strict';
// ══════════════════════════════════════════════════════
//  BRANCHES — World Map progression
// ══════════════════════════════════════════════════════

// BRANCHES is declared in config.js

// ── Progress persistence ──
const PROGRESS_KEY='pf-progress';
function loadProgress(){
  try{const d=localStorage.getItem(PROGRESS_KEY);return d?JSON.parse(d):{completed:[]};}
  catch(e){return{completed:[]};}
}
function saveProgress(p){try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(p));}catch(e){}}
function markBranchComplete(branchId){
  const p=loadProgress();
  if(!p.completed.includes(branchId)){p.completed.push(branchId);saveProgress(p);}
}
function isBranchCompleted(branchId){return loadProgress().completed.includes(branchId);}

function isBranchUnlocked(branchId){
  // All HQs are open — no continent gating.
  return true;
}

function getContinents(){
  const branches=BRANCHES;
  const map=new Map();
  branches.sort((a,b)=>a.order-b.order).forEach(b=>{
    if(!map.has(b.continent))map.set(b.continent,{name:b.continent,em:b.cem,branches:[]});
    map.get(b.continent).branches.push(b);
  });
  return[...map.values()];
}

const MOD_LABELS={
  'hands-1':'-1 Hand',
  'hands+1':'+1 Hand',
  'hands+2':'+2 Hands',
  'no-discard':'No Discards',
  'discards+1':'+1 Discard',
  'bp-small':'3×3 Backpack',
  'bp-large':'6×5 Backpack',
  'cash-2':'-$2 Starting Cash',
  'cash+10':'+$10 Starting Cash',
};
function getModifierLabel(modString){
  if(!modString)return'';
  return modString.split('|').map(t=>MOD_LABELS[t.trim()]||t.trim()).join(' · ');
}

// ══════════════════════════════════════════════════════
//  Interactive world-map HQ picker
// ══════════════════════════════════════════════════════
let hqCont=0, hqIndex=0, hqDir=1;  // hqCont: active continent · hqIndex: branch within it · hqDir: slide direction
const HQ_CONT_PINS={
  'N. America':[248,168],'North America':[248,168],
  'S. America':[332,384],'South America':[332,384],
  'Europe':[540,190],
  'Africa':[570,350],
  'Asia':[750,198],
  'Oceania':[856,460],'Australia':[856,460],
  'Antarctica':[520,588],
};
// Continents in branch-order, each carrying its own branches (see getContinents()).
function hqContinents(){ return getContinents(); }
function hqActiveCont(){ const cs=hqContinents(); if(!cs.length)return null; return cs[Math.max(0,Math.min(hqCont,cs.length-1))]; }
// Stylized-but-recognizable continents (viewBox 0 0 1000 640), white land on blue paper.
const WORLD_LAND=[
  // North America
  "M175,120 C150,105 128,112 136,138 C112,150 128,178 156,172 C150,205 190,214 198,240 C205,272 236,300 250,286 C258,306 280,300 272,272 L262,236 C300,238 312,206 292,190 C318,178 322,146 296,140 C312,120 296,98 266,112 C232,96 200,102 175,120 Z",
  // Central America
  "M250,286 C258,300 268,320 288,332 C300,344 300,326 292,312 C280,300 268,292 262,282 Z",
  // South America
  "M300,326 C286,340 298,358 296,374 C286,404 316,412 312,434 C318,472 344,488 350,472 C366,454 356,422 360,400 C376,374 356,354 348,342 C332,324 314,320 300,326 Z",
  // Europe
  "M498,201 C486,187 506,178 508,168 C520,156 540,166 548,158 C566,150 574,168 566,180 C586,186 574,205 556,205 C540,215 516,215 498,201 Z",
  // Africa
  "M520,242 C508,226 540,220 560,224 C592,216 610,238 612,262 C628,286 616,318 600,332 C606,372 576,398 574,420 C566,448 548,442 552,412 C534,388 532,352 536,330 C516,312 512,282 522,266 Z",
  // Asia
  "M598,182 C588,152 620,150 624,132 C660,116 690,128 706,120 C742,108 772,124 786,140 C830,134 852,164 862,182 C884,196 866,224 840,226 C828,262 786,268 766,264 L748,290 C736,278 748,258 742,248 C708,262 690,240 686,228 C654,240 634,214 632,200 C610,204 600,196 598,182 Z",
  // India
  "M690,232 C700,250 704,278 716,300 C726,286 724,262 718,244 C712,232 700,226 690,232 Z",
  // Indonesia
  "M772,300 C784,296 794,306 788,316 C776,322 764,314 772,300 Z",
  // Australia
  "M812,452 C800,442 818,432 832,432 C868,424 894,444 890,468 C878,494 840,502 820,490 C806,478 806,462 812,452 Z",
];

function hqBranches(){ const c=hqActiveCont(); return c?c.branches.slice():[]; }  // branches of the active continent

function hqDeckFaces(br){
  const em=(DECK_META[br.deck]||{}).em||'🐱';
  const deck=DECKS[br.deck];
  const types=(deck&&deck.ty&&deck.ty.length)?deck.ty:['orange'];
  // Every deck cat type as an "L"-shaped thumbnail.
  return types.map(t=>{
    const info=(typeof catArtInfo==='function')?catArtInfo('L',t):null;
    return info?`<div class="hqm-face"><img src="${info.src}" alt="${t} cat"></div>`
               :`<div class="hqm-face hqm-face-em">${em}</div>`;
  }).join('');
}

function hqMapSvg(){
  const progress=loadProgress();
  const conts=hqContinents();
  const lands=WORLD_LAND.map(d=>`<path d="${d}" fill="#e9edf1"/>`).join('');
  const routes='<path d="M258,168 C440,116 610,146 752,214" fill="none" stroke="#1a1a2a" stroke-width="2.6" stroke-dasharray="1.5 11" stroke-linecap="round" opacity=".5"/>'
    +'<path d="M258,168 C305,268 385,332 452,372 C520,406 552,336 566,300 C655,346 800,410 852,462" fill="none" stroke="#1a1a2a" stroke-width="2.6" stroke-dasharray="1.5 11" stroke-linecap="round" opacity=".5"/>';
  const folds='<path d="M336,86 L340,568" stroke="rgba(255,255,255,.5)" stroke-width="3"/><path d="M346,86 L350,568" stroke="rgba(40,44,64,.1)" stroke-width="3"/><path d="M632,80 L636,576" stroke="rgba(255,255,255,.5)" stroke-width="3"/><path d="M642,80 L646,576" stroke="rgba(40,44,64,.1)" stroke-width="3"/><path d="M820,74 L824,580" stroke="rgba(255,255,255,.5)" stroke-width="3"/><path d="M830,74 L834,580" stroke="rgba(40,44,64,.1)" stroke-width="3"/>';
  // One pin per continent. Green once every HQ on the continent is cleared, otherwise red.
  const pins=conts.map((cont,ci)=>{
    const [px,py]=HQ_CONT_PINS[cont.name]||[500,300];
    const allDone=cont.branches.length>0&&cont.branches.every(b=>progress.completed.includes(b.id));
    const active=ci===hqCont;
    const fill=allDone?'#5ab855':'#e05040';
    const cls='hqm-pin'+(active?' hqm-pin-active':'');
    const ring=active?'<circle cx="0" cy="-39" r="20" fill="none" stroke="#f5c200" stroke-width="4"/>':'';
    const emTxt=cont.em?`<text x="0" y="-38" text-anchor="middle" dominant-baseline="central" font-size="13">${cont.em}</text>`:'';
    return `<g class="${cls}" transform="translate(${px},${py})" onclick="hqSelCont(${ci})"><g class="hqm-pin-in">`
      +`<path d="M0,0 C-15,-18 -21,-30 -21,-39 A21,21 0 1 1 21,-39 C21,-30 15,-18 0,0 Z" fill="${fill}" stroke="#1a1a2a" stroke-width="2.6"/>`
      +`<circle cx="0" cy="-39" r="11" fill="#fff" stroke="#1a1a2a" stroke-width="2.2"/>${ring}${emTxt}</g></g>`;
  }).join('');
  return `<svg viewBox="0 0 1000 640" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="world map of headquarters by continent">`
    +`<path d="M50,96 C200,60 360,86 520,68 C700,48 850,80 966,64 L980,556 C832,600 660,574 500,592 C340,610 190,584 54,600 Z" fill="#93a8c6" stroke="#fbfcfe" stroke-width="13" stroke-linejoin="round"/>`
    +folds+lands+routes+pins+`</svg>`;
}

// ── Render branches screen (world-map HQ picker) ──
function renderBranches(){
  const cs=hqContinents();
  const car=g('hqm-carousel');
  if(!cs.length){ if(car)car.innerHTML='<div class="hqm-empty">No destinations loaded yet.</div>'; return; }
  const progress=loadProgress();
  // Default to the in-progress branch, else the first unplayed HQ, else the very first.
  let defBr=gameInProgress?BRANCHES.find(b=>b.id===G.branchId):null;
  if(!defBr)defBr=BRANCHES.find(b=>isBranchUnlocked(b.id)&&!progress.completed.includes(b.id));
  if(!defBr)defBr=BRANCHES[0];
  const ci=defBr?cs.findIndex(c=>c.branches.some(b=>b.id===defBr.id)):-1;
  hqCont=ci<0?0:ci;
  const bi=defBr?cs[hqCont].branches.findIndex(b=>b.id===defBr.id):-1;
  hqIndex=bi<0?0:bi;
  hqDir=1;
  hqRender();
}

function hqGo(i){
  const n=hqBranches().length; if(!n)return;
  const ni=(i%n+n)%n;
  if(ni!==hqIndex){ const fwd=(ni-hqIndex+n)%n; hqDir=(fwd<=n-fwd)?1:-1; }  // shortest-path direction
  hqIndex=ni; hqRender();
}
function hqNav(d){ hqGo(hqIndex+d); }

// Continent selection — map pins, heading arrows, and up/down keys all route here.
function hqSelCont(c){
  const cs=hqContinents(); const n=cs.length; if(!n)return;
  const nc=(c%n+n)%n;
  if(nc===hqCont)return;
  hqDir=1; hqCont=nc; hqIndex=0; hqRender();  // jump to the continent's first HQ
}
function hqContPrev(){ hqSelCont(hqCont-1); }
function hqContNext(){ hqSelCont(hqCont+1); }

function hqRender(){
  const list=hqBranches(); if(!list.length)return;
  hqIndex=Math.max(0,Math.min(hqIndex,list.length-1));
  const progress=loadProgress();
  const active=list[hqIndex];
  const activeId=active.id;

  const mapEl=g('hqm-map'); if(mapEl)mapEl.innerHTML=hqMapSvg();

  const actCont=hqActiveCont();
  const lblEl=g('hqm-cont-lbl');
  if(lblEl)lblEl.innerHTML=actCont?`<span class="hqm-cont-em">${actCont.em||'📍'}</span>${(actCont.name||'').toUpperCase()}`:'';

  const cont=g('hqm-continue');
  if(cont){
    if(gameInProgress&&G.branchId){
      const cb=BRANCHES.find(b=>b.id===G.branchId)||{name:G.branchId};
      cont.style.display='';
      cont.innerHTML=`<div class="hqm-cont-lbl">or continue to unfinished day</div>`
        +`<div class="hqm-cont-city">${cb.name} <b>#${G.round||1}</b></div>`
        +`<button class="hqm-cont-btn" onclick="openCalendar()">CONTINUE</button>`;
    }else cont.style.display='none';
  }

  const car=g('hqm-carousel');
  if(car){
    const prev=list[(hqIndex-1+list.length)%list.length];
    const next=list[(hqIndex+1)%list.length];
    const done=progress.completed.includes(activeId);
    const unlocked=isBranchUnlocked(activeId);
    const modLabel=getModifierLabel(active.mod);
    const best=(progress.best&&progress.best[activeId])||0;
    const scoreLine=best?`BEST SCORE: ${best.toLocaleString()}`:`BEST SCORE: —`;
    const btn=done?`<button class="hqm-work hqm-replay" onclick="selectBranch('${activeId}')">REPLAY</button>`
      :unlocked?`<button class="hqm-work" onclick="selectBranch('${activeId}')">WORK</button>`
      :`<div class="hqm-work hqm-locked">🔒 LOCKED</div>`;
    const multi=list.length>1;
    const peekL=multi?`<button class="hqm-peek hqm-peek-l" onclick="hqNav(-1)" aria-label="Previous HQ"><span class="hqm-peek-nm">${prev.name}</span></button>`:'';
    const peekR=multi?`<button class="hqm-peek hqm-peek-r" onclick="hqNav(1)" aria-label="Next HQ"><span class="hqm-peek-nm">${next.name}</span></button>`:'';
    const anim=hqDir>0?'hqm-anim-next':'hqm-anim-prev';
    car.innerHTML=peekL
      +`<div class="hqm-city ${anim}${(unlocked||done)?'':' hqm-city-shut'}">`
        +`<div class="hqm-city-nm">${active.name}</div>`
        +`<div class="hqm-score"><span class="hqm-score-t">${scoreLine}</span>${btn}</div>`
        +`<div class="hqm-flav">${active.desc?('“'+active.desc+'”'):'&nbsp;'}</div>`
      +`</div>`
      +`<div class="hqm-deck ${anim}">`
        +`<div class="hqm-deck-lbl">Deck of</div>`
        +`<div class="hqm-deck-faces">${hqDeckFaces(active)}</div>`
        +(modLabel?`<div class="hqm-mod">${modLabel}</div>`:'')
      +`</div>`
      +peekR;
  }

  const dots=g('hqm-dots');
  if(dots)dots.innerHTML=list.map((b,i)=>
    `<i class="${i===hqIndex?'on':''}${progress.completed.includes(b.id)?' done':''}" onclick="hqGo(${i})"></i>`).join('');

  const cashEl=g('br-cash');
  if(cashEl)cashEl.textContent=(typeof G!=='undefined'&&gameInProgress)?G.cash:0;
}

// Arrow-key navigation while the HQ map is on screen
document.addEventListener('keydown',function(e){
  const sc=document.getElementById('s-branches');
  if(!sc||!sc.classList.contains('on'))return;
  if(e.key==='ArrowLeft')hqNav(-1);
  else if(e.key==='ArrowRight')hqNav(1);
  else if(e.key==='ArrowUp')hqContPrev();
  else if(e.key==='ArrowDown')hqContNext();
});

// ── Select and start a branch ──
function selectBranch(branchId){
  const branches=BRANCHES;
  const branch=branches.find(b=>b.id===branchId);
  if(!branch)return;
  newGameFromBranch(branchId);
  openCalendar();
}

// ── Navigate to branches screen ──
function goToBranches(){
  const cashEl=g('br-cash');
  const monEl=cashEl?cashEl.closest('.sp-mon'):null;
  if(monEl)monEl.style.display=gameInProgress?'':'none';
  if(cashEl&&gameInProgress)cashEl.textContent=G.cash;
  renderBranches();
  show('s-branches');
}
