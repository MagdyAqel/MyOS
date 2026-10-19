import { test } from "node:test";
import assert from "node:assert/strict";
import { MAPS, mapFor, blocked } from "../src/maps.js";
import { findRoute, moveUnit, walkable, clearShot } from "../src/navigation.js";
import { Battle } from "../src/battle.js";
import { cueForUnit, loadSoundSettings } from "../src/audio.js";
test("ten distinct maps are assigned to their own campaign environments", () => {
  assert.equal(new Set(MAPS.map((m) => m.id)).size, 10);
  for (let stage = 0; stage < 4; stage++) {
    assert.equal(MAPS.filter((m) => m.stage === stage).length, stage < 2 ? 3 : 2);
    assert.equal(mapFor(stage, "bad").stage, stage);
  }
});
test("a tank routes around a canyon obstacle while aircraft have a direct route", () => {
  const map = mapFor(0, "canyon"),
    tank = { x: 300, y: 300, radius: 14, domain: "ground", speed: 50 };
  const end = { x: 760, y: 300 };
  const route = findRoute(map, tank, tank, end);
  assert.ok(route.length > 10);
  assert.ok(route.every((p) => walkable(map, tank, p.x, p.y)));
  for (let i = 0; i < 600; i++) {
    moveUnit(tank, end, map, 0.05);
    assert.equal(blocked(map, tank.x, tank.y, tank.radius), false);
  }
  assert.ok(Math.hypot(tank.x - end.x, tank.y - end.y) < 8);
  assert.deepEqual(findRoute(map, { domain: "air", radius: 18 }, tank, end), [
    end,
  ]);
});
test("reefs constrain naval movement, block ground shots, and prevent building", () => {
  const sea = mapFor(2, "archipelago"),
    unit = { domain: "sea", radius: 23 };
  assert.ok(
    findRoute(sea, unit, { x: 250, y: 340 }, { x: 900, y: 340 }).every(
      (p) => p.y >= 285 && !blocked(sea, p.x, p.y, unit.radius),
    ),
  );
  const canyon = mapFor(0, "canyon");
  assert.equal(
    clearShot(
      canyon,
      { x: 350, y: 220, domain: "ground" },
      { x: 650, y: 220, domain: "ground" },
    ),
    false,
  );
  assert.equal(
    clearShot(
      canyon,
      { x: 350, y: 220, domain: "air" },
      { x: 650, y: 220, domain: "ground" },
    ),
    true,
  );
  const battle = new Battle(0, "canyon");
  battle.add("power", "blue", 80, 70);
  assert.equal(battle.purchase("turret", 510, 220), false);
  assert.match(battle.message, /تضاريس/);
});
test("combat and purchasing emit each event once for sound and visual effects", () => {
  const b = new Battle();
  assert.equal(b.purchase("power", 320, 450), true);
  assert.equal(b.takeEvents().filter((e) => e.kind === "build").length, 1);
  assert.equal(b.takeEvents().length, 0);
  const tank = b.entities.find((e) => e.type === "tank");
  const foe = b.add("soldier", "red", tank.x + 30, tank.y);
  b.update(0.1);
  assert.ok(b.takeEvents().some((e) => e.kind === "shot" && e.type === "tank"));
  foe.hp = 0;
  b.update(0.1);
  assert.equal(b.takeEvents().filter((e) => e.kind === "explosion").length, 1);
  b.update(0.1);
  assert.ok(!b.takeEvents().some((e) => e.kind === "explosion"));
});
test("weapon types have different sound recipes and stored volume is bounded", () => {
  assert.equal(
    new Set(
      ["soldier", "tank", "fighter", "bomber", "destroyer", "submarine"].map(
        cueForUnit,
      ),
    ).size,
    6,
  );
  assert.deepEqual(loadSoundSettings({ getItem: () => '{"volume":9}' }), {
    volume: 1,
  });
  assert.deepEqual(loadSoundSettings({ getItem: () => "{bad" }), {
    volume: 0.45,
  });
});
