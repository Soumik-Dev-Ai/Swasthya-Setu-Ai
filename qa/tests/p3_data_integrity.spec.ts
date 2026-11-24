import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { cfg, ROOT, webHost } from '../lib/config';
import { record, shot } from '../lib/evidence';
import { captureApi, captureExternalHosts, findKeys, allNumbers, settle } from '../lib/net';

const FONT_OK = /(fonts\.(googleapis|gstatic)\.com|api\.fontshare\.com|cdn\.fontshare\.com|fontshare\.com|tile\.openstreetmap\.org|[a-c]\.tile\.|unpkg\.com|cdn\.jsdelivr\.net)/;

// ---------- 3a/3b: financial path is a DB lookup, with freshness label ----------
test('P3 cost estimate: latency, as_of label, no external call, PM-JAY zero', async ({ page }) => {
  const log = captureApi(page);
  const ext = captureExternalHosts(page, webHost);
  await page.goto(cfg.web + cfg.routes.cost);
  await settle(page, 500);
  // Select disease and city using SearchSelect autocomplete
  const diseaseInput = page.locator('input[placeholder*="procedure" i], input[placeholder*="disease" i], input[role=combobox]').first();
  if (await diseaseInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await diseaseInput.fill('dengue');
    await page.waitForTimeout(300);
    const dOpt = page.locator('.max-h-60 button, button.rounded-xl').filter({ hasText: /dengue/i }).first();
    if (await dOpt.isVisible({ timeout: 1500 }).catch(() => false)) await dOpt.click().catch(() => {});
  }
  const cityInput = page.locator('input[placeholder*="city" i], input[placeholder*="state" i]').first();
  if (await cityInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cityInput.fill('delhi');
    await page.waitForTimeout(300);
    const cOpt = page.locator('.max-h-60 button, button.rounded-xl').filter({ hasText: /delhi/i }).first();
    if (await cOpt.isVisible({ timeout: 1500 }).catch(() => false)) await cOpt.click().catch(() => {});
  }

  const selects = page.locator('select');
  const n = await selects.count();
  for (let i = 0; i < n; i++) {
    const opts = await selects.nth(i).locator('option').allInnerTexts().catch(() => []);
    const pref = opts.findIndex((o) => /private/i.test(o));
    await selects.nth(i).selectOption({ index: pref > 0 ? pref : Math.min(1, opts.length - 1) }, { timeout: 1000, force: true }).catch(() => undefined);
  }
  const start = log.length;
  await page.getByRole('button', { name: /estimate|calculate|check|get|compare|लागत/i }).first().click({ timeout: 3000 }).catch(() => undefined);
  await settle(page, 2000);
  const calls = log.slice(start).filter((e) => cfg.re.cost.test(e.path) && e.method !== 'OPTIONS' && e.status === 200);
  const shotPath = await shot(page, 'P3-COST');

  if (!calls.length) {
    for (const id of ['P3-COST-LATENCY', 'P3-COST-ASOF', 'P3-COST-NOEXTERNAL'])
      record({ id, claim: id, status: 'BLOCKED', evidence: { why: 'No cost API call observed; refine selectors / RE_COST', apiSeen: log.map((e) => e.path) } });
  } else {
    const c = calls[0];
    record({ id: 'P3-COST-LATENCY', claim: 'Cost answer is a DB lookup (fast, no live compute)', status: (c.ms ?? 99999) <= 2500 ? 'PASS' : 'FAIL',
      evidence: { path: c.path, ms: c.ms, threshold_ms: 2500, screenshot: shotPath } });
    const asOf = findKeys(c.body, /(as_of|last_updated|updated_at|effective_date|data_version|source_updated|verified_at)/i);
    record({ id: 'P3-COST-ASOF', claim: 'Cost response carries a freshness/as_of field', status: asOf.length ? 'PASS' : 'FAIL',
      evidence: { fieldsFound: asOf.map(([k, v]) => ({ k, v })), responseKeys: c.body && typeof c.body === 'object' ? Object.keys(c.body as object) : null,
        note: asOf.length ? undefined : 'Transparency gap: user cannot tell whether the figure is current.' } });
    const bad = [...ext].filter((h) => !FONT_OK.test(h));
    record({ id: 'P3-COST-NOEXTERNAL', claim: 'No external/third-party request at query time on the cost page', status: bad.length ? 'FAIL' : 'PASS', evidence: { externalHosts: [...ext], unexpected: bad } });
    const oop = findKeys(c.body, /(patient_pays|out_of_pocket|oop|you_pay|patient_cost)/i);
    record({ id: 'P3-PMJAY-ZERO', claim: 'PM-JAY eligible in-database procedure shows ₹0 patient cost', status: 'PARTIAL',
      evidence: { note: 'First-pass: cost page default selection inspected only. Agent must repeat with a PM-JAY-eligible selection (forms.json) and assert value 0.', oopFields: oop } });
  }
});

// ---------- 4: bed capacity staleness label visible in UI ----------
test('P3 facility detail shows an "as of" label next to bed counts (rendered, not just in the API)', async ({ page }) => {
  const log = captureApi(page);
  await page.goto(cfg.web + cfg.routes.facilities);
  await settle(page, 1000);
  const card = page.locator('[data-testid*=facility], article, li, tr').filter({ hasText: /bed|icu/i }).first();
  if (await card.count()) await card.click({ timeout: 3000 }).catch(() => undefined);
  await settle(page, 800);
  const body = await page.locator('body').innerText();
  const hasBeds = /bed|icu/i.test(body);
  const asOf = /(as of|last (updated|verified)|updated on|verified on|snapshot)\W{0,3}[\w ,\-/:]{0,30}\d/i.test(body);
  const misleading = /\b(real[- ]?time|live (bed|availability|capacity))\b/i.test(body);
  const s = await shot(page, 'P3-BED');
  record({ id: 'P3-BED-STALENESS', claim: 'Bed/ICU capacity is never implied as live; a staleness label is visible on screen',
    status: !hasBeds ? 'BLOCKED' : (asOf && !misleading ? 'PASS' : 'FAIL'),
    evidence: { hasBedText: hasBeds, visibleAsOfLabel: asOf, misleadingLiveWording: misleading, screenshot: s,
      apiHadTimestampField: log.some((e) => findKeys(e.body, /(hours_snapshot_taken_at|capacity_as_of|updated_at|as_of)/i).length > 0) } });
});

// ---------- 8: every visible landing-page number must trace to a backend response ----------
test('P3 landing page numbers trace to real API responses', async ({ page }) => {
  const log = captureApi(page);
  await page.goto(cfg.web + cfg.routes.home);
  await settle(page, 1500);
  const text = await page.locator('body').innerText();
  const visible = [...new Set((text.match(/\d[\d,]*\.?\d*/g) || []).map((s) => s.replace(/,/g, '')))].filter((s) => parseFloat(s) >= 10);
  const backend = new Set<string>();
  log.forEach((e) => allNumbers(e.body, backend));
  const allowPath = path.join(ROOT, 'corpus', 'incidental_numbers.json');
  const allow: Record<string, string> = fs.existsSync(allowPath) ? JSON.parse(fs.readFileSync(allowPath, 'utf8')) : {};
  const untraced = visible.filter((n) => !backend.has(n) && !(n in allow));
  const s = await shot(page, 'P3-LANDING');
  record({ id: 'P3-LANDING-TRACE', claim: 'Landing-page statistics come from backend data, not frontend mock data',
    status: log.length === 0 && visible.length ? 'FAIL' : untraced.length ? 'FAIL' : 'PASS',
    evidence: { visibleNumbers: visible, untraced, apiCallsMade: log.map((e) => e.path),
      how_to_clear: 'Each untraced number is either fabricated (fix: wire to API) or incidental (e.g. "24/7"): add to corpus/incidental_numbers.json WITH a reason.', screenshot: s } });
});

// ---------- 9: selectors are fetched, not hard-coded ----------
async function dynamism(page: any, route: string, id: string, claim: string) {
  const log = captureApi(page);
  await page.goto(cfg.web + route);
  await settle(page, 1200);
  await page.locator('select option').nth(1).waitFor({ timeout: 5000 }).catch(() => undefined);
  let options: string[] = await page.locator('select option').allInnerTexts();
  if (!options.length) {
    await page.locator('[role=combobox]').first().click({ timeout: 2000 }).catch(() => undefined);
    options = await page.locator('[role=option]').allInnerTexts();
  }
  options = options.map((o: string) => o.trim()).filter((o: string) => o && !/^(select|choose|--)/i.test(o));
  if (!options.length) return record({ id, claim, status: 'BLOCKED', evidence: { why: 'No selector options found in DOM; update selectors', route } });
  const hay = JSON.stringify(log.map((e) => e.body)).toLowerCase();
  const found = options.filter((o) => hay.includes(o.toLowerCase()));
  record({ id, claim, status: found.length >= Math.ceil(options.length * 0.8) ? 'PASS' : 'FAIL',
    evidence: { options: options.slice(0, 40), optionCount: options.length, foundInApiResponses: found.length, apiCalls: log.map((e) => e.path) } });
}
test('P3 disease selector is fetched from the backend', async ({ page }) =>
  dynamism(page, cfg.routes.cost, 'P3-SELECTOR-DISEASE', 'Disease/procedure list is served by the backend (autonomous-refresh architecture)'));
test('P3 city selector is fetched from the backend', async ({ page }) =>
  dynamism(page, cfg.routes.facilities, 'P3-SELECTOR-CITY', 'City list is served by the backend (any-city expansion)'));
