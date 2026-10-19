import { test } from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/battle.js";
import {
  relocateHQ,
  suggestedHQDestination,
  saveGroup,
  selectGroup,
  formationPoint,
} from "../src/tactics.js";
import { snapshotBattle, restoreBattle } from "../src/battle-save.js";
import {
  initialCareer,
  awardOperation,
  buyUpgrade,
  parseCareer,
  OPERATIONS,
  nextOperation,
} from "../src/career.js";
import {
  collectBackup,
  validateBackup,
  writeBackupDatasets,
  BACKUP_KEYS,
} from "../src/backup-data.js";
import { initialDocuments, parseDocuments } from "../src/documents.js";
import { serviceUnit, updateLogistics } from "../src/systems.js";
const memory = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
};
const advance = (b, s) => {
  for (let i = 0; i < s * 20; i++) b.update(0.05);
};
test("headquarters packs, moves physically, saves mid-route and redeploys before production returns", () => {
  const b = new Battle(),
    hq = b.entities.find((e) => e.type === "hq" && e.team === "blue"),
    initial = hq.x;
  assert.equal(suggestedHQDestination(b), true);
  assert.equal(hq.hqMode, "packing");
  assert.equal(b.purchase("power", 320, 150), false);
  advance(b, 5);
  assert.equal(hq.hqMode, "moving");
  assert.notEqual(hq.x, initial);
  const copy = restoreBattle(snapshotBattle(b));
  copy.paused = false;
  advance(copy, 25);
  const moved = copy.entities.find((e) => e.type === "hq" && e.team === "blue");
  assert.equal(moved.hqMode, "deployed");
  assert.ok(moved.x > initial + 80);
  assert.equal(copy.has("hq"), true);
});
test("headquarters cannot relocate into water or obstacles, or while paused", () => {
  const b = new Battle(2);
  assert.equal(relocateHQ(b, 400, 400), false);
  b.paused = true;
  assert.equal(suggestedHQDestination(b), false);
  const a = new Battle();
  const rock = a.map.obstacles[0];
  assert.equal(relocateHQ(a, rock.x, rock.y), false);
});
test("formations, groups, patrol and moving-target guard survive saves", () => {
  const b = new Battle();
  b.selectAll();
  saveGroup(b, "1");
  b.selected.clear();
  selectGroup(b, "1");
  assert.equal(b.selected.size, 3);
  b.formation = "wedge";
  assert.notDeepEqual(
    formationPoint(b, 1, 3, 500, 300),
    formationPoint(b, 2, 3, 500, 300),
  );
  b.commandMode = "patrol";
  b.command(430, 520);
  assert.ok(b.entities.find((e) => b.selected.has(e.id)).tactical);
  const copy = restoreBattle(snapshotBattle(b));
  assert.deepEqual(copy.groups, b.groups);
  assert.equal(copy.commandMode, "patrol");
  copy.paused = false;
  copy.commandMode = "guard";
  copy.command(130, 320);
  assert.ok(
    copy.entities
      .filter((e) => copy.selected.has(e.id))
      .every((e) => e.tactical.kind === "guard"),
  );
});
test("aircraft land for service and take off; surfacing submarines changes targeting domain", () => {
  const air = new Battle(1);
  const f = air.entities.find((e) => e.type === "fighter");
  f.x = 130;
  f.y = 160;
  f.ammo = 0;
  f.hp -= 25;
  advance(air, 4);
  assert.ok(f.flight < 1);
  assert.ok(f.ammo > 0);
  advance(air, 20);
  assert.equal(f.servicing, false);
  assert.ok(f.flight > 0.9);
  const sea = new Battle(2),
    sub = sea.entities.find((e) => e.type === "submarine");
  sub.depthTarget = 0;
  advance(sea, 2);
  assert.equal(sub.domain, "sea");
  const copy = restoreBattle(snapshotBattle(sea));
  assert.equal(copy.entities.find((e) => e.id === sub.id).domain, "sea");
});
test("service orders follow a relocated headquarters and ignore it while packed", () => {
  const b = new Battle();
  const hq = b.entities.find((e) => e.type === "hq" && e.team === "blue");
  const unit = b.entities.find((e) => e.team === "blue" && e.damage && e.speed);
  unit.ammo = 0;
  serviceUnit(b, unit);
  const oldOrder = { ...unit.order };
  hq.hqMode = "moving";
  hq.x = 500;
  updateLogistics(b, 1);
  assert.deepEqual(unit.order, oldOrder);
  hq.hqMode = "deployed";
  updateLogistics(b, 1);
  assert.deepEqual(unit.order, b.constrain(unit, hq.x, hq.y));
  assert.notDeepEqual(unit.order, oldOrder);
  assert.equal(unit.ammo, 0);
});
test("campaign unlocks in story order, rewards once and applies bounded combat upgrades", () => {
  const c = initialCareer(),
    b = new Battle(0, undefined, {
      mission: "escort",
      operationId: OPERATIONS[0].id,
    });
  b.status = "won";
  assert.equal(awardOperation(c, b), true);
  assert.equal(awardOperation(c, b), false);
  assert.equal(nextOperation(c).id, OPERATIONS[1].id);
  assert.equal(buyUpgrade(c, "armor"), true);
  assert.equal(c.points, 0);
  assert.equal(buyUpgrade(c, "weapons"), false);
  parseCareer(c);
  const upgraded = new Battle(0, undefined, { upgrades: c.upgrades });
  assert.ok(upgraded.entities.find((e) => e.type === "tank").maxHp > 430);
  assert.equal(
    restoreBattle(snapshotBattle(upgraded)).entities.find(
      (e) => e.type === "tank",
    ).hp,
    473,
  );
});
test("full backup includes documents and campaign, excludes credentials, validates all before writing", () => {
  const s = memory();
  s.setItem("myos-documents-v1", JSON.stringify(initialDocuments()));
  s.setItem("myos-career-v1", JSON.stringify(initialCareer()));
  s.setItem("myos-theme", "light");
  s.setItem("myos-cloud-config-v1", "private configuration stays on device");
  const data = collectBackup(s);
  assert.equal(Object.keys(data.datasets).length, BACKUP_KEYS.length);
  assert.ok(!Object.hasOwn(data.datasets, "myos-cloud-config-v1"));
  const target = memory();
  writeBackupDatasets(target, validateBackup(JSON.stringify(data)).datasets);
  parseDocuments(target.getItem("myos-documents-v1"));
  assert.equal(target.getItem("myos-theme"), "light");
  const bad = structuredClone(data);
  bad.datasets["myos-career-v1"] = "{}";
  assert.throws(() => validateBackup(bad));
  bad.datasets["unrecognized"] = "value";
  assert.throws(() => validateBackup(bad));
});

test("new recruits obey a saved rally point independent of headquarters", () => {
  const b = new Battle();
  b.rally = { x: 400, y: 550 };
  assert.equal(b.purchase("power", 320, 150), true);
  assert.equal(b.purchase("barracks", 320, 450), true);
  assert.equal(b.purchase("soldier"), true);
  const soldier = b.entities.at(-1);
  assert.deepEqual(soldier.order, b.rally);
  assert.deepEqual(restoreBattle(snapshotBattle(b)).rally, b.rally);
});
test("enemy remembers the last scouted headquarters position and discovers relocation through vision", () => {
  const b = new Battle(),
    hq = b.entities.find((e) => e.type === "hq" && e.team === "blue");
  hq.x = 300;
  hq.y = 550;
  b.enemy.nextOrders = 0;
  b.update(0.05);
  assert.deepEqual(b.enemy.lastHQ, { x: 130, y: 320 });
  b.add("soldier", "red", hq.x + 80, hq.y);
  b.enemy.nextOrders = 0;
  b.update(0.05);
  assert.deepEqual(b.enemy.lastHQ, { x: hq.x, y: hq.y });
  assert.deepEqual(
    restoreBattle(snapshotBattle(b)).enemy.lastHQ,
    b.enemy.lastHQ,
  );
});
