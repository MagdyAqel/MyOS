import { test, expect } from "@playwright/test";
import { enterDesktop } from "./helpers.js";
import { Battle } from "../src/battle.js";
import { snapshotBattle } from "../src/battle-save.js";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS9sAAAAASUVORK5CYII=",
  "base64",
);
const open = async (page, id) => page.locator(`[data-task=${id}]`).click();
async function unitPoints(page) {
  return page.evaluate(async () => {
    const { Battle } = await import("/src/battle.js"),
      { createBattleScene } = await import("/src/scene3d.js");
    const original = document.querySelector(".battlefield canvas"),
      r = original.getBoundingClientRect(),
      canvas = document.createElement("canvas");
    canvas.style.cssText = `position:fixed;left:-10000px;top:0;width:${r.width}px;height:${r.height}px`;
    document.body.append(canvas);
    const b = new Battle(),
      view = createBattleScene(canvas, b.stage, b.map, { quality: "low" });
    view.draw(b);
    const points = b.entities
      .filter((e) => e.team === "blue" && e.speed)
      .map((e) => ({
        ...view.project(e.x, e.y, e.domain),
        id: e.id,
        type: e.type,
      }));
    view.dispose(true);
    canvas.remove();
    return { points, r: { x: r.x, y: r.y } };
  });
}
test("money is chosen before a new battle; mouse box selection and Shift select equipment and soldiers", async ({
  page,
}) => {
  await enterDesktop(page);
  await open(page, "strategy");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await page.locator("[data-game=configure]").click();
  await page
    .getByRole("spinbutton", { name: "المال قبل بدء المعركة" })
    .fill("15000");
  await page.locator(".battle-setup button[value=start]").click();
  await expect(page.locator("[data-stat=cash]")).toHaveText("$15000");
  const { points, r } = await unitPoints(page);
  const soldier = points.find((p) => p.type === "soldier"),
    tank = points.find((p) => p.type === "tank");
  async function box(p, shift = false) {
    if (shift) await page.keyboard.down("Shift");
    await page.mouse.move(r.x + p.x - 5, r.y + p.y - 5);
    await page.mouse.down();
    await page.mouse.move(r.x + p.x + 5, r.y + p.y + 5, { steps: 6 });
    await page.mouse.up();
    if (shift) await page.keyboard.up("Shift");
  }
  await box(soldier);
  await expect(page.locator("[data-stat=army]")).toContainText("المحدد 1");
  await box(tank, true);
  await expect(page.locator("[data-stat=army]")).toContainText("المحدد 2");
  await expect(page.locator(".selection-detail")).toContainText("دبابة");
  await expect(page.locator(".selection-detail")).toContainText("جندي");
  await page.locator("[data-advanced=hold]").click();
  await page.locator("[data-game=save]").click();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("myos-battle-manual-v1")),
  );
  expect(state.startingCash).toBe(15000);
  expect(state.entities.filter((e) => e.stance === "hold")).toHaveLength(2);
  await page.locator("[data-game=restart]").click();
  await expect(page.locator("[data-stat=cash]")).toHaveText("$15000");
});
test("touch long press opens orders; sound mix and battery controls persist on a narrow phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterDesktop(page);
  await open(page, "strategy");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  const { points, r } = await unitPoints(page),
    unit = points.find((p) => p.type === "tank");
  const canvas = page.locator("canvas"),
    event = {
      pointerType: "touch",
      pointerId: 77,
      clientX: r.x + unit.x,
      clientY: r.y + unit.y,
      button: 0,
      bubbles: true,
    };
  await canvas.dispatchEvent("pointerdown", event);
  await page.waitForTimeout(780);
  await canvas.dispatchEvent("pointerup", event);
  await expect(page.locator(".touch-orders")).toBeVisible();
  await page
    .locator(".touch-orders button")
    .filter({ hasText: "ثبات" })
    .click();
  await page.locator("[data-game=commands]").click();
  await page.locator(".battle-preferences summary").click();
  await page
    .getByRole("checkbox", { name: "توفير البطارية", exact: true })
    .check();
  await expect(canvas).toHaveAttribute("data-quality", "low");
  await page
    .getByRole("combobox", { name: "إخراج الصوت" })
    .selectOption("speakers");
  await page
    .getByRole("slider", { name: "مستوى المؤثرات", exact: true })
    .fill("70");
  const settings = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("myos-battle-preferences-v1")),
  );
  expect(settings).toMatchObject({
    battery: true,
    profile: "speakers",
    effects: 0.7,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("saved media survives reload, opens from MyOS files, appears in search and participates in full backups", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enterDesktop(page);
  await open(page, "files");
  await page
    .getByLabel("استيراد ملف نصي", { exact: true })
    .setInputFiles({ name: "island.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".media-stage img")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "الدخول الآن", exact: true }).click();
  await open(page, "files");
  await page.getByRole("button", { name: "island.png", exact: true }).click();
  await expect(page.locator(".media-stage img")).toHaveAttribute(
    "alt",
    "island.png",
  );
  await page.locator("#search-button").click();
  await page.locator("#search").fill("island");
  await expect(page.locator(".global-search-result")).toContainText(
    "وسائط محفوظة",
  );
  await page.locator(".global-search-result").click();
  await open(page, "backup");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-backup=export]").click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let text = "";
  for await (const chunk of stream) text += chunk.toString();
  const backup = JSON.parse(text);
  expect(backup.media).toHaveLength(1);
  expect(backup.media[0].name).toBe("island.png");
  await page
    .locator('.window[aria-label="مستكشف الملفات"] [data-action=close]')
    .click();
  await open(page, "files");
  await page
    .getByRole("button", { name: "نقل للسلة island.png", exact: true })
    .click();
  await page.locator("[data-folder=trash]").click();
  await page
    .getByRole("button", { name: "حذف دائم island.png", exact: true })
    .click();
  await page
    .getByRole("button", { name: "حذف دائم island.png", exact: true })
    .click();
  await page
    .locator('.window[aria-label="مستكشف الملفات"] [data-action=close]')
    .click();
  await open(page, "backup");
  await page.getByLabel("اختيار نسخة احتياطية", { exact: true }).setInputFiles({
    name: "media-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await expect(page.locator(".backup-summary")).toContainText("1 وسائط");
  await page.locator("[data-backup=confirm]").click();
  await expect(page.locator(".backup-status")).toContainText("تمت استعادة");
  await open(page, "files");
  await page.getByRole("button", { name: "island.png", exact: true }).click();
  await expect(page.locator(".media-stage img")).toHaveAttribute(
    "alt",
    "island.png",
  );
  expect(errors).toEqual([]);
});
test("global content search finds note text and rich documents and opens the matching item", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "myos-notebook-v2",
      JSON.stringify({
        version: 2,
        activeId: "one",
        notes: [
          { id: "one", title: "عادي", text: "قديم" },
          { id: "two", title: "موعد الرحلة", text: "شيفرة الأطلس" },
        ],
      }),
    );
    localStorage.setItem(
      "myos-documents-v1",
      JSON.stringify({
        version: 1,
        activeId: "one",
        documents: [
          { id: "one", title: "مستند قديم", html: "<p>أول</p>" },
          { id: "two", title: "خطة البحث", html: "<h2>شيفرة الأطلس</h2>" },
        ],
      }),
    );
  });
  await enterDesktop(page);
  await open(page, "notes");
  await open(page, "writer");
  await expect(
    page.getByRole("textbox", { name: "عنوان المستند", exact: true }),
  ).toHaveValue("مستند قديم");
  await page.locator("#search-button").click();
  await page.locator("#search").fill("شيفرة الأطلس");
  await expect(page.locator(".global-search-result")).toHaveCount(2);
  await page
    .locator(".global-search-result")
    .filter({ hasText: "ملاحظة" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "عنوان الملاحظة", exact: true }),
  ).toHaveValue("موعد الرحلة");
  await page.locator("#search-button").click();
  await page
    .locator(".global-search-result")
    .filter({ hasText: "مستند" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "عنوان المستند", exact: true }),
  ).toHaveValue("خطة البحث");
});
test("layered artillery sound renders finite stereo samples with directional panning and distance gain", async ({
  page,
}) => {
  await enterDesktop(page);
  const result = await page.evaluate(async () => {
    const { scheduleCue } = await import("/src/audio.js");
    async function render(pan, gain) {
      const ctx = new OfflineAudioContext(2, 48000, 48000);
      scheduleCue(ctx, "artillery", ctx.destination, pan, gain);
      const b = await ctx.startRendering();
      return [0, 1].map((c) => {
        const samples = b.getChannelData(c);
        return {
          energy: samples.reduce((a, v) => a + v * v, 0),
          finite: samples.every(Number.isFinite),
        };
      });
    }
    return { left: await render(-0.8, 1), distant: await render(-0.8, 0.25) };
  });
  expect(result.left[0].finite).toBe(true);
  expect(result.left[0].energy).toBeGreaterThan(result.left[1].energy * 4);
  expect(result.distant[0].energy).toBeLessThan(result.left[0].energy / 10);
});

test("rebuilt interface expands the field and restores command panels without losing selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterDesktop(page);
  await open(page, "strategy");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await page.locator("[data-game=select]").click();
  const before = await page.locator("canvas").boundingBox();
  expect(before.height).toBeGreaterThan(380);
  await page.locator("[data-game=wide]").click();
  await expect(page.locator(".rts-panel")).toBeHidden();
  await expect(page.locator(".campaign-bar")).toBeHidden();
  const expanded = await page.locator("canvas").boundingBox();
  expect(expanded.width).toBeGreaterThan(before.width + 200);
  expect(expanded.height).toBeGreaterThan(before.height + 25);
  await expect(page.locator("[data-stat=army]")).toContainText("المحدد 3");
  await page.locator("[data-game=commands]").click();
  await expect(page.locator(".rts-panel")).toBeVisible();
  await page.locator("[data-game=maps]").click();
  await expect(page.locator(".campaign-bar")).toBeVisible();
  await page.locator("[data-game=save]").click();
  await page.screenshot({ path: "/tmp/MyOS-4.2-desktop.png" });
});
