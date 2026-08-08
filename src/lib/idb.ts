import { IDB_CONFIG } from "./constants";

// ───────────────────────────────────────────────────────────────────────────
// Minimal Promise-based IndexedDB key-value store.
// Used for autosave of the heavy app state (datasets, formulation, etc).
// ───────────────────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(IDB_CONFIG.dbName, IDB_CONFIG.dbVersion);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_CONFIG.storeName)) {
        db.createObjectStore(IDB_CONFIG.storeName);
      }
    };
  });
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.storeName, "readwrite");
      tx.objectStore(IDB_CONFIG.storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IDB set failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IDB set aborted"));
    });
    db.close();
  } catch {
    // IndexedDB may be unavailable (private mode, etc.) — fail silently.
  }
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    const result = await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.storeName, "readonly");
      const req = tx.objectStore(IDB_CONFIG.storeName).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error ?? new Error("IDB get failed"));
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

export async function idbDel(key: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.storeName, "readwrite");
      tx.objectStore(IDB_CONFIG.storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IDB del failed"));
    });
    db.close();
  } catch {
    // fail silently
  }
}
