import { test, expect } from "@playwright/test";
const deployed = "https://myos-arena.iugteacher.workers.dev";
test("the installed worker refreshes stale multiplayer settings online and keeps them available offline", async ({
  page,
  context,
}) => {
  await page.goto("/MyOS/");
  await page.getByRole("button", { name: "الدخول الآن", exact: true }).click();
  await page.locator("[data-task=install]").click();
  await expect(page.locator(".pwa-status")).toContainText("جاهز", {
    timeout: 15000,
  });
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await page.evaluate(async () => {
    const key = (await caches.keys()).find((k) =>
      k.startsWith("myos-offline-"),
    );
    const cache = await caches.open(key);
    await cache.put(
      new URL("multiplayer.json", document.baseURI).href,
      new Response(JSON.stringify({ endpoint: "" }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await page.locator("[data-task=arena]").click();
  await page.locator(".arena-config summary").click();
  await expect(
    page.getByRole("textbox", { name: "عنوان خادم اللعب", exact: true }),
  ).toHaveValue(deployed);
  const read = () =>
    page.evaluate(async () =>
      (
        await fetch(
          new URL("multiplayer.json?verify=current", document.baseURI),
        )
      ).json(),
    );
  expect((await read()).endpoint).toBe(deployed);
  await context.setOffline(true);
  expect((await read()).endpoint).toBe(deployed);
});
