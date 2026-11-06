// Responsive Workshop chrome and cached pictures rendered from the actual models.
import {part} from './modular-catalogue.js';
const style=document.createElement('style');style.textContent=`
#root{--wk-safe-left:env(safe-area-inset-left,0px);--wk-safe-right:env(safe-area-inset-right,0px);padding-left:min(var(--wk-safe-left),12px)!important;padding-right:min(var(--wk-safe-right),12px)!important}
[data-simple-category="style"]{grid-column:1/-1}
body[data-wk-workshop] [data-rail="right"]{width:260px!important}
#wk-summary{padding:12px;font-size:13px}#wk-summary header{gap:12px;margin-bottom:8px}#wk-summary header button{flex-shrink:0;min-height:34px;padding:5px 8px}
#wk-summary .bike{gap:10px;padding-bottom:9px}#wk-summary img{flex-shrink:0;width:80px;height:58px}#wk-summary .name{flex:1;min-width:0;font-size:13px;line-height:1.35;overflow-wrap:normal}
#wk-summary dl>div{gap:14px;margin:6px 0}#wk-summary dt{min-width:0}#wk-summary dd{flex-shrink:0;text-align:right}
@media(pointer:coarse) and (orientation:landscape){body[data-wk-workshop] [data-rail="right"]{width:250px!important}}

[data-wk-workshop-title],[data-wk-mode-toggle],[data-simple-category="stickers"],[data-cat="sticker"]{display:none!important}
body[data-wk-workshop] [data-rail="right"]>[aria-label="Test ride"]{display:none!important}
[data-wk-header]{top:4px!important;left:auto!important;right:12px!important;width:190px!important;height:54px!important;z-index:16;background:transparent!important;border:0!important;backdrop-filter:none!important;pointer-events:none}
[data-wk-header]>div:last-child{pointer-events:auto;width:100%!important;min-width:0!important;padding:6px!important;box-sizing:border-box}
[data-wk-nav-bar]{right:206px!important}[data-wk-content]{top:72px!important;bottom:12px!important}
[data-rail="left"]{bottom:116px!important}
#wk-sidebar-dock{position:absolute;left:0;bottom:0;height:110px;z-index:8;display:grid;grid-template-rows:48px 52px;gap:5px;padding:3px;box-sizing:border-box;background:#12243db5;border:1px solid #9bc4dc55;border-radius:12px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
#wk-sidebar-dock button{display:flex;align-items:center;justify-content:center;gap:5px;background:#20374b99;border:1px solid #88b8cc66;border-radius:8px;color:#eefaff;font:800 12px system-ui;cursor:pointer;padding:3px}#wk-sidebar-dock .active{color:#60ff95}#wk-sidebar-dock .inactive{color:#91a699}
.wk-category-picture{width:58px;height:36px;object-fit:contain;pointer-events:none}[data-cat]:has(.wk-category-picture)>svg,#wk-simple-rail>button:has(.wk-category-picture)>svg{display:none!important}
#wk-sidebar-dock .wk-category-picture{width:44px;height:36px}
 #wk-builder,[data-catpanel],[data-stickers]{bottom:116px!important}
body[data-wk-workshop] [data-wk-bench],[data-scene]>button[data-wk-reset],[data-scene] [data-wk-rotate]{right:12px!important}
@media(pointer:coarse){[data-rail="left"]{grid-auto-rows:64px!important;gap:2px!important;padding:4px!important}[data-rail="left"]>button,#wk-simple-rail>button{min-height:64px!important;font-size:12px!important;line-height:13px!important}.wk-category-picture{width:70px;height:38px}#wk-sidebar-dock button{font-size:13px}.wk-destination,[data-wk-nav-bar]>[data-wk-nav=garage]{font-size:15px!important}#wk-summary{font-size:13px}#wk-summary .name{font-size:12px}#wk-summary header button{min-height:34px;font-size:11px}#wk-builder .choices button{font-size:14px;min-height:100px}#wk-builder .part-stats,#wk-builder .part-price{font-size:12px}}
@media(pointer:coarse){[data-simple-category="style"] .wk-category-picture,[data-simple-category="accessories"] .wk-category-picture{height:30px}}
@media(max-width:800px){body:has([data-rail="left"][data-expanded="true"]) #wk-sidebar-dock{width:min(360px,calc(100vw - 110px))!important}}
@media(pointer:coarse) and (orientation:landscape) and (max-width:800px){
 [data-rail="left"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}
 #wk-all-categories{display:none!important}
 body[data-wk-mode="simple"] [data-rail="left"] #wk-simple-rail{display:contents!important}
 body[data-wk-mode="advanced"] [data-rail="left"]:not([data-expanded="true"])>[data-cat]:not([data-cat="sticker"]){display:flex!important}
}
@media(pointer:coarse) and (orientation:portrait){[data-wk-header]{width:100px!important}[data-wk-header]>div:last-child{font-size:18px!important;gap:4px!important}[data-wk-header]>div:last-child button{width:28px!important;height:34px!important;flex-shrink:0;font-size:22px!important}[data-wk-nav-bar]{right:114px!important}.wk-destination,[data-wk-nav-bar]>[data-wk-nav=garage]{flex-direction:column!important;gap:0!important;font-size:11px!important}.wk-destination .icon{font-size:19px}.wk-destination small{display:none}#wk-sidebar-dock button{font-size:9px;flex-wrap:wrap;gap:0}#wk-sidebar-dock .wk-category-picture{width:30px;height:24px}body[data-wk-workshop] [data-rail="right"]{width:165px!important}#wk-summary{font-size:11px}#wk-summary img{width:56px;height:42px}#wk-summary .name{font-size:10px}}
body[data-wk-workshop] [data-rail="right"]{width:140px!important}#wk-summary{padding:7px!important;font-size:10px!important;border-radius:10px}#wk-summary .bike{display:none!important}#wk-summary header{margin-bottom:4px!important;gap:5px!important}#wk-summary header button{min-height:28px!important;padding:3px 6px!important;font-size:10px!important}#wk-summary dl>div:nth-child(2){display:none}#wk-summary dl{display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;margin:0!important}#wk-summary dl>div{display:flex;flex-direction:column;gap:1px!important;margin:2px 0!important}#wk-summary dt{font-size:9px}#wk-summary dd{text-align:left!important;font-size:11px}body:has([data-stickers][data-open="true"]) #wk-summary{display:none!important}
`;document.head.append(style);
function picture(button,p){if(!p||!button||button.dataset.wkPicture===p.id)return;const url=globalThis.__WK_THUMB__?.(p,180);if(!url)return;let img=button.querySelector('.wk-category-picture');if(!img){img=document.createElement('img');img.className='wk-category-picture';img.alt='';button.prepend(img)}img.src=url;button.dataset.wkPicture=p.id;}
function update(){
 if(!globalThis.__WK_VIEW__?.renderer.domElement.isConnected||document.querySelector('[data-ride]'))return;
 const all=globalThis.__WK_CAT__?.().items.filter(p=>!p.hidden)||[],b=globalThis.__WK_BUILD__||{};
 const select=slot=>part(b[slot])||all.find(p=>p.slot===slot);
 const bike=all.find(p=>p.completeBike&&p.kit?.includes(b.frame))||all.find(p=>p.completeBike);
 for(const button of document.querySelectorAll('[data-simple-category],[data-cat],[data-wk-sticker-dock]')){
  const key=button.dataset.simpleCategory||button.dataset.cat;
  const p=button.hasAttribute('data-wk-sticker-dock')?{id:'ui_sticker',slot:'sticker'}:key==='bikes'||key==='bike'?(all.find(p=>p.completeBike&&p.vehicleClass==='bicycle')||bike):key==='motorbikes'?all.find(p=>p.completeBike&&p.vehicleClass==='motorbike'):key==='escooters'?all.find(p=>p.completeBike&&p.vehicleClass==='escooter'):key==='kit'?all.find(p=>p.slot==='kit'&&!p.completeBike):key==='accessories'?{id:'ui_helmet',slot:'helmet'}:select(({wheels:'tyres',style:'bars'})[key]||key);
  picture(button,p);
 }
}
setInterval(update,400);
