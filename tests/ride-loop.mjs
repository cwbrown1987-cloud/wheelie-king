import assert from 'node:assert/strict';
import {bikeParams, makeFlatTerrain, makeState, makeTerrain, step} from '../ride-physics.js';

assert.equal(makeFlatTerrain().loop, undefined);
for (const params of [bikeParams({}), bikeParams({P:8000,nm:140,kg:68,wb:1.25,wheelR:.265,comH:.84,travel:.12,shock:.06})]) {
  if (params.pedal) params.vmax = 5; // Stock BMX speed cap in Race.
  const terrain = makeTerrain(24);
  const state = makeState(params, 2, terrain);
  const controls = {throttle:1, brake:0, lean:0};
  let inverted = false;
  for (let i = 0; i < 24000 && state.x < terrain.loop.x + 5 && !state.crashed; i++) {
    step(state, params, controls, 1/480, terrain);
    inverted ||= Boolean(state.loopRide) && Math.abs(state.pitch) > 3;
  }
  assert.equal(state.crashed, null);
  assert(inverted);
  assert.equal(state.events.filter(event => event.t === 'LOOP CLEARED').length, 1);
  assert(state.x >= terrain.loop.x + 5);
}
console.log('PASS Trials downhill, full inversion and flat exit for BMX and powered bike');
