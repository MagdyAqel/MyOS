import { test, expect } from "@playwright/test";
import { enterDesktop } from "./helpers.js";

test("large-map button opens a bigger battle, minimap orders reach its far corner and saves resume it", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("myos-quality-v1", "low"),
  );
  await enterDesktop(page);
  await page.locator("[data-task=strategy]").click();
  await page.locator("[data-game=large-map]").click();
  await expect(page.getByLabel("اختيار الخريطة", { exact: true })).toHaveValue(
    "great-divide",
  );
  await expect(page.locator(".battle-minimap svg")).toHaveAttribute(
    "viewBox",
    "0 0 1600 1000",
  );
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await page.locator("[data-game=select]").click();
  // The SVG contents refresh during play; click the stable minimap button.
  const minimap = page.locator(".battle-minimap");
  const rect = await minimap.boundingBox();
  await minimap.click({
    position: { x: rect.width * 0.91, y: rect.height * 0.91 },
    modifiers: ["Shift"],
  });
  await page.locator("[data-game=save]").click();
  const snapshot = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("myos-battle-manual-v1")),
  );
  const orders = snapshot.entities.filter((e) => e.team === "blue" && e.order);
  expect(orders).toHaveLength(3);
  expect(orders.every((e) => e.order.x > 1300 && e.order.y > 800)).toBe(true);
  await page
    .getByLabel("اختيار الخريطة", { exact: true })
    .selectOption("dunes");
  await page.locator("[data-game=resume]").click();
  await expect(page.getByLabel("اختيار الخريطة", { exact: true })).toHaveValue(
    "great-divide",
  );
  await expect(page.locator(".rts-result")).toContainText("متوقفة");
});

test("all four large battlefields render their distant units and accept precise picking at phone size", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /THREE|WebGL|shader/i.test(m.text()))
      errors.push(m.text());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const results = await page.evaluate(async () => {
    const { Battle } = await import("/src/battle.js");
    const { LARGE_MAP_IDS } = await import("/src/maps.js");
    const { createBattleScene } = await import("/src/scene3d.js");
    document.body.replaceChildren();
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh";
    document.body.append(canvas);
    const results = [];
    for (const [stage, id] of LARGE_MAP_IDS.entries()) {
      const b = new Battle(stage, id);
      b.fog = false;
      const type = stage >= 2 ? "destroyer" : "tank";
      const unit = b.add(type, "blue", 1430, 890);
      const view = createBattleScene(canvas, b.stage, b.map, {
        quality: "low",
      });
      view.focus([unit]);
      view.draw(b);
      const p = view.project(unit.x, unit.y, unit.domain);
      const hit = view.pick({ clientX: p.x, clientY: p.y });
      results.push({
        id,
        expected: unit.id,
        picked: hit?.entityId,
        calls: view.statistics().calls,
      });
      view.dispose();
    }
    canvas.remove();
    return results;
  });
  for (const result of results) {
    expect(result.picked, result.id).toBe(result.expected);
    expect(result.calls).toBeLessThan(500);
  }
  expect(errors).toEqual([]);
});
