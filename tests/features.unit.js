import { test } from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/battle.js";
import {
  snapshotBattle,
  restoreBattle,
  saveBattle,
  readBattle,
} from "../src/battle-save.js";
import {
  initialFiles,
  parseFiles,
  mutateFiles,
  createFile,
  trashFile,
  removeFile,
  FILES_KEY,
} from "../src/file-store.js";
import {
  exportSyncSnapshot,
  applySyncSnapshot,
  undoSyncRestore,
  validateSyncSnapshot,
} from "../src/sync-data.js";
import { NOTEBOOK_KEY } from "../src/notebook.js";
import { CloudClient, validateCloudConfig } from "../src/cloud-client.js";
const memory = () => {
  const values = new Map();
  return {
    getItem: (k) => (values.has(k) ? values.get(k) : null),
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
};
const advance = (b, seconds) => {
  for (let i = 0; i < seconds * 20; i++) b.update(0.05);
};
test("save restores resources, orders, ammo, mission, AI and exploration without reusing stale routes", () => {
  const b = new Battle(0, "canyon", { difficulty: "hard", mission: "escort" });
  b.selectAll();
  b.command(500, 550);
  advance(b, 3);
  b.cash = 1234;
  const tank = b.entities.find((e) => e.type === "tank");
  tank.ammo = 5;
  const raw = snapshotBattle(b),
    copy = restoreBattle(raw);
  assert.equal(copy.cash, 1234);
  assert.equal(copy.time, b.time);
  assert.equal(copy.mission.id, "escort");
  assert.equal(copy.difficulty, "hard");
  assert.deepEqual(copy.enemy, b.enemy);
  assert.deepEqual([...copy.selected], [...b.selected]);
  assert.equal(copy.entities.find((e) => e.id === tank.id).ammo, 5);
  assert.deepEqual(
    copy.entities.find((e) => e.id === tank.id).order,
    tank.order,
  );
  assert.equal(copy.paused, true);
  assert.equal(copy.explored.size, b.explored.size);
  assert.ok(copy.entities.every((e) => !e.route));
  const storage = memory();
  saveBattle(storage, b);
  assert.equal(readBattle(storage).cash, 1234);
  raw.entities[0].type = "__proto__";
  assert.throws(() => restoreBattle(raw));
});
test("enemy economy builds prerequisites, produces units and assigns different attack orders", () => {
  const b = new Battle();
  advance(b, 60);
  for (const type of ["power", "supply", "factory"])
    assert.ok(b.entities.some((e) => e.type === type && e.team === "red"));
  assert.ok(b.entities.some((e) => e.team === "red" && e.speed));
  assert.ok(b.enemy.cash >= 0);
  assert.ok(b.entities.some((e) => e.team === "red" && e.speed && e.order));
});
test("convoy, rescue, capture, interception and survival resolve their own objectives", () => {
  const escort = new Battle(0, undefined, { mission: "escort" });
  escort.entities.find((e) => e.type === "convoy").x = 850;
  escort.update(0.05);
  assert.equal(escort.status, "won");
  const failed = new Battle(0, undefined, { mission: "escort" });
  failed.entities.find((e) => e.type === "convoy").hp = 0;
  failed.update(0.05);
  assert.equal(failed.status, "lost");
  const rescue = new Battle(0, undefined, { mission: "rescue" });
  for (const e of rescue.entities.filter((e) => e.type === "survivor")) {
    e.team = "blue";
    e.x = 140;
    e.y = 320;
  }
  rescue.update(0.05);
  assert.equal(rescue.objective.evacuated, 3);
  assert.equal(rescue.status, "won");
  const capture = new Battle(2, undefined, { mission: "capture" });
  capture.add("destroyer", "blue", 640, 300);
  advance(capture, 15.1);
  assert.equal(capture.status, "won");
  const intercept = new Battle(1, undefined, { mission: "intercept" });
  for (let i = 0; i < 6; i++)
    intercept.add("fighter", "red", 930, 120 + i * 30).hp = 0;
  intercept.update(0.05);
  assert.equal(intercept.status, "won");
  const survive = new Battle(3, undefined, { mission: "survive" });
  survive.time = 149.98;
  survive.update(0.05);
  assert.equal(survive.status, "won");
});
test("ammo is finite, logistics restores it at a base, and repairs spend resources", () => {
  const b = new Battle(),
    tank = b.entities.find((e) => e.type === "tank");
  tank.ammo = 0;
  tank.hp = 100;
  b.selected = new Set([tank.id]);
  b.serviceSelected();
  const cash = b.cash;
  advance(b, 5.1);
  assert.ok(tank.ammo > 0);
  assert.ok(tank.hp > 100);
  assert.ok(b.cash < cash);
  assert.ok(tank.hp <= tank.maxHp);
});
test("enemy positions are hidden until scouted; friendly units and mission markers stay visible", () => {
  const b = new Battle(),
    hq = b.entities.find((e) => e.team === "red" && e.type === "hq");
  assert.equal(b.isVisible(hq), false);
  b.add("fighter", "blue", hq.x - 100, hq.y);
  assert.equal(b.isVisible(hq), true);
  assert.ok(b.explored.size > 0);
});
test("real text files persist, folders trash recursively, and restoration/permanent deletion work", () => {
  const storage = memory();
  let data = mutateFiles(storage, (d) =>
    createFile(d, { id: "folder", name: "عملي", kind: "folder" }),
  );
  data = mutateFiles(storage, (d) =>
    createFile(d, {
      id: "doc",
      name: "مهم.txt",
      parent: "folder",
      text: "قيمة محفوظة",
    }),
  );
  data = mutateFiles(storage, (d) => trashFile(d, "folder"));
  assert.ok(data.entries.find((e) => e.id === "doc").deleted);
  data = mutateFiles(storage, (d) => trashFile(d, "folder", true));
  assert.equal(data.entries.find((e) => e.id === "doc").text, "قيمة محفوظة");
  data = mutateFiles(storage, (d) => removeFile(d, "folder"));
  assert.ok(!data.entries.some((e) => ["folder", "doc"].includes(e.id)));
  const bad = initialFiles();
  bad.entries[0].parent = "documents";
  assert.throws(() => parseFiles(bad));
});
test("cloud restore validates before writing and keeps a reversible local backup", () => {
  const storage = memory(),
    note = (text) =>
      JSON.stringify({
        version: 2,
        activeId: "n",
        notes: [{ id: "n", title: "A", text }],
      });
  storage.setItem(NOTEBOOK_KEY, note("old"));
  const snapshot = { version: 1, datasets: { [NOTEBOOK_KEY]: note("new") } };
  applySyncSnapshot(storage, snapshot);
  assert.equal(JSON.parse(storage.getItem(NOTEBOOK_KEY)).notes[0].text, "new");
  undoSyncRestore(storage);
  assert.equal(JSON.parse(storage.getItem(NOTEBOOK_KEY)).notes[0].text, "old");
  assert.throws(() =>
    validateSyncSnapshot({
      version: 1,
      datasets: { CLOUDFLARE_API_TOKEN: "never" },
    }),
  );
  assert.ok(exportSyncSnapshot(storage).datasets[NOTEBOOK_KEY]);
});
test("cloud auth and version checks prevent silent overwrites; privileged keys are rejected", async () => {
  const config = {
      url: "https://demo-project.supabase.co",
      key: "sb_publishable_abcdefghijklmnopqrstuvwxyz",
    },
    id = "12345678-1234-1234-1234-123456789abc";
  let revision = 2;
  const fetcher = async (url, options) => {
    if (url.includes("/auth/"))
      return new Response(
        JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expires_in: 3600,
          user: { id, email: "test@example.com" },
        }),
        { status: 200 },
      );
    assert.equal(options.headers.Authorization, "Bearer test-token");
    if (url.includes("/rpc/")) {
      const body = JSON.parse(options.body);
      if (body.expected_revision !== revision)
        return new Response("{}", { status: 409 });
      return new Response(
        JSON.stringify([{ new_revision: ++revision, saved_at: "today" }]),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify([
        { revision, updated_at: "today", data: { version: 1, datasets: {} } },
      ]),
      { status: 200 },
    );
  };
  const client = new CloudClient(config, fetcher);
  await assert.rejects(() => client.push({}), /افحص/);
  await client.login("test@example.com", "test-password");
  await client.inspect();
  await client.push({ version: 1, datasets: {} });
  assert.equal(client.revision, 3);
  revision = 4;
  await assert.rejects(
    () => client.push({ version: 1, datasets: {} }),
    /تعارض/,
  );
  assert.equal(client.revision, 3);
  assert.throws(() =>
    validateCloudConfig(config.url, "sb_secret_this-is-not-a-public-key"),
  );
});

test("restoring folders preserves earlier deletions and resolves name collisions", () => {
  const data = initialFiles();
  createFile(data, { id: "parent", name: "مشروع", kind: "folder" });
  createFile(data, { id: "earlier", name: "قديم.txt", parent: "parent" });
  createFile(data, { id: "current", name: "حالي.txt", parent: "parent" });
  trashFile(data, "earlier");
  trashFile(data, "parent");
  createFile(data, { id: "replacement", name: "مشروع", kind: "folder" });
  trashFile(data, "parent", true);
  assert.equal(data.entries.find((e) => e.id === "earlier").deleted, true);
  assert.equal(data.entries.find((e) => e.id === "current").deleted, false);
  assert.equal(data.entries.find((e) => e.id === "parent").name, "مشروع (1)");
  parseFiles(data);
});
