export const NOTEBOOK_KEY = "myos-notebook-v2";
const BACKUP_KEY = "myos-notebook-backup";
export function parseNotebook(raw) {
  const data = JSON.parse(raw);
  if (
    data?.version !== 2 ||
    !Array.isArray(data.notes) ||
    !data.notes.length ||
    data.notes.some(
      (n) =>
        typeof n.id !== "string" ||
        typeof n.title !== "string" ||
        typeof n.text !== "string",
    ) ||
    new Set(data.notes.map((n) => n.id)).size !== data.notes.length
  )
    throw new Error("Invalid notebook");
  return {
    version: 2,
    activeId: data.notes.some((n) => n.id === data.activeId)
      ? data.activeId
      : data.notes[0].id,
    notes: data.notes,
  };
}
export function loadNotebook(storage) {
  for (const key of [NOTEBOOK_KEY, BACKUP_KEY]) {
    try {
      const raw = storage.getItem(key);
      if (raw)
        return { data: parseNotebook(raw), recovered: key === BACKUP_KEY };
    } catch {
      /* Try the last valid backup. */
    }
  }
  let legacy = "";
  try {
    legacy = storage.getItem("myos-note") || "";
  } catch {
    /* Memory-only mode is still usable. */
  }
  return {
    data: {
      version: 2,
      activeId: "first-note",
      notes: [{ id: "first-note", title: "ملاحظتي الأولى", text: legacy }],
    },
    recovered: false,
  };
}
export function persistNotebook(storage, data) {
  const serialized = JSON.stringify(data);
  // Validate before writing and never replace a valid backup with corrupt data.
  parseNotebook(serialized);
  try {
    const previous = storage.getItem(NOTEBOOK_KEY);
    if (previous) {
      parseNotebook(previous);
      storage.setItem(BACKUP_KEY, previous);
    }
  } catch {
    /* Backup is best effort; primary save remains mandatory. */
  }
  storage.setItem(NOTEBOOK_KEY, serialized);
}
