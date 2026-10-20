import { test } from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/battle.js";
import { attackHeadquarters, repairBuilding } from "../src/battle-orders.js";
import { snapshotBattle, restoreBattle } from "../src/battle-save.js";
import { RoomCore } from "../multiplayer/room-core.js";
import { PerformanceGovernor } from "../src/render-performance.js";
const advance = (b, seconds) => {
  for (let i = 0; i < seconds * 20; i++) b.update(0.05);
};
const quiet = (stage = 0) => {
  const b = new Battle(stage);
  b.multiplayer = true;
  b.nextWave = 1e8;
  b.entities = b.entities.filter((e) => e.type !== "turret");
  return b;
};
test("automatic graphics quality reacts to sustained very slow frames and ignores background-tab gaps", () => {
  const governor = new PerformanceGovernor("medium");
  assert.equal(governor.sample(5000, 5000), null);
  let quality;
  for (let i = 1; i <= 8; i++)
    quality = governor.sample(400, 5000 + i * 400) || quality;
  assert.equal(quality, "low");
  assert.equal(governor.quality, "low");
});
test("select army then attack advances through fog and actually damages the enemy headquarters", () => {
  const b = quiet(),
    hq = b.entities.find((e) => e.type === "hq" && e.team === "red");
  assert.equal(b.isVisible(hq), false);
  b.selectAll();
  const units = b.entities.filter((e) => b.selected.has(e.id));
  assert.equal(attackHeadquarters(b), true);
  assert.ok(units.every((e) => e.stance === "attackMove" && e.order.x > 700));
  const x = units.map((e) => e.x);
  advance(b, 2);
  assert.ok(units.every((e, i) => e.x > x[i] + 10));
  advance(b, 24);
  assert.ok(
    hq.hp < hq.maxHp,
    "the attack must cause damage, not merely display a message",
  );
});
test("online attacks work for both seats without leaking relocated headquarters or accepting foreign selections", () => {
  const room = new RoomCore({ stage: 0, map: "dunes" }),
    b = room.battle;
  b.paused = false;
  const blue = b.entities.filter((e) => e.team === "blue" && e.speed),
    red = b.entities.filter((e) => e.team === "red" && e.speed);
  const enemy = b.entities.find((e) => e.type === "hq" && e.team === "red");
  enemy.x = 950;
  enemy.y = 90;
  assert.equal(
    room.act("blue", { kind: "attackHQ", selected: blue.map((e) => e.id) }).ok,
    true,
  );
  assert.ok(blue.every((e) => e.order.x < 900 && e.order.y === 320));
  assert.ok(room.view("blue").entities.every((e) => e.team === "blue"));
  assert.equal(
    room.act("red", { kind: "attackHQ", selected: blue.map((e) => e.id) }).ok,
    false,
  );
  assert.equal(
    room.act("red", { kind: "attackHQ", selected: red.map((e) => e.id) }).ok,
    true,
  );
  const x = red[0].x;
  advance(b, 2);
  assert.ok(red[0].x < x - 10);
});
test("coastal mixed army advances on its own terrain and submarines cover naval targets", () => {
  const b = quiet(2);
  b.fog = false;
  b.selectAll();
  assert.equal(attackHeadquarters(b), true);
  const sub = b.entities.find(
    (e) => e.type === "submarine" && e.team === "blue",
  );
  const destroyer = b.entities.find(
    (e) => e.type === "destroyer" && e.team === "blue",
  );
  assert.ok(sub.order.x > 600 && sub.order.y >= 285);
  assert.ok(destroyer.order.target);
  advance(b, 3);
  assert.ok(
    b.entities
      .filter((e) => e.speed && e.domain === "ground")
      .every((e) => e.y <= 235),
  );
  assert.ok(sub.y >= 285);
});
test("attack destinations survive saves and a manual move replaces an old attack", () => {
  const b = quiet();
  b.selectAll();
  attackHeadquarters(b);
  const saved = snapshotBattle(b),
    copy = restoreBattle(saved);
  const unit = copy.entities.find((e) => e.attackGoal);
  assert.ok(unit.order.x > 700);
  copy.paused = false;
  copy.selected = new Set([unit.id]);
  copy.command(300, 400);
  assert.equal(unit.attackGoal, undefined);
  const bad = structuredClone(saved);
  bad.entities.find((e) => e.attackGoal).attackGoal.x = Infinity;
  assert.throws(() => restoreBattle(bad));
});
test("a drone destroys a supply building with one impact, splashes nearby enemies and spares allies, air and submerged units", () => {
  const b = quiet();
  b.fog = false;
  const drone = b.add("drone", "blue", 400, 320),
    target = b.add("supply", "red", 455, 320);
  const near = b.add("power", "red", 515, 320),
    far = b.add("power", "red", 600, 320);
  const ally = b.add("supply", "blue", 455, 340),
    sub = b.add("submarine", "red", 455, 335),
    plane = b.add("recon", "red", 455, 325);
  b.selected = new Set([drone.id]);
  b.command(target.x, target.y);
  advance(b, 2);
  assert.ok(!b.entities.some((e) => e.id === target.id || e.id === drone.id));
  assert.ok(near.hp < near.maxHp - 250);
  for (const e of [far, ally, sub, plane]) assert.equal(e.hp, e.maxHp);
  assert.equal(b.stats.shots, 1);
});
test("paid building repair is gradual, persists, can be cancelled and stops safely when cash runs out", () => {
  const b = quiet(),
    hq = b.entities.find((e) => e.team === "blue" && e.type === "hq");
  hq.hp -= 100;
  b.cash = 10;
  assert.equal(repairBuilding(b, hq.id), true);
  advance(b, 1.1);
  assert.equal(hq.hp, hq.maxHp - 80);
  assert.equal(b.cash, 5);
  const restored = restoreBattle(snapshotBattle(b));
  restored.multiplayer = true;
  const restoredHQ = restored.entities.find((e) => e.id === hq.id);
  assert.equal(restoredHQ.repairing, true);
  restored.paused = false;
  advance(restored, 2.1);
  assert.equal(restoredHQ.hp, restoredHQ.maxHp - 60);
  assert.equal(restored.cash, 0);
  assert.equal(restoredHQ.repairing, false);
  b.cash = 20;
  assert.equal(repairBuilding(b, hq.id), true); // cancel active repair
  const hp = hq.hp;
  advance(b, 2);
  assert.equal(hq.hp, hp);
  hq.hp = hq.maxHp - 3;
  repairBuilding(b, hq.id);
  advance(b, 1.1);
  assert.equal(hq.hp, hq.maxHp);
  assert.equal(b.cash, 19);
  assert.equal(hq.repairing, false);
});
test("room repair validates building ownership and charges the correct player's wallet", () => {
  const room = new RoomCore({ stage: 0, map: "dunes" }),
    b = room.battle;
  b.paused = false;
  const hq = b.entities.find((e) => e.team === "red" && e.type === "hq");
  hq.hp -= 50;
  assert.equal(
    room.act("blue", { kind: "repairBuilding", building: hq.id }).ok,
    false,
  );
  assert.equal(
    room.act("red", { kind: "repairBuilding", building: hq.id }).ok,
    true,
  );
  const ownCash = b.cash,
    redCash = b.enemy.cash;
  advance(b, 1.1);
  assert.equal(b.cash, ownCash);
  assert.equal(b.enemy.cash, redCash - 5);
  hq.hqMode = "moving";
  advance(b, 0.05);
  assert.equal(hq.repairing, false);
  assert.equal(repairBuilding(b, NaN), false);
});
