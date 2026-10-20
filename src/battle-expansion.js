export function startingMoney(value, fallback = 2400) {
  return Number.isInteger(value) && value >= 1000 && value <= 100000
    ? value
    : fallback;
}
const support = (name, cost, hp, speed, needs, magazine) => ({
  name,
  cost,
  hp,
  speed,
  needs,
  magazine,
  radius: 14,
  domain: "ground",
  targets: [],
});
export const SUPPORT_TYPES = {
  engineer: support("مهندس ميداني", 250, 120, 46, "barracks", 80),
  repair: support("عربة إصلاح", 650, 380, 35, "factory", 160),
  ammoTruck: support("شاحنة ذخيرة", 500, 260, 40, "factory", 120),
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function updateSupport(b, dt) {
  for (const unit of b.entities) {
    if (
      !Object.hasOwn(SUPPORT_TYPES, unit.type) ||
      unit.hp <= 0 ||
      unit.servicing ||
      unit.carriedBy ||
      unit.ammo <= 0
    )
      continue;
    unit.supportTimer = (unit.supportTimer || 0) + dt;
    if (unit.supportTimer < 1) continue;
    unit.supportTimer -= 1;
    const allies = b.entities.filter(
      (e) =>
        e.id !== unit.id &&
        e.hp > 0 &&
        e.team === unit.team &&
        !e.carriedBy &&
        distance(e, unit) < 85,
    );
    const ammo = unit.type === "ammoTruck";
    const target = allies
      .filter((e) =>
        ammo
          ? e.maxAmmo && e.ammo < e.maxAmmo
          : e.hp < e.maxHp &&
            (unit.type === "engineer"
              ? !e.speed
              : e.speed && e.domain === "ground"),
      )
      .sort(
        (a, c) =>
          (ammo ? a.ammo / a.maxAmmo : a.hp / a.maxHp) -
          (ammo ? c.ammo / c.maxAmmo : c.hp / c.maxHp),
      )[0];
    if (!target) continue;
    const wallet = unit.team === "blue" ? b : b.enemy;
    if (!ammo && wallet.cash < 5) continue;
    const amount = Math.min(
      unit.ammo,
      ammo ? 6 : 20,
      ammo ? target.maxAmmo - target.ammo : target.maxHp - target.hp,
    );
    if (ammo) target.ammo += amount;
    else {
      target.hp += amount;
      wallet.cash -= 5;
    }
    unit.ammo -= Math.ceil(amount);
    b.emit("support", {
      x: unit.x,
      y: unit.y,
      tx: target.x,
      ty: target.y,
      team: unit.team,
      type: unit.type,
    });
  }
}
export function targetScore(unit, target) {
  const preferred =
    unit.priority === "air"
      ? target.domain === "air"
      : unit.priority === "armor"
        ? ["tank", "apc", "artillery", "destroyer", "submarine"].includes(
            target.type,
          )
        : false;
  return distance(unit, target) - (preferred ? 10000 : 0);
}
export function advancedOrder(b, action) {
  if (b.requestNetwork) return b.requestNetwork(action);
  if (b.paused || b.status !== "playing") return false;
  const team = b.actorTeam || "blue";
  const units = b.entities.filter(
    (e) => e.team === team && e.speed && !e.carriedBy && b.selected.has(e.id),
  );
  if (!units.length) return false;
  if (action.kind === "priority") {
    if (!["nearest", "air", "armor"].includes(action.value)) return false;
    for (const unit of units) unit.priority = action.value;
    b.message = "تم تحديث أولوية الأهداف";
  } else if (action.kind === "hold") {
    for (const unit of units) {
      unit.stance = "hold";
      delete unit.attackGoal;
      unit.order = null;
      unit.route = null;
      unit.tactical = null;
      unit.servicing = false;
      delete unit.recon;
      delete unit.boarding;
    }
    b.message = "تثبيت الموقع: تشتبك الوحدات دون مطاردة";
  } else if (action.kind === "retreat") {
    for (const unit of units) {
      unit.stance = "retreat";
      delete unit.attackGoal;
      unit.tactical = null;
      delete unit.recon;
      delete unit.boarding;
    }
    b.serviceSelected();
    b.message = "انسحاب إلى أقرب قاعدة للصيانة وإعادة التسليح";
  } else return false;
  b.emit("order");
  return true;
}
export function selectInRectangle(b, project, rectangle, additive = false) {
  if (!additive) b.selected.clear();
  for (const e of b.entities) {
    if (e.team !== "blue" || !e.speed || e.hp <= 0 || e.carriedBy) continue;
    const p = project(e.x, e.y, e.domain);
    if (
      p &&
      p.x >= rectangle.left &&
      p.x <= rectangle.right &&
      p.y >= rectangle.top &&
      p.y <= rectangle.bottom
    )
      b.selected.add(e.id);
  }
  b.message = `تم تحديد ${b.selected.size} وحدة بالسحب`;
}
