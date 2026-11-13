// Custom-physics arcade modes. No browser required; run: node tests/arcade-classic.mjs
import assert from 'node:assert/strict';
import {createArcadeAssistant,classifyRide,predictRideLanding} from '../ride-arcade-assist.js';
import {makeState,bikeParams,step} from '../ride-physics.js';

const flat={h:()=>0,height:()=>0,slope:()=>0,slopeAt:()=>0,freeRoam:true,playground:true,
  loops:[],posts:[],boxes:[],bounds:{xmin:-2500,xmax:2500,zmin:-2500,zmax:2500},
  transition:()=>false};
const bike=bikeParams({kg:55,P:3000,nm:150,wb:1.25,wheelR:.33,travel:.15,shock:.15});
const input={throttle:.6,brake:0,lean:0,steer:0};
const fresh=()=>makeState(bike,0,flat);
const isFiniteBike=s=>['x','y','z','yaw','vx','vy','pitch','w'].every(key=>Number.isFinite(s[key]));

assert.equal(classifyRide({ground:[true,true]}),'GROUND');
assert.equal(classifyRide({ground:[true,false]}),'WHEELIE');
assert.equal(classifyRide({ground:[false,true]}),'STOPPIE');
assert.equal(classifyRide({ground:[true,true],sliding:true}),'DRIFT');
assert.equal(classifyRide({ground:[false,false]}),'AIR');
assert.equal(classifyRide({crashed:'CRASH'}),'CRASH');

const original=createArcadeAssistant();
assert.strictEqual(original.update(fresh(),bike,input,1/480,flat),input,'original passes the same input object');
const tune=createArcadeAssistant({mode:'arcade'});
assert.equal(tune.getMode(),'arcade');
tune.setSetting('air',.62);assert.equal(tune.getMode(),'custom');
assert.equal(tune.getSettings().air,.62);
assert.equal(tune.setMode('invalid'),false);
tune.setMode('original');assert.strictEqual(tune.update(fresh(),bike,input,1/480,flat),input);

const descent={...fresh(),y:2,vy:-3,vx:6,ground:[false,false]};
const downhill={...flat,slopeAt:()=>-.2};
const pred=predictRideLanding(descent,bike,downhill);
assert(pred&&pred.time>.1&&pred.time<.5,'terrain-aware landing estimate');
assert.equal(pred.pitch,-.2);
const landing=createArcadeAssistant({mode:'arcade'});
const landHint=landing.update(descent,bike,{...input,lean:0},1/60,downhill).arcade;
assert.equal(landing.snapshot().state,'LANDING');
assert(landHint.landingStrength>0,'hands-off predictive landing correction');
const noAssist=landing.update(descent,bike,{...input,lean:.9},1/60,downhill).arcade;
assert.equal(noAssist.landingStrength,0,'intentional trick rotation not corrected');

function simulate(mode,{air=false,steps=1440,turn=true}={}){
  const s=fresh(),ctrl=createArcadeAssistant({mode});
  if(air)Object.assign(s,{y:4,vy:0,vx:6,ground:[false,false],wasAir:true});
  for(let i=0;i<steps&&!s.crashed;i++){
    const t=i/480;
    const keys=air?{throttle:0,brake:0,lean:.5,steer:0}:
      {throttle:s.vx<5?1:0,brake:0,lean:0,steer:turn&&t>1?.7:0};
    step(s,bike,ctrl.update(s,bike,keys,1/480,flat),1/480,flat);
    assert(isFiniteBike(s),mode+' nonfinite bike state at '+i);
  }
  return s;
}
const unassisted=simulate('original'),balanced=simulate('balanced'),arcade=simulate('arcade');
for(const [name,s] of [['original',unassisted],['balanced',balanced],['arcade',arcade]]){
  assert.equal(s.crashed,null,name+' level-ground steering must stay upright');
}
assert(Math.abs(arcade.yaw-unassisted.yaw)>.008,'assist modes alter steer response');
const air0=simulate('original',{air:true,steps:120,turn:false});
const air1=simulate('arcade',{air:true,steps:120,turn:false});
assert.equal(air0.crashed,null);assert.equal(air1.crashed,null);
assert(air1.pitch>air0.pitch+.03,'arcade pitch responds more to intentional airborne lean');

console.log('PASS: custom arcade classification, exact Original fallback, landing prediction, trick suppression, bike steering, and air control');
