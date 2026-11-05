# Rider direction and crash behaviour

Chris's references, 5 Nov 2026:

- `ChatGPT Image Nov 5, 2026, 09_26_48 PM-1.png`: riding/crouching/mono/hop and airborne poses.
- `ChatGPT Image Nov 5, 2026, 09_26_52 PM-2.png`: airborne loss of balance, separated rider, impact, tumble and resting poses.

Target: a smooth stylised 3D character suited to the neon game, with a full-face lime helmet/dark visor, blue hoodie/jacket, dark trousers, red/black gloves and trainers. References are anatomy, clothing and motion guidance, not 2D sprites to attach to the bike.

Helmet, gloves, pants, tops, jackets and shoes must be separable appearance slots with later style/colour customisation. The full gear store/customisation UI is future work.

Authorised crash behaviour: rider detaches from the bike with inherited momentum, articulated off-bike ragdoll and ground-impact response; bike falls independently. Remove the current attached-rider scripted spinning crash. Provide an immediately available Recover button and keyboard recovery. Keep forgiving riding/mono physics; genuine impacts still crash. Restore the character, bike and controls cleanly on recovery, without accumulating meshes/listeners.

Use constrained physical motion and gravity for the ragdoll, not a fixed fall animation. Test separation, ground penetration/joint stability, energy settling, repeat recoveries and reattachment. Full photographic character fidelity remains a visual target; do not claim it from a primitive mesh update.

Race polish added by Chris: smooth/seamless terrain and joins, grounded props instead of floating scenery, and prevention of map clipping. Use the same terrain surface for visuals and contacts.
