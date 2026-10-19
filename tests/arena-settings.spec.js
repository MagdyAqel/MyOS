import { test, expect } from "@playwright/test";
import { enterDesktop } from "./helpers.js";
const deployed = "https://myos-arena.iugteacher.workers.dev";
async function openArena(page) {
  await enterDesktop(page);
  await page.locator("[data-task=arena]").click();
  await page.locator(".arena-config summary").click();
  return page.getByRole("textbox", { name: "عنوان خادم اللعب", exact: true });
}
test("a cached empty configuration cannot erase the deployed default and immediate room creation works", async ({
  page,
}) => {
  const room = "a".repeat(32),
    token = "b".repeat(32);
  let requested;
  await page.route("**/multiplayer.json*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({ json: { endpoint: "" } });
  });
  await page.route(deployed + "/rooms", async (route) => {
    requested = route.request().postDataJSON();
    await route.fulfill({
      headers: { "Access-Control-Allow-Origin": "*" },
      json: { room, token, side: "blue" },
    });
  });
  await page.routeWebSocket(
    "wss://myos-arena.iugteacher.workers.dev/**",
    (ws) => {
      ws.onMessage(() =>
        ws.send(
          JSON.stringify({
            type: "state",
            protocol: 1,
            room,
            side: "blue",
            phase: "waiting",
            players: {
              blue: { connected: true, ready: false },
              red: { connected: false, ready: false },
            },
          }),
        ),
      );
    },
  );
  const input = await openArena(page);
  await expect(input).toHaveValue(deployed);
  await page.locator("[data-arena=create]").click();
  await expect(page.locator(".arena-players")).toContainText(
    "اللاعب الأول متصل",
  );
  expect(requested).toEqual({ stage: 0, map: "dunes", startingCash: 2400 });
  await expect(input).toHaveValue(deployed);
});
test("failed configuration download and a corrupt saved server still leave a usable default", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("myos-multiplayer-endpoint-v1", "not a server"),
  );
  await page.route("**/multiplayer.json*", (route) => route.abort());
  const input = await openArena(page);
  await expect(input).toHaveValue(deployed);
  await expect(page.locator(".arena-status")).not.toContainText("Invalid URL");
});
test("empty and malformed server fields produce clear Arabic errors without sending a room request", async ({
  page,
}) => {
  await page.route("**/multiplayer.json*", (route) =>
    route.fulfill({ json: { endpoint: deployed } }),
  );
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/rooms")) requests++;
  });
  const input = await openArena(page);
  await input.fill("");
  await page.locator("[data-arena=create]").click();
  await expect(page.locator(".arena-status")).toHaveText(
    "أدخل عنوان خادم اللعب أولًا",
  );
  await input.fill("broken address");
  await page.locator("[data-arena=create]").click();
  await expect(page.locator(".arena-status")).toContainText(
    "عنوان خادم اللعب غير صالح",
  );
  expect(requests).toBe(0);
});
test("a late configuration response preserves the server typed by the user", async ({
  page,
}) => {
  let release,
    completed = false;
  await page.route("**/multiplayer.json*", async (route) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: { endpoint: deployed } });
    completed = true;
  });
  const input = await openArena(page);
  await expect.poll(() => typeof release).toBe("function");
  await input.fill("https://private.example");
  release();
  await expect.poll(() => completed).toBe(true);
  await expect(input).toHaveValue("https://private.example");
});
