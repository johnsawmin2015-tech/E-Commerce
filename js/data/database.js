import { DB_NAME, DB_VERSION } from "../core/config.js";
import { OBJECT_STORES } from "../core/constants.js";
import { AppError, ErrorCodes } from "../core/errors.js";
import { applyMigrations } from "./migrations.js";

const STORE_NAMES = Object.values(OBJECT_STORES);
const clone = (value) => structuredClone(value);

/** Synchronous unit of work. Reads are detached; only explicit writes commit. */
const unitOfWork = (stores) => {
  const changes = [];
  const store = (name) => {
    if (!stores.has(name)) throw new Error(`Store ${name} is outside this transaction.`);
    return stores.get(name);
  };
  return {
    changes,
    get: (name, key) => clone(store(name).get(key) ?? null),
    getAll: (name) => clone([...store(name).values()]),
    put(name, record) {
      const value = clone(record);
      const key = value.id ?? value.key;
      if (!key) throw new Error("A record requires an ID or key.");
      const uniqueField = name === "users" ? "email" : name === "coupons" ? "code" : null;
      if (uniqueField && [...store(name).values()].some((row) => row.id !== key && row[uniqueField] === value[uniqueField])) {
        throw new AppError(ErrorCodes.DUPLICATE_RECORD, `That ${uniqueField} is already in use.`);
      }
      store(name).set(key, value);
      changes.push({ name, key, value });
      return clone(value);
    },
    delete(name, key) { store(name).delete(key); changes.push({ name, key, deleted: true }); },
  };
};

const runCallback = (callback, unit) => {
  const result = callback(unit);
  if (result && typeof result.then === "function") throw new Error("Atomic callbacks must be synchronous.");
  return clone(result);
};

class MemoryBackend {
  constructor() {
    this.stores = new Map(STORE_NAMES.map((name) => [name, new Map()]));
    this.indexes = new Map();
    this.persistent = false;
    this.queue = Promise.resolve();
  }

  #store(name) {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    return this.stores.get(name);
  }

  async get(storeName, key) {
    return clone(this.#store(storeName).get(key) ?? null);
  }

  async getAll(storeName) {
    return clone([...this.#store(storeName).values()]);
  }

  async put(storeName, record) {
    return this.atomic([storeName], (tx) => tx.put(storeName, record));
  }

  async putAll(storeName, records) {
    return this.atomic([storeName], (tx) => { records.forEach((record) => tx.put(storeName, record)); return records.length; });
  }

  async delete(storeName, key) {
    return this.atomic([storeName], (tx) => { tx.delete(storeName, key); return true; });
  }

  async clear(storeName) {
    return this.atomic([storeName], (tx) => { tx.getAll(storeName).forEach((row) => tx.delete(storeName, row.id ?? row.key)); });
  }

  async count(storeName) {
    return this.#store(storeName).size;
  }

  async getAllByIndex(storeName, indexName, value) {
    return (await this.getAll(storeName)).filter((record) => record[indexName] === value);
  }

  atomic(names, callback) {
    const run = this.queue.then(() => {
      const snapshot = new Map(names.map((name) => [name, clone(this.#store(name))]));
      const unit = unitOfWork(snapshot);
      const result = runCallback(callback, unit);
      snapshot.forEach((rows, name) => this.stores.set(name, rows));
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }
}

const requestToPromise = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

class IndexedDbBackend {
  constructor(db) {
    this.db = db;
    this.persistent = true;
    db.onversionchange = () => db.close();
  }

  /** Native transactions serialize concurrent tabs and abort all staged writes. */
  atomic(storeNames, callback) {
    const names = [...new Set(storeNames)];
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(names, "readwrite");
      const snapshot = new Map();
      let result;
      let failure;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(failure || tx.error);
      tx.onabort = () => reject(failure || tx.error || new Error("Transaction aborted."));
      names.forEach((name) => {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => {
          snapshot.set(name, new Map(request.result.map((row) => [row.id ?? row.key, row])));
          if (snapshot.size !== names.length) return;
          try {
            const unit = unitOfWork(snapshot);
            result = runCallback(callback, unit);
            unit.changes.forEach((change) => {
              const target = tx.objectStore(change.name);
              if (change.deleted) target.delete(change.key);
              else target.put(change.value);
            });
          } catch (error) { failure = error; tx.abort(); }
        };
      });
    });
  }

  #tx(storeName, mode = "readonly") {
    return this.db.transaction(storeName, mode).objectStore(storeName);
  }

  async get(storeName, key) {
    return (await requestToPromise(this.#tx(storeName).get(key))) ?? null;
  }

  async getAll(storeName) {
    return requestToPromise(this.#tx(storeName).getAll());
  }

  async put(storeName, record) {
    const tx = this.db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(record);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return record;
  }

  async putAll(storeName, records) {
    if (!records.length) return 0;
    const chunkSize = 200;
    for (let index = 0; index < records.length; index += chunkSize) {
      const chunk = records.slice(index, index + chunkSize);
      const tx = this.db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      chunk.forEach((record) => store.put(record));
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    }
    return records.length;
  }

  async delete(storeName, key) {
    const tx = this.db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return true;
  }

  async clear(storeName) {
    return this.atomic([storeName], (tx) => tx.getAll(storeName).forEach((row) => tx.delete(storeName, row.id ?? row.key)));
  }

  async count(storeName) {
    return requestToPromise(this.#tx(storeName).count());
  }

  async getAllByIndex(storeName, indexName, value) {
    const store = this.#tx(storeName);
    if (!store.indexNames.contains(indexName)) {
      return (await this.getAll(storeName)).filter((record) => record[indexName] === value);
    }
    return requestToPromise(store.index(indexName).getAll(value));
  }
}

let backendPromise;

export const openIndexedDb = (name = DB_NAME) =>
  new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(name, DB_VERSION);
    request.onupgradeneeded = (event) => {
      applyMigrations(request.result, event.oldVersion, event.newVersion, request.transaction);
    };
    request.onsuccess = () => resolve(new IndexedDbBackend(request.result));
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Close other Morrow tabs and reload to finish the database upgrade."));
  });

export const isIndexedDbAvailable = () =>
  typeof globalThis.indexedDB === "object" && globalThis.indexedDB !== null;

/**
 * Open the application database. Falls back to an in-memory backend when
 * IndexedDB is unavailable (Node tests, locked-down browsers).
 */
export const openDatabase = async () => {
  if (backendPromise) return backendPromise;

  backendPromise = (async () => {
    if (!isIndexedDbAvailable()) {
      return new MemoryBackend();
    }
    return openIndexedDb();
  })();

  return backendPromise;
};

export const getDatabase = () => openDatabase();

export const atomic = async (storeNames, callback) => (await getDatabase()).atomic(storeNames, callback);

export const resetDatabaseForTests = async () => {
  backendPromise = Promise.resolve(new MemoryBackend());
  return backendPromise;
};

export const withStore = async (storeName, fn) => {
  try {
    const db = await getDatabase();
    return await fn(db, storeName);
  } catch (error) {
    throw new AppError(ErrorCodes.DATABASE_FAILURE, "The local catalog database could not complete that request.", {
      cause: error,
      details: { storeName },
    });
  }
};

export default Object.freeze({
  openDatabase,
  getDatabase,
  resetDatabaseForTests,
  withStore,
  isIndexedDbAvailable,
});
