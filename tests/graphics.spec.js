import { test, expect } from "@playwright/test";
import { enterDesktop } from "./helpers.js";

test("detailed mixed-force models render in every quality, remain selectable, and release removed-unit GPU resources", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /THREE|WebGL|shader|geometry/i.test(m.text()))
      errors.push(m.text());
  });
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { Battle } = await import("/src/battle.js"),
      { createBattleScene } = await import("/src/scene3d.js");
    document.body.replaceChildren();
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh";
    document.body.append(canvas);
    const b = new Battle(2);
    b.fog = false;
    const view = createBattleScene(canvas, b.stage, b.map, { quality: "high" });
    for (const [i, type] of [
      "apc",
      "artillery",
      "recon",
      "drone",
      "repair",
      "ammoTruck",
      "engineer",
      "barracks",
      "factory",
      "airfield",
      "supply",
    ].entries())
      b.add(type, "blue", 100 + (i % 6) * 120, 65 + Math.floor(i / 6) * 100);
    view.draw(b);
    const high = view.statistics();
    const tank = b.entities.find((e) => e.type === "tank");
    view.focus([tank]);
    view.draw(b);
    const p = view.project(tank.x, tank.y),
      hit = view.pick({ clientX: p.x, clientY: p.y });
    view.setQuality("low");
    view.draw(b);
    const low = view.statistics();
    view.setQuality("medium");
    view.draw(b);
    const baseline = view.statistics();
    for (let i = 0; i < 3; i++) {
      const id = b.add("tank", "blue", tank.x + 50, tank.y + 50).id;
      view.draw(b);
      b.entities = b.entities.filter((e) => e.id !== id);
      view.draw(b);
    }
    const after = view.statistics();
    view.dispose(true);
    canvas.remove();
    return {
      high,
      low,
      baseline,
      after,
      picked: hit?.entityId,
      expected: tank.id,
    };
  });
  expect(result.picked).toBe(result.expected);
  expect(result.high.triangles).toBeGreaterThan(1000);
  expect(result.low.calls).toBeLessThan(result.high.calls);
  expect(result.low.triangles).toBeLessThan(result.high.triangles);
  expect(result.low.calls).toBeLessThan(500);
  expect(result.after.geometries).toBe(result.baseline.geometries);
  expect(result.after.textures).toBe(result.baseline.textures);
  expect(errors).toEqual([]);
});

test("army attack button issues persisted advancing orders and building repairs can be started and stopped in the panel", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("myos-quality-v1", "low"),
  );
  await enterDesktop(page);
  await page.locator("[data-task=strategy]").click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await page.locator("[data-game=select]").click();
  await page.locator("[data-game=attack]").click();
  await expect(page.locator(".rts-message")).toContainText("أمر هجوم");
  await page.locator("[data-game=save]").click();
  const initial = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("myos-battle-manual-v1")),
  );
  expect(initial.entities.filter((e) => e.attackGoal)).toHaveLength(3);
  await expect
    .poll(async () => {
      await page.locator("[data-game=save]").click();
      return page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("myos-battle-manual-v1"),
          ).entities.find((e) => e.type === "tank").x,
      );
    })
    .toBeGreaterThan(initial.entities.find((e) => e.type === "tank").x + 5);
  // Load an actual damaged save; the UI must repair it through the simulation.
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("myos-battle-manual-v1"));
    data.entities.find((e) => e.type === "hq" && e.team === "blue").hp -= 200;
    localStorage.setItem("myos-battle-manual-v1", JSON.stringify(data));
  });
  await page.locator("[data-game=resume]").click();
  await page.locator("[data-game=pause]").click();
  await page.locator(".building-repair summary").click();
  await page.locator("[data-repair=toggle]").click();
  await expect(page.locator(".repair-status")).toContainText("جارٍ التصليح");
  await expect
    .poll(async () => {
      await page.locator("[data-game=save]").click();
      return page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("myos-battle-manual-v1"),
          ).entities.find((e) => e.type === "hq" && e.team === "blue").hp,
      );
    })
    .toBeGreaterThan(1600);
  await page.locator("[data-repair=toggle]").click();
  await expect(page.locator("[data-repair=toggle]")).toHaveText("بدء التصليح");
});
