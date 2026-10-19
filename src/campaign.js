export const STAGES = [
  {
    id: "desert",
    name: "درع الصحراء",
    category: "مهمة برية",
    terrain: "desert",
    cash: 2400,
    waves: 5,
    interval: 40,
    description: "أنشئ خطوط الإمداد، درّب المدرعات ودمّر مقر العدو في الصحراء.",
    buildings: ["supply", "power", "barracks", "factory", "airfield", "turret"],
    units: ["soldier", "tank", "apc", "artillery", "recon", "drone"],
    enemies: ["soldier", "soldier", "tank"],
  },
  {
    id: "sky",
    name: "السيادة الجوية",
    category: "مهمة طيران",
    terrain: "highland",
    cash: 3800,
    waves: 4,
    interval: 48,
    description:
      "قد مقاتلاتك وقاذفاتك فوق الهضاب؛ احمِ القاعدة من الغارات ودمّر قيادة العدو.",
    buildings: ["supply", "power", "airfield", "barracks", "factory", "turret"],
    units: ["fighter", "bomber", "recon", "drone", "soldier", "apc", "artillery"],
    enemies: ["fighter", "fighter", "bomber"],
  },
  {
    id: "sea",
    name: "حارس المضيق",
    category: "مهمة بحرية",
    terrain: "coast",
    cash: 3800,
    waves: 4,
    interval: 48,
    description:
      "أنشئ مبانيك على الساحل (أعلى الخريطة) والميناء عند الشاطئ، ثم أرسل السفن لمهاجمة مقر العدو.",
    buildings: ["supply", "power", "harbor", "airfield", "turret"],
    units: ["destroyer", "submarine", "fighter", "recon", "drone"],
    enemies: ["destroyer", "submarine", "destroyer"],
  },
  {
    id: "abyss",
    name: "أعماق صامتة",
    category: "مهمة غواصات",
    terrain: "abyss",
    cash: 4200,
    waves: 5,
    interval: 48,
    description:
      "أسطول غواصات في الأعماق. ابنِ منصات الدعم في أعلى الخريطة ودمّر محطة القيادة الحمراء تحت الماء.",
    buildings: ["supply", "power", "harbor", "turret"],
    units: ["submarine", "destroyer"],
    enemies: ["submarine", "submarine", "destroyer"],
  },
];
export function loadCampaign(storage) {
  try {
    const data = JSON.parse(storage.getItem("myos-campaign-v1"));
    return {
      stage: Math.max(
        0,
        Math.min(3, Number.isInteger(data?.stage) ? data.stage : 0),
      ),
      completed: [
        ...new Set(
          (Array.isArray(data?.completed) ? data.completed : []).filter(
            (n) => Number.isInteger(n) && n >= 0 && n < 4,
          ),
        ),
      ],
    };
  } catch {
    return { stage: 0, completed: [] };
  }
}
