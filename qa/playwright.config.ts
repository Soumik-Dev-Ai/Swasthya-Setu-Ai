import { defineConfig } from '@playwright/test';
import { cfg } from './lib/config';

// One worker, no parallelism: these specs are ordered and stateful (login, rate limits, offline sync).
export default defineConfig({
  testDir: './tests',
  outputDir: './results/pw-artifacts',
  fullyParallel: false,
  workers: 1,
  retries: 0,                 // a flaky pass is not evidence; no silent retries
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: cfg.web,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1366, height: 800 },
    ignoreHTTPSErrors: true,
  },
});
