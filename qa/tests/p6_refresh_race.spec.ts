import { test, expect } from '@playwright/test';
import { cfg } from '../lib/config';
import { record, shot } from '../lib/evidence';
import { ui_login, ensureShell } from '../lib/ui';

// Doc 27 item 5: when the access token expires, N parallel requests must trigger exactly ONE refresh.
// Method: after a real UI login, make the backend appear to reject the current token (401) for every
// authenticated call until the refresh response has actually come back, then reload a page that fires
// several authenticated requests on mount. Count /auth/refresh calls the app's OWN interceptor makes.
test('P6 concurrent 401s cause exactly one refresh call', async ({ page }) => {
  const id = 'P6-REFRESH-RACE', claim = 'Concurrent expired-token requests trigger exactly one /auth/refresh (no refresh stampede)';
  const user = cfg.creds.adminUser || cfg.creds.ashaUser;
  const pass = cfg.creds.adminUser ? cfg.creds.adminPass : cfg.creds.ashaPass;
  if (!user) return record({ id, claim, status: 'BLOCKED', evidence: { why: 'QA_ADMIN_USER/QA_ASHA_USER not set' } });
  if (!(await ui_login(page, user, pass))) return record({ id, claim, status: 'BLOCKED', evidence: { why: 'login failed' } });

  let expired = false, refreshCalls = 0, rejected = 0;
  const refreshRe = new RegExp(cfg.paths.refresh);
  await page.route(cfg.api + '/**', async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname;
    if (req.method() === 'OPTIONS') return route.continue();
    if (refreshRe.test(p)) {
      refreshCalls++;
      const resp = await route.fetch();
      expired = false;                                  // token becomes valid only once refresh has really completed
      return route.fulfill({ response: resp });
    }
    if (expired && req.headers()['authorization'] && !/login/.test(p)) {
      rejected++;
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Token expired' }),
        headers: { 'access-control-allow-origin': cfg.web, 'access-control-allow-credentials': 'true' } });
    }
    return route.continue();
  });

  expired = true;
  await page.reload();
  await page.waitForTimeout(300);
  const districtTab = page.getByRole('button', { name: /district view/i }).first();
  if (await districtTab.isVisible().catch(() => false)) await districtTab.click().catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(2000);
  const kickedToLogin = /\/login/.test(page.url());
  const s = await shot(page, id);

  let status: 'PASS' | 'FAIL' | 'BLOCKED' = 'PASS'; let why = '';
  if (rejected < 3) { status = 'BLOCKED'; why = `Only ${rejected} authenticated request(s) were rejected: page does not fire enough parallel calls. Set ROUTE_REFRESH_RACE to a busier page.`; }
  else if (refreshCalls === 0) { status = 'FAIL'; why = 'App never attempted a refresh: user is stranded/logged out on token expiry.'; }
  else if (refreshCalls > 1) { status = 'FAIL'; why = `${refreshCalls} refresh calls fired for one expiry (stampede). With refresh-token rotation this logs the user out.`; }
  record({ id, claim, status, evidence: { exactRefreshCalls: refreshCalls, expected: 1, requestsRejectedWith401: rejected, forcedToLoginPage: kickedToLogin, why, screenshot: s } });
  expect(status).not.toBe('FAIL');
});
