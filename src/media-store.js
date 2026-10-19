export const MEDIA_LIMIT = 18 * 1024 * 1024,
  MEDIA_FILE_LIMIT = 12 * 1024 * 1024;
export const mediaType = (type) =>
  /^(image\/(png|jpeg|webp|gif)|application\/pdf|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+)$/i.test(
    type,
  );
function library(mode, action) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("myos-media", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("files", { keyPath: "id" });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction("files", mode),
        store = tx.objectStore("files");
      let result;
      tx.oncomplete = () => {
        db.close();
        resolve(result);
        if (mode === "readwrite")
          window.dispatchEvent(new Event("myos:media-changed"));
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(
          tx.failure ||
            tx.error ||
            Error("تعذّر حفظ الوسائط؛ التخزين غير متاح أو ممتلئ"),
        );
      };
      try {
        action(store, (value) => (result = value), tx);
      } catch (error) {
        tx.abort();
        db.close();
        reject(error);
      }
    };
  });
}
export const listMedia = () =>
  library("readonly", (store, done) => {
    store.getAll().onsuccess = (e) => done(e.target.result);
  });
export const readMedia = (id) =>
  library("readonly", (store, done) => {
    store.get(id).onsuccess = (e) => done(e.target.result);
  });
export function validateMediaRecords(records) {
  if (
    !Array.isArray(records) ||
    records.length > 60 ||
    new Set(records.map((r) => r?.id)).size !== records.length
  )
    throw Error("مكتبة وسائط غير صالحة");
  let total = 0;
  for (const r of records) {
    if (
      !r ||
      typeof r.id !== "string" ||
      r.id.length > 100 ||
      typeof r.name !== "string" ||
      !r.name.trim() ||
      r.name.length > 120 ||
      !mediaType(r.type) ||
      !Number.isInteger(r.size) ||
      r.size < 0 ||
      r.size > MEDIA_FILE_LIMIT ||
      typeof r.deleted !== "boolean"
    )
      throw Error("ملف وسائط غير صالح");
    total += r.size;
  }
  if (total > MEDIA_LIMIT)
    throw Error(
      "حد مكتبة الوسائط 18 ميغابايت؛ نزّل الملفات القديمة وأفرغ السلة",
    );
  return records;
}
export function saveMedia(file) {
  if (!mediaType(file.type) || file.size > MEDIA_FILE_LIMIT)
    throw Error("لحفظ الوسائط: صورة أو PDF أو صوت أو فيديو حتى 12 ميغابايت");
  const record = {
    id: crypto.randomUUID(),
    name: file.name.slice(0, 120) || "وسائط",
    type: file.type,
    size: file.size,
    deleted: false,
    blob: file,
  };
  return library("readwrite", (store, done, tx) => {
    store.getAll().onsuccess = (e) => {
      try {
        validateMediaRecords([...e.target.result, record]);
        store.put(record);
        done(record);
      } catch (error) {
        tx.failure = error;
        tx.abort();
      }
    };
  });
}
export const changeMedia = (id, operation) =>
  library("readwrite", (store, done) => {
    store.get(id).onsuccess = (e) => {
      const r = e.target.result;
      if (!r) return;
      if (operation === "delete") store.delete(id);
      else {
        r.deleted = operation === "trash";
        store.put(r);
      }
      done(true);
    };
  });
export function replaceMedia(records) {
  validateMediaRecords(records);
  for (const r of records)
    if (
      !(r.blob instanceof Blob) ||
      r.blob.size !== r.size ||
      r.blob.type !== r.type
    )
      throw Error("محتوى وسائط غير صالح");
  return library("readwrite", (store) => {
    store.clear();
    for (const r of records) store.put(r);
  });
}
export const mediaFile = (r) => new File([r.blob], r.name, { type: r.type });
