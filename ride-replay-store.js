// Compat shim: replay library reads/writes gallery video items.
import { listGallery, addGalleryItem, removeGalleryItem } from './ride-gallery.js';
export { thumbFromVideo } from './ride-gallery-thumb.js';

export async function listReplays() {
  return listGallery({ type: 'video' });
}
export async function saveReplay(clip) {
  const row = await addGalleryItem({ ...clip, type: 'video' });
  return row.id;
}
export async function deleteReplay(id) {
  return removeGalleryItem(id);
}
