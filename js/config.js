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
  'General': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxHTMqf05UHp6un_D_4Xbfph4En2GWNLiM1P3yB_B0uC3IJIQMvr-__9HySc0Qorzw1p0T92X6oxTn/pub?gid=1778744904&single=true&output=csv',
  'Rounds':  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxHTMqf05UHp6un_D_4Xbfph4En2GWNLiM1P3yB_B0uC3IJIQMvr-__9HySc0Qorzw1p0T92X6oxTn/pub?gid=1133060391&single=true&output=csv',
  'Treats':         'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxHTMqf05UHp6un_D_4Xbfph4En2GWNLiM1P3yB_B0uC3IJIQMvr-__9HySc0Qorzw1p0T92X6oxTn/pub?gid=1829591761&single=true&output=csv',
  'Cats':      'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxHTMqf05UHp6un_D_4Xbfph4En2GWNLiM1P3yB_B0uC3IJIQMvr-__9HySc0Qorzw1p0T92X6oxTn/pub?gid=1088427227&single=true&output=csv',
  'Shapes':     'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxHTMqf05UHp6un_D_4Xbfph4En2GWNLiM1P3yB_B0uC3IJIQMvr-__9HySc0Qorzw1p0T92X6oxTn/pub?gid=1916856622&single=true&output=csv',
  'Decks':   'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxHTMqf05UHp6un_D_4Xbfph4En2GWNLiM1P3yB_B0uC3IJIQMvr-__9HySc0Qorzw1p0T92X6oxTn/pub?gid=2016141493&single=true&output=csv',
  'Rarity':  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxHTMqf05UHp6un_D_4Xbfph4En2GWNLiM1P3yB_B0uC3IJIQMvr-__9HySc0Qorzw1p0T92X6oxTn/pub?gid=1377980715&single=true&output=csv',
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
let RARITY_WEIGHTS = {};
let DEV_MODE = localStorage.getItem('purrfect_dev_mode') === '1';
const DECK_META={};

function rcfg(r){return RCFG[Math.min(r-1,RCFG.length-1)];}

// ── treat fn lookup — maps sheet effect strings to engine functions ──
function buildTreatFn(id, ef, phase, addEf){
  if(TREAT_REGISTRY[id]) return TREAT_REGISTRY[id].buildFn(ef, phase, addEf);
  console.warn(`No registry entry for treat: ${id}`);
  return ()=>({});
}
function extractNum(ef){const m=ef.match(/[+](\d+)/);return m?parseInt(m[1]):0;}
function extractMul(ef){const m=ef.match(/[×x]([\d.]+)/);return m?parseFloat(m[1]):2;}

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
      if(name==='Shapes'||name==='Rarity'){raw[name]='';}else throw e;
    }
  }
  return raw;
}

// Parse raw CSV map and apply to globals
function applyConfigFromRaw(raw){
  const genRows=parseCSV(raw['General']||'');
  genRows.forEach(r=>{CFG[r['Setting']]=isNaN(r['Value'])?r['Value']:Number(r['Value']);});

  const rndRows=parseCSV(raw['Rounds']||'');
  RCFG=rndRows.map(r=>{
    const bsr=Number(r['Board Rows']||r['Board Size']||4);
    const bsc=Number(r['Board Cols']||r['Board Size']||4);
    return{tgt:Number(r['Target Score']),bsr,bsc,earn:Number(r['Earn']),h:Number(r['Hands per Round'])};
  });

  const catRows=parseCSV(raw['Cats']||'');
  catRows.forEach(r=>{COLS[r['Type']]=r['Color'];EMS[r['Type']]=r['Emoji'];});

  // Parse Shapes first so treat bpS can resolve shape IDs
  if(raw['Shapes']){
    try{
      parseCSV(raw['Shapes']).filter(r=>r['Shape ID']&&String(r['Shape ID']).trim()).forEach(r=>{
        const name=String(r['Shape ID']).trim();
        const gridStr=String(r['Grid']||'').trim();
        if(!gridStr)return;
        const grid=gridStr.split('|').map(row=>row.trim().split(',').map(v=>Number(v.trim())||0));
        if(grid.length&&grid[0].length)CSHAPES[name]=grid;
      });
    }catch(e){console.warn('Cat Shapes parse failed:',e.message);}
    console.log('[Config] CSHAPES loaded:', Object.keys(CSHAPES));
  }

  const treatRows=parseCSV(raw['Treats']||'');
  TDEFS=treatRows.filter(r=>r['ID']&&String(r['ID']).trim()).map(r=>{
    const id=String(r['ID']||'').trim();
    const ef=String(r['Effect']||r['Effect '||'']||'').trim();
    const phase=String(r['Phase']||'add').trim().toLowerCase();
    const bpRaw=String(r['Shape ID']||r['Shape ID ']||'1×1').trim();
    const bpS=CSHAPES[bpRaw]||parseBpShape(bpRaw);
    const rar=String(r['Rarity']||'common').trim().toLowerCase();
    const buyRaw=r['Buy Price']||r['Buy Price ']||r['Price']||1;
    const sellRaw=r['Sell Price']||r['Sell Price ']||r['Sell']||0;
    const buyPr=Number(buyRaw)||1;
    const sellPr=CFG.sell_price_coef?Math.round(buyPr*CFG.sell_price_coef):(Number(sellRaw)||0);
    const addEf=String(r['Additional Effects']||'').trim();
    return{
      id, nm:String(r['Name']||id), em:String(r['Emoji']||'❓'), rar, col:rarCol(rar), phase,
      bpS, ef, addEf, req:String(r['Requirement']||r['Req']||'').trim(),
      pr:buyPr, sp:sellPr,
      fl:String(r['Flavor']||r['Flavour']||''),
      fn:buildTreatFn(id,ef,phase,addEf),
    };
  });

  if(raw['Rarity']){
    RARITY_WEIGHTS={};
    parseCSV(raw['Rarity']).forEach(r=>{
      const rar=String(r['Rarity']||'').trim().toLowerCase();
      const prob=parseFloat(r['Drop Probability']);
      if(rar&&!isNaN(prob)) RARITY_WEIGHTS[rar]=prob;
    });
  }

  const deckRows=parseCSV(raw['Decks']||'');
  console.log('[Config] Decks raw CSV:', raw['Decks']?.slice(0,500));
  console.log('[Config] Deck rows parsed:', deckRows.length, deckRows.map(r=>r['Deck ID']));
  DECKS={};
  deckRows.filter(r=>r['Deck ID']&&String(r['Deck ID']).trim()).forEach(r=>{
    const id=String(r['Deck ID']).trim();
    const ty=String(r['Cats']||'orange').split(',').map(t=>t.trim().replace(/\([^)]+\)/,'').trim()).filter(Boolean);
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
      show('s-menu');
      menuUpdateContinue();applyDevModeUI();
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
    show('s-menu');
    menuUpdateContinue();applyDevModeUI();
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
