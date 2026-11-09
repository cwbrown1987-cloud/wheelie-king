// In-memory rolling video blocks (current + previous). Max 2 unless frozen for Replay.
export function createBlockRing({ maxBlocks = 2, blockMs = 30000 } = {}) {
  const blocks = [];
  let frozen = false;
  return {
    maxBlocks,
    blockMs,
    get length() { return blocks.length; },
    get frozen() { return frozen; },
    snapshot() { return blocks.slice(); },
    freeze() { frozen = true; },
    unfreeze() { frozen = false; this.trim(); },
    push(block) {
      blocks.push(block);
      this.trim();
      return blocks.length;
    },
    trim() {
      if (frozen) return;
      while (blocks.length > maxBlocks) blocks.shift();
    },
    clear() { blocks.length = 0; frozen = false; },
  };
}
