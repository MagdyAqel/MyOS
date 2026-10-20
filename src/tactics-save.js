import { mapSize } from "./world.js";
import { mapFor } from "./maps.js";
import { FORMATIONS, normalizeUpgrades } from "./tactics.js";
import { OPERATIONS } from "./career.js";
const finite = (n, max = 1000) => Number.isFinite(n) && n >= 0 && n <= max;
const pointCheck = (map) => {
  const { width, height } = mapSize(map);
  return (p) => p && finite(p.x, width) && finite(p.y, height);
};
export function checkTactics(data) {
  const point = pointCheck(mapFor(data.stage, data.map));
  if (
    data.equipment &&
    (typeof data.equipment !== "object" ||
      ["reinforced", "precision", "veteran"].some(
        (k) => typeof data.equipment[k] !== "boolean",
      ))
  )
    throw Error("تجهيزات غير صالحة");
  if (
    data.startingCash !== undefined &&
    (!Number.isInteger(data.startingCash) ||
      data.startingCash < 1000 ||
      data.startingCash > 100000)
  )
    throw Error("مال البداية غير صالح");
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
      !["move", "attackMove", "patrol", "guard"].includes(data.commandMode)) ||
    (data.operationId &&
      !OPERATIONS.some(
        (o) =>
          o.id === data.operationId &&
          ((o.stage === data.stage && o.mission === data.mission) ||
            (o.legacy?.stage === data.stage &&
              o.legacy.mission === data.mission)),
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
    equipment: b.equipment,
    startingCash: b.startingCash,
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
    attackGoal: e.attackGoal,
    repairing: e.repairing,
    repairTimer: e.repairTimer,
    stance: e.stance,
    priority: e.priority,
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
export function restoreUnitTactics(e, saved, map) {
  const point = pointCheck(map);
  if (saved.attackGoal !== undefined) {
    if (!e.speed || !point(saved.attackGoal))
      throw Error("وجهة هجوم غير صالحة");
    e.attackGoal = { x: saved.attackGoal.x, y: saved.attackGoal.y };
  }
  if (saved.repairing !== undefined || saved.repairTimer !== undefined) {
    if (
      e.speed ||
      typeof saved.repairing !== "boolean" ||
      !finite(saved.repairTimer ?? 0, 1.1)
    )
      throw Error("حالة تصليح غير صالحة");
    e.repairing = saved.repairing;
    e.repairTimer = saved.repairTimer || 0;
  }
  for (const [key, allowed] of [
    ["stance", ["normal", "hold", "attackMove", "retreat"]],
    ["priority", ["nearest", "air", "armor"]],
  ]) {
    if (saved[key] !== undefined) {
      if (!allowed.includes(saved[key])) throw Error("أمر وحدة غير صالح");
      e[key] = saved[key];
    }
  }
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
  b.startingCash = data.startingCash || b.stage.cash;
  b.rally = data.rally ? { x: data.rally.x, y: data.rally.y } : null;
  b.upgrades = normalizeUpgrades(data.upgrades);
  b.formation = data.formation || "spread";
  b.commandMode = data.commandMode || "move";
  b.operationId = data.operationId || null;
  b.groups = data.groups || {};
  b.stats = data.stats || { kills: 0, losses: 0, shots: 0, damage: 0 };
}
