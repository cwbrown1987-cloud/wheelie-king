# Make a Wheelie King part

Start with a rigid visual item: brake rotor, controller case, battery housing, wheel stand or simple accessory. Send the .js module and a preview/reference to Codex. Keep vehicle logic, fitment, catalogue registration and physics out of the file; those are connected after review.

## Contract

- ES module, no imports/dependencies, network calls, globals, DOM, timers or animation loops.
- Export `metadata` and `createPart(THREE, options = {})`; the function returns one THREE.Group.
- Accept `options.color` and numeric `options.size` in metres. Document the dimension controlled by size; for this rotor it is the outer diameter (0.160 or 0.203). The template also accepts legacy `diameter`; `size` takes precedence.
- Metres, Y up. The attachment point is local (0,0,0). State the mounting axis and orientation explicitly.
- Name meaningful meshes; expose sensible colour/size options. Use MeshStandardMaterial and smooth but mobile-sized geometry.
- Preserve original designs. Use reference/specification data lawfully; label unknown dimensions as estimates.
- Dispose only resources your module owns. Do not touch shared game materials, renderers or scenes.
- This folder is not shipped in the game. Modules are reviewed and adapted before integration.

## Copy/paste prompt for another AI

Create one original, game-ready Three.js part for Wheelie King: [DESCRIBE PART]. Output one standalone JavaScript ES module following the attached part-template.js contract. Export metadata and createPart(THREE, options = {}), returning a named THREE.Group. Use metres, Y up, a documented mount origin/axis, named submeshes and reusable MeshStandardMaterial instances. No imports, network calls, browser globals, DOM, physics, UI, render loops or changes to other files. Aim for under 8,000 triangles and a few materials. Use smooth silhouettes and model only details visible in a mobile game; specify estimated dimensions honestly. Accept {color, size}; size is a numeric dimension in metres, with its meaning documented in metadata or comments. Include a neutral default. Do not register it in the game catalogue. Explain its mount orientation and bounding dimensions in metadata.

For rotor parts, start with a 160 mm or 203 mm rotor and keep its centre at the origin, face normal along +Z. For clothing, ask Codex for the shared rider template first; do not invent a separate body/skeleton. Existing character reference dimensions are in rider-spec.js.
