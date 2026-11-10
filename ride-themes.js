// Level look as data. A new level = a new theme entry (usually deriveTheme(base, {small changes})).
// The skatepark values below are exactly what the ride used before this file existed.
export const THEMES = {
  skatepark: {
    name: 'Neon skatepark at dusk',
    background: '#55516d',
    fog: { color: '#7a6c88', near: 28, far: 150 },
    hemi: { sky: '#d3d4ff', ground: '#725d89', intensity: 1.8 },
    sun: { color: '#ffd7c6', intensity: 2.4 },
    sky: { low: [.98, .6, .3], high: [.25, .45, .85] }, // fallback gradient if the backdrop image fails
    sunDisc: '#fff3b0',
    backdrop: { image: './icons/neon-skatepark-background.webp', widthFactor: .3, height: .6, offsetY: .4, sway: .08 },
    environment: {
      artSource: './icons/neon-skatepark-background.webp', // wall art is sampled from this picture
      palette: { paving: '#393a50', wall: '#ddd0ce', concrete: '#8a8492', barrels: ['#7d4250', '#3b5f76'], neon: '#8df3ff', neonGlow: '#32d4ff' },
    },
  },
};

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
export function deriveTheme(base, changes = {}) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(changes)) out[k] = isObj(v) && isObj(base?.[k]) ? deriveTheme(base[k], v) : v;
  return out;
}

// Example of "reuse and slightly alter": same park, later at night. Not wired to a level yet.
THEMES['skatepark-night'] = deriveTheme(THEMES.skatepark, {
  name: 'Neon skatepark at night',
  background: '#1d1b2e', fog: { color: '#262338', far: 80 },
  hemi: { sky: '#8f93ff', ground: '#3a2c55', intensity: 1.2 }, sun: { color: '#b8c4ff', intensity: 1.1 },
  environment: { palette: { neon: '#ff7ae6', neonGlow: '#ff3fd0' } },
});

export function getTheme(name) {
  let key = name; try { key ??= globalThis.localStorage?.getItem('wk-theme') } catch {}
  return THEMES[key] || THEMES.skatepark;
}
