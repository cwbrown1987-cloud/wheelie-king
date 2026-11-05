// Simple assembly plans share the advanced catalogue and real fitment rules.
import {part} from './modular-catalogue.js';
import {categoryIcon} from './category-icons.js';
let mode=localStorage.getItem('wk-builder-mode')||'simple',panel,modeToggle,simpleRail,last='',section='home',pending=null;
let recovery;try{recovery=JSON.parse(sessionStorage.getItem('wk-pending-build')||'null')}catch{}
const items=()=>globalThis.__WK_CAT__?.().items.filter(p=>!p.hidden)||[];
export function upgradePlan(build,id){
 const p=part(id);if(!p)return null;const b={...build,[p.slot]:id},all=items(),m=p.slot==='motor'?p:part(b.motor);
 if(m&&part(b.frame)?.maxW&&m.w>part(b.frame).maxW)return null;
 if(p.slot==='bars'){const current=part(b.stem);const stem=all.find(x=>x.slot==='stem'&&x.interface===current?.interface&&x.clamp===p.clamp);if(stem)b.stem=stem.id;}
 if(p.slot==='seat'&&b.seatpost&&part(b.seatpost)?.saddleMount!==p.saddleMount){const post=all.find(x=>x.slot==='seatpost'&&globalThis.__WK_FIT__(b,x.id).status!=='no');if(post)b.seatpost=post.id;}
 if(p.slot==='motor'||p.slot==='battery'){
  if(!m)return null;
  const voltage=m.v||part(b.battery)?.v||48;
  const batteries=all.filter(x=>x.slot==='battery'&&x.v===voltage&&x.v*x.a>=m.w&&globalThis.__WK_FIT__(b,x.id).status!=='no').sort((a,b)=>a.price-b.price);
  const battery=p.slot==='battery'?p:batteries.find(x=>x.id===b.battery)||batteries[0];
  if(!battery||battery.v!==voltage||battery.v*battery.a<m.w)return null;
  b.battery=battery.id;
  const controllers=all.filter(x=>x.slot==='controller'&&x.v===voltage&&x.a*x.v>=m.w).sort((a,b)=>a.price-b.price);
  if(!controllers.length)return null;b.controller=controllers[0].id;b.throttle=b.throttle||'thumb';
  if(m.nopedal){delete b.cranks;b.pedals='peg_moto';b.chain='chain_428';b.sprocket_f='spf_428_14';b.sprocket_r='spr_428_48';}
  else if(m.kind==='mid'){b.cranks='crank_mid';b.chain='chain_std';for(const [slot,n]of [['sprocket_f',44],['sprocket_r',18]]){const gear=all.find(x=>x.slot===slot&&x.teeth===n&&x.std==='bicycle');if(gear)b[slot]=gear.id;}}
 }
 for(let pass=0;pass<3;pass++)for(const value of Object.values(b)){
  if(!value)continue;const fit=globalThis.__WK_FIT__(b,value);if(fit.status==='no')return null;
  for(const adapter of fit.adapters||[])b[part(adapter).slot]=adapter;
 }
 return globalThis.__WK_BUILD_READY__(b).ready?b:null;
}
globalThis.__WK_SIMPLE_PLAN__=upgradePlan;
function preview(plan,id,automatic=false){if(pending)return;pending={original:{...globalThis.__WK_BUILD__},plan,id,automatic};sessionStorage.setItem('wk-pending-build',JSON.stringify(pending.original));document.body.dataset.wkPreviewing='true';globalThis.__WK_SETBUILD__(plan);last='';tick();}
function finish(apply){if(!pending)return;const p=pending;pending=null;sessionStorage.removeItem('wk-pending-build');delete document.body.dataset.wkPreviewing;if(apply){if(p.automatic){globalThis.__WK_EQUIP_MANY__(Object.values(p.plan).filter(Boolean));globalThis.__WK_SETBUILD__(p.plan)}else if(!globalThis.__WK_EQUIP__(p.id))globalThis.__WK_SETBUILD__(p.original)}else globalThis.__WK_SETBUILD__(p.original);last='';tick();}
globalThis.__WK_PREVIEW_BUILD__={start:preview,apply:()=>finish(true),cancel:()=>finish(false),get pending(){return pending}};
document.addEventListener('click',e=>{
 const nav=e.target.closest('button');if(pending&&nav&&!nav.closest('#wk-builder')){e.preventDefault();e.stopImmediatePropagation();return;}if(nav&&nav===modeToggle){e.preventDefault();e.stopImmediatePropagation();globalThis.__WK_MODE__(mode==='simple'?'advanced':'simple');section='home';tick();return;}if(mode==='simple'&&!pending&&nav&&!nav.closest('#wk-builder')&&/\bSHOP$/.test(nav.textContent.trim())){e.preventDefault();e.stopImmediatePropagation();section='home';last='';for(const button of document.querySelectorAll('button'))if(/\bGARAGE$/.test(button.textContent.trim())){button.click();break}tick();return;}
 if(pending&&e.target.closest('[aria-label="Test ride"]')){e.preventDefault();e.stopImmediatePropagation();return;}
 const swatch=e.target.closest('[data-wk-swatch]'),card=e.target.closest('[data-wk-part]');if(!swatch&&!card)return;
 if(e.target.closest('[data-wk-info]')||(!swatch&&e.target.closest('button')))return;
 const id=swatch?.dataset.wkSwatch||card.dataset.wkPart,p=part(id);if(!p||p.slot==='sticker'||pending)return;
 const b=globalThis.__WK_BUILD__;if(globalThis.__WK_FIT__(b,id).status==='no')return;
 let plan={...b,[p.slot]:id};if(p.slot==='kit'){plan=p.completeBike?{}:{...b};for(const value of p.kit)plan[part(value).slot]=value;}
 if(p.slot==='frame')for(const [slot,value]of Object.entries(plan))if(slot!=='frame'&&value&&globalThis.__WK_FIT__(plan,value).status==='no')delete plan[slot];
 e.preventDefault();e.stopImmediatePropagation();preview(plan,id);
},true);
globalThis.__WK_MODE__=value=>{mode=value==='advanced'?'advanced':'simple';localStorage.setItem('wk-builder-mode',mode);document.body.dataset.wkMode=mode;last='';};
globalThis.__WK_MODE__(mode);
const style=document.createElement('style');style.textContent=`
body[data-wk-mode="simple"] [data-cat]{display:none!important}body[data-wk-mode="simple"] [data-catpanel],body[data-wk-mode="simple"] [data-wk-advanced-tools],body[data-wk-previewing] [data-catpanel],body[data-wk-previewing] [data-rail="left"]{visibility:hidden!important;pointer-events:none!important}
[data-rail="left"]{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-rows:54px!important;align-content:start;gap:5px!important;scrollbar-width:thin}[data-rail="left"]>button,#wk-simple-rail>button{min-height:54px!important;border-radius:10px;background:#0b100e;color:#cfe9da;border:2px solid #2c3f35;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:3px;font:10px system-ui;font-weight:800;padding:3px;cursor:pointer}#wk-simple-rail{display:contents}#wk-simple-rail[hidden]{display:none!important}
[data-wk-mode-toggle]{width:132px!important;min-width:94px!important;font:11px system-ui!important;font-weight:800!important;padding:5px!important;line-height:1.4!important}[data-wk-mode-toggle] .active{color:#60ff95}[data-wk-mode-toggle] .inactive{color:#91a699}
#wk-builder{position:absolute;left:0;top:0;bottom:0;z-index:9;width:min(600px,60vw);overflow:auto;background:#0d1612fa;border:2px solid #526c5b;border-radius:14px;padding:10px;color:#edf7ef;font:13px system-ui;box-sizing:border-box}#wk-builder[hidden]{display:none!important}
#wk-builder button{background:#214631;color:#d9ffe3;border:1px solid #72a683;border-radius:6px;padding:7px;cursor:pointer}
#wk-builder .choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}#wk-builder .choices button{min-height:64px;white-space:normal;font-size:13px}#wk-builder .choices img{width:100%;height:74px;object-fit:contain;display:block}#wk-builder .selected{border:2px solid #5aff91;background:#305d40}#wk-builder .modes{display:flex;gap:6px;justify-content:space-between}#wk-builder h3{margin:8px 0;font-size:15px}
#wk-builder label{display:block;margin-top:9px}#wk-builder select{display:block;width:100%;margin-top:4px;background:#182820;color:white;border:1px solid #72917d;border-radius:5px;padding:6px}
#wk-builder p{font:12px system-ui;margin:8px 0 0;color:#b8cbbb}
body[data-wk-previewing] #wk-builder{top:auto!important;bottom:12px;left:50%!important;transform:translateX(-50%);width:auto!important;max-height:none;display:flex;gap:12px;padding:10px}body[data-wk-previewing] #wk-builder button{font-size:30px;min-width:70px}
[data-catpanel]{width:min(600px,60vw)!important;max-width:60vw!important}[data-wk-part]{min-width:0}
[data-catpanel] :has(> [data-wk-part]){display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
`;document.head.append(style);
function tick(){
 const riding=!!document.querySelector('[data-ride]'),garage=!!globalThis.__WK_VIEW__?.renderer?.domElement?.isConnected&&!riding;
 if(!panel){panel=document.createElement('section');panel.id='wk-builder';panel.setAttribute('aria-label','Builder mode');document.body.append(panel);}
 panel.hidden=!garage||(!pending&&(mode==='advanced'||section==='home'));if(!garage){if(pending)finish(false);return;}
 const rail=document.querySelector('[data-rail="left"]');if(!rail)return;if(panel.parentElement!==rail.parentElement)rail.parentElement.append(panel);
 modeToggle=document.querySelector('#root button');if(modeToggle){modeToggle.dataset.wkModeToggle='';modeToggle.setAttribute('aria-label','Simple / Advanced');const html=`<span class="${mode==='simple'?'active':'inactive'}">SIMPLE</span> / <span class="${mode==='advanced'?'active':'inactive'}">ADVANCED</span>`;if(modeToggle.innerHTML!==html)modeToggle.innerHTML=html;}
 if(!simpleRail){simpleRail=document.createElement('div');simpleRail.id='wk-simple-rail';}if(simpleRail.parentElement!==rail)rail.append(simpleRail);simpleRail.hidden=mode!=='simple';
 if(!globalThis.__WK_EQUIP__){document.querySelector('[data-cat="bars"]')?.click();return;}
 if(recovery){const original=recovery;recovery=null;sessionStorage.removeItem('wk-pending-build');globalThis.__WK_SETBUILD__(original);return;}
 const b=globalThis.__WK_BUILD__,key=mode+section+JSON.stringify(b)+!!pending;if(key===last)return;last=key;
 simpleRail.replaceChildren();for(const [key,label,icon]of [['bikes','BIKES','frame'],['motor','MOTORS · W','motor'],['battery','BATTERY','battery'],['wheels','WHEELS','tyres'],['suspension','SUSPENSION','suspension'],['style','STYLES / COLOURS','bars'],['paint_frame','FRAME COLOUR','frame'],['paint_suspension','FORK COLOUR','suspension']]){const e=document.createElement('button');e.dataset.simpleCategory=key;e.append(categoryIcon(icon),document.createTextNode(label));e.onclick=()=>{section=section===key?'home':key;last='';tick()};simpleRail.append(e);}
 panel.replaceChildren();
 const button=(label,action,parent=panel)=>{const e=document.createElement('button');e.textContent=label;e.onclick=action;parent.append(e);return e};
 if(pending){const yes=button('✓',()=>finish(true));yes.setAttribute('aria-label','Apply preview');const no=button('✕',()=>finish(false));no.setAttribute('aria-label','Cancel preview');return;}
 if(mode==='advanced')return;
 const all=items();
 const nav=(label,key,parent)=>button(label,()=>{section=key;last='';tick()},parent);
 const grid=document.createElement('div');grid.className='choices';
 if(section==='home'){
  return;
 }else{
  nav('‹ Back','home');const title=document.createElement('h3');title.textContent=section.replaceAll('_',' ');panel.append(title,grid);
  if(section==='style'){for(const [key,label]of [['paint_frame','Frame colour'],['paint_suspension','Fork colour'],['paint_rear_frame','Rear frame colour'],['paint_rims','Rim colour'],['bars','Handlebar styles'],['seat','Seat styles'],['paint_grips','Grip colour']])if(!key.startsWith('paint_')||b[key.slice(6)])nav(label,key,grid);}
  else {
   let options;if(section==='bikes')options=all.filter(p=>p.completeBike);
   else if(section.startsWith('paint_'))options=globalThis.__WK_VARIANTS__(b[section.slice(6)]);
   else {const slots=section==='wheels'?['rims','tyres']:section==='suspension'?['suspension','shock']:[section];options=all.filter(p=>slots.includes(p.slot));if(section==='wheels')options.push(...globalThis.__WK_VARIANTS__(b.rims),...globalThis.__WK_VARIANTS__(b.tyres));options=options.filter(p=>upgradePlan(b,p.id));}
   for(const p of new Map(options.map(p=>[p.id,p])).values()){
    const e=button(p.name+' · $'+p.price,()=>{let plan;if(p.completeBike){plan={};for(const id of p.kit)plan[part(id).slot]=id;}else plan=upgradePlan(globalThis.__WK_BUILD__,p.id);if(plan)preview(plan,p.id,true)},grid);e.dataset.simplePart=p.id;
    if(b[p.slot]===p.id)e.classList.add('selected');
    if(p.color)e.style.borderColor=p.color;
    const imagePart=p.completeBike?part(p.kit.find(id=>part(id)?.slot==='frame')):p;const src=globalThis.__WK_THUMB__?.(imagePart);if(src){const img=document.createElement('img');img.src=src;img.alt='';e.prepend(img);}
   }
   if(!options.length){const empty=document.createElement('p');empty.textContent='Choose a complete bike first. No compatible upgrades for this build.';grid.append(empty);}
  }
 }
 const note=document.createElement('p');note.textContent='Choose a part to preview. ✓ applies; ✕ cancels. Supporting parts are included automatically.';panel.append(note);
}
setInterval(tick,350);
