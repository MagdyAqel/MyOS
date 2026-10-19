import { Battle } from "../src/battle.js";
import { snapshotBattle } from "../src/battle-save.js";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { enterDesktop } from "./helpers.js";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS9sAAAAASUVORK5CYII=",
  "base64",
);
const open = async (page, id) => page.locator(`[data-task="${id}"]`).click();
test("mobile command center relocates and saves headquarters, changes formations, groups and graphics", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterDesktop(page);
  await open(page, "strategy");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await page.locator("[data-game=commands]").click();
  await page.locator("[data-tactic=suggest-hq]").click();
  await expect(page.locator(".hq-status")).toContainText(/تجهيز|يتحرك/);
  await page.locator(".tactical-details summary").click();
  await page
    .getByRole("combobox", { name: "تشكيل الجيش" })
    .selectOption("wedge");
  await page.locator("[data-game=commands]").click();
  await page.locator("[data-game=select]").click();
  await page.locator("[data-game=commands]").click();
  await page.locator('[data-group-save="1"]').click();
  await page.locator('[data-group="1"]').click();
  await page.locator("[data-order-mode=patrol]").click();
  await page.locator("[data-game=commands]").click();
  await page.locator("[data-game=maps]").click();
  await page
    .getByRole("combobox", { name: "جودة الرسومات" })
    .selectOption("high");
  await expect(page.locator("canvas")).toHaveAttribute("data-quality", "high");
  await page
    .getByRole("combobox", { name: "جودة الرسومات" })
    .selectOption("low");
  await expect(page.locator("canvas")).toHaveAttribute("data-quality", "low");
  await page.locator("[data-game=save]").click();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("myos-battle-manual-v1")),
  );
  expect(state.formation).toBe("wedge");
  expect(state.groups["1"]).toHaveLength(3);
  expect(
    state.entities.find((e) => e.type === "hq" && e.team === "blue").hqMode,
  ).not.toBe("deployed");
  await page.locator("[data-game=resume]").click();
  await expect(page.locator(".rts-result")).toContainText("متوقفة");
});
test("story campaign restarts its operation and leaves practice stages available", async ({
  page,
}) => {
  await enterDesktop(page);
  await open(page, "strategy");
  await page.locator(".career-details summary").click();
  await page.locator("[data-career=start]").click();
  await page.locator(".battle-setup button[value=start]").click();
  await expect(page.locator(".mission-objective")).toContainText("القافلة");
  await page.locator("[data-game=restart]").click();
  await expect(page.locator(".mission-objective")).toContainText("القافلة");
  await page.locator("[data-game=save]").click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("myos-battle-manual-v1")).operationId,
    ),
  ).toBe("first-light");
  await page
    .getByRole("combobox", { name: "اختيار المرحلة" })
    .selectOption("3");
  await expect(
    page.getByRole("combobox", { name: "اختيار المرحلة" }),
  ).toHaveValue("3");
});
test("rich documents format, undo, redo, sanitize imports, download and survive reload", async ({
  page,
}) => {
  await enterDesktop(page);
  await open(page, "writer");
  const editor = page.getByRole("textbox", { name: "نص المستند المنسق" });
  await editor.fill("نص منسق محفوظ");
  await editor.press("Control+a");
  await page.getByRole("button", { name: "خط عريض", exact: true }).click();
  await expect(editor.locator("b,strong")).toHaveCount(1);
  await page.locator("[data-doc=undo]").click();
  await expect(editor.locator("b,strong")).toHaveCount(0);
  await page.locator("[data-doc=redo]").click();
  await expect(editor.locator("b,strong")).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page.locator("[data-doc=html]").click();
  expect((await download).suggestedFilename()).toMatch(/\.html$/);
  await page.reload();
  await page.getByRole("button", { name: "الدخول الآن", exact: true }).click();
  await open(page, "writer");
  await expect(editor).toContainText("نص منسق محفوظ");
  await page.getByLabel("استيراد مستند", { exact: true }).setInputFiles({
    name: "safe.html",
    mimeType: "text/html",
    buffer: Buffer.from(
      '<h2 onclick="window.compromised=1">مستند آمن</h2><script>window.compromised=1</script><img src=x onerror="window.compromised=1">',
    ),
  });
  await expect(editor).toContainText("مستند آمن");
  await expect(editor.locator("script,img,[onclick]")).toHaveCount(0);
  expect(await page.evaluate(() => window.compromised)).toBeUndefined();
});
test("local media viewer decodes images and audio, offers PDF and releases replaced files", async ({
  page,
}) => {
  await enterDesktop(page);
  await open(page, "media");
  const input = page.getByLabel("فتح صورة أو ملف وسائط أو PDF");
  await input.setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.locator(".media-stage img")).toHaveJSProperty(
    "naturalWidth",
    1,
  );
  await page.locator("[data-media=rotate]").click();
  await expect(page.locator(".media-stage img")).toHaveCSS(
    "transform",
    /matrix/,
  );
  const wav = Buffer.alloc(44 + 16000);
  wav.write("RIFF");
  wav.writeUInt32LE(36 + 16000, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(16000, 40);
  for (let i = 0; i < 8000; i++)
    wav.writeInt16LE(
      Math.round(Math.sin((i / 8000) * 440 * Math.PI * 2) * 2000),
      44 + i * 2,
    );
  await input.setInputFiles({
    name: "tone.wav",
    mimeType: "audio/wav",
    buffer: wav,
  });
  await expect(page.locator("audio")).toHaveJSProperty("duration", 1);
  await page.locator("audio").evaluate((e) => e.play());
  await expect(page.locator("audio")).toHaveJSProperty("paused", false);
  await input.setInputFiles({
    name: "sample.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"),
  });
  await expect(page.locator(".media-stage object")).toHaveAttribute(
    "type",
    "application/pdf",
  );
  await expect(page.locator("audio")).toHaveCount(0);
  await expect(page.locator(".media-open")).toHaveAttribute("href", /^blob:/);
});
test("appearance, notifications and keyboard navigation work and persist", async ({
  page,
}) => {
  await enterDesktop(page);
  await open(page, "settings");
  await page.getByLabel("لون التمييز", { exact: true }).fill("#44aa88");
  await page.getByLabel("حجم أيقونات سطح المكتب", { exact: true }).focus();
  await page.keyboard.press("End");
  await expect(page.locator(".appearance-status")).toContainText("حُفظت");
  await page.keyboard.press("Control+Alt+m");
  await expect(
    page.getByRole("textbox", { name: "نص الملاحظة" }),
  ).toBeVisible();
  await page.keyboard.press("Control+Alt+n");
  await expect(page.locator("#notification-center")).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("myos:notice", { detail: { text: "اكتمل حفظ بياناتك" } }),
    ),
  );
  await expect(page.locator(".notification-list")).toContainText(
    "اكتمل حفظ بياناتك",
  );
  await page.reload();
  await page.getByRole("button", { name: "الدخول الآن", exact: true }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("myos-appearance-v1")).accent,
    ),
  ).toBe("#44aa88");
  await page.locator("#notifications-button").click();
  await expect(page.locator(".notification-list")).toContainText(
    "اكتمل حفظ بياناتك",
  );
});
test("complete backup previews, restores data and wallpaper, undoes and rolls back write failures", async ({
  page,
}) => {
  await enterDesktop(page);
  await open(page, "notes");
  await page
    .getByRole("textbox", { name: "نص الملاحظة" })
    .fill("قيمة النسخة الأصلية");
  await open(page, "writer");
  await page
    .getByRole("textbox", { name: "نص المستند المنسق" })
    .fill("مستند محفوظ للنسخ");
  await open(page, "settings");
  const wall = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 40;
    c.height = 30;
    const x = c.getContext("2d");
    x.fillStyle = "#487d81";
    x.fillRect(0, 0, 40, 30);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("رفع صورة خلفية").setInputFiles({
    name: "personal.png",
    mimeType: "image/png",
    buffer: Buffer.from(wall, "base64"),
  });
  await expect(page.locator(".wallpaper-status")).toContainText("تم حفظ صورتك");
  await open(page, "backup");
  const waiting = page.waitForEvent("download");
  await page.locator("[data-backup=export]").click();
  const file = await waiting,
    buffer = await readFile(await file.path());
  const snapshot = JSON.parse(buffer);
  expect(snapshot.wallpaper.type).toBe("image/jpeg");
  expect(snapshot.datasets["myos-documents-v1"]).toContain("مستند محفوظ للنسخ");
  await page.evaluate(() => {
    const b = JSON.parse(localStorage.getItem("myos-notebook-v2"));
    b.notes[0].text = "قيمة قبل الاستعادة";
    localStorage.setItem("myos-notebook-v2", JSON.stringify(b));
  });
  const input = page.getByLabel("اختيار نسخة احتياطية");
  await input.setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer,
  });
  await expect(page.locator(".backup-summary")).toContainText("مع خلفية شخصية");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("myos-notebook-v2")).notes[0].text,
    ),
  ).toBe("قيمة قبل الاستعادة");
  await page.locator("[data-backup=confirm]").click();
  await expect(page.locator(".backup-status")).toContainText("تمت استعادة");
  await expect(page.getByRole("textbox", { name: "نص الملاحظة" })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("myos-notebook-v2")).notes[0].text,
    ),
  ).toBe("قيمة النسخة الأصلية");
  await page.locator("[data-backup=undo]").click();
  await expect(page.locator(".backup-status")).toContainText("أُعيدت بيانات");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("myos-notebook-v2")).notes[0].text,
    ),
  ).toBe("قيمة قبل الاستعادة");
  await input.setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer,
  });
  await expect(page.locator(".backup-review")).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let fail = true;
    Storage.prototype.setItem = function (k, v) {
      if (fail && k === "myos-notebook-v2") {
        fail = false;
        throw new DOMException("Full", "QuotaExceededError");
      }
      return original.call(this, k, v);
    };
  });
  await page.locator("[data-backup=confirm]").click();
  await expect(page.locator(".backup-status")).toContainText(
    "أُعيدت بياناتك السابقة",
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("myos-notebook-v2")).notes[0].text,
    ),
  ).toBe("قيمة قبل الاستعادة");
});

test("video opens from a local file and plays with native controls", async ({
  page,
}) => {
  await enterDesktop(page);
  await open(page, "media");
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#396d91";
    ctx.fillRect(0, 0, 96, 64);
    const stream = canvas.captureStream(10),
      recorder = new MediaRecorder(stream, { mimeType: "video/webm" }),
      parts = [];
    const done = new Promise((resolve) => {
      recorder.ondataavailable = (e) => parts.push(e.data);
      recorder.onstop = async () =>
        resolve(
          Array.from(
            new Uint8Array(
              await new Blob(parts, { type: "video/webm" }).arrayBuffer(),
            ),
          ),
        );
    });
    recorder.start();
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? "#396d91" : "#597d56";
      ctx.fillRect(0, 0, 96, 64);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    recorder.stop();
    const result = await done;
    stream.getTracks().forEach((t) => t.stop());
    return result;
  });
  await page.getByLabel("فتح صورة أو ملف وسائط أو PDF").setInputFiles({
    name: "local.webm",
    mimeType: "video/webm",
    buffer: Buffer.from(bytes),
  });
  await expect(page.locator("video")).toHaveJSProperty("videoWidth", 96);
  await page.locator("video").evaluate((e) => e.play());
  await expect(page.locator("video")).toHaveJSProperty("paused", false);
});

test("new productivity apps remain usable on a phone with a reduced viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await enterDesktop(page);
  await page.locator(".desktop-icons [data-open=writer]").click();
  const editor = page.getByRole("textbox", { name: "نص المستند المنسق" });
  await editor.fill("مستند من الجوال");
  await page.setViewportSize({ width: 390, height: 460 });
  await editor.fill("تعديل مستند من الجوال");
  const box = await editor.boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(403);
  await expect
    .poll(async () => (await editor.boundingBox()).height)
    .toBeGreaterThanOrEqual(70);
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".desktop-icons [data-open=backup]").click();
  await expect(page.locator("[data-backup=export]")).toBeVisible();
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await page.locator(".desktop-icons [data-open=media]").click();
  await page
    .getByLabel("فتح صورة أو ملف وسائط أو PDF")
    .setInputFiles({ name: "sample.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".media-stage img")).toHaveJSProperty(
    "naturalWidth",
    1,
  );
});

test("campaign victory awards one point, buys armor and opens the next operation", async ({
  page,
}) => {
  const b = new Battle(0, undefined, {
    mission: "escort",
    operationId: "first-light",
  });
  b.entities.find((e) => e.type === "convoy").x = 850;
  const raw = JSON.stringify(snapshotBattle(b));
  await page.addInitScript(
    (raw) => localStorage.setItem("myos-battle-auto-v1", raw),
    raw,
  );
  await enterDesktop(page);
  await open(page, "strategy");
  await page.locator("[data-game=resume]").click();
  await page.locator("[data-game=pause]").click();
  await expect(page.locator(".rts-result")).toContainText("انتصار");
  await page.locator(".career-details summary").click();
  await expect(page.locator(".career-progress")).toContainText("نقاط ترقية: 1");
  await page.locator("[data-upgrade=armor]").click();
  await expect(page.locator("[data-upgrade=armor]")).toContainText("1/3");
  await page.locator("[data-game=next]").click();
  await page.locator(".battle-setup button[value=start]").click();
  await expect(page.locator(".mission-objective")).toContainText("فرق الإخلاء");
  await page.locator("[data-game=save]").click();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("myos-battle-manual-v1")),
  );
  expect(state.operationId).toBe("safe-return");
  expect(state.upgrades.armor).toBe(1);
  expect(state.entities.find((e) => e.type === "tank").hp).toBe(473);
});
