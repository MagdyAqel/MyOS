import { test } from "node:test";
import assert from "node:assert/strict";
import qrcode from "qrcode-generator";
import jsQR from "jsqr";
import { Battle } from "../src/battle.js";
import { RoomCore } from "../multiplayer/room-core.js";
import { snapshotBattle, restoreBattle } from "../src/battle-save.js";
import {
  advancedOrder,
  selectInRectangle,
  updateSupport,
} from "../src/battle-expansion.js";
import {
  initialCareer,
  awardOperation,
  operationStars,
  unlockedEquipment,
} from "../src/career.js";
import {
  validateMediaRecords,
  MEDIA_LIMIT,
  MEDIA_FILE_LIMIT,
} from "../src/media-store.js";
import { collectBackup, validateBackup } from "../src/backup-data.js";
test("starting money is bounded, survives saves, and is identical for both online seats", () => {
  const b = new Battle(0, "dunes", { startingCash: 15000 });
  assert.equal(b.cash, 15000);
  assert.equal(restoreBattle(snapshotBattle(b)).startingCash, 15000);
  assert.equal(new Battle(0, "dunes", { startingCash: Infinity }).cash, 2400);
  const room = new RoomCore({ stage: 0, map: "dunes", startingCash: 20000 });
  assert.equal(room.view("blue").cash, 20000);
  assert.equal(room.view("red").cash, 20000);
  for (const startingCash of [0, 999, 100001, "5000", NaN])
    assert.throws(() => new RoomCore({ stage: 0, map: "dunes", startingCash }));
});
test("rectangle selection excludes passengers, structures and opponents; Shift preserves previous troops", () => {
  const b = new Battle();
  const soldier = b.entities.find((e) => e.type === "soldier");
  const tank = b.entities.find((e) => e.type === "tank");
  const passenger = b.add("soldier", "blue", soldier.x, soldier.y);
  passenger.carriedBy = 99;
  selectInRectangle(b, (x, y) => ({ x, y }), {
    left: soldier.x - 1,
    right: soldier.x + 1,
    top: soldier.y - 1,
    bottom: soldier.y + 1,
  });
  assert.deepEqual([...b.selected], [soldier.id]);
  selectInRectangle(
    b,
    (x, y) => ({ x, y }),
    {
      left: tank.x - 1,
      right: tank.x + 1,
      top: tank.y - 1,
      bottom: tank.y + 1,
    },
    true,
  );
  assert(b.selected.has(tank.id));
  assert.equal(b.selected.size, 2);
});
test("hold position, target priority and retreat are owned server commands and survive storage", () => {
  const room = new RoomCore({ stage: 0, map: "dunes" }),
    b = room.battle;
  b.paused = false;
  const own = b.entities.find((e) => e.team === "red" && e.type === "tank"),
    foreign = b.entities.find((e) => e.team === "blue" && e.type === "tank");
  room.act("red", { kind: "hold", selected: [own.id, foreign.id] });
  assert.equal(own.stance, "hold");
  assert.equal(foreign.stance, undefined);
  room.act("red", { kind: "priority", selected: [own.id], value: "air" });
  const restored = restoreBattle(snapshotBattle(b));
  assert.equal(restored.entities.find((e) => e.id === own.id).priority, "air");
  const x = own.x,
    y = own.y;
  room.tick(0.1);
  assert.equal(own.x, x);
  assert.equal(own.y, y);
  room.act("red", { kind: "retreat", selected: [own.id] });
  assert.equal(own.servicing, true);
});
test("engineers and repair vehicles spend finite stores and cash; ammunition support does not supply enemies", () => {
  const b = new Battle();
  b.entities = b.entities.filter((e) => e.team === "blue");
  const hq = b.entities.find((e) => e.type === "hq");
  hq.hp -= 100;
  const engineer = b.add("engineer", "blue", hq.x + 25, hq.y);
  const tank = b.entities.find((e) => e.type === "tank");
  tank.hp -= 80;
  tank.ammo = 2;
  const repair = b.add("repair", "blue", tank.x + 20, tank.y),
    truck = b.add("ammoTruck", "blue", tank.x, tank.y + 20);
  const cash = b.cash;
  updateSupport(b, 1);
  assert.equal(hq.hp, hq.maxHp - 80);
  assert.equal(tank.hp, tank.maxHp - 60);
  assert.equal(tank.ammo, 8);
  assert.equal(truck.ammo, 114);
  assert.equal(repair.ammo, 140);
  assert.equal(engineer.ammo, 60);
  assert.equal(b.cash, cash - 10);
  const foe = b.add("tank", "red", truck.x, truck.y);
  foe.ammo = 1;
  updateSupport(b, 1);
  assert.equal(foe.ammo, 1);
  const saved = restoreBattle(snapshotBattle(b));
  assert.equal(saved.entities.find((e) => e.id === truck.id).ammo, 108);
});
test("attack move seeks a visible opponent outside weapon range while retaining its destination", () => {
  const b = new Battle(0, "dunes", { fog: false });
  b.multiplayer = true;
  b.enemy.cash = 0;
  const tank = b.entities.find((e) => e.type === "tank" && e.team === "blue");
  b.entities = b.entities.filter((e) => e.type === "hq" || e.id === tank.id);
  tank.x = 300;
  tank.y = 200;
  const enemy = b.add("soldier", "red", 490, 200);
  enemy.speed = 0;
  enemy.damage = 0;
  b.selected = new Set([tank.id]);
  b.commandMode = "attackMove";
  b.command(300, 500);
  const original = { ...tank.order };
  for (let i = 0; i < 20; i++) b.update(0.1);
  assert(tank.x > 305, "tank closes on the visible target");
  assert.deepEqual(tank.order, original);
  advancedOrder(b, { kind: "hold" });
  assert.equal(tank.order, null);
});
test("mission secondary objectives produce stars that unlock equipment used only in campaign loadouts", () => {
  const c = initialCareer(),
    b = new Battle(0, "dunes", {
      operationId: "first-light",
      mission: "escort",
    });
  b.status = "won";
  b.time = 100;
  assert.equal(operationStars(b), 3);
  assert(awardOperation(c, b));
  assert.equal(c.reports[0].stars, 3);
  assert(unlockedEquipment(c).reinforced);
  const enhanced = new Battle(0, "dunes", {
    equipment: { reinforced: true, precision: true, veteran: true },
  });
  const tank = enhanced.entities.find((e) => e.type === "tank");
  assert.equal(tank.maxAmmo, 22);
  assert.equal(tank.range, 157);
  const restored = restoreBattle(snapshotBattle(enhanced));
  assert.equal(restored.entities.find((e) => e.type === "tank").maxAmmo, 22);
  assert.equal(restored.entities.find((e) => e.type === "tank").range, 157);
});
test("media backups validate sizes, content types, duplicate identities and decoded byte count before restore", () => {
  const r = {
    id: "image",
    name: "صورة.png",
    type: "image/png",
    size: 3,
    deleted: false,
    base64: "AAAA",
  };
  assert.equal(validateMediaRecords([r]).length, 1);
  assert.throws(() => validateMediaRecords([{ ...r, type: "text/html" }]));
  assert.throws(() => validateMediaRecords([r, r]));
  assert.throws(() =>
    validateMediaRecords([{ ...r, size: MEDIA_FILE_LIMIT + 1 }]),
  );
  assert.throws(() =>
    validateMediaRecords(
      Array.from({ length: 3 }, (_, i) => ({
        ...r,
        id: String(i),
        size: MEDIA_LIMIT / 2,
      })),
    ),
  );
  const backup = collectBackup({ getItem: () => null });
  backup.media = [r];
  assert.equal(validateBackup(backup).media.length, 1);
  assert.throws(() =>
    validateBackup({ ...backup, media: [{ ...r, size: 4 }] }),
  );
});
test("invitation QR decodes to the complete public room link without a seat token", () => {
  const invitation =
    "https://magdyaqel.github.io/MyOS/#myos-room=" +
    "a".repeat(32) +
    "&server=https%3A%2F%2Fmyos-arena.iugteacher.workers.dev";
  const qr = qrcode(0, "M");
  qr.addData(invitation);
  qr.make();
  const count = qr.getModuleCount(),
    scale = 5,
    width = (count + 8) * scale,
    data = new Uint8ClampedArray(width * width * 4);
  data.fill(255);
  for (let row = 0; row < count; row++)
    for (let col = 0; col < count; col++)
      if (qr.isDark(row, col))
        for (let y = 0; y < scale; y++)
          for (let x = 0; x < scale; x++) {
            const i =
              (((row + 4) * scale + y) * width + (col + 4) * scale + x) * 4;
            data[i] = data[i + 1] = data[i + 2] = 0;
          }
  assert.equal(jsQR(data, width, width).data, invitation);
  assert(!invitation.includes("token"));
});

test("ten campaign operations progress from armor to air to simultaneous ground, air, sea and submerged forces", async () => {
  const { OPERATIONS } = await import("../src/career.js");
  for (let i = 0; i < 10; i++) {
    const op = OPERATIONS[i],
      b = new Battle(op.stage, op.map, {
        mission: op.mission,
        operationId: op.id,
      });
    assert(b.allowed("tank"));
    assert.equal(b.allowed("fighter"), i >= 3);
    assert.equal(b.allowed("destroyer"), i >= 5);
    assert.equal(b.allowed("submarine"), i >= 5);
    if (i < 3) assert(!b.stage.buildings.includes("airfield"));
    if (i >= 5) {
      const domains = new Set(
        b.entities
          .filter((e) => e.team === "blue" && e.speed)
          .map((e) => e.domain),
      );
      assert.deepEqual([...domains].sort(), ["air", "ground", "sea", "sub"]);
      assert.equal(b.map.stage, 2);
    }
    const restored = restoreBattle(snapshotBattle(b));
    assert.equal(restored.forcePhase, b.forcePhase);
    assert.equal(restored.allowed("fighter"), i >= 3);
  }
});
test("coastal tank movement stays ashore, submarines stay at sea, and old campaign saves remain restorable", async () => {
  const { walkable } = await import("../src/navigation.js"),
    { OPERATIONS } = await import("../src/career.js");
  const b = new Battle(2),
    tank = b.entities.find((e) => e.type === "tank");
  b.multiplayer = true;
  b.selected = new Set([tank.id]);
  b.command(400, 550);
  for (let i = 0; i < 150; i++) b.update(0.05);
  assert(tank.y <= 235);
  assert(!walkable(b.map, tank, 400, 450));
  assert(walkable(b.map, { domain: "air" }, 400, 450));
  for (const op of OPERATIONS.filter((o) => o.legacy)) {
    const old = new Battle(op.legacy.stage, undefined, {
      mission: op.legacy.mission,
      operationId: op.id,
    });
    assert.equal(restoreBattle(snapshotBattle(old)).operationId, op.id);
  }
});
