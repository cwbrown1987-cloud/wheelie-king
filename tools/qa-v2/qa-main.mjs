// Wheelie King v2.0 independent acceptance run. Usage:
//   WK_TEST_URL=https://wheelie-king-beta.pages.dev/ WK_GPU=1 node qa-main.mjs
// Optional: WK_QA_RIDES="bike_bmx,bike_emoto"  WK_QA_ONLY="rides,phone,legacy,carry,cache,rider,ramps"
import {launch,openPage,startRide,tel,reset,hold,injectExtraCatalog,round,rec,BASE} from './qa-lib.mjs';
import {rideSuite} from './qa-ride-suite.mjs';
import {mkdirSync,writeFileSync,readdirSync,renameSync} from 'node:fs';
import {join} from 'node:path';
const OUT=process.env.WK_QA_OUT||'qa-out';mkdirSync(OUT,{recursive:true});
const ONLY=(process.env.WK_QA_ONLY||'rides,parts,tricks,phone,rider,ramps,carry,cache,legacy').split(',');
const W=ms=>new Promise(r=>setTimeout(r,ms));
const checks=[],metrics={},logs={};
const check=(id,pass,ev)=>{checks.push({id,pass:!!pass,ev:round(ev??null)});console.log((pass?'PASS ':'FAIL ')+id,JSON.stringify(round(ev??null)).slice(0,400));};
const save=()=>writeFileSync(join(OUT,'qa-report.json'),JSON.stringify({base:BASE,when:new Date().toString(),checks,metrics,logs},null,1));
const browser=await launch();
const guard=async(name,fn)=>{try{await fn()}catch(e){check(name+':harness-ran',false,{error:String(e.stack||e).slice(0,600)})}save();};
function errCheck(name,log){const errs=log.errors.filter(e=>!/favicon/.test(e));logs[name]=log;
  check(name+':no-console-errors',errs.length===0,errs.slice(0,8));const nf=log.failed.filter(u=>!/^blob:.*ERR_ABORTED/.test(u));check(name+':no-failed-requests',nf.length===0,{failed:nf.slice(0,8),ignoredBlobAborts:log.failed.length-nf.length});
  check(name+':no-asset-as-html',log.html.length===0,log.html.slice(0,8));}
// Discover the two rides.
let RIDES=[];
await guard('discover',async()=>{const {ctx,p,log}=await openPage(browser,{});
  const info=await p.evaluate(()=>({kits:(globalThis.__WK_CATALOG_ITEMS__||[]).filter(x=>x.completeBike).map(x=>({id:x.id,name:x.name,cls:x.vehicleClass,kit:x.kit})),
    frames:(globalThis.__WK_CATALOG_ITEMS__||[]).filter(x=>x.slot==='frame'&&!x.hidden).map(x=>x.id)}));
  metrics.catalogue={kits:info.kits.map(k=>k.id+' ('+k.name+')'),frames:info.frames};
  const env=(process.env.WK_QA_RIDES||'').split(',').filter(Boolean);
  if(env.length)RIDES=env.map(id=>({id,tag:id.replace(/^bike_/,'')}));
  else{const bmx=info.kits.find(k=>/bmx/i.test(k.id+k.name)),em=info.kits.find(k=>/modd|heav|e-?moto/i.test(k.id+k.name)&&k.cls==='emoto')||info.kits.find(k=>k.cls==='emoto');
    RIDES=[bmx,em].filter(Boolean).map(k=>({id:k.id,tag:k.id.replace(/^bike_/,'')}));}
  check('scope:two-rides-found',RIDES.length===2,{rides:RIDES,kits:metrics.catalogue.kits.slice(0,30)});
  // version label
  const v=await p.evaluate(()=>[...document.querySelectorAll('[data-wk-version]')].map(e=>e.textContent));
  metrics.versionLabels=v;await ctx.close();});
// Rides: feel, tricks, rewind, drop-in. One recorded context per ride.
const shotsDir=join(OUT,'shots');mkdirSync(shotsDir,{recursive:true});
if(ONLY.includes('rides'))for(const ride of RIDES)await guard('ride-'+ride.tag,async()=>{
  const vdir=join(OUT,'video-'+ride.tag);const {ctx,p,log}=await openPage(browser,{video:vdir});
  await startRide(p,ride.id);
  const t=await tel(p);metrics['profile-'+ride.tag]=t.profile;metrics['engine-'+ride.tag]=t.engine;
  check(ride.tag+':jolt',t.physics==='jolt'&&t.ready&&t.level,{physics:t.physics,level:t.level});
  check(ride.tag+':version-2.0',/^v?2\.0\b/.test(String(t.version)),{version:t.version});
  const {metrics:M,checks:C}=await rideSuite(p,{tag:ride.tag,shots:shotsDir,shot:true});
  metrics['ride-'+ride.tag]=M;for(const c of C)checks.push(c);
  errCheck('ride-'+ride.tag,log);
  await ctx.close();for(const f of readdirSync(vdir))if(f.endsWith('.webm'))renameSync(join(vdir,f),join(OUT,`ride-${ride.tag}.webm`));});
// BMX vs e-moto character
if(RIDES.length===2){const [a,b]=RIDES.map(r=>metrics['ride-'+r.tag]);const [pa,pb]=RIDES.map(r=>metrics['profile-'+r.tag]);
  if(a&&b){const ev={mass:[pa?.mass,pb?.mass],leanT90:[a.lean?.t90,b.lean?.t90],yawRate:[a.lean?.yawRate,b.lean?.yawRate],t0_20:[a.launch?.t0_20,b.launch?.t0_20],top5s:[a.launch?.v5Kmh,b.launch?.v5Kmh]};
    check('character:bmx-lighter-twitchier',pa&&pb&&pa.mass<pb.mass*.7&&a.lean.t90<=b.lean.t90&&a.lean.yawRate>=b.lean.yawRate*.9,ev);}}
// Part swap in the live game: performance part changes physics, cosmetic part does not.
if(ONLY.includes('parts')&&RIDES[1])await guard('parts',async()=>{const {ctx,p,log}=await openPage(browser,{});
  await p.evaluate(id=>__WK_EQUIP__(id),RIDES[1].id);await W(300);
  const cand=await p.evaluate(()=>{const b=(typeof globalThis.__WK_BUILD__==='function'?globalThis.__WK_BUILD__():globalThis.__WK_BUILD__)||{};const all=globalThis.__WK_CATALOG_ITEMS__||[];
    const cur=b.tyres,curP=all.find(x=>x.id===cur);const tyre=all.find(x=>x.slot==='tyres'&&!x.hidden&&x.id!==cur&&Number.isFinite(x.grip)&&x.grip!==curP?.grip&&x.variantOf==null);
    const cos=all.find(x=>x.id===cur+'__black'||x.variantOf===cur);return {build:b,cur,tyre:tyre?.id,tyreGrip:tyre?.grip,curGrip:curP?.grip,cos:cos?.id};});
  const prof=async()=>{await startRide(p,null);const t=await tel(p);const s=await p.evaluate(()=>__WK_RIDE_STATE__().rideProfile);await p.keyboard.press('Escape');await W(300);
    await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/garage|workshop|exit|quit/i.test(b.textContent)&&b.offsetParent)?.click());await W(1500);return {mass:s?.mass,friction:s?.friction,comBack:s?.comBack,comH:s?.comH,engine:s?.engine};};
  metrics.partSwap={cand};check('parts:harness-found-swap-candidates',!!(cand.tyre&&cand.cos),cand);save();
  // direct profile derivation (same function the ride uses), avoids menu navigation flakiness
  const d=await p.evaluate(async c=>{const m=await import('./ride-profile.js');const all=globalThis.__WK_CATALOG_ITEMS__;const find=id=>all.find(x=>x.id===id);
    const b0=(typeof globalThis.__WK_BUILD__==='function'?globalThis.__WK_BUILD__():globalThis.__WK_BUILD__)||{};const base={wb:1.3,R:.33};
    const p0=m.deriveRideProfile({build:b0,find,base}),p1=m.deriveRideProfile({build:{...b0,tyres:c.tyre},find,base}),p2=c.cos?m.deriveRideProfile({build:{...b0,tyres:c.cos},find,base}):null;
    return {p0:{mass:p0.mass,friction:p0.friction,comBack:p0.comBack},perf:{mass:p1.mass,friction:p1.friction,comBack:p1.comBack},cos:p2&&{mass:p2.mass,friction:p2.friction,comBack:p2.comBack,cosmetic:p2.parts?.find(x=>x.slot==='tyres')}};},cand).catch(e=>({err:String(e)}));
  metrics.partSwap.derive=d;
  check('parts:perf-part-changes-physics',d.perf&&d.perf.friction!==d.p0.friction,d);
  check('parts:cosmetic-variant-same-physics',d.cos&&Math.abs(d.cos.friction-d.p0.friction)<1e-9&&Math.abs(d.cos.mass-d.p0.mass)<.6,d);
  errCheck('parts',log);await ctx.close();});
// Tricks button + every fan move (desktop) incl. one-hander / knee-knock.
if(ONLY.includes('tricks')&&RIDES[0])await guard('tricks',async()=>{for(const ride of RIDES){const {ctx,p,log}=await openPage(browser,{});await startRide(p,ride.id);
  const fan=await p.evaluate(()=>[...document.querySelectorAll('.ride-tricks-fan [data-t], .ride-tricks-fan button')].map(b=>({t:b.dataset.t||b.textContent.trim(),label:b.textContent.trim()})));
  metrics['fan-'+ride.tag]=fan;const ids=fan.map(f=>f.t+' '+f.label);
  for(const [need,re] of [['wheelie',/mono|wheel/i],['burnout',/burn/i],['stand',/stand|peg/i],['one-hander',/one|hand/i],['knee-knock',/knee/i]])
    check(`${ride.tag}:fan-has-${need}`,ids.some(x=>re.test(x)),ids);
  check(`${ride.tag}:fan-no-dead-moves`,!ids.some(x=>/hop|flip|whip|barspin|superman/i.test(x)),ids);
  await p.locator('[data-r=tricks]').click();await W(400);
  for(const f of fan){await reset(p);const pre=await p.evaluate(()=>({t:__WK_TELEMETRY__(),r:JSON.stringify(__WK_RIDE_STATE__().rider||{}),s:JSON.stringify(Object.fromEntries(Object.entries(__WK_RIDE_STATE__().s).filter(([k,v])=>typeof v==='boolean'||typeof v==='string')))}));
    const btn=p.locator(`.ride-tricks-fan [data-t="${f.t}"]`).first();const box=await btn.boundingBox();
    if(!box){check(`${ride.tag}:fan-${f.t}-works`,false,{reason:'button not visible'});continue;}
    if(/burn/i.test(f.t)){await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await W(900);}else{await btn.click();await W(700);}
    const post=await p.evaluate(()=>({t:__WK_TELEMETRY__(),r:JSON.stringify(__WK_RIDE_STATE__().rider||{}),s:JSON.stringify(Object.fromEntries(Object.entries(__WK_RIDE_STATE__().s).filter(([k,v])=>typeof v==='boolean'||typeof v==='string')))}));
    await p.screenshot({path:join(shotsDir,`${ride.tag}-fan-${f.t}.png`)});
    if(/burn/i.test(f.t))await p.mouse.up();else{await btn.click().catch(()=>{});}
    await W(300);const off=await p.evaluate(()=>__WK_TELEMETRY__());
    const changed=pre.s!==post.s||JSON.stringify(pre.t.trick)!==JSON.stringify(post.t.trick);
    check(`${ride.tag}:fan-${f.t}-works`,changed&&pre.r!==post.r&&!post.t.trick.crashed,{trickBefore:pre.t.trick,trickAfter:post.t.trick,riderPoseChanged:pre.r!==post.r,offAfter:off.trick});}
  await p.locator('[data-r=tricks]').click();await W(300);check(`${ride.tag}:fan-collapses`,!(await p.evaluate(()=>__WK_RIDE_STATE__().tricksOpen)),{});
  errCheck('tricks-'+ride.tag,log);await ctx.close();}});
// Phone-size touch viewport.
if(ONLY.includes('phone')&&RIDES[0])await guard('phone',async()=>{for(const vp of [{width:844,height:390},{width:667,height:375}]){const tag=`phone${vp.width}`;
  const {ctx,p,log}=await openPage(browser,{viewport:vp,mobile:true,video:join(OUT,'video-'+tag)});await startRide(p,RIDES[0].id);
  const L=await p.evaluate(()=>{const bb=e=>{if(!e||!e.offsetParent)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
    const t=document.querySelector('[data-r=tricks]');const others=[...document.querySelectorAll('[data-t],[data-r]')].filter(e=>e!==t&&!e.closest('.ride-tricks-fan')&&e.offsetParent).map(e=>({id:e.dataset.t||e.dataset.r,b:bb(e)}));
    return {tricks:bb(t),others,vw:innerWidth,vh:innerHeight};});
  const ov=(a,b)=>a&&b&&a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
  const overlaps=L.others.filter(o=>ov(L.tricks,o.b)).map(o=>o.id);
  const side=L.tricks&&(L.tricks.x+L.tricks.w/2<L.vw*.3||L.tricks.x+L.tricks.w/2>L.vw*.7||L.tricks.y<L.vh*.25);
  check(`${tag}:tricks-button-visible-side-no-overlap`,L.tricks&&L.tricks.w>=40&&L.tricks.h>=40&&side&&overlaps.length===0,{tricks:L.tricks,overlaps});
  await p.locator('[data-r=tricks]').tap();await W(500);
  const fan=await p.evaluate(()=>[...document.querySelectorAll('.ride-tricks-fan [data-t]')].filter(e=>e.offsetParent).map(e=>{const r=e.getBoundingClientRect();return {t:e.dataset.t,x:r.x,y:r.y,w:r.width,h:r.height}}));
  const bad=fan.filter(f=>f.w<40||f.h<40||f.x<0||f.y<0||f.x+f.w>vp.width||f.y+f.h>vp.height);
  const fanOv=[];for(const f of fan)for(const o of L.others)if(ov({x:f.x,y:f.y,w:f.w,h:f.h},o.b))fanOv.push(f.t+'×'+o.id);
  check(`${tag}:fan-buttons-tappable-in-view`,fan.length>0&&bad.length===0,{fan,bad});
  check(`${tag}:fan-no-overlap-with-controls`,fanOv.length===0,fanOv);
  await p.screenshot({path:join(shotsDir,`${tag}-tricks-open.png`)});
  const mono=fan.find(f=>/mono|wheel/i.test(f.t));if(mono){await p.touchscreen.tap(mono.x+mono.w/2,mono.y+mono.h/2);await W(300);}
  const tm=await tel(p);check(`${tag}:tap-wheelie-toggle`,tm.trick.toggles.mono,tm.trick);
  if(mono){await p.touchscreen.tap(mono.x+mono.w/2,mono.y+mono.h/2);await W(200);}
  await p.locator('[data-r=tricks]').tap();await W(300);
  // touch throttle
  await reset(p);const gas=await p.locator('[data-t=throttle]').boundingBox();const cdp=await ctx.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:7,x:gas.x+gas.width/2,y:gas.y+gas.height/2}]});await W(2000);
  const tt=await tel(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  check(`${tag}:touch-throttle`,tt.input.throttle>0&&tt.speedKmh>5,{throttle:tt.input.throttle,kmh:tt.speedKmh});
  await p.screenshot({path:join(shotsDir,`${tag}-riding.png`)});
  errCheck(tag,log);await ctx.close();}});
// Rider: new Quaternius rider with IK; old rider gone from Playground.
if(ONLY.includes('rider')&&RIDES[0])await guard('rider',async()=>{const {ctx,p,log}=await openPage(browser,{});await startRide(p,RIDES[0].id);
  const r=await p.evaluate(()=>{const {scene}=__WK_RIDE_SCENE__();let skinned=0,bones=0,old=[],names=new Set();
    scene.traverse(o=>{if(o.isSkinnedMesh){skinned++;bones=Math.max(bones,o.skeleton?.bones.length||0);}if(/trousers-|^knee[-+]?1?$|^shoe/i.test(o.name))old.push(o.name);if(o.name)names.add(o.name);});
    return {skinned,bones,old:old.slice(0,10),riderState:__WK_RIDE_STATE__().rider,someNames:[...names].filter(n=>/rider|quat|char|body|hand|foot/i.test(n)).slice(0,20)};});
  const urls=log.requests.filter(u=>/quaternius|rider|character|\.glb|\.gltf/i.test(u));
  metrics.rider={...r,urls:urls.slice(0,10)};
  check('rider:quaternius-skinned',r.skinned>0&&r.bones>10&&urls.some(u=>/quaternius|rider|character/i.test(u)),metrics.rider);
  check('rider:old-rider-gone',r.old.length===0,r.old);
  // IK: hands at grips & feet at pegs/pedals while lean changes; hands follow when steering
  const ik=await p.evaluate(()=>{const {scene,body}=__WK_RIDE_SCENE__();const T=globalThis.__WK_THREE__;const out={};
    let hands=[],feet=[];scene.traverse(o=>{if(o.isBone){if(/hand/i.test(o.name)&&!/finger|thumb|index/i.test(o.name))hands.push(o);if(/foot|ankle/i.test(o.name)&&!/toe/i.test(o.name))feet.push(o);}});
    out.handBones=hands.map(h=>h.name);out.footBones=feet.map(h=>h.name);const st=__WK_RIDE_STATE__().rider;out.ikReport=st?.ik||st?.targets||null;return out;});
  metrics.riderIK=ik;check('rider:ik-bones-and-targets',ik.handBones.length>=2&&ik.footBones.length>=2&&ik.ikReport,ik);
  await p.screenshot({path:join(shotsDir,'rider-closeup.png')});
  errCheck('rider',log);await ctx.close();});
// Ramps/jumps: 2-3 present, launch + clean landing on both rides; skyline/HDRI present.
if(ONLY.includes('ramps')&&RIDES[0])await guard('ramps',async()=>{for(const ride of RIDES){const {ctx,p,log}=await openPage(browser,{video:join(OUT,'video-ramps-'+ride.tag)});await startRide(p,ride.id);
  const env=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();const {scene}=__WK_RIDE_SCENE__();const bg=scene.background;
    return {sky:st.quality?.sky,worldSky:st.quality?.worldSky,environment:st.environment,bgIsTexture:!!bg?.isTexture,bgMapping:bg?.mapping,envMap:!!scene.environment}});
  await p.evaluate(()=>__WK_SCENE_VIEW__?.('chase'));await W(1500);await p.screenshot({path:join(shotsDir,`sky-${ride.tag}.png`)});
  metrics['sky-'+ride.tag]=env;check(`${ride.tag}:skyline-or-hdri-present`,(env.bgIsTexture||env.worldSky)&&env.envMap,env);
  const ramps=await p.evaluate(()=>{const {scene}=__WK_RIDE_SCENE__();const T=globalThis.__WK_THREE__;const out=[];
    scene.traverse(o=>{if(/ramp|kicker|jump|tabletop/i.test(o.name)&&!/(mat|tex)/i.test(o.name)&&o.parent&&!/ramp|kicker|jump|tabletop/i.test(o.parent.name||'')){const b=T?new T.Box3().setFromObject(o):null;out.push({name:o.name,min:b?.min.toArray(),max:b?.max.toArray()});}});return out;});
  metrics['ramps-'+ride.tag]={found:ramps};check(`${ride.tag}:ramps-2-3-present`,ramps.length>=2&&ramps.length<=3,ramps);
  await reset(p,{x:0,z:0,yaw:0,vx:0});await hold(p,{throttle:.6});await W(1200);await hold(p,{throttle:0});const h=await tel(p);const dirx=Math.sign(h.x)||1;
  for(const rp of ramps){if(!rp.min)continue;const cx=(rp.min[0]+rp.max[0])/2,cz=(rp.min[2]+rp.max[2])/2,top=rp.max[1];
    for(const kmh of [20,30]){await reset(p,{x:cx-dirx*(Math.abs(rp.max[0]-rp.min[0])/2+18),z:cz,yaw:dirx>0?0:Math.PI,vx:0}); // 18 m flat run-up, clear of the previous ramp's landing
      await rec(p,true);const t0=Date.now();await hold(p,{throttle:1});while(Date.now()-t0<9000){const t=await tel(p);await hold(p,{throttle:t.speedKmh<kmh?1:0});if((t.x-cx)*dirx>Math.abs(rp.max[0]-rp.min[0])/2+8||t.trick.crashed)break;await W(30);}
      await hold(p,{throttle:0});await W(1200);const r=await rec(p,false);
      const y0=r[0]?.y??0;let maxDvy=0,maxDv=0;for(let i=1;i<r.length;i++){const dt=Math.max(1e-3,r[i].t-r[i-1].t);maxDvy=Math.max(maxDvy,Math.abs((r[i].y-r[i-1].y)/dt-((r[i-1].y-(r[i-2]?.y??r[i-1].y))/Math.max(1e-3,r[i-1].t-(r[i-2]?.t??r[i-1].t-dt))))*dt);maxDv=Math.max(maxDv,Math.abs(r[i].v-r[i-1].v));}
      const air=r.filter(x=>x.ground&&!x.ground[0]&&!x.ground[1]);const landIdx=r.findIndex((x,i)=>i>0&&x.ground?.[0]&&!r[i-1].ground?.[0]&&r.slice(0,i).some(y=>y.ground&&!y.ground[0]&&!y.ground[1]));
      const after=landIdx>0?r.slice(landIdx,landIdx+40):[];
      const ev={ramp:rp.name,kmh,rise:Math.max(...r.map(x=>x.y))-y0,airS:air.length/60,crossed:r.some(x=>(x.x-cx)*dirx>0),clipBelow:Math.min(...r.map(x=>x.y))-y0,
        crashed:r.some(x=>x.crashed),maxSpeedJumpPerFrame:maxDv,maxVyJumpPerFrame:maxDvy,landedBothWheels:after.length?after.slice(-1)[0].ground:null,speedAfterLand:after.length?after.slice(-1)[0].v*3.6:null,landPitch:after.length?Math.max(...after.map(x=>Math.abs(x.pitch))):null};
      check(`${ride.tag}:ramp-${rp.name}-${kmh}kmh-launch-land-clean`,ev.crossed&&ev.rise>Math.min(.3,top*.5)&&ev.airS>.1&&!ev.crashed&&ev.clipBelow>-.15&&ev.maxSpeedJumpPerFrame<1&&ev.maxVyJumpPerFrame<1.5&&ev.landedBothWheels?.every(Boolean)&&ev.speedAfterLand>kmh*.4,ev);}
    await reset(p,{x:cx-dirx*8,z:cz,yaw:dirx>0?0:Math.PI,vx:0});await W(400);await p.screenshot({path:join(shotsDir,`ramp-${ride.tag}-${rp.name.replace(/\W+/g,'_')}.png`)});}
  errCheck('ramps-'+ride.tag,log);await ctx.close();for(const f of readdirSync(join(OUT,'video-ramps-'+ride.tag)))if(f.endsWith('.webm'))renameSync(join(OUT,'video-ramps-'+ride.tag,f),join(OUT,`ramps-${ride.tag}.webm`));}});
// Carry-over: a new frame as data only (clone of an existing frame's data under a new id + ride block + a new tyre).
if(ONLY.includes('carry')&&RIDES[0])await guard('carry',async()=>{
  const {ctx:c0,p:p0}=await openPage(browser,{});
  const base=await p0.evaluate(id=>{const all=__WK_CATALOG_ITEMS__;const kit=all.find(x=>x.id===id);const fr=kit?.kit?.map(i=>all.find(x=>x.id===i)).find(x=>x?.slot==='frame');
    const ty=kit?.kit?.map(i=>all.find(x=>x.id===i)).find(x=>x?.slot==='tyres');return {frame:fr?JSON.parse(JSON.stringify(fr)):null,tyre:ty?JSON.parse(JSON.stringify(ty)):null,kit:kit?.kit};},RIDES[1]?.id||RIDES[0].id);
  await c0.close();
  if(!base.frame){check('carry:base-frame-found',false,base);return;}
  const newId=base.frame.id.split('__')[0]+'__qacarry';
  const F={...base.frame,id:newId,name:'QA Carry-Over Frame',hidden:false,price:0,kg:(base.frame.kg||5)+6,ride:{...(base.frame.ride||{}),torque:((base.frame.ride||{}).torque||0)+25,frontTravel:.15,rearTravel:.17}};
  F.variantOf=base.frame.variantOf||base.frame.id; // reuse the existing model + fitment through data
  const Tq={...(base.tyre||{slot:'tyres'}),id:'qa_carry_tyre',name:'QA Super Grip Tyre',hidden:false,grip:1.4,price:0};Tq.variantOf=base.tyre?.variantOf||base.tyre?.id;Tq.ride={...(base.tyre?.ride||{}),friction:1.4};
  const {ctx,p,log}=await openPage(browser,{video:join(OUT,'video-carry'),init:pg=>injectExtraCatalog(pg,[F,Tq])});
  const seen=await p.evaluate(id=>!!__WK_CATALOG_ITEMS__.find(x=>x.id===id),newId);check('carry:fixture-in-catalogue',seen,{newId});
  await p.evaluate(id=>__WK_EQUIP__(id),RIDES[1]?.id||RIDES[0].id);await W(500);await p.evaluate(id=>__WK_EQUIP__(id),newId);await W(500);
  await p.evaluate(()=>__WK_EQUIP__('qa_carry_tyre'));await W(400);
  const b=await p.evaluate(()=>(typeof globalThis.__WK_BUILD__==='function'?globalThis.__WK_BUILD__():globalThis.__WK_BUILD__));check('carry:fixture-equipped',b?.frame===newId&&b?.tyres==='qa_carry_tyre',b);
  await p.screenshot({path:join(shotsDir,'carry-workshop.png')});
  await startRide(p,null);const t=await tel(p);const prof=await p.evaluate(()=>{const r=__WK_RIDE_STATE__().rideProfile;return r&&{mass:r.mass,friction:r.friction,engine:r.engine,front:r.front,rear:r.rear,parts:r.parts}});
  metrics.carry={newId,profile:prof};
  const ref=metrics['profile-'+(RIDES[1]||RIDES[0]).tag];
  check('carry:physics-from-data',prof&&t.physics==='jolt'&&prof.friction>=1.35&&(!ref||prof.mass>ref.mass+3)&&[.15,ref?.front?.travel].includes(prof.front?.travel),{prof,ref,note:"a fitted fork sets front travel over the frame"});
  const {metrics:M,checks:C}=await rideSuite(p,{tag:'carry',shots:shotsDir,shot:true});metrics['ride-carry']=M;for(const c of C)checks.push(c);
  // tricks button + IK on the fixture
  const fan=await p.evaluate(()=>[...document.querySelectorAll('.ride-tricks-fan [data-t]')].map(b=>b.dataset.t));
  await p.locator('[data-r=tricks]').click();await W(300);const open=await p.evaluate(()=>__WK_RIDE_STATE__().tricksOpen);
  await p.locator('[data-r=tricks]').click();check('carry:tricks-button',open&&fan.length>=3,{fan,open});
  const ik=await p.evaluate(()=>{let s=0;__WK_RIDE_SCENE__().scene.traverse(o=>{if(o.isSkinnedMesh)s++});return {skinned:s,rider:__WK_RIDE_STATE__().rider}});
  check('carry:rider-ik',ik.skinned>0&&(ik.rider?.ik||ik.rider?.targets),ik);
  errCheck('carry',log);await ctx.close();for(const f of readdirSync(join(OUT,'video-carry')))if(f.endsWith('.webm'))renameSync(join(OUT,'video-carry',f),join(OUT,'ride-carry.webm'));});
// Service worker cache name on the beta.
if(ONLY.includes('cache'))await guard('cache',async()=>{const {ctx,p,log}=await openPage(browser,{sw:'allow'});
  await W(6000);await p.reload({waitUntil:'domcontentloaded'});await W(4000);const keys=await p.evaluate(()=>caches.keys());metrics.cacheKeys=keys;
  check('cache:wk-beta-wk-v2.0-rides',keys.includes('wk-beta-wk-v2.0-rides'),keys);await ctx.close();});
// Scope (v2.0): beta opens straight into Playground; sample3d/other modes gone; Legacy only via a dev URL param; Garage stays.
if(ONLY.includes('legacy'))await guard('legacy',async()=>{
  // default URL, no stored level, no track param
  {const {ctx,p,log}=await openPage(browser,{level:null,track:null,viewport:{width:844,height:390},mobile:true});await W(1500);
   const st=await p.evaluate(()=>({ride:!!globalThis.__WK_RIDE_STATE__?.(),level:globalThis.__WK_RIDE_STATE__?.()?.level,text:document.body.innerText.slice(0,200)}));
   if(!st.ride){await p.getByRole('button',{name:/race|ride|play/i}).first().click().catch(()=>{});await W(4000);}
   const st2=await p.evaluate(()=>({level:globalThis.__WK_RIDE_STATE__?.()?.level,physics:globalThis.__WK_RIDE_STATE__?.()?.physics}));
   await p.screenshot({path:join(shotsDir,'default-open.png')});
   check('scope:default-opens-playground',st2.level==='arena'&&st2.physics==='jolt',{direct:st.ride,firstScreen:st.text,after:st2});errCheck('default',log);await ctx.close();}
  // removed modes must not be reachable
  for(const [name,opt] of [['sample3d',{level:null,track:'sample3d'}],['trials-level',{level:'trials',track:null}]]){
   const {ctx,p,log}=await openPage(browser,{...opt,viewport:{width:844,height:390},mobile:true});await W(1500);
   const race=p.getByRole('button',{name:'⚑ Race',exact:true});if(await race.isVisible().catch(()=>false)){await race.click({timeout:5000}).catch(()=>{});await W(5000);} // autostart may already have opened the ride over it
   const st=await p.evaluate(()=>{const s=globalThis.__WK_RIDE_STATE__?.();return s?{level:s.level,sample3d:!!s.sample3d,physics:s.physics}:null});
   const ui=await p.evaluate(()=>[...document.querySelectorAll('button,a,[role=tab]')].filter(e=>e.offsetParent).map(e=>e.textContent.trim()).filter(t=>/sample|trials|city|track|level|mode|endless/i.test(t)).slice(0,10));
   check(`scope:${name}-removed`,(!st||(st.level==='arena'&&!st.sample3d))&&ui.length===0,{state:st,modeButtons:ui});errCheck('removed-'+name,log);await ctx.close();}
  // legacy via its dev param
  const param=process.env.WK_QA_LEGACY_PARAM;
  if(!param)check('legacy:dev-param-known',false,{reason:'set WK_QA_LEGACY_PARAM (e.g. "legacy=1")'});
  else{const {ctx,p,log}=await openPage(browser,{level:null,track:null,viewport:{width:844,height:390},mobile:true,query:param});
    const race=p.getByRole('button',{name:'⚑ Race',exact:true});if(await race.isVisible().catch(()=>false))await race.click();
    await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.backdropLoaded,null,{timeout:90000}).catch(()=>{});await W(800);
    const st=await p.evaluate(()=>{const s=globalThis.__WK_RIDE_STATE__?.();return s?{level:s.level,physics:s.physics,arena:!!s.arena}:null});
    await p.keyboard.down('ArrowUp');await W(2500);const v=await p.evaluate(()=>globalThis.__WK_RIDE_STATE__?.()?.s.vx);await p.keyboard.up('ArrowUp');
    const oldRider=await p.evaluate(()=>{let n=0;globalThis.__WK_RIDE_SCENE__?.().scene.traverse(o=>{if(/trousers-/.test(o.name))n++});return n});
    await p.screenshot({path:join(shotsDir,'legacy.png')});
    check('legacy:runs-via-dev-param',st&&!st.arena&&st.physics==='classic'&&v>1,{param,...st,vx:v});
    check('legacy:original-rider-intact',oldRider>0,{oldRiderMeshes:oldRider});errCheck('legacy',log);await ctx.close();}
  // Garage
  const {ctx,p,log}=await openPage(browser,{level:null,track:null});await W(1500);
  const g=await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/garage/i.test(b.textContent)&&b.offsetParent)?.textContent||null);
  if(g){await p.getByRole('button',{name:g}).first().click().catch(()=>{});await W(3000);}
  await p.screenshot({path:join(shotsDir,'garage.png')});
  check('garage:loads',await p.evaluate(()=>!!document.querySelector('[data-wk-room-ready]')),{garageButton:g});errCheck('garage',log);await ctx.close();});
await browser.close();save();
const fails=checks.filter(c=>!c.pass);console.log(`\n${checks.length-fails.length}/${checks.length} passed`);for(const f of fails)console.log('FAIL',f.id);
