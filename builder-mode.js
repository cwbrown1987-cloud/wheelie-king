// Simple assembly plans share the advanced catalogue and real fitment rules.
import {powerPolicy,proposedBuild} from './build-policy.js';
import {part} from './modular-catalogue.js';
import {prototypeFor} from './vehicle-platforms.js';
import {categoryIcon} from './category-icons.js';
let crazy=localStorage.getItem('wk-basic-crazy')==='1';
const policy=(before,next)=>powerPolicy(before,next,{mode,crazy});
globalThis.__WK_POWER_BUILD_OK__=(before,next)=>policy(before,next).allowed;
globalThis.__WK_POWER_POLICY__=(before,id)=>policy(before,proposedBuild(before,id));
globalThis.__WK_CRAZY_BUILDS__={get enabled(){return mode==='simple'&&crazy},set(value){if(mode!=='simple'||pending)return false;crazy=!!value;localStorage.setItem('wk-basic-crazy',crazy?'1':'0');last='';tick();return true}};
let unlimitedZoom=localStorage.getItem('wk-unlimited-zoom')==='1';
const WORKSHOP_ZOOM={min:.12,max:4.2};
function applyZoomLimits(controls,limits){
 if(!controls)return;
 if(unlimitedZoom){controls.minDistance=.001;controls.maxDistance=1e6;}
 else{controls.minDistance=limits.min;controls.maxDistance=limits.max;}
}
function applyAllZoomLimits(){
 applyZoomLimits(globalThis.__WK_VIEW__?.controls,WORKSHOP_ZOOM);
 dispatchEvent(new CustomEvent('wk-unlimited-zoom',{detail:{enabled:unlimitedZoom}}));
}
globalThis.__WK_UNLIMITED_ZOOM__={get enabled(){return unlimitedZoom},set(value){unlimitedZoom=!!value;localStorage.setItem('wk-unlimited-zoom',unlimitedZoom?'1':'0');applyAllZoomLimits();last='';tick();return true}};

let mode=localStorage.getItem('wk-builder-mode')||'simple',panel,modeToggle,simpleRail,last='',section='home',pending=null,menuStack=[],categoryToggle,rotationButton,lastControls,dock,previewActions;
let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{last='';globalThis.__WK_SETBUILD__?.(b=>({...b}))},160)});
function kitPlan(build,p){const b=p.completeBike?{}:{...build};for(const id of p.kit||[])b[part(id).slot]=id;if(!policy(build,b).allowed)return null;for(let pass=0;pass<3;pass++)for(const id of Object.values(b)){if(!id)continue;const f=globalThis.__WK_FIT__(b,id);if(f.status==='no')return null;for(const a of f.adapters||[])b[part(a).slot]=a;}return globalThis.__WK_BUILD_READY__(b).ready?b:null;}
let recovery;try{recovery=JSON.parse(sessionStorage.getItem('wk-pending-build')||'null')}catch{}
const items=()=>globalThis.__WK_CAT__?.().items.filter(p=>!p.hidden)||[];
export function upgradePlan(build,id){
 const p=part(id);if(!p)return null;const b={...build,[p.slot]:id},all=items(),m=p.slot==='motor'?p:part(b.motor);
 if(p.slot==='kit')return kitPlan(build,p);
 if(!policy(build,b).allowed)return null;
 if(prototypeFor(build.frame)){if(globalThis.__WK_FIT__(b,id).status==='no')return null;const r=globalThis.__WK_BUILD_READY__(b);return r.ready||r.reason?.startsWith('Fit ')?b:null;}
 if(p.slot==='bars'){const stem=all.find(x=>x.id===b.stem&&x.clamp===p.clamp&&globalThis.__WK_FIT__(b,x.id).status!=='no')||all.find(x=>x.slot==='stem'&&x.clamp===p.clamp&&globalThis.__WK_FIT__(b,x.id).status!=='no');if(!stem)return null;b.stem=stem.id;}
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
  if(!value)continue;const fit=globalThis.__WK_FIT__(b,value);if(fit.status==='no'){const slot=part(value)?.slot;if(slot&&slot!==p.slot&&build[slot]===value)continue;return null;}
  for(const adapter of fit.adapters||[])b[part(adapter).slot]=adapter;
 }
 return b; // New/changed parts were validated above; existing unrelated faults stay visible for correction.
}
globalThis.__WK_SIMPLE_PLAN__=upgradePlan;
function preview(plan,id,automatic=false){if(pending)return;const nativeCategory=mode==='advanced'&&document.querySelector('[data-catpanel][data-open="true"]')?part(id)?.slot:null;pending={scrollTop:panel?.scrollTop||0,original:{...globalThis.__WK_BUILD__},plan,id,automatic,nativeCategory};sessionStorage.setItem('wk-pending-build',JSON.stringify(pending.original));document.body.dataset.wkPreviewing='true';globalThis.__WK_SETBUILD__(plan);last='';tick();}
function finish(apply){if(!pending)return;const p=pending;pending=null;sessionStorage.removeItem('wk-pending-build');delete document.body.dataset.wkPreviewing;if(apply){if(p.automatic){globalThis.__WK_EQUIP_MANY__(Object.values(p.plan).filter(Boolean));globalThis.__WK_SETBUILD__(p.plan)}else if(!globalThis.__WK_EQUIP__(p.id))globalThis.__WK_SETBUILD__(p.original)}else globalThis.__WK_SETBUILD__(p.original);if(p.nativeCategory&&!document.querySelector('[data-catpanel][data-open="true"]'))document.querySelector('[data-cat="'+p.nativeCategory+'"]')?.click();last='';tick();if(panel)panel.scrollTop=p.scrollTop||0;}
globalThis.__WK_PREVIEW_BUILD__={start:preview,apply:()=>finish(true),cancel:()=>finish(false),get pending(){return pending}};
document.addEventListener('click',e=>{
 const nav=e.target.closest('button');if(pending&&nav&&!nav.closest('#wk-preview-actions')&&nav!==rotationButton&&!nav.matches('[data-wk-expand-stats],[data-wk-collapse-stats]')){e.preventDefault();e.stopImmediatePropagation();return;}if(pending&&e.target.closest('#wk-builder,[data-catpanel]')){e.preventDefault();e.stopImmediatePropagation();return;}if(nav&&nav===modeToggle){e.preventDefault();e.stopImmediatePropagation();globalThis.__WK_MODE__(mode==='simple'?'advanced':'simple');section='home';menuStack=[];tick();return;}if(nav?.matches('[data-cat]'))document.querySelector('[data-rail="left"]')?.setAttribute('data-expanded','false');if(mode==='simple'&&!pending&&nav&&!nav.closest('#wk-builder')&&/\bSHOP$/.test(nav.textContent.trim())){e.preventDefault();e.stopImmediatePropagation();section='home';last='';for(const button of document.querySelectorAll('button'))if(/\bWORKSHOP$/.test(button.textContent.trim())){button.click();break}tick();return;}
 if(pending&&e.target.closest('[aria-label="Test ride"]')){e.preventDefault();e.stopImmediatePropagation();return;}
 const swatch=e.target.closest('[data-wk-swatch]'),card=e.target.closest('[data-wk-part]');if(!swatch&&!card)return;
 if(e.target.closest('[data-wk-info]')||(!swatch&&e.target.closest('button')))return;
 const id=swatch?.dataset.wkSwatch||card.dataset.wkPart,p=part(id);if(!p||p.slot==='sticker'||pending)return;
 const b=globalThis.__WK_BUILD__,cockpit=['bars','motor','battery'].includes(p.slot);if(!policy(b,proposedBuild(b,id)).allowed||(!cockpit&&globalThis.__WK_FIT__(b,id).status==='no'))return;
 let plan=cockpit?upgradePlan(b,id):{...b,[p.slot]:id};if(!plan)return;if(p.slot==='kit'){plan=kitPlan(b,p);if(!plan)return;}
 if(p.slot==='frame')for(const [slot,value]of Object.entries(plan))if(slot!=='frame'&&value&&globalThis.__WK_FIT__(plan,value).status==='no')delete plan[slot];
 e.preventDefault();e.stopImmediatePropagation();preview(plan,id,p.slot==='kit'||cockpit);
},true);
globalThis.__WK_MODE__=value=>{globalThis.__WK_CLOSE_DRAWERS__?.();mode=value==='advanced'?'advanced':'simple';localStorage.setItem('wk-builder-mode',mode);document.body.dataset.wkMode=mode;section='home';menuStack=[];last='';};
globalThis.__WK_MODE__(mode);
const style=document.createElement('style');style.textContent=`
body[data-wk-mode="simple"] [data-cat]{display:none!important}body[data-wk-mode="simple"] [data-catpanel],body[data-wk-mode="simple"] [data-wk-advanced-tools]{visibility:hidden!important;pointer-events:none!important}
[data-rail="left"]{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-rows:54px!important;align-content:start;gap:5px!important;scrollbar-width:thin}[data-rail="left"]>button,#wk-simple-rail>button{min-height:54px!important;border-radius:10px;background:#0b100e;color:#cfe9da;border:2px solid #2c3f35;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:3px;font:10px system-ui;font-weight:800;padding:3px;cursor:pointer}#wk-simple-rail{display:contents}#wk-simple-rail[hidden]{display:none!important}
[data-wk-mode-toggle]{width:132px!important;min-width:94px!important;font:11px system-ui!important;font-weight:800!important;padding:5px!important;line-height:1.4!important}[data-wk-mode-toggle] .active{color:#60ff95}[data-wk-mode-toggle] .inactive{color:#91a699}
#wk-builder{position:absolute;left:0;top:0;bottom:0;z-index:9;width:min(600px,60vw);overflow:auto;background:#0d1612fa;border:2px solid #526c5b;border-radius:14px;padding:10px;color:#edf7ef;font:13px system-ui;box-sizing:border-box}#wk-builder[hidden]{display:none!important}
#wk-builder button{background:#243d52;color:#d9ffe3;border:1px solid #72a683;border-radius:6px;padding:7px;cursor:pointer}
#wk-builder [data-wk-crazy][aria-pressed="true"]{border-color:#67f8ab;background:#245440;color:#c5ffda}#wk-builder .choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}#wk-builder .choices button{min-height:64px;white-space:normal;font-size:13px}#wk-builder .choices img{width:100%;height:74px;object-fit:contain;display:block}#wk-builder .selected{border:2px solid #5aff91;background:#305d40}#wk-builder .modes{display:flex;gap:6px;justify-content:space-between}#wk-builder h3{margin:8px 0;font-size:15px}
#wk-builder label{display:block;margin-top:9px}#wk-builder select{display:block;width:100%;margin-top:4px;background:#182820;color:white;border:1px solid #72917d;border-radius:5px;padding:6px}
#wk-builder p{font:12px system-ui;margin:8px 0 0;color:#b8cbbb}
#wk-preview-actions{position:absolute;bottom:12px;left:55%;transform:translateX(-50%);z-index:20;display:flex;gap:12px;padding:8px;border-radius:12px;background:#11243ad9;border:1px solid #a6d7e666;backdrop-filter:blur(12px)}#wk-preview-actions[hidden]{display:none}#wk-preview-actions button{font:30px system-ui;color:#e8fff0;background:#275143b9;border:1px solid #a7e2b9;border-radius:9px;min-width:66px;min-height:60px;cursor:pointer}

[data-catpanel]{width:min(600px,60vw)!important;max-width:60vw!important}[data-wk-part]{min-width:0}
[data-catpanel] :has(> [data-wk-part]){display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
#wk-all-categories{display:none}[data-stickers]>div:first-child{flex-wrap:wrap!important}[data-wk-rotate]{position:absolute;right:12px;top:56px;z-index:6;border:1px solid #759a82;background:#0e231ae8;color:#dcffe5;padding:7px 10px;border-radius:7px;font:12px system-ui;cursor:pointer}
@media(max-width:800px){[data-rail="left"]{grid-template-columns:1fr!important}[data-rail="left"]:not([data-expanded="true"])>[data-cat],[data-rail="left"]:not([data-expanded="true"]) #wk-simple-rail{display:none!important}[data-rail="left"][data-expanded="true"]{width:min(360px,calc(100vw - 110px))!important;z-index:12!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;background:#0c1713fa!important}#wk-all-categories{display:flex!important;grid-column:1/-1;font-size:10px;gap:4px}[data-catpanel],[data-stickers],#wk-builder{width:min(600px,calc(100% - 174px))!important;max-width:calc(100% - 174px)!important}[data-stickers]>div:first-child button{font-size:11px!important;padding:5px 7px!important;min-height:30px;height:auto!important;flex-shrink:0}[data-stickers]>div:nth-child(2){grid-template-columns:repeat(2,minmax(0,1fr))!important}[data-wk-stat]>div:first-child{font-size:10px!important;gap:2px!important}[data-wk-stat]>div:first-child span{font-size:11px!important}[data-wk-stat]>div:last-child{display:none}[data-wk-stat]{min-height:17px!important}[data-wk-stat] small{font-size:8px!important}}

/* A single compact glass drawer occupies the category column. */
body:has(#wk-builder:not([hidden])) [data-rail="left"],body:has([data-stickers][data-open="true"]) [data-rail="left"],body[data-wk-mode="advanced"]:has([data-catpanel][data-open="true"]) [data-rail="left"]{visibility:hidden!important;pointer-events:none!important}
#wk-builder,[data-catpanel],[data-stickers]{left:0!important;width:min(340px,36%)!important;max-width:calc(100% - 104px)!important;background:linear-gradient(135deg,#1c2d478c,#0a1428b5)!important;backdrop-filter:blur(13px) saturate(1.25);-webkit-backdrop-filter:blur(13px) saturate(1.25);border:1px solid #c7f4df55!important;box-shadow:0 8px 24px #0006,inset 0 1px #ffffff22!important;text-shadow:0 1px 3px #000}
[data-rail="left"]{background:linear-gradient(135deg,#1c2c4299,#0d1729bb)!important;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
#wk-builder .choices{gap:6px}#wk-builder .choices button{font-size:11px;padding:6px;background:#25394c88;min-height:58px;line-height:1.25}#wk-builder .choices button[data-simple-part]{display:flex;flex-direction:column;align-items:center;gap:3px;justify-content:center;min-height:124px}#wk-builder .choices img{height:56px;width:100%;margin:0}#wk-builder .part-name{font-weight:700}#wk-builder .part-stats{color:#bfe0ce;font-size:10px}#wk-builder .part-price{color:#8bffb2;font-size:11px}#wk-builder p{font-size:11px}#wk-builder h3{text-transform:capitalize}
[data-catpanel] [data-wk-part],[data-stickers] [data-wk-part]{background:#1a342a99!important;box-shadow:inset 0 1px #ffffff22!important}[data-catpanel] [data-wk-part] img,[data-catpanel] [data-wk-part] canvas{width:74px!important;height:56px!important;object-fit:contain}[data-catpanel]>div:first-child{gap:5px!important}[data-catpanel]>div:first-child span{font-size:16px!important}[data-catpanel]>div:first-child button{height:34px!important;font-size:13px!important;padding:0 8px!important}
[data-simple-category="stickers"],[data-cat="sticker"]{grid-column:1/-1;grid-row:span 2;min-height:96px!important;position:sticky!important;bottom:0;z-index:1;background:#172c43e8!important}[data-simple-category="stickers"] svg,[data-cat="sticker"] svg{width:56px!important;height:56px!important}
@media(max-width:800px){#wk-builder,[data-catpanel],[data-stickers]{width:min(440px,56%)!important;max-width:calc(100% - 104px)!important}}
`;document.head.append(style);
function partStats(p){const values=[];if(p.w)values.push(p.w+' W');if(p.v)values.push(p.v+' V');if(p.ah)values.push(p.ah+' Ah');if(p.travel!=null)values.push(Math.round(p.travel*1000)+' mm travel');if(p.teeth)values.push(p.teeth+'T');if(p.size)values.push(p.size==='moto'?'Moto':p.size+' inch');if(p.kg)values.push(p.kg.toFixed(1)+' kg');if(p.slot==='kit')values.push(p.kit.length+' matched parts');return values.slice(0,3).join(' · ')||p.finish||'Compatible fit';}
function tick(){
 const settings=document.querySelector('[data-wk-crazy-settings]');
 if(settings){
  const btnCss='width:100%;padding:14px;text-align:left;background:#203749aa;border:1px solid #81bcac66;border-radius:10px;color:#eefaff;font:inherit;margin-top:8px';
  let toggle=settings.querySelector('[data-wk-crazy]');
  if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.dataset.wkCrazy='';toggle.setAttribute('aria-label','Extra-crazy builds');toggle.style.cssText=btnCss+';margin-top:0';toggle.onclick=()=>globalThis.__WK_CRAZY_BUILDS__.set(!crazy);settings.append(toggle);}
  toggle.textContent='Crazy builds: '+(crazy?'On':'Off')+(mode==='simple'?'':' · Basic mode only');toggle.setAttribute('aria-pressed',String(crazy));toggle.disabled=mode!=='simple'||!!pending;
  let zoom=settings.querySelector('[data-wk-unlimited-zoom]');
  if(!zoom){zoom=document.createElement('button');zoom.type='button';zoom.dataset.wkUnlimitedZoom='';zoom.setAttribute('aria-label','Unlimited zoom');zoom.style.cssText=btnCss;zoom.onclick=()=>globalThis.__WK_UNLIMITED_ZOOM__.set(!unlimitedZoom);settings.append(zoom);}
  zoom.textContent='Unlimited zoom: '+(unlimitedZoom?'On':'Off');zoom.setAttribute('aria-pressed',String(unlimitedZoom));
 }
 const riding=!!document.querySelector('[data-ride]'),garage=!!globalThis.__WK_VIEW__?.renderer?.domElement?.isConnected&&!riding;
 if(!panel){panel=document.createElement('section');panel.id='wk-builder';panel.setAttribute('aria-label','Builder mode');document.body.append(panel);}
 if(!pending)panel.hidden=!garage||((mode==='advanced'&&section!=='accessories')||section==='home');else if(!garage)panel.hidden=true;if(!garage){if(pending)finish(false);return;}
 const rail=document.querySelector('[data-rail="left"]');if(!rail)return;if(!previewActions){previewActions=document.createElement('div');previewActions.id='wk-preview-actions';for(const [label,apply]of [['✓',true],['✕',false]]){const button=document.createElement('button');button.textContent=label;button.setAttribute('aria-label',apply?'Apply preview':'Cancel preview');button.onclick=()=>finish(apply);previewActions.append(button)}}if(previewActions.parentElement!==rail.parentElement)rail.parentElement.append(previewActions);previewActions.hidden=!pending;
 if(panel.parentElement!==rail.parentElement)rail.parentElement.append(panel);panel.style.left='0px';
 if(!categoryToggle){categoryToggle=document.createElement('button');categoryToggle.id='wk-all-categories';categoryToggle.setAttribute('aria-label','All categories');categoryToggle.innerHTML='▦<span>ALL PARTS</span>';categoryToggle.onclick=()=>{const r=categoryToggle.parentElement;r.setAttribute('data-expanded',String(r.getAttribute('data-expanded')!=='true'));categoryToggle.setAttribute('aria-expanded',r.dataset.expanded)};}if(categoryToggle.parentElement!==rail)rail.prepend(categoryToggle);
 if(!dock){dock=document.createElement('div');dock.id='wk-sidebar-dock';dock.innerHTML='<button data-wk-sticker-dock aria-label="Stickers"><span>STICKERS</span></button><button data-wk-mode-proxy aria-label="Simple / Advanced"></button>';dock.querySelector('[data-wk-sticker-dock]').onclick=()=>{section='home';menuStack=[];last='';globalThis.__WK_CLOSE_DRAWERS__?.();document.querySelector('[data-cat="sticker"]')?.click();tick()};dock.querySelector('[data-wk-mode-proxy]').onclick=()=>modeToggle?.click()}if(dock.parentElement!==rail.parentElement)rail.parentElement.append(dock);dock.style.width=rail.style.width;for(const button of dock.querySelectorAll('button'))button.disabled=!!pending;
 const view=globalThis.__WK_VIEW__;if(lastControls!==view.controls){lastControls=view.controls;view.controls.autoRotate=localStorage.getItem('wk-rotation-paused')!=='1';applyZoomLimits(view.controls,WORKSHOP_ZOOM);}if(!rotationButton){rotationButton=document.createElement('button');rotationButton.dataset.wkRotate='';rotationButton.onclick=()=>{const c=globalThis.__WK_VIEW__.controls;c.autoRotate=!c.autoRotate;if(c.autoRotate){const v=globalThis.__WK_VIEW__,a=v.orbitAnchor;if(a){v.camera.position.x+=a.x-c.target.x;v.camera.position.z+=a.z-c.target.z;c.target.x=a.x;c.target.z=a.z;c.update()}}localStorage.setItem('wk-rotation-paused',c.autoRotate?'0':'1')}}const scene=document.querySelector('[data-scene]');if(scene&&rotationButton.parentElement!==scene)scene.append(rotationButton);rotationButton.textContent=view.controls.autoRotate?'Ⅱ ROTATION':'▶ ROTATION';rotationButton.setAttribute('aria-label',view.controls.autoRotate?'Pause workshop rotation':'Resume workshop rotation');
 modeToggle=document.querySelector('#root button');if(modeToggle){modeToggle.dataset.wkModeToggle='';modeToggle.setAttribute('aria-label','Simple / Advanced');const html=`<span class="${mode==='simple'?'active':'inactive'}">SIMPLE</span> / <span class="${mode==='advanced'?'active':'inactive'}">ADVANCED</span>`;if(modeToggle.innerHTML!==html)modeToggle.innerHTML=html;dock.querySelector('[data-wk-mode-proxy]').innerHTML=html;}
 if(!simpleRail){simpleRail=document.createElement('div');simpleRail.id='wk-simple-rail';}if(simpleRail.parentElement!==rail)rail.append(simpleRail);simpleRail.hidden=mode!=='simple';
 if(!globalThis.__WK_EQUIP__){document.querySelector('[data-cat="bars"]')?.click();return;}
 if(recovery){const original=recovery;recovery=null;sessionStorage.removeItem('wk-pending-build');globalThis.__WK_SETBUILD__(original);return;}
 if(pending)return;
 const b=globalThis.__WK_BUILD__,key=mode+section+crazy+JSON.stringify(b)+!!pending;if(key===last)return;last=key;
 simpleRail.replaceChildren();for(const [key,label,icon]of [['bikes','BIKES','frame'],['motorbikes','MOTORBIKES','frame'],['escooters','E-SCOOTERS','frame'],['kit','KITS','kit'],['motor','MOTORS · W','motor'],['battery','BATTERY','battery'],['wheels','WHEELS','tyres'],['suspension','SUSPENSION','suspension'],['style','STYLES / COLOURS','bars'],['stickers','STICKERS','sticker']]){const e=document.createElement('button');e.dataset.simpleCategory=key;e.append(categoryIcon(icon),document.createTextNode(label));e.onclick=()=>{globalThis.__WK_CLOSE_DRAWERS__?.();rail.dataset.expanded='false';menuStack=[];if(key==='stickers'){section='home';document.querySelector('[data-cat="sticker"]')?.click()}else section=section===key?'home':key;last='';tick()};simpleRail.append(e);}
 panel.replaceChildren();
 const button=(label,action,parent=panel)=>{const e=document.createElement('button');e.textContent=label;e.onclick=action;parent.append(e);return e};

 if(mode==='advanced'&&section!=='accessories')return;
 const all=items();
 const nav=(label,key,parent)=>button(label,()=>{menuStack.push(section);section=key;last='';tick()},parent);
 const grid=document.createElement('div');grid.className='choices';
 if(section==='home'){
  return;
 }else{
  button('‹ Back',()=>{section=menuStack.pop()||'home';last='';tick()});const title=document.createElement('h3');title.textContent=section==='accessories'?'Rider accessories · Coming soon':section.replaceAll('_',' ');panel.append(title);panel.append(grid);
  if(section==='accessories'){for(const [key,label,tier]of [['helmet','Helmets','Rare'],['tops','Tops / Jackets','Epic'],['pants','Pants','Common'],['gloves','Gloves / Shoes','Rare'],['gear','Neon Starter Bundle','Epic'],['gear','Wheelie Champion Bundle','Legendary']]){const card=button(label,()=>{},grid);card.disabled=true;card.dataset.wkMock='accessories';const image=categoryIcon(key);image.setAttribute('width','64');image.setAttribute('height','64');const badge=document.createElement('small');badge.textContent=tier+' · COMING SOON';badge.style.cssText='display:block;color:#c5b6ef;margin-top:6px;font-size:10px';card.prepend(image);card.append(badge)}}else if(section==='style'){for(const [key,label]of [['paint_frame','Frame colour'],['paint_suspension','Fork colour'],['paint_rear_frame','Rear frame colour'],['paint_rims','Rim colour'],['bars','Handlebar styles'],['seat','Seat styles'],['paint_grips','Grip colour']])if(!key.startsWith('paint_')||b[key.slice(6)])nav(label,key,grid);}
  else {
   let options;if(['bikes','motorbikes','escooters'].includes(section))options=all.filter(p=>p.completeBike&&(section==='bikes'?!['motorbike','escooter'].includes(p.vehicleClass):p.vehicleClass===(section==='motorbikes'?'motorbike':'escooter')));
   else if(section==='platform_parts')options=all.filter(p=>p.family===globalThis.__WK_BASE_ID__(b.frame)&&p.slot!=='frame');
   else if(section.startsWith('paint_'))options=globalThis.__WK_VARIANTS__(b[section.slice(6)]);
   else {const slots=section==='wheels'?['rims','tyres']:section==='suspension'?['suspension','shock']:[section];options=all.filter(p=>slots.includes(p.slot)&&!p.completeBike);if(section==='wheels')options.push(...globalThis.__WK_VARIANTS__(b.rims),...globalThis.__WK_VARIANTS__(b.tyres));options=options.filter(p=>upgradePlan(b,p.id));}
   if(['motorbikes','escooters'].includes(section)&&prototypeFor(b.frame))nav('Matching vehicle parts','platform_parts',panel);
   for(const p of new Map(options.map(p=>[p.id,p])).values()){
    const e=button('',()=>{let plan;if(p.completeBike){plan={};for(const id of p.kit)plan[part(id).slot]=id;}else plan=upgradePlan(globalThis.__WK_BUILD__,p.id);if(plan)preview(plan,p.id,true)},grid);e.dataset.simplePart=p.id;const name=document.createElement('span');name.className='part-name';name.textContent=p.name;const stats=document.createElement('small');stats.className='part-stats';stats.textContent=partStats(p);const price=document.createElement('small');price.className='part-price';price.textContent='$'+p.price;e.append(name,stats,price);
    if(b[p.slot]===p.id)e.classList.add('selected');
    if(p.color)e.style.borderColor=p.color;
    const src=globalThis.__WK_THUMB__?.(p,180);if(src){const img=document.createElement('img');img.src=src;img.alt='';e.prepend(img);}
   }
   if(!options.length){const empty=document.createElement('p');empty.textContent='Choose a complete bike first. No compatible upgrades for this build.';grid.append(empty);}
  }
 }
 const note=document.createElement('p');note.textContent=section==='accessories'?'Planned rider gear and themed bundles. These previews are not available to buy yet.':'Choose a part to preview. ✓ applies; ✕ cancels. Supporting parts are included automatically.';panel.append(note);
}
globalThis.__WK_OPEN_ACCESSORIES__=()=>{if(pending)return;globalThis.__WK_CLOSE_DRAWERS__?.();section='accessories';menuStack=[];last='';document.querySelector('[data-wk-nav="garage"]')?.click();tick()};
setInterval(tick,350);

// One compatible candidate list for both modes, including matching supports and the Basic-only power policy.
setInterval(()=>{const b=globalThis.__WK_BUILD__;if(!b)return;for(const card of document.querySelectorAll('[data-catpanel] [data-wk-part]')){const p=part(card.dataset.wkPart);if(!p||p.slot==='frame'||p.completeBike)continue;const hidden=!upgradePlan(b,p.id);if(card.hidden!==hidden)card.hidden=hidden;}},300);
