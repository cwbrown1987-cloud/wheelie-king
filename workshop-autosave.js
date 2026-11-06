import {persistRides,rideKey} from './garage-state.js';
const KEY='wk-workshop-draft-v1';let restored=false,last='';
function restore(){restored=true;try{const draft=JSON.parse(localStorage.getItem(KEY)||'null');if(draft&&globalThis.__WK_CAT__?.().items.some(p=>p.id===draft.frame&&p.slot==='frame')){__WK_SETBUILD__(draft);return true}}catch{}return false}
function save(){
 if(!restored&&restore())return;
 if(globalThis.__WK_ROOM__?.view||globalThis.__WK_PREVIEW_BUILD__?.pending)return;
 const b=globalThis.__WK_BUILD__;if(!b||!globalThis.__WK_CAT__?.().items.some(p=>p.id===b.frame&&p.slot==='frame'))return;
 localStorage.setItem(KEY,JSON.stringify(b));
 const rides=globalThis.__WK_SAVED_BUILDS__||[],active=globalThis.__WK_ACTIVE_RIDE__;
 let index=rides.findIndex((r,i)=>rideKey(r,i)===active&&r.b.frame===b.frame);if(index<0)index=rides.findIndex(r=>r.b.frame===b.frame);
 const next=rides.map(r=>({...r,b:{...r.b}}));if(index<0){if(next.length>=12)return;const p=globalThis.__WK_CAT__?.().items.find(p=>p.id===b.frame);next.push({id:crypto.randomUUID(),name:p?.name?.replace(/ Frame$/,'')||'My ride',b:{...b}});index=next.length-1}else next[index].b={...b};
 persistRides(next);globalThis.__WK_SAVED_BUILDS__=next;globalThis.__WK_SAVED_SET__?.(next);globalThis.__WK_ACTIVE_RIDE__=rideKey(next[index],index);
}
document.addEventListener('click',e=>{if(e.target.closest('[data-destination],[data-wk-nav]'))save()},true);
addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save()});
setInterval(()=>{if(!globalThis.__WK_SETBUILD__||!globalThis.__WK_BUILD_READY__)return;if(!restored&&restore())return;if(globalThis.__WK_ROOM__?.view||globalThis.__WK_PREVIEW_BUILD__?.pending)return;const b=globalThis.__WK_BUILD__,key=JSON.stringify(b);if(b&&key!==last){last=key;localStorage.setItem(KEY,key)}},150);
