# Wheelie King — current instructions and resume

Updated 5 Nov 2026. This is the single current instruction page. Replace the resume when work changes; do not append checkpoints. Consult history only for a specific question.

## Resume

- Branch: `wip/v18-detail`; completed releases also go to `main`.
- Live: https://wheelie-king.pages.dev. Runtime: `wk-v18-modular-5`. Check Git for the current HEAD.
- Working: nine compatible complete-bike kits; separate parts/colour variants (including actual grip removal/refitting); click-to-fit and separate info button; photo-based 20-inch TRAX; pivot/shock alignment; wheel/chain/crank/pedal motion; corrected landings and two-finger controls.
- Last relevant checks passed: modular builds, 45 motion poses, TRAX mechanics, 36 flat/sloped landings and Chromium multi-touch. Actual Android/iPad behaviour and performance remain unverified.
- Outstanding: device feedback on landings/touch; finer component detail; older tests still assuming frames include stock parts. Stickers/condition save per device, condition is global rather than per build, and decals have projection-depth limits.
- Next: address Chris's device feedback first; otherwise refine separate stem, seatpost and pedal models/mounts. Migrate only the older tests needed for that batch.

## Working rules

- Batch related fixes, run relevant checks, commit/push both branches, then publish to the existing Cloudflare app. GitHub or localhost alone is not delivery. Fix a failing check before broadening work.
- Keep progress brief. Final: changed / tested / pushed / remaining. Explain more when asked.
- Search specific files and changed sections. Reuse verified findings; repeat checks only for new changes, failures or unresolved concerns.
- Overwrite stale resume notes here. Version detail belongs in CHANGELOG, test logs in ignored `test-results/`, selected visual evidence in `wk-shots/`.
- Prefer side modules: `app.js` is a minified React bundle without source. Required string patches must assert their expected match count.
- One fitted part per slot: replace/remove old geometry. Structural main frames are separate from complete-bike KITS. Preserve fitment/adapters and colour interfaces; use realistic named mounts and connected moving components.
- Keep `window.DEV_INFINITE_MONEY=true` and the removed chat-log feature removed. Never print/commit the PIN, credentials or private photos.
- Preserve sticker ratings (`all`, `teen`, `adult18`) and the PIN gate. Substance/weapon jokes belong to adult characters and 18+ content. Use original art; no copied logos.
- Target Android Chrome/iPad Safari, named sub-meshes/materials and sensible LOD. Keep ride physics reusable. Only the TRAX wheel size (20-inch) is confirmed; other photo-derived measurements/standards are game estimates.

## Checks and delivery

PowerShell in this checkout. Install dependencies: `npm ci`. Preview: `python -m http.server 8931 --bind 127.0.0.1`. Browser checks need that server and installed Chrome; run them sequentially on this PC.

| Command | Purpose |
| --- | --- |
| `npm run check` | Syntax and safe runtime packaging; no browser |
| `npm run check -- ride` | Static checks, landings and multi-touch |
| `npm run check -- mechanics` | Static checks, nine-bike motion and TRAX mechanics |
| `npm run check -- modular` | Static checks, catalogue/fitment/colour/removal and ride smoke |
| `npm run check -- release` | All five current integration checks, sequentially |
| `npm run deploy` | Package, publish to production, verify served file hashes |
| `npm run verify:live` | Compare current runtime files with production without publishing |

Combine groups, e.g. `npm run check -- ride mechanics`; each check runs once. Failures stop immediately. Short terminal summaries; detailed logs/JSON in `test-results/checks/`.

For game changes: bump SW cache, precache new runtime modules, update CHANGELOG/resume, run the relevant group, commit, then `git push origin HEAD:wip/v18-detail HEAD:main` and `npm run deploy`. Never force-push. Docs/tooling changes need static/affected checks, not every gameplay check or a new SW cache.

Cloudflare project: `wheelie-king`, account `7f9b89a42182a51327a119efb6cf949e`. OAuth worked on this PC; if expired: `npx --yes wrangler@4.157.0 login`. Do not log credentials or change hosting. Upload only `dist/`; staging whitelists runtime assets and excludes history, photos, tests and dependencies.

## Code and backlog

- Catalogue/variants/stock: `modular-catalogue.js`; fitment: `fitment.js`; assembly: `parts3d.js`, `modular-render.js`; previews: `thumbs.js`.
- Geometry/detail: `frame-geometry.js`, `partmodels.js`, `detail.js`; TRAX: `trax-bike.js`, `trax-suspension.js`; motion: `bike-motion.js`.
- Riding/input: `ride.js`; contacts/landings: `ride-physics.js`; decals: `stickers-dd.js`; PWA: `index.html`, `sw.js`, manifest/headers/icons.
- Deferred priorities: component detail, frame-specific fender/cover styles and finishes, TRACE sticker editing. Future: sub-mesh workshop, 3D free roam, scooters, richer per-build wear.
- Targets: `docs/reference/quality-reference-emoto.png`, `docs/reference/frame-joints.png`, `docs/reference/hub-spokes.png`. Evidence: `wk-shots/`.
- History: [CHANGELOG](CHANGELOG.md), [old checkpoints](docs/archive/CODEX-HANDOFF-through-2026-11-05.md), [original brief](docs/archive/HANDOFF-original.md), [TRAX notes](docs/archive/TRAX-BIKE-through-2026-11-05.md), [transcript](docs/archive/CHAT-HISTORY.md). Historical instructions do not override this page or Chris's latest request.
