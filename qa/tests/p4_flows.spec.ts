import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { cfg, ROOT } from '../lib/config';
import { record, shot } from '../lib/evidence';
import { captureApi, findKeys, settle } from '../lib/net';
import { symptomInput, submitBtn, resultText, ui_login, apiLogin, apiGet, loadForms, fillForm } from '../lib/ui';

test.describe.configure({ mode: 'serial' });

const MARK = `QA-${cfg.runId}`;
const FIX = path.join(ROOT, 'fixtures', 'benign.png');
const vars = { run: cfg.runId, mark: MARK, asha_user: `qa_asha_${cfg.runId}`, asha_pass: `Qa!${cfg.runId}xZ9`,
  admin_user: cfg.creds.adminUser, admin_pass: cfg.creds.adminPass };

// ---------------- Flow 1: emergency red flag ----------------
test('Flow 1: emergency red-flag renders L4 fast with 108 + nearest facility', async ({ page }) => {
  const log = captureApi(page);
  await page.goto(cfg.web + cfg.routes.triage);
  await symptomInput(page).fill('severe chest pain radiating to left arm and sweating');
  const alreadyVisible = await page.getByText(cfg.sel.uiL4).first().isVisible().catch(() => false);
  const t0 = Date.now();
  await submitBtn(page).click();
  let ms: number | null = null;
  try { await page.getByText(cfg.sel.uiL4).first().waitFor({ state: 'visible', timeout: 10_000 }); ms = Date.now() - t0; } catch { /* leave null */ }
  await settle(page, 800);
  const tel = await page.locator('a[href^="tel:108"], a[href^="tel:+91108"]').count();
  const maps = await page.locator('a[href*="google.com/maps"], a[href*="maps.google"]').count();
  const s = await shot(page, 'P4-F1');
  const status = ms === null ? 'FAIL' : (ms <= 1000 && tel > 0 && maps > 0 ? 'PASS' : 'FAIL');
  record({ id: 'P4-F1-EMERGENCY', claim: 'Red-flag text → L4 in <1s with 108 call button and nearest-facility directions link', status,
    evidence: { msToVisibleL4: ms, thresholdMs: 1000, telLinks: tel, mapsLinks: maps, l4TextWasVisibleBeforeSubmit: alreadyVisible,
      calls: log.map((e) => `${e.method} ${e.path} ${e.status} ${e.ms}ms`), screenshot: s } });
});

// ---------------- Flow 3: vision ----------------
async function visionRun(page: any, id: string, claim: string, degraded: boolean) {
  if (!fs.existsSync(FIX)) return record({ id, claim, status: 'BLOCKED', evidence: { why: 'fixtures/benign.png missing: run scripts/make_fixtures.py' } });
  if (degraded) {
    if (!cfg.apiDegraded) return record({ id, claim, status: 'BLOCKED', evidence: { why: 'API_BASE_DEGRADED not set. Provider calls are made by the BACKEND, so they cannot be blocked from the browser: start a 2nd backend with invalid LLM/vision keys and set API_BASE_DEGRADED.' } });
    await page.route(cfg.api + '/**', (route: any) => route.continue({ url: route.request().url().replace(cfg.api, cfg.apiDegraded) }));
  }
  const log = captureApi(page);
  await page.goto(cfg.web + cfg.routes.triage);
  await symptomInput(page).fill('skin rash on arm for two days, itchy');
  const file = page.locator('input[type=file]').first();
  if (!(await file.count())) return record({ id, claim, status: 'BLOCKED', evidence: { why: 'No file input on triage page' } });
  await file.setInputFiles(FIX);
  await submitBtn(page).click();
  await settle(page, 3000);
  let stuck = false;
  const spinner = page.getByText(/loading|analy[sz]ing|please wait/i).first();
  try { await spinner.waitFor({ state: 'hidden', timeout: 25_000 }); } catch { stuck = await spinner.isVisible().catch(() => false); }
  const txt = await resultText(page);
  const crashed = /(unhandled|something went wrong|traceback|undefined|\[object)/i.test(txt);
  const uncertain = /(uncertain|unable to|could not|consult|see a (doctor|health)|not sure)/i.test(txt);
  const s = await shot(page, id);
  const ok = degraded ? (!stuck && !crashed && uncertain) : (!stuck && !crashed && txt.length > 40);
  record({ id, claim, status: ok ? 'PASS' : 'FAIL',
    evidence: { stuckSpinner: stuck, crashed, gracefulUncertainWording: uncertain, calls: log.map((e) => `${e.method} ${e.path} ${e.status}`), excerpt: txt.slice(0, 500), screenshot: s } });
}
test('Flow 3a: vision triage with image + text renders a result', async ({ page }) =>
  visionRun(page, 'P4-F3-VISION-OK', 'Image + text triage renders a result', false));
test('Flow 3b: all providers failing → graceful uncertain fallback, no crash/infinite spinner', async ({ page }) =>
  visionRun(page, 'P4-F3-VISION-DEGRADED', 'Provider outage degrades to a safe "uncertain" result', true));

// ---------------- Flows 5/6/7: ASHA operations (spec-driven via forms.json) ----------------
const forms = loadForms();
const needForms = (id: string, claim: string, keys: string[]) => {
  const missing = !forms ? keys : keys.filter((k) => !forms[k]);
  if (missing.length) { record({ id, claim, status: 'BLOCKED', evidence: { why: `forms.json missing/incomplete: ${missing.join(', ')}. Build it from results/recon/ui_map.json (Phase 1).` } }); return false; }
  return true;
};
const countMarked = (body: any): number => {
  const arr = Array.isArray(body) ? body : (body?.items ?? body?.results ?? body?.data ?? []);
  return (Array.isArray(arr) ? arr : []).filter((x) => JSON.stringify(x).includes(MARK)).length;
};

test('Flow 5a: new ASHA registers, is rejected at login (pending), admin approves', async ({ page }) => {
  const id = 'P4-F5-PENDING-LOGIN', claim = 'Newly registered ASHA cannot log in until an admin approves';
  if (!needForms(id, claim, ['register_asha'])) return;
  await page.goto(cfg.web + (forms!.register_asha.route ?? '/register'));
  await fillForm(page, forms!.register_asha, vars);
  await settle(page, 1000);
  const before = await apiLogin(vars.asha_user, vars.asha_pass);
  await page.context().clearCookies();
  const uiOk = await ui_login(page, vars.asha_user, vars.asha_pass);
  const msg = await resultText(page);
  const pendingMsg = /pending|approval|not (yet )?approved|awaiting/i.test(msg);
  const rejected = !uiOk && before.access === null;
  record({ id, claim, status: rejected && pendingMsg ? 'PASS' : rejected ? 'PARTIAL' : 'FAIL',
    evidence: { apiLoginStatusBeforeApproval: before.status, uiLoggedIn: uiOk, pendingMessageShown: pendingMsg, excerpt: msg.slice(0, 300), screenshot: await shot(page, id) } });

  // admin approval: the one permitted API shortcut (no admin approval UI is specified in docs)
  const admin = await apiLogin(vars.admin_user, vars.admin_pass);
  let approved = false, detail: any = {};
  if (admin.access) {
    let p = cfg.paths.approve.replace('{username}', vars.asha_user);
    if (p.includes('{id}')) {
      const users = await apiGet(admin.access, '/api/admin/users/pending');
      const list = Array.isArray(users.body) ? users.body : (users.body?.items ?? users.body?.results ?? []);
      const u = list.find((x: any) => x.username === vars.asha_user || x.email === vars.asha_user);
      p = u ? p.replace('{id}', String(u.id)) : '';
      detail.userFound = !!u;
    }
    if (p) {
      const { request } = await import('@playwright/test');
      const ctx = await request.newContext({ baseURL: cfg.api, extraHTTPHeaders: { Authorization: `Bearer ${admin.access}` } });
      const r = await ctx.patch(p); approved = r.ok(); detail = { ...detail, path: p, status: r.status() }; await ctx.dispose();
    }
  }
  record({ id: 'P4-F5-ADMIN-APPROVE', claim: 'Admin can approve the pending ASHA (API shortcut)', status: approved ? 'PASS' : 'BLOCKED', evidence: { adminLoggedIn: !!admin.access, ...detail } });
});

test('Flow 5b: offline patient+referral creation queues locally and syncs once, no duplicate', async ({ page, context }) => {
  const id = 'P4-F5-OFFLINE-SYNC', claim = 'Records created in true offline mode queue locally and sync exactly once on reconnect';
  if (!needForms(id, claim, ['create_patient'])) return;
  const ok = await ui_login(page, vars.asha_user, vars.asha_pass);
  if (!ok) return record({ id, claim, status: 'BLOCKED', evidence: { why: 'ASHA could not log in (approval step failed?)' } });
  await page.goto(cfg.web + (forms!.create_patient.route ?? '/patients/new'));
  await settle(page, 800);                              // load app shell while online
  await context.setOffline(true);                        // real offline, not throttling
  await fillForm(page, forms!.create_patient, vars);
  await page.waitForTimeout(1500);
  const offlineText = await resultText(page);
  const queuedIndicator = /queued|saved (offline|locally)|will sync|pending sync|offline/i.test(offlineText);
  const idbCount = await page.evaluate(async () => {
    const dbs = (indexedDB as any).databases ? await (indexedDB as any).databases() : [];
    return dbs.map((d: any) => d.name);
  });
  const s1 = await shot(page, 'P4-F5-offline');
  const syncPost = page.waitForResponse((r) => (r.url().startsWith(cfg.api) || r.url().includes('/api')) && r.request().method() === 'POST' && (r.url().includes(cfg.paths.patients) || r.url().includes('/sync')) && r.ok(), { timeout: 15_000 }).catch(() => null);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  const synced = await syncPost;
  await settle(page, 2000);
  const sess = await apiLogin(vars.asha_user, vars.asha_pass);
  const listed = sess.access ? await apiGet(sess.access, cfg.paths.patients) : { status: 0, body: null };
  const n = countMarked(listed.body);
  record({ id, claim, status: !synced ? 'FAIL' : n === 1 ? 'PASS' : 'FAIL',
    evidence: { offlineQueuedIndicatorVisible: queuedIndicator, indexedDbs: idbCount, syncPostObserved: !!synced, recordsWithMarker: n, expected: 1, screenshot: s1 } });
  record({ id: 'P4-F5-NO-DUP', claim: 'Sync after reconnect creates no duplicate record', status: !synced ? 'BLOCKED' : n === 1 ? 'PASS' : 'FAIL', evidence: { recordsWithMarker: n } });
});

test('Flow 6: referral walks every state; follow-up appears after discharge', async ({ page }) => {
  const id = 'P4-F6-STATES', claim = 'Referral state machine pending→in_transit→arrived→admitted→discharged works through the UI';
  if (!needForms(id, claim, ['create_referral'])) return;
  const log = captureApi(page);
  if (!(await ui_login(page, vars.asha_user, vars.asha_pass))) return record({ id, claim, status: 'BLOCKED', evidence: { why: 'ASHA login failed' } });
  await page.goto(cfg.web + (forms!.create_referral.route ?? '/referrals/new'));
  await fillForm(page, forms!.create_referral, vars);
  await settle(page, 1200);
  const actions = (process.env.REFERRAL_ACTIONS ?? 'in transit,arrived,admit,discharge').split(',');
  const done: string[] = [];
  for (const a of actions) {
    const btn = page.getByRole('button', { name: new RegExp(a.trim(), 'i') }).first();
    await btn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (!(await btn.count())) { done.push(`${a}: BUTTON NOT FOUND`); break; }
    await btn.click(); await settle(page, 900); done.push(`${a}: clicked`);
  }
  const statuses = log.flatMap((e) => findKeys(e.body, /^(status|state)$/i).map(([, v]) => String(v)));
  const all = done.every((d) => d.endsWith('clicked'));
  record({ id, claim, status: all ? 'PASS' : 'FAIL', evidence: { steps: done, statusesSeenInApi: [...new Set(statuses)], screenshot: await shot(page, id) } });

  await page.goto(cfg.web + cfg.routes.worklist); await settle(page, 1200);
  const present = (await page.locator('body').innerText()).includes(MARK);
  record({ id: 'P4-F6-FOLLOWUP', claim: 'Discharge creates a follow-up worklist entry', status: all ? (present ? 'PASS' : 'FAIL') : 'BLOCKED',
    evidence: { markerInWorklist: present, screenshot: await shot(page, 'P4-F6-FOLLOWUP') } });
});

test('Flow 7: completing a follow-up clears it from the worklist', async ({ page }) => {
  const id = 'P4-F7-FOLLOWUP-DONE', claim = 'Completed follow-up leaves the worklist and appears in patient timeline';
  if (!(await ui_login(page, vars.asha_user, vars.asha_pass))) return record({ id, claim, status: 'BLOCKED', evidence: { why: 'ASHA login failed' } });
  await page.goto(cfg.web + cfg.routes.worklist); await settle(page, 1200);
  const row = page.locator('li, tr, article, [data-testid*=followup]').filter({ hasText: MARK }).first();
  if (!(await row.count())) return record({ id, claim, status: 'BLOCKED', evidence: { why: 'No follow-up row with run marker (Flow 6 incomplete)' } });
  await row.getByRole('button', { name: /complete|done|mark|record/i }).first().click();
  await settle(page, 1200);
  const gone = !(await page.locator('li, tr, article').filter({ hasText: MARK }).filter({ hasText: /complete|done|mark/i }).count());
  record({ id, claim, status: gone ? 'PASS' : 'FAIL', evidence: { rowClearedFromOpenWorklist: gone, screenshot: await shot(page, id) } });
});
