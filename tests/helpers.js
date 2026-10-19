export async function enterDesktop(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "الدخول الآن", exact: true }).click();
}
