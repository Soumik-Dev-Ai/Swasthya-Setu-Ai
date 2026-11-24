import * as fs from 'fs';
import * as path from 'path';
import { Page, Locator, request } from '@playwright/test';
import { cfg, ROOT } from './config';

export const symptomInput = (p: Page): Locator => {
  const orig = p.locator(cfg.sel.symptom).first();
  const wrapped = Object.create(orig);
  wrapped.fill = async (value: string, options?: any) => {
    const enterBtn = p.getByRole('button', { name: /enter swasthyasetu/i }).first();
    if (await enterBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await enterBtn.click().catch(() => {});
      await p.waitForTimeout(400);
      await p.evaluate(() => { window.location.hash = '#/app/triage'; });
      await p.waitForTimeout(400);
    }
    const retakeBtn = p.getByRole('button', { name: /start over|retake|again|फिर से|পুনরায়/i }).first();
    if (await retakeBtn.isVisible({ timeout: 400 }).catch(() => false)) {
      await retakeBtn.click().catch(() => {});
      await p.waitForTimeout(400);
    }
    const adultBtn = p.getByRole('button', { name: /adult|वयस्क|প্রাপ্তবয়স্ক/i }).first();
    if (await adultBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await adultBtn.click().catch(() => {});
      await p.waitForTimeout(150);
      const nextBtn = p.getByRole('button', { name: /next|आगे|পরবর্তী/i }).first();
      if (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nextBtn.click().catch(() => {});
        await p.waitForTimeout(300);
      }
    }
    return orig.fill(value, options);
  };
  return wrapped;
};

export const submitBtn = (p: Page): Locator => {
  const orig = p.getByRole('button', { name: new RegExp(cfg.sel.submitName, 'i') }).first();
  const wrapped = Object.create(orig);
  wrapped.click = async (options?: any) => {
    const step1Btn = p.getByRole('button', { name: /analy[sz]e|लक्षणों का विश्लेषण|continue/i }).first();
    if (await step1Btn.isVisible({ timeout: 600 }).catch(() => false)) {
      await step1Btn.click().catch(() => {});
      await p.waitForTimeout(100);
    }
    if (await p.getByText(cfg.sel.uiL4).first().isVisible().catch(() => false)) return;
    const step2Btn = p.getByRole('button', { name: /urgency|level|result|परिणाम|ফলাফল|तत्कालता|জরুরি/i }).first();
    try {
      await step2Btn.waitFor({ state: 'visible', timeout: 1500 });
      return await step2Btn.click(options);
    } catch {
      if (await orig.isVisible().catch(() => false)) {
        return await orig.click(options);
      }
    }
  };
  return wrapped;
};

export async function resultText(p: Page): Promise<string> {
  const main = p.locator('main');
  return ((await main.count()) ? await main.first().innerText() : await p.locator('body').innerText()).trim();
}

export async function ensureShell(p: Page, targetHash?: string) {
  const enterBtn = p.getByRole('button', { name: /enter swasthyasetu/i }).first();
  if (await enterBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await enterBtn.click().catch(() => {});
    await p.waitForTimeout(300);
  }
  if (targetHash) {
    const cleanHash = targetHash.startsWith('/#') ? targetHash.slice(1) : targetHash.startsWith('#') ? targetHash : `#${targetHash}`;
    await p.evaluate((h) => { window.location.hash = h; }, cleanHash).catch(() => {});
    await p.waitForTimeout(300);
  }
}

export async function ui_login(page: Page, user: string, pass: string): Promise<boolean> {
  await page.goto(cfg.web + cfg.routes.login);
  await ensureShell(page, cfg.routes.login);
  await page.waitForTimeout(300);

  // If already logged in as this exact user, return true immediately
  const alreadyThisUser = await page.evaluate((u) => {
    try {
      const state = JSON.parse(localStorage.getItem('ss-state') || '{}');
      return !!state.state?.token && state.state?.username === u;
    } catch { return false; }
  }, user);
  if (alreadyThisUser) return true;

  // Clear stale session so fresh login can occur
  await page.evaluate(() => {
    try {
      const state = JSON.parse(localStorage.getItem('ss-state') || '{}');
      if (state.state) { state.state.token = null; state.state.username = null; state.state.role = null; }
      localStorage.setItem('ss-state', JSON.stringify(state));
    } catch {}
  });
  await page.reload();
  await page.waitForTimeout(400);

  // If login modal is not yet open, click button to open it
  let passLoc = page.locator('input[type="password"]').first();
  if (!(await passLoc.isVisible().catch(() => false))) {
    const openModalBtn = page.getByRole('button', { name: /log ?in|sign ?in/i }).first();
    if (await openModalBtn.isVisible().catch(() => false)) {
      await openModalBtn.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  }

  let userLoc = page.locator('input:not([type="password"])').last();
  if (!(await userLoc.count())) {
    userLoc = page.getByPlaceholder(/user(name)?|asha|admin|phone/i).first();
  }
  if (await userLoc.count()) await userLoc.fill(user).catch(() => {});

  passLoc = page.locator('input[type="password"]').first();
  if (await passLoc.count()) await passLoc.fill(pass).catch(() => {});

  const submit = page.getByRole('button', { name: /log ?in|sign ?in/i }).last();
  if (await submit.count()) await submit.click().catch(() => {});

  for (let i = 0; i < 25; i++) {
    const authed = await page.evaluate(() => {
      try {
        const state = JSON.parse(localStorage.getItem('ss-state') || '{}');
        return !!state.state?.token;
      } catch {
        return false;
      }
    });
    if (authed) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

export interface ApiSession { status: number; access: string | null; refresh: string | null; body: any }
export async function apiLogin(user: string, pass: string): Promise<ApiSession> {
  const ctx = await request.newContext({ baseURL: cfg.api });
  let r = await ctx.post(cfg.paths.login, { data: { username: user, password: pass } });
  if ([415, 422].includes(r.status())) r = await ctx.post(cfg.paths.login, { form: { username: user, password: pass } });
  const body = await r.json().catch(() => ({}));
  await ctx.dispose();
  return { status: r.status(), access: body.access_token ?? body.token ?? null, refresh: body.refresh_token ?? null, body };
}

export async function apiGet(access: string, p: string) {
  const ctx = await request.newContext({ baseURL: cfg.api });
  const r = await ctx.get(p, { headers: { Authorization: `Bearer ${access}` } });
  const body = await r.json().catch(() => null);
  await ctx.dispose();
  return { status: r.status(), body };
}

// ---- spec-driven form filling (forms.json is produced/confirmed in Phase 1) ----
export interface FieldSpec { label: string; value: string; kind?: 'text' | 'select' | 'check' }
export interface FormSpec { route?: string; fields: FieldSpec[]; submit: string }

export function loadForms(): Record<string, FormSpec> | null {
  const p = path.join(ROOT, 'forms.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

export const tmpl = (s: string, vars: Record<string, string>) =>
  s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);

export async function fillForm(page: Page, spec: FormSpec, vars: Record<string, string>) {
  await ensureShell(page, spec.route);

  // If in AshaPortal, navigate to tab and open modal if needed
  if (spec.route?.includes('asha/portal') || page.url().includes('asha/portal')) {
    const isReferral = spec.fields.some((f) => /urgency|from\s*facility|to\s*facility|refer/i.test(f.label));
    const isPatient = !isReferral && spec.fields.some((f) => /patient|display|dob|birth/i.test(f.label));
    if (isReferral) {
      const tab = page.getByRole('button', { name: /referrals/i }).first();
      if (await tab.isVisible({ timeout: 1000 }).catch(() => false)) await tab.click().catch(() => {});
      const newBtn = page.getByRole('button', { name: /create referral|new referral/i }).first();
      if (await newBtn.isVisible({ timeout: 1000 }).catch(() => false)) await newBtn.click().catch(() => {});
      const patSelect = page.locator('select').filter({ hasText: /select patient/i }).first();
      if (await patSelect.isVisible({ timeout: 500 }).catch(() => false)) {
        await patSelect.selectOption({ index: 1 }).catch(() => {});
      }
    } else if (isPatient) {
      const tab = page.getByRole('button', { name: /patients/i }).first();
      if (await tab.isVisible({ timeout: 1000 }).catch(() => false)) await tab.click().catch(() => {});
      const newBtn = page.getByRole('button', { name: /new patient/i }).first();
      if (await newBtn.isVisible({ timeout: 1000 }).catch(() => false)) await newBtn.click().catch(() => {});
    }
  }

  for (const f of spec.fields) {
    const v = tmpl(f.value, vars);
    const re = new RegExp(f.label, 'i');
    let loc = page.getByLabel(re).first();
    if (!(await loc.count())) {
      loc = page.getByPlaceholder(re).first();
    }
    if (!(await loc.count())) {
      loc = page.locator('label').filter({ hasText: re }).locator('..').locator('input, select, textarea').first();
    }
    if (!(await loc.count())) {
      loc = page.locator('div').filter({ hasText: re }).locator('input, select, textarea').first();
    }
    if (await loc.count()) {
      if (f.kind === 'select') {
        await loc.selectOption({ label: new RegExp(v, 'i') as any }).catch(() => loc.selectOption(v)).catch(() => {});
      } else if (f.kind === 'check') {
        await loc.setChecked(v !== 'false').catch(() => {});
      } else {
        await loc.fill(v).catch(() => {});
      }
    }
  }
  const dialogBtn = page.locator('.fixed, [role="dialog"], form').getByRole('button', { name: new RegExp(spec.submit, 'i') }).first();
  if (await dialogBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await dialogBtn.click().catch(() => {});
  } else {
    await page.getByRole('button', { name: new RegExp(spec.submit, 'i') }).last().click().catch(() => {});
  }
  await page.waitForTimeout(1000);
}
