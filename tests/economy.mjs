// Ride pay: coins $5 each, Neon finish bonus (+ first-time bonus), score/10; best time/coins saved.
import assert from 'node:assert/strict';
globalThis.localStorage={_:{},getItem(k){return this._[k]??null},setItem(k,v){this._[k]=String(v)}};
const {rideEarnings,saveBest,readBest,PAY}=await import('../ride-economy.js');
assert.equal(rideEarnings({score:0,coins:10}).money,50);
assert.equal(rideEarnings({score:3000,coins:200,finished:true,level:'neon',firstFinish:true}).money,300+1000+250+500);
assert.equal(rideEarnings({score:3000,coins:200,finished:false,level:'neon'}).bonus,0);
let r=saveBest('neon',{finished:true,time:120,coins:150});assert.ok(r.firstFinish);
r=saveBest('neon',{finished:true,time:110,coins:100});assert.ok(!r.firstFinish&&r.newTime);assert.equal(readBest('neon').time,110);assert.equal(readBest('neon').coins,150);
// a clean neon run should pay in the $1.5-2k range: gear after a run or two, the whole parts list is long-term
const clean=rideEarnings({score:4500,coins:260,finished:true,level:'neon'}).money;assert.ok(clean>1400&&clean<2200,'clean run pays '+clean);
console.log('economy: ok');
