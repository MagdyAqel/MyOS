import { parseNotebook } from "./notebook.js";
import { parseFiles } from "./file-store.js";
import { restoreBattle } from "./battle-save.js";
import { parseCareer } from "./career.js";
import { parseDocuments } from "./documents.js";
import { parseAppearance, parseNotices } from "./desktop-preferences.js";
import { mapFor } from "./maps.js";
export const BACKUP_KEYS = [
  "myos-notebook-v2",
  "myos-notebook-backup",
  "myos-note",
  "myos-files-v1",
  "myos-battle-manual-v1",
  "myos-battle-auto-v1",
  "myos-campaign-v1",
  "myos-map-choice-v1",
  "myos-career-v1",
  "myos-documents-v1",
  "myos-appearance-v1",
  "myos-notifications-v1",
  "myos-theme",
  "myos-wallpaper",
  "myos-quality-v1",
  "myos-sound-v1",
];
export function validateBackup(raw) {
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (
    !data ||
    data.version !== 2 ||
    data.application !== "MyOS" ||
    !data.datasets ||
    typeof data.datasets !== "object" ||
    Array.isArray(data.datasets) ||
    JSON.stringify(data).length > 32000000 ||
    Object.keys(data.datasets).length !== BACKUP_KEYS.length ||
    Object.keys(data.datasets).some((k) => !BACKUP_KEYS.includes(k))
  )
    throw Error("اختر نسخة MyOS كاملة وصالحة");
  for (const [key, value] of Object.entries(data.datasets)) {
    if (value === null) continue;
    if (typeof value !== "string" || value.length > 4000000)
      throw Error("بيانات النسخة كبيرة أو غير صالحة");
    if (["myos-notebook-v2", "myos-notebook-backup"].includes(key))
      parseNotebook(value);
    else if (key === "myos-files-v1") parseFiles(value);
    else if (key.includes("myos-battle-")) restoreBattle(value);
    else if (key === "myos-career-v1") parseCareer(value);
    else if (key === "myos-documents-v1") parseDocuments(value);
    else if (key === "myos-appearance-v1") parseAppearance(value);
    else if (key === "myos-notifications-v1") parseNotices(value);
    else if (
      (key === "myos-theme" && !["dark", "light"].includes(value)) ||
      (key === "myos-wallpaper" &&
        ![
          "blue",
          "purple",
          "green",
          "alpine",
          "coast",
          "dunes",
          "custom",
        ].includes(value)) ||
      (key === "myos-quality-v1" &&
        !["auto", "low", "medium", "high"].includes(value))
    )
      throw Error("إعدادات عرض غير صالحة");
    else if (key === "myos-campaign-v1") {
      const d = JSON.parse(value);
      if (
        !d ||
        !Number.isInteger(d.stage) ||
        d.stage < 0 ||
        d.stage > 3 ||
        !Array.isArray(d.completed) ||
        d.completed.some((i) => !Number.isInteger(i) || i < 0 || i > 3)
      )
        throw Error("تقدم مراحل غير صالح");
    } else if (key === "myos-map-choice-v1") {
      const d = JSON.parse(value);
      if (
        !d ||
        Array.isArray(d) ||
        typeof d !== "object" ||
        Object.entries(d).some(
          ([k, id]) =>
            !["0", "1", "2", "3"].includes(k) ||
            mapFor(Number(k), id).id !== id,
        )
      )
        throw Error("خرائط غير صالحة");
    } else if (key === "myos-sound-v1") {
      const d = JSON.parse(value);
      if (
        !d ||
        typeof d !== "object" ||
        !Number.isFinite(d.volume) ||
        d.volume < 0 ||
        d.volume > 1
      )
        throw Error("مستوى صوت غير صالح");
    }
  }
  const wall = data.wallpaper;
  if (
    wall !== null &&
    (!wall ||
      !["image/jpeg", "image/png", "image/webp"].includes(wall.type) ||
      typeof wall.base64 !== "string" ||
      wall.base64.length > 18000000 ||
      wall.base64.length % 4 !== 0 ||
      !/^[a-zA-Z0-9+/]*={0,2}$/.test(wall.base64))
  )
    throw Error("خلفية النسخة غير صالحة");
  if (data.datasets["myos-wallpaper"] === "custom" && !wall)
    throw Error("النسخة تفتقد صورة الخلفية الشخصية");
  return data;
}
export function collectBackup(storage, wallpaper = null) {
  return validateBackup({
    version: 2,
    application: "MyOS",
    createdAt: new Date().toISOString(),
    datasets: Object.fromEntries(
      BACKUP_KEYS.map((k) => [k, storage.getItem(k)]),
    ),
    wallpaper,
  });
}
export function backupSummary(data) {
  const d = data.datasets;
  return {
    notes: d["myos-notebook-v2"]
      ? parseNotebook(d["myos-notebook-v2"]).notes.length
      : 0,
    files: d["myos-files-v1"]
      ? parseFiles(d["myos-files-v1"]).entries.length
      : 0,
    documents: d["myos-documents-v1"]
      ? parseDocuments(d["myos-documents-v1"]).documents.length
      : 0,
    operations: d["myos-career-v1"]
      ? parseCareer(d["myos-career-v1"]).completed.length
      : 0,
    battles: ["myos-battle-manual-v1", "myos-battle-auto-v1"].filter(
      (k) => d[k],
    ).length,
  };
}
export function writeBackupDatasets(storage, datasets) {
  for (const key of BACKUP_KEYS) storage.removeItem(key);
  for (const key of BACKUP_KEYS)
    if (datasets[key] !== null) storage.setItem(key, datasets[key]);
}
