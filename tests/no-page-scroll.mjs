// No game screen may scroll the document. Only long lists inside a panel may scroll.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';

const base=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
const uas={
  ios:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  android:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
};
const views=[
  {name:'phone',width:844,height:390},
  {name:'tablet',width:1024,height:658}
];

function metrics(){
  const r=document.documentElement;
  return {
    y:window.scrollY, x:window.scrollX,
    sh:r.scrollHeight, sw:r.scrollWidth,
    ih:window.innerHeight, iw:window.innerWidth,
    vh:window.visualViewport?.height||window.innerHeight,
    vw:window.visualViewport?.width||window.innerWidth,
    html:{
      overflow:getComputedStyle(r).overflow,
      overscroll:getComputedStyle(r).overscrollBehavior,
      position:getComputedStyle(r).position,
      height:getComputedStyle(r).height
    },
    body:{
      overflow:getComputedStyle(document.body).overflow,
      overscroll:getComputedStyle(document.body).overscrollBehavior,
      position:getComputedStyle(document.body).position
    },
    root:{
      position:getComputedStyle(document.getElementById('root')).position,
      overflow:getComputedStyle(document.getElementById('root')).overflow
    }
  };
}

async function tryPageScroll(page,sel){
  await page.evaluate(()=>{window.scrollTo(0,80);window.scrollTo(40,80);});
  const box=await page.locator(sel).first().boundingBox();
  if(box){
    const cdp=await page.context().newCDPSession(page);
    const x=box.x+box.width/2, y=box.y+Math.min(box.height*0.55, box.height-10);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x,y}]});
    for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x,y:y-i*18}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.mouse.move(x,y);
    await page.mouse.wheel(0,600);
    await page.waitForTimeout(80);
  }
  return page.evaluate(metrics);
}

async function swipePanel(page,sel){
  const loc=page.locator(sel).first();
  if(!(await loc.count()))return null;
  const box=await loc.boundingBox();
  if(!box)return null;
  const max=await loc.evaluate(e=>e.scrollHeight-e.clientHeight);
  if(max<=4)return {max,skipped:true};
  await loc.evaluate(e=>{e.scrollTop=0});
  const cdp=await page.context().newCDPSession(page);
  const x=box.x+box.width/2, y0=Math.min(box.y+box.height-20, box.y+box.height*0.85), y1=Math.max(box.y+20,y0-140);
  const before=await loc.evaluate(e=>e.scrollTop);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:2,x,y:y0}]});
  for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:2,x,y:y0+(y1-y0)*i/10}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(300);
  const after=await loc.evaluate(e=>e.scrollTop);
  return {before,after,max};
}

function assertLocked(label,m){
  assert.equal(m.y,0,label+' scrollY must stay 0, got '+m.y);
  assert.equal(m.x,0,label+' scrollX must stay 0, got '+m.x);
  assert(m.sh<=m.ih+2,label+' document height must not exceed the viewport '+JSON.stringify(m));
  assert(m.sw<=m.iw+2,label+' document width must not exceed the viewport '+JSON.stringify(m));
  assert.equal(m.html.overflow,'hidden',label+' html overflow');
  assert.match(m.html.overscroll,/none/,label+' html overscroll');
  assert.equal(m.html.position,'fixed',label+' html position');
  assert.equal(m.body.overflow,'hidden',label+' body overflow');
  assert.equal(m.root.position,'fixed',label+' #root position');
}

const browser=await launchBrowser();
const report={};
try{
  for(const [uaName,ua] of Object.entries(uas)){
    for(const view of views){
      const key=uaName+'-'+view.name;
      const p=await browser.newPage(pageOptions({
        viewport:{width:view.width,height:view.height},
        hasTouch:true,isMobile:true,deviceScaleFactor:2,serviceWorkers:'block',userAgent:ua
      }));
      const errors=[];p.on('pageerror',e=>errors.push(e.message));
      await p.goto(base,{waitUntil:'domcontentloaded'});
      await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});

      const workshop=await tryPageScroll(p,'[data-scene],canvas,#root');
      assertLocked(key+' workshop',workshop);

      const garageBtn=p.getByRole('button',{name:'⌂ Garage',exact:true});
      if(await garageBtn.count()){
        await garageBtn.click();
        await p.waitForTimeout(400);
      }
      const garage=await tryPageScroll(p,'#root,canvas');
      assertLocked(key+' garage',garage);

      const shopBtn=p.getByRole('button',{name:'🛒 Shop',exact:true});
      if(await shopBtn.count()){
        await shopBtn.click();
        await p.waitForTimeout(400);
      }
      const shop=await tryPageScroll(p,'#root,canvas,#wk-lounge');
      assertLocked(key+' shop',shop);
      const shopList=await swipePanel(p,'.store-side,[data-gear-grid]');
      if(shopList&&!shopList.skipped)assert(shopList.after>shopList.before,'shop list should scroll inside its panel '+JSON.stringify(shopList));
      const shopAfter=await p.evaluate(metrics);
      assertLocked(key+' shop after list swipe',shopAfter);

      await p.locator('[data-wk-nav="race"],[data-destination="race"]').first().tap().catch(()=>p.locator('[data-destination="race"]').first().click());
      await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.backdropLoaded,null,{timeout:90000});
      const ride=await tryPageScroll(p,'[data-wk-ride-surface],canvas,#root');
      assertLocked(key+' ride',ride);

      await p.evaluate(()=>dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})));
      await p.locator('.ride-pause-menu').waitFor({state:'visible',timeout:8000});
      const menu=await tryPageScroll(p,'#root');
      assertLocked(key+' menus',menu);
      const pauseSwipe=await swipePanel(p,'.ride-pause-menu');
      if(pauseSwipe&&!pauseSwipe.skipped)assert(pauseSwipe.after>pauseSwipe.before,'pause menu should scroll inside itself '+JSON.stringify(pauseSwipe));
      const menuAfter=await p.evaluate(metrics);
      assertLocked(key+' menus after panel swipe',menuAfter);

      assert.deepEqual(errors,[]);
      report[key]={workshop,garage,shop,shopList,ride,pauseSwipe};
      await p.close();
    }
  }
  console.log(JSON.stringify({noPageScroll:true,keys:Object.keys(report)}));
}finally{await browser.close()}
