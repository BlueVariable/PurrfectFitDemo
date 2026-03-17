'use strict';
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
function weightedSample(items,n,weightFn){
  const result=[];const pool=[...items];
  while(result.length<n&&pool.length>0){
    const weights=pool.map(weightFn);
    const total=weights.reduce((s,w)=>s+w,0);
    let r=Math.random()*total;
    let idx=pool.length-1;
    for(let i=0;i<weights.length;i++){r-=weights[i];if(r<=0){idx=i;break;}}
    result.push(pool.splice(idx,1)[0]);
  }
  return result;
}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}
function g(id){return document.getElementById(id);}
function uid(){return Math.random().toString(36).slice(2,9);}
window.addEventListener('resize',()=>{if(typeof G!=='undefined'&&G.board?.length)renderBoard();});
