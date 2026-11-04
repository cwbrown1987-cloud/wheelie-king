// Swept frame tubes with saddle cuts at their receiving shells. Units: metres.
// The cut edge and weld follow the actual cylinder intersection, including oblique stays.
export function sweptJoint(T, points, radius, material, name, start, end) {
  const path = new T.CatmullRomCurve3(points.map(p => new T.Vector3(p[0], p[1], p[2] || 0)));
  const segments = 48, sides = 24, frames = path.computeFrenetFrames(segments, false);
  const normalAt = (u, angle) => {
    const k = Math.min(segments - 1, Math.floor(u * segments)), f = u * segments - k;
    return frames.normals[k].clone().lerp(frames.normals[k + 1], f).multiplyScalar(Math.cos(angle))
      .addScaledVector(frames.binormals[k].clone().lerp(frames.binormals[k + 1], f), Math.sin(angle)).normalize();
  };
  const surface = (u, angle) => { u = Math.max(0, Math.min(1, u)); return path.getPointAt(u).addScaledVector(normalAt(u, angle), radius); };
  const cylinderDistance = (p, receiver) => {
    const q = p.clone().sub(new T.Vector3(...receiver.point));
    const axis = new T.Vector3(...receiver.axis).normalize();
    return q.addScaledVector(axis, -q.dot(axis)).length() - receiver.radius;
  };
  const trim = (receiver, angle, fromEnd) => {
    if (!receiver) return fromEnd ? 1 : 0;
    const u0 = fromEnd ? 1 : 0;
    if (cylinderDistance(surface(u0, angle), receiver) >= 0) return u0;
    let inside = u0, outside = u0;
    for (let j = 1; j <= 50; j++) {
      outside = fromEnd ? 1 - j / 100 : j / 100;
      if (cylinderDistance(surface(outside, angle), receiver) >= 0) break;
    }
    for (let j = 0; j < 24; j++) {
      const mid = (inside + outside) / 2;
      if (cylinderDistance(surface(mid, angle), receiver) < 0) inside = mid; else outside = mid;
    }
    return (inside + outside) / 2;
  };
  const starts = [], ends = [], positions = [], uvs = [], indices = [], seams = [[], []];
  for (let j = 0; j <= sides; j++) {
    const a = j / sides * Math.PI * 2;
    starts[j] = trim(start, a, false); ends[j] = trim(end, a, true);
    seams[0].push(surface(starts[j], a)); seams[1].push(surface(ends[j], a));
  }
  for (let i = 0; i <= segments; i++) for (let j = 0; j <= sides; j++) {
    const u = starts[j] + (ends[j] - starts[j]) * i / segments;
    positions.push(...surface(u, j / sides * Math.PI * 2).toArray());
    uvs.push(u, j / sides);
    if (i < segments && j < sides) {
      const a = i * (sides + 1) + j, b = a + sides + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geo.userData.wkTube = { points: points.map(p => [p[0], p[1], p[2] || 0]), radius };
  geo.setIndex(indices); geo.computeVertexNormals();
  const group = new T.Group(); group.name = name + ':assembly';
  const mesh = new T.Mesh(geo, material.clone()); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  for (const [i, receiver] of [start, end].entries()) if (receiver) {
    const curve = new T.CatmullRomCurve3(seams[i].slice(0, -1), true, 'centripetal');
    const weld = new T.Mesh(new T.TubeGeometry(curve, 72, .0014, 6, true), material.clone());
    weld.name = `frame:weld:${name.split(':')[1]}:${i ? 'end' : 'start'}`;
    weld.castShadow = true; group.add(weld);
    // One instanced row of small ripples follows the seam, rather than a fixed-axis ring.
    const beads = new T.InstancedMesh(new T.SphereGeometry(.00155, 6, 4), material.clone(), 48);
    beads.name = weld.name + ':beads'; beads.userData.lod = 'hi';
    const obj = new T.Object3D();
    for (let k = 0; k < 48; k++) { obj.position.copy(curve.getPointAt(k / 48)); obj.updateMatrix(); beads.setMatrixAt(k, obj.matrix); }
    group.add(beads);
  }
  group.userData.joint = { radius, start, end, edges: seams.map(s => s.map(p => p.toArray())) };
  return group;
}

export function buildFrame(root, x, T, g, b) {
  const fr = g('frame'); if (!fr || !x) return;
  const stock = fr.children.slice(), paint = stock[0]?.material; if (!paint) return;
  const moto = ['moto', 'emoto'].includes(b.frame), r = x.tr || .022;
  // Keep the stock moto shock only until the separate shock slot replaces it below.
  const shock = moto ? stock.slice(12) : [];
  fr.clear();
  const add = (geometry, name, p, rotation, mat = paint) => {
    const m = new T.Mesh(geometry, mat.clone()); m.name = name;
    if (p) m.position.set(...p); if (rotation) m.rotation.set(...rotation);
    m.castShadow = m.receiveShadow = true; fr.add(m); return m;
  };
  const dark = paint.clone(); dark.color.multiplyScalar(.55);
  const V = a => new T.Vector3(a[0], a[1], a[2] || 0), P = a => [a[0], a[1], a[2] || 0];
  const lerp = (a, c, t) => V(a).lerp(V(c), t).toArray();
  const { htT, htB, bb, seat, rear } = x;
  const shell = (a, c, rad, name, mat = paint) => {
    const av = V(a), cv = V(c), d = cv.clone().sub(av);
    const m = add(new T.CylinderGeometry(rad, rad, d.length(), 32), name, av.add(cv).multiplyScalar(.5).toArray(), null, mat);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  };
  const receiver = (point, axis, radius) => ({ point: P(point), axis: V(axis).toArray(), radius });
  const headAxis = V(htT).sub(V(htB)), seatAxis = V(seat).sub(V(bb));
  const head = receiver(htB, headAxis.toArray(), r * 1.5), seatShell = receiver(bb, seatAxis.toArray(), r);
  const bbRadius = Math.max(.03, r * 1.4), bottom = receiver(bb, [0, 0, 1], bbRadius);
  const headUnit = headAxis.clone().normalize();
  shell(V(htB).addScaledVector(headUnit, -.012).toArray(), V(htT).addScaledVector(headUnit, .012).toArray(), r * 1.5, 'frame:headTube');
  for (const [p, side] of [[htB, -1], [htT, 1]]) shell(V(p).addScaledVector(headUnit, side * .013).toArray(), V(p).addScaledVector(headUnit, side * .023).toArray(), r * 1.65, side < 0 ? 'frame:lowerCup' : 'frame:upperCup', dark);
  shell([bb[0], bb[1], -.045], [bb[0], bb[1], .045], bbRadius, 'frame:bbShell');
  const tube = (pts, rad, name, start, end) => fr.add(sweptJoint(T, pts, rad, paint, name, start, end));
  tube([bb, lerp(bb, seat, .5), seat], r, 'frame:seatTube', bottom);
  shell(lerp(seat, bb, .045), seat, r * 1.15, 'frame:seatCollar', dark);
  const ttH = lerp(htT, htB, .2), ttS = lerp(seat, bb, .08), mid = lerp(ttH, ttS, .5); mid[1] += .018;
  tube([ttH, mid, ttS], r, 'frame:topTube', head, seatShell);
  const dtH = lerp(htB, htT, .18), dtMid = lerp(dtH, bb, .55); dtMid[1] -= .018;
  tube([dtH, dtMid, bb], r * (moto ? 1.3 : 1.15), 'frame:downTube', head, bottom);
  // Seat collar pinch ears and bolt (kept at low LOD: it defines the silhouette).
  for (const z of [-.012, .012]) add(new T.BoxGeometry(.014, .012, .007), 'frame:collarEar', [seat[0] - r * 1.1, seat[1] - .009, z], null, dark);
  shell([seat[0] - r * 1.1, seat[1] - .009, -.02], [seat[0] - r * 1.1, seat[1] - .009, .02], .0035, 'frame:collarBolt', dark);
  const ssTop = lerp(seat, bb, .12);
  // A wider fat-bike rear triangle clears the tyre and matches its wider dropout standard.
  const width = b.frame === 'fat' ? .104 : moto ? .075 : .061;
  if (moto) {
    const pivot = [bb[0] + .04, bb[1] + .1, 0];
    shell([pivot[0], pivot[1], -width - .012], [pivot[0], pivot[1], width + .012], .025, 'frame:swingPivot', dark);
    for (const side of [-1, 1]) {
      tube([[pivot[0], pivot[1], side * width], [lerp(pivot, rear, .5)[0], lerp(pivot, rear, .5)[1], side * width], [rear[0], rear[1], side * width]], .024, side < 0 ? 'frame:swingarmL' : 'frame:swingarmR', receiver(pivot, [0, 0, 1], .025));
      tube([[dtH[0], dtH[1], side * .012], [bb[0] + .18, bb[1] - .065, side * .055], [bb[0] - .025, bb[1] - .06, side * .055], [bb[0], bb[1], side * .028]], r * .6, side < 0 ? 'frame:cradleL' : 'frame:cradleR', head, bottom);
    }
    if (!b.shock) for (const o of shock) { o.name = 'frame:stockShock'; fr.add(o); }
  } else for (const side of [-1, 1]) {
    const end = [rear[0] + .015, rear[1], side * width];
    tube([[bb[0], bb[1], side * .028], [lerp(bb, rear, .35)[0], lerp(bb, rear, .35)[1] - .008, side * (width + .012)], end], r * .65, side < 0 ? 'frame:chainstayL' : 'frame:chainstayR', bottom);
    tube([[ssTop[0], ssTop[1], 0], [lerp(ssTop, rear, .3)[0], lerp(ssTop, rear, .3)[1] + .01, side * width], [rear[0] + .015, rear[1] + .015, side * width]], r * .58, side < 0 ? 'frame:seatstayL' : 'frame:seatstayR', seatShell);
  }
  for (const side of [-1, 1]) {
    const shape = new T.Shape(); shape.moveTo(-.022, -.019); shape.lineTo(.031, -.019); shape.lineTo(.036, .027); shape.lineTo(.007, .037); shape.lineTo(-.025, .01); shape.closePath();
    const hole = new T.Path(); hole.absarc(0, 0, .0065, 0, Math.PI * 2, true); shape.holes.push(hole);
    add(new T.ExtrudeGeometry(shape, {depth:.006,bevelEnabled:true,bevelSize:.0015,bevelThickness:.0015,bevelSegments:2}), side < 0 ? 'frame:dropoutL' : 'frame:dropoutR', [rear[0], rear[1], side * width - .003]);
  }
}
