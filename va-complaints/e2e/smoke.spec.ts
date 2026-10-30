import { expect, test } from "@playwright/test";

// Phase 0 smoke: the shell renders with branding and the version chip.
// Extended in phase 6 to cover login, register, acknowledge, final response and report export.
test("app shell renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Complaints Management" })).toBeVisible();
  await expect(page.getByAltText("Van Ameyde")).toBeVisible();
  await expect(page.getByTitle("Build version and environment")).toBeVisible();
});
