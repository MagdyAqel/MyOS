import { test, expect } from "@playwright/test";
import { enterDesktop } from "./helpers.js";

test("hand mode drags a wide map without selecting troops and works while paused", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("myos-quality-v1", "low"),
  );
  await enterDesktop(page);
  await page.locator("[data-task=strategy]").click();
  await page.locator("[data-game=large-map]").click();
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-renderer", "webgl");
  const hand = page.getByRole("button", { name: "وضع اليد لتحريك الخريطة" });
  await hand.click();
  await expect(hand).toHaveAttribute("aria-pressed", "true");
  await expect(canvas).toHaveCSS("cursor", "grab");
  const focus = page.locator('.battle-minimap svg circle[r="75"]');
  const xBefore = Number(await focus.getAttribute("cx"));
  const field = await canvas.boundingBox();
  const x = field.x + field.width * 0.56;
  const y = field.y + field.height * 0.51;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 110, y + 50, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(async () =>
      Math.abs(Number(await focus.getAttribute("cx")) - xBefore),
    )
    .toBeGreaterThan(25);
  await expect(page.locator('[data-stat="army"]')).toContainText("المحدد 0");

  await page.locator('[data-game="pause"]').click();
  const pausedBefore = Number(await focus.getAttribute("cx"));
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 80, y - 30, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(async () =>
      Math.abs(Number(await focus.getAttribute("cx")) - pausedBefore),
    )
    .toBeGreaterThan(20);
  await canvas.focus();
  await page.keyboard.press("Escape");
  await expect(hand).toHaveAttribute("aria-pressed", "false");
  await expect(canvas).toHaveCSS("cursor", "crosshair");
});

test("mouse wheel zooms the 3D map toward the cursor", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { Battle } = await import("/src/battle.js");
    const { createBattleScene } = await import("/src/scene3d.js");
    document.body.replaceChildren();
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:fixed;left:0;top:0;width:900px;height:560px";
    document.body.append(canvas);
    const b = new Battle();
    b.fog = false;
    const view = createBattleScene(canvas, b.stage, b.map, { quality: "low" });
    view.draw(b);
    const before = view.project(780, 320);
    const wheel = new WheelEvent("wheel", {
      deltaY: -500,
      clientX: 450,
      clientY: 280,
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(wheel);
    view.draw(b);
    const after = view.project(780, 320);
    view.dispose(true);
    canvas.remove();
    return { before, after, prevented: wheel.defaultPrevented };
  });
  expect(result.prevented).toBe(true);
  expect(Math.abs(result.after.x - 450)).toBeGreaterThan(
    Math.abs(result.before.x - 450) + 10,
  );
});
