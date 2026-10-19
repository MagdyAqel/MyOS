import { test } from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/battle.js";
import { specialAction, visionRadius } from "../src/unit-abilities.js";
import { snapshotBattle, restoreBattle } from "../src/battle-save.js";
import {
  initialCareer,
  OPERATIONS,
  parseCareer,
  nextOperation,
  awardOperation,
} from "../src/career.js";
import { RoomCore } from "../multiplayer/room-core.js";
const advance = (b, seconds) => {
  for (let i = 0; i < seconds * 20; i++) b.update(0.05);
};
const quiet = (stage = 0, options = {}) => {
  const b = new Battle(stage, undefined, options);
  b.multiplayer = true;
  return b;
};
test("APC design changes paid price, capacity, armor and speed and restores with upgrades", () => {
  const b = quiet(0, { upgrades: { armor: 2 } });
  b.add("power", "blue", 60, 70);
  b.add("factory", "blue", 120, 480);
  b.cash = 700;
  assert.equal(b.purchase("apc", undefined, undefined, "armored"), false);
  assert.equal(b.cash, 700);
  b.cash = 900;
  assert.equal(b.purchase("apc", undefined, undefined, "armored"), true);
  const a = b.entities.at(-1);
  assert.equal(b.cash, 150);
  assert.equal(a.capacity, 4);
  assert.equal(a.maxHp, 936);
  assert.equal(a.speed, 34);
  const c = restoreBattle(snapshotBattle(b)).entities.find(
    (e) => e.id === a.id,
  );
  assert.equal(c.hp, 936);
  assert.equal(c.design, "armored");
  assert.equal(c.capacity, 4);
});
test("boarding reserves seats, passengers travel safely inside and unload into walkable free space", () => {
  const b = quiet(),
    a = b.add("apc", "blue", 260, 320, "rapid");
  const troops = Array.from({ length: 7 }, (_, i) =>
    b.add("soldier", "blue", 260 + i, 350),
  );
  b.selected = new Set(troops.map((e) => e.id));
  assert.equal(specialAction(b, { kind: "board", carrier: a.id }), true);
  advance(b, 0.1);
  assert.equal(troops.filter((e) => e.carriedBy === a.id).length, 4);
  const passenger = troops.find((e) => e.carriedBy);
  const hp = passenger.hp,
    ammo = passenger.ammo;
  b.selected = new Set([a.id]);
  b.command(410, 320);
  advance(b, 3);
  assert.equal(passenger.x, a.x);
  assert.equal(passenger.y, a.y);
  assert.equal(passenger.hp, hp);
  assert.equal(passenger.ammo, ammo);
  b.selectAll();
  assert.equal(b.selected.has(passenger.id), false);
  b.selected = new Set([a.id]);
  assert.equal(specialAction(b, { kind: "unload" }), true);
  assert.equal(troops.filter((e) => e.carriedBy).length, 0);
  assert.ok(troops.every((e) => e.x >= 15 && e.y >= 15));
});
test("transport state validates ownership, references and capacity; destroyed APC loses its passengers once", () => {
  const b = quiet(),
    a = b.add("apc", "blue", 240, 320),
    soldier = b.entities.find((e) => e.type === "soldier");
  b.selected = new Set([soldier.id]);
  specialAction(b, { kind: "board", carrier: a.id });
  advance(b, 2);
  assert.equal(soldier.carriedBy, a.id);
  const saved = snapshotBattle(b),
    copy = restoreBattle(saved);
  assert.equal(copy.entities.find((e) => e.id === soldier.id).carriedBy, a.id);
  const bad = structuredClone(saved);
  bad.entities.find((e) => e.id === soldier.id).carriedBy = 999;
  assert.throws(() => restoreBattle(bad));
  const foreign = structuredClone(saved);
  foreign.entities.find((e) => e.id === a.id).team = "red";
  assert.throws(() => restoreBattle(foreign));
  a.hp = 0;
  advance(b, 0.05);
  assert.ok(!b.entities.some((e) => e.id === soldier.id));
  const losses = b.stats.losses;
  advance(b, 0.05);
  assert.equal(b.stats.losses, losses);
});
test("recon reaches and orbits a chosen small area, has no weapon, and preserves orders", () => {
  const b = quiet(),
    plane = b.add("recon", "blue", 400, 320);
  const near = b.add("soldier", "red", 790, 470),
    far = b.add("soldier", "red", 990, 590);
  b.selected = new Set([plane.id]);
  assert.equal(specialAction(b, { kind: "recon", x: 820, y: 470 }), true);
  advance(b, 6);
  assert.ok(Math.hypot(plane.x - 820, plane.y - 470) < 80);
  assert.equal(visionRadius(plane), 110);
  assert.equal(plane.damage, undefined);
  near.x = plane.x + 50;
  near.y = plane.y;
  assert.equal(b.isVisible(near), true);
  assert.equal(b.isVisible(far), false);
  const c = restoreBattle(snapshotBattle(b));
  assert.deepEqual(c.entities.find((e) => e.id === plane.id).recon, {
    x: 820,
    y: 470,
  });
});
test("drone approaches an explicit target, damages at impact, consumes itself and cannot hit submerged targets", () => {
  const b = quiet(),
    drone = b.add("drone", "blue", 400, 320),
    target = b.add("supply", "red", 520, 320);
  b.selected = new Set([drone.id]);
  b.command(target.x, target.y);
  advance(b, 0.1);
  assert.equal(target.hp, target.maxHp);
  advance(b, 2);
  assert.ok(target.hp < target.maxHp);
  assert.ok(!b.entities.some((e) => e.id === drone.id));
  assert.equal(b.stats.shots, 1);
  const d = b.add("drone", "blue", 600, 450),
    sub = b.add("submarine", "red", 620, 450);
  b.selected = new Set([d.id]);
  b.command(sub.x, sub.y);
  assert.match(b.message, /لا تستطيع/);
});
test("artillery needs scouting, fires beyond tank range, delays impact and honors minimum range", () => {
  const b = quiet(),
    gun = b.add("artillery", "blue", 410, 320),
    target = b.add("supply", "red", 790, 320);
  advance(b, 0.1);
  assert.equal(b.shells.length, 0);
  const scout = b.add("recon", "blue", 750, 320);
  b.selected = new Set([gun.id]);
  b.command(target.x, target.y);
  advance(b, 0.1);
  assert.equal(b.shells.length, 1);
  assert.equal(target.hp, target.maxHp);
  const copy = restoreBattle(snapshotBattle(b));
  assert.equal(copy.shells.length, 1);
  copy.multiplayer = true;
  copy.paused = false;
  advance(copy, 1.6);
  assert.ok(copy.entities.find((e) => e.id === target.id).hp < target.hp);
  assert.equal(gun.ammo, gun.maxAmmo - 1);
  gun.cd = 0;
  target.x = gun.x + 60;
  scout.x = target.x;
  advance(b, 0.1);
  assert.equal(b.shells.length, 1);
});
test("ten-operation campaign preserves old eight-operation completion and ends after new recon and siege operations", () => {
  assert.equal(OPERATIONS.length, 10);
  const c = initialCareer();
  c.completed = OPERATIONS.slice(0, 8).map((o) => o.id);
  const old = parseCareer(c);
  assert.equal(nextOperation(old).id, "small-eye");
  for (const op of OPERATIONS.slice(8)) {
    const b = quiet(op.stage, { mission: op.mission, operationId: op.id });
    if (op.mission === "recon") {
      const p = b.entities.find((e) => e.type === "recon");
      p.x = 820;
      p.y = 470;
      p.hp = 10000;
      advance(b, 10.2);
    } else {
      b.entities.find((e) => e.type === "hq" && e.team === "red").hp = 0;
      advance(b, 0.1);
    }
    assert.equal(b.status, "won");
    assert.equal(awardOperation(c, b), true);
  }
  assert.equal(nextOperation(parseCareer(c)), null);
  assert.equal(c.completed.length, 10);
});
test("network seats cannot board foreign troops; private snapshots hide passengers and preserve own recon", () => {
  const r = new RoomCore({ stage: 0, map: "dunes" }),
    b = r.battle;
  b.paused = false;
  const apc = b.add("apc", "red", 700, 320),
    own = b.add("soldier", "red", 700, 350),
    foreign = b.entities.find((e) => e.type === "soldier" && e.team === "blue");
  assert.equal(
    r.act("red", { kind: "board", carrier: apc.id, selected: [foreign.id] }).ok,
    false,
  );
  assert.equal(
    r.act("red", { kind: "board", carrier: apc.id, selected: [own.id] }).ok,
    true,
  );
  r.tick(0.1);
  assert.equal(own.carriedBy, apc.id);
  assert.ok(!r.view("blue").entities.some((e) => e.id === own.id));
  const view = restoreBattle(r.view("red"));
  assert.equal(view.entities.find((e) => e.id === own.id).carriedBy, apc.id);
  const scout = b.add("recon", "red", 700, 300);
  assert.equal(
    r.act("red", { kind: "recon", x: 300, y: 320, selected: [scout.id] }).ok,
    true,
  );
  assert.throws(() =>
    r.act("red", { kind: "recon", x: NaN, y: 320, selected: [scout.id] }),
  );
});
