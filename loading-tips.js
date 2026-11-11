// Editable boot lines — hints, tips, and What's new for the current build.
export const LOADING_TIPS = [
  'Wheelie: hold ACCELERATE and drag that thumb down to lean back. Keys: W/Up + Shift.',
  'Stoppie: hold BRAKE and drag that thumb up to lean forward. Keys: S/Down + Space.',
  'Burnout: slide your BRAKE finger onto ACCELERATE, steer with the other hand.',
  "What's new: uneven dirt terrain lane and proper kicker jumps in the Playground.",
  'Tip: tap SLOW MO once to start — tap again to cancel.',
  'Tip: Pause → Replay → Drop In to rejoin mid-trick.',
  'Tip: Esc or P opens the pause menu anytime.',
  'Tip: Save replays to Gallery, or Save to Device for keeps.',
  'Tip: Unlimited zoom lives in More → Settings (off by default).',
  'Tip: Trials is the default race — switch to Endless from Pause.',
  'Tip: Check for update in Settings if a build feels stuck.',
  'Hint: feather throttle at the balance point for longer wheelies.',
  'Hint: land nose-high after big jumps — respect the suspension.',
  'Hint: crash Replay sits next to Recover when you bin it.',
  "What's new: no hard top-speed clamp — gearing and drag decide.",
  "What's new: graffiti wall follows the terrain again.",
  "What's new: YouTube-style replay with theatre mode.",
  "What's new: in-game Gallery for screenshots and clips.",
  "What's new: branded boot warms the workshop before you build.",
];

export function pickLoadingTip(rng = Math.random) {
  if (!LOADING_TIPS.length) return 'Loading…';
  return LOADING_TIPS[Math.floor(rng() * LOADING_TIPS.length) % LOADING_TIPS.length];
}
