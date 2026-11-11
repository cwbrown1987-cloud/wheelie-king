import {WK_VERSION} from './version.js';
// Pause FAB + centred frosted-glass menu (matches ride-glass / lounge .glass).
export function pauseMenuMarkup(level, { legacy = false } = {}) {
  const flat = level === true || level === 'flat';
  const arena = level === 'arena';
  const trials = !flat && !arena;
  return `
<button class="ride-pause-fab ride-glass" data-r="pause" aria-label="Pause ride" aria-expanded="false">
  <span class="ride-pause-fab-ico" aria-hidden="true">Ⅱ</span><span>PAUSE</span>
</button>
<section class="ride-pause-menu ride-glass" hidden role="dialog" aria-label="Paused">
  <header class="ride-pause-head">
    <strong>PAUSED</strong>
    <p>Take a breath · drop back in when ready</p>
    <small class="ride-pause-version" data-wk-version>v${WK_VERSION}</small>
  </header>
  <button type="button" class="ride-pause-primary" data-r="menu-resume"><span aria-hidden="true">▶</span> Resume</button>
  <div class="ride-pause-row">
    <button type="button" data-r="menu-respawn"><span aria-hidden="true">↺</span> Respawn</button>
    <button type="button" data-r="menu-restart"><span aria-hidden="true">↻</span> Restart</button>
  </div>
  <div class="ride-pause-mode" role="group" aria-label="Race mode"${legacy ? '' : ' hidden'}>
    <span class="ride-pause-mode-label">Mode</span>
    <div class="ride-pause-seg">
      <button type="button" data-r="mode-trials" aria-pressed="${trials ? 'true' : 'false'}">Trials</button>
      <button type="button" data-r="mode-endless" aria-pressed="${flat ? 'true' : 'false'}">Endless</button>
      <button type="button" data-r="mode-arena" aria-pressed="${arena ? 'true' : 'false'}">PLAYGROUND</button>
    </div>
  </div>
  <button type="button" class="ride-pause-replay" data-r="menu-replay"><span aria-hidden="true">●</span> Replay last 20s</button>
  <button type="button" data-r="menu-gallery"><span aria-hidden="true">🖼</span> Gallery</button>
</section>`;
}

function levelOf(opts) {
  if (opts?.level === 'flat' || opts?.level === 'trials' || opts?.level === 'arena') return opts.level;
  if (opts?.flat) return 'flat';
  return 'trials';
}

export function mountRidePause(ui, opts) {
  const {
    getPaused, setPaused, onRespawn, onRestart, onMode, onReplay, onGallery, releaseControls, rootEl,
  } = opts;
  const fab = ui.querySelector('[data-r="pause"]');
  const menu = ui.querySelector('.ride-pause-menu');
  const trialsBtn = ui.querySelector('[data-r="mode-trials"]');
  const endlessBtn = ui.querySelector('[data-r="mode-endless"]');
  const arenaBtn = ui.querySelector('[data-r="mode-arena"]');
  let current = levelOf(opts);

  function syncMode() {
    trialsBtn?.setAttribute('aria-pressed', String(current === 'trials'));
    endlessBtn?.setAttribute('aria-pressed', String(current === 'flat'));
    arenaBtn?.setAttribute('aria-pressed', String(current === 'arena'));
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
  endlessBtn?.addEventListener('click', () => pick('flat'));
  arenaBtn?.addEventListener('click', () => pick('arena'));
  syncMode();

  return {
    open, close, toggle, syncFab, showMenu,
    setModeLabel(next) { current = next === true ? 'flat' : next === false ? 'trials' : (next || current); syncMode(); },
    get menu() { return menu; },
    get fab() { return fab; },
  };
}
