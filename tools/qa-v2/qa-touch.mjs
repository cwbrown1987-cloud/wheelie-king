// Phone multi-touch checks (CDP Input.dispatchTouchEvent): mono + stoppie on touch, brake-lock slide, tilt removed.
import {launch,openPage,startRide,tel,reset,hold,rec,round} from './qa-lib.mjs';
import {writeFileSync,mkdirSync,readdirSync,renameSync} from 'node:fs';import {join} from 'node:path';
const OUT=process.env.WK_QA_OUT||'qa-out';const SH=join(OUT,'shots');mkdirSync(SH,{recursive:true});const W=ms=>new Promise(r=>setTimeout(r,ms));
const checks=[];const ck=(id,pass,ev)=>{checks.push({id,pass:!!pass,ev:round(ev)});console.log((pass?'PASS ':'FAIL ')+id,JSON.stringify(round(ev)).slice(0,600));};
const b=await launch();
for(const ride of (process.env.WK_QA_RIDES||'bike_bmx,bike_emoto').split(',')){const tag=ride.replace(/^bike_/,'')+'-touch';
 const vp={width:844,height:390};const vdir=join(OUT,'video-'+tag);
 const {ctx,p,log}=await openPage(b,{viewport:vp,mobile:true,video:vdir});await startRide(p,ride);
 const cdp=await ctx.newCDPSession(p);const fingers=new Map();
 const ctr=async sel=>{const bb=await p.locator(sel).first().boundingBox();return bb?{x:bb.x+bb.width/2,y:bb.y+bb.height/2}:null;};
 const send=async type=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:[...fingers.entries()].map(([id,pt])=>({id,x:pt.x,y:pt.y,radiusX:8,radiusY:8,force:1}))});
 const move=async(id,pt,steps=6)=>{const a=fingers.get(id);for(let i=1;i<=steps;i++){fingers.set(id,{x:a.x+(pt.x-a.x)*i/steps,y:a.y+(pt.y-a.y)*i/steps});await send('touchMove');await W(16);}};
 const up=async id=>{if(!fingers.has(id))return;fingers.delete(id);if(fingers.size)await send('touchMove');else await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
 const upAll=async()=>{if(!fingers.size)return;fingers.clear();await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
 const down=async(id,pt)=>{if(!pt)return;const first=fingers.size===0;fingers.set(id,pt);await send(first?'touchStart':'touchStart');};
 const TS='.ride-tricks-fan [data-t], .ride-tricks-list [data-t], .ride-tricks-panel [data-t], .ride-tricks [data-t]:not([data-t=hop])';
 const trickBtn=async re=>{const L=await p.evaluate(ts=>[...document.querySelectorAll(ts)].filter(e=>e.offsetParent).map(e=>{const r=e.getBoundingClientRect();return {t:e.dataset.t,l:e.textContent.trim(),x:r.x+r.width/2,y:r.y+r.height/2}}),TS);const R=new RegExp(re,'i');const f=L.find(x=>R.test(x.t+' '+x.l));return f?{x:f.x,y:f.y}:null;};
 const tricksPanel=async want=>{for(let i=0;i<2;i++){if(!!(await p.evaluate(()=>__WK_RIDE_STATE__().tricksOpen))===want)return;await down(9,G.tricks);await up(9);await W(300);}};
 const G={thr:await ctr('[data-t=throttle]'),brk:await ctr('[data-t=brake]'),fwd:await ctr('[data-t=leanForward]:visible'),back:await ctr('[data-t=leanBack]:visible'),left:await ctr('[data-t=steerLeft]:visible'),right:await ctr('[data-t=steerRight]:visible'),tricks:await ctr('[data-r=tricks]')};
 ck(tag+':controls-present',G.thr&&G.brk&&G.fwd&&G.back&&G.right&&G.tricks,G);
 // tilt removed
 const tilt=await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.offsetParent&&e.children.length===0&&/tilt/i.test(e.textContent+(e.getAttribute('aria-label')||''))).map(e=>e.textContent.trim()||e.getAttribute('aria-label')));
 ck(tag+':tilt-removed',tilt.length===0,tilt);
 // 1. wheelie by body input: hold ACCELERATE, drag that thumb down (weight back); amount follows the drag,
 //    so the test feathers drag distance to hold ~25-35 deg. No MONO button.
 {let best={held:0};for(const target of [28,36]){await reset(p);
   await down(1,G.thr);for(let i=0;i<80;i++){if((await tel(p)).speedKmh>12)break;await W(50);}
   const rows=[];let dy=0;const t0=Date.now();
   while(Date.now()-t0<6000){const t=await tel(p);rows.push({t:(Date.now()-t0)/1000,pitch:t.pitchDeg,lean:t.input.lean,front:t.ground?.[1],crashed:t.trick.crashed});if(t.trick.crashed)break;
     const want=Math.max(0,Math.min(110,dy+(target-t.pitchDeg)*1.2));if(Math.abs(want-dy)>3){dy=want;await move(1,{x:G.thr.x,y:G.thr.y+dy},1);}await W(30);}
   await upAll();let run=0,bestRun=0,prev=null;for(const x of rows){run=(x.pitch>10&&!x.crashed&&prev!=null)?run+(x.t-prev):0;bestRun=Math.max(bestRun,run);prev=x.t;}
   const o={target,held:bestRun,maxPitch:Math.max(...rows.map(x=>x.pitch)),maxLean:Math.max(...rows.map(x=>x.lean||0)),crashed:rows.some(x=>x.crashed)};if(o.held>best.held)best=o;
   if(best.held>=2&&!best.crashed)break;}
  ck(tag+':wheelie-by-drag-touch',best.held>=2&&!best.crashed,best);await p.screenshot({path:join(SH,tag+'-wheelie.png')});}
 // 1b. no wheelie from throttle alone (needs the weight shift)
 {await reset(p);await rec(p,true);await down(1,G.thr);await W(2500);await upAll();const r=await rec(p,false);
  ck(tag+':no-wheelie-without-lean',Math.max(...r.map(x=>x.pitch))<8,{maxPitch:Math.max(...r.map(x=>x.pitch))});}
 // 2. stoppie by body input: ~25 km/h, hold BRAKE and drag that thumb up (weight forward)
 {await reset(p);await down(1,G.thr);for(let i=0;i<160;i++){if((await tel(p)).speedKmh>(tag.startsWith('bmx')?16:24))break;await W(50);}await up(1);
  await rec(p,true);await down(3,G.brk);await move(3,{x:G.brk.x,y:G.brk.y-90},4);await W(1800);await upAll();const r=await rec(p,false);
  let run=0,best=0,prev=null;for(const x of r){const s=x.ground&&!x.ground[0]&&x.ground[1]&&x.pitch<-5;run=s&&prev!=null?run+(x.t-prev):0;best=Math.max(best,run);prev=x.t;}
  const o={rearUpS:best,minPitch:Math.min(...r.map(x=>x.pitch)),crashed:r.some(x=>x.crashed),fromKmh:r[0]?.v*3.6};
  ck(tag+':stoppie-by-drag-touch',best>=.3&&!o.crashed,o);await p.screenshot({path:join(SH,tag+'-stoppie.png')});}
 // 3. brake-lock slide: BRAKE finger slides onto THROTTLE; brake stays on until lifted; indicator; burnout + steer
 {await reset(p);await down(5,G.brk);await W(250);await move(5,G.thr);await W(300);
  const t1=await tel(p);const ind=await p.evaluate(()=>[...document.querySelectorAll('body *')].some(e=>e.offsetParent&&/brake\s*lock/i.test(e.textContent)));
  await p.screenshot({path:join(SH,tag+'-brakelock.png')});
  await down(6,G.right);await rec(p,true);await W(2500);const r=await rec(p,false);await up(6);
  const t2=await tel(p);await up(5);await W(300);const t3=await tel(p);
  let yaw=0;for(let i=1;i<r.length;i++){let d=r[i].yaw-r[i-1].yaw;d=((d+540)%360)-180;yaw+=d;}
  const o={afterSlide:{thr:t1.input.throttle,brk:t1.input.brake,burnout:t1.trick.burnout},indicator:ind,withSteer:{thr:t2.input.throttle,brk:t2.input.brake,steer:t2.input.steer,burnoutFrac:r.filter(x=>x.trick?.burnout||x.trick?.drift).length/Math.max(1,r.length),yawDeg:yaw},afterLift:{thr:t3.input.throttle,brk:t3.input.brake}};
  ck(tag+':brake-lock-slide-holds-brake',o.afterSlide.thr>0&&o.afterSlide.brk>0&&o.afterSlide.burnout,o);
  ck(tag+':brake-lock-indicator',ind,o);
  // burnout + steer = donut: the rear steps out, so burnout or drift both count as the held move
  ck(tag+':brake-lock-burnout-plus-steer',o.withSteer.brk>0&&o.withSteer.steer!==0&&o.withSteer.burnoutFrac>.6&&Math.abs(yaw)>20,o);
  ck(tag+':brake-lock-releases-on-lift',o.afterLift.brk===0&&o.afterLift.thr===0,o);}

 // 4. TRICKS list: vertical, large one-tap buttons; each triggers its move on touch
 {await reset(p);await down(9,G.tricks);await up(9);await W(400);
  const L=await p.evaluate(ts=>[...document.querySelectorAll(ts)].filter(e=>e.offsetParent).map(e=>{const r=e.getBoundingClientRect();return {t:e.dataset.t,l:e.textContent.trim(),x:r.x,y:r.y,w:r.width,h:r.height}}),TS);
  await p.screenshot({path:join(SH,tag+'-tricks-list.png')});await down(9,G.tricks);await up(9);await W(200);
  const xs=L.map(b=>b.x+b.w/2),vertical=L.length>1&&Math.max(...xs)-Math.min(...xs)<8&&L.every((b,i)=>i===0||b.y>L[i-1].y);
  const inView=L.every(b=>b.x>=0&&b.y>=0&&b.x+b.w<=vp.width&&b.y+b.h<=vp.height);
  ck(tag+':tricks-vertical-list-large',vertical&&L.every(b=>b.w>=48&&b.h>=44)&&inView,L);
  const want=[['burnout',/burn/i],['stand',/stand/i],['one-hander',/one|hand/i],['knee-knock',/knee/i]];
  for(const [name,re] of want){const b=L.find(x=>re.test(x.t+' '+x.l));if(!b){ck(`${tag}:trick-${name}-present`,false,L.map(x=>x.t));continue;}
    await reset(p);const pre=await p.evaluate(()=>JSON.stringify(__WK_RIDE_STATE__().rider||{}));
    const speed={mono:12,stoppie:tag.startsWith('bmx')?16:25}[name];
    if(speed){await down(1,G.thr);for(let i=0;i<150;i++){if((await tel(p)).speedKmh>speed)break;await W(40);}if(name==='stoppie')await up(1);}
    await tricksPanel(true);const bb=await trickBtn(re.source);
    await rec(p,true);await down(7,bb);await W(80);await up(7);if(name==='burnout'){await down(1,G.thr);await W(1200);await up(1);}else await W(name==='mono'?1500:1200);const r=await rec(p,false);
    const post=await p.evaluate(()=>JSON.stringify(__WK_RIDE_STATE__().rider||{}));const t=await tel(p);await upAll();
    const ev={pose:pre!==post,frontUpS:r.filter(x=>x.ground&&!x.ground[1]&&x.ground[0]).length/60,rearUpS:r.filter(x=>x.ground&&!x.ground[0]&&x.ground[1]).length/60,
      maxPitch:Math.max(...r.map(x=>x.pitch)),minPitch:Math.min(...r.map(x=>x.pitch)),burnout:r.some(x=>x.trick?.burnout),standing:t.trick.standing,trick:t.trick,crashed:r.some(x=>x.crashed)};
    const ok={mono:ev.frontUpS>.3&&ev.maxPitch>8,stoppie:ev.rearUpS>.3&&ev.minPitch<-5,burnout:ev.burnout,stand:ev.standing&&ev.pose,'one-hander':ev.pose,'knee-knock':ev.pose}[name];
    ck(`${tag}:trick-${name}-one-tap-touch`,ok&&!ev.crashed,ev);await p.screenshot({path:join(SH,`${tag}-trick-${name}.png`)});
    // tap again to end toggles
    // (the throttle tap can close the panel, so open/close by state, not by blind toggling)
    await tricksPanel(true);const bb2=await trickBtn(re.source);if(bb2&&/stand|mono|burnout/.test(name)){await down(7,bb2);await up(7);}await tricksPanel(false);}
  ck(tag+':tricks-no-dead-buttons',!L.some(x=>/hop|flip|whip|barspin|superman|combo|mono|stoppie/i.test(x.t+' '+x.l)),L.map(x=>x.t));}
 const errs=log.errors;ck(tag+':no-console-errors',errs.length===0,errs.slice(0,5));
 await ctx.close();for(const f of readdirSync(vdir))if(f.endsWith('.webm'))renameSync(join(vdir,f),join(OUT,tag+'.webm'));}
await b.close();writeFileSync(join(OUT,'qa-touch.json'),JSON.stringify(checks,null,1));console.log(checks.filter(c=>c.pass).length+'/'+checks.length+' passed');
