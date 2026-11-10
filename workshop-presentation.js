import {part} from './modular-catalogue.js';
import {prototypeFor} from './vehicle-platforms.js';
import * as T from './vendor/three.module.js';
import * as SharedWorld from './shared-world.js';
import './workshop-inspect.js';
let lastRoom,summary,lastView,lastRoot,lastKey='',lastPlatform;
function fitVehicle(v,root){
 root.updateWorldMatrix(true,true);const bounds=new T.Box3().setFromObject(root),center=bounds.getCenter(new T.Vector3());if(bounds.isEmpty())return;
 center.x=v.orbitAnchor?.x??center.x;center.z=v.orbitAnchor?.z??center.z;
 const direction=new T.Vector3(.16,.12,1).normalize(),right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),direction).normalize(),up=new T.Vector3().crossVectors(direction,right),tanV=Math.tan(v.camera.fov*Math.PI/360)*Math.max(.6,1-72/(v.renderer.domElement.clientHeight||1)),tanH=tanV*v.camera.aspect*Math.max(.55,1-(document.querySelector('[data-rail=left]')?.clientWidth||0)/(v.renderer.domElement.clientWidth||1));
 let distance=.8;for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const q=new T.Vector3(x,y,z).sub(center),depth=q.dot(direction);distance=Math.max(distance,Math.abs(q.dot(right))/(tanH*.89)+depth,Math.abs(q.dot(up))/(tanV*.88)+depth)}
 const damping=v.controls.enableDamping,rotating=v.controls.autoRotate;v.controls.autoRotate=false;v.controls.enableDamping=false;v.controls.update();v.camera.zoom=1;v.camera.position.copy(center).addScaledVector(direction,distance);v.controls.target.copy(center);v.camera.updateProjectionMatrix();v.controls.update();v.controls.enableDamping=damping;v.controls.autoRotate=rotating;
}

const style=document.createElement('style');style.textContent=`
[data-wk-content]:has([data-scene]:not([data-wk-room-ready])){visibility:hidden!important}
html,body{background:#202430}body[data-wk-workshop]:not([data-player-view]){background:#202430!important}[data-scene]{left:-12px!important;right:-12px!important;top:-72px!important;bottom:-12px!important;border-radius:0!important;border:0!important}#root>div,[data-stage]{background:transparent!important}[data-scene]{background:transparent!important;border-color:#9bc4dc33!important}[data-scene]>div:first-child,[data-scene]>div:nth-child(2){display:none!important}[data-wk-header]{background:#0c172675;border:1px solid #9abbd438;border-radius:10px;backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}[data-wk-mode-toggle],[data-wk-header]>div:last-child{background:#15284288!important;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid #8ac8ee55!important}[data-fitpanel]{background:#13243c9e!important;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
[data-wk-old-light]{display:none!important}
[data-wk-nav]{font-size:19px!important;letter-spacing:.3px!important;border-radius:7px 7px 0 0;transition:background .15s,color .15s}[data-wk-nav]:hover{background:#8bc4ff15!important}[data-wk-workshop-title]{font-size:clamp(20px,2.3vw,32px)!important;letter-spacing:.3px!important}
body[data-wk-workshop] [data-rail="right"]{width:220px!important;padding:0!important;background:none!important;border:0!important;box-shadow:none!important;display:block!important;pointer-events:none}
body[data-wk-workshop] [data-rail="right"]>[data-wk-stat],body[data-wk-workshop] [data-rail="right"]>button:first-child{display:none!important}
body[data-wk-workshop] [data-rail="right"]>[aria-label="Test ride"]{position:absolute;bottom:0;right:0;width:76px;pointer-events:auto;height:66px!important;font-size:12px!important}
#wk-summary{position:absolute;top:0;left:0;right:0;pointer-events:auto;box-sizing:border-box;padding:9px;border:1px solid #a3d9ef70;border-radius:14px;background:linear-gradient(135deg,#182d439e,#080f1ca6);backdrop-filter:blur(12px) saturate(1.2);-webkit-backdrop-filter:blur(12px) saturate(1.2);box-shadow:0 8px 24px #0007,inset 0 1px #d6f6ff22;color:#eff8ff;font:11px system-ui;text-shadow:0 1px 3px #000}
#wk-summary header{display:flex;align-items:center;justify-content:space-between;font-weight:800;margin-bottom:5px}#wk-summary header button{font:10px system-ui;color:#b1e7ff;border:1px solid #7291ae;background:#172f48;border-radius:5px;padding:4px;cursor:pointer}#wk-summary .bike{display:flex;align-items:center;gap:7px;border-bottom:1px solid #a4c4dc33;padding-bottom:5px}#wk-summary img{width:90px;height:60px;object-fit:contain}#wk-summary .name{font-weight:700;font-size:11px}#wk-summary dl{margin:6px 0 0}#wk-summary dl>div{display:flex;justify-content:space-between;gap:8px;margin:4px 0}#wk-summary dt{color:#bed1e6}#wk-summary dd{font-weight:750;margin:0;color:#effbff}
body:has([data-statspanel][data-open="true"]) #wk-summary{visibility:hidden}
[data-statspanel]{background:linear-gradient(135deg,#192e429e,#0b1726ae)!important;backdrop-filter:blur(15px) saturate(1.2);-webkit-backdrop-filter:blur(15px) saturate(1.2);border:1px solid #a4dbed66!important;box-shadow:-8px 0 28px #0007!important}
[data-statspanel]>div:nth-child(2)>div{background:#102033a6!important;border-color:#7392ae66!important}

body[data-wk-workshop] [data-wk-bench]{right:98px!important;background:#122037b9!important;backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}
[data-scene]>button[data-wk-reset]{right:98px!important;background:#122037b9!important}
[data-scene] [data-wk-rotate]{top:auto;bottom:140px;background:#122037b9;right:98px}[data-wk-compatibility]{left:14px!important;right:240px!important;top:46px!important;max-width:none!important;text-align:left!important;font-size:11px!important}
@media(max-width:800px){body[data-wk-workshop] [data-rail="right"]{width:198px!important}#wk-summary{font-size:10px;padding:7px}#wk-summary img{height:46px;width:72px}#wk-summary .name{font-size:10px}}
[data-wk-reset],body[data-wk-workshop] [data-scene]>button[data-wk-reset]{display:none!important}
body[data-wk-workshop]:not(.wk-inspect-on) [data-wk-rotate],body[data-wk-workshop]:not(.wk-inspect-on) [data-wk-bench]{display:none!important}
body.wk-inspect-on #wk-room-dock{display:none!important}
#wk-inspect-dock{position:absolute;right:12px;bottom:12px;z-index:8;width:min(220px,46vw);padding:8px;border-radius:16px;border:1px solid #6fd3ff55;background:linear-gradient(180deg,#101a2ccc,#060b14e6);box-shadow:0 0 0 1px #000,0 10px 30px #000a,0 0 24px #2fa8ff33;color:#e8f6ff;font:12px system-ui}
#wk-inspect-dock[hidden]{display:none}
#wk-inspect-dock header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
#wk-inspect-dock header strong{font:800 11px system-ui;letter-spacing:.12em;color:#9fe0ff}
#wk-inspect-dock header button{width:36px;height:36px;border-radius:50%;border:1px solid #8eb8d888;background:#102037cc;color:#e8f6ff;font-size:16px;cursor:pointer}
#wk-inspect-dock .wk-inspect-tools{display:flex;flex-direction:column;gap:6px;align-items:stretch}
body.wk-inspect-on [data-wk-rotate],body.wk-inspect-on [data-wk-bench]{position:static!important;right:auto!important;left:auto!important;top:auto!important;bottom:auto!important;width:100%!important;translate:none!important}
@media (max-height:500px),(max-width:600px){#wk-inspect-dock{bottom:8px;right:8px;width:min(200px,48vw);padding:6px}}

`;document.head.append(style);
function update(){
 const v=globalThis.__WK_VIEW__,garage=v?.renderer.domElement.isConnected&&!document.querySelector('[data-ride]');if(!garage){delete document.body.dataset.wkWorkshop;return;}document.body.dataset.wkWorkshop='';SharedWorld.tick();
 if(v.stage&&lastView!==v){lastRoom?.dispose?.();lastRoom=SharedWorld.attach(v);lastView=v;}
 let root;v.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});if(root&&root!==lastRoot){lastRoot=root;const a=root.userData.wkAnchors?.bb||[0,0],anchor=root.localToWorld(root.position.clone().set(a[0]-.02,0,0));v.orbitAnchor=anchor;if(v.controls.autoRotate){v.camera.position.x+=anchor.x-v.controls.target.x;v.camera.position.z+=anchor.z-v.controls.target.z;v.controls.target.x=anchor.x;v.controls.target.z=anchor.z;v.controls.update()}}
 if(root&&!v.wkOpeningFramed&&v.renderer.domElement.clientWidth&&v.camera.aspect>0){fitVehicle(v,root);v.wkOpeningFramed=true;}
 const cw=v.renderer.domElement.clientWidth,ch=v.renderer.domElement.clientHeight;if(cw&&ch){const railWidth=document.querySelector('[data-rail=left]')?.clientWidth||0;v.camera.setViewOffset(cw,ch,-railWidth/2,-36,cw,ch);for(const hint of document.querySelectorAll('[data-scene]>div')){if(hint.textContent.startsWith('Tap a category')||hint.textContent.startsWith('Drag to rotate'))hint.style.left=(railWidth+24)+'px';if(hint.textContent.startsWith('Tap a category'))hint.style.top='82px';}const compatibility=document.querySelector('[data-wk-compatibility]');if(compatibility){compatibility.style.setProperty('left',(railWidth+24)+'px','important');compatibility.style.setProperty('top','118px','important');}}
 const surface=v.renderer.domElement.closest('[data-scene]');if(root&&surface&&!surface.hasAttribute('data-wk-room-ready')&&!v.wkRoomRevealPending){v.wkRoomRevealPending=true;requestAnimationFrame(()=>{if(v.renderer.domElement.isConnected&&surface.contains(v.renderer.domElement)){v.renderer.render(v.scene,v.camera);surface.dataset.wkRoomReady='';}v.wkRoomRevealPending=false;});}
 const rail=document.querySelector('[data-rail="right"]');if(!rail)return;const expand=rail.querySelector(':scope > button:first-child');if(expand)expand.dataset.wkExpandStats='';
 document.querySelector('[data-statspanel] button')?.setAttribute('data-wk-collapse-stats','');
 for(const button of document.querySelectorAll('[data-scene]>button'))if(button.textContent.includes('RESET VIEW'))button.dataset.wkReset='';
 const b=globalThis.__WK_BUILD__;if(!b)return;if(lastPlatform!==globalThis.__WK_BASE_ID__(b.frame)){lastPlatform=globalThis.__WK_BASE_ID__(b.frame);if(root)fitVehicle(v,root);}
 if(!summary){summary=document.createElement('section');summary.id='wk-summary';summary.dataset.wkSummary='';summary.setAttribute('aria-label','Build summary');summary.innerHTML='<header><span>BUILD STATS</span><button data-wk-expand-stats aria-label="Expand build stats">↗</button></header><div class="bike"><img alt="Current complete bike"><span class="name"></span></div><dl></dl>';summary.querySelector('button').onclick=()=>document.querySelector('[data-rail="right"]>button:first-child')?.click();}
 if(summary.parentElement!==rail)rail.append(summary);
 const metrics=new Map([...rail.querySelectorAll('[data-wk-stat]')].map(e=>[e.dataset.wkStat,e.querySelector('span')?.textContent||'0'])),battery=part(b.battery),key=JSON.stringify(b)+[...metrics.values()].join(':');if(key===lastKey)return;lastKey=key;
 summary.querySelector('.name').textContent=prototypeFor(b.frame)?.name||part(b.frame)?.name||'Your bike';const image=globalThis.__WK_THUMB__?.({id:'summary:'+JSON.stringify(b),slot:'kit',completeBike:true,kit:Object.values(b).filter(id=>part(id))},180);if(image)summary.querySelector('img').src=image;
 const rows=[['Power',metrics.get('W')+' W'],[prototypeFor(b.frame)?.powertrain==='petrol'?'Fuel':'Battery',prototypeFor(b.frame)?.powertrain==='petrol'?`${part(b.fuel_tank)?.litres||0} L · Petrol`:battery?`${battery.v} V · ${battery.ah} Ah`:'Not fitted'],['Top speed',metrics.get('km/h')+' km/h'],['Range',metrics.get('km')+' km'],['Torque',metrics.get('Nm')+' Nm']];const dl=summary.querySelector('dl');dl.replaceChildren();for(const [label,value]of rows){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);dl.append(row)}
}
setInterval(update,350);update();
