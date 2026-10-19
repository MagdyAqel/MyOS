import { blocked } from "./maps.js";
import { moveUnit } from "./navigation.js";
import { visionRadius } from "./unit-abilities.js";
export const DIFFICULTIES = {
  easy: { name: "سهل", income: 0.8, decision: 16, cap: 8 },
  normal: { name: "متوسط", income: 1, decision: 12, cap: 12 },
  hard: { name: "صعب", income: 1.3, decision: 8, cap: 20 },
};
export const MISSIONS = [
  {
    id: "assault",
    name: "تدمير القيادة",
    stages: [0, 1, 2, 3],
    description: "دمّر مقر العدو واحمِ مقرّك.",
  },
  {
    id: "recon",
    name: "عين السماء",
    stages: [0, 1, 2],
    description:
      "أرسل طائرة استطلاع إلى الدائرة شرق الخريطة، واستطلعها لمدة 10 ثوانٍ مع حماية القيادة.",
  },
  {
    id: "siege",
    name: "كسر الحصار",
    stages: [0],
    description:
      "استطلع الهدف ثم دمّر مقر العدو؛ المدفعية تضرب من مسافة بعيدة وتحتاج حماية من الاقتراب.",
  },
  {
    id: "escort",
    name: "حماية القافلة",
    stages: [0],
    description: "احمِ شاحنة الإمداد حتى تصل إلى نقطة الإخلاء شرق الخريطة.",
  },
  {
    id: "rescue",
    name: "إنقاذ وإخلاء",
    stages: [0],
    description: "اقترب من الناجين شرق الميدان، ثم احمِ عودتهم إلى مقرّك.",
  },
  {
    id: "capture",
    name: "السيطرة على الميناء",
    stages: [2],
    description:
      "سيطر بأسطولك على الميناء المحايد لمدة 15 ثانية دون وجود وحدات عدو قريبة.",
  },
  {
    id: "intercept",
    name: "اعتراض الغارة",
    stages: [1],
    description: "أسقط 6 طائرات معادية خلال 180 ثانية مع حماية مقرّك.",
  },
  {
    id: "survive",
    name: "حماية محطة الأعماق",
    stages: [3],
    description: "احمِ محطة القيادة تحت الماء لمدة 150 ثانية.",
  },
];
export const EXTRA_TYPES = {
  convoy: {
    name: "قافلة الإمداد",
    hp: 900,
    radius: 19,
    speed: 27,
    domain: "ground",
    targets: [],
  },
  survivor: {
    name: "فريق إنقاذ",
    hp: 200,
    radius: 9,
    speed: 42,
    domain: "ground",
    targets: [],
  },
  outpost: {
    name: "ميناء محايد",
    hp: 1600,
    radius: 30,
    domain: "ground",
    targets: [],
  },
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function initializeSystems(b, options = {}) {
  b.difficulty = DIFFICULTIES[options.difficulty]
    ? options.difficulty
    : "normal";
  b.mission =
    MISSIONS.find(
      (m) => m.id === options.mission && m.stages.includes(b.stageIndex),
    ) || MISSIONS[0];
  b.objective = { hold: 0, kills: 0, evacuated: 0 };
  b.enemy = {
    cash: 1200,
    nextDecision: 12,
    nextOrders: 8,
    lastHQ: { x: 130, y: b.stageIndex === 2 ? 140 : 320 },
  };
  b.explored = new Set();
  b.nextExplore = 0;
  b.fog = options.fog !== false;
  if (b.mission.id === "escort") b.add("convoy", "blue", 140, 540);
  if (b.mission.id === "rescue")
    for (const [x, y] of [
      [680, 440],
      [735, 490],
      [780, 460],
    ])
      b.add("survivor", "neutral", x, y);
  if (b.mission.id === "capture") b.add("outpost", "neutral", 640, 230);
  updateExploration(b);
}
export function visibleTo(b, entity, team = "blue") {
  if (entity.carriedBy) return entity.team === team;
  if (entity.hp <= 0) return false;
  if (!b.fog || entity.team === team || entity.team === "neutral") return true;
  return b.entities.some(
    (unit) =>
      unit.team === team &&
      unit.hp > 0 &&
      distance(unit, entity) < visionRadius(unit),
  );
}
export function updateExploration(b) {
  if (b.time < b.nextExplore) return;
  b.nextExplore = b.time + 0.6;
  for (const e of b.entities.filter((e) => e.team === "blue")) {
    const radius = visionRadius(e);
    for (
      let y = Math.max(0, Math.floor((e.y - radius) / 25));
      y < Math.min(25, Math.ceil((e.y + radius) / 25));
      y++
    )
      for (
        let x = Math.max(0, Math.floor((e.x - radius) / 25));
        x < Math.min(40, Math.ceil((e.x + radius) / 25));
        x++
      )
        if (Math.hypot(x * 25 + 12.5 - e.x, y * 25 + 12.5 - e.y) < radius)
          b.explored.add(y * 40 + x);
  }
}
function site(b, type, types) {
  const spec = types[type];
  for (const y of b.stageIndex >= 2
    ? type === "harbor"
      ? [240]
      : [70, 165]
    : [80, 520, 150, 450])
    for (const x of [920, 790, 700])
      if (
        !blocked(b.map, x, y, spec.radius + 8) &&
        !b.entities.some(
          (e) =>
            !e.speed && distance(e, { x, y }) < e.radius + spec.radius + 15,
        )
      )
        return { x, y };
  return null;
}
export function updateEnemy(b, types) {
  const settings = DIFFICULTIES[b.difficulty],
    enemy = b.enemy;
  if (!b.entities.some((e) => e.type === "hq" && e.team === "red")) return;
  if (b.time >= enemy.nextDecision) {
    enemy.nextDecision = b.time + settings.decision;
    const has = (type) =>
      b.entities.some((e) => e.type === type && e.team === "red" && e.hp > 0);
    const producer =
      b.stageIndex === 0
        ? "factory"
        : b.stageIndex === 1
          ? "airfield"
          : "harbor";
    const wanted = ["power", "supply", producer].find((type) => !has(type));
    if (wanted && enemy.cash >= types[wanted].cost) {
      const point = site(b, wanted, types);
      if (point) {
        enemy.cash -= types[wanted].cost;
        b.add(wanted, "red", point.x, point.y);
      }
    } else if (
      !wanted &&
      b.entities.filter((e) => e.team === "red" && e.speed).length <
        settings.cap
    ) {
      const choices = b.stage.units.filter(
          (type) => types[type].needs === producer,
        ),
        type = choices[Math.floor(b.time) % choices.length] || choices[0];
      if (type && enemy.cash >= types[type].cost) {
        const from = b.entities.find(
          (e) => e.team === "red" && e.type === producer,
        );
        const point = b.constrain(
          types[type],
          from.x - 65,
          from.y + (b.stageIndex >= 2 ? 95 : 70),
        );
        if (!blocked(b.map, point.x, point.y, types[type].radius + 4)) {
          enemy.cash -= types[type].cost;
          b.add(type, "red", point.x, point.y);
        }
      }
    }
  }
  if (b.time >= enemy.nextOrders) {
    enemy.nextOrders = b.time + 6;
    const enemies = b.entities.filter(
      (e) => e.team === "blue" && e.hp > 0 && visibleTo(b, e, "red"),
    );
    const seenHQ = enemies.find((e) => e.type === "hq");
    if (seenHQ) enemy.lastHQ = { x: seenHQ.x, y: seenHQ.y };
    for (const unit of b.entities.filter(
      (e) =>
        e.team === "red" &&
        e.speed &&
        e.damage &&
        !e.servicing &&
        !e.carriedBy &&
        !e.boarding,
    )) {
      const role = unit.id % 3;
      let target = enemies.find(
        (e) => e.type === "convoy" && unit.targets.includes(e.domain),
      );
      if (!target && role === 0)
        target = enemies.find(
          (e) =>
            ["supply", "airfield", "harbor"].includes(e.type) &&
            visibleTo(b, e, "red") &&
            unit.targets.includes(e.domain),
        );
      target =
        target ||
        enemies.find(
          (e) => e.type === "hq" && unit.targets.includes(e.domain),
        ) ||
        enemies.find((e) => unit.targets.includes(e.domain));
      if (!target) {
        const destination = enemy.lastHQ || {
          x: 130,
          y: b.stageIndex === 2 ? 140 : 320,
        };
        unit.order = b.constrain(unit, destination.x, destination.y);
        unit.route = null;
        continue;
      }
      if (role === 1 && unit.x > 620) {
        unit.order = b.constrain(
          unit,
          590,
          b.stageIndex >= 2 ? 550 : unit.id % 2 ? 80 : 550,
        );
      } else unit.order = { target: target.id };
      unit.route = null;
    }
  }
}
export function serviceUnit(b, unit) {
  if (unit.carriedBy) return;
  delete unit.boarding;
  delete unit.recon;
  const bases = b.entities.filter(
    (e) =>
      e.team === unit.team &&
      ["hq", "supply", "harbor", "airfield"].includes(e.type) &&
      (!e.hqMode || e.hqMode === "deployed"),
  );
  const base = bases.sort((a, c) => distance(unit, a) - distance(unit, c))[0];
  if (!base) return;
  unit.servicing = true;
  unit.tactical = null;
  unit.order = b.constrain(unit, base.x, base.y);
  unit.route = null;
}
export function updateLogistics(b, dt) {
  for (const unit of b.entities.filter(
    (e) => e.speed && e.damage && e.hp > 0 && !e.carriedBy,
  )) {
    if (
      (unit.ammo === 0 ||
        (unit.team === "red" && unit.hp < unit.maxHp * 0.25)) &&
      !unit.servicing
    )
      serviceUnit(b, unit);
    if (!unit.servicing) continue;
    const base = b.entities.find(
      (e) =>
        e.team === unit.team &&
        ["hq", "supply", "harbor", "airfield"].includes(e.type) &&
        (!e.hqMode || e.hqMode === "deployed") &&
        distance(e, unit) < 180,
    );
    if (!base) {
      serviceUnit(b, unit);
      continue;
    }
    if (unit.domain === "air" && (unit.flight ?? 1) > 0.08) continue;
    unit.reload = (unit.reload || 0) + dt;
    if (unit.reload >= 1) {
      unit.reload -= 1;
      unit.ammo = Math.min(unit.maxAmmo, unit.ammo + 3);
      const wallet = unit.team === "blue" ? b : b.enemy;
      if (unit.hp < unit.maxHp && wallet.cash >= 5) {
        wallet.cash -= 5;
        unit.hp = Math.min(unit.maxHp, unit.hp + 25);
      }
      if (unit.hp >= unit.maxHp && unit.ammo >= unit.maxAmmo) {
        unit.servicing = false;
        unit.order = null;
      }
    }
  }
}
export function advanceMission(b, dt) {
  if (
    b.mission.id === "recon" &&
    b.entities.some(
      (e) =>
        e.team === "blue" &&
        e.type === "recon" &&
        e.hp > 0 &&
        distance(e, { x: 820, y: 470 }) < 100,
    )
  )
    b.objective.hold += dt;
  if (b.mission.id === "escort") {
    const convoy = b.entities.find((e) => e.type === "convoy" && e.hp > 0);
    if (convoy) moveUnit(convoy, { x: 850, y: 540 }, b.map, dt);
  }
  if (b.mission.id === "rescue") {
    const hq = b.entities.find((e) => e.team === "blue" && e.type === "hq");
    for (const survivor of b.entities.filter(
      (e) => e.type === "survivor" && e.hp > 0,
    )) {
      if (
        survivor.team === "neutral" &&
        b.entities.some(
          (e) =>
            e.team === "blue" &&
            e.damage &&
            e.speed &&
            distance(e, survivor) < 75,
        )
      ) {
        survivor.team = "blue";
        b.message = "تم إنقاذ الفريق؛ يتجه إلى نقطة الإخلاء.";
      }
      if (survivor.team === "blue" && hq) {
        moveUnit(survivor, hq, b.map, dt);
        if (distance(survivor, hq) < 90 && !survivor.evacuated) {
          survivor.evacuated = true;
          b.objective.evacuated++;
        }
      }
    }
  }
  if (b.mission.id === "capture") {
    const port = b.entities.find((e) => e.type === "outpost");
    if (port) {
      const near = (team) =>
        b.entities.some(
          (e) =>
            e.team === team && e.speed && e.damage && distance(e, port) < 220,
        );
      if (near("blue") && !near("red")) b.objective.hold += dt;
      else if (near("red"))
        b.objective.hold = Math.max(0, b.objective.hold - dt * 2);
    }
  }
}
export function missionOutcome(b) {
  if (b.mission.id === "recon") return b.objective.hold >= 10 ? "won" : null;
  if (b.mission.id === "escort") {
    const convoy = b.entities.find((e) => e.type === "convoy");
    return !convoy ? "lost" : convoy.x > 830 ? "won" : null;
  }
  if (b.mission.id === "rescue")
    return b.objective.evacuated >= 3
      ? "won"
      : b.entities.filter((e) => e.type === "survivor").length < 3
        ? "lost"
        : null;
  if (b.mission.id === "capture") return b.objective.hold >= 15 ? "won" : null;
  if (b.mission.id === "intercept")
    return b.objective.kills >= 6 ? "won" : b.time >= 180 ? "lost" : null;
  if (b.mission.id === "survive") return b.time >= 150 ? "won" : null;
  return !b.entities.some((e) => e.type === "hq" && e.team === "red")
    ? "won"
    : null;
}
export function missionStatus(b) {
  return {
    recon: `استطلاع المنطقة الشرقية: ${Math.min(10, Math.floor(b.objective.hold))}/10 ث`,
    siege: "اكشف القيادة ثم حاصرها بالمدفعية",
    assault: "الهدف: تدمير القيادة",
    escort: "احمِ القافلة حتى تصل شرقًا",
    rescue: `فرق الإخلاء: ${b.objective.evacuated}/3`,
    capture: `السيطرة: ${Math.min(15, Math.floor(b.objective.hold))}/15 ث`,
    intercept: `اعتراض: ${b.objective.kills}/6 · ${Math.max(0, Math.ceil(180 - b.time))} ث`,
    survive: `الدفاع: ${Math.min(150, Math.floor(b.time))}/150 ث`,
  }[b.mission.id];
}
