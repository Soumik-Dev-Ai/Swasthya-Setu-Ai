/**
 * Phase-7 item 7B — the six critical user journeys, driven through the real
 * frontend against the live backend (no mocks).
 *
 * PREREQUISITES:
 *   cd backend && python -m scripts.seed_data
 *   cd backend && python -m uvicorn app.main:app --port 8000
 * (the frontend dev server is started by playwright.config.ts)
 */
import { test, expect, type Page } from "@playwright/test";

/** Absolute — the backend and frontend must both be reachable. */
const BASE = "http://localhost:5173";

/** Let the framer-motion mount animations settle before interacting —
 * Playwright's stability check otherwise fights the entrance transitions. */
async function settle(page: Page) {
  await page.waitForTimeout(1500);
}

/** The custom SearchSelect: click, type into the input, then click the
 * option. `exact` avoids substring collisions with other page inputs. */
async function searchSelect(page: Page, placeholder: string, query: string, option: string) {
  const input = page.getByPlaceholder(placeholder, { exact: true });
  await input.click();
  await input.fill(query);
  await page.getByRole("button", { name: option, exact: true }).first().click();
}

test("1. Triage — text symptoms -> full result card", async ({ page }) => {
  await page.goto(BASE + "/#/app/triage");
  await settle(page);
  // Step 0: who is unwell
  await page.getByText("Adult (12", { exact: false }).first().click();
  await page.getByRole("button", { name: /Next/ }).click();
  // Step 1: symptoms + description
  await page.getByText("Fever", { exact: true }).first().click();
  await page.getByText("Headache", { exact: true }).first().click();
  await page.getByPlaceholder(/Describe your symptoms/i).fill("mild fever and headache since yesterday, no other issues");
  await page.getByRole("button", { name: /Analyze Symptoms/ }).click();
  // Step 2: danger signals — none apply
  await page.getByRole("button", { name: /Your urgency level/ }).click();
  // Result card: level badge + conditions + advice + disclaimer all render
  await expect(page.getByText("Your urgency level").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Matched conditions")).toBeVisible();
  await expect(page.getByText("Clinical guidance")).toBeVisible();
  await expect(page.getByText(/AI decision support only/)).toBeVisible();
});

test("2. Cost — disease + city -> verified rates with as-of date", async ({ page }) => {
  await page.goto(BASE + "/#/app/cost");
  await settle(page);
  await searchSelect(page, "Treatment", "Dengue", "Dengue fever");
  await searchSelect(page, "Select city or state", "Jaipur", "Jaipur");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  // Result cards render a real total and the freshness label — never "—".
  await expect(page.getByText("Data as of").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/₹/).first()).toBeVisible();
});

test("3. Insurance — scheme finder renders honest guidance, no dead buttons", async ({ page }) => {
  await page.goto(BASE + "/#/app/insurance");
  await settle(page);
  await page.getByRole("button", { name: /Check my eligibility/ }).click();
  // Scheme cards render with a match badge…
  await expect(page.getByText(/matched to you/i).first()).toBeVisible({ timeout: 60_000 });
  // …and honest how-to-apply guidance — never an inert Apply button.
  await expect(page.getByText("How to apply").first()).toBeVisible();
  const deadButtons = await page.locator("button", { hasText: /^Apply/ }).count();
  expect(deadButtons).toBe(0);
});

test("4. Facilities — city search -> cards with working Directions links", async ({ page }) => {
  await page.goto(BASE + "/#/app/facilities");
  await settle(page);
  // The page defaults to Jaipur (pre-selected pill) and auto-searches —
  // cards render with km + a real Google Maps directions link (doc 25 §3).
  await expect(page.getByText(/km/).first()).toBeVisible({ timeout: 60_000 });
  const directions = page.locator('a[href*="google.com/maps/dir"]');
  await expect(directions.first()).toBeVisible();
  expect(await directions.count()).toBeGreaterThan(0);
});

test("5. ASHA — authenticate, all five portal tabs load", async ({ page }) => {
  await page.goto(BASE + "/#/app/asha/portal");
  await settle(page);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await page.getByPlaceholder("asha1").fill("asha1");
  await page.getByPlaceholder("••••••••").fill("asha123");
  await page.getByRole("button", { name: /Sign in/ }).last().click();

  const tabs: [string, RegExp][] = [
    ["Worklist", /Today's tasks/],
    ["Patients", /New patient/],
    ["Referrals", /Create referral/],
    ["Capture", /Capture a paper form/],
    ["Capacity", /Report capacity/],
  ];
  for (const [tab, heading] of tabs) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await expect(page.getByText(heading).first()).toBeVisible({ timeout: 30_000 });
  }
});

test("6. Admin — analytics + pending review + district view", async ({ page }) => {
  await page.goto(BASE + "/#/app/admin");
  await settle(page);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await page.getByPlaceholder("asha1").fill("admin");
  await page.getByPlaceholder("••••••••").fill("admin123");
  await page.getByRole("button", { name: /Sign in/ }).last().click();

  // Overview: stats + pending approvals render (heading is the stable anchor).
  await expect(page.getByRole("heading", { name: "Pending approvals" })).toBeVisible({ timeout: 60_000 });
  // District View tab loads the dashboard aggregates.
  await page.getByRole("button", { name: "District View" }).click();
  await expect(page.getByText("Triage volume").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Referral completion rate")).toBeVisible();
});
