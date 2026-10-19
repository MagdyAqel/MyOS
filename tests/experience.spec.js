import { test, expect } from "@playwright/test";
import { enterDesktop } from "./helpers.js";

test("boot logo and exact developer credit transition into the desktop", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#boot-screen")).toBeVisible();
  await expect(page.locator("#boot-screen")).toContainText(
    "Develped by:Pro. Magdy S. Aqel",
  );
  await expect(page.locator("#app")).toHaveAttribute("inert", "");
  await expect(page.locator("#boot-screen")).toHaveCount(0, { timeout: 6000 });
  await expect(page.locator("#app")).not.toHaveAttribute("inert", "");
  await expect(page.locator(".developer-credit")).toContainText(
    "Pro. Magdy S. Aqel",
  );
});
test("multiple notes migrate old text and survive reload, with download and honest storage errors", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("test-migrated")) {
      localStorage.setItem("myos-note", "نصي القديم");
      localStorage.setItem("test-migrated", "true");
    }
  });
  await enterDesktop(page);
  await page.locator('[data-task="notes"]').click();
  const area = page.getByRole("textbox", { name: "نص الملاحظة" });
  await expect(area).toHaveValue("نصي القديم");
  await page
    .getByRole("textbox", { name: "عنوان الملاحظة" })
    .fill("دفتر العمل");
  await area.fill("معلومات لا تضيع");
  await page.getByRole("button", { name: "ملاحظة جديدة", exact: true }).click();
  await page
    .getByRole("textbox", { name: "عنوان الملاحظة" })
    .fill("مخطط الرحلة");
  await area.fill("زيارة البحر");
  await expect(page.locator(".notes-save-state")).toContainText("تم الحفظ");
  await page.reload();
  await page.getByRole("button", { name: "الدخول الآن", exact: true }).click();
  await page.locator('[data-task="notes"]').click();
  await expect(area).toHaveValue("زيارة البحر");
  await page
    .locator(".notes-sidebar")
    .getByRole("button", { name: "دفتر العمل", exact: true })
    .click();
  await expect(area).toHaveValue("معلومات لا تضيع");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "تنزيل نص", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("دفتر العمل.txt");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await area.fill("نص غير محفوظ");
  await expect(page.locator(".notes-save-state")).toContainText("لم يُحفظ");
});
test("all four stages render WebGL, switch units, rotate camera, and retain stage selection", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enterDesktop(page);
  await page.locator('[data-task="strategy"]').click();
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-renderer", "webgl");
  for (const [index, unit] of [
    ["1", "fighter"],
    ["2", "destroyer"],
    ["3", "submarine"],
    ["0", "tank"],
  ]) {
    await page
      .getByRole("combobox", { name: "اختيار المرحلة" })
      .selectOption(index);
    await expect(canvas).toHaveAttribute("data-renderer", "webgl");
    await expect(page.locator(`[data-train="${unit}"]`)).toBeVisible();
    await page.getByRole("button", { name: "تدوير الكاميرا لليسار" }).click();
    await page.getByRole("button", { name: "تقريب الكاميرا" }).click();
  }
  await page
    .getByRole("combobox", { name: "اختيار المرحلة" })
    .selectOption("2");
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await page.locator('[data-task="strategy"]').click();
  await expect(
    page.getByRole("combobox", { name: "اختيار المرحلة" }),
  ).toHaveValue("2");
  await expect(canvas).toHaveAttribute("data-renderer", "webgl");
  expect(errors).toEqual([]);
});
test("3D projection and raycast select a rendered tank after camera rotation", async ({
  page,
}) => {
  await enterDesktop(page);
  const result = await page.evaluate(async () => {
    const { Battle } = await import("/src/battle.js");
    const { createBattleScene } = await import("/src/scene3d.js");
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:fixed;left:0;top:0;width:900px;height:560px";
    document.body.append(canvas);
    const b = new Battle(),
      view = createBattleScene(canvas, b.stage);
    view.rotate(0.2);
    view.draw(b);
    const unit = b.entities.find((e) => e.type === "tank");
    const pos = view.project(unit.x, unit.y);
    const point = view.pick({ clientX: pos.x, clientY: pos.y });
    view.dispose(true);
    canvas.remove();
    return { expected: unit.id, actual: point?.entityId };
  });
  expect(result.actual).toBe(result.expected);
});

test('unavailable WebGL shows a useful error while the notebook remains usable', async ({page}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return null;
      return original.call(this, type, ...args);
    };
  });
  await enterDesktop(page);
  await page.locator('[data-task="strategy"]').click();
  await expect(page.locator('canvas')).toHaveAttribute('data-renderer', 'unavailable');
  await expect(page.locator('.rts-result')).toContainText('غير متاحة');
  await page.getByRole('button', {name: 'إغلاق', exact: true}).click();
  await page.locator('[data-task="notes"]').click();
  await page.getByRole('textbox', {name: 'نص الملاحظة'}).fill('حفظ يعمل دون WebGL');
  await expect(page.locator('.notes-save-state')).toContainText('تم الحفظ');
});
