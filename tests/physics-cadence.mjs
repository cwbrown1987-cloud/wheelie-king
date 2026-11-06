import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';
import {bikeParams,makeState,makeFlatTerrain,step} from '../ride-physics.js';
const terrain=makeFlatTerrain(),p=bikeParams({P:7500,nm:140,kg:68,travel:.12,shock:.06});
function simulate(hz,kind){const s=makeState(p,2,terrain);if(kind==='landing'){s.y+=1;s.vy=-3;s.pitch=.2;}
 for(let frame=0;frame<hz*3&&!s.crashed;frame++){const dt=1/hz,n=Math.ceil(dt*480),throttle=kind==='drive'&&frame<hz*2?1:0,brake=kind==='drive'&&frame>=hz*2?1:0;for(let i=0;i<n&&!s.crashed;i++)step(s,p,{throttle,brake,lean:0},dt/n,terrain);}return s;}
const report=[];for(const kind of ['drive','landing']){const reference=simulate(480,kind);for(const hz of [30,60,90,120,144]){const s=simulate(hz,kind),error={x:Math.abs(s.x-reference.x),speed:Math.abs(s.vx-reference.vx),pitch:Math.abs(s.pitch-reference.pitch)};assert.equal(s.crashed,reference.crashed);assert(error.x<.2&&error.speed<.2&&error.pitch<.05,JSON.stringify({kind,hz,error}));report.push({kind,hz,error});}}
mkdirSync('test-results',{recursive:true});writeFileSync('test-results/physics-cadence.json',JSON.stringify(report,null,2));console.log('PASS existing adaptive substeps at 30–144 Hz versus 480 Hz drive/brake/landing reference; no timing rewrite');
