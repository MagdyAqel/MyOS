import { test, expect } from "@playwright/test";
async function openArena(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "الدخول الآن", exact: true }).click();
  await page.locator("[data-task=arena]").click();
  await page.locator(".arena-config summary").click();
  await page
    .getByRole("textbox", { name: "عنوان خادم اللعب", exact: true })
    .fill("http://127.0.0.1:8787");
}
test("two separate browsers join a private room, command their own armies and reconnect without touching solo saves", async ({
  browser,
}) => {
  const hostContext = await browser.newContext(),
    guestContext = await browser.newContext(),
    thirdContext = await browser.newContext();
  const host = await hostContext.newPage(),
    guest = await guestContext.newPage(),
    third = await thirdContext.newPage();
  await openArena(host);
  await host.evaluate(() =>
    localStorage.setItem("myos-note", "حفظ فردي يبقى محليًا"),
  );
  await host.locator("[data-arena=create]").click();
  await expect(host.locator(".arena-players")).toContainText(
    "اللاعب الأول متصل",
  );
  const invitation = await host
    .getByRole("textbox", { name: "رابط دعوة صديقك", exact: true })
    .inputValue();
  await host.locator("[data-arena=ready]").click();
  await openArena(guest);
  await guest
    .getByRole("textbox", { name: "رمز الغرفة أو رابط الدعوة", exact: true })
    .fill(invitation);
  await guest.locator("[data-arena=join]").click();
  await expect(guest.locator(".arena-players")).toContainText(
    "اللاعب الثاني متصل",
  );
  await guest.locator("[data-arena=ready]").click();
  await expect(host.locator(".arena-status")).toContainText("المواجهة جارية");
  await expect(guest.locator(".arena-status")).toContainText("المواجهة جارية");
  await openArena(third);
  await third
    .getByRole("textbox", { name: "رمز الغرفة أو رابط الدعوة", exact: true })
    .fill(invitation);
  await third.locator("[data-arena=join]").click();
  await expect(third.locator(".arena-status")).toContainText("ممتلئة");
  for (const page of [host, guest]) {
    await page.locator("[data-arena=play]").click();
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-renderer",
      "webgl",
    );
    await expect(page.locator(".online-match-status")).toContainText(
      "المواجهة جارية",
    );
    await page.locator("[data-build=power]").click();
    await page.locator("[data-game=autoplace]").click();
    await expect(page.locator("[data-stat=cash]")).toHaveText("$2100");
    await expect(page.locator("[data-game=save]")).toBeDisabled();
    await expect(page.locator("[data-game=pause]")).toBeDisabled();
  }
  await host.locator("[data-build=factory]").click();
  await host.locator("[data-game=autoplace]").click();
  await host
    .getByRole("combobox", { name: "تصميم ناقلة الجند" })
    .selectOption("armored");
  await host.locator("[data-train=apc]").click();
  await expect(host.locator("[data-stat=cash]")).toHaveText("$700");
  await host.locator("[data-select-type=soldier]").click();
  await host.locator("[data-ability=board]").click();
  await expect(host.locator(".unit-status")).toContainText("داخل الناقلات: 2", {
    timeout: 10000,
  });
  await expect(host.locator(".unit-status")).toContainText("المحدد: 0");
  await host.locator("[data-ability=unload]").click();
  await expect(host.locator(".unit-status")).toContainText("داخل الناقلات: 0");
  await host.locator("[data-tactic=suggest-hq]").click();
  await expect(host.locator(".hq-status")).toContainText(/تجهيز|يتحرك/);
  expect(await host.evaluate(() => localStorage.getItem("myos-note"))).toBe(
    "حفظ فردي يبقى محليًا",
  );
  expect(
    await host.evaluate(() => localStorage.getItem("myos-battle-auto-v1")),
  ).toBeNull();
  const session = await guest.evaluate(() =>
    sessionStorage.getItem("myos-online-session-v1"),
  );
  await guestContext.close();
  await expect(host.locator(".online-match-status")).toContainText(
    "انقطع اتصال الخصم",
  );
  const returningContext = await browser.newContext();
  await returningContext.addInitScript(
    (session) => sessionStorage.setItem("myos-online-session-v1", session),
    session,
  );
  const returning = await returningContext.newPage();
  await openArena(returning);
  await returning.locator("[data-arena=resume]").click();
  await expect(returning.locator(".arena-status")).toContainText(
    "المواجهة جارية",
  );
  await expect(host.locator(".online-match-status")).toContainText(
    "المواجهة جارية",
  );
  await returningContext.close();
  await hostContext.close();
  await thirdContext.close();
});
test("room API rejects unapproved web origins", async ({ request }) => {
  const response = await request.post("http://127.0.0.1:8787/rooms", {
    headers: { Origin: "https://unapproved.example" },
    data: { stage: 0, map: "dunes" },
  });
  expect(response.status()).toBe(403);
});

test("large-map rooms, custom funds, countdown, surrender, rematch and army attacks work across two browsers", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const host = await a.newPage(),
    guest = await b.newPage();
  try {
    await openArena(host);
    await host
      .getByRole("textbox", { name: "اسم القائد", exact: true })
      .fill("Magdy");
    await host
      .getByRole("spinbutton", { name: "مال بداية المواجهة", exact: true })
      .fill("15000");
    await host
      .getByLabel("خريطة المواجهة", { exact: true })
      .selectOption("great-divide");
    await host.locator("[data-arena=create]").click();
    await expect(host.locator(".arena-qr svg")).toBeVisible();
    const invitation = await host
      .getByRole("textbox", { name: "رابط دعوة صديقك", exact: true })
      .inputValue();
    expect(invitation).not.toContain("token");
    await openArena(guest);
    await guest
      .getByRole("textbox", { name: "اسم القائد", exact: true })
      .fill("Wing");
    await guest
      .getByRole("textbox", { name: "رمز الغرفة أو رابط الدعوة", exact: true })
      .fill(invitation);
    await guest.locator("[data-arena=join]").click();
    await expect(host.locator(".arena-latency")).toContainText("Magdy × Wing");
    await expect(guest.locator(".arena-latency")).toContainText("$15000");
    await host.locator("[data-arena=ready]").click();
    await guest.locator("[data-arena=ready]").click();
    await expect(host.locator(".arena-status")).toContainText(
      "تبدأ المواجهة خلال",
    );
    await expect(host.locator(".arena-status")).toContainText("المواجهة جارية");
    await expect(guest.locator(".arena-latency")).toContainText(/\d+ ms/);
    await guest.setViewportSize({ width: 390, height: 844 });
    for (const page of [host, guest]) {
      await page.locator("[data-arena=play]").click();
      await expect(page.locator("[data-stat=cash]")).toHaveText("$15000");
      await expect(page.locator("[data-game=configure]")).toBeDisabled();
      await expect(page.locator(".battle-minimap svg")).toHaveAttribute(
        "viewBox",
        "0 0 1600 1000",
      );
    }
    const bounds = await host.locator(".game-window").boundingBox();
    expect(bounds.x).toBe(0);
    expect(bounds.y).toBe(0);
    expect(bounds.width).toBe(1280);

    await host.screenshot({ path: "/tmp/MyOS-4.3-online.png" });
    expect(
      await guest.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (await guest.locator("canvas").boundingBox()).height,
    ).toBeGreaterThan(250);
    await guest.screenshot({ path: "/tmp/MyOS-4.3-mobile.png" });
    await guest.locator("[data-online=surrender]").click();
    await expect(host.locator(".rts-result")).toContainText("انتصار");
    await expect(guest.locator(".rts-result")).toContainText("انتهت المهمة");
    await host.locator("[data-online=rematch]").click();
    await expect(host.locator("[data-online=rematch]")).toBeDisabled();
    await expect(guest.locator(".rts-result")).toContainText("انتهت المهمة");
    await guest.locator("[data-online=rematch]").click();
    await expect(host.locator(".online-match-status")).toContainText(
      "تبدأ المواجهة خلال",
    );
    await expect(guest.locator(".online-match-status")).toContainText(
      "المواجهة جارية",
    );
    for (const page of [host, guest]) {
      await expect(page.locator("[data-stat=cash]")).toHaveText("$15000");
      await expect(page.locator("[data-stat=army]")).toContainText("المحدد 0");
    }
    // A hidden enemy HQ must not turn the quick-attack button into a no-op.
    for (const [page, direction] of [
      [host, 1],
      [guest, -1],
    ]) {
      const troop = page
        .locator('.battle-minimap circle[r="9"][fill="#5dd6ff"]')
        .first();
      const before = Number(await troop.getAttribute("cx"));
      await page.locator("[data-game=select]").click();
      await page.locator("[data-game=attack]").click();
      await expect(page.locator(".rts-message")).toContainText("أمر هجوم");
      await expect
        .poll(
          async () =>
            direction * (Number(await troop.getAttribute("cx")) - before),
          { timeout: 10000 },
        )
        .toBeGreaterThan(10);
    }
  } finally {
    await a.close();
    await b.close();
  }
});
