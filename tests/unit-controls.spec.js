import { test, expect } from "@playwright/test";
import { Battle } from "../src/battle.js";
import { snapshotBattle } from "../src/battle-save.js";
import { OPERATIONS, initialCareer } from "../src/career.js";
import { enterDesktop } from "./helpers.js";
async function savedGame(page) {
  const b = new Battle(0, "fireline", { mission: "siege" });
  b.cash = 10000;
  await page.addInitScript(
    (data) =>
      localStorage.setItem("myos-battle-manual-v1", JSON.stringify(data)),
    snapshotBattle(b),
  );
  await enterDesktop(page);
  await page.locator("[data-task=strategy]").click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  const maps = page.locator("[data-game=maps]");
  if (await maps.isVisible()) await maps.click();
  await page.locator("[data-game=resume]").click();
  await page.locator("[data-game=pause]").click();
  if (
    (await maps.isVisible()) &&
    (await maps.getAttribute("aria-expanded")) === "true"
  )
    await maps.click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
}
test("transport controls board, save, restore and unload real soldiers; design is paid when training", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await savedGame(page);
  await page.locator("[data-select-type=soldier]").click();
  await page.locator("[data-ability=board]").click();
  await expect(page.locator(".unit-status")).toContainText("داخل الناقلات: 2");
  await page.locator("[data-game=save]").click();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("myos-battle-manual-v1")),
  );
  expect(data.entities.filter((e) => e.carriedBy)).toHaveLength(2);
  await page.locator("[data-game=resume]").click();
  await page.locator("[data-game=pause]").click();
  await page.locator("[data-ability=unload]").click();
  await expect(page.locator(".unit-status")).toContainText("داخل الناقلات: 0");
  await page
    .getByRole("combobox", { name: "تصميم ناقلة الجند" })
    .selectOption("armored");
  await expect(page.locator("[data-train=apc] small")).toHaveText("$750");
  await page.locator("[data-train=apc]").click();
  await page.locator("[data-game=save]").click();
  const built = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("myos-battle-manual-v1")).entities.filter(
      (e) => e.type === "apc",
    ),
  );
  expect(built.at(-1).design).toBe("armored");
  expect(built.at(-1).hp).toBe(780);
  expect(errors).toEqual([]);
});
test("recon can be sent to a precise area through the tactical map and saves its destination", async ({
  page,
}) => {
  await savedGame(page);
  await page.locator("[data-select-type=recon]").click();
  await page.locator("[data-ability=recon]").click();
  const map = page.locator(".battle-minimap");
  const position = await map.evaluate(element => {
    const svg = element.querySelector("svg").getBoundingClientRect();
    const button = element.getBoundingClientRect();
    return { x: svg.x - button.x - element.clientLeft + svg.width * .82, y: svg.y - button.y - element.clientTop + svg.height * .76 };
  });
  await map.click({
    position,
    modifiers: ["Shift"],
  });
  await page.locator("[data-game=save]").click();
  const plane = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("myos-battle-manual-v1")).entities.find(
      (e) => e.type === "recon",
    ),
  );
  expect(plane.recon.x).toBeCloseTo(820, -1);
  expect(plane.recon.y).toBeCloseTo(471, -1);
  await expect(page.locator(".rts-message")).toContainText("استطلاع");
});
for (const size of [
  { width: 1280, height: 800 },
  { width: 900, height: 650 },
]) {
  test(`desktop panel and canvas fill the same available height at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await savedGame(page);
    const canvas = await page.locator("canvas").boundingBox(),
      panel = await page.locator(".rts-panel").boundingBox();
    expect(Math.abs(canvas.y - panel.y)).toBeLessThan(2);
    expect(Math.abs(canvas.height - panel.height)).toBeLessThan(2);
    expect(canvas.height).toBeGreaterThan(240);
    expect(canvas.y + canvas.height).toBeLessThan(size.height - 58);
    await page.locator('[data-panel-jump="النقل"]').click();
    await expect(
      page.getByRole("combobox", { name: "الناقلة المستهدفة" }),
    ).toBeInViewport();
    await expect(page.locator("[data-ability=board]")).toBeInViewport();
  });
}
test("phone can use transport controls with touch targets and return to the battlefield", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await savedGame(page);
  await page.locator("[data-game=commands]").click();
  await page.locator('[data-panel-jump="النقل"]').click();
  const button = page.locator("[data-ability=board]");
  await expect(button).toBeInViewport();
  expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.locator("[data-select-type=soldier]").click();
  await button.click();
  await expect(page.locator(".unit-status")).toContainText("داخل الناقلات: 2");
  await page.locator("[data-game=commands]").click();
  await expect(page.locator(".rts-panel")).toBeHidden();
  expect((await page.locator("canvas").boundingBox()).height).toBeGreaterThan(
    300,
  );
});
test("campaign lists ten operations and an existing eight-operation save starts the new recon map", async ({
  page,
}) => {
  const career = initialCareer();
  career.completed = OPERATIONS.slice(0, 8).map((o) => o.id);
  await page.addInitScript(
    (data) => localStorage.setItem("myos-career-v1", JSON.stringify(data)),
    career,
  );
  await enterDesktop(page);
  await page.locator("[data-task=strategy]").click();
  await page.locator(".career-details summary").click();
  await expect(page.locator(".operation-list button")).toHaveCount(10);
  await page.locator("[data-career=start]").click();
  await expect(page.locator(".mission-objective")).toContainText("استطلاع");
  await expect(
    page.getByRole("combobox", { name: "اختيار الخريطة", exact: true }),
  ).toHaveValue("watchtower");
  await expect(page.locator(".career-progress")).toContainText("8/10");
});
