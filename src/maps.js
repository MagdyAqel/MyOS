export const MAPS = [
  {
    id: "dunes",
    stage: 0,
    name: "بحر الكثبان",
    description: "ميدان مفتوح مع تلال صخرية وممر وسط واسع.",
    seed: 11,
    sky: "#c0d3db",
    ground: "#bea178",
    obstacles: [
      { x: 550, y: 100, r: 55, h: 62 },
      { x: 580, y: 510, r: 65, h: 50 },
    ],
  },
  {
    id: "canyon",
    stage: 0,
    name: "ممر الوادي",
    description:
      "حاجز جبلي في المنتصف؛ استخدم الممرين الجنوبي والشمالي للالتفاف.",
    seed: 23,
    sky: "#c1b8a9",
    ground: "#ac8059",
    obstacles: [
      { x: 510, y: 220, r: 65, h: 100 },
      { x: 510, y: 360, r: 65, h: 90 },
    ],
  },
  {
    id: "ridge",
    stage: 1,
    name: "قمم النسور",
    description: "مرتفعات وعرة للوحدات البرية، ومسار حر للطيران فوقها.",
    seed: 31,
    sky: "#b5cedd",
    ground: "#7c8a65",
    obstacles: [
      { x: 520, y: 170, r: 74, h: 110 },
      { x: 600, y: 480, r: 75, h: 95 },
    ],
  },
  {
    id: "valley",
    stage: 1,
    name: "وادي الضباب",
    description: "قمم وسطية وممرات جانبية؛ طقس أبرد ورؤية ضبابية.",
    seed: 47,
    sky: "#a4b3bc",
    ground: "#667b6c",
    mist: true,
    obstacles: [
      { x: 490, y: 305, r: 88, h: 125 },
      { x: 670, y: 120, r: 45, h: 65 },
    ],
  },
  {
    id: "strait",
    stage: 2,
    name: "مضيق المرجان",
    description:
      "جزيرتان تفصلان الممرات البحرية؛ حافظ على مسافة القصف من الساحل.",
    seed: 51,
    sky: "#a3cfdb",
    ground: "#cebb8d",
    obstacles: [
      { x: 520, y: 410, r: 58, h: 30 },
      { x: 690, y: 540, r: 35, h: 22 },
    ],
  },
  {
    id: "archipelago",
    stage: 2,
    name: "أرخبيل الحراسة",
    description: "جزر متعددة تفرض مناورة الأسطول عبر ممرات ضيقة.",
    seed: 67,
    sky: "#b7cbd0",
    ground: "#b7aa87",
    obstacles: [
      { x: 450, y: 360, r: 42, h: 35 },
      { x: 590, y: 480, r: 65, h: 40 },
      { x: 740, y: 340, r: 32, h: 25 },
    ],
  },
  {
    id: "trench",
    stage: 3,
    name: "خندق الأزرق",
    description:
      "قاع بحري عميق وعوائق صخرية؛ استخدم السونار والممرات الجانبية.",
    seed: 79,
    sky: "#062b42",
    ground: "#294e61",
    obstacles: [
      { x: 510, y: 170, r: 68, h: 95 },
      { x: 600, y: 500, r: 62, h: 80 },
    ],
  },
  {
    id: "reef",
    stage: 3,
    name: "متاهة الشعاب",
    description: "شعاب متقاربة تغيّر خطوط اقتراب الغواصات من محطة العدو.",
    seed: 83,
    sky: "#073941",
    ground: "#2d605b",
    obstacles: [
      { x: 450, y: 280, r: 53, h: 75 },
      { x: 590, y: 405, r: 61, h: 85 },
      { x: 690, y: 150, r: 47, h: 66 },
    ],
  },
  {
    id: "fireline",
    stage: 0,
    name: "خط المدى",
    seed: 97,
    description:
      "هضاب جانبية وممر للقوات؛ اكشف الهدف بالاستطلاع لتوجيه المدفعية بعيدة المدى.",
    sky: "#c8c3ad",
    ground: "#b59770",
    obstacles: [
      { x: 460, y: 125, r: 65, h: 90 },
      { x: 580, y: 490, r: 70, h: 95 },
    ],
  },
  {
    id: "watchtower",
    stage: 1,
    name: "مرصد الحدود",
    seed: 101,
    description:
      "منطقة استطلاع صغيرة في الجنوب الشرقي؛ تجنب موقع الدفاع وسط الممر.",
    sky: "#aabcc8",
    ground: "#778674",
    obstacles: [
      { x: 510, y: 150, r: 74, h: 110 },
      { x: 590, y: 480, r: 55, h: 85 },
    ],
  },
];
export function mapFor(stage, id) {
  return (
    MAPS.find((m) => m.stage === stage && m.id === id) ||
    MAPS.find((m) => m.stage === stage) ||
    MAPS[0]
  );
}
export function seededRandom(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function blocked(map, x, y, radius = 0) {
  return map.obstacles.some((o) => Math.hypot(x - o.x, y - o.y) < o.r + radius);
}
export function mapSvg(
  map,
  entities = [],
  selected = new Set(),
  focus = null,
  mission = null,
) {
  entities = entities.filter((e) => !e.carriedBy);
  const water = map.stage >= 2;
  const color = map.stage === 3 ? "#163a4b" : water ? "#276d83" : map.ground;
  return `<svg viewBox="0 0 1000 620" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="1000" height="620" fill="${color}"/>${map.stage === 2 ? '<rect width="1000" height="260" fill="#c9b78b"/>' : ""}<path d="M560 0V620" stroke="#ffffff35" stroke-dasharray="14 12" stroke-width="3"/>${map.obstacles.map((o) => `<circle cx="${o.x}" cy="${o.y}" r="${o.r}" fill="${water ? "#8f9173" : "#685c4c"}" stroke="#ffffff30" stroke-width="4"/>`).join("")}${mission === "recon" ? '<circle cx="820" cy="470" r="100" fill="none" stroke="#f2ce79" stroke-width="6"/>' : ""}${entities
    .filter(
      (e) => e.type === "recon" && e.team === "blue" && selected.has(e.id),
    )
    .map(
      (e) =>
        `<circle cx="${e.x}" cy="${e.y}" r="${e.vision || 110}" fill="none" stroke="#81e7cd" stroke-width="4"/>`,
    )
    .join(
      "",
    )}${entities.map((e) => `<circle cx="${e.x}" cy="${e.y}" r="${e.type === "hq" ? 23 : e.speed ? 9 : 14}" fill="${e.team === "blue" ? "#5dd6ff" : "#ff816b"}" ${selected.has(e.id) ? 'stroke="#ffef93" stroke-width="7"' : ""}/>`).join("")}${focus ? `<circle cx="${focus.x}" cy="${focus.y}" r="75" fill="none" stroke="#fff" stroke-width="4" opacity=".7"/>` : ""}</svg>`;
}
