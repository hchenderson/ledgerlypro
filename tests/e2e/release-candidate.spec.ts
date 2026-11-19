import { mkdir, readFile } from "node:fs/promises";

import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
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
      await page.waitForURL(/\/(?:dashboard|welcome)$/, { timeout: 45_000 });
      if (/\/welcome$/.test(page.url())) {
        // Auth and settings hydrate independently. The seeded account is
        // already onboarded, so let the authenticated app guard confirm it.
        await page.goto("/dashboard");
      }
      await page.waitForURL(/\/dashboard$/, { timeout: 45_000 });
      break;
    } catch (error) {
      if (attempt === 1 || !/\/signin$/.test(page.url())) throw error;
    }
  }
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Dashboard", { exact: true }).first()).toBeVisible();
}

const layoutOptions = [
  ["Clarified", "clarified"],
  ["Desk", "bookkeepers-desk"],
  ["Brief", "financial-brief"],
] as const;

async function chooseLayout(page: Page, label: (typeof layoutOptions)[number][0]) {
  await expect(page.getByTestId("view-switcher")).toBeVisible();
  const fullLabel =
    label === "Clarified"
      ? "Ledgerly Clarified"
      : label === "Desk"
        ? "Bookkeeper’s Desk"
        : "Financial Brief";
  if ((page.viewportSize()?.width ?? 1280) >= 640) {
    await page.getByRole("button", { name: label, exact: true }).click();
  } else {
    await page.getByRole("combobox", { name: "View" }).click();
    await page.getByRole("option", { name: fullLabel, exact: true }).click();
  }
  await expect(page.getByTestId("view-switcher")).toHaveAttribute("data-saving", "false");
  if ((page.viewportSize()?.width ?? 1280) >= 640) {
    await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  } else {
    await expect(page.getByRole("combobox", { name: "View" })).toContainText(fullLabel);
  }
}

function financialListenerStarts(page: Page) {
  const starts = new Set<string>();
  page.on("request", (request) => {
    if (!request.url().includes("/Listen/channel")) return;
    const body = request.postData() ?? "";
    let decoded = body;
    try {
      decoded = decodeURIComponent(body);
    } catch {}
    if (decoded.includes("addTarget")) {
      const targetIds = [...decoded.matchAll(/targetId[^0-9]{0,24}(\d+)/g)].map(
        (match) => match[1],
      );
      for (const targetId of targetIds) starts.add(targetId);
    }
  });
  return starts;
}

async function reportSnapshot(page: Page) {
  return page.getByTestId("report-financial-summary").evaluate((element) => ({
    income: element.getAttribute("data-total-income"),
    expenses: element.getAttribute("data-total-expenses"),
    net: element.getAttribute("data-net-income"),
    count: element.getAttribute("data-transaction-count"),
    budget: document.querySelector('[data-testid="report-budget-variance"]')?.getAttribute("data-budget-total"),
    actual: document.querySelector('[data-testid="report-budget-variance"]')?.getAttribute("data-actual-total"),
    variance: document.querySelector('[data-testid="report-budget-variance"]')?.getAttribute("data-variance-total"),
  }));
}

async function expectNoHorizontalOverflow(page: Page) {
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    offenders: [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: element.textContent?.trim().slice(0, 60) ?? "",
        right: Math.round(element.getBoundingClientRect().right),
        width: Math.round(element.getBoundingClientRect().width),
        className: typeof element.className === "string" ? element.className.slice(0, 100) : "",
      }))
      .filter((element) => element.right > window.innerWidth + 1)
      .sort((left, right) => right.right - left.right)
      .slice(0, 8),
  }));
  expect(result.overflow, JSON.stringify(result.offenders, null, 2)).toBeLessThanOrEqual(1);
}

async function hideNextDevChrome(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
}

test("production layouts preserve prepared data, page state, preference, and financial listeners", async ({ page }) => {
  test.skip(
    process.env.LEDGERLY_RULES_PROFILE !== "proposed",
    "The saved production-layout preference requires the proposed settings rule.",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  const listenerStarts = financialListenerStarts(page);
  await signIn(page);

  await page.goto("/recurring");
  const confirmRecurring = page.getByRole("button", { name: "Confirm" }).first();
  await expect(confirmRecurring).toBeVisible({ timeout: 90_000 });
  await confirmRecurring.click();
  await expect(page.getByText("Confirmed links (1)")).toBeVisible();
  await page.goto("/dashboard");
  await hideNextDevChrome(page);

  const screenshotDirectory = "artifacts/production-layouts";
  await mkdir(screenshotDirectory, { recursive: true });

  await expect(page.getByTestId("dashboard-outlook").first()).toBeVisible();
  await page.waitForTimeout(500);
  const dashboardListenerBaseline = listenerStarts.size;
  const postedCashValues: string[] = [];
  const outlookValues: Array<Record<string, string | null>> = [];
  for (const [label, layout] of layoutOptions) {
    await chooseLayout(page, label);
    const layoutRoot = page.locator(`[data-layout="${layout}"]`).first();
    await expect(layoutRoot).toBeVisible();
    await expect(page.locator("[data-layout]")).toHaveCount(1);
    postedCashValues.push(
      (await page.getByTestId("posted-cash").first().getAttribute("data-value")) ?? "",
    );
    outlookValues.push(await page.getByTestId("dashboard-outlook").evaluate((element) => ({
      income: element.getAttribute("data-projected-income"),
      expenses: element.getAttribute("data-projected-expenses"),
      net: element.getAttribute("data-projected-net"),
      ending: element.getAttribute("data-projected-ending-balance"),
    })));
    await page.screenshot({
      path: `${screenshotDirectory}/${layout}-dashboard-desktop.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(`[data-layout="${layout}"]`).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: `${screenshotDirectory}/${layout}-dashboard-mobile.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  expect(new Set(postedCashValues).size).toBe(1);
  expect(postedCashValues[0]).not.toBe("");
  expect(outlookValues[1]).toEqual(outlookValues[0]);
  expect(outlookValues[2]).toEqual(outlookValues[0]);
  expect(Object.values(outlookValues[0])).not.toContain(null);
  await page.waitForTimeout(300);
  expect(listenerStarts.size).toBe(dashboardListenerBaseline);

  await expect(page.locator('[data-layout="financial-brief"]').first()).toBeVisible();
  await page.reload();
  await hideNextDevChrome(page);
  await expect(page.locator('[data-layout="financial-brief"]').first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Brief", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/transactions");
  await hideNextDevChrome(page);
  await page.getByLabel("Category filter").click();
  await page.getByRole("option", { name: "Expense · Operations", exact: true }).click();
  const transactionIds = async () =>
    page.locator("[data-transaction-id]").evaluateAll((elements) =>
      [...new Set(elements.map((element) => element.getAttribute("data-transaction-id")))]
        .filter((value): value is string => Boolean(value))
        .sort(),
    );
  const operationIds = [
    "legacy-expectation",
    "other-account",
    "pending",
    "possible-transfer",
    "recurring-actual",
    "refund-credit",
    "refund-purchase",
    "removed",
    "split-expense",
  ];
  expect(await transactionIds()).toEqual(operationIds);
  for (const [label] of layoutOptions) {
    await chooseLayout(page, label);
    await expect(page.locator("[data-layout]")).toHaveCount(1);
    expect(await transactionIds()).toEqual(operationIds);
    await expect(page.getByLabel("Category filter")).toContainText("Operations");
  }

  await page.getByLabel("Search transactions").fill("recurring-actual");
  const briefIds = await transactionIds();
  expect(briefIds).toEqual(["recurring-actual"]);
  const transactionListenerBaseline = listenerStarts.size;

  await chooseLayout(page, "Desk");
  await expect(page.getByLabel("Search transactions")).toHaveValue("recurring-actual");
  expect(await transactionIds()).toEqual(briefIds);
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.screenshot({ path: `${screenshotDirectory}/bookkeepers-desk-transactions-laptop.png`, fullPage: true });
  await expectNoHorizontalOverflow(page);
  await page.locator('tr[data-transaction-id="recurring-actual"]').click();
  await expect(page.getByTestId("transaction-inspector")).toContainText("recurring-actual");
  const inspectorCategory = page.getByTestId("transaction-inspector").getByRole("combobox");
  await inspectorCategory.click();
  await page.getByRole("option", { name: "Operations > Fees", exact: true }).click();
  await expect(inspectorCategory).toContainText("Fees");
  await chooseLayout(page, "Clarified");
  await expect(page.getByLabel("Search transactions")).toHaveValue("recurring-actual");
  expect(await transactionIds()).toEqual(briefIds);
  await chooseLayout(page, "Desk");
  await expect(page.getByTestId("transaction-inspector")).toContainText("recurring-actual");
  await expect(page.getByTestId("transaction-inspector").getByRole("combobox")).toContainText("Fees");
  await page.getByLabel("Search transactions").fill("");
  const recurringRow = page.locator('tr[data-transaction-id="recurring-actual"]');
  await recurringRow.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("transaction-inspector")).not.toContainText("recurring-actual");
  await page.getByLabel("Search transactions").fill("recurring-actual");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [label, layout] of layoutOptions) {
    await chooseLayout(page, label);
    await expect(page.locator(`[data-layout="${layout}"]`)).toBeVisible();
    await expect(page.getByLabel("Search transactions")).toHaveValue("recurring-actual");
    await expectNoHorizontalOverflow(page);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(300);
  expect(listenerStarts.size).toBe(transactionListenerBaseline);

  await page.goto("/reports");
  await page.getByRole("tab", { name: "Yearly" }).click();
  await expect(page.getByTestId("report-financial-summary")).toBeVisible();
  const reportListenerBaseline = listenerStarts.size;
  const reportSnapshots = [];
  const reportCsvExports: string[] = [];
  for (const [label, layout] of layoutOptions) {
    await chooseLayout(page, label);
    await expect(page.locator(`[data-layout="${layout}"]`).first()).toBeVisible();
    await expect(page.locator("[data-layout]")).toHaveCount(1);
    reportSnapshots.push(await reportSnapshot(page));
    await page.getByRole("button", { name: "Export yearly financial report" }).click();
    await page.getByText("CSV File", { exact: true }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const download = await downloadPromise;
    const csvPath = await download.path();
    expect(csvPath).not.toBeNull();
    reportCsvExports.push(await readFile(csvPath!, "utf8"));
  }
  expect(reportSnapshots[1]).toEqual(reportSnapshots[0]);
  expect(reportSnapshots[2]).toEqual(reportSnapshots[0]);
  expect(reportSnapshots[0]).toEqual({
    income: "1200",
    expenses: "273",
    net: "927",
    count: "7",
    budget: expect.any(String),
    actual: expect.any(String),
    variance: expect.any(String),
  });
  expect(reportCsvExports[1]).toBe(reportCsvExports[0]);
  expect(reportCsvExports[2]).toBe(reportCsvExports[0]);
  expect(reportCsvExports[0]).toContain("split-expense");
  expect(reportCsvExports[0]).toContain("refund-purchase");
  expect(reportCsvExports[0]).toContain("refund-credit");
  expect(reportCsvExports[0]).toContain("recurring-actual");
  expect(reportCsvExports[0]).not.toContain("legacy-expectation");
  expect(reportCsvExports[0]).not.toContain("possible-transfer");
  expect(reportCsvExports[0]).not.toContain("pending");
  expect(reportCsvExports[0]).not.toContain("removed");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [label, layout] of layoutOptions) {
    await chooseLayout(page, label);
    await expect(page.locator(`[data-layout="${layout}"]`)).toBeVisible();
    await expect(page.getByTestId("report-financial-summary")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(300);
  expect(listenerStarts.size).toBe(reportListenerBaseline);

  await chooseLayout(page, "Clarified");
});

async function latestPortalPin(email: string, excludedChallengeIds: string[] = []) {
  const app = initializeApp({ projectId: "ledgerly-release-demo" }, `portal-e2e-${Date.now()}-${Math.random()}`);
  try {
    const deadline = Date.now() + 5_000;
    do {
      const snapshot = await getFirestore(app).collection("budgetPortalTestEmails").get();
      const messages = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() } as {
          id: string;
          kind?: string;
          to?: string;
          text?: string;
          createdAt?: { toMillis?: () => number };
        }))
        .filter((message) => message.kind === "pin" && message.to === email && !excludedChallengeIds.includes(message.id))
        .sort((first, second) => Number(second.createdAt?.toMillis?.() ?? 0) - Number(first.createdAt?.toMillis?.() ?? 0));
      const message = messages[0];
      const match = typeof message?.text === "string" ? message.text.match(/\b(\d{6})\b/) : null;
      if (message && match) return { pin: match[1], challengeId: message.id };
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    throw new Error(`No captured PIN email was found for ${email}.`);
  } finally {
    await deleteApp(app);
  }
}

async function resetPortalPinCooldown(challengeId: string) {
  const app = initializeApp({ projectId: "ledgerly-release-demo" }, `portal-cooldown-${Date.now()}-${Math.random()}`);
  try {
    const db = getFirestore(app);
    const states = await db.collection("budgetPortalPinStates").where("activeChallengeId", "==", challengeId).get();
    expect(states.size).toBe(1);
    await states.docs[0].ref.update({ nextAllowedAt: Timestamp.fromMillis(0) });
  } finally {
    await deleteApp(app);
  }
}

async function expirePortalChallenge(challengeId: string) {
  const app = initializeApp({ projectId: "ledgerly-release-demo" }, `portal-expire-${Date.now()}-${Math.random()}`);
  try {
    await getFirestore(app).collection("budgetPortalChallenges").doc(challengeId).update({
      expiresAt: Timestamp.fromMillis(Date.now() - 1),
    });
  } finally {
    await deleteApp(app);
  }
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
  await chooseLayout(page, "Clarified");

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
  await expect(page.getByRole("cell", { name: "E2E CSV Income", exact: true })).toBeVisible({ timeout: 30_000 });

  await page.goto("/receipt-scanner");
  await page.locator('input[type="file"]').setInputFiles({
    name: "synthetic-receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Scan with AI" }).click();
  await expect(page.getByText("Synthetic Receipt Vendor")).toBeVisible({ timeout: 75_000 });
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
  const confirmedRecurring = page.getByText("Confirmed links (1)");
  const confirmRecurring = page.getByRole("button", { name: "Confirm" }).first();
  await expect
    .poll(async () =>
      (await confirmedRecurring.isVisible()) || (await confirmRecurring.isVisible()),
      { timeout: 90_000 },
    )
    .toBe(true);
  if (await confirmRecurring.isVisible()) {
    await confirmRecurring.click();
  }
  await expect(confirmedRecurring).toBeVisible();

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

test("owner grants and revokes read-only PIN budget access", async ({ page, browser }) => {
  const leaderTwo = "leader-two@ledgerly.test";
  await signIn(page);
  await page.goto("/settings/budget-access");
  await expect(page.getByRole("heading", { name: "Budget Access" })).toBeVisible();

  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Display name (optional)").fill("Owner-email leader");
  await page.getByText("Operations", { exact: true }).click();
  await page.getByText("Operations > Supplies", { exact: true }).click();
  await page.getByRole("button", { name: "Preview permitted summary" }).click();
  await expect(page.getByRole("dialog", { name: "Leader preview" }).getByText("Operations", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Grant access" }).click();
  await expect(page.getByText(/Access saved/)).toBeVisible();

  await page.getByLabel("Email").fill(leaderTwo);
  await page.getByLabel("Display name (optional)").fill("Second leader");
  await page.getByText("Operations > Supplies", { exact: true }).click();
  await page.getByRole("button", { name: "Grant access" }).click();
  await expect(page.getByText(leaderTwo)).toBeVisible();

  const viewerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const viewerPage = await viewerContext.newPage();
  await viewerPage.goto("/signin");
  await viewerPage.getByRole("button", { name: "View a budget with a code" }).click();
  await viewerPage.getByLabel("Invited email").fill(OWNER_EMAIL);
  await viewerPage.getByRole("button", { name: "Email my code" }).click();
  await expect(viewerPage.getByText(/If budget access is available/)).toBeVisible();
  const ownerEmailCode = await latestPortalPin(OWNER_EMAIL);
  const incorrectCode = ownerEmailCode.pin === "000000" ? "000001" : "000000";
  const incorrect = await viewerPage.request.post("/api/budget-portal/pin/verify", {
    data: { challengeId: ownerEmailCode.challengeId, code: incorrectCode },
  });
  expect(incorrect.status()).toBe(401);
  await viewerPage.getByLabel("One-time code").fill(ownerEmailCode.pin);
  const tokenResponsePromise = viewerPage.waitForResponse((response) => response.url().endsWith("/api/budget-portal/pin/verify") && response.status() === 200);
  await viewerPage.getByRole("button", { name: "Open budget portal" }).click();
  const issued = await (await tokenResponsePromise).json() as { customToken: string };
  await expect(viewerPage).toHaveURL(/\/budgets\/view$/);
  await expect(viewerPage.getByText("Operations", { exact: true })).toBeVisible();
  await expect(viewerPage.getByText("Operations > Supplies", { exact: true })).toBeVisible();
  await expect(viewerPage.getByText(/overlap by category/i)).toBeVisible();

  const reuse = await viewerPage.request.post("/api/budget-portal/pin/verify", {
    data: { challengeId: ownerEmailCode.challengeId, code: ownerEmailCode.pin },
  });
  expect(reuse.status()).toBe(401);

  const emulatorSignIn = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-api-key", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: issued.customToken, returnSecureToken: true }),
  });
  const viewerIdentity = await emulatorSignIn.json() as { idToken: string };
  expect(emulatorSignIn.ok).toBe(true);
  const forbiddenOwnerApi = await fetch("http://127.0.0.1:9002/api/budget-portal/access", {
    headers: { authorization: `Bearer ${viewerIdentity.idToken}` },
  });
  expect(forbiddenOwnerApi.status).toBe(401);

  const beforeRefreshResponse = viewerPage.waitForResponse((response) => response.url().endsWith("/api/budget-portal/summary"));
  await viewerPage.getByRole("button", { name: "Refresh" }).click();
  const beforeRefresh = await (await beforeRefreshResponse).json() as { budgets: Array<{ name: string; spendingMinor: number }> };
  const beforeSupplies = beforeRefresh.budgets.find((budget) => budget.name.endsWith("Supplies"))?.spendingMinor;
  expect(beforeSupplies).toBeDefined();
  const dbApp = initializeApp({ projectId: "ledgerly-release-demo" }, `portal-update-${Date.now()}`);
  try {
    await getFirestore(dbApp).collection("users").doc("release-owner").collection("transactions").doc("portal-refresh-expense").set({
      id: "portal-refresh-expense",
      date: "2026-11-09",
      ledgerDate: "2026-11-09",
      description: "Portal refresh expense",
      amount: 10,
      amountMinor: 1000,
      currency: "USD",
      type: "expense",
      category: "Supplies",
      categoryId: "supplies",
      accountId: "checking",
      postingStatus: "posted",
      source: "actual",
    });
  } finally {
    await deleteApp(dbApp);
  }
  const afterRefreshResponse = viewerPage.waitForResponse((response) => response.url().endsWith("/api/budget-portal/summary"));
  await viewerPage.getByRole("button", { name: "Refresh" }).click();
  const afterRefresh = await (await afterRefreshResponse).json() as { budgets: Array<{ name: string; spendingMinor: number }> };
  expect(afterRefresh.budgets.find((budget) => budget.name.endsWith("Supplies"))?.spendingMinor).toBe(beforeSupplies! + 1000);

  // Assignment changes are enforced on the next request of an already-open session.
  const ownerGrantRow = page.getByText(`${OWNER_EMAIL} · 2 budgets`, { exact: true }).locator("..").locator("..");
  await ownerGrantRow.getByRole("button", { name: "Edit" }).click();
  const editAssignment = page.getByRole("dialog", { name: "Edit budget assignment" });
  await editAssignment.getByText("Operations", { exact: true }).click();
  await editAssignment.getByRole("button", { name: "Save assignment" }).click();
  await expect(editAssignment).toBeHidden();
  await expect(page.getByText(`${OWNER_EMAIL} · 1 budget`, { exact: true })).toBeVisible();
  await viewerPage.getByRole("button", { name: "Refresh" }).click();
  await expect(viewerPage.getByText("Operations", { exact: true })).toHaveCount(0);
  await expect(viewerPage.getByText("Operations > Supplies", { exact: true })).toBeVisible();

  const reducedOwnerGrantRow = page.getByText(`${OWNER_EMAIL} · 1 budget`, { exact: true }).locator("..").locator("..");
  await reducedOwnerGrantRow.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("dialog", { name: "Edit budget assignment" }).getByText("Operations", { exact: true }).click();
  await page.getByRole("dialog", { name: "Edit budget assignment" }).getByRole("button", { name: "Save assignment" }).click();
  await expect(page.getByText(`${OWNER_EMAIL} · 2 budgets`, { exact: true })).toBeVisible();
  await viewerPage.getByRole("button", { name: "Refresh" }).click();
  await expect(viewerPage.getByText("Operations", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByText(`${OWNER_EMAIL} · 2 budgets`, { exact: true }).locator("..").locator("..").getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText("revoked", { exact: true })).toBeVisible();
  await viewerPage.getByRole("button", { name: "Refresh" }).click();
  await expect(viewerPage.getByText("Budget access needed", { exact: true })).toBeVisible();

  const secondContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const secondPage = await secondContext.newPage();
  await secondPage.goto("/signin");
  await secondPage.getByRole("button", { name: "View a budget with a code" }).click();
  await secondPage.getByLabel("Invited email").fill(leaderTwo);
  await secondPage.getByRole("button", { name: "Email my code" }).click();
  const firstSecondLeaderCode = await latestPortalPin(leaderTwo);

  // Resending invalidates the previous code, even if it has not expired.
  await resetPortalPinCooldown(firstSecondLeaderCode.challengeId);
  const resend = await secondPage.request.post("/api/budget-portal/pin/request", { data: { email: leaderTwo } });
  expect(resend.status()).toBe(202);
  const secondSecondLeaderCode = await latestPortalPin(leaderTwo, [firstSecondLeaderCode.challengeId]);
  const superseded = await secondPage.request.post("/api/budget-portal/pin/verify", {
    data: { challengeId: firstSecondLeaderCode.challengeId, code: firstSecondLeaderCode.pin },
  });
  expect(superseded.status()).toBe(401);

  // An otherwise-correct code cannot be redeemed after its ten-minute window.
  await expirePortalChallenge(secondSecondLeaderCode.challengeId);
  const expired = await secondPage.request.post("/api/budget-portal/pin/verify", {
    data: { challengeId: secondSecondLeaderCode.challengeId, code: secondSecondLeaderCode.pin },
  });
  expect(expired.status()).toBe(401);

  // Two simultaneous redemptions have exactly one winner.
  await resetPortalPinCooldown(secondSecondLeaderCode.challengeId);
  const concurrentRequest = await secondPage.request.post("/api/budget-portal/pin/request", { data: { email: leaderTwo } });
  expect(concurrentRequest.status()).toBe(202);
  const concurrentCode = await latestPortalPin(leaderTwo, [firstSecondLeaderCode.challengeId, secondSecondLeaderCode.challengeId]);
  const concurrentResults = await Promise.all([
    secondPage.request.post("/api/budget-portal/pin/verify", { data: { challengeId: concurrentCode.challengeId, code: concurrentCode.pin } }),
    secondPage.request.post("/api/budget-portal/pin/verify", { data: { challengeId: concurrentCode.challengeId, code: concurrentCode.pin } }),
  ]);
  expect(concurrentResults.map((response) => response.status()).sort()).toEqual([200, 401]);

  // Start a fresh browser-visible challenge after the API concurrency check.
  await resetPortalPinCooldown(concurrentCode.challengeId);
  await secondPage.goto("/signin");
  await secondPage.getByRole("button", { name: "View a budget with a code" }).click();
  await secondPage.getByLabel("Invited email").fill(leaderTwo);
  await secondPage.getByRole("button", { name: "Email my code" }).click();
  const secondCode = await latestPortalPin(leaderTwo, [
    firstSecondLeaderCode.challengeId,
    secondSecondLeaderCode.challengeId,
    concurrentCode.challengeId,
  ]);
  await secondPage.getByLabel("One-time code").fill(secondCode.pin);
  await secondPage.getByRole("button", { name: "Open budget portal" }).click();
  await expect(secondPage.getByText("Operations > Supplies", { exact: true })).toBeVisible();
  await expect(secondPage.getByText("Operations", { exact: true })).toHaveCount(0);
  await secondPage.getByRole("button", { name: "Sign out" }).click();
  await expect(secondPage.getByText("Budget access needed", { exact: true })).toBeVisible();

  // Five failed attempts lock a challenge, including against the right code.
  await resetPortalPinCooldown(secondCode.challengeId);
  const lockRequest = await secondPage.request.post("/api/budget-portal/pin/request", { data: { email: leaderTwo } });
  expect(lockRequest.status()).toBe(202);
  const lockCode = await latestPortalPin(leaderTwo, [
    firstSecondLeaderCode.challengeId,
    secondSecondLeaderCode.challengeId,
    concurrentCode.challengeId,
    secondCode.challengeId,
  ]);
  const wrongLockCode = lockCode.pin === "999999" ? "999998" : "999999";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await secondPage.request.post("/api/budget-portal/pin/verify", {
      data: { challengeId: lockCode.challengeId, code: wrongLockCode },
    });
    expect(response.status()).toBe(401);
  }
  const lockedCorrectCode = await secondPage.request.post("/api/budget-portal/pin/verify", {
    data: { challengeId: lockCode.challengeId, code: lockCode.pin },
  });
  expect(lockedCorrectCode.status()).toBe(401);

  // The distributed per-email limit remains effective when cooldowns are reset.
  let activeRateChallenge = lockCode.challengeId;
  for (let requestNumber = 6; requestNumber <= 6; requestNumber += 1) {
    await resetPortalPinCooldown(activeRateChallenge);
    const response = await secondPage.request.post("/api/budget-portal/pin/request", { data: { email: leaderTwo } });
    expect(response.status()).toBe(202);
    const payload = await response.json() as { challengeId?: string };
    expect(payload.challengeId).toBeTruthy();
    activeRateChallenge = payload.challengeId!;
  }
  await resetPortalPinCooldown(activeRateChallenge);
  const rateLimited = await secondPage.request.post("/api/budget-portal/pin/request", { data: { email: leaderTwo } });
  expect(rateLimited.status()).toBe(202);
  expect(rateLimited.headers()["retry-after"]).toBeTruthy();
  expect((await rateLimited.json() as { challengeId?: string }).challengeId).toBeUndefined();
  await viewerContext.close();
  await secondContext.close();
});
