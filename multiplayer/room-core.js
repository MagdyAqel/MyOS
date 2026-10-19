import { advancedOrder, startingMoney } from "../src/battle-expansion.js";
import { Battle } from "../src/battle.js";
import { snapshotBattle, restoreBattle } from "../src/battle-save.js";
import { MAPS } from "../src/maps.js";
import { specialAction, visionRadius } from "../src/unit-abilities.js";
import {
  FORMATIONS,
  relocateHQ,
  suggestedHQDestination,
} from "../src/tactics.js";
const emptyStats = () => ({ kills: 0, losses: 0, shots: 0, damage: 0 });
const settings = () => ({
  formation: "spread",
  commandMode: "move",
  rally: null,
});
export class RoomCore {
  constructor({ stage = 0, map, startingCash } = {}) {
    if (
      !Number.isInteger(stage) ||
      !MAPS.some((m) => m.stage === stage && m.id === map)
    )
      throw Error("خريطة غير صالحة");
    if (startingCash !== undefined && startingMoney(startingCash, -1) === -1)
      throw Error("مال البداية غير صالح");
    this.battle = new Battle(stage, map, { startingCash });
    const b = this.battle;
    b.entities = b.entities.filter((e) => e.team === "blue");
    for (const unit of [...b.entities])
      b.add(unit.type, "red", 1000 - unit.x, unit.y);
    b.enemy.cash = b.cash;
    b.multiplayer = true;
    b.paused = true;
    b.nextWave = 1e8;
    b.statsRed = emptyStats();
    this.settings = { blue: settings(), red: settings() };
    this.redExplored = new Set();
  }
  static restore(saved) {
    const core = new RoomCore({
      stage: saved.battle.stage,
      map: saved.battle.map,
    });
    core.battle = restoreBattle(saved.battle);
    core.battle.multiplayer = true;
    core.battle.statsRed = saved.statsRed || emptyStats();
    core.settings = saved.settings;
    core.redExplored = new Set(saved.redExplored || []);
    return core;
  }
  serialize() {
    return {
      battle: snapshotBattle(this.battle),
      statsRed: this.battle.statsRed,
      settings: this.settings,
      redExplored: [...this.redExplored],
    };
  }
  act(team, action) {
    if (
      !["blue", "red"].includes(team) ||
      !action ||
      typeof action !== "object" ||
      Array.isArray(action)
    )
      throw Error("أمر غير صالح");
    const b = this.battle;
    if (b.paused || b.status !== "playing")
      return { ok: false, text: "المواجهة متوقفة حتى يتصل اللاعبان ويستعدا" };
    if (
      ![
        "purchase",
        "autoBuild",
        "command",
        "service",
        "relocate",
        "suggestHQ",
        "depth",
        "rally",
        "board",
        "unload",
        "recon",
        "hold",
        "retreat",
        "priority",
      ].includes(action.kind)
    )
      throw Error("أمر غير مسموح");
    if (
      ["relocate", "rally", "command", "recon"].includes(action.kind) &&
      (!Number.isFinite(action.x) ||
        !Number.isFinite(action.y) ||
        action.x < 0 ||
        action.x > 1000 ||
        action.y < 0 ||
        action.y > 620)
    )
      throw Error("وجهة غير صالحة");
    if (
      action.selected !== undefined &&
      (!Array.isArray(action.selected) ||
        action.selected.length > 40 ||
        action.selected.some((id) => !Number.isInteger(id)))
    )
      throw Error("تحديد غير صالح");
    if (
      action.carrier !== undefined &&
      (!Number.isInteger(action.carrier) || action.carrier < 1)
    )
      throw Error("ناقلة غير صالحة");
    const own = this.settings[team];
    if (action.formation !== undefined) {
      if (!Object.hasOwn(FORMATIONS, action.formation))
        throw Error("تشكيل غير صالح");
      own.formation = action.formation;
    }
    if (action.commandMode !== undefined) {
      if (
        !["move", "attackMove", "guard", "patrol"].includes(action.commandMode)
      )
        throw Error("وضع أمر غير صالح");
      own.commandMode = action.commandMode;
    }
    b.actorTeam = team;
    b.formation = own.formation;
    b.commandMode = own.commandMode;
    b.rally = own.rally;
    b.selected = new Set(
      (action.selected || []).filter((id) =>
        b.entities.some(
          (e) => e.id === id && e.team === team && e.speed && !e.carriedBy,
        ),
      ),
    );
    let ok = true;
    try {
      if (action.kind === "purchase" || action.kind === "autoBuild") {
        if (
          typeof action.unit !== "string" ||
          action.unit.length > 20 ||
          b.entities.length >= 160
        )
          throw Error("لا يمكن إضافة وحدات أو مبانٍ أخرى");
        if (action.kind === "purchase")
          ok = b.purchase(action.unit, action.x, action.y, action.design);
        else {
          ok = false;
          const ys =
            action.unit === "harbor"
              ? [235, 250]
              : b.stageIndex >= 2
                ? [75, 160]
                : [150, 450, 75, 530, 240];
          outer: for (const y of ys)
            for (const rawX of [320, 440, 240, 510, 90])
              if (
                b.purchase(action.unit, team === "red" ? 1000 - rawX : rawX, y)
              ) {
                ok = true;
                break outer;
              }
        }
      } else if (["hold", "retreat", "priority"].includes(action.kind)) {
        ok = advancedOrder(b, action);
      } else if (["board", "unload", "recon"].includes(action.kind)) {
        ok = specialAction(b, action);
      } else if (action.kind === "command") {
        if (!b.selected.size) return { ok: false, text: "حدد وحداتك أولًا" };
        b.command(action.x, action.y);
      } else if (action.kind === "service") b.serviceSelected();
      else if (action.kind === "relocate")
        ok = relocateHQ(b, action.x, action.y);
      else if (action.kind === "suggestHQ") ok = suggestedHQDestination(b);
      else if (action.kind === "rally") {
        own.rally = {
          x: Math.max(25, Math.min(975, action.x)),
          y: Math.max(25, Math.min(595, action.y)),
        };
        b.message = "تغيرت نقطة تجمع جيشك";
      } else if (action.kind === "depth") {
        for (const unit of b.entities)
          if (b.selected.has(unit.id) && unit.type === "submarine")
            unit.depthTarget = (unit.depthTarget ?? 1) > 0.5 ? 0 : 1;
        b.message = "تغيير عمق الغواصات المحددة";
      }
      return { ok, text: b.message };
    } finally {
      b.actorTeam = null;
      b.selected.clear();
      b.rally = null;
      b.commandMode = "move";
      b.formation = "spread";
    }
  }
  tick(dt) {
    this.battle.update(dt);
    const b = this.battle;
    for (const e of b.entities.filter((e) => e.team === "red")) {
      const r = visionRadius(e);
      for (
        let y = Math.max(0, Math.floor((e.y - r) / 25));
        y < Math.min(25, Math.ceil((e.y + r) / 25));
        y++
      )
        for (
          let x = Math.max(0, Math.floor((e.x - r) / 25));
          x < Math.min(40, Math.ceil((e.x + r) / 25));
          x++
        )
          if (Math.hypot(x * 25 + 12.5 - e.x, y * 25 + 12.5 - e.y) < r)
            this.redExplored.add(y * 40 + x);
    }
  }
  view(team) {
    const b = this.battle,
      data = snapshotBattle(b);
    data.entities = data.entities.filter(
      (e) =>
        b.status !== "playing" ||
        e.team === team ||
        e.team === "neutral" ||
        b.isVisible(
          b.entities.find((a) => a.id === e.id),
          team,
        ),
    );
    data.shells = data.shells.filter(
      (s) =>
        s.team === team || b.isVisible({ x: s.x, y: s.y, team: s.team }, team),
    );
    if (team === "red") {
      for (const e of data.entities)
        e.team = e.team === "red" ? "blue" : e.team === "blue" ? "red" : e.team;
      for (const s of data.shells) s.team = s.team === "red" ? "blue" : "red";
      data.cash = b.enemy.cash;
      data.status =
        b.status === "won" ? "lost" : b.status === "lost" ? "won" : b.status;
      data.explored = [...this.redExplored];
      data.stats = { ...b.statsRed };
    }
    data.enemy = { cash: 0, nextDecision: 1e8, nextOrders: 1e8 };
    data.selected = [];
    data.formation = this.settings[team].formation;
    data.commandMode = this.settings[team].commandMode;
    data.rally = this.settings[team].rally;
    return data;
  }
}
