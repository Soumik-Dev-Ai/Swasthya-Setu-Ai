import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { cfg, ROOT } from '../lib/config';
import { record, shot } from '../lib/evidence';
import { captureApi, findKeys, Entry } from '../lib/net';
import { symptomInput, submitBtn, resultText } from '../lib/ui';

interface Case { id: string; text: string; lang: string; category: string; expect: 'L4' | 'not_L4' | 'review' }
const corpus: { cases: Case[] } = JSON.parse(fs.readFileSync(path.join(ROOT, 'corpus', 'adversarial_phrases.json'), 'utf8'));
const FIX = path.join(ROOT, 'fixtures', 'benign.png');

const L4_VAL = /^(4|l4|level[\s_-]*4|emergency|critical|red)$/i;
const levelOf = (entries: Entry[]): string[] =>
  entries.flatMap((e) => findKeys(e.body, /^(level|severity|triage_level|risk_level|urgency)$/i).map(([, v]) => String(v)));

async function submit(page: Page, log: Entry[], text: string, image = false) {
  await page.goto(cfg.web + cfg.routes.triage);                 // fresh page per case: no stale L4 banner can mask a miss
  await symptomInput(page).fill(text);
  if (image && fs.existsSync(FIX)) await page.locator('input[type=file]').first().setInputFiles(FIX);
  const start = log.length;
  await submitBtn(page).click();
  const end = Date.now() + 15_000;
  while (Date.now() < end && !log.slice(start).some((e) => e.status !== null && e.method === 'POST')) await page.waitForTimeout(50);
  await page.waitForTimeout(400);
  let entries = log.slice(start);
  if (entries.some((e) => e.status === 429)) {                   // limiter hit: wait out the window, retry once
    await page.waitForTimeout(61_000);
    return submit(page, log, text, image);
  }
  return entries;
}

test('P5 red-flag phrase corpus through the real UI: zero false negatives', async ({ page }) => {
  test.setTimeout(45 * 60_000);
  const log = captureApi(page);
  const fn: any[] = [], overTriage: any[] = [], reviewed: any[] = [];
  let l4Total = 0;
  for (const c of corpus.cases) {
    const entries = await submit(page, log, c.text);
    const apiLevels = levelOf(entries);
    const apiL4 = apiLevels.some((v) => L4_VAL.test(v.trim()));
    const uiL4 = await page.getByText(cfg.sel.uiL4).first().isVisible().catch(() => false);
    if (c.expect === 'L4') {
      l4Total++;
      if (!apiL4 || !uiL4) fn.push({ id: c.id, text: c.text, lang: c.lang, category: c.category, apiLevels, apiL4, uiL4 });
    } else if (c.expect === 'not_L4') {
      if (apiL4) overTriage.push({ id: c.id, text: c.text, apiLevels });
    } else reviewed.push({ id: c.id, text: c.text, category: c.category, apiLevels, uiL4 });
  }
  const s = await shot(page, 'P5-REDFLAG');
  record({ id: 'P5-RED-FLAG-FN', claim: 'Every true-emergency phrase (all languages/variants) yields L4 end-to-end in the UI; zero false negatives',
    status: l4Total === 0 ? 'BLOCKED' : fn.length ? 'FAIL' : 'PASS',
    evidence: { casesRun: corpus.cases.length, emergencyCases: l4Total, falseNegatives: fn, overTriageCount: overTriage.length, overTriage: overTriage.slice(0, 20),
      manualReviewQueue: reviewed, note: 'Over-triage is tracked, not a safety failure. Items in manualReviewQueue need a human reading against doc 09/12 expectations.', screenshot: s } });
  expect(fn, 'false negatives on emergency phrases').toHaveLength(0);
});

test('P5 vision says benign but text has a red flag: override must hold and be visible', async ({ page }) => {
  const id = 'P5-VISION-OVERRIDE', claim = 'Red-flag text cannot be downgraded by a benign vision result; override indicator shown';
  if (!fs.existsSync(FIX)) return record({ id, claim, status: 'BLOCKED', evidence: { why: 'fixtures/benign.png missing' } });
  const log = captureApi(page);
  const entries = await submit(page, log, 'severe chest pain and sweating, cannot breathe', true);
  const l4 = levelOf(entries).some((v) => L4_VAL.test(v.trim())) && (await page.getByText(cfg.sel.uiL4).first().isVisible().catch(() => false));
  const flag = entries.flatMap((e) => findKeys(e.body, /vision_downgrade_blocked|override/i)).filter(([, v]) => v === true || (typeof v === 'string' && v));
  const uiIndicator = /(override|vision.*(blocked|ignored)|safety (check|rule))/i.test(await resultText(page));
  record({ id, claim, status: !l4 ? 'FAIL' : flag.length && uiIndicator ? 'PASS' : 'PARTIAL',
    evidence: { stayedL4: l4, apiOverrideFlag: flag, uiIndicatorVisible: uiIndicator, screenshot: await shot(page, id),
      note: 'PARTIAL means L4 held but the downgrade path was not demonstrably exercised: stub the vision provider to return non_serious (e.g. env on the QA backend) and re-run.' } });
  expect(l4).toBe(true);
});

test('P5 XSS payloads are inert', async ({ page }) => {
  let dialogs = 0; page.on('dialog', async (d) => { dialogs++; await d.dismiss(); });
  const log = captureApi(page);
  const payloads = ['<img src=x onerror="window.__xss=1">', '<script>window.__xss=1</script>', '"><svg onload=window.__xss=1>', 'javascript:window.__xss=1'];
  let executed = false; const statuses: number[] = [];
  for (const p of payloads) {
    const entries = await submit(page, log, p);
    statuses.push(...entries.map((e) => e.status ?? 0));
    if (await page.evaluate(() => (window as any).__xss === 1)) executed = true;
  }
  record({ id: 'P5-XSS', claim: 'XSS payloads in symptom text are escaped, never executed', status: executed || dialogs ? 'FAIL' : 'PASS',
    evidence: { payloads, scriptExecuted: executed, dialogsOpened: dialogs, apiStatuses: statuses } });
  expect(executed || dialogs > 0).toBe(false);
});

test('P5 SQL-injection-shaped and oversized input: graceful, never 5xx or page crash', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(String(e)));
  const log = captureApi(page);
  const sqli = ["'; DROP TABLE users;--", "' OR '1'='1", '1; SELECT pg_sleep(5)--', '\\u0000 null byte \u0000'];
  const results: any[] = [];
  for (const t of sqli) { const en = await submit(page, log, t); results.push({ input: t.slice(0, 40), statuses: en.map((e) => e.status) }); }
  const big = await submit(page, log, 'a'.repeat(200_000));
  const bigStatuses = big.map((e) => e.status);
  const all5xx = [...results.flatMap((r) => r.statuses), ...bigStatuses].filter((s) => (s ?? 0) >= 500);
  const txt = await resultText(page);
  record({ id: 'P5-SQLI', claim: 'SQLi-shaped strings are handled without server errors', status: results.some((r) => r.statuses.some((s: number) => s >= 500)) ? 'FAIL' : 'PASS', evidence: { results } });
  record({ id: 'P5-OVERSIZE', claim: 'Oversized payload is rejected gracefully (4xx) with no crash/unhandled page error',
    status: bigStatuses.some((s) => (s ?? 0) >= 500) || errors.length ? 'FAIL' : bigStatuses.some((s) => s && s >= 400 && s < 500) ? 'PASS' : 'PARTIAL',
    evidence: { oversizeStatuses: bigStatuses, pageErrors: errors.slice(0, 5), all5xx, uiExcerpt: txt.slice(0, 200),
      note: 'PARTIAL = accepted 200KB without rejecting; confirm a max length exists.' } });
  expect(all5xx).toHaveLength(0);
});
