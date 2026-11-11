import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import {
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from "../../scripts/release-test/seed-emulators";

async function signIn(page: Page) {
  await page.goto("/signin");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.getByLabel("Email").fill(OWNER_EMAIL);
    await page.getByLabel("Password").fill(OWNER_PASSWORD);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    try {
      await page.waitForURL(/\/dashboard$/, { timeout: 45_000 });
      break;
    } catch (error) {
      if (attempt === 1 || !/\/signin$/.test(page.url())) throw error;
    }
  }
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Dashboard", { exact: true }).first()).toBeVisible();
}

test("authenticated owner release workflows stay isolated and preserve financial parity", async ({ page }) => {
  const externalRequests: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname) && !["data:", "blob:"].includes(url.protocol)) {
      externalRequests.push(route.request().url());
      await route.abort();
      return;
    }
    await route.continue();
  });

  await signIn(page);

  await page.goto("/reports");
  await page.getByRole("tab", { name: "Yearly" }).click();
  await expect(page.getByRole("region", { name: "Financial summary" })).toBeVisible();
  await expect(page.getByText("$1,200.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("$273.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("$927.00", { exact: true }).first()).toBeVisible();

  await page.goto("/reports/eoy");
  await expect(page.getByRole("heading", { name: "End-of-Year Report – 2026" })).toBeVisible();
  await expect(page.getByText("$1,200.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("$273.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("$927.00", { exact: true }).first()).toBeVisible();

  await page.goto("/budgets");
  await expect(page.getByRole("heading", { name: "Budgets" })).toBeVisible();
  await expect(page.getByText("November 2026", { exact: true })).toBeVisible();
  await expect(page.getByText("$103.00", { exact: true })).toHaveCount(2);

  await page.goto("/reports");
  await page.getByRole("tab", { name: "Advanced" }).click();
  await page.getByRole("button", { name: "Generate a new quarterly report" }).click();
  const quarterlyDialog = page.getByRole("dialog", { name: "Generate Quarterly Report" });
  await quarterlyDialog.getByRole("button", { name: /Reference date:/ }).click();
  for (const expectedMonth of ["July 2026", "June 2026", "May 2026", "April 2026", "March 2026", "February 2026"]) {
    await page.getByRole("button", { name: "Go to previous month" }).click();
    await expect(page.getByRole("grid", { name: expectedMonth })).toBeVisible();
  }
  await page.getByRole("grid", { name: "February 2026" }).getByRole("gridcell", { name: "15", exact: true }).click();
  await expect(quarterlyDialog.getByText("Q1 2026", { exact: false })).toBeVisible();
  await quarterlyDialog.getByRole("button", { name: "Generate Report" }).click();
  await expect(quarterlyDialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText("Financial Report - Q1 2026", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Covers Jan 1, 2026–Mar 31, 2026/)).toBeVisible();
  await expect(page.getByText("Totals reconciled")).toBeVisible();
  await expect(page.getByText("$170.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("$1,030.00", { exact: true }).first()).toBeVisible();

  await page.getByRole("tab", { name: "Yearly" }).click();
  await page.getByRole("combobox").filter({ hasText: "All accounts" }).click();
  await page.getByRole("button", { name: "Checking" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByText("$223.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("$977.00", { exact: true }).first()).toBeVisible();

  const firstExport = page.getByRole("button", { name: "Export yearly financial report" });
  await firstExport.click();
  await page.getByText("CSV File", { exact: true }).click();
  const csvDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const csvDownload = await csvDownloadPromise;
  const csvPath = await csvDownload.path();
  expect(csvPath).not.toBeNull();
  const csv = await readFile(csvPath!, "utf8");
  expect(csv).toContain("giving");
  expect(csv).toContain("1000");

  await firstExport.click();
  await page.getByText("PDF Document", { exact: true }).click();
  const pdfDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const pdfDownload = await pdfDownloadPromise;
  const pdfPath = await pdfDownload.path();
  expect(pdfPath).not.toBeNull();
  expect((await readFile(pdfPath!)).subarray(0, 4).toString()).toBe("%PDF");

  await page.getByRole("button", { name: "Add transaction" }).click();
  const transactionSheet = page.getByRole("dialog", { name: "New Transaction" });
  await transactionSheet.getByRole("radio", { name: "Expense" }).click();
  await transactionSheet.getByLabel("Description").fill("E2E Manual Expense");
  await transactionSheet.getByLabel("Amount").fill("25.50");
  await transactionSheet.getByRole("combobox").nth(1).click({ force: true });
  await page.getByRole("option", { name: "Supplies" }).click();
  await transactionSheet.getByRole("button", { name: "Create Transaction" }).click();
  await expect(transactionSheet).toBeHidden({ timeout: 45_000 });

  await page.goto("/transactions");
  const manualExpenseCell = page.getByRole("cell", { name: "E2E Manual Expense", exact: true });
  await expect(manualExpenseCell).toBeVisible();
  await manualExpenseCell.click();
  const editSheet = page.getByRole("dialog", { name: "Edit Transaction" });
  await editSheet.getByLabel("Amount").fill("26.50");
  await editSheet.getByRole("button", { name: "Save Changes" }).click();
  await expect(editSheet).toBeHidden({ timeout: 45_000 });
  await expect(page.getByRole("cell", { name: "-$26.50", exact: true })).toBeVisible();

  if (process.env.LEDGERLY_RULES_PROFILE === "proposed") {
    await page.getByRole("cell", { name: "recurring-actual", exact: true }).click();
    const protectedEditSheet = page.getByRole("dialog", { name: "Edit Transaction" });
    await protectedEditSheet.getByLabel("Amount").fill("104");
    await protectedEditSheet.getByRole("button", { name: "Save Changes" }).click();
    await expect(protectedEditSheet).toBeVisible();
    await expect(protectedEditSheet.getByLabel("Amount")).toHaveValue("104");
    await expect(protectedEditSheet.getByText(/permission|could not be saved/i)).toBeVisible();
    await protectedEditSheet.getByRole("button", { name: "Cancel" }).click();
    await expect(protectedEditSheet).toBeHidden();
  }

  await page.getByRole("button", { name: "Transfer", exact: true }).click();
  const transferSheet = page.getByRole("dialog", { name: /Transfer money/ });
  await transferSheet.getByLabel("Amount").fill("10");
  await transferSheet.getByLabel("Description").fill("E2E Transfer");
  await transferSheet.getByRole("button", { name: "Create transfer" }).click();
  await expect(transferSheet).toBeHidden({ timeout: 45_000 });

  await page.getByRole("button", { name: "Import", exact: true }).click();
  const importDialog = page.getByRole("dialog", { name: "Step 1: Upload CSV" });
  await importDialog.locator('input[type="file"]').setInputFiles({
    name: "release-import.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("date,description,credit,debit,category\n2026-03-01,E2E CSV Income,50,,Giving\n"),
  });
  await importDialog.getByRole("button", { name: "Upload & Continue" }).click();
  await page.getByRole("button", { name: "Review Data" }).click();
  await expect(page.getByRole("dialog", { name: "Step 3: Review & Confirm" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm & Import" }).click();
  await expect(page.getByRole("dialog", { name: "Step 3: Review & Confirm" })).toBeHidden({ timeout: 45_000 });
  await expect(page.getByRole("cell", { name: "E2E CSV Income" })).toBeVisible({ timeout: 30_000 });

  await page.goto("/receipt-scanner");
  await page.locator('input[type="file"]').setInputFiles({
    name: "synthetic-receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Scan with AI" }).click();
  await expect(page.getByText("Synthetic Receipt Vendor")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Create Transaction" }).click();
  const receiptSheet = page.getByRole("dialog", { name: "New Transaction" });
  await expect(receiptSheet.getByRole("textbox", { name: "Date" })).toHaveValue("02/20/2026");
  await receiptSheet.getByRole("radio", { name: "Expense" }).click();
  await receiptSheet.getByRole("combobox", { name: "Category" }).click();
  await page.getByRole("option", { name: "Supplies" }).click();
  await expect(receiptSheet.getByRole("combobox", { name: "Category" })).toContainText("Supplies");
  await receiptSheet.getByRole("button", { name: "Create Transaction" }).click();
  await expect(receiptSheet).toBeHidden({ timeout: 45_000 });
  await expect(page.getByText("Synthetic Receipt Vendor")).toBeHidden();

  await page.goto("/recurring");
  const confirmRecurring = page.getByRole("button", { name: "Confirm" }).first();
  await expect(confirmRecurring).toBeVisible({ timeout: 45_000 });
  await confirmRecurring.click();
  await expect(page.getByText("Confirmed links (1)")).toBeVisible();

  await page.goto("/settings");
  await page.getByLabel("Reporting time zone").selectOption("America/Chicago");
  await page.getByRole("button", { name: "Save time zone" }).click();
  await expect(page.getByText("Reporting time zone saved", { exact: true })).toBeVisible();

  const unexpectedExternalRequests = externalRequests.filter((requestUrl) => {
    const hostname = new URL(requestUrl).hostname;
    return hostname !== "fonts.googleapis.com" && hostname !== "fonts.gstatic.com";
  });
  expect(unexpectedExternalRequests).toEqual([]);
});
