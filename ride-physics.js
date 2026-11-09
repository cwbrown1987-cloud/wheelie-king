import { stepLoop } from './ride-loop.js';
import {roundedProfile} from './terrain-profile.js';
// Wheelie King ride physics (v15). Pure 2D side-on rigid-body bike, no DOM/three — reusable for the later 3D mode.
// Units: metres, kg, seconds. x forward, y up. pitch: + = nose up (wheelie).
export function makeTerrain(seed = 1) {
  // polyline points [x, y, tag]; tags mark kickers, gaps, puddles and checkpoints
  let r = seed; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const pts = [[-30, 0], [0, 0], [30, 0]]; const puddles = [], checkpoints = [0], kickers = [];
  let x = 30, y = 0;
  const add = (dx, dy) => { x += dx; y += dy; pts.push([x, y]); };
  // A smooth downhill approach and flat runout feed the Trials loop.
  checkpoints.push(x - 3);
  add(28, -12);
  add(5, 0);
  const loop = { x, y, radius: 2.4, exitOffset: 2, minSpeed: 9 };
  add(10, 0);
  checkpoints.push(x - 1);
  const section = (i) => {
    const t = i % 6;
    if (t === 0) { for (let k = 0; k < 6; k++) add(6, (rnd() - 0.5) * 2.2); }                                  // rolling hills
    else if (t === 1) { add(8, 0); kickers.push(x); add(4, 1.4); add(3, -1.4); add(10, -0.3); add(10, 0); } // kicker
    else if (t === 2) { add(6, 0); add(5, 2.2); const g0 = x; add(3, -3.2); add(6, 0); add(3, 1.0); add(7, 0.4); kickers.push(g0); add(8, -0.4); } // gap
    else if (t === 3) { add(6, 0); puddles.push([x, x + 6]); add(6, 0); add(6, 0.2); }                          // puddle
    else if (t === 4) { for (let k = 0; k < 4; k++) { add(5, 1.6); add(5, -1.6); } }                           // whoops
    else { add(10, 3); add(6, 0.2); add(12, -3.2); add(6, 0); }                                                 // big step-down
    if (i % 2 === 1) checkpoints.push(x);
  };
  for (let i = 0; i < 14; i++) section(i);
  add(20, 0); const finish = x; add(60, 0);
  const {pts:rounded,h,slope}=roundedProfile(pts);
  const inPuddle = (qx) => puddles.some(([a, b]) => qx >= a && qx <= b);
  return { pts:rounded, h, slope, puddles, checkpoints, kickers, finish, inPuddle, loop };
}
export function makeFlatTerrain(){return {pts:[[-200,0],[200,0]],h:()=>0,slope:()=>0,puddles:[],checkpoints:[0],kickers:[],finish:Infinity,inPuddle:()=>false};}
export function bikeParams(stats = {}) {
  const motorW=Math.max(0,stats.P??0),pedal=stats.powertrain?stats.powertrain==='human':motorW<200;
  return {
    mass: (stats.kg || 15) + 75, wb: stats.wb || 1.0, comBack: stats.comBack || 0.42, comH: stats.comH || 0.95,
    R: stats.wheelR || 0.3, power: pedal ? 250 : motorW, torque: pedal ? 40 : Math.max(0,stats.nm??60), pedal, powertrain:stats.powertrain||(pedal?'human':'electric'),
    vmax: pedal ? 8 : Math.min(40, 6 + Math.sqrt(motorW) * 0.35),
    travelF: Math.max(0, stats.travel ?? 0), travelR: Math.max(0, stats.shock ?? 0), damp: stats.damp ?? 0.3, grip: stats.grip || 1,
    batteryWh: stats.batteryWh || 0,driveAxle:stats.driveAxle||'rear' };
}
export function makeState(p, x = 2, ter) {
  // Spawn/recover with both round tyres clear of the sampled surface. A fixed
  // fraction of COM height started small-wheel scooters inside the road.
  const rear=-p.wb*p.comBack,front=p.wb*(1-p.comBack),h=p.comH-p.R;
  const pitch=Math.atan2(ter.h(x+front)-ter.h(x+rear),p.wb),c=Math.cos(pitch),s=Math.sin(pitch);
  const y=Math.max(...[rear,front].map(dx=>wheelContact(ter,x+dx*c+h*s,p.R).height-(dx*s-h*c)))+.012;
  return { x, y, vx: 0, vy: 0, pitch, w: 0, comp: [0, 0], ground: [false, false], air: 0, airRot: 0, wasAir: false, crashed: null, wheelieT: 0, stoppieT: 0, score: 0, trick: "", trickT: 0,
    spin: 0, spinV: 0, wear: {}, events: [], battery: 1, odo: 0, wheelSpin: [0, 0] }; }
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
// Sample the tyre footprint so sharp ledges meet the round tyre before its
// axle crosses them. Using only ground directly under the axle caused popping
// and sinking at near-vertical ramp joins.
function wheelContact(ter,x,r){
  let height=ter.h(x)+r,angle=ter.slope(x);
  const offsets=[Math.sin(angle),-.98,-.8,-.5,0,.5,.8,.98];
  for(const ratio of offsets){const dx=r*ratio,dy=r*Math.sqrt(Math.max(0,1-ratio*ratio)),y=ter.h(x+dx)+dy;if(y>height+1e-7){height=y;angle=Math.asin(ratio)}}
  return {height,angle};
}
const balanceTorque=(lean,rel,throttle,brake,w)=>lean*(lean>0?12:8)+(rel-1.46)*8+throttle*1.2-(1-throttle)*2.2-brake*12-w*3.2;
export function step(s, p, inp, dt, ter) {
  if (s.crashed) return s;
  if (ter.loop && stepLoop(s, p, inp, dt, ter.loop)) return s;
  const startPitch=s.pitch,startW=s.w;
  const I = p.mass * 0.32, hC = p.comH - p.R,driven=p.driveAxle==='front'?1:0; // pitch inertia, COM height above axles
  const wl = [[-p.wb * p.comBack, -hC], [p.wb * (1 - p.comBack), -hC]], travel = [p.travelR, p.travelF];
  const k = (i) => p.mass * 9.8 / 2 / Math.max(travel[i] * 0.35, 0.012), c = (i) => 2 * (0.25 + p.damp) * Math.sqrt(k(i) * p.mass / 2);
  let Fx = 0, Fy = -9.8 * p.mass, T = 0, impactV = 0; const N = [0, 0];
  // Match the rendered fork axis / swingarm arc, including the bike and road
  // angles. A fixed vertical travel value made tyres cut into sloping landings.
  const lift=(i,compression)=>{let dx=0,dy=travel[i]*.8*compression;if(i){dx=(p.forkAxis?.[0]||0)*dy;dy*=p.forkAxis?.[1]??p.forkVertical??1;}else if(p.rearLink){const [x,y]=p.rearLink,L2=x*x+y*y;dx=Math.sign(x)*Math.sqrt(Math.max(0,L2-(y+dy)**2))-x;}const c=Math.cos(s.pitch),n=Math.sin(s.pitch),wx=s.x+rot(wl[i][0],wl[i][1],s.pitch)[0],grade=Math.tan(ter.slope(wx));return dx*n+dy*c-grade*(dx*c-dy*n);};
  const maxDeflection=i=>Math.max(.004,lift(i,1));
  const compression=(i,depth)=>{if(depth<=0||lift(i,1)<=.004)return 0;if(i||!p.rearLink)return Math.min(1,depth/maxDeflection(i));let lo=0,hi=1;for(let n=0;n<9;n++){const mid=(lo+hi)/2;if(lift(i,mid)<depth)lo=mid;else hi=mid}return (lo+hi)/2;};
  s.thr = (s.thr || 0) + Math.max(-dt * 6, Math.min(dt * 2.5, (inp.throttle || 0) - (s.thr || 0))); // throttle ramps like a real twist grip
  // A fresh pedal press gives a short, non-stacking effort burst. Holding still climbs.
  const pedalPress=inp.throttle>0;if(p.pedal&&pedalPress&&!s.pedalHeld&&(s.pedalTapCooldown||0)<=0){s.pedalEffort=.8;s.pedalTapCooldown=.18;}s.pedalHeld=pedalPress;s.pedalEffort=Math.max(0,(s.pedalEffort||0)-dt);s.pedalTapCooldown=Math.max(0,(s.pedalTapCooldown||0)-dt);
  s.reverseHold=inp.brake>0&&!inp.throttle?(s.reverseHold||0)+dt:0;
  s.reversing=s.reverseHold>.4&&s.vx<.25&&inp.lean>=-.2;s.burnout=false;
  s.ground = [false, false];
  for (let i = 0; i < 2; i++) {
    const [ox, oy] = rot(wl[i][0], wl[i][1], s.pitch), wx = s.x + ox, wy = s.y + oy, contact=wheelContact(ter,wx,p.R), d = contact.height - wy;
    if (d > 0) { s.ground[i] = true; const a = contact.angle, nx = -Math.sin(a), ny = Math.cos(a),vn=(s.vx-s.w*oy)*nx+(s.vy+s.w*ox)*ny;
      impactV=Math.min(impactV,vn);
      // Suspension supplies spring force; a contact impulse handles bottom-out.
      // An arbitrarily stiff extra spring used to sink, then launch the bike.
      let f = k(i) * Math.min(d, maxDeflection(i)) - c(i) * vn;
      if(d>maxDeflection(i)&&vn<-5.5+travel[i]*10)s.events.push({type:'bottom',i});
      f = Math.max(0, f); N[i] = f; s.comp[i] = compression(i,d);
      Fx += f * nx; Fy += f * ny; T += ox * f * ny - (oy - 0) * f * nx; // r x F (z)
      const tx = Math.cos(a), ty = Math.sin(a), vt = s.vx * tx + s.vy * ty;
      let ft = -vt * 2.2 * (i ? 1 : 1); // rolling resistance
      if (i === driven && (inp.throttle > 0 || (p.pedal&&s.pedalEffort>0)) && s.battery > 0) { const v = Math.max(Math.abs(vt), 1.2); const effort=p.pedal?Math.min(1,(s.pedalEffort||0)/.35):0; let drive = Math.min(p.torque * 4*(1+effort), p.power*(1+effort*.65) / v, p.mass * 9.8 * 0.4 * p.grip) * (p.pedal?Math.max(s.thr||0,effort*.85):(s.thr || 0)); if(p.pedal)drive+=Math.max(0,Math.sin(a))*p.mass*9.8*.95*Math.max(0,1-Math.max(0,vt-2)/3)*Math.max(s.thr||0,effort); { const rel0 = s.pitch - a; if (rel0 > 0.6 && !(inp.lean > 0)) drive *= Math.max(0.15, 1 - (rel0 - 0.6) * 3 - Math.max(0, s.w) * 0.25); } /* rider feathers the throttle at the balance point unless leaning back */ const speedLimit=p.vmax+(p.pedal?effort*.6:0); if (vt > speedLimit) drive *= Math.max(0, 1 - (vt - speedLimit)* (p.pedal?5:1)); drive = Math.min(drive, f * 1.15 * p.grip + 80);s.burnout=!p.pedal&&inp.brake>0&&Math.abs(s.vx)<3;ft+=s.burnout?0:drive; }
      if (inp.brake > 0&&!s.reversing) { const bias = i === 1 ? 0.45 + 0.45 * Math.max(0, -inp.lean) : 0.55 - 0.3 * Math.max(0, -inp.lean); ft -= Math.sign(vt) * Math.min(f * 0.9 * p.grip, p.mass * 9 * bias) * inp.brake * Math.min(1, Math.abs(vt) * 2); }
      if(i===driven&&s.reversing)ft-=Math.min(p.mass*1.4,p.torque*2,Math.max(40,f*.7))*inp.brake*Math.max(0,1-Math.max(0,-vt-2.5)*2);
      Fx += ft * tx; Fy += ft * ty; const rx = ox - nx * p.R, ry = oy - ny * p.R; T += rx * ft * ty - ry * ft * tx;
    } else s.comp[i] = Math.max(0, s.comp[i] - dt * 6);
  }
  let onG = s.ground[0] || s.ground[1];
  Fx -= 0.32 * s.vx * Math.abs(s.vx);
  if(s.burnout)Fx-=s.vx*p.mass*12;
  // Air control tapers near 9 rad/s; modest damping preserves takeoff momentum.
  if(onG)T+=inp.lean*p.mass*2.8;else s.w+=inp.lean*11*dt*Math.max(0,1-Math.max(0,Math.sign(inp.lean)*s.w-6)/3);
  // Arcade balance: slow the response near vertical, but leave an unstable
  // balance point. Lean/throttle raise the front; brake/forward lean recover it.
  if(s.ground[0]&&!s.ground[1]){const rel=wrapAngle(s.pitch-ter.slope(s.x));if(rel>.12)T=p.mass*balanceTorque(inp.lean||0,rel,s.thr||0,inp.brake||0,s.w);}
  if(s.ground[1]&&!s.ground[0]&&inp.brake>0&&inp.lean<0){const rel=wrapAngle(s.pitch-ter.slope(s.x));if(rel<-.35)T=(-.75+.35*inp.lean-rel)*p.mass*22-s.w*p.mass*3.5;}
  s.vx += Fx / p.mass * dt; s.vy += Fy / p.mass * dt; s.w += T / I * dt; s.w *= onG ? 0.993 : Math.exp(-.22*dt);
  s.x += s.vx * dt; s.y += s.vy * dt; s.pitch += s.w * dt; s.odo += Math.abs(s.vx) * dt;
  // Hard travel stops prevent tunnelling. Cancel only velocity INTO the
  // contact, including the wheel's angular velocity; do not add bounce energy.
  for(let i=0;i<2;i++){
    const [ox,oy]=rot(wl[i][0],wl[i][1],s.pitch),wx=s.x+ox,contact=wheelContact(ter,wx,p.R),d=contact.height-(s.y+oy),limit=maxDeflection(i);
    if(d>limit){
      s.y+=d-limit;s.ground[i]=true;
      const a=contact.angle,nx=-Math.sin(a),ny=Math.cos(a),vn=(s.vx-s.w*oy)*nx+(s.vy+s.w*ox)*ny,lever=ox*ny-oy*nx;
      impactV=Math.min(impactV,vn);
      if(vn<0){const impulse=-vn/(1/p.mass+lever*lever/I);s.vx+=impulse*nx/p.mass;s.vy+=impulse*ny/p.mass;s.w+=impulse*lever/I;}
    }
  }
  // Rear-wheel pivot: contact impulses must not undo the rider's recovery torque.
  // Project velocity onto contact instead of assigning vy=tan(slope)*vx,
  // which injects translational energy as the road steepens.
  // Only constrain a loaded rear tyre. Positive separating speed over a crest
  // must retain momentum rather than snapping the wheel back onto the road.
  const rearOffset=rot(wl[0][0],wl[0][1],s.pitch),rearAngle=wheelContact(ter,s.x+rearOffset[0],p.R).angle;
  const rearSeparating=-(s.vx-s.w*rearOffset[1])*Math.sin(rearAngle)+(s.vy+s.w*rearOffset[0])*Math.cos(rearAngle);
  if(s.ground[0]&&N[0]>0&&rearSeparating<.2&&((!s.ground[1]&&wrapAngle(startPitch-ter.slope(s.x))>.12)||(inp.lean>.35&&inp.throttle>0&&s.vx>.6))){
    const rel=wrapAngle(startPitch-ter.slope(s.x)),throttle=s.thr||0,acc=balanceTorque(inp.lean||0,rel,throttle,inp.brake||0,startW)/.32;
    const old=rot(wl[0][0],wl[0][1],s.pitch);s.w=Math.max(-1.8,startW+acc*dt);s.pitch=startPitch+s.w*dt;const next=rot(wl[0][0],wl[0][1],s.pitch);s.x+=old[0]-next[0];const contact=wheelContact(ter,s.x+next[0],p.R);s.y=contact.height-next[1]-.003;const nx=-Math.sin(contact.angle),ny=Math.cos(contact.angle),vn=(s.vx-s.w*next[1])*nx+(s.vy+s.w*next[0])*ny;s.vx-=vn*nx;s.vy-=vn*ny;
  }
  for(let i=0;i<2;i++){const [ox,oy]=rot(wl[i][0],wl[i][1],s.pitch),depth=wheelContact(ter,s.x+ox,p.R).height-(s.y+oy);s.comp[i]=compression(i,depth);}
  onG=s.ground[0]||s.ground[1];
  for (let i = 0; i < 2; i++) s.wheelSpin[i] += s.vx / p.R * dt;
  if(s.burnout)s.wheelSpin[driven]+=Math.min(18,4+p.power/1500)/p.R*dt;
  if (inp.throttle > 0 && s.ground[driven] && !p.pedal) s.battery = Math.max(0, s.battery - inp.throttle * p.power * dt / 3600 / (p.energyType?Math.max(.000001,p.batteryWh):Math.max(50,p.batteryWh)));
  // tricks & scoring
  if (s.trickT > 0) s.trickT -= dt;
  if (s.spinV) { s.spin += s.spinV * dt; if (Math.abs(s.spin) >= Math.PI * 2) { s.spin = 0; s.spinV = 0; s.pendingSpin = (s.pendingSpin || 0) + 1; } }
  const pop = (t, pts) => { s.trick = t; s.trickT = 1.6; s.score += pts; s.events.push({ type: "trick", t, pts }); };
  if (!onG) { s.air += dt; s.airRot += s.w * dt; }
  else if (s.wasAir) {
    const rearX=s.x+rot(wl[0][0],wl[0][1],s.pitch)[0],frontX=s.x+rot(wl[1][0],wl[1][1],s.pitch)[0];
    const a=s.ground[0]&&s.ground[1]?Math.atan2(ter.h(frontX)-ter.h(rearX),frontX-rearX):ter.slope(s.ground[0]?rearX:frontX);
    const offset=wrapAngle(s.pitch-a),off=Math.abs(offset),tol=(offset>=0?2.05:1.15)+Math.min(.15,p.travelF*.6);
    if (s.air>.08&&s.spinV) return crash(s, "LANDED MID-SPIN", "bars");
    if (s.air>.08&&off > tol) return crash(s, `BAD LANDING (${Math.round(off * 57)}° OFF)`, "suspension");
    const flips = Math.round(s.airRot / (2 * Math.PI)); let pts = Math.round(s.air * 120), name = "";
    if (flips >= 1) { pts += 800 * flips; name = (flips > 1 ? flips + "x " : "") + "BACKFLIP"; } else if (flips <= -1) { pts += 1000 * -flips; name = (flips < -1 ? -flips + "x " : "") + "FRONTFLIP"; }
    if (s.pendingSpin) { pts += 500 * s.pendingSpin; name = (name ? name + " + " : "") + (s.pendingSpin > 1 ? s.pendingSpin * 360 : 360); s.pendingSpin = 0; }
    if (s.whip) { pts += 250; name = (name ? name + " + " : "") + "180 WHIP"; s.whip = 0; }
    if(s.stunt){if(s.stunt.elapsed/s.stunt.duration>.65)(s.pendingStunts??=[]).push(s.stunt.name);s.stunt=null;}
    for(const stunt of s.pendingStunts||[]){pts+=({tailwhip:400,barspin:300,superman:350})[stunt];name+=(name?' + ':'')+stunt.toUpperCase();}s.pendingStunts=[];
    if (s.air > 0.45 || name) { if (off < 0.15) { pts += 150; name = (name || "AIR " + s.air.toFixed(1) + "s") + " · PERFECT"; } pop(name || "AIR " + s.air.toFixed(1) + "s", pts); }
    if(s.air>.08)s.events.push({ type: "land", v: impactV, air: s.air }); s.pitch=wrapAngle(s.pitch);s.air=0;s.airRot=0;
  }
  // ground balance tricks — scale by forward speed so a near-stationary manual earns little.
  // Driven distance adds a modest provisional score (landed/finish still owns the payout).
  const rel = wrapAngle(s.pitch - ter.slope(s.x));
  const speedFactor = Math.min(1, Math.max(0.12, Math.abs(s.vx) / 6));
  const driving = inp.throttle > 0 && s.vx > 0.2 && s.ground[driven] && (p.pedal || s.battery > 0);
  if (driving) s.score += 4 * s.vx * dt;
  if (s.ground[0] && !s.ground[1] && rel > 0.12) { s.wheelieT += dt; s.score += (inp.throttle > 0 ? 70 : 100) * speedFactor * dt; s.balance = inp.throttle > 0 ? "WHEELIE" : "MANUAL"; }
  else if (s.ground[1] && !s.ground[0] && rel < -0.1) { s.stoppieT += dt; s.score += (inp.brake > 0 ? 120 : 140) * speedFactor * dt; s.balance = inp.brake > 0 ? "STOPPIE" : "NOSE MANUAL"; }
  else { if (s.balance && (s.wheelieT > 1 || s.stoppieT > 0.6)) pop(`${s.balance} ${(s.balance.includes("WHEEL") || s.balance === "MANUAL" ? s.wheelieT : s.stoppieT).toFixed(1)}s`, 0); s.balance = ""; if (onG && s.ground[0] && s.ground[1]) { s.bestWheelie = Math.max(s.bestWheelie || 0, s.wheelieT); s.wheelieT = 0; s.stoppieT = 0; } }
  if(s.ground[1]&&!s.ground[0]&&rel< -1.15&&rel> -1.5&&inp.brake>0&&inp.lean<0){s.pitch=ter.slope(s.x)-1.15;s.w=Math.max(0,s.w);}
  if (onG && (rel > 2.4)) return crash(s, "LOOPED OUT", "fender_r");
  if (onG && (rel < -1.5)) return crash(s, "OVER THE BARS", "fender_f");
  // rear fender / tail scrape when the mono is too deep
  const [tx, ty] = rot(-p.wb * p.comBack - p.R * 0.95, -hC + p.R * 0.55, s.pitch);
  const scrapeDepth=ter.h(s.x+tx)-(s.y+ty);
  if(scrapeDepth>0&&rel>.8&&rel<2.2){
    s.events.push({type:'scrape',x:s.x+tx,y:ter.h(s.x+tx)});s.wear.fender_r=(s.wear.fender_r||0)+dt*.35;s.score+=40*dt;
    // A scrape is a glancing skid, not an invisible support holding a fixed angle.
    if(rel>1.92)return crash(s,'LOOPED OUT','fender_r');
    if(s.w>0)s.w=Math.max(0,s.w-dt*.7);
    s.vx*=Math.max(0,1-dt*.6);
  }
  // head
  const [hx, hy] = rot(0.1, p.comH * 0.85, s.pitch); if (ter.h(s.x + hx) > s.y + hy) return crash(s, "HEAD PLANT", "bars");
  s.wasAir = !onG; if (inp.hop && onG && s.ground[0] && s.ground[1] && !s.hopCd) { s.vy += 3.4; s.w += 0.6; s.hopCd = 0.4; pop("BUNNY HOP", 50); }
  if (s.hopCd) s.hopCd = Math.max(0, s.hopCd - dt);
  if (inp.trick && !onG && s.air > 0.15 && !s.spinV) s.spinV = 2 * Math.PI / 0.7;
  if (inp.whip && !onG && s.air > 0.15 && !s.whip) s.whip = 1;
  s.stuntButtons??={};for(const action of ['tailwhip','barspin','superman']){if(inp[action]&&!s.stuntButtons[action])s.stuntRequest={name:action,expires:.7};s.stuntButtons[action]=!!inp[action];}
  if(s.stunt){s.stunt.elapsed+=dt;if(s.stunt.elapsed>=s.stunt.duration){(s.pendingStunts??=[]).push(s.stunt.name);s.stunt=null;}}
  if(s.stuntRequest){s.stuntRequest.expires-=dt;if(s.stuntRequest.expires<=0)s.stuntRequest=null;else if(!onG&&s.air>.08&&!s.stunt){s.stunt={name:s.stuntRequest.name,elapsed:0,duration:.6};s.stuntRequest=null;}}
  return s;
}
function crash(s, why, part) { s.crashed = why; s.events.push({ type: "crash", why, part }); s.wear[part] = (s.wear[part] || 0) + 0.45; return s; }
const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
