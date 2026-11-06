const SAVED='wk-saved-rides-v1',LAYOUT='wk-garage-layout-v1';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback}};
export function savedRides(){const value=read(SAVED,null);return Array.isArray(value)?value.filter(v=>typeof v?.name==='string'&&v.b&&typeof v.b.frame==='string').slice(0,12):null}
export function persistRides(rides){localStorage.setItem(SAVED,JSON.stringify(rides));}
export const rideKey=(r,i)=>r.id||'saved:'+i+':'+r.name;
export const layout=()=>read(LAYOUT,{});
export function saveLayout(value){localStorage.setItem(LAYOUT,JSON.stringify(value))}
export function saveCurrent(name){const rides=globalThis.__WK_SAVED_BUILDS__||[];if(rides.length>=12)return false;const b=globalThis.__WK_BUILD__;if(!b||!globalThis.__WK_BUILD_READY__(b).ready)return false;const next=[...rides,{id:crypto.randomUUID(),name:name.trim().slice(0,40)||'My ride',b:{...b}}];persistRides(next);globalThis.__WK_SAVED_SET__?.(next);return true}
globalThis.__WK_SAVED_LOAD__=savedRides;globalThis.__WK_SAVED_SAVE__=persistRides;
