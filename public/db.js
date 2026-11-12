const ready = new Promise((resolve, reject) => {
  const request = indexedDB.open('aularaiz-local-v1', 1);
  request.onupgradeneeded = () => {
    for (const name of ['kv', 'downloads', 'outbox', 'drafts']) request.result.createObjectStore(name);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

async function transaction(store, mode, operation) {
  const db = await ready;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let result;
    const request = operation(tx.objectStore(store));
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || request.error);
    tx.onabort = () => reject(tx.error || new Error('No se pudo guardar en el dispositivo.'));
  });
}
export const get = (store, key) => transaction(store, 'readonly', (s) => s.get(key));
export const put = (store, key, value) => transaction(store, 'readwrite', (s) => s.put(value, key));
export const remove = (store, key) => transaction(store, 'readwrite', (s) => s.delete(key));
export const all = (store) => transaction(store, 'readonly', (s) => s.getAll());
