export function imageStore(mode, action) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("myos-personalization", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("images");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction("images", mode);
      let result;
      try {
        const req = action(tx.objectStore("images"));
        req.onsuccess = () => (result = req.result);
      } catch (error) {
        db.close();
        reject(error);
        return;
      }
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error || Error("Storage aborted"));
      };
    };
  });
}

export const readWallpaper = () =>
  imageStore("readonly", (store) => store.get("custom"));
export const writeWallpaper = (blob) =>
  imageStore("readwrite", (store) =>
    blob ? store.put(blob, "custom") : store.delete("custom"),
  );
