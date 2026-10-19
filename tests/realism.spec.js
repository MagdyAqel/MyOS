import { test, expect } from "@playwright/test";
import { enterDesktop } from "./helpers.js";
test("gallery images and custom uploaded wallpaper survive reload", async ({
  page,
}) => {
  await enterDesktop(page);
  await page.locator('[data-task="settings"]').click();
  await page
    .getByRole("button", { name: "ليلة في الجبال", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-wallpaper",
    "alpine",
  );
  expect(
    await page
      .locator("#desktop")
      .evaluate((e) => getComputedStyle(e).backgroundImage),
  ).toContain("alpine.svg");
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 40;
    c.height = 30;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#da834e";
    ctx.fillRect(0, 0, 40, 30);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByLabel("رفع صورة خلفية")
    .setInputFiles({
      name: "my-photo.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await expect(page.locator(".wallpaper-status")).toContainText("تم حفظ صورتك");
  await expect(page.locator("html")).toHaveAttribute(
    "data-wallpaper",
    "custom",
  );
  await page.reload();
  await page.getByRole("button", { name: "الدخول الآن", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-wallpaper",
    "custom",
  );
  expect(
    await page
      .locator("#desktop")
      .evaluate((e) => getComputedStyle(e).backgroundImage),
  ).toContain("blob:");
  await page.locator('[data-task="settings"]').click();
  await page
    .getByLabel("رفع صورة خلفية")
    .setInputFiles({
      name: "bad.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("bad"),
    });
  await expect(page.locator(".wallpaper-status")).toContainText("اختر صورة");
  await expect(page.locator("html")).toHaveAttribute(
    "data-wallpaper",
    "custom",
  );
  await page.getByRole("button", { name: "شاطئ هادئ", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-wallpaper", "coast");
});
test("map selection, tactical minimap and sound controls work together", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const create = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function (...args) {
      const gain = create.apply(this, args);
      if (!window.testMaster) {
        window.testMaster = gain;
        window.testAudio = this;
      }
      return gain;
    };
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enterDesktop(page);
  await page.locator('[data-task="strategy"]').click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await page
    .getByRole("combobox", { name: "اختيار الخريطة" })
    .selectOption("canyon");
  await expect(page.locator(".map-preview strong")).toHaveText("ممر الوادي");
  const minimap = page.locator(".battle-minimap");
  await expect(minimap.locator("svg")).toBeVisible();
  await minimap.click({ position: { x: 100, y: 35 } });
  await expect(minimap.locator("circle").last()).not.toHaveAttribute(
    "cx",
    "500",
  );
  await expect(page.locator('[data-sound="toggle"]')).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page
    .getByRole("button", { name: "تشغيل الأصوات", exact: true })
    .click();
  await expect(page.locator('[data-sound="toggle"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator('[data-sound="toggle"]')).toHaveAttribute(
    "data-audio-state",
    "running",
  );
  await page.getByRole("slider", { name: "مستوى صوت اللعبة" }).fill("22");
  await page.locator('[data-game="pause"]').click();
  await expect
    .poll(() => page.evaluate(() => window.testMaster.gain.value))
    .toBeLessThan(0.002);
  await page.locator('[data-game="pause"]').click();
  await expect
    .poll(() => page.evaluate(() => window.testMaster.gain.value))
    .toBeGreaterThan(0.1);
  await page.getByRole("button", { name: "كتم الأصوات", exact: true }).click();
  await expect(page.locator('[data-sound="toggle"]')).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.testAudio.state))
    .toBe("closed");
  await page.locator('[data-task="strategy"]').click();
  await expect(
    page.getByRole("combobox", { name: "اختيار الخريطة" }),
  ).toHaveValue("canyon");
  await expect(
    page.getByRole("slider", { name: "مستوى صوت اللعبة" }),
  ).toHaveValue("22");
  expect(errors).toEqual([]);
});
test("synthesized weapon, explosion, sonar and aircraft cues produce distinct audible waveforms", async ({
  page,
}) => {
  await enterDesktop(page);
  const results = await page.evaluate(async () => {
    const { scheduleCue } = await import("/src/audio.js");
    const samples = [];
    for (const name of [
      "rifle",
      "cannon",
      "naval",
      "missile",
      "torpedo",
      "sonar",
      "explosion",
    ]) {
      const ctx = new OfflineAudioContext(2, 48000 * 1.4, 48000);
      scheduleCue(ctx, name, ctx.destination, 0.3);
      const buffer = await ctx.startRendering(),
        data = buffer.getChannelData(0);
      let energy = 0,
        tail = 0;
      for (let i = 0; i < data.length; i++) {
        energy += data[i] ** 2;
        if (i > 10000) tail += data[i] ** 2;
      }
      samples.push({ name, energy, tail });
    }
    return samples;
  });
  for (const sound of results) expect(sound.energy).toBeGreaterThan(0.05);
  expect(new Set(results.map((x) => x.energy.toFixed(2))).size).toBe(
    results.length,
  );
  expect(results.find((x) => x.name === "sonar").tail).toBeGreaterThan(
    results.find((x) => x.name === "rifle").tail,
  );
});
