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

  // A synthetic PDF goes along with the acknowledgement.
  await page
    .getByLabel("Actions")
    .locator("details", { hasText: "Send acknowledgement" })
    .getByLabel("Attachments to send along (optional)")
    .setInputFiles({ name: "synthetic-terms.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 synthetic end to end test file") });
  await page.getByRole("button", { name: "Record acknowledgement" }).click();
  await expect(page.getByText("Acknowledgement recorded. A letter draft with 1 attachment is ready")).toBeVisible();
  await expect(page.locator("#notifications").getByRole("link", { name: "synthetic-terms.pdf" })).toBeVisible();
  await expect(page.getByText("Attachment added to the acknowledgement letter: synthetic-terms.pdf")).toBeVisible();
  await expect(page.getByText("Acknowledgement recorded", { exact: true })).toBeVisible();

  const actions = page.getByLabel("Actions");
  const finalForm = actions.locator("details", { hasText: "Send final response" });
  // The open attribute is an empty string when set, so read the property instead.
  if (!(await finalForm.evaluate((el) => (el as HTMLDetailsElement).open))) await finalForm.locator("summary").click();
  await finalForm.getByLabel("Outcome (required)").selectOption({ label: "Not upheld" });
  await finalForm.getByRole("button", { name: "Record final response" }).click();
  await expect(page.getByText("Final response recorded", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Next step")).toContainText("Close the complaint");
  await expect(page.locator("#notifications")).toContainText("Final response");

  await page.goto("/reports");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^complaints-mi-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}-all-insurers\.csv$/);
});
