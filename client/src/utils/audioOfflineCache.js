/**
 * audioOfflineCache.js
 * Caché persistente de ArrayBuffers de audio usando IndexedDB.
 * Sobrevive recargas de página y cierres de pestaña — a diferencia del Map en memoria.
 */

const DB_NAME = "iglesia_audio_v1";
const STORE   = "tracks";
const VERSION = 1;

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE);
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

/** Recupera un ArrayBuffer por fileId. Devuelve null si no existe. */
export async function idbGet(fileId) {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(fileId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => resolve(null);
    });
  } catch { return null; }
}

/** Guarda un ArrayBuffer en IDB. Falla silenciosamente si no hay espacio. */
export async function idbSet(fileId, arrayBuffer) {
  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(arrayBuffer, fileId);
      tx.oncomplete = resolve;
      tx.onerror    = resolve; // fallo silencioso
    });
  } catch {}
}

/** Comprueba si un fileId está en IDB. */
export async function idbHas(fileId) {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).count(fileId);
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror   = () => resolve(false);
    });
  } catch { return false; }
}

/** Elimina todos los tracks del IDB (limpiar caché offline). */
export async function idbClear() {
  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = resolve;
      tx.onerror    = resolve;
    });
  } catch {}
}

/**
 * Estadísticas del caché offline.
 * @returns {{ count: number, bytes: number }}
 */
export async function idbStats() {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      let count = 0;
      let bytes = 0;
      const req = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          count++;
          bytes += cursor.value?.byteLength ?? 0;
          cursor.continue();
        } else {
          resolve({ count, bytes });
        }
      };
      req.onerror = () => resolve({ count: 0, bytes: 0 });
    });
  } catch { return { count: 0, bytes: 0 }; }
}

/** Formatea bytes en MB legible */
export function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
