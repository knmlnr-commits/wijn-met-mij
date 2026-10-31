import { expect, test } from "@playwright/test";

// Phase 3 smoke: protected pages send visitors to sign in, and the login page offers the
// configured methods. Extended in phase 6 to cover login, register, acknowledge, final response
// and report export against a seeded Supabase project.

test("a visitor without a session is sent to the login page", async ({ page }) => {
  await page.goto("/complaints/some-id");
  await expect(page).toHaveURL(/\/login\?next=%2Fcomplaints%2Fsome-id$/);
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByAltText("Van Ameyde")).toBeVisible();
  await expect(page.getByTitle("Build version and environment")).toBeVisible();
});

test("the login page offers password and email link sign in, without dev login or Microsoft by default", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in with your password" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Or get a sign in link by email" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dev login" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign in with Microsoft" })).toHaveCount(0);
});

test("the login page ignores an off site redirect target", async ({ page }) => {
  await page.goto("/login?next=https://evil.example");
  await expect(page.locator('input[name="next"]').first()).toHaveValue("/");
});
