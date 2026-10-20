import { test } from "node:test";
import assert from "node:assert/strict";
import { Battle, TYPES } from "../src/battle.js";
import { MAPS, LARGE_MAP_IDS, blocked, mapSvg } from "../src/maps.js";
import { mapSize, mapPoint, mapGrid } from "../src/world.js";
import { findRoute, moveUnit, walkable, clearShot } from "../src/navigation.js";
import { snapshotBattle, restoreBattle } from "../src/battle-save.js";
import { attackHeadquarters } from "../src/battle-orders.js";
import { updateExploration } from "../src/systems.js";
import { specialAction } from "../src/unit-abilities.js";
import { RoomCore } from "../multiplayer/room-core.js";

test("large battlefields have real additional space and safe initial deployments", () => {
  for (const [stage, id] of LARGE_MAP_IDS.entries()) {
    const b = new Battle(stage, id);
    assert.equal(b.width, 1600);
    assert.equal(b.height, 1000);
    assert.ok(b.width * b.height > 2.5 * 1000 * 620);
    assert.ok(
      b.entities.find((e) => e.team === "red" && e.type === "hq").x > 1300,
    );
    for (const e of b.entities) {
      assert.equal(
        blocked(b.map, e.x, e.y, e.radius),
        false,
        `${id}: ${e.type}`,
      );
      if (e.speed) assert.ok(walkable(b.map, e, e.x, e.y), `${id}: ${e.type}`);
    }
    assert.match(mapSvg(b.map), /viewBox="0 0 1600 1000"/);
  }
  for (const map of MAPS.filter((m) => !LARGE_MAP_IDS.includes(m.id)))
    assert.deepEqual(mapSize(map), { width: 1000, height: 620 });
});

test("tanks, ships and submarines physically cross large maps around barriers without cutting through rocks", () => {
  for (const [stage, type, y] of [
    [0, "tank", 300],
    [1, "tank", 320],
    [2, "tank", 140],
    [2, "destroyer", 410],
    [3, "submarine", 320],
  ]) {
    const b = new Battle(stage, LARGE_MAP_IDS[stage]);
    const start = mapPoint(b.map, 230, y),
      end = mapPoint(b.map, 870, y);
    const unit = { ...TYPES[type], ...start };
    const route = findRoute(b.map, unit, start, end);
    assert.ok(route.length > 20, `${type}: reachable route`);
    assert.ok(route.every((p) => walkable(b.map, unit, p.x, p.y)));
    for (let i = 0; i < 1600; i++) {
      moveUnit(unit, end, b.map, 0.05);
      assert.equal(
        blocked(b.map, unit.x, unit.y, unit.radius),
        false,
        `${stage}/${type} clips rock`,
      );
    }
    assert.ok(
      Math.hypot(unit.x - end.x, unit.y - end.y) < 8,
      `${type}: reaches opposite army`,
    );
  }
  const map = MAPS.find((m) => m.id === LARGE_MAP_IDS[0]);
  const from = { x: 600, y: 300, domain: "ground" },
    to = { x: 1000, y: 300, domain: "ground" };
  assert.equal(clearShot(map, from, to), false);
  assert.equal(clearShot(map, { ...from, domain: "air" }, to), true);
});

test("orders, recon, exploration and saves use the far edge of large maps while legacy bounds remain enforced", () => {
  const b = new Battle(1, LARGE_MAP_IDS[1]);
  const recon = b.add("recon", "blue", 1450, 890);
  b.selected = new Set([recon.id]);
  assert.equal(specialAction(b, { kind: "recon", x: 1510, y: 900 }), true);
  b.rally = { x: 1500, y: 900 };
  b.nextExplore = 0;
  updateExploration(b);
  assert.ok([...b.explored].some((i) => i > 2000));
  const data = snapshotBattle(b),
    restored = restoreBattle(data);
  assert.deepEqual(restored.rally, b.rally);
  assert.deepEqual(
    restored.entities.find((e) => e.id === recon.id).recon,
    recon.recon,
  );
  assert.deepEqual(restored.explored, b.explored);
  const { cols, rows } = mapGrid(b.map);
  assert.throws(
    () => restoreBattle({ ...data, explored: [cols * rows] }),
    /رؤية/,
  );
  const bad = structuredClone(data);
  bad.entities[0].x = 1601;
  assert.throws(() => restoreBattle(bad), /وحدة/);
  const legacy = snapshotBattle(new Battle());
  legacy.entities[0].x = 1300;
  assert.throws(() => restoreBattle(legacy), /وحدة/);
});

test("large-map attack advances beyond the old boundary and relocated headquarters remain valid", () => {
  const b = new Battle(0, LARGE_MAP_IDS[0]);
  b.multiplayer = true;
  b.nextWave = 1e8;
  b.entities = b.entities.filter((e) => e.type !== "turret");
  b.selectAll();
  assert.equal(attackHeadquarters(b), true);
  assert.ok(
    b.entities.filter((e) => e.attackGoal).every((e) => e.attackGoal.x > 1200),
  );
  for (let i = 0; i < 1000 && b.status === "playing"; i++) b.update(0.05);
  assert.ok(b.entities.some((e) => e.team === "blue" && e.speed && e.x > 1000));
  assert.ok(
    b.entities.find((e) => e.type === "hq" && e.team === "red").hp <
      TYPES.hq.hp,
  );
  assert.doesNotThrow(() => restoreBattle(snapshotBattle(b)));
});

test("online large maps validate both players' distant orders, construction, fog and saved room state", () => {
  const room = new RoomCore({
    stage: 0,
    map: LARGE_MAP_IDS[0],
    startingCash: 10000,
  });
  room.battle.paused = false;
  for (const team of ["blue", "red"]) {
    const unit = room.battle.entities.find(
      (e) => e.team === team && e.type === "tank",
    );
    const point = { x: team === "blue" ? 1450 : 150, y: 920 };
    assert.equal(
      room.act(team, { kind: "command", ...point, selected: [unit.id] }).ok,
      true,
    );
    assert.ok(unit.order.y > 620);
    assert.equal(room.act(team, { kind: "rally", ...point }).ok, true);
    assert.equal(room.act(team, { kind: "autoBuild", unit: "power" }).ok, true);
    const hq = room.battle.entities.find(
      (e) => e.team === team && e.type === "hq",
    );
    assert.equal(
      room.act(team, { kind: "relocate", x: hq.x, y: 900 }).ok,
      true,
    );
    assert.throws(
      () => room.act(team, { kind: "command", x: 1601, y: 900 }),
      /وجهة/,
    );
  }
  for (let i = 0; i < 400; i++) room.tick(0.05);
  assert.ok([...room.redExplored].some((i) => i >= 1600));
  for (const team of ["blue", "red"])
    assert.doesNotThrow(() => restoreBattle(room.view(team)));
  const restored = RoomCore.restore(room.serialize());
  assert.equal(restored.battle.width, 1600);
  assert.deepEqual(restored.settings, room.settings);
});
