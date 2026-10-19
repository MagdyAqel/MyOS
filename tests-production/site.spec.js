import { test, expect } from "@playwright/test";
test("built site under /MyOS/ loads wallpaper assets, campaign maps and sound", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`);
  });
  await page.goto("/MyOS/");
  await page.getByRole("button", { name: "الدخول الآن", exact: true }).click();
  await page.locator('[data-task="settings"]').click();
  await page
    .getByRole("button", { name: "ليلة في الجبال", exact: true })
    .click();
  const background = await page
    .locator("#desktop")
    .evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--desktop-image"),
    );
  expect(background).toContain("/MyOS/wallpapers/alpine.svg");
  const loaded = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image.naturalWidth);
        image.onerror = () => resolve(0);
        image.src = new URL("wallpapers/alpine.svg", document.baseURI).href;
      }),
  );
  expect(loaded).toBe(1920);
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await page.locator('[data-task="strategy"]').click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await page
    .getByRole("combobox", { name: "اختيار الخريطة" })
    .selectOption("canyon");
  await page
    .getByRole("button", { name: "تشغيل الأصوات", exact: true })
    .click();
  await expect(page.locator('[data-sound="toggle"]')).toHaveAttribute(
    "data-audio-state",
    "running",
  );
  await page
    .getByRole("combobox", { name: "اختيار المرحلة" })
    .selectOption("2");
  await page
    .getByRole("combobox", { name: "اختيار الخريطة" })
    .selectOption("archipelago");
  await expect(page.locator(".battle-minimap svg")).toBeVisible();
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "الدخول الآن", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-wallpaper",
    "alpine",
  );
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});
