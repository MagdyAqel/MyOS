import { test, expect } from "@playwright/test";
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
const desktop = async (page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "الدخول الآن", exact: true }).tap();
};
const contained = async (locator, width, height) => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
  return box;
};
for (const viewport of [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`phone launcher, browser and notes fit ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await desktop(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
    for (const button of await page.locator(".desktop-icons button").all()) {
      const box = await contained(button, viewport.width, viewport.height - 58);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.locator('.desktop-icons [data-open="browser"]').tap();
    const input = page.getByRole("textbox", { name: "عنوان الموقع" });
    await contained(input, viewport.width, viewport.height);
    await input.fill("example.com");
    expect(
      await input.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    await page.getByRole("button", { name: "إغلاق", exact: true }).tap();
    await page.locator('.desktop-icons [data-open="notes"]').tap();
    const area = page.getByRole("textbox", { name: "نص الملاحظة" });
    await area.fill("ملاحظة من الهاتف");
    await contained(area, viewport.width, viewport.height - 58);
    await page.getByRole("button", { name: "ملاحظة جديدة", exact: true }).tap();
    await area.fill("ثانية");
    await page.locator(".notes-sidebar nav button").first().tap();
    await expect(area).toHaveValue("ملاحظة من الهاتف");
    await page.getByRole("button", { name: "إغلاق", exact: true }).tap();
    await page.getByRole("button", { name: "ابدأ", exact: true }).tap();
    await contained(
      page.locator("#start"),
      viewport.width,
      viewport.height - 58,
    );
  });
}
test("touch construction, training and quick attack stay beside the battlefield", async ({
  page,
}) => {
  await desktop(page);
  await page.locator('.desktop-icons [data-open="strategy"]').tap();
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-renderer", "webgl");
  const box = await canvas.boundingBox();
  expect(box.height).toBeGreaterThan(300);
  expect(
    await canvas.evaluate((e) => e.width / e.clientWidth),
  ).toBeLessThanOrEqual(1.2);
  for (const type of ["power", "supply", "barracks"]) {
    await page.locator('[data-game="commands"]').tap();
    await expect(page.locator(".rts-panel")).toBeVisible();
    const build = page.locator(`[data-build="${type}"]`);
    expect((await build.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await build.tap();
    await expect(page.locator(".rts-panel")).toBeHidden();
    await page.locator('[data-game="place-touch"]').tap();
    await expect(page.locator(".mobile-placement")).toBeHidden();
  }
  await page.locator('[data-game="commands"]').tap();
  await page.locator('[data-train="soldier"]').tap();
  await expect(page.locator('[data-stat="army"]')).toContainText("الجيش 4");
  await page.locator('[data-game="multiselect"]').tap();
  await expect(page.locator('[data-game="multiselect"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator('[data-game="commands"]').tap();
  await page.locator('[data-game="select"]').tap();
  await page.locator('[data-game="attack"]').tap();
  await expect(page.locator(".rts-message")).toContainText("أمر هجوم");
  for (const key of ["commands", "select", "attack", "maps"]) {
    const rect = await contained(
      page.locator(`[data-game="${key}"]`),
      390,
      786,
    );
    expect(rect.height).toBeGreaterThanOrEqual(44);
  }
  await page.locator('[data-game="maps"]').tap();
  await page
    .getByRole("combobox", { name: "اختيار المرحلة" })
    .selectOption("2");
  await page
    .getByRole("combobox", { name: "اختيار الخريطة" })
    .selectOption("archipelago");
  await expect(page.locator(".campaign-bar")).toBeHidden();
  await expect(canvas).toHaveAttribute("data-renderer", "webgl");
});
test("one-finger dragging pans without giving orders; rotation keeps the game usable", async ({
  page,
}) => {
  await desktop(page);
  await page.locator('.desktop-icons [data-open="strategy"]').tap();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  const minimap = page.locator(".battle-minimap svg circle").last();
  const before = await minimap.getAttribute("cx");
  const box = await page.locator("canvas").boundingBox(),
    client = await page.context().newCDPSession(page),
    x = box.x + box.width * 0.55,
    y = box.y + box.height * 0.4;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  });
  for (let step = 1; step <= 5; step++)
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + step * 10, y: y + step * 4, id: 1 }],
    });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(minimap).not.toHaveAttribute("cx", before);
  await expect(page.locator('[data-stat="army"]')).toContainText("المحدد 0");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  const field = await contained(page.locator("canvas"), 844, 332);
  expect(field.height).toBeGreaterThan(100);
  await page.locator('[data-game="commands"]').tap();
  await expect(page.locator(".rts-panel")).toBeVisible();
  await contained(page.locator(".rts-panel"), 844, 332);
  await page.locator('[data-game="commands"]').tap();
  await page.locator('[data-game="select"]').tap();
  await page.locator('[data-game="attack"]').tap();
  await expect(page.locator(".rts-message")).toContainText("أمر هجوم");
});
test("editing remains usable after the viewport shrinks", async ({ page }) => {
  await desktop(page);
  await page.locator('.desktop-icons [data-open="notes"]').tap();
  const area = page.getByRole("textbox", { name: "نص الملاحظة" });
  await area.fill("نص يبقى أثناء الكتابة");
  await page.setViewportSize({ width: 390, height: 500 });
  await expect(area).toHaveValue("نص يبقى أثناء الكتابة");
  const box = await contained(area, 390, 442);
  expect(box.height).toBeGreaterThan(70);
  await area.fill("نص بعد تغيير المساحة");
  await expect(page.locator(".notes-save-state")).toContainText("تم الحفظ");
});

test('phone keeps storage and sound failures visible', async ({page}) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'myos-campaign-v1') throw new DOMException('Full', 'QuotaExceededError');
      return set.call(this, key, value);
    };
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
  });
  await desktop(page);
  await page.locator('.desktop-icons [data-open="strategy"]').tap();
  await expect(page.locator('.campaign-save')).toBeVisible();
  await expect(page.locator('.campaign-save')).toContainText('تعذّر حفظ');
  await page.getByRole('button', {name: 'تشغيل الأصوات', exact: true}).tap();
  await expect(page.locator('.sound-status')).toBeVisible();
  await expect(page.locator('.sound-status')).toContainText('غير مدعوم');
});
