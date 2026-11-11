// Default race rider matches the approved test outfit: lime full-face with goggles,
// blue jersey, dark pants, gloves and boots, with tighter proportions and a crouched pose.
import {launchBrowser,pageOptions,withLegacy} from './_browser.mjs';
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
  await p.goto(withLegacy(process.env.WK_TEST_URL||'http://127.0.0.1:8931/'));
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
   const shell=(()=>{let m=null;rider.traverse(o=>{if(!m&&o.isMesh&&(o.name==='rider:helmet-shell'||(o.name||'').includes('helmet-shell')))m=o});if(!m)rider.traverse(o=>{if(!m&&o.isMesh&&(o.name||'').includes('helmet:shell'))m=o});return m})();
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
    helmetUnlit:/Basic/i.test(shell?.material?.type||''),
    hoodVisible:!!hood?.visible,
    collarVisible:!!collar?.visible,
    hasGoggles:has('goggle')||has('visor')||has('helmet-visor'),
    hasPeak:has('helmet:peak')||has('helmet-chinbar')||has('helmet-visor'),
    hasChin:has('helmet-chinbar')||has('chinbar'),
    hasVisor:has('helmet-visor')||has('visor')||has('goggle'),
    hasBoot:has('shoe:ankle')||has('shoe:shin')||has('shoe:buckle'),
    hasLaces:names.some(n=>n.includes('shoe:lace')),
    riderH:riderBox.h,helmetH:headBox.h,ratio:headBox.h/riderBox.h,
    visHelmet:!!rider.getObjectByName('rider:helmet'),
    gearHelmetSize:(()=>{const vis=rider.getObjectByName('rider:helmet');return vis?worldBox(vis):(shell?worldBox(shell):null)})(),
    faceHidden:!names.filter(n=>/rider:(face|nose|eye|ear)/.test(n)).some(n=>rider.getObjectByName(n)?.visible),
    neckHidden:rider.getObjectByName('rider:neck')?.visible===false,
    shellVisible:!!shell?.visible,
    helmetGroupVisible:!!shell?.parent?.visible,
    hoodParent:hood?.parent?.name||null,
    headGraph:(()=>{const rows=[];rider.traverse(o=>{
      if(!o.isMesh||!/helmet|hood|head|face|collar|neck|peak|goggle|visor|liner|shell/i.test(o.name||''))return;
      o.updateWorldMatrix(true,false);const e=o.matrixWorld.elements,c=o.material?.color;
      rows.push({name:o.name,vis:o.visible,parent:o.parent?.name,pos:[+e[12].toFixed(3),+e[13].toFixed(3),+e[14].toFixed(3)],
        type:o.material?.type,color:c?{r:+c.r.toFixed(3),g:+c.g.toFixed(3),b:+c.b.toFixed(3)}:null,verts:o.geometry?.attributes?.position?.count||0});
    });return rows;})()
   };
  },want);
  assert.deepEqual(look.gearIds,want,name+' default test outfit '+JSON.stringify(look.gearIds));
  assert(look.hasChin,name+' helmet has a chin bar '+JSON.stringify({names:look.headGraph?.map(r=>r.name)}));
  assert(look.hasVisor||look.hasGoggles,name+' helmet has a visor '+JSON.stringify({names:look.headGraph?.map(r=>r.name)}));
  assert(look.hasBoot,name+' wears boots');
  assert(!look.hasLaces,name+' boots are not laced trainers');
  assert.equal(look.hoodVisible,false,name+' hoodie is off');
  assert.equal(look.collarVisible,true,name+' jersey collar is on');
  assert(look.pitch<-.08&&look.pitch>-.28,name+' attack-position pitch '+look.pitch);
  assert(look.spineDeg>=28&&look.spineDeg<=42,name+' back angle 30-40deg '+look.spineDeg);
  assert(look.helmetLime,name+' helmet reads lime '+JSON.stringify(look.helmetColor));
  assert(look.helmetUnlit||look.helmetEmissive>=.5,name+' helmet stays bright '+JSON.stringify({unlit:look.helmetUnlit,emi:look.helmetEmissive}));
  assert(look.ratio<0.36,name+' head is not oversized '+JSON.stringify({ratio:look.ratio,helmetH:look.helmetH,riderH:look.riderH}));
  assert(look.faceHidden,name+' face sits inside the full-face helmet');
  assert(look.neckHidden,name+' neck is hidden under the full-face helmet');
  assert(look.shellVisible,name+' lime helmet shell is drawn '+JSON.stringify(look.headGraph));
  assert(look.visHelmet,name+' visible moto helmet missing');
  assert(look.gearHelmetSize&&look.gearHelmetSize.h>0.14&&look.gearHelmetSize.h<0.28,name+' helmet height should match a real head '+JSON.stringify(look.gearHelmetSize));
  assert(look.gearHelmetSize.w>0.16&&look.gearHelmetSize.w<0.30,name+' helmet depth should not be a giant ball '+JSON.stringify(look.gearHelmetSize));
  assert(look.gearHelmetSize.d>0.14&&look.gearHelmetSize.d<0.24,name+' helmet width should sit inside the shoulders '+JSON.stringify(look.gearHelmetSize));
  assert.equal(look.hoodParent,null,name+' jersey must not keep the built-in hood '+JSON.stringify({hoodParent:look.hoodParent}));
  console.log(JSON.stringify({name,headGraph:look.headGraph}));
  if(shots){
   await p.evaluate(()=>{
    const {scene,cam}=__WK_RIDE_SCENE__(),rider=scene.getObjectByName('wk:rider');
    let shell=null;rider.traverse(o=>{if(!shell&&o.isMesh&&o.name&&o.name.includes('helmet:shell'))shell=o});
    shell.updateWorldMatrix(true,false);const e=shell.matrixWorld.elements;
    cam.position.set(e[12]+0.05,e[13]+0.04,e[14]+0.95);cam.lookAt(e[12],e[13],e[14]);cam.fov=32;cam.updateProjectionMatrix();
    globalThis.__WK_CAM_HOLD__=true;
   });
   await p.waitForTimeout(50);
   await p.screenshot({path:`${shots}/${name}-helmet-close.png`});
   await p.evaluate(()=>{globalThis.__WK_CAM_HOLD__=false});
   await p.waitForTimeout(50);
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
