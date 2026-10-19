import { test, expect } from "@playwright/test";
import { enterDesktop } from "./helpers.js";
test("notebook searches titles and text without discarding saved notes", async ({
  page,
}) => {
  await enterDesktop(page);
  await page.locator('[data-task="notes"]').click();
  await page.getByRole("textbox", { name: "عنوان الملاحظة" }).fill("المشروع");
  await page
    .getByRole("textbox", { name: "نص الملاحظة" })
    .fill("موعد التسليم يوم الخميس");
  await page.getByRole("button", { name: "ملاحظة جديدة", exact: true }).click();
  await page.getByRole("textbox", { name: "عنوان الملاحظة" }).fill("الرحلة");
  await page.getByRole("textbox", { name: "نص الملاحظة" }).fill("زيارة البحر");
  await page
    .getByRole("textbox", { name: "البحث في الملاحظات" })
    .fill("الخميس");
  await expect(page.locator(".notes-sidebar nav button")).toHaveCount(1);
  await page.locator(".notes-sidebar nav button").click();
  await expect(page.getByRole("textbox", { name: "نص الملاحظة" })).toHaveValue(
    "موعد التسليم يوم الخميس",
  );
  await page.getByRole("textbox", { name: "البحث في الملاحظات" }).fill("");
  await expect(page.locator(".notes-sidebar nav button")).toHaveCount(2);
});
test("files support folders, durable text editing, download, trash, restore and permanent deletion", async ({
  page,
}) => {
  await enterDesktop(page);
  await page.locator('[data-task="files"]').click();
  await page.getByRole("button", { name: "مجلد جديد", exact: true }).click();
  await page
    .getByRole("textbox", { name: "اسم العنصر الجديد" })
    .fill("مشاريعي");
  await page
    .locator(".file-create")
    .getByRole("button", { name: "إنشاء", exact: true })
    .click();
  await page
    .locator(".file-items")
    .getByRole("button", { name: "مشاريعي", exact: true })
    .click();
  await page.getByRole("button", { name: "ملف جديد", exact: true }).click();
  await page
    .getByRole("textbox", { name: "اسم العنصر الجديد" })
    .fill("خطة.txt");
  await page
    .locator(".file-create")
    .getByRole("button", { name: "إنشاء", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "محتوى الملف" })
    .fill("نص محفوظ فعليًا");
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "تنزيل الملف", exact: true }).click();
  expect((await waiting).suggestedFilename()).toBe("خطة.txt");
  await page.reload();
  await page.getByRole("button", { name: "الدخول الآن", exact: true }).click();
  await page.locator('[data-task="files"]').click();
  await page
    .locator(".file-items")
    .getByRole("button", { name: "نقل مشاريعي للسلة", exact: true })
    .click();
  await page.locator('[data-folder="trash"]').click();
  await page
    .getByRole("button", { name: "استعادة مشاريعي", exact: true })
    .click();
  await page.locator('[data-folder="root"]').click();
  await page
    .locator(".file-items")
    .getByRole("button", { name: "مشاريعي", exact: true })
    .click();
  await page
    .locator(".file-items")
    .getByRole("button", { name: "خطة.txt", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "محتوى الملف" })).toHaveValue(
    "نص محفوظ فعليًا",
  );
  await page.getByRole("button", { name: "نقل للسلة", exact: true }).click();
  await page.locator('[data-folder="trash"]').click();
  await page
    .getByRole("button", { name: "حذف دائم خطة.txt", exact: true })
    .click();
  await page
    .getByRole("button", { name: "تأكيد الحذف الدائم", exact: true })
    .click();
  await expect(page.locator(".file-items")).toContainText("السلة فارغة");
});
test("battle save restores resources and offers missions, difficulty, fog and logistics", async ({
  page,
}) => {
  await enterDesktop(page);
  await page.locator('[data-task="strategy"]').click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await page.locator('[data-build="power"]').click();
  await page.locator('[data-game="autoplace"]').click();
  await expect(page.locator('[data-stat="cash"]')).toHaveText("$2100");
  const field = await page.locator("canvas").boundingBox();
  const command = await page.locator('[data-game="attack"]').boundingBox();
  expect(field.y + field.height).toBeLessThan(command.y);
  expect(command.y + command.height).toBeLessThanOrEqual(
    page.viewportSize().height - 59,
  );
  await page.locator('[data-game="save"]').click();
  await expect(page.locator(".battle-save-status")).toContainText("تم حفظ");
  await page.locator('[data-game="restart"]').click();
  await expect(page.locator('[data-stat="cash"]')).toHaveText("$2400");
  await page.locator('[data-game="resume"]').click();
  await expect(page.locator('[data-stat="cash"]')).toHaveText("$2100");
  await expect(page.locator(".rts-result")).toContainText("متوقفة");
  await page.locator('[data-game="fog"]').click();
  await expect(page.locator('[data-game="fog"]')).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page
    .getByRole("combobox", { name: "نوع المهمة" })
    .selectOption("escort");
  await page
    .getByRole("combobox", { name: "مستوى الصعوبة" })
    .selectOption("easy");
  await expect(page.locator(".mission-objective")).toContainText("القافلة");
  await page.locator('[data-game="select"]').click();
  await page.locator('[data-game="service"]').click();
  await expect(page.locator(".rts-message")).toContainText("إعادة التسليح");
});
test("optional cloud client reviews uploads and restores with local undo using a mocked service", async ({
  page,
}) => {
  let revision = 0,
    snapshot = null;
  const id = "12345678-1234-1234-1234-123456789abc";
  await page.route("https://demo-project.supabase.co/**", async (route) => {
    const url = route.request().url();
    let data;
    if (url.includes("/auth/"))
      data = {
        access_token: "test-token",
        refresh_token: "test-refresh",
        expires_in: 3600,
        user: { id, email: "test@example.com" },
      };
    else if (url.includes("/rpc/")) {
      const body = route.request().postDataJSON();
      if (body.expected_revision !== revision) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: "{}",
        });
        return;
      }
      snapshot = body.payload;
      data = [{ new_revision: ++revision, saved_at: "today" }];
    } else
      data = snapshot
        ? [{ revision, updated_at: "today", data: snapshot }]
        : [];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await enterDesktop(page);
  await page.locator('[data-task="notes"]').click();
  await page.getByRole("textbox", { name: "نص الملاحظة" }).fill("نسخة محلية");
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await page.locator('.desktop-icons [data-open="cloud"]').click();
  const config = page.locator(".cloud-config");
  await config.locator("[name=url]").fill("https://demo-project.supabase.co");
  await config
    .locator("[name=key]")
    .fill("sb_publishable_abcdefghijklmnopqrstuvwxyz");
  await config.getByRole("button").click();
  const auth = page.locator(".cloud-auth");
  await auth.locator("[name=email]").fill("test@example.com");
  await auth.locator("[name=password]").fill("test-password");
  await auth.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page.locator(".cloud-status")).toContainText("تم الدخول");
  await page.locator('[data-cloud="inspect"]').click();
  await expect(page.locator(".cloud-summary")).toContainText("لا توجد");
  await page.locator('[data-cloud="push"]').click();
  await expect(page.locator(".cloud-confirm")).toBeVisible();
  await page.locator('[data-cloud="confirm"]').click();
  await expect(page.locator(".cloud-status")).toContainText("أكدت السحابة");
  revision++;
  await page.locator('[data-cloud="push"]').click();
  await page.locator('[data-cloud="confirm"]').click();
  await expect(page.locator(".cloud-status")).toContainText("تعارض");
  const key = "myos-notebook-v2",
    book = JSON.parse(snapshot.datasets[key]);
  book.notes[0].text = "نسخة السحابة";
  snapshot.datasets[key] = JSON.stringify(book);
  await page.locator('[data-task="notes"]').click();
  await expect(page.getByRole("textbox", { name: "نص الملاحظة" })).toHaveValue(
    "نسخة محلية",
  );
  await page.locator('[data-task="cloud"]').click();
  await page.locator('[data-cloud="pull"]').click();
  await page.locator('[data-cloud="confirm"]').click();
  await expect(page.locator(".cloud-status")).toContainText("تمت الاستعادة");
  await expect(page.getByRole("textbox", { name: "نص الملاحظة" })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("myos-notebook-v2")).notes[0].text,
    ),
  ).toBe("نسخة السحابة");
  await page.locator('[data-cloud="undo"]').click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("myos-notebook-v2")).notes[0].text,
    ),
  ).toBe("نسخة محلية");
  await page.locator('[data-cloud="logout"]').click();
  await expect(page.locator('[data-cloud="push"]')).toBeDisabled();
});

test("closing and reopening a battle resumes its automatic save and reports quota failures", async ({
  page,
}) => {
  await enterDesktop(page);
  await page.locator('[data-task="strategy"]').click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await page.locator('[data-build="power"]').click();
  await page.locator('[data-game="autoplace"]').click();
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("myos-battle-auto-v1")).cash,
    ),
  ).toBe(2100);
  await page.locator('[data-task="strategy"]').click();
  await page.locator('[data-game="resume"]').click();
  await expect(page.locator('[data-stat="cash"]')).toHaveText("$2100");
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === "myos-battle-manual-v1")
        throw new DOMException("Full", "QuotaExceededError");
      return write.call(this, k, v);
    };
  });
  await page.locator('[data-game="save"]').click();
  await expect(page.locator(".battle-save-status")).toContainText("تعذّر");
});
