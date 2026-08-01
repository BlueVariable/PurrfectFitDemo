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
  'discard-refund':'$1 per Unused Discard',
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
// Where each continent's label sits on the flattened map (% of the 16:9 stage)
// and the little hand-placed tilt it carries. Names are matched loosely so the
// sheet can say "North America" or "N. America".
const HQ_LABEL_POS={
  'n. america':[51.80,28.57,6.5],'north america':[51.80,28.57,6.5],
  'europe':[69.28,31.19,6.5],
  'asia':[86.91,37.88,8.2],
  's. america':[50.16,40.84,5.4],'south america':[50.16,40.84,5.4],
  'africa':[69.86,48.39,4.4],
  'oceania':[86.08,51.18,1.7],'australia':[86.08,51.18,1.7],
  'antarctica':[62.0,60.5,-3.0],
};
// Unknown continents fall back to the six drawn slots, in order.
const HQ_LABEL_SLOTS=[[51.80,28.57,6.5],[69.28,31.19,6.5],[86.91,37.88,8.2],
                      [50.16,40.84,5.4],[69.86,48.39,4.4],[86.08,51.18,1.7]];
function hqLabelPos(name,i){
  return HQ_LABEL_POS[(name||'').trim().toLowerCase()]||HQ_LABEL_SLOTS[i%HQ_LABEL_SLOTS.length];
}
// Continents in branch-order, each carrying its own branches (see getContinents()).
function hqContinents(){ return getContinents(); }
function hqActiveCont(){ const cs=hqContinents(); if(!cs.length)return null; return cs[Math.max(0,Math.min(hqCont,cs.length-1))]; }
function hqBranches(){ const c=hqActiveCont(); return c?c.branches.slice():[]; }  // branches of the active continent

// The sheet has no colour column; give each city a stable hue from the deck's
// marker palette so the rail reads like the design without extra sheet data.
const HQ_CITY_COLS=['#5063b3','#8f6d59','#4e7757','#8a5f9c','#b0763a','#3f7f96'];
function hqCityCol(br){
  const id=String(br&&br.id||'');
  let h=0; for(let i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))>>>0;
  return HQ_CITY_COLS[h%HQ_CITY_COLS.length];
}

// Deck faces use the design's own cat avatars (assets/ui/face-*.png), sliced
// out of the strip on deck page 4. 'black' has no avatar of its own and reads
// as the siamese one, same as the in-game cat art does.
const HQ_FACE={orange:'orange',grey:'grey',gray:'grey',tabby:'tabby',siamese:'siamese',black:'siamese'};
function hqDeckFaces(br){
  const deck=DECKS[br.deck];
  const types=(deck&&deck.ty&&deck.ty.length)?deck.ty:['orange'];
  return types.slice(0,4).map(t=>{
    const f=HQ_FACE[String(t).toLowerCase()];
    return f?`<img src="assets/ui/face-${f}.png" alt="${t} cat">`:'';
  }).join('');
}

// ── Render branches screen (world-map HQ picker) ──
function renderBranches(){
  const cs=hqContinents();
  if(!cs.length){ const r=g('hq-rail'); if(r)r.innerHTML='<div class="hq-empty">No destinations loaded yet.</div>'; return; }
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

// Continent selection — map labels, arrows and up/down keys all route here.
function hqSelCont(c){
  const cs=hqContinents(); const n=cs.length; if(!n)return;
  const nc=(c%n+n)%n;
  if(nc===hqCont)return;
  hqDir=1; hqCont=nc; hqIndex=0; hqRender();  // jump to the continent's first HQ
}
function hqContPrev(){ hqSelCont(hqCont-1); }
function hqContNext(){ hqSelCont(hqCont+1); }

// The map itself is flat art; only the labels and the red ring are live.
function hqRenderMap(){
  const box=g('hq-conts'); if(!box)return;
  const cs=hqContinents();
  const ring=(()=>{const p=hqLabelPos((cs[hqCont]||{}).name,hqCont);
    return `<img class="hq-ring" src="assets/ui/hq-circle.svg" alt="" style="left:${p[0]}%;top:${p[1]-1.05}%">`;})();
  box.innerHTML=cs.map((c,i)=>{
    const p=hqLabelPos(c.name,i);
    return `<button class="hq-cont${i===hqCont?'':' off'}" style="left:${p[0]}%;top:${p[1]}%;--cr:${p[2]}deg" onclick="hqSelCont(${i})">${(c.name||'').toUpperCase()}</button>`;
  }).join('')+ring;
}

function hqCard(br,cls,extra){
  const progress=loadProgress();
  const done=progress.completed.includes(br.id);
  const hero=cls.indexOf('hero')>=0;
  const mod=hero?getModifierLabel(br.mod):'';
  return `<div class="hq-card ${cls}" onclick="${hero?`selectBranch('${br.id}')`:`hqGo(${hqBranches().findIndex(b=>b.id===br.id)})`}">`
    +(hero?`<div class="hq-faces">${hqDeckFaces(br)}</div>`:'')
    +(extra||'')
    +`<div class="hq-card-nm" style="--cty:${hqCityCol(br)}">${br.name}</div>`
    +(hero?`<button class="hq-go" onclick="event.stopPropagation();selectBranch('${br.id}')"><span>${done?'REPLAY':'WORK'}</span></button>`:'')
    +(hero&&br.desc?`<div class="hq-card-flav">&ldquo;${br.desc}&rdquo;</div>`:'')
    +(mod?`<div class="hq-mod">${mod}</div>`:'')
    +`</div>`;
}

function hqRender(){
  hqRenderMap();
  const list=hqBranches(); if(!list.length)return;
  hqIndex=Math.max(0,Math.min(hqIndex,list.length-1));
  const active=list[hqIndex];
  const rail=g('hq-rail');
  if(rail){
    let html='';
    // left: the unfinished week, if there is one
    if(gameInProgress&&G.branchId){
      const cb=BRANCHES.find(b=>b.id===G.branchId)||{id:G.branchId,name:G.branchId};
      const day=(typeof CAL_ROUNDS_PER_DAY!=='undefined')?CAL_ROUNDS_PER_DAY:3;
      const r=G.round||1, dn=Math.ceil(r/day), dayNm=['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'][dn-1]||'DAY';
      html+=`<div class="hq-card cont" onclick="openCalendar()">`
        +`<div class="hq-day"><span class="hq-day-d">${dayNm}</span><span class="hq-day-n">#${((r-1)%day)+1}<small>/${day}</small></span></div>`
        +`<div class="hq-tag hq-tag-prev">PREVIOUS WEEK</div>`
        +`<div class="hq-card-nm" style="--cty:${hqCityCol(cb)}">${cb.name}</div>`
        +`<button class="hq-go hq-go-cont" onclick="event.stopPropagation();openCalendar()"><span>CONTINUE</span></button>`
        +`</div>`;
    }
    html+=hqCard(active,'hero');
    list.forEach((b,i)=>{ if(i!==hqIndex) html+=hqCard(b,'peek'); });
    rail.innerHTML=html;
  }
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
