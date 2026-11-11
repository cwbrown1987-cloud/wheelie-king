// v2.0 beta: the game opens straight into the Jolt Playground.
// ?garage=1 stays in the Garage (Garage/builder tests), ?legacy=1 opens Chris's classic side-scroller
// through the Race button as before. Test harnesses set sessionStorage wk-autostart=off; ?autostart=1 wins.
export function autostartWanted(loc=globalThis.location,store=globalThis.sessionStorage){
  let q;try{q=new URLSearchParams(loc?.search||'')}catch{return false}
  if(q.has('autostart'))return q.get('autostart')!=='0';
  if(q.has('garage')||q.has('legacy')||q.has('track'))return false; // explicit dev/test entry points
  try{if(store?.getItem('wk-autostart')==='off')return false}catch{}
  return true;
}
export function startAutostart({timeoutMs=30000}={}){
  if(!autostartWanted())return false;
  const t0=performance.now();
  const tick=()=>{
    if(document.querySelector('[data-ride="portal"]')||document.body.hasAttribute('data-wk-race-pending'))return;
    const race=document.querySelector('.wk-destination[data-destination="race"]');
    if(race&&document.querySelector('[data-wk-room-ready]')){globalThis.__WK_AUTOSTARTED__=true;race.click();return;}
    if(performance.now()-t0<timeoutMs)setTimeout(tick,60);
  };
  tick();return true;
}
startAutostart();
