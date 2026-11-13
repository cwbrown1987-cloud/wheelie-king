import {ITEMS,item,DEFAULT_OUTFIT,STARTERS,BUNDLES} from './gear-catalogue.js';
const KEY='wk-rider-gear-v1';
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'null')||{}}catch{return {}}}
const OLD_DEFAULT={helmet:'gear_trail_helmet_lime',top:'gear_hoodie_top_blue',pants:'gear_joggers_pants_neon',gloves:'gear_moto_gloves_red',shoes:'gear_skate_shoes_neon'};
const saved=read();let owned=new Set([...STARTERS,...(Array.isArray(saved.owned)?saved.owned:[]).filter(id=>item(id))]),equipped={...DEFAULT_OUTFIT};
const savedEquip=saved.equipped||{};
const PREV_DEFAULT={helmet:'gear_trail_helmet_lime',top:'gear_jersey_top_blue',pants:'gear_joggers_pants_neon',gloves:'gear_moto_gloves_neon',shoes:'gear_boot_shoes_neon'};
const stillOld=!Object.keys(savedEquip).length||Object.keys(PREV_DEFAULT).every(k=>(savedEquip[k]||PREV_DEFAULT[k])===PREV_DEFAULT[k])||Object.keys(OLD_DEFAULT).every(k=>(savedEquip[k]||OLD_DEFAULT[k])===OLD_DEFAULT[k]);
if(!stillOld){for(const [slot,id]of Object.entries(savedEquip))if(owned.has(id)&&item(id)?.slot===slot)equipped[slot]=id}
function save(){localStorage.setItem(KEY,JSON.stringify({owned:[...owned],equipped}));dispatchEvent(new CustomEvent('wk-gear-change'))}
export const gearState=()=>({owned:[...owned],equipped:{...equipped}});
export const outfit=()=>Object.fromEntries(Object.entries(equipped).map(([slot,id])=>[slot,item(id)]));
export function equip(id){const p=item(id);if(!p||!owned.has(id)||p.slot==='display')return false;equipped[p.slot]=id;save();return true}
export function unequipAccessory(){delete equipped.accessory;save()}
export function purchase(id){const p=item(id)||BUNDLES.find(b=>b.id===id);if(!p)return {ok:false,reason:'Unknown item'};const ids=p.items||[id];if(ids.every(id=>owned.has(id)))return {ok:true,alreadyOwned:true};const wallet=globalThis.__WK_WALLET__;if(!globalThis.DEV_INFINITE_MONEY){if(!wallet||wallet.balance<p.price)return {ok:false,reason:'Not enough coins'};wallet.set(n=>Math.max(0,n-p.price))}ids.forEach(id=>owned.add(id));save();return {ok:true}}
export const ownedItems=slot=>ITEMS.filter(p=>owned.has(p.id)&&(!slot||p.slot===slot));
