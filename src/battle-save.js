import {
  checkTactics,
  snapshotTactics,
  snapshotUnitTactics,
  restoreUnitTactics,
  restoreTactics,
} from "./tactics-save.js";
import { Battle, TYPES } from "./battle.js";
import { mapFor } from "./maps.js";
import { DIFFICULTIES, MISSIONS } from "./systems.js";
import { APC_DESIGNS } from "./unit-abilities.js";
export const BATTLE_MANUAL = "myos-battle-manual-v1",
  BATTLE_AUTO = "myos-battle-auto-v1";
const number = (v, max = 1e8) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
export function snapshotBattle(b) {
  return {
    version: 1,
    ...snapshotTactics(b),
    savedAt: Date.now(),
    stage: b.stageIndex,
    map: b.map.id,
    difficulty: b.difficulty,
    mission: b.mission.id,
    fog: b.fog,
    time: b.time,
    cash: b.cash,
    wave: b.wave,
    nextWave: b.nextWave,
    income: b.income,
    incomeEnemy: b.incomeEnemy || 0,
    status: b.status,
    enemy: { ...b.enemy },
    objective: { ...b.objective },
    explored: [...b.explored],
    selected: [...b.selected],
    entities: b.entities.map((e) => ({
      design: e.design,
      carriedBy: e.carriedBy,
      boarding: e.boarding,
      recon: e.recon,
      ...snapshotUnitTactics(e),
      id: e.id,
      type: e.type,
      team: e.team,
      x: e.x,
      y: e.y,
      hp: e.hp,
      ammo: e.ammo,
      cd: e.cd || 0,
      heading: e.heading || 0,
      servicing: Boolean(e.servicing),
      reload: e.reload || 0,
      evacuated: Boolean(e.evacuated),
      order: e.order
        ? e.order.target
          ? { target: e.order.target }
          : { x: e.order.x, y: e.order.y }
        : null,
    })),
    shells: b.shells.map((s) => ({ ...s })),
  };
}
export function restoreBattle(raw) {
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (
    !data ||
    data.version !== 1 ||
    !Number.isInteger(data.stage) ||
    data.stage < 0 ||
    data.stage > 3 ||
    mapFor(data.stage, data.map).id !== data.map ||
    !Object.hasOwn(DIFFICULTIES, data.difficulty) ||
    !MISSIONS.some(
      (m) => m.id === data.mission && m.stages.includes(data.stage),
    ) ||
    !["playing", "won", "lost"].includes(data.status)
  )
    throw Error("ملف المعركة غير متوافق");
  for (const key of [
    "time",
    "cash",
    "wave",
    "nextWave",
    "income",
    "incomeEnemy",
  ])
    if (!number(data[key])) throw Error("بيانات معركة غير صالحة");
  if (
    !Number.isInteger(data.wave) ||
    data.wave > 5 ||
    !Array.isArray(data.entities) ||
    data.entities.length > 180 ||
    data.entities.length < 1 ||
    !Array.isArray(data.selected) ||
    data.selected.length > 60 ||
    !Array.isArray(data.explored) ||
    data.explored.length > 1000
  )
    throw Error("قائمة وحدات غير صالحة");
  if (
    !data.enemy ||
    !["cash", "nextDecision", "nextOrders"].every((k) =>
      number(data.enemy[k]),
    ) ||
    !data.objective ||
    !["hold", "kills", "evacuated"].every((k) => number(data.objective[k], 1e7))
  )
    throw Error("حالة المهمة غير صالحة");
  checkTactics(data);
  const ids = new Set();
  for (const e of data.entities) {
    if (
      !e ||
      !Object.hasOwn(TYPES, e.type) ||
      (e.design !== undefined &&
        (e.type !== "apc" || !Object.hasOwn(APC_DESIGNS, e.design))) ||
      !["blue", "red", "neutral"].includes(e.team) ||
      !Number.isInteger(e.id) ||
      e.id < 1 ||
      e.id > 1e6 ||
      ids.has(e.id) ||
      !number(e.x, 1000) ||
      !number(e.y, 620) ||
      !number(
        e.hp,
        Math.round(
          (e.type === "apc"
            ? APC_DESIGNS[e.design || "standard"].hp
            : TYPES[e.type].hp) *
            (1 + (e.team === "blue" ? data.upgrades?.armor || 0 : 0) * 0.1),
        ),
      ) ||
      !number(e.ammo, 1000) ||
      !number(e.cd, 10) ||
      !number(e.reload, 2) ||
      !Number.isFinite(e.heading) ||
      Math.abs(e.heading) > Math.PI * 2
    )
      throw Error("وحدة محفوظة غير صالحة");
    if (
      e.order &&
      !(Number.isInteger(e.order.target) && e.order.target > 0) &&
      !(number(e.order.x, 1000) && number(e.order.y, 620))
    )
      throw Error("أمر محفوظ غير صالح");
    ids.add(e.id);
  }
  if (data.explored.some((n) => !Number.isInteger(n) || n < 0 || n >= 1000))
    throw Error("بيانات رؤية غير صالحة");
  for (const e of data.entities) {
    for (const key of ["carriedBy", "boarding"])
      if (e[key] !== undefined) {
        const apc = data.entities.find(
          (a) => a.id === e[key] && a.type === "apc" && a.team === e.team,
        );
        if (
          e.type !== "soldier" ||
          !Number.isInteger(e[key]) ||
          !apc ||
          (e.carriedBy && e.boarding)
        )
          throw Error("ركاب ناقلة غير صالحين");
      }
    if (
      e.type === "apc" &&
      data.entities.filter((a) => a.carriedBy === e.id || a.boarding === e.id)
        .length > APC_DESIGNS[e.design || "standard"].capacity
    )
      throw Error("تجاوز سعة الناقلة");
    if (
      e.recon &&
      (e.type !== "recon" ||
        !number(e.recon.x, 1000) ||
        !number(e.recon.y, 620))
    )
      throw Error("منطقة استطلاع غير صالحة");
  }
  if (
    data.shells !== undefined &&
    (!Array.isArray(data.shells) ||
      data.shells.length > 180 ||
      data.shells.some(
        (s) =>
          !s ||
          !["blue", "red"].includes(s.team) ||
          !["x", "tx"].every((k) => number(s[k], 1000)) ||
          !["y", "ty"].every((k) => number(s[k], 620)) ||
          !number(s.damage, 500) ||
          !number(s.duration, 5) ||
          s.duration <= 0 ||
          !number(s.remaining, s.duration),
      ))
  )
    throw Error("قذائف غير صالحة");
  const b = new Battle(data.stage, data.map, {
    difficulty: data.difficulty,
    mission: data.mission,
    fog: data.fog !== false,
    upgrades: data.upgrades,
    operationId: data.operationId,
  });
  b.entities = [];
  b.nextId = 1;
  for (const e of data.entities) {
    const entity = b.add(e.type, e.team, e.x, e.y, e.design);
    if (e.carriedBy !== undefined) entity.carriedBy = e.carriedBy;
    if (e.boarding !== undefined) entity.boarding = e.boarding;
    if (e.recon) entity.recon = { x: e.recon.x, y: e.recon.y };
    restoreUnitTactics(entity, e);
    entity.id = e.id;
    entity.hp = e.hp;
    entity.ammo = Math.min(entity.maxAmmo, e.ammo);
    entity.cd = e.cd;
    entity.heading = e.heading;
    entity.servicing = e.servicing === true;
    entity.reload = e.reload;
    entity.evacuated = e.evacuated === true;
    entity.order = e.order
      ? e.order.target && ids.has(e.order.target)
        ? { target: e.order.target }
        : number(e.order.x, 1000) && number(e.order.y, 620)
          ? { x: e.order.x, y: e.order.y }
          : null
      : null;
  }
  restoreTactics(b, data);
  b.nextId = Math.max(...ids) + 1;
  for (const key of [
    "time",
    "cash",
    "wave",
    "nextWave",
    "income",
    "incomeEnemy",
    "status",
  ])
    b[key] = data[key];
  b.enemy = {
    cash: data.enemy.cash,
    nextDecision: data.enemy.nextDecision,
    nextOrders: data.enemy.nextOrders,
    lastHQ:
      data.enemy.lastHQ &&
      number(data.enemy.lastHQ.x, 1000) &&
      number(data.enemy.lastHQ.y, 620)
        ? { x: data.enemy.lastHQ.x, y: data.enemy.lastHQ.y }
        : { x: 130, y: data.stage === 2 ? 140 : 320 },
  };
  b.objective = {
    hold: data.objective.hold,
    kills: data.objective.kills,
    evacuated: data.objective.evacuated,
  };
  b.explored = new Set(data.explored);
  b.selected = new Set(
    data.selected.filter((id) =>
      b.entities.some((e) => e.id === id && e.team === "blue" && e.speed && !e.carriedBy),
    ),
  );
  b.events = [];
  b.effects = [];
  b.shells = (data.shells || []).map((s) => ({
    team: s.team,
    x: s.x,
    y: s.y,
    tx: s.tx,
    ty: s.ty,
    damage: s.damage,
    duration: s.duration,
    remaining: s.remaining,
  }));
  b.paused = true;
  b.message = "استُعيدت المعركة. اضغط متابعة للعب.";
  if (
    b.status === "playing" &&
    !b.entities.some((e) => e.type === "hq" && e.team === "blue" && e.hp > 0)
  )
    throw Error("المقر غير موجود في الحفظ");
  return b;
}
export function saveBattle(storage, battle, key = BATTLE_MANUAL) {
  const snapshot = snapshotBattle(battle);
  restoreBattle(snapshot);
  storage.setItem(key, JSON.stringify(snapshot));
  return snapshot;
}
export function readBattle(storage) {
  const candidates = [];
  for (const key of [BATTLE_MANUAL, BATTLE_AUTO])
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.status === "playing") {
          restoreBattle(data);
          candidates.push(data);
        }
      }
    } catch {
      /* Keep other save slots usable. */
    }
  return (
    candidates.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0] || null
  );
}
