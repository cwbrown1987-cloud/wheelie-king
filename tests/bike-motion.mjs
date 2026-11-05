import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1200,height:780},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/wk (modular|frame|hook|trax|detail)/.test(m.text()))errors.push(m.text())});
 await page.addInitScript(()=>localStorage.setItem('wk-builder-mode','advanced'));await page.goto('http://127.0.0.1:8931/');await page.waitForFunction(()=>globalThis.__WK_VIEW__);
 await page.locator('[data-cat="bars"]').click();await page.waitForFunction(()=>globalThis.__WK_EQUIP__);
 const frames=await page.evaluate(()=>__WK_CAT__().items.filter(p=>p.completeBike).map(p=>p.id));
 const report=[];
 for(const kit of frames){
  assert(await page.evaluate(id=>__WK_EQUIP__(id),kit));await page.waitForTimeout(200);
  // Include axle-following bicycle fenders or a fixed high moto front blade.
  await page.evaluate(()=>{const b={...__WK_BUILD__,fender_f:'ff_low',fender_r:'fr_short'};__WK_SETBUILD__(b)});await page.waitForTimeout(200);
  const result=await page.evaluate(async()=>{
   const T=await import('/vendor/three.module.js'),{createBikeMotion}=await import('/bike-motion.js');
   let source;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')source=o.parent});
   const root=source.clone(true),b={...__WK_BUILD__},A=root.userData.wkAnchors,rig=createBikeMotion(root,b,__WK_PART__);
   const pos=o=>o.getWorldPosition(new T.Vector3()),local=p=>root.localToWorld(new T.Vector3(...p,0));
   root.updateMatrixWorld(true);
   const head=root.getObjectByName('frame:headTube'),headStart=pos(head),frontFender=root.getObjectByName('wk:part:fender_f'),frontFenderStart=frontFender.matrix.clone();
   const rear=root.getObjectByName('wk:model:rearFrame'),pivot=rear?pos(root.getObjectByName('rearFrame:pivot')):null;
   const brakes=root.getObjectByName('wk:brakes')?.children.map(o=>({o,base:o.matrix.clone(),center:o.parent.worldToLocal(new T.Box3().setFromObject(o).getCenter(new T.Vector3()))}))||[];
   const fork=root.getObjectByName('wk:model:fork'),crown=fork?.getObjectByName('fork:crown'),crownStart=crown?pos(crown):null,moving=[];fork?.traverse(o=>{if(o.userData.wkForkMoving)moving.push({o,base:o.position.clone()})});
   const samples=[];let maxError=0,rotorCount=0;
   const check=(label,error)=>{maxError=Math.max(maxError,error);if(error>1e-6)throw Error(`${b.frame}: ${label} error ${error}`)};
   for(const compression of [0,.25,.5,.75,1]){
    const state=rig.update({distance:.13,driveDistance:.13,rearCompression:compression,frontCompression:compression,travelR:.045,travelF:.06});root.updateMatrixWorld(true);
    check('main frame',pos(head).distanceTo(headStart));
    if(crown)check('fixed fork crown',pos(crown).distanceTo(crownStart));
    const shift=new T.Vector3(state.frontAxle[0]-A.frontAxle[0],state.frontAxle[1]-A.frontAxle[1],0);
    for(const {o,base}of moving)check('fork slider '+o.name,o.position.distanceTo(base.clone().add(shift)));
    if(__WK_PART__(b.suspension)?.id==='dnm'&&compression>0){if(!moving.some(v=>v.o.name==='fork:stanchionR'))throw Error('USD stanchion must move');}

    if(!rear)check('rigid rear',new T.Vector2(...state.rearAxle).distanceTo(new T.Vector2(...A.rearAxle)));
    if(!(__WK_PART__(b.suspension)?.travel>0))check('rigid fork',new T.Vector2(...state.frontAxle).distanceTo(new T.Vector2(...A.frontAxle)));
    if(rear){
     check('pivot',pos(root.getObjectByName('rearFrame:pivot')).distanceTo(pivot));
     check('axle',pos(root.getObjectByName('rearFrame:axle')).distanceTo(local(state.rearAxle)));
     check('fixed shock eye',pos(root.getObjectByName('shock:eyeletTop')).distanceTo(local(A.shockFrame)));
     check('moving shock eye',pos(root.getObjectByName('shock:eyeletBottom')).distanceTo(pos(root.getObjectByName('rearFrame:shockEye'))));
    }
    const rearMount=new T.Matrix4();if(rear)rearMount.makeTranslation(...A.swingPivot,0).multiply(new T.Matrix4().makeRotationZ(state.rearAngle)).multiply(new T.Matrix4().makeTranslation(-A.swingPivot[0],-A.swingPivot[1],0));
    for(const {o,base,center} of brakes){
     const front=Math.abs(center.x-A.frontAxle[0])<Math.abs(center.x-A.rearAxle[0]),axle=front?A.frontAxle:A.rearAxle,target=front?state.frontAxle:state.rearAxle,expected=new T.Matrix4();
     if(/^brake:rotor(?:Bolts)?$/.test(o.name)){rotorCount++;expected.makeTranslation(...target,0).multiply(new T.Matrix4().makeRotationZ(state.wheelPhase)).multiply(new T.Matrix4().makeTranslation(-axle[0],-axle[1],0));}
     else if(!front&&rear)expected.copy(rearMount);
     else expected.makeTranslation(target[0]-axle[0],target[1]-axle[1],0);
     expected.multiply(base);check(o.name||'rim brake',Math.max(...o.matrix.elements.map((v,i)=>Math.abs(v-expected.elements[i]))));
    }
    if(frontFender.userData.mount==='underTripleClamp')check('fixed high fender',Math.max(...frontFender.matrix.elements.map((v,i)=>Math.abs(v-frontFenderStart.elements[i]))));
    else {const expected=frontFenderStart.clone();expected.elements[12]+=state.frontAxle[0]-A.frontAxle[0];expected.elements[13]+=state.frontAxle[1]-A.frontAxle[1];check('low front fender',Math.max(...frontFender.matrix.elements.map((v,i)=>Math.abs(v-expected.elements[i]))));}
    check('hugger swingarm',Math.max(...root.getObjectByName('wk:part:fender_r').matrix.elements.map((v,i)=>Math.abs(v-rearMount.elements[i]))));
    check('axle fasteners',Math.max(...root.getObjectByName('frame:rearAxleBolts').matrix.elements.map((v,i)=>Math.abs(v-rearMount.elements[i]))));
    samples.push({compression,frontAxle:state.frontAxle,rearAxle:state.rearAxle});
   }
   // Starting a fresh ride from a compressed garage pose must not add its
   // fork compression twice. Clone userData retains the original lower mounts.
   const clone=root.clone(true),newRig=createBikeMotion(clone,b,__WK_PART__);newRig.update();
   clone.traverse(o=>{if(o.userData.wkForkRestPosition)check('recreated fork rest',o.position.distanceTo(new T.Vector3(...o.userData.wkForkRestPosition)))});
   return {frame:b.frame,suspended:!!rear,maxError,rotorChecks:rotorCount,samples};
  });
  report.push(result);
 }
 assert.equal(report.length,frames.length);assert.equal(report.filter(r=>r.suspended).length,6);assert(report.some(r=>r.rotorChecks>0));assert.deepEqual(errors,[]);
 mkdirSync('test-results',{recursive:true});writeFileSync('test-results/bike-motion.json',JSON.stringify({report,errors},null,2));
 console.log(JSON.stringify({bikes:report.length,compressionPoses:report.length*5,pivotsAndShockEyes:true,rigidFramesFixed:true,brakesAndFenders:true,errors}));
}finally{await browser.close();}
