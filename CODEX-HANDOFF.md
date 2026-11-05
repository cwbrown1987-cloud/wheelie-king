# Wheelie King — current instructions and resume

Updated 5 Nov 2026. This is the single current instruction page. Replace the resume when work changes; do not append checkpoints. Consult history only for a specific question.

## Resume

- Branch: `wip/v18-detail`; completed releases also go to `main`.
- Live: https://wheelie-king.pages.dev. Runtime: `wk-v18-scene-depth-1`. Check Git for the current HEAD.
- Builder follow-up: a single compact frosted parts drawer replaces the category rail in Simple and Advanced. Cards retain 3D images, names and key stats; Back restores categories. Simple navigation closes old native sticker drawers. Stickers is last/full-width with a double-size icon. Builder and sticker cutout checks passed.
- Builder: Simple (default) and Advanced share the wider two-column rail/inline previews. Small screens have All Parts; sticker tools wrap. Bikes is separate from Kits (seven complete matched conversion packages, bundle thumbnails). Styles contains colour choices, with nested Back history. Automatic removals are quiet. Rotation pause persists. Compact stats retain km/h, W, Nm, km, kg and stunt labels. Repairs remain paused; infinite coins stays on.
- Mechanics: fork sliders/dropouts follow the real leg axis; upside-down forks move their lower stanchions, with crowns/uppers fixed. Nine-bike pivot/shock/brake/fender relationships remain checked.
- Riding: reference-style lean circles, centre trick row, right brake-disc/green accelerator, pause/reset/endless/tilt. Static neon sunset background, textured 3D road and near concrete foreground. Current side camera remains; full redesign/chase camera is future work. Round-tyre footprint contacts smooth sharp joins; travel stops handle landings. Monos use responsive counterlean/brake and a ground-dependent fender scrape, without a fixed 93-degree lock. Reverse, driven-wheel electric burnouts and trick combinations remain.
- Stickers: upload → DRAW CUTOUT → trace/tap around object → Use cutout → existing border/rating/APPLY TO BIKE flow. Clear/undo/cancel and transparent alpha are supported. Ratings and adult PIN gating remain.
- Validation: all seven release checks passed (builder, workshop/cutout, landings, multi-touch controls, nine-bike motion, TRAX mechanics, modular fitment). A separate sharp-join ride check passed. Publish with `npm run deploy`, which verifies every runtime file hash. Real Android/iPad feel and performance remain unverified.
- Rider: `rider-model.js` has shaped blue hoodie, helmet/face/gloves, trousers and trainers, articulated limbs and persistent meshes (no per-frame arm geometry rebuild). Side camera is shallower; road narrowed to 1.4 m and shallow track ribbon/foreground rather than a full-screen slab. Ride checks and visual inspection cover this follow-up.
- Depth: `ride-environment.js` streams eight unique world-seeded 24 m sections: real wall/fence/lamp/container/palm/building geometry, planted foreground and paved surroundings, neon track edges. Existing generated art supplies material crops and distant sky. Chunk disposal bounds geometry/textures; checked beyond 10 km. `__WK_SCENE_VIEW__('chase'|'side')` is a QA preview with a 0.4 s camera orbit, not a public camera toggle. Foreground fence fades for side-camera visibility. Ride HUD/render resolution compensate for scaled app stage. Screenshots: `wk-shots/scene-depth/`.
- Next: Chris tests public workshop/depth update and supplies remaining batch. Public camera switching, gently curving path/auto-steering, full reference visual fidelity and new scenic biomes remain future work. Current track stays straight in endless mode.

## Working rules

- Batch related fixes, run relevant checks, commit/push both branches, then publish to the existing Cloudflare app. GitHub or localhost alone is not delivery. Fix a failing check before broadening work.
- Keep progress brief. Final: changed / tested / pushed / remaining. Explain more when asked.
- Search specific files and changed sections. Reuse verified findings; repeat checks only for new changes, failures or unresolved concerns.
- Overwrite stale resume notes here. Version detail belongs in CHANGELOG, test logs in ignored `test-results/`, selected visual evidence in `wk-shots/`.
- Prefer side modules: `app.js` is a minified React bundle without source. Required string patches must assert their expected match count.
- One fitted part per slot: replace/remove old geometry. Structural main frames are separate from the BIKES presets and conversion KITS. Preserve fitment/adapters and colour interfaces; use realistic named mounts and connected moving components.
- Keep `window.DEV_INFINITE_MONEY=true` and the removed chat-log feature removed. Never print/commit the PIN, credentials or private photos.
- Preserve sticker ratings (`all`, `teen`, `adult18`) and the PIN gate. Substance/weapon jokes belong to adult characters and 18+ content. Use original art; no copied logos.
- Target Android Chrome/iPad Safari, named sub-meshes/materials and sensible LOD. Keep ride physics reusable. Only the TRAX wheel size (20-inch) is confirmed; other photo-derived measurements/standards are game estimates.

## Checks and delivery

PowerShell in this checkout. Install dependencies: `npm ci`. Preview: `python -m http.server 8931 --bind 127.0.0.1`. Browser checks need that server and installed Chrome; run them sequentially on this PC.

| Command | Purpose |
| --- | --- |
| `npm run check` | Syntax and safe runtime packaging; no browser |
| `npm run check -- builder` | Presets, compatible plans, colours/wheels, preview/apply/cancel, endless ride |
| `npm run check -- ride` | Static checks, landings and multi-touch |
| `npm run check -- mechanics` | Static checks, nine-bike motion and TRAX mechanics |
| `npm run check -- modular` | Static checks, catalogue/fitment/colour/removal and ride smoke |
| `npm run check -- release` | All six current integration checks, sequentially |
| `npm run deploy` | Package, publish to production, verify served file hashes |
| `npm run verify:live` | Compare current runtime files with production without publishing |

Combine groups, e.g. `npm run check -- ride mechanics`; each check runs once. Failures stop immediately. Short terminal summaries; detailed logs/JSON in `test-results/checks/`.

For game changes: bump SW cache, precache new runtime modules, update CHANGELOG/resume, run the relevant group, commit, then `git push origin HEAD:wip/v18-detail HEAD:main` and `npm run deploy`. Never force-push. Docs/tooling changes need static/affected checks, not every gameplay check or a new SW cache.

Cloudflare project: `wheelie-king`, account `7f9b89a42182a51327a119efb6cf949e`. OAuth worked on this PC; if expired: `npx --yes wrangler@4.157.0 login`. Do not log credentials or change hosting. Upload only `dist/`; staging whitelists runtime assets and excludes history, photos, tests and dependencies.

## Code and backlog

- Catalogue/variants/stock: `modular-catalogue.js`; fitment: `fitment.js`; assembly: `parts3d.js`, `modular-render.js`; previews: `thumbs.js`.
- Geometry/detail: `frame-geometry.js`, `partmodels.js`, `detail.js`; TRAX: `trax-bike.js`, `trax-suspension.js`; motion: `bike-motion.js`.
- Riding/rendering: `ride.js`; reference control skin: `ride-controls.js`; stunt transforms: `ride-tricks.js`; contacts/landings/trick awards: `ride-physics.js`; category icons: `category-icons.js`; backdrop: `icons/neon-skatepark-background.png` ([prompt/provenance](docs/assets/neon-backdrop.md)); decals: `stickers-dd.js`; cutouts: `sticker-trace.js`; road/foreground: `ride-scenery.js`; PWA: `index.html`, `sw.js`, manifest/headers/icons.
- Deferred priorities: component detail, frame-specific fender/cover styles and finishes, richer sticker editing. Future: sub-mesh workshop, 3D free roam, scooters, richer per-build wear.
- Targets: `docs/reference/quality-reference-emoto.png`, `docs/reference/frame-joints.png`, `docs/reference/hub-spokes.png`. Evidence: `wk-shots/`.
- History: [CHANGELOG](CHANGELOG.md), [old checkpoints](docs/archive/CODEX-HANDOFF-through-2026-11-05.md), [original brief](docs/archive/HANDOFF-original.md), [TRAX notes](docs/archive/TRAX-BIKE-through-2026-11-05.md), [transcript](docs/archive/CHAT-HISTORY.md). Historical instructions do not override this page or Chris's latest request.
