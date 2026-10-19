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
      "أصبح الطريق آمنًا. فكك قيادة الهجوم الأرضي قبل انتقال الحملة إلى الجو.",
  },
  {
    id: "clear-skies",
    stage: 1,
    mission: "intercept",
    title: "سماء مفتوحة",
    story: "تعترض غارة طريق الأسطول. أسقط الطائرات قبل انتهاء نافذة الاعتراض.",
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
      "سيطر على الميناء لتأمين الإمداد البحري، وامنع السفن المعادية من الاقتراب.",
  },
  {
    id: "deep-watch",
    stage: 3,
    mission: "survive",
    title: "الحارس الصامت",
    story: "حركة غواصات قرب المحطة. احمِ أجهزة الاتصال حتى يكتمل الإرسال.",
  },
  {
    id: "horizon",
    stage: 3,
    mission: "assault",
    title: "أفق الأعماق",
    story: "وصلت إحداثيات القيادة المغمورة. حيّدها لفتح طريق الاستطلاع الأخير.",
  },
  {
    id: "small-eye",
    stage: 1,
    map: "watchtower",
    mission: "recon",
    title: "عين فوق الحدود",
    story:
      "اختر منطقة المراقبة شرق الخريطة. أبقِ طائرة الاستطلاع قرب الدائرة عشر ثوانٍ مع تجنب الدفاعات.",
  },
  {
    id: "long-horizon",
    stage: 0,
    map: "fireline",
    mission: "siege",
    title: "مدى الأفق",
    story:
      "انقل المشاة بالناقلات لحماية المدفعية. اكشف قيادة الخصم جوًا ثم اقصفها من خارج مدى دفاعاتها.",
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
    { id: op.id, time: Math.round(battle.time), ...battle.stats },
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
