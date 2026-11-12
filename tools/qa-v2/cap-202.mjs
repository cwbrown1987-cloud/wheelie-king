// v2.0.2 evidence on the live beta: phone burnout -> donut clip (emoto), desktop donut + BMX stoppie + loop-out shots.
import {launch,openPage,startRide,tel,reset,hold} from './qa-lib.mjs';import {mkdirSync,readdirSync,renameSync} from 'node:fs';import {join} from 'node:path';
const OUT=process.env.WK_SHOTS||'shots-202';mkdirSync(OUT,{recursive:true});const W=ms=>new Promise(r=>setTimeout(r,ms));const log=[];
const b=await launch();
// phone: brake + throttle (burnout held), then steer -> donut. Recorded.
{const vdir=join(OUT,'phone-video');const {ctx,p}=await openPage(b,{viewport:{width:844,height:390},mobile:true,video:vdir});await startRide(p,'bike_emoto');
 const cdp=await ctx.newCDPSession(p);const c=async s=>{const bb=await p.locator(s).first().boundingBox();return [bb.x+bb.width/2,bb.y+bb.height/2]};
 const T=await c('[data-t=throttle]'),B=await c('[data-t=brake]'),R=await c('[data-t=steerRight]:visible').catch(()=>null);
 const pts={};const send=type=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:Object.entries(pts).map(([id,[x,y]])=>({id:+id,x,y,radiusX:8,radiusY:8,force:1}))});
 await reset(p,{x:0,z:0,yaw:0,vx:0});const tr=[];const samp=async(ph)=>{const t=await tel(p);tr.push({ph,yaw:t.yawDeg,roll:t.rollDeg,kmh:t.speedKmh,x:t.x,z:t.z,burn:t.trick.burnout,drift:t.trick.drift,crash:t.trick.crashed});return t;};
 pts[2]=B;await send('touchStart');await W(300);pts[1]=T;await send('touchStart');
 for(let i=0;i<50;i++){await samp('burn');await W(40);}await p.screenshot({path:join(OUT,'phone-burnout-emoto.png')});
 if(R){pts[3]=R;await send('touchStart');}let shot=false;
 for(let i=0;i<120;i++){const t=await samp('donut');if(!shot&&i>50){await p.screenshot({path:join(OUT,'phone-donut-emoto.png')});shot=true;}if(t.trick.crashed)break;await W(40);}
 for(const k of Object.keys(pts))delete pts[k];await send('touchEnd');await W(1200);
 const bu=tr.filter(x=>x.ph==='burn'),dn=tr.filter(x=>x.ph==='donut');let yaw=0;for(let i=1;i<dn.length;i++){let d=dn[i].yaw-dn[i-1].yaw;d=((d+540)%360)-180;yaw+=d;}
 log.push({phone:{steerBtn:!!R,burnDisp:Math.hypot(bu.at(-1).x-bu[0].x,bu.at(-1).z-bu[0].z),burnFlag:bu.some(x=>x.burn),donutYawDeg:yaw,maxRoll:Math.max(...dn.map(x=>Math.abs(x.roll))),crash:tr.find(x=>x.crash)?.crash||null}});
 await ctx.close();for(const f of readdirSync(vdir))if(f.endsWith('.webm'))renameSync(join(vdir,f),join(OUT,'phone-burnout-donut.webm'));}
for(const ride of ['bike_emoto','bike_bmx']){const tag=ride.replace('bike_','');const {ctx,p}=await openPage(b,{});await startRide(p,ride);
 await p.evaluate(()=>__WK_SCENE_VIEW__?.('chase'));await W(500);
 // donut (from a roll for the BMX: pedals can't spin the rear from a standstill)
 await reset(p,{x:0,z:0,yaw:0,vx:tag==='bmx'?6:0});await hold(p,{brake:1,throttle:1});await W(800);await hold(p,{brake:1,throttle:1,steer:1});await W(1800);
 await p.screenshot({path:join(OUT,`donut-${tag}.png`)});const td=await tel(p);await hold(p,{brake:0,throttle:0,steer:0});log.push({tag,donutEnd:{yaw:td.yawDeg,roll:td.rollDeg,crash:td.trick.crashed}});
 // stoppie: 20 km/h, brake + lean forward
 await reset(p,{x:0,z:0,yaw:0,vx:0});await hold(p,{throttle:1});for(let i=0;i<150;i++){if((await tel(p)).speedKmh>20)break;await W(40);}
 await hold(p,{throttle:0,brake:1,lean:1});let mp=0,sh=false;for(let i=0;i<60;i++){const t=await tel(p);mp=Math.min(mp,t.pitchDeg);if(!sh&&t.pitchDeg<-8){await p.screenshot({path:join(OUT,`stoppie-${tag}.png`)});sh=true;}await W(25);}
 await hold(p,{brake:0,lean:0});log.push({tag,stoppie:{minPitch:mp,shot:sh}});
 // loop-out: full yank back off the large kicker
 await reset(p,{x:70,z:14,yaw:0,vx:0});await hold(p,{throttle:1});let lo=null;
 for(let i=0;i<250;i++){const t=await tel(p);if(t.x>86)await hold(p,{throttle:1,lean:-1});if(t.trick.crashed){lo=t.trick.crashed;await W(300);await p.screenshot({path:join(OUT,`loopout-${tag}.png`)});break;}await W(30);}
 await hold(p,{throttle:0,lean:0});log.push({tag,loopOut:lo});await ctx.close();}
await b.close();console.log(JSON.stringify(log));
