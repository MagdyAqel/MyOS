import { test } from "node:test";
import assert from "node:assert/strict";
import { RoomCore } from "../multiplayer/room-core.js";
import { restoreBattle } from "../src/battle-save.js";
import { validateEndpoint } from "../src/arena-client.js";
const run = (room, seconds) => {
  for (let i = 0; i < seconds * 20; i++) room.tick(0.05);
};
test("two-player economy starts fairly and has no AI orders or scripted reinforcement waves", () => {
  const room = new RoomCore({ stage: 0, map: "dunes" }),
    b = room.battle;
  assert.equal(b.cash, b.enemy.cash);
  assert.equal(
    b.entities.filter((e) => e.team === "blue").length,
    b.entities.filter((e) => e.team === "red").length,
  );
  assert.equal(
    room.act("blue", { kind: "autoBuild", unit: "power" }).ok,
    false,
  );
  b.paused = false;
  const positions = b.entities
    .filter((e) => e.team === "red")
    .map((e) => [e.x, e.y]);
  run(room, 50);
  assert.equal(b.wave, 0);
  assert.equal(b.cash, b.enemy.cash);
  assert.deepEqual(
    b.entities.filter((e) => e.team === "red").map((e) => [e.x, e.y]),
    positions,
  );
  for (const team of ["blue", "red"])
    assert.equal(room.act(team, { kind: "autoBuild", unit: "power" }).ok, true);
  assert.equal(b.cash, b.enemy.cash);
  assert.equal(
    room.act("red", { kind: "purchase", unit: "supply", x: 320, y: 450 }).ok,
    false,
  );
});
test("orders can control only the authenticated side and cannot alter arbitrary state", () => {
  const room = new RoomCore({ stage: 0, map: "dunes" }),
    b = room.battle;
  b.paused = false;
  const foreign = b.entities
    .filter((e) => e.team === "blue" && e.speed)
    .map((e) => e.id);
  assert.equal(
    room.act("red", { kind: "command", selected: foreign, x: 500, y: 500 }).ok,
    false,
  );
  assert.ok(
    b.entities.filter((e) => foreign.includes(e.id)).every((e) => !e.order),
  );
  assert.throws(() => room.act("red", { kind: "setCash", cash: 1e9 }));
  assert.throws(() =>
    room.act("red", { kind: "command", selected: [], x: NaN, y: 100 }),
  );
  assert.equal(
    room.act("red", { kind: "autoBuild", unit: "power", team: "blue" }).ok,
    true,
  );
  assert.equal(b.cash, 2400);
  assert.equal(b.enemy.cash, 2100);
});
test("fog snapshots conceal unscouted opponents and give each side its own blue army and wallet", () => {
  const room = new RoomCore({ stage: 0, map: "dunes" });
  for (const team of ["blue", "red"]) {
    const view = room.view(team);
    assert.ok(view.entities.every((e) => e.team === "blue"));
    assert.equal(view.cash, 2400);
    assert.equal(restoreBattle(view).has("hq"), true);
  }
  const b = room.battle;
  b.paused = false;
  b.add("fighter", "blue", 870, 320);
  assert.ok(room.view("blue").entities.some((e) => e.team === "red"));
  assert.ok(room.view("red").entities.some((e) => e.team === "red"));
});
test("both players can move their command center and retained room state restores their army orders", () => {
  const room = new RoomCore({ stage: 0, map: "dunes" }),
    b = room.battle;
  b.paused = false;
  for (const team of ["blue", "red"])
    assert.equal(room.act(team, { kind: "suggestHQ" }).ok, true);
  run(room, 30);
  for (const hq of b.entities.filter((e) => e.type === "hq"))
    assert.equal(hq.hqMode, "deployed");
  const red = b.entities
    .filter((e) => e.team === "red" && e.speed)
    .map((e) => e.id);
  assert.equal(
    room.act("red", {
      kind: "command",
      selected: red,
      x: 650,
      y: 550,
      commandMode: "patrol",
      formation: "wedge",
    }).ok,
    true,
  );
  const restored = RoomCore.restore(room.serialize());
  assert.equal(restored.settings.red.formation, "wedge");
  assert.ok(
    restored.battle.entities
      .filter((e) => red.includes(e.id))
      .every((e) => e.tactical?.kind === "patrol"),
  );
});
test("headquarters destruction resolves opposite winners without sharing solo campaign rewards", () => {
  const room = new RoomCore({ stage: 0, map: "dunes" });
  room.battle.paused = false;
  room.battle.entities.find((e) => e.type === "hq" && e.team === "red").hp = 0;
  room.tick(0.05);
  assert.equal(room.view("blue").status, "won");
  assert.equal(room.view("red").status, "lost");
  assert.equal(room.view("blue").operationId, null);
});
test("multiplayer endpoints require HTTPS outside loopback and reject embedded credentials", () => {
  assert.equal(
    validateEndpoint("http://127.0.0.1:8787"),
    "http://127.0.0.1:8787",
  );
  assert.equal(
    validateEndpoint("https://myos.example.workers.dev"),
    "https://myos.example.workers.dev",
  );
  assert.throws(() => validateEndpoint("http://example.com"));
  assert.throws(() => validateEndpoint("https://user:pass@example.com"));
});
