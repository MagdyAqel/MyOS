import { STAGES } from "./campaign.js";
export const WIDTH = 1000,
  HEIGHT = 620;
export const TYPES = {
  hq: { name: "مركز القيادة", hp: 1800, radius: 38, domain: "ground" },
  power: {
    name: "محطة طاقة",
    cost: 300,
    hp: 450,
    radius: 26,
    domain: "ground",
  },
  supply: {
    name: "مركز إمداد",
    cost: 400,
    hp: 550,
    radius: 28,
    domain: "ground",
  },
  barracks: {
    name: "ثكنة",
    cost: 400,
    hp: 600,
    radius: 28,
    needs: "power",
    domain: "ground",
  },
  factory: {
    name: "مصنع مدرعات",
    cost: 650,
    hp: 800,
    radius: 32,
    needs: "power",
    domain: "ground",
  },
  airfield: {
    name: "مطار",
    cost: 700,
    hp: 750,
    radius: 34,
    needs: "power",
    domain: "ground",
  },
  harbor: {
    name: "ميناء",
    cost: 650,
    hp: 800,
    radius: 32,
    needs: "power",
    domain: "ground",
  },
  turret: {
    name: "برج دفاع",
    cost: 450,
    hp: 550,
    radius: 20,
    damage: 24,
    range: 165,
    cooldown: 0.9,
    needs: "power",
    domain: "ground",
    targets: ["ground", "air", "sea", "sub"],
  },
  soldier: {
    name: "جندي",
    cost: 150,
    hp: 110,
    radius: 7,
    speed: 55,
    damage: 12,
    range: 105,
    cooldown: 0.8,
    needs: "barracks",
    domain: "ground",
    targets: ["ground"],
  },
  tank: {
    name: "دبابة",
    cost: 500,
    hp: 430,
    radius: 14,
    speed: 38,
    damage: 40,
    range: 145,
    cooldown: 1.2,
    needs: "factory",
    domain: "ground",
    targets: ["ground"],
  },
  fighter: {
    name: "مقاتلة",
    cost: 550,
    hp: 250,
    radius: 18,
    speed: 95,
    damage: 25,
    range: 180,
    cooldown: 0.85,
    needs: "airfield",
    domain: "air",
    targets: ["air", "ground", "sea"],
  },
  bomber: {
    name: "قاذفة",
    cost: 850,
    hp: 450,
    radius: 22,
    speed: 60,
    damage: 85,
    range: 160,
    cooldown: 2,
    needs: "airfield",
    domain: "air",
    targets: ["ground", "sea"],
  },
  destroyer: {
    name: "مدمرة",
    cost: 650,
    hp: 700,
    radius: 23,
    speed: 32,
    damage: 50,
    range: 240,
    cooldown: 1.4,
    needs: "harbor",
    domain: "sea",
    targets: ["ground", "sea", "sub", "air"],
  },
  submarine: {
    name: "غواصة",
    cost: 600,
    hp: 500,
    radius: 19,
    speed: 40,
    damage: 65,
    range: 185,
    cooldown: 1.6,
    needs: "harbor",
    domain: "sub",
    targets: ["sea", "sub"],
  },
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export class Battle {
  constructor(stage = 0) {
    this.stageIndex = Number.isInteger(stage) && STAGES[stage] ? stage : 0;
    this.stage = STAGES[this.stageIndex];
    this.nextId = 1;
    this.cash = this.stage.cash;
    this.time = 0;
    this.wave = 0;
    this.nextWave = this.stage.interval;
    this.income = 0;
    this.status = "playing";
    this.paused = false;
    this.selected = new Set();
    this.effects = [];
    this.entities = [];
    this.message = this.stage.description;
    const navy = this.stageIndex >= 2,
      abyss = this.stageIndex === 3;
    this.add("hq", "blue", 130, navy && !abyss ? 140 : 320);
    this.add("hq", "red", 880, navy && !abyss ? 140 : 300);
    this.add("turret", "red", 780, navy && !abyss ? 165 : 240);
    this.add("turret", "red", 800, navy && !abyss ? 70 : 380);
    if (this.stageIndex === 0) {
      this.add("soldier", "blue", 205, 285);
      this.add("soldier", "blue", 205, 350);
      this.add("tank", "blue", 210, 320);
    }
    if (this.stageIndex === 1) {
      this.add("power", "blue", 80, 480);
      this.add("airfield", "blue", 130, 150);
      this.add("fighter", "blue", 230, 280);
      this.add("fighter", "blue", 240, 360);
      this.add("bomber", "blue", 190, 310);
    }
    if (navy) {
      this.add("power", "blue", 70, 70);
      this.add("harbor", "blue", 160, 245);
      this.add(abyss ? "submarine" : "destroyer", "blue", 220, 340);
      this.add("submarine", "blue", 230, 420);
      this.add(abyss ? "submarine" : "destroyer", "blue", 180, 500);
    }
  }
  add(type, team, x, y) {
    const e = {
      ...TYPES[type],
      id: this.nextId++,
      type,
      team,
      x,
      y,
      maxHp: TYPES[type].hp,
      cd: 0,
      order: null,
    };
    if (type === "hq" && this.stageIndex === 3) {
      e.domain = "sub";
      e.name = "محطة قيادة الأعماق";
    }
    if (type === "turret" && this.stageIndex === 3) e.domain = "sub";
    this.entities.push(e);
    return e;
  }
  has(type) {
    return this.entities.some(
      (e) => e.team === "blue" && e.type === type && e.hp > 0,
    );
  }
  allowed(type) {
    return (
      this.stage.buildings.includes(type) || this.stage.units.includes(type)
    );
  }
  constrain(unit, x, y) {
    return {
      x: Math.max(20, Math.min(980, x)),
      y: Math.max(
        unit.domain === "sea" || unit.domain === "sub"
          ? this.stageIndex === 2
            ? 285
            : 25
          : 20,
        Math.min(595, y),
      ),
    };
  }
  purchase(type, x, y) {
    if (this.status !== "playing" || this.paused) return false;
    const spec = TYPES[type];
    if (!spec?.cost || !this.allowed(type)) {
      this.message = "هذه الوحدة غير متاحة في المرحلة الحالية";
      return false;
    }
    if (spec.needs && !this.has(spec.needs)) {
      this.message = `يتطلب ${TYPES[spec.needs].name} أولًا`;
      return false;
    }
    if (spec.speed && !this.has("power")) {
      this.message = "تحتاج إلى محطة طاقة";
      return false;
    }
    if (this.cash < spec.cost) {
      this.message = "الموارد غير كافية";
      return false;
    }
    if (spec.speed) {
      if (
        this.entities.filter((e) => e.team === "blue" && e.speed).length >= 40
      ) {
        this.message = "الحد الأقصى ٤٠ وحدة";
        return false;
      }
      const producer = this.entities.find(
        (e) => e.team === "blue" && e.type === spec.needs,
      );
      const n = this.entities.filter(
        (e) => e.speed && e.team === "blue",
      ).length;
      x = Math.min(560, producer.x + 70 + (n % 3) * 20);
      y =
        producer.y +
        (spec.domain === "sea" || spec.domain === "sub"
          ? 95
          : ((n % 5) - 2) * 25);
      ({ x, y } = this.constrain(spec, x, y));
    } else {
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < spec.radius + 10 ||
        x > 550 ||
        y < spec.radius + 10 ||
        y > HEIGHT - spec.radius - 10
      ) {
        this.message = "اختر مساحة داخل النصف الأيسر من الخريطة";
        return false;
      }
      if (
        this.stageIndex >= 2 &&
        (type === "harbor" ? y < 215 || y > 260 : y > 200)
      ) {
        this.message =
          type === "harbor"
            ? "ضع الميناء قرب الشاطئ بين خطّي 215 و260"
            : "ابنِ منشآت الدعم في القطاع العلوي قبل خط 200";
        return false;
      }
      if (
        this.entities.some(
          (e) =>
            !e.speed && distance(e, { x, y }) < e.radius + spec.radius + 12,
        )
      ) {
        this.message = "المكان قريب جدًا من مبنى آخر";
        return false;
      }
    }
    this.cash -= spec.cost;
    this.add(type, "blue", x, y);
    this.message = `تم تجهيز ${spec.name}`;
    return true;
  }
  selectAll() {
    this.selected = new Set(
      this.entities
        .filter((e) => e.team === "blue" && e.speed)
        .map((e) => e.id),
    );
  }
  selectAt(x, y, additive = false) {
    const entity = this.entities.find(
      (e) =>
        e.team === "blue" && e.speed && distance(e, { x, y }) < e.radius + 14,
    );
    if (!additive) this.selected.clear();
    if (entity) this.selected.add(entity.id);
  }
  command(x, y) {
    if (
      this.paused ||
      this.status !== "playing" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    )
      return;
    const enemy = this.entities.find(
      (e) => e.team === "red" && distance(e, { x, y }) < e.radius + 16,
    );
    let i = 0,
      unsupported = 0;
    for (const unit of this.entities.filter((e) => this.selected.has(e.id))) {
      if (enemy && !unit.targets.includes(enemy.domain)) {
        unsupported++;
        continue;
      }
      unit.order = enemy
        ? { target: enemy.id }
        : this.constrain(unit, x + (i % 3) * 20, y + Math.floor(i / 3) * 20);
      i++;
    }
    this.message = i
      ? enemy
        ? "أمر هجوم على الهدف"
        : "تم إرسال أمر التحرك"
      : unsupported
        ? "الوحدات المحددة لا تستطيع مهاجمة هذا النوع من الأهداف"
        : "اختر وحدة أو اضغط تحديد الجيش أولًا";
  }
  update(dt) {
    if (
      this.paused ||
      this.status !== "playing" ||
      !Number.isFinite(dt) ||
      dt <= 0
    )
      return;
    this.time += dt;
    this.income += dt;
    while (this.income >= 5) {
      this.income -= 5;
      this.cash +=
        this.entities.filter(
          (e) => e.type === "supply" && e.team === "blue" && e.hp > 0,
        ).length * 180;
    }
    if (this.time >= this.nextWave && this.wave < this.stage.waves) {
      this.wave++;
      this.nextWave += this.stage.interval;
      for (let i = 0; i < this.wave + 2; i++) {
        const pool = this.stage.enemies;
        const type =
          this.stageIndex === 0 && this.wave < 3
            ? "soldier"
            : pool[i % pool.length];
        this.add(
          type,
          "red",
          940,
          this.stageIndex >= 2 ? 320 + i * 32 : 110 + i * 42,
        );
      }
      this.message = `الموجة ${this.wave} تقترب! احمِ مركز القيادة.`;
    }
    for (const unit of this.entities) {
      if (unit.hp <= 0 || !unit.damage) continue;
      if (unit.team === "blue" && unit.type === "turret" && !this.has("power"))
        continue;
      unit.cd = Math.max(0, unit.cd - dt);
      const opponents = this.entities.filter(
        (e) =>
          e.team !== unit.team && e.hp > 0 && unit.targets.includes(e.domain),
      );
      const ordered = unit.order?.target
        ? opponents.find((e) => e.id === unit.order.target)
        : null;
      if (unit.order?.target && !ordered) unit.order = null;
      const nearby = opponents
        .filter((e) => distance(unit, e) <= unit.range + e.radius)
        .sort((a, b) => distance(unit, a) - distance(unit, b))[0];
      const target =
        ordered && distance(unit, ordered) <= unit.range + ordered.radius
          ? ordered
          : nearby;
      if (target) {
        if (unit.cd <= 0) {
          target.hp -= unit.damage;
          unit.cd = unit.cooldown;
          this.effects.push({
            x: unit.x,
            y: unit.y,
            tx: target.x,
            ty: target.y,
            domain: unit.domain,
            targetDomain: target.domain,
            team: unit.team,
            life: 0.2,
          });
        }
      } else if (unit.speed) {
        const enemyHQ = opponents.find((e) => e.type === "hq");
        const destination =
          ordered ||
          (unit.order?.x !== undefined ? unit.order : null) ||
          (unit.team === "red" ? enemyHQ || opponents[0] : null);
        if (destination) {
          const point = this.constrain(unit, destination.x, destination.y),
            d = distance(unit, point);
          if (d > 5) {
            const step = Math.min(unit.speed * dt, d);
            unit.x += ((point.x - unit.x) / d) * step;
            unit.y += ((point.y - unit.y) / d) * step;
            unit.heading = Math.atan2(point.x - unit.x, point.y - unit.y);
          } else if (!ordered) unit.order = null;
        }
      }
    }
    this.entities = this.entities.filter((e) => e.hp > 0);
    this.selected = new Set(
      [...this.selected].filter((id) => this.entities.some((e) => e.id === id)),
    );
    this.effects = this.effects.filter((e) => (e.life -= dt) > 0);
    if (!this.has("hq")) {
      this.status = "lost";
      this.message = "سقط مركز القيادة. أعد المحاولة بخطة دفاع أقوى.";
    } else if (
      !this.entities.some((e) => e.team === "red" && e.type === "hq")
    ) {
      this.status = "won";
      this.message = "انتصار! تم تدمير مركز قيادة العدو.";
    }
  }
}
