// Rolling ride-state buffer for pause Drop In (last N seconds, every physics step).
export function createRideBuffer(seconds = 20) {
  const frames = [];
  // t = simulated time (slow-mo / Drop In ease run it slower than real time).
  // wall = capture clock: real seconds while the replay video is recording. The video timeline is in wall time,
  // so scrub positions map onto frames by wall time (mapping by sim time dropped you at the wrong spot).
  let t = 0, wall = 0;
  const snap = (s, meta = {}) => {
    // Strip ephemeral event spam; keep stunt/trick so Drop In stays mid-trick.
    const { events, ...rest } = s;
    return {
      t,
      w: wall,
      s: structuredClone({
        ...rest,
        events: [],
        stunt: s.stunt ? { ...s.stunt } : null,
        stuntRequest: s.stuntRequest ? { ...s.stuntRequest } : null,
        pendingStunts: s.pendingStunts ? [...s.pendingStunts] : [],
        wear: s.wear ? { ...s.wear } : {},
        comp: s.comp ? [...s.comp] : [0, 0],
        ground: s.ground ? [...s.ground] : [false, false],
        wheelSpin: s.wheelSpin ? [...s.wheelSpin] : [0, 0],
        stuntButtons: s.stuntButtons ? { ...s.stuntButtons } : {},
      }),
      meta: structuredClone(meta),
    };
  };
  return {
    get length() { return frames.length; },
    get duration() { return frames.length ? frames[frames.length - 1].t - frames[0].t : 0; },
    get seconds() { return seconds; },
    push(s, dt, meta) {
      t += dt;
      frames.push(snap(s, meta));
      const cut = t - seconds;
      while (frames.length > 1 && frames[0].t < cut) frames.shift();
    },
    clear() { frames.length = 0; t = 0; wall = 0; },
    get wall() { return wall; },
    get wallStart() { return frames.length ? frames[0].w : wall; },
    // Advance the capture clock (call once per rendered frame while the replay video is recording).
    tick(dt) { if (dt > 0) wall += dt; },
    // Latest frame captured at or before capture-clock time w (clamped to the buffer).
    atWall(w) {
      if (!frames.length) return null;
      if (w <= frames[0].w) return frames[0];
      let lo = 0, hi = frames.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (frames[mid].w <= w) lo = mid; else hi = mid - 1;
      }
      return frames[lo];
    },
    // Map scrubber ratio 0..1 or absolute time within buffer onto a frame.
    at(ratioOrTime, absolute = false) {
      if (!frames.length) return null;
      const t0 = frames[0].t, t1 = frames[frames.length - 1].t;
      const target = absolute ? Math.min(t1, Math.max(t0, ratioOrTime))
        : t0 + Math.min(1, Math.max(0, ratioOrTime)) * Math.max(1e-6, t1 - t0);
      let lo = 0, hi = frames.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (frames[mid].t < target) lo = mid + 1; else hi = mid;
      }
      return frames[lo];
    },
    indexForTime(time) {
      const f = this.at(time, true);
      return f ? frames.indexOf(f) : -1;
    },
  };
}

export function restoreRideState(target, snapshot) {
  if (!snapshot?.s) return null;
  const next = structuredClone(snapshot.s);
  Object.keys(target).forEach(k => { delete target[k]; });
  Object.assign(target, next);
  return snapshot.meta || {};
}
