import { findRoute, moveUnit, walkable } from "./navigation.js";
export const FORMATIONS = {
  line: "خط دفاع",
  column: "رتل",
  wedge: "رأس سهم",
  spread: "انتشار",
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const normalizeUpgrades = (value = {}) =>
  Object.fromEntries(
    ["armor", "weapons", "logistics"].map((k) => [
      k,
      Math.max(0, Math.min(3, Number.isInteger(value[k]) ? value[k] : 0)),
    ]),
  );
export function initializeTactics(b, options = {}) {
  b.rally = null;
  b.formation = "spread";
  b.commandMode = "move";
  b.groups = {};
  b.stats = { kills: 0, losses: 0, shots: 0, damage: 0 };
  b.statsRed = { kills: 0, losses: 0, shots: 0, damage: 0 };
  b.operationId = options.operationId || null;
  for (const e of b.entities) {
    if (e.type === "hq") {
      e.hqMode = "deployed";
      e.hqTimer = 0;
    }
    if (e.domain === "air") e.flight = 1;
    if (e.type === "submarine") e.depth = 1;
  }
}
export function formationPoint(b, index, count, x, y) {
  let dx = 0,
    dy = 0;
  const gap = 38;
  if (b.formation === "line") dy = (index - (count - 1) / 2) * gap;
  else if (b.formation === "column") dx = -index * gap;
  else if (b.formation === "wedge") {
    dx = -Math.ceil(index / 2) * gap;
    dy = index === 0 ? 0 : (index % 2 ? 1 : -1) * Math.ceil(index / 2) * gap;
  } else {
    dx = ((index % 4) - 1.5) * gap;
    dy = (Math.floor(index / 4) - Math.floor((count - 1) / 4) / 2) * gap;
  }
  return {
    x: Math.max(25, Math.min(975, x + dx)),
    y: Math.max(25, Math.min(595, y + dy)),
  };
}
export function issueTacticalOrder(b, kind, x, y) {
  const team = b.actorTeam || "blue";
  if (b.paused || b.status !== "playing") return false;
  const units = b.entities.filter(
    (e) => b.selected.has(e.id) && e.speed && !e.carriedBy && e.team === team,
  );
  if (!units.length) {
    b.message = "حدّد وحدات قتالية أولًا";
    return false;
  }
  const target =
    kind === "guard"
      ? b.entities
          .filter(
            (e) =>
              e.team === team &&
              !e.carriedBy &&
              e.hp > 0 &&
              !b.selected.has(e.id),
          )
          .sort((a, c) => dist(a, { x, y }) - dist(c, { x, y }))[0]
      : null;
  if (kind === "guard" && (!target || dist(target, { x, y }) > 65)) {
    b.message = "اختر وحدة أو مقرًا صديقًا لحمايته";
    return false;
  }
  units.forEach((e, i) => {
    e.stance = "normal";
    e.servicing = false;
    delete e.boarding;
    delete e.recon;
    e.route = null;
    const destination = formationPoint(b, i, units.length, x, y);
    const point = b.constrain(e, destination.x, destination.y);
    e.tactical =
      kind === "patrol"
        ? {
            kind,
            origin: { x: e.x, y: e.y },
            destination: point,
            returning: false,
          }
        : kind === "guard"
          ? { kind, target: target.id, offset: i }
          : null;
    e.order = point;
  });
  b.message =
    kind === "patrol"
      ? "بدأت الدورية بين نقطة الانطلاق والوجهة"
      : kind === "guard"
        ? "ترافق الوحدات الهدف وتحميه"
        : "تم إرسال أمر التشكيل";
  b.emit("order", { x, y });
  return true;
}
export function validHQDestination(b, hq, x, y) {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 55 ||
    x > 945 ||
    y < 55 ||
    y > 565
  )
    return false;
  if (b.stageIndex === 2 && y > 190) return false;
  return (
    walkable(b.map, hq, x, y) &&
    !b.entities.some(
      (e) =>
        e.id !== hq.id &&
        !e.speed &&
        dist(e, { x, y }) < e.radius + hq.radius + 15,
    )
  );
}
export function relocateHQ(b, x, y) {
  if (b.requestNetwork) return b.requestNetwork({ kind: "relocate", x, y });
  const hq = b.entities.find(
    (e) => e.type === "hq" && e.team === (b.actorTeam || "blue") && e.hp > 0,
  );
  if (!hq || b.paused || b.status !== "playing") return false;
  if (hq.hqMode && hq.hqMode !== "deployed") {
    b.message = "مركز القيادة يتحرك أو يستعد للانتشار";
    return false;
  }
  if (!validHQDestination(b, hq, x, y) || dist(hq, { x, y }) < 70) {
    b.message =
      "اختر موضعًا آمنًا بعيدًا عن المباني والتضاريس؛ القيادة الساحلية تبقى على اليابسة";
    return false;
  }
  const vehicle = { ...hq, speed: 24 };
  const route = findRoute(b.map, vehicle, hq, { x, y });
  if (!route.length || (b.stageIndex === 2 && route.some((p) => p.y > 205))) {
    b.message = "لا يوجد مسار آمن لنقل مركز القيادة";
    return false;
  }
  hq.hqMode = "packing";
  hq.hqTimer = 3;
  hq.relocation = { x, y };
  hq.route = route;
  hq.routeGoal = { x, y };
  b.message = "تجهيز مركز القيادة للنقل؛ البناء متوقف حتى الانتشار";
  b.emit("order", { x, y });
  return true;
}
export function suggestedHQDestination(b) {
  if (b.requestNetwork) return b.requestNetwork({ kind: "suggestHQ" });
  const hq = b.entities.find(
    (e) => e.type === "hq" && e.team === (b.actorTeam || "blue"),
  );
  if (!hq) return false;
  for (const [dx, dy] of [
    [160, 0],
    [120, -90],
    [120, 90],
    [-130, 0],
    [0, 130],
    [0, -130],
  ])
    if (relocateHQ(b, hq.x + dx, hq.y + dy)) return true;
  return false;
}
export function updateTactics(b, dt) {
  for (const hq of b.entities.filter(
    (e) => e.type === "hq" && e.hp > 0 && (e.team === "blue" || b.multiplayer),
  )) {
    if (hq.hqMode !== "deployed") {
      if (hq.hqMode === "packing" || hq.hqMode === "deploying") {
        hq.hqTimer = Math.max(0, (hq.hqTimer || 0) - dt);
        if (!hq.hqTimer) {
          hq.hqMode = hq.hqMode === "packing" ? "moving" : "deployed";
          if (hq.hqMode === "deployed") {
            hq.relocation = null;
            b.message = "انتشر مركز القيادة في موقعه الجديد";
          }
        }
      } else if (hq.hqMode === "moving" && hq.relocation) {
        hq.speed = 24;
        if (moveUnit(hq, hq.relocation, b.map, dt)) {
          hq.hqMode = "deploying";
          hq.hqTimer = 3;
        }
        delete hq.speed;
      }
    }
  }
  for (const e of b.entities) {
    if (e.type === "submarine") {
      e.depth = Math.max(
        0,
        Math.min(
          1,
          (e.depth ?? 1) +
            ((e.depthTarget ?? 1) - (e.depth ?? 1)) * Math.min(1, dt * 1.5),
        ),
      );
      e.domain = e.depth > 0.55 ? "sub" : "sea";
    }
    if (e.domain === "air") {
      const landing =
        e.servicing &&
        b.entities.some(
          (base) =>
            base.team === e.team &&
            ["hq", "airfield"].includes(base.type) &&
            base.hqMode !== "moving" &&
            dist(e, base) < 150,
        );
      e.flight = Math.max(
        0,
        Math.min(1, (e.flight ?? 1) + (landing ? -dt * 0.35 : dt * 0.28)),
      );
    }
    if (!e.tactical || e.servicing || !e.speed) continue;
    const t = e.tactical;
    if (t.kind === "patrol") {
      const point = t.returning ? t.origin : t.destination;
      if (dist(e, point) < 25) t.returning = !t.returning;
      e.order = t.returning ? t.origin : t.destination;
    } else if (t.kind === "guard") {
      const target = b.entities.find((a) => a.id === t.target && a.hp > 0);
      if (!target) {
        e.tactical = null;
        e.order = null;
        continue;
      }
      if (dist(e, target) > 65) {
        const p = formationPoint(b, t.offset, 4, target.x - 45, target.y);
        e.order = b.constrain(e, p.x, p.y);
      } else e.order = null;
    }
  }
}
export function saveGroup(b, slot) {
  const ids = b.entities
    .filter(
      (e) =>
        e.team === "blue" && e.speed && !e.carriedBy && b.selected.has(e.id),
    )
    .map((e) => e.id);
  if (!ids.length) {
    b.message = "حدد الجيش قبل حفظ المجموعة";
    return;
  }
  b.groups[slot] = ids;
  b.message = `حُفظت المجموعة ${slot}`;
}
export function selectGroup(b, slot) {
  b.selected = new Set(
    (b.groups[slot] || []).filter((id) =>
      b.entities.some((e) => e.id === id && e.hp > 0 && !e.carriedBy),
    ),
  );
  b.message = `تم تحديد المجموعة ${slot}`;
}
