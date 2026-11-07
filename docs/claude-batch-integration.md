# Claude batch integration - beta only

Base: committed 1ca2605, branch work/claude-batch. Incoming archive handoff and changes.diff are preserved at repository root. The diff passed git apply --check against the current committed source and was applied by hunk. Only the four new WebP assets and the matching-version minified vendor file were copied as binary/large replacements. Unfinished chase/steering work and pre-existing QA screenshots were preserved in separate named stashes. Public chase stays off; DEV_INFINITE_MONEY and existing mechanics/gates remain.

## Integration corrections beyond Claude's supplied diff

- Explicit lowDetail compatibility requests now force low/manual quality; normal phone startup delegates to the auto-tier picker. Level switching carries the manual flag, resolved theme and current pixel-ratio cap, so a medium/adaptively lowered ride does not silently restart at another quality.
- Auto-quality measurements use real, successive three-second sample windows. The supplied monitor could repeatedly judge individual late frames after its first good window. A later bad window also cancels an upgrade previously queued for next ride. Added regressions.
- Thumbnail materials receive envMapIntensity directly: Three.js r160 has no Scene.environmentIntensity support. Temporary thumbnails restore the live preview's contact-shadow transform; live preview framing starts with its actual container aspect. The temporary RoomEnvironment is disposed after PMREM generation.
- Late successful/failed backdrop callbacks cannot mutate a disposed ride scene.
- The stale workshop-batch sticker test now uses the current Custom sticker / Trace / Use sticker interface, retaining cutout alpha and save assertions.
- Beta build pins wheelie-king-beta and its account, keeps separate cache/manifest/title/badge, and verifies every served beta asset hash. Verification cannot use the live host.

## Vendor verification

Both the prior unminified library and new minified library matched the official npm three@0.160.0 archive byte-for-byte. New SHA-256: 3e690ac7d180b0aadf0891bea39eec643e29e2d3e75c99b18689518665f69ba6. Same renderer version/API; MIT licence retained.

## Hardware evidence

Local Chrome used ANGLE/NVIDIA GeForce RTX 3070/Direct3D11. Three fixed-camera workshop canvas frames were pixel-identical (0 differing pixels out of 1,275,000); rotating workshop and product grid/detail captures were visually inspected. Shadow catcher y=.003 versus floor y=0, renderOrder=2, depthWrite=false; key normalBias=.012. No static flicker or clipped helmet renders observed in that check. This does not replace phone tuning.

Hardware command: node tests/claude-gpu.mjs. Images: wk-shots/claude-gpu/. Detailed report: ignored test-results/claude-gpu.json.

## Full release and delivery

Run npm run check -- release sequentially with WK_TEST_URL=http://127.0.0.1:8932/ (this branch's source server). The initial partial preflight was cancelled for the confirmed integration fixes above; only the complete final run counts. Final results and beta URL are recorded after verification. Do not merge to main or deploy the live project before owner testing.

The final sequential release run passed all 34 checks plus syntax and runtime packaging.

Published build 6c82603 at https://wheelie-king-beta.pages.dev/ with 90 matching served file hashes. Production still serves wk-v18-air-momentum-1. Main remains at 1ca2605.
