# Chris's 20-inch TRAX bike

Select **FRAMES → TRAX Lime Dual-Suspension Bike**. Fitting it from another frame installs the complete matching pedal-bike setup: frame, fork, coil shock, tall quill bars, saddle, rims, tyres, rim brakes and bicycle drivetrain. You can then swap parts or add a compatible conversion kit. Re-equipping the same frame preserves your current upgrades; switching away and back restores its stock build.

The model is original procedural geometry based on Chris's supplied photograph. **Chris confirmed 20-inch wheels.** The silhouette, lime/black speckled paint, plain TRAX lettering, short near-horizontal lime coil, Y rear triangle, chrome quill stem, lime fork lowers/rims, black spokes, amber reflectors and black saddle follow the visible reference. No copied logo artwork or additional third-party model assets are used. The original private attachment is excluded from Git.

Other dimensions, axle/BB/steerer standards, travel, tooth counts, mass and game prices are estimates for this game; they are not manufacturer specifications or measured physical fitment. The unseen side and linkage details are reconstructed from the single view. No real-device performance claim is made.

## Implementation

- `trax-bike.js`: `TRAX_PARTS`, `TRAX_STOCK`, confirmed wheel radius, proportional frame geometry, specific shock anchors, frame builder, generated/cached paint textures, stock dressing, and shop preview skeleton. The shop preview goes through the same garage build hook.
- `fitment.js`: `trax_lime` standards/geometry; short TRAX coil fitment excludes incompatible long MTB/moto shocks. `__WK_FIT_CLEAR__` removes stale adapter prompts on frame swaps.
- `frame-geometry.js`: delegates this frame to `buildTraxFrame`, preserving swept/saddle-cut tube construction.
- `parts3d.js`: frame-specific shock anchors and final stock-part dressing; rim recolouring now selects the real rim hoop and sidewall rather than the tyre sidewall.
- `thumbs.js`: complete TRAX 3D thumbnail and rotatable part-sheet model; fork previews respect part colours.
- `app.js` has three narrowly asserted string patches for this addition: prepend `__WK_EXTRA_CATALOG__` to `li`; install a frame's `stock` map (and ownership) on a new frame selection and clear stale fitment prompts; preserve the base emissive colour/intensity before a selection flash.
- `ride.js` `cloneForRide`: removes transient garage selection flashes from the cloned ride bike, retaining its real paint and light emission.
- `sw.js`: precaches `trax-bike.js`, still under the unreleased v18 cache.

## Validation

Serve with `python -m http.server 8931 --bind 127.0.0.1`, then run:

```powershell
npm run test:trax
npm run test:geometry
npm run test:slots
npm run test:wheels
```

The TRAX integration test uses normal equip operations, checks the stock preset/fitment/20-inch radius, rotatable preview and thumbnail, one shock group, reflectors and livery, component swaps and incompatible-part rejection, and a live pedal-powered ride with finite physics state. It also checks selection-glow removal before riding. Screenshots and its result are under `wk-shots/trax/`.

This addition is on `wip/v18-detail`. It is not a production release; `main` and Cloudflare remain v17 while the broader v18 work is unfinished.
