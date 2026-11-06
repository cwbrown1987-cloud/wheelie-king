# Wheelie King — current roadmap

Owner decisions consolidated 7 Nov 2026 from both engineering notes and the subsequent chat. This file records priorities; CODEX-HANDOFF.md is the concise operational resume. Historical checkpoints remain archived.

## This round

- [x] Menus: one compatible parts list, correct matching stems/adapters, incomplete-build visibility and dependable Back/preview flow.
- [x] Basic-only Crazy Builds: add a couple of original test components; physical/electrical fit remains required; mode changes preserve installed parts.
- [x] Ride: remove indefinite assisted moto wheelies; allow recoverable scrapes and genuine loop-outs. Preserve hops, landings, stunts, ragdoll and instant recovery.
- [x] Audit powertrain/stat transfer and make only justified small fixes; benchmark stepping before considering a timing rewrite.
- [ ] Continue shop product models/previews (shoe/hoodie detail pass shipped), reusing the worn-item geometry and shared rider dimensions.
- [ ] Finish the genuine 3D garage/workshop room: all room surfaces, rides, shelves and toolbox share one camera. Keep free Edit dragging, floor rotation handles, lift and autosave.
- [ ] Verify each batch and push development checkpoints. Update main and deploy the game only once, at the final verified checkpoint of this round.

## Product principles

Build → modify → inspect → ride → test → improve. One authoritative installed configuration is shared by Basic/Advanced, garage, riding and eventual mechanics. Kits resolve into actual components. Preserve cloneForRide(), original assets and meaningful component effects. Standard Basic is accessible; extra-crazy builds are offered only through Basic's optional Crazy Builds setting. Advanced cannot create new extra-crazy builds, but existing bikes survive mode switches.

## Next live-game milestones

- Vehicle parameter contract: explicit human/electric/petrol classification, W/Nm/kg/m/Wh units, installed effective speed, energy capacity and drive axle. No second wallet or divergent build state.
- Owned Workshop inventory: starter BMX + scooter; owned/cheap parts; purchase entry to simulated stores; moto unlock at level 5 and one basic race reward. Preserve saves, upgrades and developer infinite money. Earlier partial work is stashed, not shipped.
- Mobile HUD/readability and actual Android/iPad performance confirmation.
- Track/trick reward audit: provisional versus landed scores, one-time payouts; later coin pickups using the existing wallet.
- Improve the current chunk-streamed track, contacts, materials, lighting and grounded props; do not rebuild all tracks or environments.

## Isolated future 3D riding

Keep public chase/steering disabled. Retain authoritative longitudinal/pitch physics. First define a shared lateral/heading adapter and track-coordinate contract; then separated heading/pitch/roll/stunt transforms, configurable width/boundaries, development-only steering and heading-following camera. Side/chase eventually share one world/state, including airborne and wheelie transitions around 0.4 seconds. No physics resets, equipment changes, scores or teleports during switching. Curved/banked centreline tracks follow straight-track validation. Prioritise two live improvements for each experimental step where practical.

## Mechanical depth — later

- Distinguish catalogue definition IDs from installed-instance IDs and stable assembly paths.
- Derive a read-only assembly manifest from existing configuration, linking geometry, mount transforms, interfaces and animation bindings. Do not create a parallel component database.
- Preserve class-specific assemblies. Extend optional dimensions, provenance, material, specifications, dependencies and inspection metadata gradually; unknown values remain unknown.
- Add component highlighting/comparison and one inspection workflow before disassembly.
- Later, remove major assemblies, then a small number of fasteners/tools/ordered installation and exploded views. Do not simulate hundreds of bolts or reactivate repair/condition systems.
- Share IDs/models with ride/inspection LODs. Detailed visuals do not imply individual rigid bodies.

## Other deferred features

- Customisable helmets, tops/hoodies/jackets, pants/shorts, gloves, shoes and accessories keep reusable base styles/themes and fitted shared rider mounts.
- Crash pause/orbit and eventually historical snapshot replay/scrubbing; freezing a scene is not replay. Optional fictional comic impact reports only.
- Small reactive-audio prototype, then shared audio manager driven by load, RPM/wheel speed, brakes, suspension and impacts.
- Skateboards/e-skateboards/kick/stunt scooters remain future classes, never forced into bicycle-specific assemblies.
- Future themed bundles and store rarity remain in-game only. No real-money payments.

## Restrictions and validation

Do not replace Three.js or the existing physics, enable unfinished chase/free roam/multiplayer, reactivate repairs, remove stunts/installed-part simulation, or run through the entire backlog automatically. Keep work reversible and milestone-sized. Preserve original art; reference images are visual targets, not proof of existing quality. Only the TRAX wheel size (20 inch) is measured/confirmed.

Tests should cover fitment/kit/mode persistence, garage-to-ride identity, vehicle classes/units, wheelies/landings/tricks/crashes/recovery, touch release, camera/world transforms, bounded streaming/disposal and normal/low-detail graphics. Compare adaptive and fixed-step behaviour before timing changes. Real-device feel/performance must be reported separately from Chromium emulation. End-of-task reports distinguish completed/changed/tested/risks/performance/committed/deployed/next.
