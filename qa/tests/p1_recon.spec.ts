import { test } from '@playwright/test';
import { cfg } from '../lib/config';
import { writeJson } from '../lib/evidence';

// Phase 1: map what the UI actually exposes so later phases use real selectors, not guesses.
// Output: results/recon/ui_map.json  (the agent reviews it and writes forms.json from it)
test('P1 crawl routes and inventory controls', async ({ page }) => {
  const routes = [cfg.routes.home, cfg.routes.login, cfg.routes.triage, cfg.routes.cost,
    cfg.routes.facilities, cfg.routes.worklist, cfg.routes.refreshRace];
  const map: Record<string, unknown> = {};
  for (const r of new Set(routes)) {
    const resp = await page.goto(cfg.web + r).catch((e) => ({ status: () => -1, err: String(e) } as any));
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    map[r] = await page.evaluate(() => ({
      finalUrl: location.href,
      title: document.title,
      inputs: [...document.querySelectorAll('input,textarea,select')].map((e: any) => ({
        tag: e.tagName, type: e.type, name: e.name, id: e.id, placeholder: e.placeholder,
        label: (e.labels && e.labels[0]?.innerText) || e.getAttribute('aria-label') || '',
        testid: e.getAttribute('data-testid') || '',
      })),
      buttons: [...document.querySelectorAll('button,[role=button],a[href]')].slice(0, 60).map((e: any) => ({
        text: (e.innerText || '').trim().slice(0, 60), href: e.getAttribute('href') || '', testid: e.getAttribute('data-testid') || '',
      })),
    }));
    (map[r] as any).httpStatus = resp ? (resp as any).status() : null;
  }
  writeJson('recon/ui_map.json', map);
});
