# Test vehicle platforms

Two playable prototypes establish the component and motion contracts:

| Platform | Section | Powertrain | Status |
| --- | --- | --- | --- |
| `pit125` | Motorbikes | 125cc petrol, chain drive, footpegs | Original test pit bike; estimated game specs |
| `kaiji_test` | E-scooters | Deck battery, rear hub drive, standing rider | Provisional Kaiji name and proportions; exact make/model unconfirmed |

`vehicle-platforms.js` defines the platform, anchors, stock bill of materials, family-restricted fitment, required parts and estimated performance. `vehicle-models.js` contains the two procedural topology templates. The normal catalogue generates purchasable parts, complete presets and colour variants; the existing preview/apply/cancel path handles them.

Every component has a platform family. Colour variants retain that family. Whole-vehicle presets replace the previous build; individual components replace their slot. Scooter hubs, decks and stems cannot be installed on a bicycle or petrol bike. Petrol readiness requires its tank/exhaust/drivetrain and does not ask for an electric controller or battery. The ride uses an estimated usable fuel-energy reserve for petrol; this is an arcade prototype, without a gearbox or detailed engine simulation.

The shared motion rig uses `wkAnchors`, `wk:model:fork`, `wkFork.axis`, moving fork-lower flags, `wk:model:rearFrame`, pivot/axle/shock-eye markers and the existing sprocket/chain names. Both wheels spin; fork, swingarm, brakes and mudguards follow their mounts. Rider hand anchors and per-foot `footTargets` support the different seated and staggered standing positions; the existing detached crash and recovery system is reused.

To add a similar vehicle, add its data, compatible bill of materials and named mounting geometry, then extend the appropriate model template where the silhouette differs. A substantially different chassis needs its own template rather than reusing incompatible geometry. Keep manufacturer claims separate from visual estimates.

Run `npm run check -- vehicles mechanics modular` and the builder checks after changing the catalogue or menus. Evidence is in `wk-shots/vehicle-prototypes/`. Real-phone testing and a reference image/model confirmation for Kaiji are still needed.
