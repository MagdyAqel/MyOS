import { FORMATIONS, normalizeUpgrades } from "./tactics.js";
import { OPERATIONS } from "./career.js";
const finite = (n, max = 1000) => Number.isFinite(n) && n >= 0 && n <= max;
const point = (p) => p && finite(p.x) && finite(p.y, 620);
export function checkTactics(data) {
  if (data.enemy?.lastHQ && !point(data.enemy.lastHQ))
    throw Error("بيانات استطلاع غير صالحة");
  if (data.rally && !point(data.rally)) throw Error("نقطة تجمع غير صالحة");
  if (
    data.upgrades &&
    ["armor", "weapons", "logistics"].some(
      (k) =>
        !Number.isInteger(data.upgrades[k]) ||
        data.upgrades[k] < 0 ||
        data.upgrades[k] > 3,
    )
  )
    throw Error("ترقيات غير صالحة");
  if (
    (data.formation && !Object.hasOwn(FORMATIONS, data.formation)) ||
    (data.commandMode &&
      !["move", "patrol", "guard"].includes(data.commandMode)) ||
    (data.operationId &&
      !OPERATIONS.some(
        (o) =>
          o.id === data.operationId &&
          o.stage === data.stage &&
          o.mission === data.mission,
      ))
  )
    throw Error("أوامر حملة غير صالحة");
  if (
    data.stats &&
    ["kills", "losses", "shots", "damage"].some(
      (k) => !finite(data.stats[k], 1e9),
    )
  )
    throw Error("إحصاءات غير صالحة");
  if (
    data.groups &&
    (typeof data.groups !== "object" ||
      Array.isArray(data.groups) ||
      Object.keys(data.groups).some((k) => !["1", "2", "3"].includes(k)) ||
      Object.values(data.groups).some(
        (v) =>
          !Array.isArray(v) ||
          v.length > 40 ||
          v.some((id) => !Number.isInteger(id)),
      ))
  )
    throw Error("مجموعات غير صالحة");
}
export function snapshotTactics(b) {
  return {
    rally: b.rally,
    formation: b.formation,
    commandMode: b.commandMode,
    upgrades: b.upgrades,
    operationId: b.operationId,
    groups: b.groups,
    stats: b.stats,
  };
}
export function snapshotUnitTactics(e) {
  return {
    velocity: e.velocity,
    hqMode: e.hqMode,
    hqTimer: e.hqTimer,
    relocation: e.relocation,
    flight: e.flight,
    depth: e.depth,
    depthTarget: e.depthTarget,
    tactical: e.tactical,
  };
}
export function restoreUnitTactics(e, saved) {
  if (saved.velocity !== undefined) {
    if (!finite(saved.velocity, 120)) throw Error("سرعة غير صالحة");
    e.velocity = saved.velocity;
  }
  for (const k of ["flight", "depth", "depthTarget"])
    if (saved[k] !== undefined) {
      if (!finite(saved[k], 1)) throw Error("حالة حركة غير صالحة");
      e[k] = saved[k];
    }
  if (e.type === "submarine") e.domain = (e.depth ?? 1) > 0.55 ? "sub" : "sea";
  if (saved.hqMode !== undefined) {
    if (
      e.type !== "hq" ||
      !["deployed", "packing", "moving", "deploying"].includes(saved.hqMode) ||
      !finite(saved.hqTimer, 3.1) ||
      (saved.hqMode !== "deployed" && !point(saved.relocation))
    )
      throw Error("حالة مقر غير صالحة");
    e.hqMode = saved.hqMode;
    e.hqTimer = saved.hqTimer;
    e.relocation = saved.relocation
      ? { x: saved.relocation.x, y: saved.relocation.y }
      : null;
  }
  const t = saved.tactical;
  if (t) {
    if (
      !e.speed ||
      !["patrol", "guard"].includes(t.kind) ||
      (t.kind === "patrol" && (!point(t.origin) || !point(t.destination))) ||
      (t.kind === "guard" &&
        (!Number.isInteger(t.target) || !finite(t.offset, 40)))
    )
      throw Error("دورية غير صالحة");
    e.tactical =
      t.kind === "patrol"
        ? {
            kind: t.kind,
            origin: { ...t.origin },
            destination: { ...t.destination },
            returning: t.returning === true,
          }
        : { kind: t.kind, target: t.target, offset: t.offset };
  }
}
export function restoreTactics(b, data) {
  b.rally = data.rally ? { x: data.rally.x, y: data.rally.y } : null;
  b.upgrades = normalizeUpgrades(data.upgrades);
  b.formation = data.formation || "spread";
  b.commandMode = data.commandMode || "move";
  b.operationId = data.operationId || null;
  b.groups = data.groups || {};
  b.stats = data.stats || { kills: 0, losses: 0, shots: 0, damage: 0 };
}
