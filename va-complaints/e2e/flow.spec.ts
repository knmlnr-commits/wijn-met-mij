import { expect, test } from "@playwright/test";

/**
 * Main flow against a seeded Supabase (local `supabase start` in CI, or the sandbox):
 * login, register, acknowledge, final response, report export. Needs the dev login switch
 * and the demo users; skipped unless E2E_FULL=1.
 */
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 with a seeded Supabase to run the main flow");

test("handler registers, acknowledges and answers a complaint, then exports the report", async ({ page }) => {
  const name = `E2E Complainant ${Date.now()}`;

  await page.goto("/login");
  await page.getByRole("button", { name: "Handler", exact: true }).click();
  try {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 20_000 });
  } catch {
    // Say what the page showed instead, so a failure in CI can be diagnosed from the log.
    throw new Error(`Dashboard not reached after dev login. URL: ${page.url()}\nPage text:\n${(await page.locator("body").innerText()).slice(0, 1500)}`);
  }

  await page.goto("/register");
  await page.getByLabel("Complaint type (required)").selectOption({ label: "Zurich" });
  await page.getByLabel("Complainant name (required)").fill(name);
  await page.getByLabel("Summary of the complaint (required)").fill("Synthetic end to end test complaint.");
  await expect(page.getByText("Final response deadline")).toBeVisible();
  await page.getByRole("button", { name: "Register complaint" }).first().click();

  await expect(page).toHaveURL(/\/complaints\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
  await expect(page.getByLabel("Next step")).toContainText("Send the acknowledgement");

  await page.getByRole("button", { name: "Record acknowledgement" }).click();
  await expect(page.getByText("Acknowledgement recorded.")).toBeVisible();
  await expect(page.getByText("Acknowledgement sent", { exact: true })).toBeVisible();

  const actions = page.getByLabel("Actions");
  const finalForm = actions.locator("details", { hasText: "Send final response" });
  if (!(await finalForm.getAttribute("open"))) await finalForm.locator("summary").click();
  await finalForm.getByLabel("Outcome (required)").selectOption({ label: "Not upheld" });
  await finalForm.getByRole("button", { name: "Record final response" }).click();
  await expect(page.getByText("Final response sent", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Next step")).toContainText("Close the complaint");
  await expect(page.locator("#notifications")).toContainText("Final response");

  await page.goto("/reports");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^complaints-mi-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/);
});
