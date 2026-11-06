const SAVED='wk-saved-rides-v1',LAYOUT='wk-garage-layout-v1';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback}};
export function savedRides(){const value=read(SAVED,null);return Array.isArray(value)?value.filter(v=>typeof v?.name==='string'&&v.b&&typeof v.b.frame==='string').slice(0,12):null}
export function persistRides(rides){localStorage.setItem(SAVED,JSON.stringify(rides));}
export const rideKey=(r,i)=>r.id||'saved:'+i+':'+r.name;
export const layout=()=>read(LAYOUT,{});
export function saveLayout(value){localStorage.setItem(LAYOUT,JSON.stringify(value))}
export function saveCurrent(name){const rides=globalThis.__WK_SAVED_BUILDS__||[];if(rides.length>=12)return false;const b=globalThis.__WK_BUILD__;if(!b||!globalThis.__WK_BUILD_READY__(b).ready)return false;const next=[...rides,{id:crypto.randomUUID(),name:name.trim().slice(0,40)||'My ride',b:{...b}}];persistRides(next);globalThis.__WK_SAVED_SET__?.(next);return true}
globalThis.__WK_SAVED_LOAD__=savedRides;globalThis.__WK_SAVED_SAVE__=persistRides;

// Assign legacy saves stable IDs before names/indices change, preserving placements.
function editableRides(){
 const rooms=layout(),current=globalThis.__WK_SAVED_BUILDS__||[],active=globalThis.__WK_ACTIVE_RIDE__;
 const next=current.map((r,i)=>{const old=rideKey(r,i),id=r.id||crypto.randomUUID();if(old!==id){if(rooms[old]){rooms[id]=rooms[old];delete rooms[old];}if(active===old)globalThis.__WK_ACTIVE_RIDE__=id;}return {...r,id};});
 return {current,next,rooms};
}
function publishRides(next,rooms){persistRides(next);saveLayout(rooms);globalThis.__WK_SAVED_BUILDS__=next;globalThis.__WK_SAVED_SET__?.(next);}
export function renameRide(key,name){
 const label=String(name).trim().slice(0,40);if(!label)return false;
 const {current,next,rooms}=editableRides(),i=current.findIndex((r,i)=>rideKey(r,i)===key);if(i<0)return false;
 next[i]={...next[i],name:label};publishRides(next,rooms);return next[i].id;
}
export function deleteRide(key){
 const {current,next,rooms}=editableRides(),i=current.findIndex((r,i)=>rideKey(r,i)===key);if(i<0)return false;
 const removed=next.splice(i,1)[0];delete rooms[removed.id];
 // An unchanged Workshop draft must not immediately recreate a deleted save.
 if(globalThis.__WK_ACTIVE_RIDE__===removed.id||JSON.stringify(globalThis.__WK_BUILD__)===JSON.stringify(removed.b)){
  localStorage.setItem('wk-deleted-draft-v1',JSON.stringify(globalThis.__WK_BUILD__||removed.b));globalThis.__WK_ACTIVE_RIDE__=null;
 }
 publishRides(next,rooms);return true;
}
