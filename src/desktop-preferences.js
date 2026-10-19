export const APPEARANCE_KEY = "myos-appearance-v1",
  NOTICES_KEY = "myos-notifications-v1";
export function parseAppearance(raw) {
  const d = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (
    !d ||
    !/^#[a-f0-9]{6}$/i.test(d.accent) ||
    !Number.isFinite(d.iconSize) ||
    d.iconSize < 28 ||
    d.iconSize > 52 ||
    !Number.isFinite(d.textScale) ||
    d.textScale < 0.9 ||
    d.textScale > 1.15
  )
    throw Error("تفضيلات عرض غير صالحة");
  return { accent: d.accent, iconSize: d.iconSize, textScale: d.textScale };
}
export function parseNotices(raw) {
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (
    !Array.isArray(data) ||
    data.length > 40 ||
    data.some(
      (x) =>
        !x ||
        typeof x.text !== "string" ||
        x.text.length > 500 ||
        typeof x.time !== "number" ||
        !Number.isFinite(x.time) ||
        typeof x.read !== "boolean",
    )
  )
    throw Error("سجل إشعارات غير صالح");
  return data;
}
