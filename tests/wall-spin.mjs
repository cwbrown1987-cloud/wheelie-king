// Wall items drag on the wall (along / up / down). Neon tubes spin 90° in the wall
// plane with animated arrows; signs / screens / tool walls stay upright. Green/red
// ghost follows the item. Default workshop zoom is unchanged.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
const browser=await launchBrowser();
const URL0=process.env.WK_TEST_URL||'http://127.0.0.1:8931/',shots=process.env.WK_WALL_SHOTS;
const camOf=()=>{const v=__WK_VIEW__;return {fov:v.camera.fov,min:v.controls.minDistance,max:v.controls.maxDistance}};
const arrowSpin=()=>{const g=__WK_VIEW__.scene.getObjectByName('wk:gizmo3d');if(!g)return [];const a=[];g.traverse(o=>{if(o.userData.gizmo==='rotate')a.push(+o.rotation.y.toFixed(5))});return a;};
const ghost=uid=>{const it=__WK_WORKSHOP_PLACE__.list().find(i=>i.uid===uid);const h=__WK_VIEW__.scene.getObjectByName('workshop:placed:'+(it?.item||''));let mark=null,col=null,vis=false;
  __WK_VIEW__.scene.traverse(o=>{if(o.name==='workshop:placement-preview'&&o.parent?.name==='workshop:placed:'+it?.item){mark=o;vis=o.visible;const m=o.children[0]?.material;if(m?.color)col='#'+m.color.getHexString();}});
  return {vis,col,ok:__WK_WORKSHOP_PLACE__.state().valid?.ok};};
const findSpot=(id,y0=1.55)=>{
  const P=__WK_WORKSHOP_PLACE__,tries=[];
  for(const [x,z,yaw] of [[5.38,4.3,-Math.PI/2],[5.38,2.4,-Math.PI/2],[5.38,3.4,-Math.PI/2],[-5.9,2.2,Math.PI/2],[-5.9,1.2,Math.PI/2],[0,6.4,Math.PI],[1.2,6.4,Math.PI],[-1,6.4,Math.PI]])
    for(const y of [y0,1.2,1.8,2.1,1.0]){const r=P.check(id,{x,y,z,yaw});tries.push({x,y,z,yaw,...r});if(r.ok)return {x,y,z,yaw};}
  return {fail:true,tries:tries.slice(0,6)};
};
const lookAt=uid=>{
  const P=__WK_WORKSHOP_PLACE__,it=P.list().find(i=>i.uid===uid),v=__WK_VIEW__;
  if(!it)return;const n={x:Math.sin(it.yaw),z:Math.cos(it.yaw)};
  v.controls.autoRotate=false;v.controls.enableDamping=false;
  v.camera.position.set(it.x+n.x*3.2,it.y+.4,it.z+n.z*3.2);v.controls.target.set(it.x,it.y,it.z);v.controls.update();
};
const screenOf=uid=>{
  const P=__WK_WORKSHOP_PLACE__,it=P.list().find(i=>i.uid===uid),v=__WK_VIEW__;
  const p=v.camera.position.clone().set(it.x,it.y,it.z).project(v.camera),r=v.renderer.domElement.getBoundingClientRect();
  return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2,ok:Math.abs(p.x)<.95&&Math.abs(p.y)<.95};
};
try{
 for(const vp of [{width:1024,height:658},{width:844,height:390,mobile:true}]){
  const p=await browser.newPage(pageOptions({viewport:{width:vp.width,height:vp.height},isMobile:!!vp.mobile,hasTouch:!!vp.mobile,deviceScaleFactor:1,serviceWorkers:'block'})),errors=[];p.on('pageerror',e=>errors.push(e.message));
  const tag=vp.width+'x'+vp.height;
  await p.goto(URL0);await p.evaluate(()=>localStorage.removeItem('wk-room-layout-v1'));await p.reload();
  await p.waitForFunction(()=>globalThis.__WK_VIEW__?.worldRoom&&__WK_WORKSHOP_PLACE__?.ready()&&__WK_VIEW__?.wkOpeningFramed,null,{timeout:180000});
  await p.evaluate(()=>{__WK_VIEW__.controls.autoRotate=false});await p.waitForTimeout(400);
  const cam0=await p.evaluate(camOf);

  await p.locator('[data-wk-place]').click();
  await p.waitForFunction(()=>__WK_WORKSHOP_PLACE__.placeMode.state().on&&!__WK_WORKSHOP_PLACE__.placeMode.state().tweening,null,{timeout:10000});
  await p.evaluate(()=>{const pan=document.getElementById('wk-place-panel');if(pan)pan.hidden=true;});

  const placed=await p.evaluate(()=>{
    const P=__WK_WORKSHOP_PLACE__;
    const taken=[];
    const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1.1;
    const find=(id,y0=1.55)=>{
      const spots=[[5.38,4.3,-Math.PI/2],[5.38,2.4,-Math.PI/2],[5.38,3.4,-Math.PI/2],[-5.9,2.2,Math.PI/2],[-5.9,1.2,Math.PI/2],[0,6.4,Math.PI],[1.2,6.4,Math.PI],[-1,6.4,Math.PI],[5.38,1.4,-Math.PI/2],[-5.9,3.0,Math.PI/2]];
      for(const [x,z,yaw] of spots)for(const y of [y0,1.2,1.8,2.1,1.0]){const pos={x,y,z,yaw};if(taken.some(t=>near(t,pos)))continue;const r=P.check(id,pos);if(r.ok){taken.push(pos);return pos;}}
      return {fail:true};
    };
    const neonSpot=find('neon-purple');if(neonSpot.fail)return {error:'no neon spot'};
    const screenSpot=find('wall-screen',1.5);if(screenSpot.fail)return {error:'no screen spot',neonSpot};
    const neon=P.add('neon-purple',neonSpot);const screen=P.add('wall-screen',screenSpot);
    return {neon,screen,neonSpot,screenSpot,canNeon:P.canSpin(neon),canScreen:P.canSpin(screen),list:P.list().filter(i=>i.uid===neon||i.uid===screen)};
  });
  assert(placed.neon&&placed.screen,`${tag} place wall items `+JSON.stringify(placed));
  assert.equal(placed.canNeon,true,`${tag} neon can spin`);
  assert.equal(placed.canScreen,false,`${tag} screen stays upright`);
  assert.equal(placed.list.find(i=>i.uid===placed.neon).roll,0);

  // 90° spin keeps the wall facing, swaps to a taller box
  const spun=await p.evaluate(u=>{
    const P=__WK_WORKSHOP_PLACE__,before=P.list().find(i=>i.uid===u),obb0=P.check('neon-purple',before);
    const r=P.spin90(u,1),after=P.list().find(i=>i.uid===u);
    return {r,before,after,upright:P.spin90(P.list().find(i=>i.item==='wall-screen').uid,1)};
  },placed.neon);
  assert(spun.r.ok,`${tag} neon spin `+JSON.stringify(spun.r));
  assert(Math.abs(spun.after.roll-Math.PI/2)<1e-3,`${tag} roll 90 `+spun.after.roll);
  assert(Math.abs(spun.after.yaw-spun.before.yaw)<1e-3,`${tag} yaw (wall facing) must stay `+JSON.stringify(spun));
  assert.equal(spun.upright.ok,false,`${tag} screen spin blocked`);
  assert.equal(spun.upright.reason,'upright',`${tag} upright reason `+JSON.stringify(spun.upright));

  // back to horizontal, then drag up the wall
  await p.evaluate(u=>__WK_WORKSHOP_PLACE__.spin90(u,-1),placed.neon);
  await p.evaluate(u=>{const P=__WK_WORKSHOP_PLACE__;P.select(u,true);},placed.neon);
  await p.evaluate(lookAt,placed.neon);await p.waitForTimeout(200);
  const before=await p.evaluate(u=>__WK_WORKSHOP_PLACE__.list().find(i=>i.uid===u),placed.neon);
  const hit=await p.evaluate(screenOf,placed.neon);
  assert(hit.ok,`${tag} neon on screen `+JSON.stringify(hit));
  await p.mouse.move(hit.x,hit.y);await p.mouse.down();await p.mouse.move(hit.x,hit.y-70,{steps:12});await p.mouse.up();
  const afterDrag=await p.evaluate(u=>__WK_WORKSHOP_PLACE__.list().find(i=>i.uid===u),placed.neon);
  assert(afterDrag.y>before.y+.08,`${tag} drag up the wall `+JSON.stringify({before,afterDrag}));
  assert(Math.hypot(afterDrag.x-before.x,afterDrag.z-before.z)<.35,`${tag} stays on the same wall `+JSON.stringify({before,afterDrag}));
  const g1=await p.evaluate(ghost,placed.neon);
  assert(g1.vis,`${tag} ghost visible while editing`);
  assert(g1.ok===true||g1.col==='69ff98'||(g1.col||'').includes('69ff'),`${tag} free ghost is green `+JSON.stringify(g1));

  // red ghost when overlapping the screen: drag neon onto the screen if they're on the same wall, else use check
  const overlap=await p.evaluate(({neon,screen})=>{
    const P=__WK_WORKSHOP_PLACE__,s=P.list().find(i=>i.uid===screen);
    P.select(neon,true);const v=P.dragTo(s.x,s.z,s.y);
    const it=P.list().find(i=>i.uid===neon);
    let col=null,vis=false;__WK_VIEW__.scene.traverse(o=>{if(o.name==='workshop:placement-preview'&&o.visible){vis=true;const m=o.children[0]?.material;if(m?.color)col='#'+m.color.getHexString();}});
    P.cancel();
    return {ok:v?.ok,reason:v?.reason,col,vis,y:it.y};
  },placed);
  assert(overlap.ok===false,`${tag} overlap is blocked `+JSON.stringify(overlap));
  assert((overlap.col||'').includes('ff5a')||overlap.col==='#ff5a6e'||overlap.reason==='item',`${tag} overlap ghost red `+JSON.stringify(overlap));

  // animated spin arrows on neon, hidden on the upright screen
  await p.evaluate(u=>{__WK_WORKSHOP_PLACE__.select(u,true);},placed.neon);
  await p.evaluate(lookAt,placed.neon);
  await p.waitForFunction(()=>{for(const el of document.querySelectorAll('*'))if(el.wkGizmo?.state().visible&&el.wkGizmo.state().spin)return true;return false;},null,{timeout:8000});
  const a0=await p.evaluate(arrowSpin);await p.waitForTimeout(500);const a1=await p.evaluate(arrowSpin);
  assert(a0.length&&a1.some((v,i)=>Math.abs(v-a0[i])>1e-4),`${tag} spin arrows animate `+JSON.stringify([a0,a1]));
  const gz=await p.evaluate(()=>{for(const el of document.querySelectorAll('*'))if(el.wkGizmo?.state().visible)return el.wkGizmo.state();return null;});
  assert(gz.wall&&gz.spin,`${tag} wall gizmo `+JSON.stringify(gz));
  if(shots&&!vp.mobile)await p.screenshot({path:shots+'/wall-1-neon-spin.png'});
  if(shots&&vp.mobile)await p.screenshot({path:shots+'/wall-3-phone-neon.png'});

  await p.evaluate(u=>__WK_WORKSHOP_PLACE__.select(u,true),placed.screen);
  await p.evaluate(lookAt,placed.screen);await p.waitForTimeout(200);
  const gs=await p.evaluate(()=>{for(const el of document.querySelectorAll('*'))if(el.wkGizmo?.state().visible)return el.wkGizmo.state();return null;});
  assert(gs&&gs.wall&&!gs.spin,`${tag} upright item has no spin arrows `+JSON.stringify(gs));
  if(shots&&!vp.mobile)await p.screenshot({path:shots+'/wall-2-screen-upright.png'});

  await p.locator('#wk-place-mode [data-wk-place-exit]').click();
  await p.waitForFunction(()=>!__WK_WORKSHOP_PLACE__.placeMode.state().on,null,{timeout:10000});
  const back=await p.evaluate(camOf);
  assert.equal(back.fov,cam0.fov,`${tag} fov unchanged`);
  assert.equal(back.min,cam0.min,`${tag} min zoom unchanged`);
  assert.equal(back.max,cam0.max,`${tag} max zoom unchanged`);
  const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('wk-room-layout-v1')).rooms.workshop.items.filter(i=>i.item==='neon-purple'||i.item==='wall-screen'));
  assert(saved.some(i=>i.item==='neon-purple'&&(i.roll||0)===0),`${tag} neon saved `+JSON.stringify(saved));
  assert.deepEqual(errors,[]);await p.close();console.log('wall-spin',tag,'ok',JSON.stringify({neon:placed.neonSpot,screen:placed.screenSpot,dy:+(afterDrag.y-before.y).toFixed(2)}));
 }
}finally{await browser.close()}
