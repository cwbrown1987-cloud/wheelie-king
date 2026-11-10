import assert from 'node:assert/strict';
import { createBlockRing } from '../ride-replay-blocks.js';
import { readFileSync } from 'node:fs';

const ring = createBlockRing({ maxBlocks: 2, blockMs: 30000 });
for (let i = 0; i < 5; i++) ring.push({ blobs: [new Blob([String(i)])], started: i, ended: i + 1 });
assert.equal(ring.length, 2, 'rolling keeps at most 2 blocks');
assert.deepEqual(ring.snapshot().map(b => b.started), [3, 4]);

ring.freeze();
ring.push({ blobs: [new Blob(['frozen'])], started: 5, ended: 6 });
assert.equal(ring.length, 3, 'frozen may retain coverage while Replay is open');
ring.unfreeze();
assert.equal(ring.length, 2, 'unfreeze trims back to 2');

const replay = readFileSync(new URL('../ride-replay.js', import.meta.url), 'utf8');
assert(replay.includes('createBlockRing'));
assert(replay.includes('blockMs: 30000') || replay.includes('blockMs:30'));
assert(replay.includes('setCaptureActive'));
// 30 fps capture (15 fps was choppy) and the container header is kept so trimmed clips still decode.
assert(replay.includes('captureStream(REC.fps)') && /fps:\s*30/.test(replay));
assert(replay.includes('initSegment') && replay.includes('blobs.unshift(rolling.init)'));
console.log(JSON.stringify({ maxBlocks: 2, blockMs: 30000, pauseWhileMenus: true, freezeOnReplay: true }));
