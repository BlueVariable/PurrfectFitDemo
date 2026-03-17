'use strict';
// ══════════════════════════════════════════════════════
//  BRANCHES — World Map progression
// ══════════════════════════════════════════════════════

const BRANCHES_FALLBACK=[
  {id:'eu_1',name:'London',continent:'Europe',cem:'🏰',deck:'classic',mod:'',desc:'The classic starter — no surprises',order:1},
  {id:'eu_2',name:'Paris',continent:'Europe',cem:'🏰',deck:'classic',mod:'hands-1',desc:'One fewer hand per round',order:2},
  {id:'eu_3',name:'Rome',continent:'Europe',cem:'🏰',deck:'wild',mod:'no-discard',desc:'No discards allowed',order:3},
  {id:'as_1',name:'Tokyo',continent:'Asia',cem:'🏯',deck:'orange',mod:'',desc:'Orange cats only — synergy time',order:4},
  {id:'as_2',name:'Bangkok',continent:'Asia',cem:'🏯',deck:'wild',mod:'bp-small',desc:'Smaller backpack (3×3)',order:5},
  {id:'as_3',name:'Mumbai',continent:'Asia',cem:'🏯',deck:'big',mod:'hands-1',desc:'Big shapes with fewer hands',order:6},
  {id:'af_1',name:'Cairo',continent:'Africa',cem:'🌍',deck:'classic',mod:'cash-2',desc:'Start with less gold',order:7},
  {id:'af_2',name:'Nairobi',continent:'Africa',cem:'🌍',deck:'wild',mod:'no-discard',desc:'Wildcats with no discards',order:8},
  {id:'af_3',name:'Cape Town',continent:'Africa',cem:'🌍',deck:'orange',mod:'bp-small|hands-1',desc:'Tiny bag and fewer hands',order:9},
  {id:'na_1',name:'New York',continent:'N. America',cem:'🗽',deck:'big',mod:'',desc:'Go big or go home',order:10},
  {id:'na_2',name:'Vancouver',continent:'N. America',cem:'🗽',deck:'classic',mod:'hands-1|cash-2',desc:'Fewer hands and less gold',order:11},
  {id:'na_3',name:'Miami',continent:'N. America',cem:'🗽',deck:'wild',mod:'no-discard|bp-small',desc:'No discards with tiny bag',order:12},
  {id:'sa_1',name:'Rio',continent:'S. America',cem:'🌴',deck:'orange',mod:'hands-1',desc:'Orange Gang minus one hand',order:13},
  {id:'sa_2',name:'Lima',continent:'S. America',cem:'🌴',deck:'big',mod:'bp-small',desc:'Chonky cats in a tiny bag',order:14},
  {id:'sa_3',name:'Buenos Aires',continent:'S. America',cem:'🌴',deck:'wild',mod:'no-discard|hands-1|cash-2',desc:'Triple threat modifier',order:15},
  {id:'oc_1',name:'Sydney',continent:'Oceania',cem:'🦘',deck:'classic',mod:'cash-2',desc:'Underfunded down under',order:16},
  {id:'oc_2',name:'Auckland',continent:'Oceania',cem:'🦘',deck:'big',mod:'no-discard|hands-1',desc:'No discards and fewer hands',order:17},
  {id:'oc_3',name:'Fiji',continent:'Oceania',cem:'🦘',deck:'wild',mod:'bp-small|hands-1|cash-2',desc:'The ultimate challenge',order:18},
];

let BRANCHES=[];

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
  const branches=BRANCHES.length?BRANCHES:BRANCHES_FALLBACK;
  const branch=branches.find(b=>b.id===branchId);
  if(!branch)return false;
  const conts=getContinents();
  const contNames=conts.map(c=>c.name);
  const contIdx=contNames.indexOf(branch.continent);
  const contBranches=conts[contIdx].branches;
  const branchIdx=contBranches.findIndex(b=>b.id===branchId);
  // First branch of first continent: always unlocked
  if(contIdx===0&&branchIdx===0)return true;
  // Within continent: previous branch must be completed
  if(branchIdx>0)return isBranchCompleted(contBranches[branchIdx-1].id);
  // First branch of non-first continent: all branches of previous continent must be completed
  if(contIdx>0){
    const prevCont=conts[contIdx-1].branches;
    return prevCont.every(b=>isBranchCompleted(b.id));
  }
  return false;
}

function getContinents(){
  const branches=BRANCHES.length?BRANCHES:BRANCHES_FALLBACK;
  const map=new Map();
  branches.sort((a,b)=>a.order-b.order).forEach(b=>{
    if(!map.has(b.continent))map.set(b.continent,{name:b.continent,em:b.cem,branches:[]});
    map.get(b.continent).branches.push(b);
  });
  return[...map.values()];
}

const MOD_LABELS={
  'hands-1':'-1 Hand',
  'no-discard':'No Discards',
  'bp-small':'3×3 Backpack',
  'cash-2':'-$2 Starting Cash',
};
function getModifierLabel(modString){
  if(!modString)return'';
  return modString.split('|').map(t=>MOD_LABELS[t.trim()]||t.trim()).join(' · ');
}

// ── Render branches screen ──
function renderBranches(){
  const body=g('br-body');
  if(!body)return;
  body.innerHTML='';
  const conts=getContinents();
  const progress=loadProgress();
  // check if whole continent is locked
  function isContinentLocked(contIdx){
    if(contIdx===0)return false;
    const prevCont=conts[contIdx-1].branches;
    return!prevCont.every(b=>progress.completed.includes(b.id));
  }
  conts.forEach((cont,ci)=>{
    const locked=isContinentLocked(ci);
    const sec=document.createElement('div');
    sec.className='br-continent'+(locked?' br-locked':'');
    const hdr=document.createElement('div');
    hdr.className='br-cont-hdr';
    hdr.innerHTML=`<span class="br-cont-em">${cont.em}</span><span class="br-cont-nm">${cont.name.toUpperCase()}</span>${locked?'<span class="br-cont-lock">🔒 LOCKED</span>':''}`;
    sec.appendChild(hdr);
    const row=document.createElement('div');
    row.className='br-row';
    cont.branches.forEach(br=>{
      const completed=progress.completed.includes(br.id);
      const unlocked=!locked&&isBranchUnlocked(br.id);
      const card=document.createElement('div');
      card.className='br-card'+(completed?' br-done':unlocked?' br-open':' br-shut');
      const deckMeta=DECK_META[br.deck]||{em:'🐱',name:br.deck};
      const modLabel=getModifierLabel(br.mod);
      card.innerHTML=`
        <div class="br-status">${completed?'✅':unlocked?'🔓':'🔒'}</div>
        <div class="br-name">${br.name}</div>
        <div class="br-deck-em">${deckMeta.em}</div>
        <div class="br-deck-nm">${deckMeta.name||br.deck}</div>
        ${modLabel?`<div class="br-mod">${modLabel}</div>`:''}
        <div class="br-desc">${br.desc}</div>
        ${completed?`<button class="br-btn br-btn-replay" onclick="selectBranch('${br.id}')">REPLAY</button>`:
          unlocked?`<button class="br-btn br-btn-play" onclick="selectBranch('${br.id}')">PLAY</button>`:
          '<div class="br-btn br-btn-locked">locked</div>'}
      `;
      row.appendChild(card);
    });
    sec.appendChild(row);
    body.appendChild(sec);
  });
}

// ── Select and start a branch ──
function selectBranch(branchId){
  const branches=BRANCHES.length?BRANCHES:BRANCHES_FALLBACK;
  const branch=branches.find(b=>b.id===branchId);
  if(!branch)return;
  newGameFromBranch(branchId);
  openRounds();
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
