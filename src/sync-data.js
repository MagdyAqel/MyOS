import { parseCareer } from "./career.js";
import { parseDocuments } from "./documents.js";
import { parseNotebook, NOTEBOOK_KEY } from "./notebook.js";
import { parseFiles, FILES_KEY } from "./file-store.js";
import { restoreBattle, BATTLE_MANUAL, BATTLE_AUTO } from "./battle-save.js";
export const SYNC_KEYS = [
  NOTEBOOK_KEY,
  FILES_KEY,
  BATTLE_MANUAL,
  BATTLE_AUTO,
  "myos-career-v1",
  "myos-documents-v1",
  "myos-campaign-v1",
  "myos-map-choice-v1",
];
const BACKUP = "myos-sync-rollback-v1";
export function validateSyncSnapshot(snapshot) {
  if (
    !snapshot ||
    snapshot.version !== 1 ||
    !snapshot.datasets ||
    typeof snapshot.datasets !== "object" ||
    Array.isArray(snapshot.datasets) ||
    JSON.stringify(snapshot).length > 3000000
  )
    throw Error("نسخة المزامنة غير صالحة أو كبيرة جدًا");
  const clean = {};
  for (const [key, value] of Object.entries(snapshot.datasets)) {
    if (
      !SYNC_KEYS.includes(key) ||
      typeof value !== "string" ||
      value.length > 1600000
    )
      throw Error("محتوى مزامنة غير مسموح");
    if (key === NOTEBOOK_KEY) parseNotebook(value);
    else if (key === FILES_KEY) parseFiles(value);
    else if (key === "myos-career-v1") parseCareer(value);
    else if (key === "myos-documents-v1") parseDocuments(value);
    else if ([BATTLE_MANUAL, BATTLE_AUTO].includes(key)) restoreBattle(value);
    else {
      const data = JSON.parse(value);
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw Error("إعدادات تقدم غير صالحة");
      if (
        key === "myos-campaign-v1" &&
        (!Number.isInteger(data.stage) ||
          data.stage < 0 ||
          data.stage > 3 ||
          !Array.isArray(data.completed) ||
          data.completed.some((n) => !Number.isInteger(n) || n < 0 || n > 3))
      )
        throw Error("تقدم غير صالح");
    }
    clean[key] = value;
  }
  return {
    version: 1,
    createdAt: typeof snapshot.createdAt === "string" ? snapshot.createdAt : "",
    datasets: clean,
  };
}
export function exportSyncSnapshot(storage) {
  const datasets = {};
  for (const key of SYNC_KEYS) {
    const value = storage.getItem(key);
    if (value !== null) datasets[key] = value;
  }
  return validateSyncSnapshot({
    version: 1,
    createdAt: new Date().toISOString(),
    datasets,
  });
}
export function snapshotSummary(snapshot) {
  const d = snapshot.datasets;
  return {
    notes: d[NOTEBOOK_KEY] ? parseNotebook(d[NOTEBOOK_KEY]).notes.length : 0,
    documents: d["myos-documents-v1"]
      ? parseDocuments(d["myos-documents-v1"]).documents.length
      : 0,
    files: d[FILES_KEY]
      ? parseFiles(d[FILES_KEY]).entries.filter(
          (e) => e.kind === "file" && !e.deleted,
        ).length
      : 0,
    battles: [BATTLE_MANUAL, BATTLE_AUTO].filter((key) => d[key]).length,
  };
}
export function applySyncSnapshot(storage, raw) {
  const snapshot = validateSyncSnapshot(raw),
    previous = {};
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("myos:before-data-restore"));
  for (const key of Object.keys(snapshot.datasets))
    previous[key] = storage.getItem(key);
  storage.setItem(BACKUP, JSON.stringify(previous));
  try {
    for (const [key, value] of Object.entries(snapshot.datasets))
      storage.setItem(key, value);
  } catch (error) {
    for (const [key, value] of Object.entries(previous)) {
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch {
        /* Retain the backup for manual recovery. */
      }
    }
    throw Error("تعذّر الاستيراد؛ احتُفظ بنسخة تراجع محلية.");
  }
  return snapshot;
}
export function undoSyncRestore(storage) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("myos:before-data-restore"));
  const raw = storage.getItem(BACKUP);
  if (!raw) throw Error("لا توجد نسخة تراجع");
  const backup = JSON.parse(raw);
  if (
    !backup ||
    typeof backup !== "object" ||
    Object.keys(backup).some((key) => !SYNC_KEYS.includes(key))
  )
    throw Error("نسخة التراجع غير صالحة");
  for (const [key, value] of Object.entries(backup)) {
    if (value === null) storage.removeItem(key);
    else if (typeof value === "string") storage.setItem(key, value);
    else throw Error("نسخة التراجع غير صالحة");
  }
  storage.removeItem(BACKUP);
}
