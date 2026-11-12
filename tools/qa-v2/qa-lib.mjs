// Wheelie King v2.0 independent QA: shared browser helpers. Read-only against the game.
import {chromium} from 'playwright';
export const BASE=(process.env.WK_TEST_URL||'https://wheelie-king-beta.pages.dev/').replace(/\/?(\?.*)?$/,'/');
export const GPU=process.env.WK_GPU==='1';
export function launch(){
  const args=GPU?[...(process.platform==='win32'?['--use-angle=d3d11']:['--use-gl=angle']),'--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']
    :['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
  return chromium.launch({channel:process.env.WK_BROWSER||'chrome',args,headless:true});
}
export const D=180/Math.PI;
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const r3=v=>typeof v==='number'?+v.toFixed(3):v;
export const round=o=>JSON.parse(JSON.stringify(o,(k,v)=>typeof v==='number'?+v.toFixed(3):v));

// Carry-over fixture: a brand-new catalogue entry (DATA ONLY) injected through the existing
// __WK_EXTRA_CATALOG__ data hook before boot. It clones an existing frame's data (so it reuses that
// frame's 3D model via the id "<base>__<suffix>" variant convention) and adds a ride block.
export function injectExtraCatalog(page,items){
  return page.addInitScript(items=>{
    let v=[];
    Object.defineProperty(globalThis,'__WK_EXTRA_CATALOG__',{configurable:true,get(){return [...items,...v]},set(x){v=x||[];}});
  },items);
}
export async function openPage(browser,{viewport={width:1280,height:720},mobile=false,video=null,level='arena',track='playground',sw='block',init=null,query=null}={}){
  const ctx=await browser.newContext({viewport,hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1,serviceWorkers:sw,
    ...(video?{recordVideo:{dir:video,size:viewport}}:{})});
  const p=await ctx.newPage();
  const log={errors:[],warnings:[],failed:[],html:[],requests:[]};
  p.on('pageerror',e=>log.errors.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error')log.errors.push('console: '+m.text());if(m.type()==='warning')log.warnings.push(m.text());});
  p.on('requestfailed',r=>log.failed.push(r.url()+' '+(r.failure()?.errorText||'')));
  p.on('response',async r=>{const u=r.url();log.requests.push(u);
    if(r.status()>=400)log.failed.push(r.status()+' '+u);
    const ct=r.headers()['content-type']||'';
    if(/\.(js|mjs|glb|gltf|bin|png|jpe?g|webp|ktx2|hdr|exr|wasm|json|css)(\?|$)/i.test(u)&&/text\/html/i.test(ct))log.html.push(u);});
  if(init)await init(p);
  await p.addInitScript(lv=>{if(lv)localStorage.setItem('wk-level',lv);else localStorage.removeItem('wk-level');},level);
  const q=[track?'track='+track:null,query].filter(Boolean).join('&');const url=BASE+(q?'?'+q:'');
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]')||globalThis.__WK_RIDE_STATE__?.()?.physicsReady,null,{timeout:180000});
  return {ctx,p,log};
}
export async function startRide(p,rideId){
  if(rideId)await p.evaluate(id=>globalThis.__WK_EQUIP__?.(id),rideId);
  await p.waitForTimeout(300);
  const race=p.getByRole('button',{name:'⚑ Race',exact:true});
  if(await race.isVisible().catch(()=>false))await race.click();else await p.getByRole('button',{name:/test ride/i}).first().click();
  await p.waitForFunction(()=>{const r=globalThis.__WK_RIDE_STATE__?.();return r&&r.physicsReady&&globalThis.__WK_TELEMETRY__;},null,{timeout:120000});
  await p.waitForTimeout(800);
  // Free ride (Playground) is tested in CHASE view only: side view is for tracks (no sideways steering).
  // The game boots into side view, so switch, wait for the camera swing, and fail the run if it isn't chase.
  if(await p.evaluate(()=>!!__WK_RIDE_STATE__().freeRoam)){const was=await camMode(p);await p.evaluate(()=>globalThis.__WK_SCENE_VIEW__?.('chase'));await p.waitForTimeout(1000);console.log('CAMERA boot='+was+' now='+await assertChase(p,'startRide'));}
}
export const camMode=p=>p.evaluate(()=>document.querySelector('[data-wk-cam]')?.dataset.wkCam||null);
export async function assertChase(p,where){const st=await p.evaluate(()=>({free:!!__WK_RIDE_STATE__?.()?.freeRoam,cam:document.querySelector('[data-wk-cam]')?.dataset.wkCam||null}));
  if(st.free&&st.cam!=='chase')throw new Error(`CAMERA NOT CHASE at ${where}: ${st.cam}`);return st.cam;}
export const tel=p=>p.evaluate(()=>globalThis.__WK_TELEMETRY__());
// In-page sampler: every rAF pushes a compact telemetry row.
export async function rec(p,on=true){
  if(on)return p.evaluate(()=>{globalThis.__QA_ROWS__=[];const loop=()=>{if(!globalThis.__QA_REC__)return;try{const t=__WK_TELEMETRY__();const st=__WK_RIDE_STATE__();
    __QA_ROWS__.push({t:t.t,v:t.speedMs,pitch:t.pitchDeg,roll:t.rollDeg,yaw:t.yawDeg,yawRate:t.yawRate,x:t.x,y:t.y,z:t.z,ground:t.ground,om:t.wheelOmega,slip:t.wheelSlipRatio,comp:t.suspensionComp,
      trick:t.trick,input:t.input,mode:t.driver?.mode,squat:st.visual?.squat,dive:st.visual?.dive,smoke:st.visual?.smoke,rewinding:st.rewinding,crashed:!!st.s.crashed,rider:st.rider?{...st.rider,joints:undefined}:null});}catch(e){__QA_ROWS__.push({err:String(e)})}requestAnimationFrame(loop)};
    globalThis.__QA_REC__=true;requestAnimationFrame(loop);});
  return p.evaluate(()=>{globalThis.__QA_REC__=false;const r=globalThis.__QA_ROWS__||[];const t0=r[0]?.t||0;for(const x of r)x.t=(x.t-t0)/1000;return r;});
}
export async function reset(p,pose={x:0,z:0,yaw:0,vx:0}){
  const rc=p.locator('[data-r=recover]');if(await rc.isVisible().catch(()=>false)){await rc.click().catch(()=>{});await p.waitForTimeout(500);}
  const tg=await p.evaluate(()=>__WK_TELEMETRY__().trick.toggles);if(tg.mono)await p.keyboard.press('Control');if(tg.stand)await p.keyboard.press('g');if(tg.burnout)await p.keyboard.press('b');
  await p.evaluate(()=>{if(__WK_RIDE_STATE__().tricksOpen)document.querySelector('[data-r=tricks]')?.click();});
  await p.evaluate(pose=>{__WK_RIDE_HOLD__({throttle:0,brake:0,steer:0,lean:0,clearKeys:true});return __WK_JOLT_RESET__({pitch:0,vy:0,w:0,...pose})},pose);
  await p.waitForTimeout(700);await assertChase(p,'reset');
}
export const hold=(p,patch)=>p.evaluate(x=>__WK_RIDE_HOLD__(x),patch);
