'use strict';
// ══════════════════════════════════════════════════════
//  DATA — Cat shapes
// ══════════════════════════════════════════════════════
const CSHAPES={};

// ── Treat definitions ──
// bpShape: how it occupies the backpack grid
// 1×1 = common weak, 1×2 or 2×1 = moderate, 2×2 = powerful/legendary
// ══════════════════════════════════════════════════════
//  GOOGLE SHEETS CONFIG — loaded at runtime
// ══════════════════════════════════════════════════════
const CONFIG_CACHE_KEY = 'purrfect_config_v1';
const SHEET_URLS = {
  'General Config': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxHTMqf05UHp6un_D_4Xbfph4En2GWNLiM1P3yB_B0uC3IJIQMvr-__9HySc0Qorzw1p0T92X6oxTn/pub?gid=1778744904&single=true&output=csv',
  'Rounds Config':  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxHTMqf05UHp6un_D_4Xbfph4En2GWNLiM1P3yB_B0uC3IJIQMvr-__9HySc0Qorzw1p0T92X6oxTn/pub?gid=1133060391&single=true&output=csv',
  'Treats':         'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxHTMqf05UHp6un_D_4Xbfph4En2GWNLiM1P3yB_B0uC3IJIQMvr-__9HySc0Qorzw1p0T92X6oxTn/pub?gid=1829591761&single=true&output=csv',
  'Cat Types':      'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxHTMqf05UHp6un_D_4Xbfph4En2GWNLiM1P3yB_B0uC3IJIQMvr-__9HySc0Qorzw1p0T92X6oxTn/pub?gid=1088427227&single=true&output=csv',
  'Cat Shapes':     'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxHTMqf05UHp6un_D_4Xbfph4En2GWNLiM1P3yB_B0uC3IJIQMvr-__9HySc0Qorzw1p0T92X6oxTn/pub?gid=1916856622&single=true&output=csv',
  'Decks Config':   'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxHTMqf05UHp6un_D_4Xbfph4En2GWNLiM1P3yB_B0uC3IJIQMvr-__9HySc0Qorzw1p0T92X6oxTn/pub?gid=2016141493&single=true&output=csv',
};
const SHEET_NAMES = Object.keys(SHEET_URLS);
function _cfgHash(raw){let s='',h=5381;const keys=Object.keys(raw).sort();for(const k of keys)s+=k+':'+raw[k]+'|';for(let i=0;i<s.length;i++)h=((h<<5)+h)^s.charCodeAt(i);return(h>>>0).toString(36);}
function saveConfigCache(raw){try{localStorage.setItem(CONFIG_CACHE_KEY,JSON.stringify({hash:_cfgHash(raw),data:raw}));}catch(e){}}
function loadConfigCache(){try{const d=localStorage.getItem(CONFIG_CACHE_KEY);return d?JSON.parse(d):null;}catch(e){return null;}}

// These will be populated by loadConfig()
let TDEFS = [];
let COLS = {};
let EMS  = {};
let DECKS = {};
let RCFG  = [];
let CFG   = {};
let DEV_MODE = localStorage.getItem('purrfect_dev_mode') === '1';
const DECK_META={};

function rcfg(r){return RCFG[Math.min(r-1,RCFG.length-1)];}

// ── treat fn lookup — maps sheet effect strings to engine functions ──
function buildTreatFn(id, ef, phase){
  // add-phase fns
  if(phase==='add'){
    if(ef.includes('ALL'))      return (b,cats)=>allAdd(cats, extractNum(ef));
    if(ef.includes('ROW'))      return (b,c,t,p)=>rowAdd(b,p, extractNum(ef));
    if(ef.includes('COL'))      return (b,c,t,p)=>colAdd(b,p, extractNum(ef));
    if(ef.includes('SURR'))     return (b,c,t,p)=>surrAdd(b,p, extractNum(ef));
    return (b,cats)=>allAdd(cats, extractNum(ef));
  }
  // mul-phase fns
  const m = extractMul(ef);
  if(id==='tuna')   return (b,cats,ts,p,cs)=>{const gids=Object.keys(cs).filter(gid=>{const grp=cats.find(c=>c.gid===gid);return grp&&grp.type==='orange';});return{gids,m};};
  if(id==='nap')    return (b,cats,ts,p,cs)=>ts.length<=1?allMulCS(cats,cs,m):{gids:[],m:1};
  if(id==='frenzy') return (b,cats,ts,p,cs)=>{if([...new Set(cats.map(c=>c.type))].length>1)return{gids:[],m:1};return surrMulCS(b,cats,p,m,cs);};
  if(ef.includes('COL')) return (b,cats,t,p,cs)=>colMul(b,cats,p,m);
  if(ef.includes('/')){
    // parse shape list from effect like "×2 L/J/T/curl/chonk cats"
    const shapeMatch=ef.match(/([A-Za-z][A-Za-z0-9]*(?:\/[A-Za-z][A-Za-z0-9]*)+)/);
    const shapes=shapeMatch?shapeMatch[1].split('/'):['L','J','T','curl','chonk'];
    return (b,cats)=>shapeMul(cats,shapes,m);
  }
  return (b,cats,ts,p,cs)=>allMulCS(cats,cs,m);
}
function extractNum(ef){const m=ef.match(/[+](\d+)/);return m?parseInt(m[1]):0;}
function extractMul(ef){const m=ef.match(/[×x](\d+)/);return m?parseInt(m[1]):2;}

// ── BP shape parser: "1×2" → [[1,1]], "2×1" → [[1],[1]], "2×2" → [[1,1],[1,1]] ──
function parseBpShape(s){
  const clean=String(s).replace(/\*/g,'').trim();
  const [rows,cols]=clean.split(/[×x]/).map(Number);
  if(!rows||!cols)return[[1]];
  return Array.from({length:rows},()=>Array(cols).fill(1));
}

function parseCSVRow(line){
  const result=[];let cur='';let inQ=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}
    else if(c===','&&!inQ){result.push(cur.trim());cur='';}
    else cur+=c;
  }
  result.push(cur.trim());return result;
}
function parseCSV(text){
  const lines=text.trim().split('\n');
  if(!lines.length)return[];
  const headers=parseCSVRow(lines[0]);
  return lines.slice(1)
    .map(line=>{const vals=parseCSVRow(line);const obj={};headers.forEach((h,i)=>{obj[h]=vals[i]??'';});return obj;})
    .filter(r=>Object.values(r).some(v=>v!==''));
}

async function fetchSheet(name){
  const url=SHEET_BASE_URL+'&sheet='+encodeURIComponent(name);
  const res=await fetch(url);
  if(!res.ok)throw new Error(`Sheet "${name}" failed (${res.status})`);
  const text=await res.text();
  return parseCSV(text);
}

// Fetch all sheets as raw CSV text (for caching / change detection)
async function fetchAllSheetsRaw(onStatus){
  const raw={};
  for(const name of SHEET_NAMES){
    if(onStatus)onStatus('loading '+name+'...');
    const url=SHEET_URLS[name]+'&ts='+Date.now();
    try{
      const res=await fetch(url,{cache:'no-store'});
      if(!res.ok)throw new Error(`Sheet "${name}" failed (${res.status})`);
      raw[name]=await res.text();
    }catch(e){
      if(name==='Cat Shapes'){raw[name]='';}else throw e;
    }
  }
  return raw;
}

// Parse raw CSV map and apply to globals
function applyConfigFromRaw(raw){
  const genRows=parseCSV(raw['General Config']||'');
  genRows.forEach(r=>{CFG[r['Setting']]=isNaN(r['Value'])?r['Value']:Number(r['Value']);});

  const rndRows=parseCSV(raw['Rounds Config']||'');
  RCFG=rndRows.map(r=>{
    const bsr=Number(r['Board Rows']||r['Board Size']||4);
    const bsc=Number(r['Board Cols']||r['Board Size']||4);
    return{tgt:Number(r['Target Score']),bsr,bsc,earn:Number(r['Earn (coins)']),h:Number(r['Hands per Round'])};
  });

  const catRows=parseCSV(raw['Cat Types']||'');
  catRows.forEach(r=>{COLS[r['Type']]=r['Color (hex)'];EMS[r['Type']]=r['Emoji'];});

  const treatRows=parseCSV(raw['Treats']||'');
  TDEFS=treatRows.filter(r=>r['ID']&&String(r['ID']).trim()).map(r=>{
    const id=String(r['ID']||'').trim();
    const ef=String(r['Effect']||r['Effect '||'']||'').trim();
    const phase=String(r['Phase']||'add').trim().toLowerCase();
    const bpRaw=r['BP Shape']||r['BP Shape ']||'1×1';
    const bpS=parseBpShape(bpRaw);
    const rar=String(r['Rarity']||'common').trim().toLowerCase();
    const buyRaw=r['Buy Price']||r['Buy Price ']||r['Price']||1;
    const sellRaw=r['Sell Price']||r['Sell Price ']||r['Sell']||0;
    const buyPr=Number(buyRaw)||1;
    const sellPr=CFG.sell_price_coef?Math.round(buyPr*CFG.sell_price_coef):(Number(sellRaw)||0);
    return{
      id, nm:String(r['Name']||id), em:String(r['Emoji']||'❓'), rar, col:rarCol(rar), phase,
      bpS, ef, req:String(r['Requirement']||r['Req']||'').trim(),
      pr:buyPr, sp:sellPr,
      fl:String(r['Flavor']||r['Flavour']||''),
      fn:buildTreatFn(id,ef,phase),
    };
  });

  if(raw['Cat Shapes']){
    try{
      parseCSV(raw['Cat Shapes']).filter(r=>r['Shape Name']&&String(r['Shape Name']).trim()).forEach(r=>{
        const name=String(r['Shape Name']).trim();
        const gridStr=String(r['Grid']||'').trim();
        if(!gridStr)return;
        const grid=gridStr.split('|').map(row=>row.trim().split(',').map(v=>Number(v.trim())||0));
        if(grid.length&&grid[0].length)CSHAPES[name]=grid;
      });
    }catch(e){console.warn('Cat Shapes parse failed:',e.message);}
    console.log('[Config] CSHAPES loaded:', Object.keys(CSHAPES));
  }

  const deckRows=parseCSV(raw['Decks Config']||'');
  console.log('[Config] Decks Config raw CSV:', raw['Decks Config']?.slice(0,500));
  console.log('[Config] Deck rows parsed:', deckRows.length, deckRows.map(r=>r['Deck ID']));
  DECKS={};
  deckRows.filter(r=>r['Deck ID']&&String(r['Deck ID']).trim()).forEach(r=>{
    const id=String(r['Deck ID']).trim();
    const ty=String(r['Cat Types']||'orange').split(',').map(t=>t.trim().replace(/\([^)]+\)/,'').trim()).filter(Boolean);
    const sh=String(r['Shapes']||'straight').split(',').map(s=>s.trim()).filter(Boolean);
    const name=String(r['Deck Name']||r['Name']||id);
    const em=String(r['Emoji']||'🐱');
    const desc=String(r['Description']||'');
    DECKS[id]={ty,sh};
    DECK_META[id]={name,em,desc};
  });
  console.log('[Config] DECKS loaded:', Object.keys(DECKS));
}

function setLoadStatus(msg){
  const el=g('load-status');if(el)el.textContent=msg;
}

// Core data fetcher — shared by initial load and reload
async function loadConfigData(onStatus){
  const status=onStatus||setLoadStatus;
  const raw=await fetchAllSheetsRaw(status);
  applyConfigFromRaw(raw);
  return raw;
}

// Silent background fetch to detect sheet changes after a cached boot
async function _bgCheckConfig(){
  try{
    const raw=await fetchAllSheetsRaw();
    const cached=loadConfigCache();
    const newHash=_cfgHash(raw);
    if(!cached||cached.hash!==newHash){
      applyConfigFromRaw(raw);
      saveConfigCache(raw);
      initDeckCarousel();
      const btn=g('btn-reload-cfg');
      if(btn){btn.textContent='↺ Updated';btn.style.color='var(--gr)';setTimeout(()=>{btn.textContent='↺ Reload Config';btn.style.color='';},3000);}
    }
  }catch(e){/* silent — background check failure is non-critical */}
}

// Initial boot load
async function loadConfig(){
  // Fast path: use localStorage cache, then background-check for changes
  const cached=loadConfigCache();
  if(cached&&cached.data){
    try{
      applyConfigFromRaw(cached.data);
      setLoadStatus('ready!');
      await new Promise(res=>setTimeout(res,100));
      show('s-title');
      initDeckCarousel();applyDevModeUI();
      _bgCheckConfig();
      return;
    }catch(e){/* fall through to full load */}
  }
  // No cache — full network load
  try{
    const raw=await loadConfigData();
    saveConfigCache(raw);
    setLoadStatus('ready!');
    await new Promise(res=>setTimeout(res,300));
    show('s-title');
    initDeckCarousel();applyDevModeUI();
  }catch(err){
    console.error('Config load error:',err);
    const errEl=g('load-error');
    if(errEl){
      errEl.style.display='block';
      errEl.innerHTML=`<strong>Failed to load config</strong><br>${err.message}<br><br>Check that your Google Sheet is published to web (File → Share → Publish to web → CSV).`;
    }
    setLoadStatus('error — see below');
  }
}

function applyDevModeUI(){
  const btn=g('btn-dev-toggle');
  const panel=g('dev-panel');
  const floatBtn=g('btn-dev-float');
  if(DEV_MODE){btn?.classList.add('active');panel?.classList.add('on');floatBtn?.classList.add('active');}
  else{btn?.classList.remove('active');panel?.classList.remove('on');floatBtn?.classList.remove('active');}
}
function toggleDevMode(){
  DEV_MODE=!DEV_MODE;
  localStorage.setItem('purrfect_dev_mode',DEV_MODE?'1':'0');
  applyDevModeUI();
}
function openConfigSheet(){
  window.open('https://docs.google.com/spreadsheets/d/1qEr42p9HsQFPrBip1TqYB2DBehKPgyT_e0CwmNP_Cd4/edit?gid=1778744904#gid=1778744904','_blank');
}

// Title-screen reload button
async function reloadConfig(){
  const btn=g('btn-reload-cfg');
  const statusEl=g('reload-status');
  if(btn){btn.textContent='↺ Checking...';btn.disabled=true;}
  if(statusEl){statusEl.style.display='block';statusEl.style.color='rgba(255,255,255,.5)';statusEl.textContent='fetching sheets...';}
  try{
    const raw=await fetchAllSheetsRaw(msg=>{if(statusEl)statusEl.textContent=msg;});
    applyConfigFromRaw(raw);
    saveConfigCache(raw);
    if(btn){btn.textContent='✓ Reloaded!';btn.style.color='var(--gr)';}
    if(statusEl)statusEl.textContent=`✓ ${RCFG.length} rounds · ${TDEFS.length} treats · ${Object.keys(DECKS).length} decks`;
    initDeckCarousel();
    setTimeout(()=>{
      if(btn){btn.textContent='↺ Reload Config';btn.disabled=false;btn.style.color='';}
      if(statusEl)statusEl.style.display='none';
    },2500);
  }catch(err){
    if(btn){btn.textContent='↺ Reload Config';btn.disabled=false;btn.style.color='';}
    if(statusEl){statusEl.textContent='✗ '+err.message;statusEl.style.color='#ffaaaa';}
    setTimeout(()=>{if(statusEl){statusEl.style.display='none';statusEl.style.color='';}},3500);
  }
}

// Rarity colours for treat card tinting — configurable via sheet "Rarity Colors" tab (optional)
const RARITY_COLORS={common:'#a0b8e0',rare:'#60a0f0',epic:'#9060c8',legendary:'#e04040'};
function rarCol(rar){return RARITY_COLORS[rar?.toLowerCase()]||'#a0b8e0';}


// ══════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════
const BPS_DEFAULT=4;
function getBPR(){return CFG.backpack_rows||CFG.backpack_grid_size||BPS_DEFAULT;}
function getBPC(){return CFG.backpack_cols||CFG.backpack_grid_size||BPS_DEFAULT;}
let G={};
let gameInProgress=false;
let curDeck='classic';

// ── Shared helpers ──
function resetH(){return{kind:null,source:null,data:null,cells:null,rot:0,color:null,em:null,handIdx:null,boardGid:null,bpGid:null,grabDr:0,grabDc:0,dragging:false};}
function emptyCell(){return{filled:false,col:null,kind:null,em:null,gid:null,shape:null,type:null};}

// Touch drag tracking — true once finger has moved enough to constitute a drag
let _touchMovedWhileHeld=false;
// Extract clientX/Y from mouse or touch event
function getCoords(e){const t=(e.touches&&e.touches.length)?e.touches[0]:(e.changedTouches&&e.changedTouches.length)?e.changedTouches[0]:e;return{clientX:t.clientX,clientY:t.clientY};}

// HELD — what the cursor is currently carrying
// kind: null | 'cat' | 'treat'
// source: 'hand' | 'board' | 'bp'
let H=resetH();

function newGame(deckId){
  const c=rcfg(1);
  G={
    round:1,score:0,tgt:c.tgt,bsr:c.bsr,bsc:c.bsc,earn:c.earn,hands:c.h,disc:CFG.discard_count||3,cash:CFG.starting_cash||5,
    deckId,deck:[],hand:[],
    bp:mk2d(getBPR(),getBPC(),()=>({filled:false,col:null,em:null,gid:null,tdef:null})),
    bpGroups:[],
    board:[],cats:[],treats:[],
    lastScore:0,selBpGid:null,firstShop:true,visitedShop:false,shopVisitedThisRound:false,newCardIndices:new Set(),
  };
  mkDeck();dealHand();
}

function mk2d(r,c,init){return Array.from({length:r},()=>Array.from({length:c},init));}

function mkDeck(){
  let cfg=DECKS[G.deckId];
  if(!cfg){console.error('Deck not found:',G.deckId);return;}
  console.log('[mkDeck] deckId:',G.deckId,'ty:',cfg.ty,'sh:',cfg.sh);
  console.log('[mkDeck] COLS:',JSON.stringify(COLS),'EMS:',JSON.stringify(EMS));
  G.deck=[];
  // Filter out 1x1 shapes for cats
  const validShapes=Object.entries(CSHAPES).filter(([k,v])=>{
    const total=v.reduce((s,r)=>s+r.reduce((a,b)=>a+b,0),0);return total>1;
  }).map(([k])=>k);
  for(let i=0;i<(CFG.deck_card_count||30);i++){
    const type=cfg.ty[i%cfg.ty.length];
    let shape=cfg.sh[i%cfg.sh.length];
    if(!validShapes.includes(shape)||CSHAPES[shape].reduce((s,r)=>s+r.reduce((a,b)=>a+b,0),0)<=1)
      shape=validShapes[i%validShapes.length];
    G.deck.push({id:i+Date.now(),name:cap(type)+' Cat',type,shape,
      cells:CSHAPES[shape],col:COLS[type],em:EMS[type]});
  }
  sfl(G.deck);
}

function dealHand(){
  G.newCardIndices=new Set();
  while(G.hand.length<(CFG.hand_count||7)&&G.deck.length>0){
    G.newCardIndices.add(G.hand.length);
    G.hand.push(G.deck.shift());
  }
  // return any board treats to backpack
  G.treats.forEach(bt=>bpAutoPlace(bt.tdef));
  G.cats=[];G.treats=[];
  H=resetH();
  mkBoard();
}

function mkBoard(){
  G.board=mk2d(G.bsr,G.bsc,()=>(emptyCell()));
}

// ══════════════════════════════════════════════════════
//  HELD MECHANICS
// ══════════════════════════════════════════════════════
function pickupCat(idx){
  // if already holding this cat, cancel
  if(H.kind==='cat'&&H.handIdx===idx){dropHeld();return;}
  dropHeld();
  const cat=G.hand[idx];
  const _cells0=rotC(cat.cells,0);
  H={kind:'cat',source:'hand',data:cat,cells:_cells0,rot:0,
     color:cat.col,em:cat.em,handIdx:idx,boardGid:null,bpGid:null,
     grabDr:Math.floor(_cells0.length/2),grabDc:Math.floor(_cells0[0].length/2),dragging:false};
  updateGhost();showHUD();renderHand();renderBP();
  const _tb=g('trash-badge');if(_tb)_tb.textContent=G.disc;
  const _te=g('trash-drop');if(_te)_te.classList.toggle('no-disc',G.disc<=0);
}

function pickupCatWithGrab(idx,grabDr,grabDc){
  if(H.kind==='cat'&&H.handIdx===idx){dropHeld();return;}
  dropHeld();
  const cat=G.hand[idx];
  const cells=rotC(cat.cells,0);
  // always snap to center of the shape
  const cDr=Math.floor(cells.length/2);
  const cDc=Math.floor(cells[0].length/2);
  H={kind:'cat',source:'hand',data:cat,cells,rot:0,
     color:cat.col,em:cat.em,handIdx:idx,boardGid:null,bpGid:null,
     grabDr:cDr,grabDc:cDc,dragging:true};
  updateGhost();showHUD();renderHand();renderBP();
  const _tb2=g('trash-badge');if(_tb2)_tb2.textContent=G.disc;
  const _te2=g('trash-drop');if(_te2)_te2.classList.toggle('no-disc',G.disc<=0);
}

function pickupCatFromBoard(r,c){
  const bd=G.board[r][c];
  if(!bd.filled||bd.kind!=='cat')return;
  const grp=G.cats.find(g=>g.cells.some(([gr,gc])=>gr===r&&gc===c));
  if(!grp)return;
  // lift all cells off board
  grp.cells.forEach(([gr,gc])=>G.board[gr][gc]=emptyCell());
  G.cats=G.cats.filter(g=>g.gid!==grp.gid);
  // put back in hand temporarily
  G.hand.push(grp.cat);
  const idx=G.hand.length-1;
  const _bCells=rotC(grp.cat.cells,0);
  H={kind:'cat',source:'board',data:grp.cat,cells:_bCells,rot:0,
     color:grp.cat.col,em:grp.cat.em,handIdx:idx,boardGid:grp.gid,bpGid:null,
     grabDr:Math.floor(_bCells.length/2),grabDc:Math.floor(_bCells[0].length/2),dragging:false};
  updateGhost();showHUD();renderAll();
}

function pickupTreat(){
  // called from "Place on board" button in treat tooltip
  if(!G.selBpGid)return;
  const grp=G.bpGroups.find(g=>g.gid===G.selBpGid);
  if(!grp)return;
  dropHeld();
  // remove from BP
  removeBpGid(G.selBpGid);
  G.selBpGid=null;hideTTP();
  H={kind:'treat',source:'bp',data:grp.tdef,cells:grp.tdef.bpS,rot:0,
     color:grp.tdef.col,em:grp.tdef.em,handIdx:null,boardGid:null,bpGid:grp.gid,
     grabDr:Math.floor(grp.tdef.bpS.length/2),grabDc:Math.floor(grp.tdef.bpS[0].length/2),dragging:false};
  updateGhost();showHUD();renderBP();
}

function dropHeld(){
  if(!H.kind)return;
  if(H.kind==='treat'&&(H.source==='bp'||H.source==='board')){
    bpAutoPlace(H.data);
  }
  H=resetH();
  updateGhost();hideHUD();renderHand();renderBP();
  const _teDrop=g('trash-drop');if(_teDrop){_teDrop.classList.remove('drag-active');_teDrop._hover=false;}
}

function rotate(){
  if(!H.kind)return;
  H.rot=(H.rot+1)%4;
  if(H.kind==='cat'){
    H.cells=rotC(H.data.cells,H.rot);
    H.grabDr=Math.floor(H.cells.length/2);
    H.grabDc=Math.floor(H.cells[0].length/2);
  } else if(H.kind==='treat'||H.kind==='shop-treat'){
    H.cells=rotC(H.data.bpS,H.rot);
    H.grabDr=Math.floor(H.cells.length/2);
    H.grabDc=Math.floor(H.cells[0].length/2);
  }
  updateGhost();
  clrBoardPrev();clrBPPrev();
  // re-fire hover preview if we know last hovered cell
  if(H._lastBoardR!==undefined) onBoardEnter(H._lastBoardR,H._lastBoardC);
  if(H._lastBpR!==undefined) onBPEnter(H._lastBpR,H._lastBpC);
}

// right-click = rotate
document.addEventListener('contextmenu',e=>{e.preventDefault();rotate();});
// R key = rotate
document.addEventListener('keydown',e=>{
  if(e.key==='r'||e.key==='R') rotate();
  if(e.key==='Escape') dropHeld();
});
// Global mouseup — unified drag-drop handler
document.addEventListener('mouseup',e=>{
  if(e.button!==0)return; // ignore right/middle clicks
  // Shop treat dropped on shop backpack grid
  if(H.kind==='shop-treat'){
    const bpEl=g('shop-bpg');
    if(!bpEl){H=resetH();updateGhost();hideHUD();return;}
    const rect=bpEl.getBoundingClientRect();
    const inside=e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom;
    if(!inside){
      H=resetH();
      updateGhost();hideHUD();
      document.querySelectorAll('.sp-bpc.ok,.sp-bpc.bad').forEach(x=>x.classList.remove('ok','bad'));
    }
    // If inside, the shopBPEnter+shopDropOnBP click handler handles it
    return;
  }

  // Cat dragged to trash can — discard
  if(H.kind==='cat'){
    const trashEl=g('trash-drop');
    if(trashEl&&G.disc>0){
      const tr=trashEl.getBoundingClientRect();
      if(e.clientX>=tr.left&&e.clientX<=tr.right&&e.clientY>=tr.top&&e.clientY<=tr.bottom){
        trashEl._hover=false;trashEl.classList.remove('drag-active');
        doDiscard();return;
      }
    }
    trashEl&&(trashEl._hover=false,trashEl.classList.remove('drag-active'));
  }

  // Game treat dragged from BP — drop on board cell under mouse
  if(H.kind==='treat'){
    // If dropped on shop BP grid, shopDropOnBP handles it
    const shopBpEl=g('shop-bpg');
    if(shopBpEl){
      const sr=shopBpEl.getBoundingClientRect();
      if(e.clientX>=sr.left&&e.clientX<=sr.right&&e.clientY>=sr.top&&e.clientY<=sr.bottom){
        return; // shopDropOnBP cell mouseup will handle
      }
    }
    const boardEl=g('board');
    if(!boardEl){bpAutoPlace(H.data);H=resetH();updateGhost();hideHUD();renderBP();return;}
    const boardRect=boardEl.getBoundingClientRect();
    const inside=e.clientX>=boardRect.left&&e.clientX<=boardRect.right&&e.clientY>=boardRect.top&&e.clientY<=boardRect.bottom;
    if(inside){
      // Find which cell we're over using element from point
      const el=document.elementFromPoint(e.clientX,e.clientY);
      const boardCells=boardEl.querySelectorAll('.cell');
      let anchorR=-1,anchorC=-1;
      boardCells.forEach((cell,idx)=>{
        if(cell===el||cell.contains(el)){
          anchorR=Math.floor(idx/G.bsc); anchorC=idx%G.bsc;
        }
      });
      let found=false;
      if(anchorR>=0){
        const or=anchorR-H.grabDr, oc=anchorC-H.grabDc;
        if(boardCanPlace(H.cells,or,oc)){
          placeTreatOnBoard(anchorR,anchorC); // handles H reset + renderAll
          found=true;
        }
      }
      if(found){
        // placeTreatOnBoard already reset H and rendered
      } else {
        // Can't place — return to BP
        bpAutoPlace(H.data);
        H=resetH();
        updateGhost();hideHUD();renderBP();clrBoardPrev();
      }
    } else {
      // Check if dropped on game backpack grid (rearrange)
      const bpGridEl=g('bpg');
      if(bpGridEl){
        const bpRect=bpGridEl.getBoundingClientRect();
        const onBP=e.clientX>=bpRect.left&&e.clientX<=bpRect.right&&e.clientY>=bpRect.top&&e.clientY<=bpRect.bottom;
        if(onBP){
          // onBPMouseUp on the cell will handle placement, just clear ghost
          H=resetH();
          updateGhost();hideHUD();clrBoardPrev();return;
        }
      }
      // Outside board + not on BP — return to BP
      bpAutoPlace(H.data);
      H=resetH();
      updateGhost();hideHUD();renderBP();clrBoardPrev();
    }
  }
});

// Global touchend — handle drops for touch drag gestures
document.addEventListener('touchend',e=>{
  if(!H.kind)return;
  if(!_touchMovedWhileHeld)return; // was a tap not a drag — let click/touchstart handle it
  _touchMovedWhileHeld=false;
  const{clientX,clientY}=getCoords(e);
  handleTouchDrop(clientX,clientY);
});

// ghost follows mouse
document.addEventListener('mousemove',e=>{
  if(!H.kind){g('ghost').style.display='none';return;}
  const gh=g('ghost');
  gh.style.display='block';
  gh.style.left=e.clientX+'px';
  gh.style.top=e.clientY+'px';
  // trash can hover highlight
  const trashEl=g('trash-drop');
  if(trashEl&&H.kind==='cat'&&G.disc>0){
    const tr=trashEl.getBoundingClientRect();
    const over=e.clientX>=tr.left&&e.clientX<=tr.right&&e.clientY>=tr.top&&e.clientY<=tr.bottom;
    trashEl._hover=over;
    trashEl.classList.toggle('drag-active',over);
  }
});

// ghost follows touch + simulate hover over board/bp cells
document.addEventListener('touchmove',e=>{
  if(!H.kind)return;
  e.preventDefault();
  _touchMovedWhileHeld=true;
  const{clientX,clientY}=getCoords(e);
  const gh=g('ghost');
  gh.style.display='block';
  gh.style.left=clientX+'px';
  gh.style.top=clientY+'px';
  simulateTouchHover(clientX,clientY);
},{passive:false});

// Simulate mouseenter/leave on board and BP cells during touch drag
function simulateTouchHover(cx,cy){
  const el=document.elementFromPoint(cx,cy);
  // Board cells
  const boardEl=g('board');
  if(boardEl){
    const cells=boardEl.querySelectorAll('.cell');
    let bR=-1,bC=-1;
    cells.forEach((cell,idx)=>{if(cell===el||cell.contains(el)){bR=Math.floor(idx/G.bsc);bC=idx%G.bsc;}});
    if(bR>=0&&(bR!==H._lastBoardR||bC!==H._lastBoardC)){
      H._lastBoardR=bR;H._lastBoardC=bC;delete H._lastBpR;onBoardEnter(bR,bC);
    }else if(bR<0&&H._lastBoardR!==undefined){
      delete H._lastBoardR;delete H._lastBoardC;onBoardLeave();
    }
  }
  // Game BP cells
  const bpEl=g('bpg');
  if(bpEl){
    const cells=bpEl.querySelectorAll('.bpc');
    let pR=-1,pC=-1;
    cells.forEach((cell,idx)=>{if(cell===el||cell.contains(el)){pR=Math.floor(idx/getBPC());pC=idx%getBPC();}});
    if(pR>=0&&(pR!==H._lastBpR||pC!==H._lastBpC)){
      H._lastBpR=pR;H._lastBpC=pC;delete H._lastBoardR;onBPEnter(pR,pC);
    }else if(pR<0&&H._lastBpR!==undefined){
      delete H._lastBpR;delete H._lastBpC;onBPLeave();
    }
  }
  // Shop BP cells
  const shopBpEl=g('shop-bpg');
  if(shopBpEl){
    const cells=shopBpEl.querySelectorAll('.sp-bpc');
    let sR=-1,sC=-1;
    cells.forEach((cell,idx)=>{if(cell===el||cell.contains(el)){sR=Math.floor(idx/getBPC());sC=idx%getBPC();}});
    if(sR>=0)shopBPEnter(sR,sC);else shopBPLeave();
  }
}

// Find a grid cell under point by checking bounding rects
function cellAtPoint(cells,cx,cy){
  let found=-1;
  cells.forEach((cell,idx)=>{const r=cell.getBoundingClientRect();if(cx>=r.left&&cx<=r.right&&cy>=r.top&&cy<=r.bottom)found=idx;});
  return found;
}

// Handle touch-based drop: place held piece at the finger's lifted position
function handleTouchDrop(cx,cy){
  if(H.kind==='shop-treat'){
    const bpEl=g('shop-bpg');
    if(!bpEl){H=resetH();updateGhost();hideHUD();return;}
    const cells=bpEl.querySelectorAll('.sp-bpc');
    const idx=cellAtPoint(cells,cx,cy);
    if(idx>=0){shopDropOnBP(Math.floor(idx/getBPC()),idx%getBPC());}
    else{H=resetH();updateGhost();hideHUD();document.querySelectorAll('.sp-bpc.ok,.sp-bpc.bad').forEach(x=>x.classList.remove('ok','bad'));}
    return;
  }
  if(H.kind==='treat'){
    // Try shop BP first
    const shopBpEl=g('shop-bpg');
    if(shopBpEl){
      const cells=shopBpEl.querySelectorAll('.sp-bpc');
      const idx=cellAtPoint(cells,cx,cy);
      if(idx>=0){shopDropOnBP(Math.floor(idx/getBPC()),idx%getBPC());return;}
    }
    // Try game board
    const boardEl=g('board');
    if(boardEl){
      const cells=boardEl.querySelectorAll('.cell');
      const idx=cellAtPoint(cells,cx,cy);
      if(idx>=0){
        const r=Math.floor(idx/G.bsc),c=idx%G.bsc;
        const or=r-H.grabDr,oc=c-H.grabDc;
        if(boardCanPlace(H.cells,or,oc)){placeTreatOnBoard(r,c);return;}
      }
    }
    // Try game BP
    const bpEl=g('bpg');
    if(bpEl){
      const cells=bpEl.querySelectorAll('.bpc');
      const idx=cellAtPoint(cells,cx,cy);
      if(idx>=0){const r=Math.floor(idx/getBPC()),c=idx%getBPC();onBPMouseUp(r,c);if(!H.kind)return;}
    }
    // Fall back: return treat to BP
    bpAutoPlace(H.data);H=resetH();updateGhost();hideHUD();renderBP();clrBoardPrev();
    return;
  }
  if(H.kind==='cat'){
    // Check trash drop first
    const trashEl=g('trash-drop');
    if(trashEl&&G.disc>0){
      const tr=trashEl.getBoundingClientRect();
      if(cx>=tr.left&&cx<=tr.right&&cy>=tr.top&&cy<=tr.bottom){
        trashEl._hover=false;trashEl.classList.remove('drag-active');
        doDiscard();return;
      }
    }
    const boardEl=g('board');
    if(boardEl){
      const cells=boardEl.querySelectorAll('.cell');
      const idx=cellAtPoint(cells,cx,cy);
      if(idx>=0){onBoardClick(Math.floor(idx/G.bsc),idx%G.bsc);return;}
    }
    dropHeld();
  }
}

function updateGhost(){
  if(!H.kind){g('ghost').style.display='none';return;}
  const cells=H.cells;
  const cols=cells[0].length;
  const cs=H.kind==='cat'?38:26;
  const grid=g('gh-grid');
  grid.style.gridTemplateColumns=`repeat(${cols},${cs}px)`;
  grid.style.gap='3px';
  grid.innerHTML='';
  cells.forEach(row=>row.forEach(v=>{
    const d=document.createElement('div');
    d.className='gh-cell';
    d.style.width=cs+'px';d.style.height=cs+'px';
    if(v){d.style.background=H.color;d.style.borderColor='rgba(255,255,255,.55)';}
    else{d.style.background='transparent';d.style.border='none';}
    grid.appendChild(d);
  }));
}

function showHUD(){g('ihud').classList.add('on');}
function hideHUD(){g('ihud').classList.remove('on');}

// ══════════════════════════════════════════════════════
//  BOARD INTERACTION
// ══════════════════════════════════════════════════════
function onBoardEnter(r,c){
  if(!H.kind)return;
  clrBoardPrev();
  if(H.kind==='treat'){
    const or=r-H.grabDr, oc=c-H.grabDc;
    const ok=boardCanPlace(H.cells,or,oc);
    H.cells.forEach((row,dr)=>row.forEach((v,dc)=>{
      if(!v)return;
      const rr=or+dr,cc=oc+dc;
      if(rr>=0&&rr<G.bsr&&cc>=0&&cc<G.bsc){
        const el=getBCell(rr,cc);
        if(el) el.classList.add(ok&&!G.board[rr][cc].filled?'ok':'bad');
      }
    }));
    return;
  }
  // offset placement by grab position
  const or=r-H.grabDr, oc=c-H.grabDc;
  const ok=boardCanPlace(H.cells,or,oc);
  H.cells.forEach((row,dr)=>row.forEach((v,dc)=>{
    if(!v)return;
    const rr=or+dr,cc=oc+dc;
    if(rr>=0&&rr<G.bsr&&cc>=0&&cc<G.bsc){
      const el=getBCell(rr,cc);
      if(el&&!G.board[rr][cc].filled) el.classList.add(ok?'ok':'bad');
    }
  }));
}
function onBoardLeave(){clrBoardPrev();}

function onBoardClick(r,c){
  if(!H.kind){
    // no held item — try to pick up
    const bd=G.board[r][c];
    if(bd.filled&&bd.kind==='cat'){pickupCatFromBoard(r,c);return;}
    if(bd.filled&&bd.kind==='treat'){
      // pick up treat for drag — clear board cells, hold in H
      const gid=bd.gid;
      const ti=G.treats.findIndex(t=>t.gid===gid);
      if(ti>=0){
        const treatGroup=G.treats[ti];
        treatGroup.cells.forEach(([tr,tc])=>{G.board[tr][tc]=emptyCell();});
        G.treats.splice(ti,1);
        const tdef=treatGroup.tdef;
        H={kind:'treat',source:'board',data:tdef,cells:tdef.bpS,rot:0,
           color:tdef.col,em:tdef.em,handIdx:null,boardGid:gid,bpGid:null,
           grabDr:Math.floor(tdef.bpS.length/2),grabDc:Math.floor(tdef.bpS[0].length/2),dragging:false};
        updateGhost();showHUD();clrBoardPrev();renderAll();
      }
      return;
    }
    return;
  }

  if(H.kind==='cat')  { placeCatOnBoard(r,c); }
  if(H.kind==='treat') { placeTreatOnBoard(r,c); }
}

function placeCatOnBoard(r,c){
  const or=r-H.grabDr, oc=c-H.grabDc;
  if(!boardCanPlace(H.cells,or,oc))return;
  const gid=uid();const placed=[];
  H.cells.forEach((row,dr)=>row.forEach((v,dc)=>{
    if(!v)return;const rr=or+dr,cc=oc+dc;
    G.board[rr][cc]={filled:true,col:H.color,kind:'cat',em:H.em,gid,shape:H.data.shape,type:H.data.type};
    placed.push([rr,cc]);
  }));
  G.cats.push({cells:placed,col:H.color,shape:H.data.shape,type:H.data.type,cat:H.data,gid});
  G.hand.splice(H.handIdx,1);
  H=resetH();updateGhost();hideHUD();clrBoardPrev();renderAll();
}
function placeTreatOnBoard(r,c){
  const or=r-H.grabDr, oc=c-H.grabDc;
  if(!boardCanPlace(H.cells,or,oc))return;
  const gid=uid();const placed=[];
  H.cells.forEach((row,dr)=>row.forEach((v,dc)=>{
    if(!v)return;const rr=or+dr,cc=oc+dc;
    G.board[rr][cc]={filled:true,col:H.color,kind:'treat',em:H.em,gid,shape:null,type:null};
    placed.push([rr,cc]);
  }));
  G.treats.push({cells:placed,gid,tdef:H.data});
  H=resetH();updateGhost();hideHUD();clrBoardPrev();renderAll();
}

function boardCanPlace(cells,r,c){
  for(let dr=0;dr<cells.length;dr++) for(let dc=0;dc<cells[dr].length;dc++){
    if(!cells[dr][dc])continue;
    const rr=r+dr,cc=c+dc;
    if(rr>=G.bsr||cc>=G.bsc||rr<0||cc<0)return false;
    if(G.board[rr][cc].filled)return false;
  }
  return true;
}

function clrBoardPrev(){document.querySelectorAll('.cell.ok,.cell.bad').forEach(c=>c.classList.remove('ok','bad'));}
function getBCell(r,c){return g('board').querySelectorAll('.cell')[r*G.bsc+c]||null;}

// ══════════════════════════════════════════════════════
//  BACKPACK INTERACTION
// ══════════════════════════════════════════════════════
function onBPEnter(r,c){
  if(H.kind!=='treat')return;
  clrBPPrev();
  const or=r-H.grabDr, oc=c-H.grabDc;
  const ok=bpCanAt(H.cells,or,oc);
  H.cells.forEach((row,dr)=>row.forEach((v,dc)=>{
    if(!v)return;const rr=or+dr,cc=oc+dc;
    if(rr>=0&&rr<getBPR()&&cc>=0&&cc<getBPC()){
      const el=getBPCell(rr,cc);
      if(el)el.classList.add(ok?'ok':'bad');
    }
  }));
}
function onBPLeave(){clrBPPrev();}

function clrBPPrev(){document.querySelectorAll('.bpc.ok,.bpc.bad').forEach(c=>c.classList.remove('ok','bad'));}
function onBPMouseUp(r,c){
  if(H.kind!=='treat')return;
  // Use grab offset so treat anchors correctly
  const or=r-H.grabDr, oc=c-H.grabDc;
  if(!bpCanAt(H.cells,or,oc))return;
  bpPlaceAt(H.data,H.cells,or,oc);
  H=resetH();
  updateGhost();hideHUD();clrBPPrev();renderBP();
}
function getBPCell(r,c){return g('bpg').querySelectorAll('.bpc')[r*getBPC()+c]||null;}

// ── BP helpers ──
function bpAutoPlace(tdef){
  const shape=tdef.bpS;
  for(let r=0;r<getBPR();r++) for(let c=0;c<getBPC();c++) if(bpCanAt(shape,r,c)){bpPlaceAt(tdef,shape,r,c);return true;}
  return false;
}
function bpCanAt(cells,r,c){
  for(let dr=0;dr<cells.length;dr++) for(let dc=0;dc<cells[dr].length;dc++){
    if(!cells[dr][dc])continue;
    const rr=r+dr,cc=c+dc;
    if(rr>=getBPR()||cc>=getBPC()||rr<0||cc<0)return false;
    if(G.bp[rr][cc].filled)return false;
  }
  return true;
}
function bpCanFit(shape){for(let r=0;r<getBPR();r++) for(let c=0;c<getBPC();c++) if(bpCanAt(shape,r,c))return true;return false;}
function bpPlaceAt(tdef,cells,r,c){
  const gid=uid();const placed=[];
  cells.forEach((row,dr)=>row.forEach((v,dc)=>{
    if(!v)return;const rr=r+dr,cc=c+dc;
    G.bp[rr][cc]={filled:true,col:tdef.col,em:tdef.em,gid,tdef};
    placed.push([rr,cc]);
  }));
  G.bpGroups.push({gid,tdef,cells:placed});
}
function removeBpGid(gid){
  const grp=G.bpGroups.find(g=>g.gid===gid);if(!grp)return;
  grp.cells.forEach(([r,c])=>G.bp[r][c]={filled:false,col:null,em:null,gid:null,tdef:null});
  G.bpGroups=G.bpGroups.filter(g=>g.gid!==gid);
}

function sellTreatFromShop(gid){
  // Only callable from shop screen
  const grp=G.bpGroups.find(g=>g.gid===gid);if(!grp)return;
  G.cash+=grp.tdef.sp;
  removeBpGid(gid);
  renderAll(); // update backpack display
  renderShopFull(); // refresh shop listing
  g('shop-cash').textContent=G.cash;
}

// ══════════════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════════════
function openDeckPopup(){
  const deck=G.deck;
  g('deck-pop-sub').textContent=deck.length+' card'+(deck.length!==1?'s':'')+' remaining';
  const grid=g('deck-pop-grid');
  grid.innerHTML='';
  if(deck.length===0){grid.innerHTML='<div style="color:var(--mu);font-size:13px;grid-column:1/-1;text-align:center;padding:12px;">Deck is empty!</div>';g('ov-deck').classList.remove('off');return;}
  deck.forEach(cat=>{
    const d=document.createElement('div');
    d.style.cssText='display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--cbg);border-radius:10px;padding:8px 4px;border:2px solid '+cat.col+';';
    d.innerHTML=shpHTML(cat.cells,cat.col,10)+'<div style="font-size:9px;font-weight:800;color:var(--mu);text-align:center;line-height:1.2;">'+cat.em+' '+cap(cat.type)+'<br><span style=\'color:var(--tx);\'>'+cat.shape+'</span></div>';
    grid.appendChild(d);
  });
  g('ov-deck').classList.remove('off');
}
function closeDeckPopup(){g('ov-deck').classList.add('off');}

function show(id){document.querySelectorAll('.scr').forEach(s=>s.classList.remove('on'));g(id).classList.add('on');}
// pickDeck replaced by deckGoTo+renderDeckCarousel
// ── Deck carousel ──
let DECK_ORDER=['classic','orange','wild','big']; // rebuilt from DECKS in initDeckCarousel
let deckIdx=0;
function initDeckCarousel(){
  const carousel=g('deck-carousel');
  if(!carousel)return;
  // Rebuild DECK_ORDER from loaded DECKS
  DECK_ORDER=Object.keys(DECKS);
  if(!DECK_ORDER.length){console.error('No decks loaded from sheet');return;}
  if(!DECK_ORDER.length)DECK_ORDER=['classic'];
  // Rebuild carousel cards from DECKS
  carousel.innerHTML='';
  DECK_ORDER.forEach((id,i)=>{
    const meta=DECK_META[id]||{name:id,em:'🐱',desc:''};
    const card=document.createElement('div');
    card.className='dk'+(i===0?' sel':'');
    card.dataset.deck=id;
    card.innerHTML=`<div class="de">${meta.em}</div><div class="dn">${meta.name}</div><div class="dd">${meta.desc}</div><button class="dk-preview-btn" onclick="openDeckPreview('${id}')">👁 Preview Deck</button>`;
    card.addEventListener('click',e=>{
      if(e.target.classList.contains('dk-preview-btn'))return;
      deckGoTo(i);
    });
    carousel.appendChild(card);
  });
  deckIdx=Math.max(0,DECK_ORDER.indexOf(curDeck));
  renderDeckCarousel();
}
function renderDeckCarousel(){
  const carousel=g('deck-carousel');
  if(!carousel)return;
  carousel.querySelectorAll('.dk').forEach((c,i)=>c.classList.toggle('sel',i===deckIdx));
  // Use scrollLeft based on card width
  const cardW=carousel.offsetWidth;
  carousel.scrollTo({left:deckIdx*cardW,behavior:'smooth'});
  const arrL=g('dk-arr-l'),arrR=g('dk-arr-r');
  if(arrL)arrL.disabled=deckIdx===0;
  if(arrR)arrR.disabled=deckIdx===DECK_ORDER.length-1;
  // dots
  const dots=g('deck-dots');
  if(dots){dots.innerHTML='';DECK_ORDER.forEach((_,i)=>{const d=document.createElement('div');d.className='deck-dot'+(i===deckIdx?' active':'');d.onclick=()=>deckGoTo(i);dots.appendChild(d);});}
  curDeck=DECK_ORDER[deckIdx];
}
function deckNav(dir){deckGoTo(Math.max(0,Math.min(DECK_ORDER.length-1,deckIdx+dir)));}
function deckGoTo(i){deckIdx=i;renderDeckCarousel();}
function openDeckPreview(deckId){
  // Build a preview deck and show popup
  const cfg=DECKS[deckId];
  const validShapes=Object.entries(CSHAPES).filter(([k,v])=>v.reduce((s,r)=>s+r.reduce((a,b)=>a+b,0),0)>1).map(([k])=>k);
  const previewCards=[];
  for(let i=0;i<(CFG.deck_card_count||30);i++){
    const type=cfg.ty[i%cfg.ty.length];
    let shape=cfg.sh[i%cfg.sh.length];
    if(!validShapes.includes(shape))shape=validShapes[i%validShapes.length];
    previewCards.push({type,shape,cells:CSHAPES[shape],col:COLS[type],em:EMS[type]});
  }
  const grid=g('deck-pop-grid');
  if(!grid)return;
  grid.innerHTML='';
  previewCards.forEach(cat=>{
    const d=document.createElement('div');
    d.style.cssText='display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--cbg);border-radius:10px;padding:8px 4px;border:2px solid '+cat.col+';';
    d.innerHTML=shpHTML(cat.cells,cat.col,10)+'<div style="font-size:9px;font-weight:800;color:var(--mu);text-align:center;line-height:1.2;">'+cat.em+' '+cap(cat.type)+'<br><span style=\'color:var(--tx);\'>'+cat.shape+'</span></div>';
    grid.appendChild(d);
  });
  const deckName=(DECK_META[deckId]&&DECK_META[deckId].name)||deckId;
  g('deck-pop-sub').textContent=deckName+' — '+(CFG.deck_card_count||30)+' cards';
  g('ov-deck').classList.remove('off');
}
// Keyboard nav on title screen
document.addEventListener('keydown',e=>{
  if(!g('s-title').classList.contains('on'))return;
  if(e.key==='ArrowLeft')deckNav(-1);
  if(e.key==='ArrowRight')deckNav(1);
});
// Boot: fetch sheets then init
document.addEventListener('DOMContentLoaded',loadConfig);

function startGame(){newGame(curDeck);gameInProgress=true;updateContinueBtn();openRounds();}
function updateContinueBtn(){
  const btn=g('btn-continue');
  if(btn) btn.style.display=gameInProgress?'block':'none';
}
function continueGame(){
  if(!gameInProgress)return;
  openRounds();
}
function exitToMenu(){
  // Reset held state so nothing lingers
  H=resetH();
  updateGhost();hideHUD();
  show('s-title');
  updateContinueBtn();
}
function openRounds(){
  G.shopVisitedThisRound=false;
  // Clear any stale warned flag
  const _pb=document.querySelector('.rds-btn-play');
  if(_pb) delete _pb.dataset.warned;
  renderRoundsTrack();
  g('rds-play-num').textContent=G.round;
  g('rds-cash').textContent=G.cash;
  const hints=['"every round is a new chance to purr-fect your strategy"',
    '"the board grows, but so does your wisdom"','"treats make everything better"',
    '"a cat in the right place scores every time"'];
  g('rds-hint').textContent=hints[(G.round-1)%hints.length];
  show('s-rounds');
}
function openShopFromRounds(){openShop();}
function startRound(){
  // Warn player if they haven't visited the shop yet
  if(!G.shopVisitedThisRound&&G.round>=1){
    showShopWarning();
    // allow second click to bypass
    const btn=document.querySelector('.rds-btn-play');
    if(btn&&!btn.dataset.warned){btn.dataset.warned='1';return;}
  }
  G.firstShop=false;
  const btn=document.querySelector('.rds-btn-play');
  if(btn) delete btn.dataset.warned;
  show('s-game');renderAll();
}
function showShopWarning(){
  const shopBtn=document.querySelector('.rds-btn-shop');
  if(!shopBtn)return;
  const tip=document.createElement('div');
  tip.className='shop-warn-tip';
  tip.textContent='CHECK OUT THE GOODS! 🏪';
  document.body.appendChild(tip);
  const rect=shopBtn.getBoundingClientRect();
  tip.style.left=rect.left+(rect.width/2)+'px';
  tip.style.top=(rect.top-42)+'px';
  tip.style.transform='translateX(-50%)';
  setTimeout(()=>tip.classList.add('show'),10);
  setTimeout(()=>{tip.classList.remove('show');setTimeout(()=>tip.remove(),300);},2200);
}
function renderRoundsTrack(){
  // Pip track
  const pips=g('rds-pips');
  if(pips){
    pips.innerHTML='';
    for(let i=1;i<=RCFG.length;i++){
      const p=document.createElement('div');
      p.className='rds-pip'+(i<G.round?' done':i===G.round?' cur':'');
      p.title='Round '+i;
      pips.appendChild(p);
    }
  }
  // Update round card stats
  const cfg=rcfg(G.round);
  const rn=g('rds-play-num');if(rn)rn.textContent=G.round;
  const rt=g('rds-tgt');if(rt)rt.textContent=cfg.tgt.toLocaleString();
  const re=g('rds-earn');if(re)re.textContent='+$'+cfg.earn;
  const rb=g('rds-board');if(rb)rb.textContent=cfg.bsr+'×'+cfg.bsc;
}
function renderAll(){renderStats();renderBoard();renderHand();renderBP();updFit();}

function renderStats(){
  g('g-tgt').textContent=G.tgt.toLocaleString();
  g('g-earn').textContent=G.earn;
  g('g-score').textContent=G.score.toLocaleString();
  g('g-hands').textContent=G.hands;
  g('g-last').textContent=G.lastScore;
  g('g-deck').textContent=G.deck.length;
  if(g('g-round-top'))g('g-round-top').textContent=G.round;
  g('g-bsize').textContent=`${G.bsr}×${G.bsc} board`;
  const trashBadge=g('trash-badge');
  if(trashBadge) trashBadge.textContent=G.disc;
  const trashEl=g('trash-drop');
  if(trashEl){
    trashEl.classList.toggle('no-disc',G.disc<=0);
    trashEl.classList.toggle('drag-active',H.kind==='cat'&&G.disc>0&&!!trashEl._hover);
  }
}

function treatReqFails(td){
  // Check if this treat's requirement is not met given current board state
  if(!td.req)return false;
  if(td.req==='NO OTHER TREAT') return G.treats.length>1;
  if(td.req==='NEEDS ORANGE') return !G.cats.some(c=>c.type==='orange');
  if(td.req==='ALL SAME TYPE'){
    const types=[...new Set(G.cats.map(c=>c.type))];
    return types.length>1;
  }
  return false;
}

function showBoardTip(e,r,c){
  if(H.kind)return; // don't show tip while dragging
  const bd=G.board[r][c];if(!bd.filled)return;
  const tip=g('board-tip');
  if(bd.kind==='cat'){
    // find cat group score (cells * 10 base)
    const grp=G.cats.find(g=>g.cells.some(([gr,gc])=>gr===r&&gc===c));
    if(!grp)return;
    const base=grp.cells.length*(CFG.base_score_per_cell||10);
    tip.innerHTML=`<div style="font-family:'Fredoka One',cursive;font-size:13px;color:var(--or)">${cap(grp.type)} Cat</div><div style="font-size:10px;margin-top:2px;">${grp.shape} shape · ${grp.cells.length} cells</div><div style="color:#72cc60;margin-top:2px;">Base: +${base} pts</div>`;
  } else if(bd.kind==='treat'){
    const gid=bd.gid;
    const ti=G.treats.find(t=>t.gid===gid);
    if(!ti)return;
    const td=ti.tdef;
    tip.innerHTML=`<div style="font-family:'Fredoka One',cursive;font-size:13px;color:#f060a8">${td.em} ${td.nm}</div><div style="font-size:10px;margin-top:3px;color:#c8d0e8;">${td.ef}</div>${td.req?`<div style="font-size:9px;color:var(--or);margin-top:2px;">${td.req}</div>`:''}`;
  }
  tip.style.display='block';
  moveBoardTip(e);
}
function moveTip(e){
  const tip=g('board-tip');
  if(tip.style.display==='none')return;
  tip.style.left=Math.min(e.clientX+14,window.innerWidth-190)+'px';
  tip.style.top=Math.max(e.clientY-8,4)+'px';
}
function moveBoardTip(e){moveTip(e);}
function hideBoardTip(){g('board-tip').style.display='none';}
function showBPTip(e,r,c){
  if(H.kind)return;
  const bd=G.bp[r][c];if(!bd.filled||!bd.tdef)return;
  const td=bd.tdef;
  const fail=treatReqFails(td);
  const tip=g('board-tip');
  tip.innerHTML=`<div style="font-family:'Fredoka One',cursive;font-size:13px;color:#f060a8">${td.em} ${td.nm}</div><div style="font-size:10px;margin-top:3px;color:#c8d0e8;">${td.ef}</div>${td.req?`<div style="font-size:9px;color:var(--or);margin-top:2px;">${td.req}</div>`:''}${fail?'<div style="font-size:9px;color:#f04040;margin-top:3px;">⚠ Requirement not met</div>':''}`;
  tip.style.display='block';
  moveBPTip(e);
}
function moveBPTip(e){moveTip(e);}
function hideBPTip(){g('board-tip').style.display='none';}

function renderBoard(){
  const el=g('board');
  const maxH=window.innerHeight-168,maxW=(document.querySelector('.cc')?.offsetWidth||440)-38;
  const cs=Math.min(Math.floor((maxH-14)/G.bsr)-3,Math.floor((maxW-14)/G.bsc)-3,78);
  el.style.gridTemplateColumns=`repeat(${G.bsc},${cs}px)`;
  el.innerHTML='';
  for(let r=0;r<G.bsr;r++) for(let c=0;c<G.bsc;c++){
    const div=document.createElement('div');
    div.className='cell';
    div.style.width=cs+'px';div.style.height=cs+'px';
    div.style.fontSize=Math.floor(cs*.36)+'px';
    const bd=G.board[r][c];
    if(bd.filled){
      div.classList.add('filled');
      div.style.background=bd.col;
      div.style.borderColor='rgba(255,255,255,.18)';
      div.title=bd.kind==='cat'?'Click to pick up':'Click to return to backpack';
      if(bd.kind==='cat'){
        div.textContent='';
      } else {
        div.style.fontSize=Math.floor(cs*.45)+'px';
        div.textContent=bd.em||'';
        // outline treat if its requirement fails
        const gid=bd.gid;
        const bt=G.treats.find(t=>t.gid===gid);
        if(bt&&treatReqFails(bt.tdef)){
          div.style.borderColor='#e04848';
          div.style.position='relative';
          const badge=document.createElement('span');
          badge.style.cssText='position:absolute;top:2px;right:2px;background:#e04848;color:#fff;border-radius:50%;width:13px;height:13px;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:900;z-index:2;box-shadow:0 1px 3px rgba(0,0,0,.5);pointer-events:none;line-height:1;';
          badge.textContent='!';
          div.appendChild(badge);
        }
        // mousedown on treat: start drag immediately
        div.addEventListener('mousedown',(e)=>{if(e.button!==0||H.kind)return;e.stopPropagation();onBoardClick(r,c);});
      }
    }
    div.addEventListener('mouseenter',(e)=>{H._lastBoardR=r;H._lastBoardC=c;delete H._lastBpR;onBoardEnter(r,c);showBoardTip(e,r,c);});
    div.addEventListener('mousemove',(e)=>moveBoardTip(e));
    div.addEventListener('mouseleave',()=>{onBoardLeave();hideBoardTip();});
    div.addEventListener('click',()=>onBoardClick(r,c));
    // Touch: pick up filled cells to start a drag; empty cells handled by global touchend
    div.addEventListener('touchstart',(e)=>{
      if(H.kind)return; // already holding — drop handled by global touchend
      const bd=G.board[r][c];
      if(!bd.filled)return;
      e.preventDefault();
      _touchMovedWhileHeld=false;
      onBoardClick(r,c); // picks up cat or treat
    },{passive:false});
    el.appendChild(div);
  }
}

function renderHand(){
  const row=g('hand');row.innerHTML='';
  G.hand.forEach((cat,i)=>{
    const isHeld=H.kind==='cat'&&H.handIdx===i;
    const d=document.createElement('div');
    d.className='cslot'+(isHeld?' held':'');
    d.innerHTML=shpHTML(cat.cells,cat.col,9)+`<div class="csn">${cat.em} ${cap(cat.type)}</div>`;
    d.addEventListener('mousedown',(e)=>{
      if(e.button!==0)return;
      // compute grab offset within the mini shape preview
      const cells=rotC(cat.cells,H.kind==='cat'&&H.handIdx===i?H.rot:0);
      const sz=9,gap=1;
      const gridW=cells[0].length*(sz+gap);
      const gridH=cells.length*(sz+gap);
      const rect=d.getBoundingClientRect();
      const slotCX=rect.left+rect.width/2, slotCY=rect.top+rect.height/2-8;
      const relX=e.clientX-(slotCX-gridW/2);
      const relY=e.clientY-(slotCY-gridH/2);
      const grabDc=Math.max(0,Math.min(cells[0].length-1,Math.floor(relX/(sz+gap))));
      const grabDr=Math.max(0,Math.min(cells.length-1,Math.floor(relY/(sz+gap))));
      pickupCatWithGrab(i,grabDr,grabDc);
    });
    d.addEventListener('touchstart',(e)=>{
      e.preventDefault();
      _touchMovedWhileHeld=false;
      const t=e.touches[0];
      const cells=rotC(cat.cells,H.kind==='cat'&&H.handIdx===i?H.rot:0);
      const sz=9,gap=1;
      const gridW=cells[0].length*(sz+gap);
      const gridH=cells.length*(sz+gap);
      const rect=d.getBoundingClientRect();
      const slotCX=rect.left+rect.width/2, slotCY=rect.top+rect.height/2-8;
      const relX=t.clientX-(slotCX-gridW/2);
      const relY=t.clientY-(slotCY-gridH/2);
      const grabDc=Math.max(0,Math.min(cells[0].length-1,Math.floor(relX/(sz+gap))));
      const grabDr=Math.max(0,Math.min(cells.length-1,Math.floor(relY/(sz+gap))));
      pickupCatWithGrab(i,grabDr,grabDc);
    },{passive:false});
    d.addEventListener('click',()=>{if(!H.dragging)pickupCat(i);});
    row.appendChild(d);
  });
  for(let i=G.hand.length;i<(CFG.hand_count||7);i++){const e=document.createElement('div');e.className='eslot';row.appendChild(e);}
}

function renderBP(){
  const grid=g('bpg');
  const cs=46;
  grid.style.gridTemplateColumns=`repeat(${getBPC()},${cs}px)`;
  grid.innerHTML='';
  for(let r=0;r<getBPR();r++) for(let c=0;c<getBPC();c++){
    const div=document.createElement('div');
    div.className='bpc';
    div.style.width=cs+'px';div.style.height=cs+'px';
    const bd=G.bp[r][c];
    if(bd.filled){
      div.classList.add('ft');
      div.style.background=bd.col+'bb';
      div.style.borderColor=bd.col;
      div.style.position='relative';
      div.textContent=bd.em||'';
      if(bd.gid===G.selBpGid) div.classList.add('sel-t');
      // Use drag-threshold: only pick up if mouse moves > 5px after mousedown
      div.addEventListener('mousedown',(e)=>{
        if(e.button!==0)return;
        const gid=bd.gid;
        const grp=G.bpGroups.find(g=>g.gid===gid);
        if(!grp)return;
        e.stopPropagation();
        const startX=e.clientX,startY=e.clientY;
        let dragging=false;
        const onMove=(me)=>{
          if(dragging)return;
          if(Math.abs(me.clientX-startX)>5||Math.abs(me.clientY-startY)>5){
            dragging=true;
            document.removeEventListener('mousemove',onMove);
            document.removeEventListener('mouseup',onUp);
            dropHeld();
            removeBpGid(gid);
            G.selBpGid=null;hideTTP();
            H={kind:'treat',source:'bp',data:grp.tdef,cells:grp.tdef.bpS,rot:0,
               color:grp.tdef.col,em:grp.tdef.em,handIdx:null,boardGid:null,bpGid:gid,
               grabDr:Math.floor(grp.tdef.bpS.length/2),grabDc:Math.floor(grp.tdef.bpS[0].length/2),dragging:true};
            updateGhost();showHUD();renderBP();
          }
        };
        const onUp=()=>{
          document.removeEventListener('mousemove',onMove);
          document.removeEventListener('mouseup',onUp);
          // Was a click (no drag): select/deselect
          if(!dragging){
            if(G.selBpGid===gid){G.selBpGid=null;hideTTP();}
            else{G.selBpGid=gid;showTTP(grp.tdef);}
            renderBP();
          }
        };
        document.addEventListener('mousemove',onMove);
        document.addEventListener('mouseup',onUp);
      });
      // Touch: drag-threshold same as mouse (> 5px = drag, else tap = select/deselect)
      div.addEventListener('touchstart',(e)=>{
        const gid=bd.gid;
        const grp=G.bpGroups.find(g=>g.gid===gid);
        if(!grp)return;
        e.stopPropagation();
        e.preventDefault();
        const t=e.touches[0];
        const startX=t.clientX,startY=t.clientY;
        let tdragging=false;
        const onTMove=(me)=>{
          me.preventDefault();
          if(tdragging)return;
          const mt=me.touches[0];
          if(Math.abs(mt.clientX-startX)>5||Math.abs(mt.clientY-startY)>5){
            tdragging=true;
            _touchMovedWhileHeld=true;
            document.removeEventListener('touchmove',onTMove);
            document.removeEventListener('touchend',onTEnd);
            dropHeld();
            removeBpGid(gid);
            G.selBpGid=null;hideTTP();
            H={kind:'treat',source:'bp',data:grp.tdef,cells:grp.tdef.bpS,rot:0,
               color:grp.tdef.col,em:grp.tdef.em,handIdx:null,boardGid:null,bpGid:gid,
               grabDr:Math.floor(grp.tdef.bpS.length/2),grabDc:Math.floor(grp.tdef.bpS[0].length/2),dragging:true};
            updateGhost();showHUD();renderBP();
          }
        };
        const onTEnd=()=>{
          document.removeEventListener('touchmove',onTMove);
          document.removeEventListener('touchend',onTEnd);
          if(!tdragging){
            if(G.selBpGid===gid){G.selBpGid=null;hideTTP();}
            else{G.selBpGid=gid;showTTP(grp.tdef);}
            renderBP();
          }
        };
        document.addEventListener('touchmove',onTMove,{passive:false});
        document.addEventListener('touchend',onTEnd);
      },{passive:false});
    }
    div.addEventListener('mouseenter',(e)=>{H._lastBpR=r;H._lastBpC=c;delete H._lastBoardR;onBPEnter(r,c);showBPTip(e,r,c);});
    div.addEventListener('mousemove',(e)=>moveBPTip(e));
    div.addEventListener('mouseleave',()=>{onBPLeave();hideBPTip();});
    div.addEventListener('mouseup',()=>onBPMouseUp(r,c));
    grid.appendChild(div);
  }
}

function shpHTML(cells,col,sz){
  const cols=cells[0].length;
  let h=`<div style="display:grid;grid-template-columns:repeat(${cols},${sz}px);gap:1px">`;
  cells.forEach(row=>row.forEach(v=>{
    if(v) h+=`<div style="width:${sz}px;height:${sz}px;border-radius:2px;background:${col};"></div>`;
    else  h+=`<div style="width:${sz}px;height:${sz}px;"></div>`;
  }));
  return h+'</div>';
}

function showTTP(t){
  g('ttn').textContent=t.nm;
  g('tte').innerHTML=t.ef.replace(/×(\d+)/g,'<span>×$1</span>').replace(/\+(\d+)/g,'<span>+$1</span>');
  const ttr=g('ttr');if(t.req){ttr.textContent=t.req;ttr.style.display='block';}else ttr.style.display='none';
  g('ttf').textContent=t.fl||'';
  g('ttp').classList.add('on');
}
function hideTTP(){g('ttp').classList.remove('on');}
function updFit(){g('btn-fit').disabled=G.cats.length===0;}

// ══════════════════════════════════════════════════════
//  BOARD ACTIONS
// ══════════════════════════════════════════════════════
function clearBoard(){
  G.cats.forEach(grp=>G.hand.push(grp.cat));
  G.treats.forEach(bt=>{
    // clear all board cells for this treat
    bt.cells.forEach(([r,c])=>{G.board[r][c]=emptyCell();});
    bpAutoPlace(bt.tdef);
  });
  G.cats=[];G.treats=[];
  if(H.kind==='cat'||H.kind==='treat'){H=resetH();updateGhost();hideHUD();}
  mkBoard();renderAll();hideTTP();
}

function doDiscard(){
  if(H.kind!=='cat'||G.disc<=0)return;
  G.deck.push(G.hand.splice(H.handIdx,1)[0]);sfl(G.deck);
  G.disc--;
  H=resetH();updateGhost();hideHUD();
  if(G.deck.length>0)G.hand.push(G.deck.shift());
  renderAll();
}

// ══════════════════════════════════════════════════════
//  SCORING — animated sequence
// ══════════════════════════════════════════════════════
function doFit(){
  if(!G.cats.length)return;

  // cats start at 0 — treats are the sole score source
  const catScores={};
  G.cats.forEach(grp=>{catScores[grp.gid]=0;});

  // sort treats top-to-bottom (higher on board = smaller row = applied first)
  const sorted=[...G.treats].sort((a,b)=>{
    const minA=Math.min(...a.cells.map(([r])=>r));
    const minB=Math.min(...b.cells.map(([r])=>r));
    return minA-minB;
  });

  // apply treats in sorted order — pass all treat cells (not just first)
  const treatResults=sorted.map(t=>{
    const res=t.tdef.fn(G.board,G.cats,G.treats,t.cells,catScores)||{};
    if(t.tdef.phase==='add') applyAddResult(t,res,catScores);
    else applyMulResult(t,res,catScores);
    return{treat:t,result:res,phase:t.tdef.phase};
  });

  // sum finalized cat scores
  const catTotal=Object.values(catScores).reduce((a,b)=>a+b,0);

  // board fill bonus
  const filledCells=G.board.flat().filter(c=>c.filled).length;
  const totalBoardCells=G.bsr*G.bsc;
  const boardFull=filledCells===totalBoardCells;
  const boardBonus=boardFull?totalBoardCells*(CFG.board_fill_bonus||5):0;

  const total=catTotal+boardBonus;
  G.lastScore=total;

  const catsSnapshot=[...G.cats];

  G.treats.forEach(bt=>{
    bt.cells.forEach(([r,c])=>{G.board[r][c]=emptyCell();});
    bpAutoPlace(bt.tdef);
  });
  G.treats=[];

  runScoreSequence(catScores,treatResults,boardBonus,boardFull,total,catsSnapshot);
}

// Distribute add bonus: flat +amt per affected cat group
function applyAddResult(t,res,catScores){
  if(!res||!res.bonus)return;
  const ef=t.tdef.ef;
  const amt=extractNum(ef);
  const treatCells=t.cells;
  const [tRow,tCol]=treatCells[0];
  const affected=[];
  G.cats.forEach(grp=>{
    let hit=false;
    if(ef.includes('ALL')) hit=true;
    else if(ef.includes('ROW')) hit=grp.cells.some(([r])=>r===tRow);
    else if(ef.includes('COL')) hit=grp.cells.some(([,c])=>c===tCol);
    else if(ef.includes('SURR')||ef.includes('surrounding')){
      // check against ALL treat cells (full shape)
      hit=treatCells.some(([tr,tc])=>grp.cells.some(([r,c])=>Math.abs(r-tr)<=1&&Math.abs(c-tc)<=1));
    }
    else hit=true;
    if(hit) affected.push(grp.gid);
  });
  // flat +amt per affected cat group (not per cell)
  affected.forEach(gid=>{if(catScores[gid]!==undefined)catScores[gid]+=amt;});
}

// Apply a mul-treat's multiplier to specific catScores
function applyMulResult(t,res,catScores){
  if(!res)return;
  // res format: {gids:[...], m:multiplier} OR legacy {bonus, desc}
  if(res.gids!==undefined){
    // new format
    const {gids,m}=res;
    if(!gids.length||m<=1)return;
    gids.forEach(gid=>{if(catScores[gid]!==undefined)catScores[gid]=Math.round(catScores[gid]*m);});
  }
}

function runScoreSequence(catScores,treatResults,boardBonus,boardFull,total,catsSnapshot){
  const seq=g('ov-score-seq');
  seq.innerHTML='';
  seq.classList.add('active');

  const boardEl=g('board');
  const firstCell=boardEl.children[0]?.getBoundingClientRect();
  if(!firstCell){endScoreSequence(total);return;}
  const cellW=firstCell.width;
  const labelW=Math.max(32,Math.min(48,cellW*.75));
  const labelH=Math.max(20,Math.min(30,cellW*.45));
  const labelFS=Math.max(9,Math.min(14,cellW*.22));

  const dim=document.createElement('div');
  dim.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:-1;';
  seq.appendChild(dim);

  // grpMap — cats start at 0; scores build up through treats
  const grpMap={};
  catsSnapshot.forEach(grp=>{
    grpMap[grp.gid]={cells:grp.cells,score:0,els:[]};
  });

  const updateLabels=(highlightGids=[],color)=>{
    Object.entries(grpMap).forEach(([gid,info])=>{
      const sc=info.score;
      info.els.forEach((lbl,i)=>{
        if(sc>0){lbl.textContent='+'+sc;lbl.classList.add('show');}
        if(highlightGids.includes(gid)){
          lbl.style.background=color||'rgba(245,166,35,.85)';
          lbl.classList.add('boosted');
          setTimeout(()=>{lbl.classList.remove('boosted');lbl.style.background='';},700);
        }
      });
    });
  };

  // place cell labels (start hidden — appear when cats first get score)
  catsSnapshot.forEach(grp=>{
    grp.cells.forEach(([r,c],ci)=>{
      const lbl=document.createElement('div');
      lbl.className='score-cell-label';
      const cellEl=boardEl.children[r*G.bsc+c];
      if(!cellEl)return;
      const rect=cellEl.getBoundingClientRect();
      lbl.style.left=(rect.left+(rect.width-labelW)/2)+'px';
      lbl.style.top=(rect.top+(rect.height-labelH)/2)+'px';
      lbl.style.width=labelW+'px';lbl.style.height=labelH+'px';lbl.style.fontSize=labelFS+'px';
      lbl.textContent='';
      lbl.dataset.gid=grp.gid;
      seq.appendChild(lbl);
      grpMap[grp.gid].els.push(lbl);
    });
  });

  const scoreEl=g('g-score');
  const scoreCard=scoreEl?.closest('.card');
  const baseScoreBeforeHand=G.score;
  let displayedScore=0;
  let _counterIv=null;
  function animateCounter(targetScore,duration){
    if(!scoreEl)return;
    if(_counterIv){clearInterval(_counterIv);_counterIv=null;}
    const start=displayedScore,diff=targetScore-start;
    if(diff<=0){scoreEl.textContent=(baseScoreBeforeHand+targetScore).toLocaleString();displayedScore=targetScore;return;}
    const steps2=Math.min(30,Math.ceil(duration/16));let step=0;
    if(scoreCard){scoreCard.classList.remove('score-card-lit');void scoreCard.offsetWidth;scoreCard.classList.add('score-card-lit');}
    _counterIv=setInterval(()=>{
      step++;displayedScore=Math.round(start+diff*(step/steps2));
      if(scoreEl)scoreEl.textContent=(baseScoreBeforeHand+displayedScore).toLocaleString();
      if(step>=steps2){clearInterval(_counterIv);_counterIv=null;displayedScore=targetScore;if(scoreEl)scoreEl.textContent=(baseScoreBeforeHand+targetScore).toLocaleString();}
    },Math.ceil(duration/steps2));
  }

  const logDiv=document.createElement('div');logDiv.className='seq-log';seq.appendChild(logDiv);
  const banner=document.createElement('div');banner.className='score-total-banner';
  banner.textContent='+'+total.toLocaleString();seq.appendChild(banner);

  const stepExplain=document.createElement('div');
  stepExplain.style.cssText='position:fixed;bottom:calc(12% + 60px);left:50%;transform:translateX(-50%);z-index:403;text-align:center;font-family:\'Fredoka One\',cursive;font-size:14px;color:rgba(255,255,255,.8);max-width:340px;width:90%;background:rgba(26,34,54,.88);border-radius:14px;padding:10px 18px;';
  if(!DEV_MODE)stepExplain.style.display='none';
  seq.appendChild(stepExplain);

  const nextBtn=document.createElement('button');
  nextBtn.style.cssText='position:fixed;bottom:12%;left:50%;transform:translateX(-50%);z-index:404;padding:12px 36px;border:none;cursor:pointer;background:#fff;color:var(--tx);font-family:\'Fredoka One\',cursive;font-size:16px;border-radius:50px;box-shadow:0 4px 0 rgba(0,0,0,.2);';
  nextBtn.textContent='Next →';
  if(!DEV_MODE)nextBtn.style.display='none';
  seq.appendChild(nextBtn);

  const steps=[];

  // One step per treat (in top-to-bottom order, as computed in doFit)
  treatResults.forEach(({treat,result,phase})=>{
    const hasEffect=phase==='add'?(result&&result.bonus>0):(result&&result.gids&&result.gids.length&&result.m>1);
    if(!hasEffect)return;
    steps.push({
      explain:`${treat.tdef.em} ${treat.tdef.nm}: "${treat.tdef.ef}"`,
      run(){
        flashTreat(seq,boardEl,treat,G.bsc);
        const ef=treat.tdef.ef;
        const treatCells=treat.cells;
        const [tRow,tCol]=treatCells[0];
        if(phase==='add'){
          const aff=[];
          const amt=extractNum(ef);
          Object.entries(grpMap).forEach(([gid,info])=>{
            let hit=false;
            if(ef.includes('ALL'))hit=true;
            else if(ef.includes('ROW'))hit=info.cells.some(([r])=>r===tRow);
            else if(ef.includes('COL'))hit=info.cells.some(([,c])=>c===tCol);
            else if(ef.includes('SURR')||ef.includes('surrounding')){
              hit=treatCells.some(([tr,tc])=>info.cells.some(([r,c])=>Math.abs(r-tr)<=1&&Math.abs(c-tc)<=1));
            }
            else hit=true;
            if(hit)aff.push(gid);
          });
          aff.forEach(gid=>{if(grpMap[gid])grpMap[gid].score+=amt;});
          updateLabels(aff,'rgba(100,210,90,.85)');
          addLogLine(logDiv,`${treat.tdef.em} ${treat.tdef.nm}: +${result.bonus}`);
          animateCounter(displayedScore+result.bonus,350);
        } else {
          // mul
          let mulBonus=0;
          result.gids.forEach(gid=>{
            if(grpMap[gid]){const prev=grpMap[gid].score;grpMap[gid].score=Math.round(prev*result.m);mulBonus+=grpMap[gid].score-prev;}
          });
          updateLabels(result.gids,'rgba(240,120,40,.9)');
          addLogLine(logDiv,`${treat.tdef.em} ${treat.tdef.nm}: ×${result.m} (+${mulBonus})`);
          animateCounter(displayedScore+mulBonus,350);
        }
      }
    });
  });

  if(boardBonus>0){
    steps.push({
      explain:`✨ Board Filled Bonus! ${G.bsr*G.bsc} × ${CFG.board_fill_bonus||5} = +${boardBonus}`,
      run(){
        addLogLine(logDiv,`✨ Board Filled! +${boardBonus}`);
        animateCounter(displayedScore+boardBonus,400);
      }
    });
  }

  // Final: sum all cat scores
  steps.push({
    explain:`🏆 Final total: +${total.toLocaleString()} pts this hand.`,
    run(){
      // show labels for all cats that have score
      updateLabels([]);
      const allCells=[];
      catsSnapshot.forEach(grp=>{
        grp.cells.forEach(([r,c],ci)=>{
          if(grpMap[grp.gid]&&grpMap[grp.gid].els[ci])
            allCells.push({r,c,el:grpMap[grp.gid].els[ci],sc:grpMap[grp.gid].score});
        });
      });
      allCells.sort((a,b)=>a.r!==b.r?a.r-b.r:a.c-b.c);
      allCells.forEach((item,i)=>setTimeout(()=>{
        if(item.sc>0){item.el.classList.add('show');}
        item.el.classList.add('boosted');setTimeout(()=>item.el.classList.remove('boosted'),400);
      },i*60));
      setTimeout(()=>{
        animateCounter(total,400);
        addLogLine(logDiv,`🏆 Total: +${total.toLocaleString()}`);
        banner.textContent='+'+total.toLocaleString();
        banner.classList.add('show');
      },allCells.length*60+150);
    },
    isLast:true
  });

  let stepIdx=-1;
  function runNextStep(){
    stepIdx++;
    if(stepIdx>=steps.length){endScoreSequence(total);return;}
    const step=steps[stepIdx];
    stepExplain.textContent=step.explain;
    setTimeout(()=>step.run(),80);
    if(DEV_MODE){
      nextBtn.textContent=step.isLast?'Finish ✓':'Next →';
      nextBtn.onclick=step.isLast?()=>endScoreSequence(total):runNextStep;
    }else{
      const delay=step.isLast?1800:750;
      if(step.isLast)setTimeout(()=>endScoreSequence(total),delay);
      else setTimeout(runNextStep,delay);
    }
  }
  runNextStep();
}

function flashTreat(seq,boardEl,treat,bsc){
  treat.cells.forEach(([tr,tc])=>{
    const el=boardEl.children[tr*bsc+tc];
    if(!el)return;
    const flash=document.createElement('div');
    flash.className='score-treat-flash';
    const rect=el.getBoundingClientRect();
    flash.style.cssText=`position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;border-radius:8px;border:3px solid #fff;box-shadow:0 0 18px 6px rgba(255,220,60,.7);pointer-events:none;opacity:0;transition:opacity .2s;`;
    seq.appendChild(flash);
    setTimeout(()=>flash.style.opacity='1',20);
    setTimeout(()=>flash.style.opacity='0',600);
    setTimeout(()=>flash.remove(),900);
  });
}

function addLogLine(parent,text){
  const line=document.createElement('div');
  line.className='seq-log-line';
  line.textContent=text;
  parent.appendChild(line);
  setTimeout(()=>line.classList.add('show'),20);
}

function endScoreSequence(total){
  const seq=g('ov-score-seq');
  seq.innerHTML='';
  seq.classList.remove('active');
  G.score+=total;
  // Sync score display
  const scoreEl=g('g-score');
  if(scoreEl) scoreEl.textContent=G.score.toLocaleString();
  // No popup — go straight to next hand logic
  G.hands--;
  if(G.score>=G.tgt){roundWin();return;}
  if(G.hands<=0||(G.deck.length===0&&G.hand.length===0)){roundFail();return;}
  dealHand();renderAll();
}

function roundWin(){
  // base earn + $1 per unused hand remaining
  const bonus=G.hands; // G.hands was decremented before roundWin called, so this is hands remaining
  const total=G.earn+bonus;
  G.cash+=total;
  g('wv-sc').textContent=G.score.toLocaleString();
  g('wv-ea').textContent=`+$${total} ($${G.earn} base + $${bonus} unused hands)`;
  g('ov-win').classList.remove('off');
}
function goShop(){
  g('ov-win').classList.add('off');
  // advance round
  G.round++;
  const c=rcfg(G.round);
  G.tgt=c.tgt;G.bsr=c.bsr;G.bsc=c.bsc;G.earn=c.earn;G.hands=c.h;G.disc=CFG.discard_count||3;G.score=0;
  G.firstShop=false;
  G.cats=[];G.treats=[];G.hand=[];mkDeck();dealHand();
  openRounds();
}
function roundFail(){
  g('fv-sc').textContent=G.score.toLocaleString();
  g('fv-tg').textContent=G.tgt.toLocaleString();
  g('ov-fail').classList.remove('off');
}
function restart(){g('ov-fail').classList.add('off');gameInProgress=false;updateContinueBtn();show('s-title');}

// ══════════════════════════════════════════════════════
//  SHOP
// ══════════════════════════════════════════════════════
let shopPool=[]; // current treat pool shown
let shopBoughtIds=new Set(); // treats bought this shop visit
// REROLL_COST now comes from CFG.reroll_cost (loaded from sheets)
const REROLL_COST_DEFAULT=1;
function getRerollCost(){return CFG.reroll_cost||REROLL_COST_DEFAULT;}

function openShop(){
  const isFirst=G.round===1&&!G.visitedShop;
  G.visitedShop=true;
  G.shopVisitedThisRound=true;
  shopBoughtIds=new Set();
  g('shop-sub').textContent=isFirst?'"stock up before the round!"':'"back for more treats!"';
  g('shop-cash').textContent=G.cash;
  const pool=[...TDEFS];sfl(pool);
  shopPool=pool.slice(0,3);
  renderShopFull();
  show('s-shop');
}

function leaveShop(){
  // commit any pending shop treats (already in bpGroups — they were placed during drag)
  // cancel any held shop treat
  if(H.kind==='shop-treat'){
    H=resetH();
    updateGhost();hideHUD();
  }
  openRounds();
}

function rerollTreats(){
  if(G.cash<getRerollCost())return;
  G.cash-=getRerollCost();
  const pool=[...TDEFS];sfl(pool);
  shopPool=pool.slice(0,3);
  renderShopFull();
}

function renderShopFull(){
  const rcEl=g('reroll-cost');if(rcEl)rcEl.textContent='$'+getRerollCost();
  g('shop-cash').textContent=G.cash;
  renderShopBPGrid();
  renderShopBPList();
  renderTreatsRow();
  // reroll button disabled if broke
  const rr=g('treats-reroll');
  if(rr){rr.disabled=G.cash<getRerollCost();const rc=g('reroll-cost');if(rc)rc.textContent='$'+getRerollCost();}
}

// ── Backpack grid (mirror of game BP, shown in shop center) ──
function renderShopBPGrid(){
  const grid=g('shop-bpg');if(!grid)return;
  const cs=42;
  grid.style.gridTemplateColumns=`repeat(${getBPC()},${cs}px)`;
  grid.innerHTML='';
  for(let r=0;r<getBPR();r++) for(let c=0;c<getBPC();c++){
    const div=document.createElement('div');
    div.className='sp-bpc';
    div.style.width=cs+'px';div.style.height=cs+'px';
    const bd=G.bp[r][c];
    if(bd.filled){
      div.classList.add('ft');
      div.style.background=bd.col+'bb';
      div.style.borderColor=bd.col;
      div.style.position='relative';
      div.textContent=bd.em||'';
      // Rearrange: drag from shop BP
      div.addEventListener('mousedown',(e)=>{
        if(H.kind==='shop-treat')return;
        if(e.button!==0)return;
        const gid=bd.gid;
        const grp=G.bpGroups.find(g=>g.gid===gid);
        if(!grp)return;
        e.stopPropagation();
        removeBpGid(gid);
        H={kind:'treat',source:'bp',data:grp.tdef,cells:grp.tdef.bpS,rot:0,
           color:grp.tdef.col,em:grp.tdef.em,handIdx:null,boardGid:null,bpGid:gid,
           grabDr:Math.floor(grp.tdef.bpS.length/2),grabDc:Math.floor(grp.tdef.bpS[0].length/2),dragging:true};
        updateGhost();showHUD();renderShopBPGrid();
      });
      // Touch: drag from shop BP
      div.addEventListener('touchstart',(e)=>{
        if(H.kind==='shop-treat')return;
        const gid=bd.gid;
        const grp=G.bpGroups.find(g=>g.gid===gid);
        if(!grp)return;
        e.preventDefault();
        e.stopPropagation();
        _touchMovedWhileHeld=false;
        removeBpGid(gid);
        H={kind:'treat',source:'bp',data:grp.tdef,cells:grp.tdef.bpS,rot:0,
           color:grp.tdef.col,em:grp.tdef.em,handIdx:null,boardGid:null,bpGid:gid,
           grabDr:Math.floor(grp.tdef.bpS.length/2),grabDc:Math.floor(grp.tdef.bpS[0].length/2),dragging:true};
        updateGhost();showHUD();renderShopBPGrid();
      },{passive:false});
    }
    div.addEventListener('mouseenter',(e)=>{shopBPEnter(r,c);showShopBPTip(e,r,c);});
    div.addEventListener('mousemove',(e)=>moveShopBPTip(e));
    div.addEventListener('mouseleave',()=>{shopBPLeave();hideShopBPTip();});
    div.addEventListener('mouseup',()=>shopDropOnBP(r,c));
    div.addEventListener('click',()=>shopDropOnBP(r,c));
    grid.appendChild(div);
  }
}

function shopBPEnter(r,c){
  if(H.kind!=='shop-treat'&&H.kind!=='treat')return;
  document.querySelectorAll('.sp-bpc.ok,.sp-bpc.bad').forEach(x=>x.classList.remove('ok','bad'));
  const anchorR=r-H.grabDr, anchorC=c-H.grabDc;
  const ok=bpCanAt(H.cells,anchorR,anchorC);
  H.cells.forEach((row,dr)=>row.forEach((v,dc)=>{
    if(!v)return;const rr=anchorR+dr,cc=anchorC+dc;
    if(rr>=0&&rr<getBPR()&&cc>=0&&cc<getBPC()){
      const idx=rr*getBPC()+cc;
      const el=g('shop-bpg').querySelectorAll('.sp-bpc')[idx];
      if(el)el.classList.add(ok?'ok':'bad');
    }
  }));
}
function shopBPLeave(){
  document.querySelectorAll('.sp-bpc.ok,.sp-bpc.bad').forEach(x=>x.classList.remove('ok','bad'));
}
function showShopBPTip(e,r,c){
  if(H.kind==='shop-treat'||H.kind==='treat')return;
  const bd=G.bp[r][c];if(!bd.filled||!bd.tdef)return;
  const td=bd.tdef;
  const tip=g('board-tip');
  tip.innerHTML=`<div style="font-family:'Fredoka One',cursive;font-size:13px;color:#f060a8">${td.em} ${td.nm}</div><div style="font-size:10px;margin-top:3px;color:#c8d0e8;">${td.ef}</div>${td.req?`<div style="font-size:9px;color:var(--or);margin-top:2px;">${td.req}</div>`:''}`;
  tip.style.display='block';
  moveShopBPTip(e);
}
function moveShopBPTip(e){moveTip(e);}
function hideShopBPTip(){g('board-tip').style.display='none';}

// ── Backpack inventory list with sell buttons ──
function renderShopBPList(){
  const el=g('shop-bp-list');if(!el)return;
  el.innerHTML='';
  if(G.bpGroups.length===0){
    el.innerHTML='<div style="font-size:10px;color:rgba(255,255,255,.35);font-style:italic;text-align:center;padding:6px;">Backpack is empty</div>';
    return;
  }
  G.bpGroups.forEach(grp=>{
    const t=grp.tdef;
    const d=document.createElement('div');
    d.className='sp-inv-row';
    d.innerHTML=`<span class="sp-inv-em">${t.em}</span>
      <span class="sp-inv-nm">${t.nm}</span>
      <button class="sp-inv-sell" onclick="sellTreatFromShop('${grp.gid}')">Sell $${t.sp}</button>`;
    el.appendChild(d);
  });
}

// ── Treat cards row ──
function renderTreatsRow(){
  const row=g('treats-row');if(!row)return;
  row.innerHTML='';
  // only show items not yet purchased, sorted: affordable first
  const totalSellable=G.bpGroups.reduce((s,grp)=>s+grp.tdef.sp,0);
  const available=shopPool.filter(td=>!shopBoughtIds.has(td.id)).sort((a,b)=>{
    const canA=G.cash>=a.pr;
    const canB=G.cash>=b.pr;
    const canSellA=G.cash+totalSellable>=a.pr;
    const canSellB=G.cash+totalSellable>=b.pr;
    if(canA!==canB) return canA?-1:1;
    if(canSellA!==canSellB) return canSellA?-1:1;
    return 0;
  });
  const flavors=available.filter(t=>t.fl).map(t=>t.fl);
  const flavorEl=g('treats-flavor');
  if(flavorEl) flavorEl.textContent=flavors[0]||'';
  available.forEach(td=>{
    const broke=G.cash<td.pr;
    const noSpc=!bpCanFit(td.bpS);
    const dis=broke||noSpc;
    const card=document.createElement('div');
    card.className='tc'+(dis?' tc-dis':'');

    // backpack shape mini grid
    const cols=td.bpS[0].length;
    let shapeHtml=`<div class="tc-shape"><div style="display:grid;grid-template-columns:repeat(${cols},16px);gap:2px;background:rgba(0,0,0,.07);padding:4px;border-radius:6px;">`;
    td.bpS.forEach(row=>row.forEach(v=>{
      shapeHtml+=`<div style="width:16px;height:16px;border-radius:3px;background:${v?td.col+'ee':'rgba(0,0,0,.08)'};border:1px solid ${v?td.col+'88':'rgba(0,0,0,.08)'}"></div>`;
    }));
    shapeHtml+='</div></div>';

    const priceClass=dis?'tc-price sold':'tc-price';
    card.innerHTML=`
      <div class="tc-em">${td.em}</div>
      ${shapeHtml}
      <div class="tc-info">
        <div class="tc-nm">${td.nm}</div>
        <div class="tc-ef">${td.ef}</div>
        ${td.req?`<div style="font-size:7px;color:var(--or);font-weight:800;margin-top:1px;">${td.req}</div>`:''}
        ${noSpc&&!broke?'<div style="font-size:7px;color:var(--re);">Bag full!</div>':''}
      </div>
      <div class="tc-right">
        <div class="${priceClass}"><div class="tc-price-coin">🪙</div>${td.pr}</div>
      </div>`;

    if(!dis){
      card.style.cursor='grab';
      card.addEventListener('mousedown',(e)=>{if(e.button===0)shopPickupTreat(td);});
      card.addEventListener('touchstart',(e)=>{
        e.preventDefault();
        _touchMovedWhileHeld=false;
        shopPickupTreat(td);
      },{passive:false});
    }
    row.appendChild(card);
  });
}

function shopPickupTreat(td){
  // Pick up a treat from shop to drag into backpack
  if(G.cash<td.pr)return;
  dropHeld();
  H={kind:'shop-treat',source:'shop',data:td,cells:td.bpS,rot:0,
     color:td.col,em:td.em,handIdx:null,boardGid:null,bpGid:null,
     grabDr:Math.floor(td.bpS.length/2),grabDc:Math.floor(td.bpS[0].length/2),dragging:true};
  updateGhost();showHUD();
}

function shopDropOnBP(r,c){
  if(H.kind==='treat'){
    const or=r-H.grabDr, oc=c-H.grabDc;
    if(!bpCanAt(H.cells,or,oc))return;
    bpPlaceAt(H.data,H.cells,or,oc);
    H=resetH();
    updateGhost();hideHUD();clrBPPrev();
    renderShopFull();
    return;
  }
  if(H.kind!=='shop-treat')return;
  const td=H.data;
  if(G.cash<td.pr){dropHeld();return;}
  // apply grab offset (same as rearrange)
  const or=r-H.grabDr, oc=c-H.grabDc;
  if(!bpCanAt(H.cells,or,oc)){dropHeld();return;}
  G.cash-=td.pr;
  bpPlaceAt(td,H.cells,or,oc);
  shopBoughtIds.add(td.id);
  H=resetH();
  updateGhost();hideHUD();
  renderShopFull();
}

// ══════════════════════════════════════════════════════
//  TREAT EFFECTS
//  Add-treats return {bonus, desc} — bonus is added to affected catScores
//  Mul-treats return {gids:[], m:N} — engine multiplies those catScores by m
// ══════════════════════════════════════════════════════

// ── Add helpers — bonus is +amt per affected cat GROUP (flat, not per cell) ──
function surrAdd(b,cells,amt){
  // cells = array of [r,c] for all treat cells
  const allTCells=Array.isArray(cells[0])?cells:[cells];
  const adjGids=new Set();
  allTCells.forEach(([tr,tc])=>{
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
      if(!dr&&!dc)continue;
      const rr=tr+dr,cc=tc+dc;
      if(rr>=0&&rr<G.bsr&&cc>=0&&cc<G.bsc&&b[rr][cc].kind==='cat'&&b[rr][cc].gid)
        adjGids.add(b[rr][cc].gid);
    }
  });
  const n=adjGids.size;
  return{bonus:n*amt,desc:`+${amt}×${n} adj cats`};
}
function rowAdd(b,cells,amt){
  const r=Array.isArray(cells[0])?cells[0][0]:cells[0];
  const affGids=new Set();
  for(let c=0;c<G.bsc;c++) if(b[r][c].kind==='cat'&&b[r][c].gid) affGids.add(b[r][c].gid);
  const n=affGids.size;
  return{bonus:n*amt,desc:`+${amt}×${n} cats in row`};
}
function colAdd(b,cells,amt){
  const col=Array.isArray(cells[0])?cells[0][1]:cells[1];
  const affGids=new Set();
  for(let rr=0;rr<G.bsr;rr++) if(b[rr][col].kind==='cat'&&b[rr][col].gid) affGids.add(b[rr][col].gid);
  const n=affGids.size;
  return{bonus:n*amt,desc:`+${amt}×${n} cats in col`};
}
function allAdd(cats,amt){
  return{bonus:cats.length*amt,desc:`+${amt}×${cats.length} cats`};
}

// ── Mul helpers — return {gids, m} so engine applies to real catScores ──
function allMulCS(cats,cs,m){
  return{gids:cats.map(c=>c.gid),m};
}
function colMul(b,cats,cells,m){
  const col=Array.isArray(cells[0])?cells[0][1]:cells[1];
  const gids=cats.filter(grp=>grp.cells.some(([,cc])=>cc===col)).map(grp=>grp.gid);
  return{gids,m};
}
function surrMulCS(b,cats,cells,m,cs){
  const allTCells=Array.isArray(cells[0])?cells:[cells];
  const adjGids=new Set();
  allTCells.forEach(([tr,tc])=>{
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
      if(!dr&&!dc)continue;
      const rr=tr+dr,cc=tc+dc;
      if(rr>=0&&rr<G.bsr&&cc>=0&&cc<G.bsc&&b[rr][cc].kind==='cat'&&b[rr][cc].gid)
        adjGids.add(b[rr][cc].gid);
    }
  });
  return{gids:[...adjGids],m};
}
function shapeMul(cats,shapes,m){
  const gids=cats.filter(c=>shapes.includes(c.shape)).map(c=>c.gid);
  return{gids,m};
}

// ══════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════
function rotC(cells,rot){
  let c=cells.map(r=>[...r]);
  for(let i=0;i<rot%4;i++){
    const rows=c.length,cols=c[0].length;
    const n=Array.from({length:cols},()=>Array(rows).fill(0));
    for(let r=0;r<rows;r++) for(let cc=0;cc<cols;cc++) n[cc][rows-1-r]=c[r][cc];
    c=n;
  }
  return c;
}
function sfl(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}
function g(id){return document.getElementById(id);}
function uid(){return Math.random().toString(36).slice(2,9);}
window.addEventListener('resize',()=>{if(G.board?.length)renderBoard();});
</script>
