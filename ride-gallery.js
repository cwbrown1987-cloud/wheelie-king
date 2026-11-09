// In-game Gallery storage (screenshots + videos). Separate from localStorage game saves.
// Future Album feature can subscribe via onGalleryChange / __WK_GALLERY__.
const DB = 'wk-gallery', STORE = 'items', VER = 1;
const listeners = new Set();

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function notify(type, item) {
  for (const fn of listeners) try { fn({ type, item }); } catch {}
  try { dispatchEvent(new CustomEvent('wk-gallery-change', { detail: { type, item } })); } catch {}
}

export function onGalleryChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function listGallery({ type } = {}) {
  const db = await openDb();
  const all = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  const rows = all.sort((a, b) => (b.created || 0) - (a.created || 0));
  return type ? rows.filter(r => r.type === type) : rows;
}

export async function addGalleryItem(item) {
  const created = item.created || Date.now();
  const row = {
    id: item.id || `gal-${created}-${Math.random().toString(36).slice(2, 7)}`,
    type: item.type, // 'video' | 'image'
    blob: item.blob,
    thumb: item.thumb || '',
    title: item.title || (item.type === 'image' ? 'Screenshot' : 'Saved run'),
    bike: item.bike || 'Bike',
    duration: item.duration || 0,
    created,
    dateLabel: item.dateLabel || new Date(created).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    state: item.state || null,
  };
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notify('add', row);
  return row;
}

export async function removeGalleryItem(id) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notify('remove', { id });
}

export async function exportGalleryItem(id) {
  const db = await openDb();
  const item = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  if (!item?.blob) return null;
  const ext = item.type === 'image' ? 'png' : ((item.blob.type || '').includes('mp4') ? 'mp4' : 'webm');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(item.blob);
  a.download = `${(item.title || 'wheelie-king').replace(/\s+/g, '-').slice(0, 40)}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2500);
  try {
    const file = new File([item.blob], a.download, { type: item.blob.type || (item.type === 'image' ? 'image/png' : 'video/webm') });
    if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: item.title });
  } catch {}
  return item;
}

// Hook reserved for a future Album feature (do not build Album here).
export const galleryAlbumHook = {
  ready: false,
  // Album may call listGallery / onGalleryChange later.
};

globalThis.__WK_GALLERY__ = {
  list: listGallery,
  add: addGalleryItem,
  remove: removeGalleryItem,
  export: exportGalleryItem,
  onChange: onGalleryChange,
  album: galleryAlbumHook,
};
