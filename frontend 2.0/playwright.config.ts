import { defineConfig } from "@playwright/test";

/**
 * Phase-7 item 7B — E2E smoke configuration.
 *
 * PREREQUISITES (documented in e2e/smoke.spec.ts too):
 *   1. Backend running on :8000 against the dev DB:
 *        cd backend && python -m scripts.seed_data
 *        cd backend && python -m uvicorn app.main:app --port 8000
 *   2. The frontend dev server is started automatically by this config.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    locale: "en-IN",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
