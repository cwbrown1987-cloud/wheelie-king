// Wheelie King ride physics (v15). Pure 2D side-on rigid-body bike, no DOM/three — reusable for the later 3D mode.
// Units: metres, kg, seconds. x forward, y up. pitch: + = nose up (wheelie).
export function makeTerrain(seed = 1) {
  // polyline points [x, y, tag]; tags mark kickers, gaps, puddles and checkpoints
  let r = seed; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const pts = [[-30, 0], [0, 0], [30, 0]]; const puddles = [], checkpoints = [0], kickers = [];
  let x = 30, y = 0;
  const add = (dx, dy) => { x += dx; y += dy; pts.push([x, y]); };
  const section = (i) => {
    const t = i % 6;
    if (t === 0) { for (let k = 0; k < 6; k++) add(6, (rnd() - 0.5) * 2.2); }                                  // rolling hills
    else if (t === 1) { add(8, 0); kickers.push(x); add(4, 1.4); add(0.4, -1.4 + 0.0); add(10, -0.3); add(10, 0); } // kicker
    else if (t === 2) { add(6, 0); add(5, 2.2); const g0 = x; add(0.2, -3.2); add(6, 0); add(0.2, 1.0); add(7, 0.4); kickers.push(g0); add(8, -0.4); } // gap
    else if (t === 3) { add(6, 0); puddles.push([x, x + 6]); add(6, 0); add(6, 0.2); }                          // puddle
    else if (t === 4) { for (let k = 0; k < 4; k++) { add(5, 1.6); add(5, -1.6); } }                           // whoops
    else { add(10, 3); add(6, 0.2); add(12, -3.2); add(6, 0); }                                                 // big step-down
    if (i % 2 === 1) checkpoints.push(x);
  };
  for (let i = 0; i < 14; i++) section(i);
  add(20, 0); const finish = x; add(60, 0);
  const h = (qx) => { let lo = 0, hi = pts.length - 1; if (qx <= pts[0][0]) return pts[0][1]; if (qx >= pts[hi][0]) return pts[hi][1];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m][0] <= qx) lo = m; else hi = m; }
    const [x0, y0] = pts[lo], [x1, y1] = pts[hi]; return x1 === x0 ? Math.max(y0, y1) : y0 + (y1 - y0) * (qx - x0) / (x1 - x0); };
  const slope = (qx) => Math.atan2(h(qx + 0.15) - h(qx - 0.15), 0.3);
  const inPuddle = (qx) => puddles.some(([a, b]) => qx >= a && qx <= b);
  return { pts, h, slope, puddles, checkpoints, kickers, finish, inPuddle };
}
export function bikeParams(stats = {}) {
  const motorW = stats.P || 0, pedal = motorW < 200;
  return {
    mass: (stats.kg || 15) + 75, wb: stats.wb || 1.0, comBack: stats.comBack || 0.42, comH: stats.comH || 0.95,
    R: stats.wheelR || 0.3, power: pedal ? 250 : motorW, torque: pedal ? 40 : (stats.nm || 60), pedal,
    vmax: pedal ? 8 : Math.min(40, 6 + Math.sqrt(motorW) * 0.35),
    travelF: Math.max(0, stats.travel ?? 0), travelR: Math.max(0, stats.shock ?? 0), damp: stats.damp ?? 0.3, grip: stats.grip || 1,
    batteryWh: stats.batteryWh || 0 };
}
export function makeState(p, x = 2, ter) { const y = ter.h(x) + p.R + p.comH * 0.75;
  return { x, y, vx: 0, vy: 0, pitch: 0, w: 0, comp: [0, 0], ground: [false, false], air: 0, airRot: 0, wasAir: false, crashed: null, wheelieT: 0, stoppieT: 0, score: 0, trick: "", trickT: 0,
    spin: 0, spinV: 0, wear: {}, events: [], battery: 1, odo: 0, wheelSpin: [0, 0] }; }
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
export function step(s, p, inp, dt, ter) {
  if (s.crashed) return s;
  const I = p.mass * 0.32, hC = p.comH - p.R; // pitch inertia, COM height above axles
  const wl = [[-p.wb * p.comBack, -hC], [p.wb * (1 - p.comBack), -hC]], travel = [p.travelR, p.travelF];
  const k = (i) => p.mass * 9.8 / 2 / Math.max(travel[i] * 0.35, 0.012), c = (i) => 2 * (0.25 + p.damp) * Math.sqrt(k(i) * p.mass / 2);
  let Fx = 0, Fy = -9.8 * p.mass, T = 0, impactV = 0; const N = [0, 0];
  const maxDeflection=i=>Math.max(.004,travel[i]*.8*(i?(p.forkVertical??1):1));
  s.thr = (s.thr || 0) + Math.max(-dt * 6, Math.min(dt * 2.5, (inp.throttle || 0) - (s.thr || 0))); // throttle ramps like a real twist grip
  s.ground = [false, false];
  for (let i = 0; i < 2; i++) {
    const [ox, oy] = rot(wl[i][0], wl[i][1], s.pitch), wx = s.x + ox, wy = s.y + oy, g = ter.h(wx), d = g + p.R - wy;
    if (d > 0) { s.ground[i] = true; const a = ter.slope(wx), nx = -Math.sin(a), ny = Math.cos(a),vn=(s.vx-s.w*oy)*nx+(s.vy+s.w*ox)*ny;
      impactV=Math.min(impactV,vn);
      // Suspension supplies spring force; a contact impulse handles bottom-out.
      // An arbitrarily stiff extra spring used to sink, then launch the bike.
      let f = k(i) * Math.min(d, maxDeflection(i)) - c(i) * vn;
      if(d>maxDeflection(i)&&vn<-5.5+travel[i]*10)s.events.push({type:'bottom',i});
      f = Math.max(0, f); N[i] = f; s.comp[i] = Math.min(1,d/maxDeflection(i));
      Fx += f * nx; Fy += f * ny; T += ox * f * ny - (oy - 0) * f * nx; // r x F (z)
      const tx = Math.cos(a), ty = Math.sin(a), vt = s.vx * tx + s.vy * ty;
      let ft = -vt * 2.2 * (i ? 1 : 1); // rolling resistance
      if (i === 0 && inp.throttle > 0 && s.battery > 0) { const v = Math.max(Math.abs(vt), 1.2); let drive = Math.min(p.torque * 4, p.power / v, p.mass * 9.8 * 0.4 * p.grip) * (s.thr || 0); { const rel0 = s.pitch - a; if (rel0 > 0.6 && !(inp.lean > 0)) drive *= Math.max(0.15, 1 - (rel0 - 0.6) * 3 - Math.max(0, s.w) * 0.25); } /* rider feathers the throttle at the balance point unless leaning back */ if (vt > p.vmax) drive *= Math.max(0, 1 - (vt - p.vmax)); drive = Math.min(drive, f * 1.15 * p.grip + 80); ft += drive; }
      if (inp.brake > 0) { const bias = i === 1 ? 0.45 + 0.45 * Math.max(0, inp.lean) : 0.55 - 0.3 * Math.max(0, inp.lean); ft -= Math.sign(vt) * Math.min(f * 0.9 * p.grip, p.mass * 9 * bias) * inp.brake * Math.min(1, Math.abs(vt) * 2); }
      Fx += ft * tx; Fy += ft * ty; const rx = ox - nx * p.R, ry = oy - ny * p.R; T += rx * ft * ty - ry * ft * tx;
    } else s.comp[i] = Math.max(0, s.comp[i] - dt * 6);
  }
  let onG = s.ground[0] || s.ground[1];
  Fx -= 0.32 * s.vx * Math.abs(s.vx);
  if (onG) { T += inp.lean * p.mass * 2.4; if (s.ground[0] && !s.ground[1]) { const set = 0.55 + 0.6 * Math.max(0, inp.lean), rel1 = s.pitch - ter.slope(s.x); if (rel1 > set) T -= (rel1 - set) * p.mass * 16 + Math.max(0, s.w) * p.mass * 1.6; } } /* rider balance assist: rear brake + body at the balance point */ else s.w += inp.lean * 7 * dt; // rider body English / air control
  s.vx += Fx / p.mass * dt; s.vy += Fy / p.mass * dt; s.w += T / I * dt; s.w *= onG ? 0.993 : 0.999;
  s.x += s.vx * dt; s.y += s.vy * dt; s.pitch += s.w * dt; s.odo += Math.abs(s.vx) * dt;
  // Hard travel stops prevent tunnelling. Cancel only velocity INTO the
  // contact, including the wheel's angular velocity; do not add bounce energy.
  for(let i=0;i<2;i++){
    const [ox,oy]=rot(wl[i][0],wl[i][1],s.pitch),wx=s.x+ox,d=ter.h(wx)+p.R-(s.y+oy),limit=maxDeflection(i);
    if(d>limit){
      s.y+=d-limit;s.ground[i]=true;
      const a=ter.slope(wx),nx=-Math.sin(a),ny=Math.cos(a),vn=(s.vx-s.w*oy)*nx+(s.vy+s.w*ox)*ny,lever=ox*ny-oy*nx;
      impactV=Math.min(impactV,vn);
      if(vn<0){const impulse=-vn/(1/p.mass+lever*lever/I);s.vx+=impulse*nx/p.mass;s.vy+=impulse*ny/p.mass;s.w+=impulse*lever/I;}
    }
  }
  for(let i=0;i<2;i++){const [ox,oy]=rot(wl[i][0],wl[i][1],s.pitch),depth=ter.h(s.x+ox)+p.R-(s.y+oy);s.comp[i]=Math.max(0,Math.min(1,depth/maxDeflection(i)));}
  onG=s.ground[0]||s.ground[1];
  for (let i = 0; i < 2; i++) s.wheelSpin[i] += s.vx / p.R * dt;
  if (inp.throttle > 0 && s.ground[0] && !p.pedal) s.battery = Math.max(0, s.battery - inp.throttle * p.power * dt / 3600 / Math.max(50, p.batteryWh));
  // tricks & scoring
  if (s.trickT > 0) s.trickT -= dt;
  if (s.spinV) { s.spin += s.spinV * dt; if (Math.abs(s.spin) >= Math.PI * 2) { s.spin = 0; s.spinV = 0; s.pendingSpin = (s.pendingSpin || 0) + 1; } }
  const pop = (t, pts) => { s.trick = t; s.trickT = 1.6; s.score += pts; s.events.push({ type: "trick", t, pts }); };
  if (!onG) { s.air += dt; s.airRot += s.w * dt; }
  else if (s.wasAir) {
    const rearX=s.x+rot(wl[0][0],wl[0][1],s.pitch)[0],frontX=s.x+rot(wl[1][0],wl[1][1],s.pitch)[0];
    const a=s.ground[0]&&s.ground[1]?Math.atan2(ter.h(frontX)-ter.h(rearX),frontX-rearX):ter.slope(s.ground[0]?rearX:frontX);
    const offset=wrapAngle(s.pitch-a),off=Math.abs(offset),tol=(offset>=0?1.05:.85)+Math.min(.15,p.travelF*.6);
    if (s.air>.08&&s.spinV) return crash(s, "LANDED MID-SPIN", "bars");
    if (s.air>.08&&off > tol) return crash(s, `BAD LANDING (${Math.round(off * 57)}° OFF)`, "suspension");
    const flips = Math.round(s.airRot / (2 * Math.PI)); let pts = Math.round(s.air * 120), name = "";
    if (flips >= 1) { pts += 800 * flips; name = (flips > 1 ? flips + "x " : "") + "BACKFLIP"; } else if (flips <= -1) { pts += 1000 * -flips; name = (flips < -1 ? -flips + "x " : "") + "FRONTFLIP"; }
    if (s.pendingSpin) { pts += 500 * s.pendingSpin; name = (name ? name + " + " : "") + (s.pendingSpin > 1 ? s.pendingSpin * 360 : 360); s.pendingSpin = 0; }
    if (s.whip) { pts += 250; name = (name ? name + " + " : "") + "180 WHIP"; s.whip = 0; }
    if (s.air > 0.45 || name) { if (off < 0.15) { pts += 150; name = (name || "AIR " + s.air.toFixed(1) + "s") + " · PERFECT"; } pop(name || "AIR " + s.air.toFixed(1) + "s", pts); }
    if(s.air>.08)s.events.push({ type: "land", v: impactV, air: s.air }); s.pitch=wrapAngle(s.pitch);s.air=0;s.airRot=0;
  }
  // ground balance tricks
  const rel = wrapAngle(s.pitch - ter.slope(s.x));
  if (s.ground[0] && !s.ground[1] && rel > 0.12) { s.wheelieT += dt; s.score += (inp.throttle > 0 ? 70 : 100) * dt; s.balance = inp.throttle > 0 ? "WHEELIE" : "MANUAL"; }
  else if (s.ground[1] && !s.ground[0] && rel < -0.1) { s.stoppieT += dt; s.score += (inp.brake > 0 ? 120 : 140) * dt; s.balance = inp.brake > 0 ? "STOPPIE" : "NOSE MANUAL"; }
  else { if (s.balance && (s.wheelieT > 1 || s.stoppieT > 0.6)) pop(`${s.balance} ${(s.balance.includes("WHEEL") || s.balance === "MANUAL" ? s.wheelieT : s.stoppieT).toFixed(1)}s`, 0); s.balance = ""; if (onG && s.ground[0] && s.ground[1]) { s.bestWheelie = Math.max(s.bestWheelie || 0, s.wheelieT); s.wheelieT = 0; s.stoppieT = 0; } }
  if (onG && (rel > 1.6)) return crash(s, "LOOPED OUT", "fender_r");
  if (onG && (rel < -1.25)) return crash(s, "OVER THE BARS", "fender_f");
  // rear fender / tail scrape when the mono is too deep
  const [tx, ty] = rot(-p.wb * p.comBack - p.R * 0.95, -hC + p.R * 0.55, s.pitch);
  if (ter.h(s.x + tx) > s.y + ty) { s.events.push({ type: "scrape", x: s.x + tx, y: s.y + ty }); s.wear.fender_r = (s.wear.fender_r || 0) + dt * 0.35; s.wear.bash = (s.wear.bash || 0) + dt * 0.05; s.score += 40 * dt; }
  // head
  const [hx, hy] = rot(0.1, p.comH * 0.85, s.pitch); if (ter.h(s.x + hx) > s.y + hy) return crash(s, "HEAD PLANT", "bars");
  s.wasAir = !onG; if (inp.hop && onG && s.ground[0] && s.ground[1] && !s.hopCd) { s.vy += 3.4; s.w += 0.6; s.hopCd = 0.4; pop("BUNNY HOP", 50); }
  if (s.hopCd) s.hopCd = Math.max(0, s.hopCd - dt);
  if (inp.trick && !onG && s.air > 0.15 && !s.spinV) s.spinV = 2 * Math.PI / 0.7;
  if (inp.whip && !onG && s.air > 0.15 && !s.whip) s.whip = 1;
  return s;
}
function crash(s, why, part) { s.crashed = why; s.events.push({ type: "crash", why, part }); s.wear[part] = (s.wear[part] || 0) + 0.45; return s; }
const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
