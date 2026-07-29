'use strict';
// ══════════════════════════════════════════════════════
//  ANALYTICS — anonymous play telemetry → the Telemetry sheet tab
// ══════════════════════════════════════════════════════
//  Answers "who played how much, and from where" for the live demo, without
//  a third party owning the data: every event is POSTed to a Google Apps
//  Script web app that appends rows to the `Telemetry` tab of the same
//  spreadsheet the game already reads its config from. `stats.html` reads
//  those rows back through the ordinary published-CSV feed.
//
//  ANONYMOUS BY DESIGN. There is no name, no login, no cookie and no IP
//  address in the payload — `visitor` is a random id this browser made up for
//  itself, and the geo fields are the coarse country/region/city that a public
//  IP-geolocation service hands back (the IP itself is read and thrown away,
//  never sent to the sheet). Nothing here identifies a person; it identifies a
//  browser, so "12 visitors" means 12 browsers, and the same playtester on
//  phone and laptop counts twice.
//
//  Fail-soft everywhere: no endpoint configured, network down, geo lookup
//  blocked by an ad blocker, localStorage unavailable — the game plays on and
//  the only cost is a missing row. Nothing in here may ever throw into a game
//  code path.
// ══════════════════════════════════════════════════════

// ── The collector endpoint ──
// Paste the Apps Script deployment URL here (it ends in /exec). Until it is
// set, telemetry is fully inert — no queue, no network, no geo lookup.
// See docs/analytics.md for the one-time deploy. The General sheet tab can
// override this at runtime with an `analytics_url` key, so the endpoint can be
// re-pointed from the sheet without a code change.
const PF_ANALYTICS_URL = '';

const PF_TM = {
  q: [],              // pending events, oldest first
  ready: false,       // passed the enabled/embedded checks
  vid: '',            // anonymous per-browser id
  sid: '',            // per-tab session id
  geo: null,          // {country, region, city} once resolved
  ref: '',            // arriving host, or (direct)
  ua: '',             // browser · OS family
  active: 0,          // ms of ACTIVE play (tab visible), accumulated
  activeSince: 0,     // timestamp the current visible stretch began
  lastBeat: 0,        // active-ms mark of the last heartbeat
  cleared: 0,         // rounds cleared this session
  timer: null,
};

const PF_TM_QKEY  = 'purrfect_tm_queue';   // survives a lost beacon / offline close
const PF_TM_VKEY  = 'purrfect_vid';
const PF_TM_GKEY  = 'purrfect_tm_geo';
const PF_TM_GEO_TTL = 24 * 60 * 60 * 1000; // re-look-up geo once a day
const PF_TM_BATCH   = 8;                   // flush early once this many pile up
const PF_TM_INTERVAL= 20000;               // …otherwise every 20s
const PF_TM_BEAT    = 120000;              // heartbeat: 1 row per 2 min of ACTIVE play
const PF_TM_MAXQ    = 60;                  // hard cap so a dead endpoint can't grow forever

function pfTmEndpoint(){
  // CFG wins when present so the endpoint can move without a code push.
  try{ if(typeof CFG!=='undefined' && CFG && CFG.analytics_url) return String(CFG.analytics_url).trim(); }catch(e){}
  return PF_ANALYTICS_URL;
}
function pfTmLS(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function pfTmLSSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
function pfTmId(n){
  let s='';
  const abc='abcdefghijklmnopqrstuvwxyz0123456789';
  // crypto when available so two players who load in the same millisecond can't
  // collide — Math.random is a perfectly good fallback for an anonymous tag.
  if(window.crypto&&window.crypto.getRandomValues){
    const a=new Uint8Array(n); window.crypto.getRandomValues(a);
    for(let i=0;i<n;i++) s+=abc[a[i]%abc.length];
  } else {
    for(let i=0;i<n;i++) s+=abc[Math.floor(Math.random()*abc.length)];
  }
  return s;
}

// ── Where the play happened (the deployment, not the player) ──
function pfTmEnv(){
  const h=(location.hostname||'').toLowerCase();
  if(!h||h==='localhost'||h==='127.0.0.1'||location.protocol==='file:') return 'local';
  if(h.endsWith('github.io')) return 'live';
  return h;
}
function pfTmDevice(){
  const w=Math.max(screen.width||0,screen.height||0);
  const coarse=window.matchMedia&&window.matchMedia('(pointer:coarse)').matches;
  if(coarse&&w<900) return 'mobile';
  if(coarse) return 'tablet';
  return 'desktop';
}
function pfTmReferrer(){
  // Only the origin — the full URL of the page that linked here can carry
  // private query strings, and "which link did they arrive from" only needs
  // the host.
  try{
    const r=document.referrer;
    if(!r) return '(direct)';
    const u=new URL(r);
    if(u.hostname===location.hostname) return '';   // internal navigation, not an arrival
    return u.hostname;
  }catch(e){ return ''; }
}

// ── Coarse geo, cached for a day ──
// Two free, key-less, CORS-enabled services, tried in order. The response
// includes the caller's IP; it is deliberately never copied into the payload.
function pfTmGeoLoad(){
  try{
    const raw=pfTmLS(PF_TM_GKEY);
    if(!raw) return null;
    const o=JSON.parse(raw);
    if(!o||!o.t||(Date.now()-o.t)>PF_TM_GEO_TTL) return null;
    return o.g||null;
  }catch(e){ return null; }
}
function pfTmGeoSave(g){ pfTmLSSet(PF_TM_GKEY,JSON.stringify({t:Date.now(),g:g})); }
function pfTmGeoFetch(){
  const cached=pfTmGeoLoad();
  if(cached){ PF_TM.geo=cached; return Promise.resolve(cached); }
  const norm=(c,r,ci)=>({country:c||'',region:r||'',city:ci||''});
  const tryJson=(url,pick)=>fetch(url,{cache:'no-store'})
    .then(r=>r.ok?r.json():Promise.reject(new Error('geo http '+r.status)))
    .then(j=>{ const g=pick(j); if(!g.country) throw new Error('geo empty'); return g; });
  // Full country NAME rather than the ISO code: it reads straight in the sheet,
  // and Chrome on Windows can't render flag emoji anyway.
  return tryJson('https://ipwho.is/?fields=success,country,region,city',
                 j=>(j&&j.success!==false)?norm(j.country,j.region,j.city):norm())
    .catch(()=>tryJson('https://get.geojs.io/v1/ip/geo.json',
                 j=>norm(j&&j.country,j&&j.region,j&&j.city)))
    .then(g=>{ PF_TM.geo=g; pfTmGeoSave(g); return g; })
    .catch(()=>{ PF_TM.geo=norm(); return PF_TM.geo; });   // blocked/offline: tz still hints
}

// ── Active-play accounting ──
// "How much" means time with the tab actually in front of the player, not
// wall-clock since load — a tab left open overnight would otherwise report a
// 9-hour session.
function pfTmActiveMs(){
  let ms=PF_TM.active;
  if(PF_TM.activeSince) ms+=Date.now()-PF_TM.activeSince;
  return ms;
}
function pfTmVisibility(){
  if(document.visibilityState==='visible'){
    if(!PF_TM.activeSince) PF_TM.activeSince=Date.now();
  } else {
    if(PF_TM.activeSince){ PF_TM.active+=Date.now()-PF_TM.activeSince; PF_TM.activeSince=0; }
    pfTrackFlush();   // a backgrounded tab may never come back
  }
}

// ── The queue ──
function pfTmQLoad(){
  try{ const raw=pfTmLS(PF_TM_QKEY); const a=raw?JSON.parse(raw):null; return Array.isArray(a)?a:[]; }
  catch(e){ return []; }
}
function pfTmQSave(){
  try{ localStorage.setItem(PF_TM_QKEY,JSON.stringify(PF_TM.q.slice(-PF_TM_MAXQ))); }catch(e){}
}

// The single public entry point. `fields` is a flat bag matching the sheet's
// columns; anything not listed there rides along in `detail` as JSON.
function pfTrack(event, fields){
  if(!PF_TM.ready||!event) return;
  try{
    const f=fields||{};
    const g=PF_TM.geo||{};
    const row={
      ts:new Date().toISOString(),
      event:String(event),
      visitor:PF_TM.vid,
      session:PF_TM.sid,
      env:pfTmEnv(),
      country:g.country||'',
      region:g.region||'',
      city:g.city||'',
      tz:(Intl&&Intl.DateTimeFormat&&Intl.DateTimeFormat().resolvedOptions().timeZone)||'',
      lang:navigator.language||'',
      device:pfTmDevice(),
      screen:(window.innerWidth||0)+'x'+(window.innerHeight||0),
      referrer:PF_TM.ref||'',
      branch:f.branch||'',
      round:f.round!=null?f.round:'',
      hands_used:f.hands_used!=null?f.hands_used:'',
      score:f.score!=null?f.score:'',
      target:f.target!=null?f.target:'',
      purrfects:f.purrfects!=null?f.purrfects:'',
      modifier:f.modifier||'',
      cash:f.cash!=null?f.cash:'',
      playtime_s:Math.round(pfTmActiveMs()/1000),
      rounds_cleared:PF_TM.cleared,
      detail:f.detail?JSON.stringify(f.detail):'',
      ua:PF_TM.ua||'',
    };
    PF_TM.q.push(row);
    pfTmQSave();
    if(PF_TM.q.length>=PF_TM_BATCH) pfTrackFlush();
  }catch(e){ /* telemetry must never break a game path */ }
}

// Ship whatever is queued. sendBeacon survives the page going away, which is
// exactly when the most interesting event (session_end) fires. text/plain keeps
// it a "simple" request so the browser skips the CORS preflight that an Apps
// Script web app cannot answer.
function pfTrackFlush(){
  if(!PF_TM.ready||!PF_TM.q.length) return;
  const url=pfTmEndpoint();
  if(!url) return;
  const batch=PF_TM.q.slice(0,PF_TM_MAXQ);
  let body;
  try{ body=JSON.stringify({v:1,events:batch}); }catch(e){ PF_TM.q=[]; pfTmQSave(); return; }
  let sent=false;
  try{
    if(navigator.sendBeacon){
      sent=navigator.sendBeacon(url,new Blob([body],{type:'text/plain;charset=UTF-8'}));
    }
  }catch(e){ sent=false; }
  if(!sent){
    try{
      fetch(url,{method:'POST',mode:'no-cors',keepalive:true,
                 headers:{'Content-Type':'text/plain;charset=UTF-8'},body:body});
      sent=true;   // no-cors gives us an opaque response; assume delivery
    }catch(e){ sent=false; }
  }
  // Delivered (or best-effort delivered): drop those rows. Not delivered:
  // leave them queued — localStorage carries them into the next visit.
  if(sent){ PF_TM.q=PF_TM.q.slice(batch.length); pfTmQSave(); }
}

// ── Game lifecycle hooks ──
// Thin named wrappers so the call sites in the game read as intent rather than
// as string literals, and so a schema change lands in one file.
function pfTrackRunStart(branchId,deckId){
  pfTrack('run_start',{branch:branchId||'',detail:{deck:deckId||''}});
}
function pfTrackRoundWin(o){
  PF_TM.cleared++;
  pfTrack('round_win',o||{});
}
function pfTrackRoundFail(o){ pfTrack('round_fail',o||{}); pfTrackFlush(); }
function pfTrackRunComplete(o){ pfTrack('run_complete',o||{}); pfTrackFlush(); }

// ── Boot ──
(function pfTmInit(){
  try{
    // The headless sim runs the real game inside a hidden iframe (js/sim/) and
    // would otherwise post thousands of bot rows. Anything embedded is skipped:
    // the sim injects SIM_BRIDGE only AFTER load, so the iframe test is the one
    // that is reliable this early.
    if(window.self!==window.top) return;
    if(typeof SIM_BRIDGE!=='undefined') return;
    if(!pfTmEndpoint()) return;         // not configured yet: stay completely inert

    PF_TM.vid=pfTmLS(PF_TM_VKEY)||'';
    if(!PF_TM.vid){ PF_TM.vid=pfTmId(12); pfTmLSSet(PF_TM_VKEY,PF_TM.vid); }
    try{
      PF_TM.sid=sessionStorage.getItem('purrfect_sid')||'';
      if(!PF_TM.sid){ PF_TM.sid=pfTmId(10); sessionStorage.setItem('purrfect_sid',PF_TM.sid); }
    }catch(e){ PF_TM.sid=pfTmId(10); }

    PF_TM.ref=pfTmReferrer();
    // Browser + OS family only — enough to spot "it broke on Safari", not a
    // fingerprint.
    PF_TM.ua=(function(){
      const u=navigator.userAgent||'';
      const br=/Edg\//.test(u)?'Edge':/OPR\//.test(u)?'Opera':/Chrome\//.test(u)?'Chrome'
              :/Safari\//.test(u)?'Safari':/Firefox\//.test(u)?'Firefox':'other';
      const os=/Windows/.test(u)?'Windows':/Android/.test(u)?'Android'
              :/iPhone|iPad|iPod/.test(u)?'iOS':/Mac OS X/.test(u)?'macOS'
              :/Linux/.test(u)?'Linux':'other';
      return br+' · '+os;
    })();
    PF_TM.geo=pfTmGeoLoad();
    PF_TM.q=pfTmQLoad();               // anything a previous visit couldn't deliver
    PF_TM.activeSince=document.visibilityState==='visible'?Date.now():0;
    PF_TM.ready=true;

    // Geo first (when it isn't cached) so the session's very first row already
    // carries a country; the lookup is capped so a hanging service can't hold
    // the opening event hostage.
    const start=()=>{ pfTrack('session_start',{}); pfTrackFlush(); };
    if(PF_TM.geo) start();
    else Promise.race([pfTmGeoFetch(),new Promise(r=>setTimeout(r,2500))]).then(start,start);

    document.addEventListener('visibilitychange',pfTmVisibility);
    window.addEventListener('pagehide',()=>{
      if(PF_TM.activeSince){ PF_TM.active+=Date.now()-PF_TM.activeSince; PF_TM.activeSince=0; }
      pfTrack('session_end',{});
      pfTrackFlush();
    });
    PF_TM.timer=setInterval(()=>{
      // Heartbeat on ACTIVE time only: an idle background tab adds nothing, so
      // a session that stops playing stops reporting.
      if(document.visibilityState!=='visible') return;
      const now=pfTmActiveMs();
      if(now-(PF_TM.lastBeat||0)>=PF_TM_BEAT){ PF_TM.lastBeat=now; pfTrack('heartbeat',{}); }
      pfTrackFlush();
    },PF_TM_INTERVAL);
  }catch(e){ PF_TM.ready=false; }
})();
