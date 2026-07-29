'use strict';
// ══════════════════════════════════════════════════════
//  PLAY LOG — the dashboard behind stats.html
// ══════════════════════════════════════════════════════
//  Reads the `Telemetry` tab through the same published-CSV feed the game uses
//  for its config (the tab rides on the spreadsheet's existing publish-to-web
//  setting, so there was nothing extra to publish), aggregates it in the
//  browser and draws it. No backend, no login, no build step.
//
//  Rows arrive as one event per row; almost everything interesting is a
//  property of a SESSION, so sessionize() is the workhorse: it collapses a
//  session's events into how long that browser played, how far it got and
//  where it was.
// ══════════════════════════════════════════════════════

const PF_TELEMETRY_CSV =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxHTMqf05UHp6un_D_4Xbfph4En2GWNLiM1P3yB_B0uC3IJIQMvr-__9HySc0Qorzw1p0T92X6oxTn/pub?gid=148446356&single=true&output=csv';

const S = { rows:[], range:'30', env:'live', error:'', fetchedAt:0 };

// ── CSV → objects ─────────────────────────────────────
// Full state machine: quoted fields can contain commas, newlines and ""
// escapes, and a player's referrer or city will eventually contain one.
function parseCSV(text){
  const rows=[]; let row=[], field='', q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){
      if(c==='"'){ if(text[i+1]==='"'){ field+='"'; i++; } else q=false; }
      else field+=c;
    } else if(c==='"'){ q=true; }
    else if(c===','){ row.push(field); field=''; }
    else if(c==='\n'){ row.push(field); field=''; rows.push(row); row=[]; }
    else if(c!=='\r'){ field+=c; }
  }
  if(field.length||row.length){ row.push(field); rows.push(row); }
  if(!rows.length) return [];
  const head=rows.shift().map(h=>h.trim());
  return rows
    .filter(r=>r.some(v=>String(v).trim()!==''))
    .map(r=>{ const o={}; head.forEach((h,i)=>{ o[h]=r[i]!==undefined?r[i]:''; }); return o; });
}

// ── small helpers ─────────────────────────────────────
function num(v){ const n=Number(v); return isFinite(n)?n:0; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtDur(sec){
  sec=Math.max(0,Math.round(sec));
  if(sec<60) return sec+'s';
  const m=Math.round(sec/60);
  if(m<60) return m+'m';
  const h=Math.floor(m/60), rm=m%60;
  return rm?h+'h '+rm+'m':h+'h';
}
function fmtWhen(ms){
  const d=new Date(ms), now=new Date();
  const sameDay=d.toDateString()===now.toDateString();
  const time=d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  return sameDay?('today '+time):(d.toLocaleDateString([], {month:'short',day:'numeric'})+' '+time);
}
function dayKey(ms){ const d=new Date(ms); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function median(a){
  if(!a.length) return 0;
  const s=a.slice().sort((x,y)=>x-y), m=s.length>>1;
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
}
function g(id){ return document.getElementById(id); }

// ── the filtered slice everything renders against ─────
function slice(){
  const now=Date.now();
  const cutoff=S.range==='all'?0:now-Number(S.range)*86400000;
  return S.rows.filter(r=>
    (S.env==='all'||r.env==='live') &&
    r.tsMs>=cutoff
  );
}

// ── events → sessions ─────────────────────────────────
function sessionize(rows){
  const m=new Map();
  rows.forEach(r=>{
    if(!r.session) return;
    let s=m.get(r.session);
    if(!s){
      s={id:r.session,visitor:r.visitor,first:r.tsMs,last:r.tsMs,country:'',city:'',region:'',
         device:r.device||'',ref:'',play:0,cleared:0,furthest:0,best:0,runs:0,finished:0,endedAt:0,tz:r.tz||''};
      m.set(r.session,s);
    }
    s.first=Math.min(s.first,r.tsMs);
    s.last =Math.max(s.last, r.tsMs);
    if(r.country&&!s.country) s.country=r.country;
    if(r.city&&!s.city)       s.city=r.city;
    if(r.region&&!s.region)   s.region=r.region;
    if(r.referrer&&!s.ref)    s.ref=r.referrer;
    if(r.device&&!s.device)   s.device=r.device;
    // playtime_s and rounds_cleared are cumulative within a session, so the
    // largest value seen is the session's final tally — robust even if the
    // closing beacon never made it.
    s.play   =Math.max(s.play,   num(r.playtime_s));
    s.cleared=Math.max(s.cleared,num(r.rounds_cleared));
    if(r.event==='run_start')    s.runs++;
    if(r.event==='run_complete'){ s.finished++; s.furthest=Math.max(s.furthest,num(r.round)); }
    if(r.event==='round_win'||r.event==='round_fail'){
      s.furthest=Math.max(s.furthest,num(r.round));
      s.best=Math.max(s.best,num(r.score));
    }
    if(r.event==='round_fail') s.endedAt=num(r.round);
  });
  return Array.from(m.values());
}

// ── render ────────────────────────────────────────────
function render(){
  const dash=g('dash');
  if(S.error){ dash.innerHTML=cardError(S.error); return; }
  if(!S.rows.length){ dash.innerHTML=cardEmpty(); g('rowcount').textContent=''; return; }

  const rows=slice();
  const ses=sessionize(rows);
  g('rowcount').textContent=rows.length.toLocaleString()+' events · '+ses.length.toLocaleString()+' sessions';

  if(!ses.length){
    dash.innerHTML='<div class="card"><div class="empty"><div class="em">🐈</div>'
      +'<h3>Nothing in this window</h3><p>No play recorded in the selected range. Try <b>All time</b>, '
      +'or switch Source to <b>Include local</b> if you were testing on your own machine.</p></div></div>';
    return;
  }

  dash.innerHTML=[
    tiles(ses,rows),
    chartDays(ses),
    '<div class="cols">'+cardCountries(ses)+cardReferrers(ses)+'</div>',
    cardFunnel(ses),
    cardSessions(ses),
  ].join('');
}

function tiles(ses,rows){
  const players=new Set(ses.map(s=>s.visitor).filter(Boolean)).size;
  const totalPlay=ses.reduce((a,s)=>a+s.play,0);
  const med=median(ses.map(s=>s.play));
  const runs=ses.reduce((a,s)=>a+s.runs,0);
  const cleared=ses.reduce((a,s)=>a+s.cleared,0);
  const finished=ses.reduce((a,s)=>a+s.finished,0);
  const countries=new Set(ses.map(s=>s.country).filter(Boolean)).size;
  const repeat=ses.length-players;
  const t=(k,v,d)=>'<div class="tile"><div class="k">'+k+'</div><div class="v">'+v+'</div>'
    +(d?'<div class="d">'+d+'</div>':'')+'</div>';
  return '<div class="tiles">'
    +t('Players', players.toLocaleString(), 'unique browsers')
    +t('Sessions', ses.length.toLocaleString(),
        repeat>1?(repeat.toLocaleString()+' were return visits'):repeat===1?'1 was a return visit':'one each')
    +t('Time played', fmtDur(totalPlay), 'active tab time only')
    +t('Typical session', fmtDur(med), 'median')
    +t('Runs started', runs.toLocaleString(), 'a run = one work week')
    +t('Rounds cleared', cleared.toLocaleString(), '')
    +t('Weeks finished', finished.toLocaleString(), finished?'all 15 rounds':'nobody yet')
    +t('Countries', countries.toLocaleString(), '')
    +'</div>';
}

// Sessions per day. One series → one colour; days with no play stay as an
// empty grid-coloured stub so the gap is visible rather than invisible.
function chartDays(ses){
  const byDay=new Map();
  ses.forEach(s=>{
    const k=dayKey(s.first);
    const d=byDay.get(k)||{n:0,play:0,players:new Set()};
    d.n++; d.play+=s.play; d.players.add(s.visitor);
    byDay.set(k,d);
  });
  const first=Math.min.apply(null,ses.map(s=>s.first));
  const start=S.range==='all'?new Date(first):new Date(Date.now()-Number(S.range)*86400000);
  start.setHours(0,0,0,0);
  const days=[];
  for(let d=new Date(start); d<=new Date(); d.setDate(d.getDate()+1)){
    const k=dayKey(d.getTime());
    const hit=byDay.get(k)||{n:0,play:0,players:new Set()};
    days.push({k:k,ms:d.getTime(),n:hit.n,play:hit.play,players:hit.players.size});
    if(days.length>400) break;   // guard: a bad clock shouldn't render forever
  }
  const max=Math.max(1,...days.map(d=>d.n));
  const peakIdx=days.reduce((bi,d,i)=>d.n>days[bi].n?i:bi,0);

  const bars=days.map((d,i)=>{
    const h=d.n?Math.max(3,Math.round(d.n/max*100)):2;
    const lbl=new Date(d.ms).toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'});
    const tip=lbl+' — '+d.n+' session'+(d.n===1?'':'s')
      +(d.n?(' · '+d.players+' player'+(d.players===1?'':'s')+' · '+fmtDur(d.play)):'');
    // Direct-label the peak only; the rest is tooltip + the table below.
    return '<div class="bar'+(d.n?'':' zero')+'" data-tip="'+esc(tip)+'">'
      +(i===peakIdx&&d.n?'<span class="peak">'+d.n+'</span>':'')
      +'<i style="height:'+h+'%"></i></div>';
  }).join('');

  const fmtAx=ms=>new Date(ms).toLocaleDateString([], {month:'short',day:'numeric'});
  const mid=days[Math.floor(days.length/2)];
  return '<div class="card">'
    +'<h2>When they played</h2>'
    +'<div class="hint">Sessions per day · hover a bar for players and time played</div>'
    +'<div class="plot"><div class="bars">'+bars+'</div>'
    +'<div class="axis"><span>'+fmtAx(days[0].ms)+'</span>'
    +(days.length>6?'<span>'+fmtAx(mid.ms)+'</span>':'')
    +'<span>'+fmtAx(days[days.length-1].ms)+'</span></div></div>'
    +'</div>';
}

// Shared horizontal-bar list: label, track, count.
function barList(items,total,opts){
  const o=opts||{};
  const max=Math.max(1,...items.map(i=>i.n));
  if(!items.length) return '<div class="hint" style="margin:6px 0 0;">Nothing recorded yet.</div>';
  return items.map(i=>{
    const pct=Math.round(i.n/max*100);
    const share=total?Math.round(i.n/total*100):0;
    return '<div class="hrow" data-tip="'+esc(i.label+' — '+i.n+' '+(o.unit||'sessions')+' ('+share+'%)')+'">'
      +'<div class="lab">'+esc(i.label)+(i.sub?'<small>'+esc(i.sub)+'</small>':'')+'</div>'
      +'<div class="track"><i style="width:'+pct+'%"></i></div>'
      +'<div class="n">'+i.n+' <small>'+share+'%</small></div>'
      +'</div>';
  }).join('');
}

function cardCountries(ses){
  const by=new Map();
  ses.forEach(s=>{
    const c=s.country||'Unknown';
    const e=by.get(c)||{n:0,play:0,cities:new Map()};
    e.n++; e.play+=s.play;
    if(s.city) e.cities.set(s.city,(e.cities.get(s.city)||0)+1);
    by.set(c,e);
  });
  const items=Array.from(by.entries())
    .map(([c,e])=>({
      label:c, n:e.n, play:e.play,
      sub:Array.from(e.cities.entries()).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]).join(' · '),
    }))
    .sort((a,b)=>b.n-a.n).slice(0,12);
  return '<div class="card"><h2>Where they played from</h2>'
    +'<div class="hint">By session · city from a coarse IP lookup, blank if the player blocks it</div>'
    +barList(items,ses.length,{})
    +'</div>';
}

function cardReferrers(ses){
  const by=new Map();
  ses.forEach(s=>{ const r=s.ref||'(unknown)'; by.set(r,(by.get(r)||0)+1); });
  const items=Array.from(by.entries()).map(([r,n])=>({label:r==='(direct)'?'Direct / typed in':r,n:n}))
    .sort((a,b)=>b.n-a.n).slice(0,10);
  const devs=new Map();
  ses.forEach(s=>{ const d=s.device||'unknown'; devs.set(d,(devs.get(d)||0)+1); });
  const devItems=Array.from(devs.entries()).map(([d,n])=>({label:d,n:n})).sort((a,b)=>b.n-a.n);
  return '<div class="card"><h2>How they got here</h2>'
    +'<div class="hint">The site that linked them, by session</div>'
    +barList(items,ses.length,{})
    +'<h2 style="margin-top:18px;">On what</h2>'
    +'<div class="hint">Device class</div>'
    +barList(devItems,ses.length,{})
    +'</div>';
}

// The retention curve: of every session that started a run, how many were
// still going at round N. Ordered categories, one series, plus the table twin.
function cardFunnel(ses){
  const played=ses.filter(s=>s.furthest>0||s.runs>0);
  if(!played.length){
    return '<div class="card"><h2>How far they got</h2>'
      +'<div class="hint">Nobody has started a run in this window yet.</div></div>';
  }
  const maxRound=Math.max(1,...played.map(s=>s.furthest));
  const rows=[];
  for(let r=1;r<=maxRound;r++){
    const reached=played.filter(s=>s.furthest>=r).length;
    const endedHere=played.filter(s=>s.furthest===r).length;
    rows.push({r:r,reached:reached,endedHere:endedHere});
  }
  const base=Math.max(1,rows[0].reached);
  const bars=rows.map(x=>{
    const pct=Math.round(x.reached/base*100);
    const boss=[3,6,9,12,15].indexOf(x.r)>=0;
    return '<div class="hrow" data-tip="'+esc('Round '+x.r+' — '+x.reached+' of '+base+' sessions got this far ('+pct+'%)'
        +(x.endedHere?(' · '+x.endedHere+' stopped here'):''))+'">'
      +'<div class="lab">Round '+x.r+(boss?'<small>deadline</small>':'')+'</div>'
      +'<div class="track"><i style="width:'+pct+'%"></i></div>'
      +'<div class="n">'+x.reached+' <small>'+pct+'%</small></div>'
      +'</div>';
  }).join('');
  const table=rows.map(x=>'<tr><td class="t">Round '+x.r+'</td><td>'+x.reached+'</td>'
    +'<td>'+Math.round(x.reached/base*100)+'%</td>'
    +'<td'+(x.endedHere?' style="color:var(--stop);font-weight:700;"':'')+'>'+(x.endedHere||'—')+'</td></tr>').join('');
  return '<div class="card"><h2>How far they got</h2>'
    +'<div class="hint">Sessions still playing at each round — where the week starts losing people</div>'
    +'<div class="cols" style="gap:24px;"><div>'+bars+'</div>'
    +'<div class="scroll"><table><thead><tr><th>Round</th><th>Reached</th><th>Share</th><th>Stopped here</th></tr></thead>'
    +'<tbody>'+table+'</tbody></table></div></div>'
    +'</div>';
}

function cardSessions(ses){
  const recent=ses.slice().sort((a,b)=>b.last-a.last).slice(0,25);
  const rows=recent.map(s=>{
    const where=[s.city,s.country].filter(Boolean).join(', ')||'—';
    return '<tr>'
      +'<td class="t">'+esc(fmtWhen(s.first))+'</td>'
      +'<td class="t">'+esc(where)+'</td>'
      +'<td class="t">'+esc(s.device||'—')+'</td>'
      +'<td>'+fmtDur(s.play)+'</td>'
      +'<td>'+(s.cleared||0)+'</td>'
      +'<td>'+(s.furthest?('R'+s.furthest):'—')+'</td>'
      +'<td>'+(s.best?s.best.toLocaleString():'—')+'</td>'
      +'<td class="t">'+(s.finished?'finished the week':s.endedAt?('failed R'+s.endedAt):'left mid-run')+'</td>'
      +'</tr>';
  }).join('');
  return '<div class="card"><h2>Recent sessions</h2>'
    +'<div class="hint">Newest first · one row per browser visit</div>'
    +'<div class="scroll"><table><thead><tr>'
    +'<th>When</th><th>Where</th><th>Device</th><th>Played</th><th>Rounds cleared</th>'
    +'<th>Furthest</th><th>Best score</th><th>How it ended</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table></div></div>';
}

function cardEmpty(){
  return '<div class="card"><div class="empty">'
    +'<div class="em">📦</div>'
    +'<h3>No plays logged yet</h3>'
    +'<p>The <code>Telemetry</code> tab is empty. Either nobody has played since tracking went in, '
    +'or the collector has not been deployed yet — the game stays completely silent until it is.</p>'
    +'<ol>'
    +'<li>Config spreadsheet → <b>Extensions → Apps Script</b>, paste <code>apps-script/telemetry.gs</code>.</li>'
    +'<li><b>Deploy → New deployment → Web app</b>, execute as <b>Me</b>, access <b>Anyone</b>.</li>'
    +'<li>Copy the <code>/exec</code> URL into the <b>General</b> tab as <code>analytics_url</code>, '
    +'or into <code>PF_ANALYTICS_URL</code> in <code>js/analytics.js</code>.</li>'
    +'</ol>'
    +'<p style="margin-top:12px;">Full walkthrough: <code>docs/analytics.md</code></p>'
    +'</div></div>';
}
function cardError(msg){
  return '<div class="card"><div class="empty"><div class="em">😿</div>'
    +'<h3>Could not read the log</h3><p>'+esc(msg)+'</p>'
    +'<p>The published CSV feed may be briefly unavailable — try Refresh.</p></div></div>';
}

// ── tooltip layer ─────────────────────────────────────
// Enhancement only: every number it shows also appears in a table or a label.
(function tooltips(){
  const tip=g('tip');
  document.addEventListener('mouseover',e=>{
    const el=e.target.closest('[data-tip]');
    if(!el) return;
    tip.textContent=el.getAttribute('data-tip');
    tip.classList.add('on');
  });
  document.addEventListener('mousemove',e=>{
    if(!tip.classList.contains('on')) return;
    const pad=14;
    let x=e.clientX+pad, y=e.clientY+pad;
    const r=tip.getBoundingClientRect();
    if(x+r.width>window.innerWidth-8) x=e.clientX-r.width-pad;
    if(y+r.height>window.innerHeight-8) y=e.clientY-r.height-pad;
    tip.style.left=x+'px'; tip.style.top=y+'px';
  });
  document.addEventListener('mouseout',e=>{
    if(e.target.closest('[data-tip]')) tip.classList.remove('on');
  });
})();

// ── load ──────────────────────────────────────────────
function load(){
  const dash=g('dash'), btn=g('refresh');
  dash.classList.add('loading');              // hold the old render, no skeleton flash
  btn.disabled=true; btn.textContent='…';
  // Google caches the published CSV for a few minutes; the buster at least
  // avoids the browser's own copy on top of that.
  fetch(PF_TELEMETRY_CSV+'&_='+Date.now(),{cache:'no-store'})
    .then(r=>r.ok?r.text():Promise.reject(new Error('HTTP '+r.status)))
    .then(text=>{
      S.error='';
      S.rows=parseCSV(text)
        .map(r=>{ r.tsMs=Date.parse(r.ts); return r; })
        .filter(r=>isFinite(r.tsMs));
      S.fetchedAt=Date.now();
    })
    .catch(err=>{ S.error=String(err.message||err); })
    .then(()=>{
      dash.classList.remove('loading');
      btn.disabled=false; btn.textContent='↺ Refresh';
      g('stamp').innerHTML='read '+new Date(S.fetchedAt||Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})
        +'<br>feed lags live play a few min';
      render();
    });
}

function wireSeg(id,key){
  g(id).addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(!b) return;
    Array.from(g(id).children).forEach(c=>c.classList.toggle('on',c===b));
    S[key]=b.getAttribute('data-v');
    render();
  });
}
wireSeg('seg-range','range');
wireSeg('seg-env','env');
g('refresh').addEventListener('click',load);
load();
