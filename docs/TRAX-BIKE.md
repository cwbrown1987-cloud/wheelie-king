# Chris's 20-inch TRAX bike

Select **FRAMES → TRAX Lime Dual-Suspension Bike**. Fitting it from another frame installs the complete matching pedal-bike setup: frame, fork, coil shock, tall quill bars, saddle, rims, tyres, rim brakes and bicycle drivetrain. You can then swap parts or add a compatible conversion kit. Re-equipping the same frame preserves your current upgrades; switching away and back restores its stock build.

The model is original procedural geometry based on Chris's supplied photographs. **Chris confirmed 20-inch wheels.** The follow-up close-ups supersede the first rear-frame approximation: the lime rear assembly pivots above the bottom bracket and its clevis carries the lower/rear eye of the diagonal shock. The upper/front shock eye bolts to a black hanger under the top tube. The stationary black seat tube passes between the paired moving stays. The lime/black speckled paint, plain TRAX/50 lettering, chrome quill stem, lime fork lowers/rims, black spokes, amber reflectors and black saddle follow the reference. No copied logo artwork or additional third-party model assets are used. Private attachments are excluded from Git.

**REAR FRAME** now contains separate lime and black TRAX swingarms, with thumbnails and rotatable previews. Each replaces the previous assembly. The short coil remains separately selectable under **SHOCK**; removing it no longer silently restores a built-in coil. Refit the TRAX stock bike, or fit its new rear-frame part from the store, when checking a build made before this slot existed.

Use **TEST MOTION** in the garage to turn the wheels, chain, sprockets and cranks; the pedals remain level on their spindles. The suspension slider demonstrates rear axle travel on the pivot arc, shock shortening and front fork telescoping. Normal ride mode uses the same visual rig. Peg/no-pedal builds keep fixed pegs and have no rotating pedal assembly.

Other dimensions, axle/BB/steerer standards, travel, tooth counts, mass and game prices are estimates for this game; they are not manufacturer specifications or measured physical fitment. The unseen side and linkage details are reconstructed from the single view. No real-device performance claim is made.

## Implementation

- `trax-bike.js`: `TRAX_PARTS`, `TRAX_STOCK`, confirmed wheel radius, proportional frame geometry, specific shock anchors, frame builder, generated/cached paint textures, stock dressing, and shop preview skeleton. The shop preview goes through the same garage build hook.
- `fitment.js`: `trax_lime` standards/geometry; short TRAX coil fitment excludes incompatible long MTB/moto shocks. `__WK_FIT_CLEAR__` removes stale adapter prompts on frame swaps.
- `frame-geometry.js`: delegates this frame to `buildTraxFrame`, preserving swept/saddle-cut tube construction.
- `parts3d.js`: frame-specific shock anchors and final stock-part dressing; rim recolouring now selects the real rim hoop and sidewall rather than the tyre sidewall.
- `thumbs.js`: complete TRAX 3D thumbnail and rotatable part-sheet model; fork previews respect part colours.
- `app.js` has three narrowly asserted string patches for this addition: prepend `__WK_EXTRA_CATALOG__` to `li`; install a frame's `stock` map (and ownership) on a new frame selection and clear stale fitment prompts; preserve the base emissive colour/intensity before a selection flash.
- `ride.js` `cloneForRide`: removes transient garage selection flashes from the cloned ride bike, retaining its real paint and light emission.
- `trax-suspension.js`: separate rear-frame meshes/clevis/dropouts, rear gear pulleys, and the short shock with deformable helix. Shock pitch changes while its wire cross-section stays circular.
- `bike-motion.js`: shared visual rig and garage bench. Rotates wheel surfaces while axle hardware/cables stay fixed; rotates gears/cranks with gearing, counter-rotates pedals, updates tangent chain paths, carries the TRAX axle/clevis around the real pivot and keeps both shock eyes on their bolts. The ride's underlying 2D integrator is retained; this is visual articulation, not a measured multibody simulation. Other frame types retain their earlier simplified rear-compression treatment.
- `partmodels.js`: named crank/pedal/peg assemblies and reusable instanced-chain animation. TRAX chain routing includes the rear cluster and two jockey wheels. Tooth counts and drivetrain dimensions remain estimates; gear shifting is not implemented.
- `sw.js`: precaches all new modules under a fresh v18 preview cache.

## Validation

Serve with `python -m http.server 8931 --bind 127.0.0.1`, then run:

```powershell
npm run test:trax
npm run test:geometry
npm run test:slots
npm run test:wheels
npm run test:mechanics
```

The TRAX integration test uses normal equip operations, checks the stock preset/fitment/20-inch radius, rotatable preview and thumbnail, one shock group, reflectors and livery, component swaps and incompatible-part rejection, and a live pedal-powered ride with finite physics state and advancing wheel/crank phases. It also checks selection-glow removal before riding. Screenshots and its result are under `wk-shots/trax/`.

`test:mechanics` checks the store rear-frame swaps/info preview; exact axle/pivot/eye alignment at five compression positions; constant pivot-to-axle radius; fixed main frame; front tyre/crown clearance; moving chain instances; level pedals; bench controls; shock removal without fallback; and a no-pedal moto drivetrain. Rest/compressed screenshots and results are in `wk-shots/trax-mechanics/`.

This addition is on `wip/v18-detail`. It is not a production release; `main` and Cloudflare remain v17 while the broader v18 work is unfinished.
