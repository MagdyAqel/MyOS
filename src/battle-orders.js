import { mapPoint } from "./world.js";
import { formationPoint } from "./tactics.js";

export function attackHeadquarters(b) {
  if (b.requestNetwork) return b.requestNetwork({ kind: "attackHQ" });
  if (b.paused || b.status !== "playing") {
    b.message = b.paused
      ? "المعركة متوقفة؛ اضغط متابعة لإرسال أمر الهجوم"
      : "انتهت المعركة";
    return false;
  }
  const team = b.actorTeam || "blue",
    enemyTeam = team === "blue" ? "red" : "blue";
  const units = b.entities.filter(
    (e) =>
      e.team === team &&
      e.hp > 0 &&
      e.speed &&
      !e.carriedBy &&
      b.selected.has(e.id),
  );
  if (!units.length) {
    b.message = "اضغط تحديد الجيش ثم هجوم على مقر العدو";
    return false;
  }
  const hq = b.entities.find(
    (e) =>
      e.team === enemyTeam &&
      e.type === "hq" &&
      e.hp > 0 &&
      b.isVisible(e, team),
  );
  // The starting sector is public. Never reveal a relocated, unscouted HQ.
  const destination =
    hq ||
    mapPoint(
      b.map,
      enemyTeam === "blue" ? 130 : b.multiplayer ? 870 : 880,
      b.stageIndex === 2
        ? 140
        : b.multiplayer || enemyTeam === "blue"
          ? 320
          : 300,
    );
  let navalCover = 0;
  units.forEach((unit, i) => {
    unit.route = null;
    unit.tactical = null;
    unit.servicing = false;
    delete unit.boarding;
    delete unit.recon;
    unit.stance = "attackMove";
    const p = formationPoint(b, i, units.length, destination.x, destination.y);
    unit.attackGoal = b.constrain(unit, p.x, p.y);
    unit.order =
      hq && (unit.targets || []).includes(hq.domain)
        ? { target: hq.id }
        : { ...unit.attackGoal };
    if (
      unit.damage &&
      !(unit.targets || []).includes(
        hq?.domain || (b.stageIndex === 3 ? "sub" : "ground"),
      )
    )
      navalCover++;
  });
  b.emit("order", { x: destination.x, y: destination.y });
  b.message = `أمر هجوم: تتقدم ${units.length} وحدة وتشتبك مع الأعداء في الطريق${hq ? " نحو مقر العدو" : " لاستكشاف قطاع قيادة العدو"}${navalCover ? "؛ الوحدات غير القادرة على ضرب المقر تؤمّن الطريق ضد أهدافها المناسبة" : ""}`;
  return true;
}

export function repairBuilding(b, id) {
  if (b.requestNetwork)
    return b.requestNetwork({ kind: "repairBuilding", building: id });
  if (b.paused || b.status !== "playing") return false;
  const team = b.actorTeam || "blue";
  const building = b.entities.find(
    (e) =>
      Number.isInteger(id) &&
      e.id === id &&
      e.team === team &&
      !e.speed &&
      e.hp > 0,
  );
  if (!building) {
    b.message = "اختر مبنى متضررًا تابعًا لك";
    return false;
  }
  if (building.repairing) {
    building.repairing = false;
    b.message = "تم إيقاف تصليح المبنى";
    return true;
  }
  if (building.hp >= building.maxHp) {
    b.message = "المبنى بحالة سليمة";
    return false;
  }
  if (
    building.type === "hq" &&
    building.hqMode &&
    building.hqMode !== "deployed"
  ) {
    b.message = "انشر مركز القيادة قبل بدء التصليح";
    return false;
  }
  if ((team === "blue" ? b.cash : b.enemy.cash) < 1) {
    b.message = "المال غير كافٍ لبدء التصليح";
    return false;
  }
  building.repairing = true;
  building.repairTimer = 0;
  b.message =
    "بدأ تصليح المبنى: حتى 20 صحة كل ثانية مقابل $5؛ يمكن إيقافه في أي وقت";
  return true;
}

export function updateBuildingRepairs(b, dt) {
  for (const e of b.entities) {
    if (!e.repairing || e.hp <= 0 || e.speed) continue;
    if (
      e.hp >= e.maxHp ||
      (e.type === "hq" && e.hqMode && e.hqMode !== "deployed")
    ) {
      e.repairing = false;
      continue;
    }
    e.repairTimer = (e.repairTimer || 0) + dt;
    if (e.repairTimer < 1) continue;
    e.repairTimer -= 1;
    const wallet = e.team === "blue" ? b : b.enemy;
    if (wallet.cash < 1) {
      e.repairing = false;
      if (e.team === "blue") b.message = "توقف تصليح المبنى لنفاد المال";
      continue;
    }
    const amount = Math.min(20, e.maxHp - e.hp, Math.floor(wallet.cash) * 4);
    e.hp += amount;
    wallet.cash -= Math.ceil(amount / 4);
    if (e.hp >= e.maxHp) e.repairing = false;
    b.emit("support", {
      team: e.team,
      type: "repair",
      x: e.x,
      y: e.y,
      tx: e.x,
      ty: e.y,
    });
  }
}
