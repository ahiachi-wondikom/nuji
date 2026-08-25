// ============================================================
// Offline contribution queue — IndexedDB-backed, syncs when online.
// Industry-standard pattern: queue locally (blobs included),
// flush in order on 'online' + periodic retry + on app start.
// ============================================================
const DB_NAME = 'nuji-offline';
const STORE = 'queue';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no-idb'));
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore(STORE, { keyPath: 'id' }); };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}

export async function queuePush(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function queueAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    rq.onsuccess = () => resolve(rq.result || []);
    rq.onerror = () => reject(rq.error);
  });
}

export async function queueDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function queueCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, 'readonly').objectStore(STORE).count();
    rq.onsuccess = () => resolve(rq.result || 0);
    rq.onerror = () => reject(rq.error);
  });
}
