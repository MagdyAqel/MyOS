export const FILES_KEY = "myos-files-v1";
const nameValid = (name) =>
  typeof name === "string" &&
  name.trim().length > 0 &&
  name.length <= 120 &&
  !/[\\/\0]/.test(name);
export function initialFiles() {
  return {
    version: 1,
    entries: [
      {
        id: "documents",
        name: "المستندات",
        parent: "root",
        kind: "folder",
        text: "",
        deleted: false,
      },
      {
        id: "pictures",
        name: "الصور",
        parent: "root",
        kind: "folder",
        text: "",
        deleted: false,
      },
      {
        id: "downloads",
        name: "التنزيلات",
        parent: "root",
        kind: "folder",
        text: "",
        deleted: false,
      },
      {
        id: "welcome",
        name: "مرحبًا.txt",
        parent: "root",
        kind: "file",
        text: "مرحبًا بك في MyOS. أنشئ ملفاتك وحرّرها هنا. تحفظ الملفات على هذا المتصفح؛ نزّل نسخة للاحتفاظ بها خارجه.",
        deleted: false,
      },
    ],
  };
}
export function parseFiles(raw) {
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.entries) ||
    data.entries.length > 250
  )
    throw Error("بيانات ملفات غير صالحة");
  const ids = new Set();
  for (const e of data.entries) {
    if (
      !e ||
      typeof e.id !== "string" ||
      e.id.length > 100 ||
      e.id === "root" ||
      ids.has(e.id) ||
      !nameValid(e.name) ||
      !["file", "folder"].includes(e.kind) ||
      typeof e.text !== "string" ||
      e.text.length > 600000 ||
      typeof e.parent !== "string" ||
      typeof e.deleted !== "boolean"
    )
      throw Error("ملف غير صالح");
    ids.add(e.id);
  }
  for (const e of data.entries) {
    const chain = new Set([e.id]);
    let parent = e.parent;
    while (parent !== "root") {
      if (chain.has(parent)) throw Error("حلقة مجلدات غير صالحة");
      chain.add(parent);
      const folder = data.entries.find(
        (f) => f.id === parent && f.kind === "folder",
      );
      if (!folder) throw Error("المجلد الأب غير موجود");
      parent = folder.parent;
    }
  }
  return data;
}
export function loadFiles(storage) {
  try {
    const raw = storage.getItem(FILES_KEY);
    if (raw) return parseFiles(raw);
  } catch {
    /* A damaged store is reported by the UI before any replacement. */
  }
  return initialFiles();
}
export function mutateFiles(storage, change) {
  const current = storage.getItem(FILES_KEY),
    data = current ? parseFiles(current) : initialFiles();
  const copy = structuredClone(data);
  change(copy);
  parseFiles(copy);
  if (JSON.stringify(copy).length > 1500000)
    throw Error("بلغت الملفات حد التخزين المحلي؛ نزّل نسخًا ثم أفرغ السلة");
  storage.setItem(FILES_KEY, JSON.stringify(copy));
  return copy;
}
export function descendants(data, id) {
  const ids = new Set([id]);
  let count;
  do {
    count = ids.size;
    for (const e of data.entries) if (ids.has(e.parent)) ids.add(e.id);
  } while (ids.size !== count);
  return ids;
}
export function createFile(
  data,
  { id, name, parent = "root", kind = "file", text = "" },
) {
  name = name.trim();
  if (!nameValid(name)) throw Error("أدخل اسمًا صالحًا دون شرطة مائلة");
  if (
    data.entries.some(
      (e) => !e.deleted && e.parent === parent && e.name === name,
    )
  )
    throw Error("يوجد عنصر بهذا الاسم");
  if (
    parent !== "root" &&
    !data.entries.some(
      (e) => e.id === parent && e.kind === "folder" && !e.deleted,
    )
  )
    throw Error("المجلد غير موجود");
  data.entries.push({
    id,
    name: name.trim(),
    parent,
    kind,
    text,
    deleted: false,
  });
}
export function trashFile(data, id, restore = false) {
  const root = data.entries.find((e) => e.id === id);
  if (!root) throw Error("العنصر غير موجود");
  const ids = descendants(data, id);
  if (!restore) {
    for (const e of data.entries)
      if (ids.has(e.id) && !e.deleted) {
        e.deleted = true;
        e.trashedBy = id;
      }
    return;
  }
  const parent = data.entries.find((e) => e.id === root.parent);
  if (parent?.deleted) root.parent = "root";
  for (const e of data.entries)
    if (ids.has(e.id) && e.deleted && (!e.trashedBy || e.trashedBy === id)) {
      e.deleted = false;
      delete e.trashedBy;
      const base = e.name;
      let suffix = 1;
      while (
        data.entries.some(
          (other) =>
            other.id !== e.id &&
            !other.deleted &&
            other.parent === e.parent &&
            other.name === e.name,
        )
      )
        e.name = base.slice(0, 100) + " (" + suffix++ + ")";
    }
}
export function removeFile(data, id) {
  const ids = descendants(data, id);
  data.entries = data.entries.filter((e) => !ids.has(e.id));
}
