// Pause FAB + centred frosted-glass menu (matches ride-glass / lounge .glass).
export function pauseMenuMarkup(level) {
  const flat = level === true || level === 'flat';
  const sample = level === 'sample3d';
  const arena = level === 'arena';
  const trials = !flat && !sample && !arena;
  return `
<button class="ride-pause-fab ride-glass" data-r="pause" aria-label="Pause ride" aria-expanded="false">
  <span class="ride-pause-fab-ico" aria-hidden="true">Ⅱ</span><span>PAUSE</span>
</button>
<section class="ride-pause-menu ride-glass" hidden role="dialog" aria-label="Paused">
  <header class="ride-pause-head">
    <strong>PAUSED</strong>
    <p>Take a breath · drop back in when ready</p>
  </header>
  <button type="button" class="ride-pause-primary" data-r="menu-resume"><span aria-hidden="true">▶</span> Resume</button>
  <div class="ride-pause-row">
    <button type="button" data-r="menu-respawn"><span aria-hidden="true">↺</span> Respawn</button>
    <button type="button" data-r="menu-restart"><span aria-hidden="true">↻</span> Restart</button>
  </div>
  <div class="ride-pause-mode" role="group" aria-label="Race mode">
    <span class="ride-pause-mode-label">Mode</span>
    <div class="ride-pause-seg">
      <button type="button" data-r="mode-trials" aria-pressed="${trials ? 'true' : 'false'}">Trials</button>
      <button type="button" data-r="mode-sample3d" aria-pressed="${sample ? 'true' : 'false'}">SAMPLE 3D</button>
      <button type="button" data-r="mode-endless" aria-pressed="${flat ? 'true' : 'false'}">Endless</button>
      <button type="button" data-r="mode-arena" aria-pressed="${arena ? 'true' : 'false'}">ARENA</button>
    </div>
  </div>
  ${arena ? `<div class="ride-pause-mode" role="group" aria-label="Physics">
    <span class="ride-pause-mode-label">Physics</span>
    <div class="ride-pause-seg">
      <button type="button" data-r="phys-classic" aria-pressed="true">Classic</button>
      <button type="button" data-r="phys-jolt" aria-pressed="false">Jolt</button>
    </div>
  </div>` : ''}
  <button type="button" class="ride-pause-replay" data-r="menu-replay"><span aria-hidden="true">●</span> Replay last 20s</button>
  <button type="button" data-r="menu-gallery"><span aria-hidden="true">🖼</span> Gallery</button>
</section>`;
}

function levelOf(opts) {
  if (opts?.level === 'flat' || opts?.level === 'sample3d' || opts?.level === 'trials' || opts?.level === 'arena') return opts.level;
  if (opts?.flat) return 'flat';
  return 'trials';
}

export function mountRidePause(ui, opts) {
  const {
    getPaused, setPaused, onRespawn, onRestart, onMode, onReplay, onGallery, onPhysics, releaseControls, rootEl,
  } = opts;
  const fab = ui.querySelector('[data-r="pause"]');
  const menu = ui.querySelector('.ride-pause-menu');
  const trialsBtn = ui.querySelector('[data-r="mode-trials"]');
  const sampleBtn = ui.querySelector('[data-r="mode-sample3d"]');
  const endlessBtn = ui.querySelector('[data-r="mode-endless"]');
  const arenaBtn = ui.querySelector('[data-r="mode-arena"]');
  const physClassic = ui.querySelector('[data-r="phys-classic"]');
  const physJolt = ui.querySelector('[data-r="phys-jolt"]');
  let current = levelOf(opts);
  let phys = opts.physics === 'jolt' ? 'jolt' : 'classic';

  function syncMode() {
    trialsBtn?.setAttribute('aria-pressed', String(current === 'trials'));
    sampleBtn?.setAttribute('aria-pressed', String(current === 'sample3d'));
    endlessBtn?.setAttribute('aria-pressed', String(current === 'flat'));
    arenaBtn?.setAttribute('aria-pressed', String(current === 'arena'));
  }
  function syncPhysics(next) {
    if (next) phys = next === 'jolt' ? 'jolt' : 'classic';
    physClassic?.setAttribute('aria-pressed', String(phys === 'classic'));
    physJolt?.setAttribute('aria-pressed', String(phys === 'jolt'));
  }

  function syncFab(paused) {
    fab.innerHTML = paused
      ? '<span class="ride-pause-fab-ico" aria-hidden="true">▶</span><span>RESUME</span>'
      : '<span class="ride-pause-fab-ico" aria-hidden="true">Ⅱ</span><span>PAUSE</span>';
    fab.setAttribute('aria-label', paused ? 'Resume ride' : 'Pause ride');
    fab.setAttribute('aria-expanded', paused ? 'true' : 'false');
    rootEl.toggleAttribute('data-wk-paused', paused);
  }

  function open() {
    setPaused(true);
    releaseControls?.();
    menu.hidden = false;
    syncFab(true);
  }
  function showMenu() {
    menu.hidden = false;
    syncFab(true);
  }
  function close(resume = true) {
    menu.hidden = true;
    if (resume) {
      setPaused(false);
      syncFab(false);
    } else syncFab(true);
  }
  function toggle() {
    if (getPaused() && !menu.hidden) close(true);
    else if (getPaused()) { menu.hidden = false; syncFab(true); }
    else open();
  }
  function pick(next) {
    if (current === next) return;
    current = next;
    syncMode();
    onMode?.(next);
  }

  fab.onclick = () => toggle();
  ui.querySelector('[data-r="menu-resume"]').onclick = () => close(true);
  ui.querySelector('[data-r="menu-respawn"]').onclick = () => { close(true); onRespawn?.(); };
  ui.querySelector('[data-r="menu-restart"]').onclick = () => { close(true); onRestart?.(); };
  ui.querySelector('[data-r="menu-replay"]').onclick = () => { menu.hidden = true; onReplay?.(); };
  ui.querySelector('[data-r="menu-gallery"]')?.addEventListener('click', () => { menu.hidden = true; onGallery?.(); });
  trialsBtn?.addEventListener('click', () => pick('trials'));
  sampleBtn?.addEventListener('click', () => pick('sample3d'));
  endlessBtn?.addEventListener('click', () => pick('flat'));
  arenaBtn?.addEventListener('click', () => pick('arena'));
  physClassic?.addEventListener('click', () => { if (phys === 'classic') return; syncPhysics('classic'); onPhysics?.('classic'); });
  physJolt?.addEventListener('click', () => { if (phys === 'jolt') return; syncPhysics('jolt'); onPhysics?.('jolt'); });
  syncMode();
  syncPhysics(phys);

  return {
    open, close, toggle, syncFab, showMenu, syncPhysics,
    setModeLabel(next) { current = next === true ? 'flat' : next === false ? 'trials' : (next || current); syncMode(); },
    get menu() { return menu; },
    get fab() { return fab; },
  };
}
