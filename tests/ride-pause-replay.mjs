import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRideBuffer, restoreRideState } from '../ride-buffer.js';

const buf = createRideBuffer(20);
const base = {
  x: 0, y: 1, vx: 2, vy: 0, pitch: 0.2, w: 0.1,
  comp: [0, 0], ground: [true, false], air: 0, airRot: 0, wasAir: false,
  crashed: null, wheelieT: 0, stoppieT: 0, score: 10, trick: '', trickT: 0,
  spin: 0, spinV: 0, wear: {}, events: [{type:'x'}], battery: 0.9, odo: 3, wheelSpin: [0, 0],
  stunt: { name: 'barspin', elapsed: 0.2, duration: 0.6 },
};
for (let i = 0; i < 2400; i++) {
  base.x = i * 0.05;
  base.stunt.elapsed = Math.min(0.59, 0.2 + i * 0.0001);
  buf.push(base, 1 / 120, { dirt: i * 0.0001, flips: 0, maxScore: 10, lastCP: 2, wear: {} });
}
assert(buf.duration <= 20.05 && buf.duration >= 19.5, 'buffer ~20s, got ' + buf.duration);
assert(buf.length > 1000 && buf.length <= 2400 + 5, 'length capped, got ' + buf.length);

const mid = buf.at(0.5);
assert(mid && mid.s.stunt && mid.s.stunt.name === 'barspin');
const target = { ...base, stunt: null, x: -1 };
const meta = restoreRideState(target, mid);
assert.equal(target.x, mid.s.x);
assert.equal(target.stunt.name, 'barspin');
assert.equal(target.stunt.elapsed, mid.s.stunt.elapsed);
assert(meta && 'dirt' in meta);

// Scrub ends
const end = buf.at(1);
const start = buf.at(0);
assert(end.s.x > start.s.x);

const ride = readFileSync(new URL('../ride.js', import.meta.url), 'utf8');
const pause = readFileSync(new URL('../ride-pause.js', import.meta.url), 'utf8');
const replay = readFileSync(new URL('../ride-replay.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
assert(ride.includes('pauseMenuMarkup'));
assert(ride.includes("k === \"escape\" || k === \"p\""));
assert(ride.includes('recordStep'));
assert(pause.includes('menu-respawn') && pause.includes('menu-replay'));
assert(replay.includes('openFromPause') && replay.includes('dropIn'));
assert(replay.includes('data-r="replay-play"') || ride.includes('data-r="replay-play"'));
assert(sw.includes('racefix3') && sw.includes('ride-buffer.js') && sw.includes('ride-pause.js'));

console.log(JSON.stringify({
  bufferSeconds: +buf.duration.toFixed(2),
  bufferFrames: buf.length,
  scrubOk: true,
  dropInKeepsStunt: true,
  pauseMenuWired: true,
  cacheBumped: true,
}));
