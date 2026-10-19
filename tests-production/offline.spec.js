import { test, expect } from "@playwright/test";
test("installed production shell, notes and full game reload offline under /MyOS/", async ({
  page,
  context,
}) => {
  await page.goto("/MyOS/");
  await page.getByRole("button", { name: "الدخول الآن", exact: true }).click();
  await page.locator('.desktop-icons [data-open="install"]').click();
  await expect(page.locator(".pwa-status")).toContainText("جاهز", {
    timeout: 15000,
  });
  const manifest = await page.evaluate(
    async () =>
      await (
        await fetch(new URL("manifest.webmanifest", document.baseURI))
      ).json(),
  );
  expect(manifest.display).toBe("standalone");
  expect(manifest.scope).toBe("./");
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await page.locator('[data-task="notes"]').click();
  await page
    .getByRole("textbox", { name: "نص الملاحظة" })
    .fill("نص متاح دون إنترنت");
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "الدخول الآن", exact: true }).click();
  await page.locator('[data-task="notes"]').click();
  await expect(page.getByRole("textbox", { name: "نص الملاحظة" })).toHaveValue(
    "نص متاح دون إنترنت",
  );
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await page.locator('[data-task="strategy"]').click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await page
    .getByRole("combobox", { name: "اختيار المرحلة" })
    .selectOption("2");
  await page
    .getByRole("combobox", { name: "نوع المهمة" })
    .selectOption("capture");
  await expect(page.locator(".mission-objective")).toContainText("السيطرة");
  await page.locator('[data-game="save"]').click();
  await expect(page.locator(".battle-save-status")).toContainText("تم حفظ");
});
