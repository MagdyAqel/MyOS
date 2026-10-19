import { moveUnit, walkable } from "./navigation.js";

export const APC_DESIGNS = {
  standard: {
    name: "متوازنة · 6 جنود",
    hp: 560,
    speed: 46,
    capacity: 6,
    extra: 0,
  },
  armored: {
    name: "مدرعة · 4 جنود · +$150",
    hp: 780,
    speed: 34,
    capacity: 4,
    extra: 150,
  },
  rapid: {
    name: "سريعة · 4 جنود · +$100",
    hp: 420,
    speed: 62,
    capacity: 4,
    extra: 100,
  },
};
export const SPECIAL_TYPES = {
  apc: {
    name: "ناقلة جند",
    cost: 600,
    hp: 560,
    radius: 17,
    speed: 46,
    damage: 10,
    range: 115,
    cooldown: 0.45,
    needs: "factory",
    domain: "ground",
    targets: ["ground"],
    magazine: 100,
  },
  recon: {
    name: "طائرة استطلاع",
    cost: 400,
    hp: 160,
    radius: 15,
    speed: 100,
    needs: "airfield",
    domain: "air",
    targets: [],
    vision: 110,
  },
  drone: {
    name: "طائرة انتحارية",
    cost: 350,
    hp: 90,
    radius: 12,
    speed: 110,
    damage: 280,
    range: 16,
    cooldown: 1,
    needs: "airfield",
    domain: "air",
    targets: ["ground", "sea"],
    magazine: 1,
    vision: 150,
  },
  artillery: {
    name: "مدفعية بعيدة المدى",
    cost: 900,
    hp: 280,
    radius: 18,
    speed: 24,
    damage: 95,
    range: 410,
    minRange: 100,
    cooldown: 3.8,
    needs: "factory",
    domain: "ground",
    targets: ["ground", "sea"],
    magazine: 12,
    indirect: true,
  },
};
const dist = (a, c) => Math.hypot(a.x - c.x, a.y - c.y);
const active = (b) => !b.paused && b.status === "playing";
export function visionRadius(e) {
  return e.carriedBy || e.hp <= 0
    ? 0
    : (e.vision ??
        (e.domain === "air"
          ? 340
          : e.type === "hq"
            ? 280
            : e.speed
              ? 230
              : 190));
}
export function applyAPCDesign(e, design = "standard") {
  if (!Object.hasOwn(APC_DESIGNS, design)) throw Error("تصميم ناقلة غير صالح");
  const d = APC_DESIGNS[design];
  Object.assign(e, {
    design,
    hp: d.hp,
    maxHp: d.hp,
    speed: d.speed,
    capacity: d.capacity,
  });
}
export function specialAction(b, action) {
  if (b.requestNetwork) return b.requestNetwork(action);
  if (!active(b)) return false;
  const team = b.actorTeam || "blue";
  const own = b.entities.filter(
    (e) => e.team === team && e.hp > 0 && !e.carriedBy,
  );
  const selected = own.filter((e) => b.selected.has(e.id));
  if (action.kind === "board") {
    const apc =
      own.find((e) => e.type === "apc" && e.id === action.carrier) ||
      selected.find((e) => e.type === "apc");
    if (!apc) {
      b.message = "حدّد ناقلة مع الجنود، أو اختر الناقلة على الميدان";
      return false;
    }
    let free =
      apc.capacity -
      b.entities.filter((e) => e.carriedBy === apc.id || e.boarding === apc.id)
        .length;
    let count = 0;
    for (const soldier of selected.filter(
      (e) => e.type === "soldier" && !e.boarding,
    )) {
      if (free-- <= 0) break;
      soldier.boarding = apc.id;
      soldier.order = null;
      soldier.route = null;
      soldier.tactical = null;
      soldier.servicing = false;
      count++;
    }
    b.message = count
      ? `يتجه ${count} جندي للركوب؛ السعة ${apc.capacity}`
      : "حدّد جنودًا خارج الناقلة؛ المقاعد الممتلئة أو المحجوزة لا تقبل المزيد";
    return count > 0;
  }
  if (action.kind === "unload") {
    let count = 0;
    const carriers = selected.filter((e) => e.type === "apc");
    if (!carriers.length) {
      const apc = own.find((e) => e.id === action.carrier && e.type === "apc");
      if (apc) carriers.push(apc);
    }
    for (const apc of carriers)
      for (const soldier of b.entities.filter((e) => e.carriedBy === apc.id)) {
        let point;
        for (let radius = 42; radius <= 110 && !point; radius += 22)
          for (let i = 0; i < 12; i++) {
            const p = {
              x: apc.x + Math.cos((i * Math.PI) / 6) * radius,
              y: apc.y + Math.sin((i * Math.PI) / 6) * radius,
            };
            if (
              walkable(b.map, soldier, p.x, p.y) &&
              !b.entities.some(
                (e) =>
                  e.id !== soldier.id &&
                  !e.carriedBy &&
                  dist(e, p) < e.radius + soldier.radius + 4,
              )
            ) {
              point = p;
              break;
            }
          }
        if (point) {
          delete soldier.carriedBy;
          delete soldier.boarding;
          Object.assign(soldier, point, {
            order: null,
            route: null,
            velocity: 0,
          });
          count++;
        }
      }
    b.message = count
      ? `نزل ${count} جندي إلى مواضع آمنة`
      : "حدّد ناقلة محمّلة؛ يجب توفر مساحة آمنة للنزول";
    return count > 0;
  }
  if (action.kind === "recon") {
    if (
      !Number.isFinite(action.x) ||
      !Number.isFinite(action.y) ||
      action.x < 20 ||
      action.x > 980 ||
      action.y < 20 ||
      action.y > 595
    )
      return false;
    let count = 0;
    for (const plane of selected.filter((e) => e.type === "recon")) {
      plane.recon = { x: action.x, y: action.y };
      plane.order = b.constrain(plane, action.x, action.y);
      plane.tactical = null;
      plane.route = null;
      plane.servicing = false;
      count++;
    }
    b.message = count
      ? "تتجه طائرة الاستطلاع للمنطقة المحددة ثم تدور حولها؛ الكشف ضمن 110 وحدات فقط"
      : "حدّد طائرة استطلاع أولًا";
    return count > 0;
  }
  return false;
}
// Returns true when an ability owns movement/combat for this simulation step.
export function updateUnitAbility(b, e, dt) {
  if (e.carriedBy) return true;
  if (e.boarding) {
    const apc = b.entities.find(
      (a) =>
        a.id === e.boarding &&
        a.team === e.team &&
        a.type === "apc" &&
        a.hp > 0,
    );
    if (!apc) {
      delete e.boarding;
      return false;
    }
    if (dist(e, apc) < 45) {
      if (
        b.entities.filter((a) => a.carriedBy === apc.id).length < apc.capacity
      ) {
        e.carriedBy = apc.id;
        e.order = null;
        e.route = null;
        b.selected.delete(e.id);
      }
      delete e.boarding;
    } else moveUnit(e, apc, b.map, dt);
    return true;
  }
  if (e.type === "recon" && e.recon && !e.servicing) {
    const target =
      dist(e, e.recon) < 65
        ? {
            x: e.recon.x + Math.cos(b.time * 1.1) * 40,
            y: e.recon.y + Math.sin(b.time * 1.1) * 40,
          }
        : e.recon;
    moveUnit(e, b.constrain(e, target.x, target.y), b.map, dt);
    return true;
  }
  return false;
}
export function updatePassengers(b) {
  for (const e of b.entities.filter((e) => e.carriedBy)) {
    const apc = b.entities.find(
      (a) => a.id === e.carriedBy && a.type === "apc" && a.team === e.team,
    );
    if (!apc || apc.hp <= 0) e.hp = 0;
    else {
      e.x = apc.x;
      e.y = apc.y;
    }
  }
}
export function recordDamage(b, team, damage) {
  const stats = team === "blue" ? b.stats : b.multiplayer ? b.statsRed : null;
  if (stats) stats.damage += damage;
}
export function advanceShells(b, dt) {
  for (const shell of b.shells) {
    shell.remaining -= dt;
    if (shell.remaining > 0) continue;
    for (const target of b.entities)
      if (
        target.team !== shell.team &&
        target.team !== "neutral" &&
        !target.carriedBy &&
        target.hp > 0 &&
        ["ground", "sea"].includes(target.domain) &&
        dist(target, { x: shell.tx, y: shell.ty }) < 48 + target.radius
      ) {
        const damage = Math.round(
          shell.damage *
            Math.max(0.3, 1 - dist(target, { x: shell.tx, y: shell.ty }) / 85),
        );
        target.hp -= damage;
        recordDamage(b, shell.team, damage);
      }
    b.emit("explosion", {
      x: shell.tx,
      y: shell.ty,
      domain: "ground",
      size: 28,
    });
  }
  b.shells = b.shells.filter((s) => s.remaining > 0);
}
