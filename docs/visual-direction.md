# Visual direction and current batch

## Authorised now

- Reference-style interactive buttons: left/right lean, centre Hop/Tailwhip/Barspin/Superman/360, right brake and green accelerator; pause/reset/endless/tilt above.
- One static scenic backdrop for the current side-view ride, with a layered 2.5D appearance. No full scene rebuild or chase camera yet.

## Future target — do not implement yet

- Chris provided two paired-view concepts: neon urban BMX track and mountain/forest/waterfall track.
- The upper half of each concept is the side view; the lower half is a third-person over-the-shoulder chase view of that same environment. Eventual camera switching is intended; these are not a request for simultaneous split screen.
- Aim for the supplied richer stylised 3D look, environmental detail and polished HUD when Chris authorises that work.
- Local reference copies are in ignored `.codex-attachments/style-reference-2026-11-05/`. They are not published assets; reattach them if continuing on a host without these local files.

## Earlier fix batch — authorised and included in the workshop release

1. Show all needed categories/stickers at smaller window sizes; improve responsive access.
2. Remove Frame Colour/Fork Colour shortcuts from the main Simple rail; keep these under Styles / Colours.
3. Nested style-menu Back should return to the previous menu rather than Home.
4. Suppress yellow warnings about necessary automatic part removal.
5. Correct fork/suspension motion: the moving assembly must follow the axle and actual fork axis.
6. Rework riding collisions and exaggerated wheelies: easy to raise until the fender scrapes, while still requiring balance. Do not retain a locked upright angle as the final behaviour.

The workshop release includes these fixes, rotation pause, labelled stats, separate Bikes/complete Kits, sticker tracing, and road/foreground layers. Full scene and chase-camera work remains deferred.

## Camera and scenery clarification — 5 Nov 2026

Chris wants the supplied images treated as the actual composition/style target: a narrow side-on road strip, stylised blue hoodie/green helmet rider, and an over-the-shoulder chase view of the same world. Use one predominantly straight track with gentle bends, not a circuit. Side mode follows the track automatically; steering input should not be required. Switch views through a smooth, snappy physical camera pan (initial target about 0.4 seconds), keeping rider and track continuous.

The long environment should develop through similar scenes without obvious repeated wallpaper; blend overlapping scenery sections and keep near/middle/far depth consistent through camera movement. A flat static backdrop cannot deliver the reference chase view. Build a shared 3D track/near environment with distant scenery behind it before enabling the camera switch. No claim of exact visual parity yet. Chris has more requirements to supply before that larger batch.

Current immediate change: shaped hoodie/helmet/face/gloves/trousers/trainers with persistent articulated meshes; narrower visible side-view road and shallower camera pitch. Camera switching, gentle-bend path following and long scenery transitions are still pending the larger batch.

## Depth preparation delivered

The track now has streamed 3D surroundings and a QA side/chase orbit for screenshots. Near and middle geometry supplies actual perspective, with a far sky image. Public camera switching, gentle turns/auto-steering, new biome transitions and full concept-image fidelity remain pending. Latest workshop glass drawer is live independently.

Smooth-ragdoll follow-up: monotone-rounded terrain, terrain-following scenery/joins and suspension-aware wheel contacts are implemented and checked. Far skyline and repeated material motifs still need artistic polish; full photographic/concept fidelity is not claimed.
