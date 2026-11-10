// Default race rider matches the approved test outfit: lime full-face with goggles,
// blue jersey, dark pants, gloves and boots, with tighter proportions and a crouched pose.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {DEFAULT_OUTFIT} from '../gear-catalogue.js';

const shots=process.env.WK_RIDER_SHOTS;
if(shots)mkdirSync(shots,{recursive:true});
const want=DEFAULT_OUTFIT;
const browser=await launchBrowser();
try{
 const results=[];
 for(const [name,vp] of [['desktop',{width:1280,height:720}],['phone',{width:844,height:390,hasTouch:true,isMobile:true}]]){
  const p=await browser.newPage(pageOptions({viewport:{width:vp.width,height:vp.height},hasTouch:!!vp.hasTouch,isMobile:!!vp.isMobile,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{localStorage.setItem('wk-level','trials');localStorage.removeItem('wk-rider-gear-v1')});
  await p.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_trax_lime'));
  await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded&&globalThis.__WK_RIDE_SCENE__,null,{timeout:90000});
  const look=await p.evaluate(want=>{
   const T=globalThis.__WK_THREE_MOD__||null;
   const {scene}=__WK_RIDE_SCENE__();
   const rider=scene.getObjectByName('wk:rider');
   const st=__WK_RIDE_STATE__().rider||{};
   const names=[];rider.traverse(o=>{if(o.name)names.push(o.name)});
   const has=n=>names.some(x=>x.includes(n));
   const torso=rider.getObjectByName('rider:torso');
   const hood=rider.getObjectByName('rider:hood');
   const collar=rider.getObjectByName('rider:jersey-collar');
   const head=rider.getObjectByName('rider:head');
   const box=obj=>{obj.updateWorldMatrix(true,true);const b=obj.userData._b||(obj.userData._b=new (scene.getObjectByName('wk:rider').constructor.constructor||Object));return null};
   // Use Box3 from a module already in the page: __WK_THREE__ is a promise of [T,OC,RE] or we pick any Mesh
   let Box3=null,Vector3=null;
   scene.traverse(o=>{if(!Box3&&o.isMesh&&o.geometry){Box3=o.geometry.boundingBox&&o.geometry.boundingBox.constructor;}});
   // fallback: compute min/max from world positions of meshes
   const worldBox=obj=>{
    let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    obj.traverse(o=>{
     if(!o.isMesh||!o.geometry)return;
     if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
     const b=o.geometry.boundingBox;if(!b)return;
     const pts=[[b.min.x,b.min.y,b.min.z],[b.max.x,b.max.y,b.max.z]];
     // all 8 corners
     const c=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])c.push([x,y,z]);
     o.updateWorldMatrix(true,false);
     const e=o.matrixWorld.elements;
     for(const [x,y,z] of c){
      const wx=e[0]*x+e[4]*y+e[8]*z+e[12],wy=e[1]*x+e[5]*y+e[9]*z+e[13],wz=e[2]*x+e[6]*y+e[10]*z+e[14];
      min[0]=Math.min(min[0],wx);min[1]=Math.min(min[1],wy);min[2]=Math.min(min[2],wz);
      max[0]=Math.max(max[0],wx);max[1]=Math.max(max[1],wy);max[2]=Math.max(max[2],wz);
     }
    });
    return {min,max,h:max[1]-min[1],w:max[0]-min[0],d:max[2]-min[2]};
   };
   const riderBox=worldBox(rider),headBox=worldBox(head);
   const shell=(()=>{let m=null;rider.traverse(o=>{if(!m&&o.isMesh&&o.name&&o.name.includes('helmet:shell'))m=o});return m})();
   const col=shell?.material?.color,em=shell?.material?.emissive;
   const helmetColor=col?{r:+col.r.toFixed(3),g:+col.g.toFixed(3),b:+col.b.toFixed(3)}:null;
   const helmetLime=!!(col&&col.g>0.7&&col.g>col.r&&col.b<0.35);
   return {
    gearIds:rider.userData.gearIds,
    want,
    style:st.style,
    reference:st.reference,
    pitch:torso.rotation.z,
    spineDeg:st.pose?.spineDeg,
    helmetColor,
    helmetLime,
    helmetEmissive:shell?.material?.emissiveIntensity??0,
    hoodVisible:!!hood?.visible,
    collarVisible:!!collar?.visible,
    hasGoggles:has('goggle'),
    hasPeak:has('helmet:peak'),
    hasBoot:has('shoe:ankle')||has('shoe:shin')||has('shoe:buckle'),
    hasLaces:names.some(n=>n.includes('shoe:lace')),
    riderH:riderBox.h,helmetH:headBox.h,ratio:headBox.h/riderBox.h,
    faceHidden:!names.filter(n=>/rider:(face|nose|eye|ear)/.test(n)).some(n=>rider.getObjectByName(n)?.visible)
   };
  },want);
  assert.deepEqual(look.gearIds,want,name+' default test outfit '+JSON.stringify(look.gearIds));
  assert(look.hasGoggles,name+' helmet has goggles');
  assert(look.hasPeak,name+' helmet has a peak/visor');
  assert(look.hasBoot,name+' wears boots');
  assert(!look.hasLaces,name+' boots are not laced trainers');
  assert.equal(look.hoodVisible,false,name+' hoodie is off');
  assert.equal(look.collarVisible,true,name+' jersey collar is on');
  assert(look.pitch<-.08&&look.pitch>-.28,name+' attack-position pitch '+look.pitch);
  assert(look.spineDeg>=28&&look.spineDeg<=42,name+' back angle 30-40deg '+look.spineDeg);
  assert(look.helmetLime,name+' helmet reads lime '+JSON.stringify(look.helmetColor));
  assert(look.helmetEmissive>=.5,name+' helmet emissive '+look.helmetEmissive);
  assert(look.ratio<0.33,name+' head is not oversized '+JSON.stringify({ratio:look.ratio,helmetH:look.helmetH,riderH:look.riderH}));
  assert(look.faceHidden,name+' face sits inside the full-face helmet');
  if(shots){
   await p.screenshot({path:`${shots}/${name}-side.png`});
   await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
   await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraBlend===1);
   await p.waitForTimeout(400);
   await p.screenshot({path:`${shots}/${name}-chase.png`});
   await p.evaluate(()=>__WK_SCENE_VIEW__('side'));
  }
  assert.deepEqual(errors,[],'page errors '+errors.join(' | '));
  results.push({name,pitch:+look.pitch.toFixed(3),spineDeg:look.spineDeg!=null?+look.spineDeg.toFixed(1):null,ratio:+look.ratio.toFixed(3),helmetLime:look.helmetLime,gear:look.gearIds});
  await p.close();
 }
 console.log(JSON.stringify({riderOutfit:true,want,results}));
}finally{await browser.close()}
