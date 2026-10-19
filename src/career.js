export const CAREER_KEY = "myos-career-v1";
export const OPERATIONS = [
  {
    id: "first-light",
    stage: 0,
    mission: "escort",
    title: "الفجر الأول",
    story:
      "خطوط الاتصال انقطعت. أوصل قافلة الإمداد لفتح الطريق أمام فرق الإنقاذ.",
  },
  {
    id: "safe-return",
    stage: 0,
    mission: "rescue",
    title: "عودة آمنة",
    story:
      "ثلاثة فرق عالقة خلف التلال. أرسل قوة حماية وأعدهم إلى مركز القيادة.",
  },
  {
    id: "sand-shield",
    stage: 0,
    mission: "assault",
    title: "درع الطريق",
    story:
      "استخدم الدبابات والمشاة والمدفعية لفك قيادة الهجوم الأرضي؛ تُضاف الطائرات في العملية التالية.",
  },
  {
    id: "clear-skies",
    stage: 1,
    mission: "intercept",
    title: "سماء مفتوحة",
    story:
      "انضمت الطائرات إلى الدبابات. احمِ قاعدتك الأرضية واعترض الغارة قبل انتهاء الوقت.",
  },
  {
    id: "silent-wing",
    stage: 1,
    mission: "assault",
    title: "الجناح الحاسم",
    story:
      "أنهت المقاتلات الغارة. هاجم مركز التنسيق الجوي وافتح المجال للملاحة.",
  },
  {
    id: "harbor-watch",
    stage: 2,
    mission: "capture",
    title: "بوابة البحر",
    story:
      "انضمت السفن والغواصات إلى البر والطيران. قد القوات الأربع في الساحل نفسه لتأمين الميناء.",
  },
  {
    id: "deep-watch",
    stage: 2,
    map: "archipelago",
    legacy: { stage: 3, mission: "survive" },
    mission: "survive",
    title: "الحارس الصامت",
    story:
      "احمِ القيادة الساحلية 150 ثانية، بالدبابات والطيران والمدمرات والغواصات في المعركة نفسها.",
  },
  {
    id: "horizon",
    stage: 2,
    map: "strait",
    legacy: { stage: 3, mission: "assault" },
    mission: "assault",
    title: "أفق الأعماق",
    story:
      "استعمل الغواصات لحماية الأسطول، والطيران والدبابات لتدمير القيادة الساحلية.",
  },
  {
    id: "small-eye",
    stage: 2,
    map: "archipelago",
    legacy: { stage: 1, mission: "recon" },
    mission: "recon",
    title: "عين فوق الحدود",
    story:
      "في الأرخبيل المشترك، اكشف منطقة شرق البحر عشر ثوانٍ بطائرة الاستطلاع مع حماية البر والأسطول.",
  },
  {
    id: "long-horizon",
    stage: 2,
    map: "strait",
    legacy: { stage: 0, mission: "siege" },
    mission: "siege",
    title: "مدى الأفق",
    story:
      "الهجوم الختامي المشترك: انقل المشاة على الشاطئ، اكشف جوًا، واحمِ مدفعيتك بالسفن والغواصات.",
  },
];
export const UPGRADE_NAMES = {
  armor: "تدريع",
  weapons: "تطوير الأسلحة",
  logistics: "سعة الذخيرة",
};
export function parseCareer(raw) {
  const d = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (
    !d ||
    d.completed?.length > OPERATIONS.length ||
    (d.reports &&
      (!Array.isArray(d.reports) ||
        d.reports.length > OPERATIONS.length ||
        d.reports.some(
          (r) =>
            !r ||
            (r.stars !== undefined &&
              (!Number.isInteger(r.stars) || r.stars < 1 || r.stars > 3)) ||
            !OPERATIONS.some((o) => o.id === r.id) ||
            ["time", "kills", "losses", "shots", "damage"].some(
              (k) => !Number.isFinite(r[k]) || r[k] < 0 || r[k] > 1e9,
            ),
        ))) ||
    d.version !== 1 ||
    !Array.isArray(d.completed) ||
    d.completed.some((id, i) => id !== OPERATIONS[i]?.id) ||
    !Number.isInteger(d.xp) ||
    d.xp < 0 ||
    d.xp > 1e7 ||
    !Number.isInteger(d.points) ||
    d.points < 0 ||
    d.points > 1000 ||
    !d.upgrades ||
    Object.keys(UPGRADE_NAMES).some(
      (k) =>
        !Number.isInteger(d.upgrades[k]) ||
        d.upgrades[k] < 0 ||
        d.upgrades[k] > 3,
    )
  )
    throw Error("بيانات الحملة غير صالحة");
  return d;
}
export function initialCareer() {
  return {
    version: 1,
    completed: [],
    xp: 0,
    points: 0,
    upgrades: { armor: 0, weapons: 0, logistics: 0 },
    reports: [],
  };
}
export function loadCareer(storage) {
  try {
    const raw = storage.getItem(CAREER_KEY);
    return raw ? parseCareer(raw) : initialCareer();
  } catch {
    return initialCareer();
  }
}
export function nextOperation(career) {
  return OPERATIONS[career.completed.length] || null;
}
export function awardOperation(career, battle) {
  const op = nextOperation(career);
  if (!op || battle.status !== "won" || op.id !== battle.operationId)
    return false;
  career.completed.push(op.id);
  career.points++;
  career.xp += 100 + Math.max(0, Math.round(200 - battle.time / 2));
  career.reports = [
    {
      id: op.id,
      time: Math.round(battle.time),
      ...battle.stats,
      stars: operationStars(battle),
    },
    ...(career.reports || []),
  ].slice(0, OPERATIONS.length);
  return true;
}
export function buyUpgrade(career, key) {
  if (
    !Object.hasOwn(UPGRADE_NAMES, key) ||
    career.points < 1 ||
    career.upgrades[key] >= 3
  )
    return false;
  career.points--;
  career.upgrades[key]++;
  return true;
}

export const SECONDARY_GOALS = {
  "first-light": [
    "احتفظ بمركز القيادة عند 70% من صحته",
    (b) =>
      b.entities.some(
        (e) => e.team === "blue" && e.type === "hq" && e.hp / e.maxHp >= 0.7,
      ),
  ],
  "safe-return": [
    "أنشئ مركزي إمداد",
    (b) =>
      b.entities.filter((e) => e.team === "blue" && e.type === "supply")
        .length >= 2,
  ],
  "sand-shield": ["أنهِ المعركة خلال 8 دقائق", (b) => b.time <= 480],
  "clear-skies": [
    "أبقِ مقاتلتين في الخدمة",
    (b) =>
      b.entities.filter((e) => e.team === "blue" && e.type === "fighter")
        .length >= 2,
  ],
  "silent-wing": [
    "أبقِ قاذفة في الخدمة",
    (b) => b.entities.some((e) => e.team === "blue" && e.type === "bomber"),
  ],
  "harbor-watch": [
    "احتفظ بثلاث وحدات بحرية",
    (b) =>
      b.entities.filter(
        (e) =>
          e.team === "blue" && ["sea", "sub"].includes(e.domain) && e.speed,
      ).length >= 3,
  ],
  "deep-watch": [
    "احتفظ بغواصتين",
    (b) =>
      b.entities.filter((e) => e.team === "blue" && e.type === "submarine")
        .length >= 2,
  ],
  horizon: ["دمّر 8 أهداف", (b) => b.stats.kills >= 8],
  "small-eye": [
    "أبقِ طائرة الاستطلاع سالمة",
    (b) =>
      b.entities.some(
        (e) => e.team === "blue" && e.type === "recon" && e.hp / e.maxHp >= 0.7,
      ),
  ],
  "long-horizon": [
    "أبقِ مدفعية وناقلة في الخدمة",
    (b) =>
      ["artillery", "apc"].every((type) =>
        b.entities.some((e) => e.team === "blue" && e.type === type),
      ),
  ],
};
export function secondaryGoal(battle) {
  const goal = SECONDARY_GOALS[battle.operationId];
  return goal
    ? { text: goal[0], met: goal[1](battle) }
    : { text: "أنهِ المعركة خلال 8 دقائق", met: battle.time <= 480 };
}
export function operationStars(battle) {
  return battle.status === "won"
    ? 1 + Number(secondaryGoal(battle).met) + Number(battle.stats.losses <= 3)
    : 0;
}
export function unlockedEquipment(career) {
  const stars = (career.reports || []).reduce((n, r) => n + (r.stars || 1), 0);
  return { reinforced: stars >= 2, precision: stars >= 5, veteran: stars >= 8 };
}
