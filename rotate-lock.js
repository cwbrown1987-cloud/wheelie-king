// Landscape-only: on a touch device held in portrait, cover the screen and freeze the ride.
const STYLE = `
.wk-rotate-lock{position:fixed;inset:0;z-index:20000;display:none;align-items:center;justify-content:center;padding:24px;background:#050706f5;color:#edfdf4;text-align:center;pointer-events:auto}
.wk-rotate-lock.is-on{display:flex}
.wk-rotate-lock[hidden]{display:none!important}
.wk-rotate-lock-card{width:min(420px,90vw);padding:28px 22px 24px;border-radius:18px;background:linear-gradient(180deg,#1c3a2cee,#0d1a14f0);border:1px solid #b8ffd5;box-shadow:0 0 28px #35e07a55,inset 0 1px 0 #ffffff33}
.wk-rotate-lock-phone{width:36px;height:60px;margin:0 auto 14px;border:3px solid #03200e;border-radius:8px;background:linear-gradient(180deg,#a6f5b0,#13b45c);box-shadow:0 0 16px #35e07a99;animation:wk-rotate-phone 1.4s ease-in-out infinite}
@keyframes wk-rotate-phone{0%,100%{transform:rotate(0deg)}40%,60%{transform:rotate(90deg)}}
.wk-rotate-lock-card strong{display:block;margin:0 0 8px;color:#8cfca9;font:900 22px system-ui,Bungee,Impact,sans-serif;letter-spacing:.08em}
.wk-rotate-lock-card p{margin:0;color:#d9ffe8;font:600 14px system-ui,sans-serif}
`;

function isTouch() {
  return (navigator.maxTouchPoints || 0) > 0 || matchMedia('(pointer:coarse)').matches;
}

function isPortrait() {
  return matchMedia('(orientation: portrait)').matches || innerHeight > innerWidth;
}

function mount() {
  if (document.querySelector('.wk-rotate-lock')) return document.querySelector('.wk-rotate-lock');
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);
  const el = document.createElement('div');
  el.className = 'wk-rotate-lock';
  el.id = 'wk-rotate-lock';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Rotate your phone');
  el.innerHTML = '<div class="wk-rotate-lock-card"><div class="wk-rotate-lock-phone" aria-hidden="true"></div><strong>ROTATE YOUR PHONE</strong><p>Wheelie King is landscape only.</p></div>';
  document.body.append(el);
  return el;
}

function sync() {
  const el = mount();
  const on = isTouch() && isPortrait();
  el.classList.toggle('is-on', on);
  el.hidden = !on;
  document.body.classList.toggle('wk-portrait-lock', on);
  document.body.toggleAttribute('data-wk-portrait-lock', on);
  return on;
}

function start() {
  mount();
  sync();
  const mq = matchMedia('(orientation: portrait)');
  mq.addEventListener?.('change', sync);
  addEventListener('resize', sync);
  addEventListener('orientationchange', sync);
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start, { once: true });
else start();

globalThis.__WK_ROTATE_LOCK__ = { sync, isTouch, isPortrait, get active() { return document.body.classList.contains('wk-portrait-lock'); } };
