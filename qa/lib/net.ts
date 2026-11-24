import { Page, Request } from '@playwright/test';
import { cfg, apiHost } from './config';

export interface Entry {
  seq: number;
  t0: number;            // ms epoch when the request started
  ms: number | null;     // wall time until response finished
  method: string;
  path: string;
  status: number | null;
  reqBody: string | null;
  body: unknown;
}

/** Records every request to the backend, in the order the browser issued them. */
export function captureApi(page: Page): Entry[] {
  const log: Entry[] = [];
  const byReq = new Map<Request, Entry>();
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.host !== apiHost && !u.pathname.startsWith('/api')) return;
    // Only real data calls. Without this, a same-origin deployment would count the HTML page itself as an
    // "API response" and make hard-coded numbers look backend-sourced (caught by the harness self-test).
    if (!['fetch', 'xhr'].includes(req.resourceType())) return;
    const e: Entry = { seq: log.length, t0: Date.now(), ms: null, method: req.method(), path: u.pathname,
      status: null, reqBody: req.postData() ?? null, body: null };
    log.push(e); byReq.set(req, e);
  });
  page.on('response', async (resp) => {
    const e = byReq.get(resp.request());
    if (!e) return;
    e.status = resp.status();
    try {
      const txt = await resp.text();
      e.ms = Date.now() - e.t0;
      try { e.body = JSON.parse(txt); } catch { e.body = txt.slice(0, 20000); }
    } catch { e.ms = Date.now() - e.t0; }
  });
  return log;
}

/** Hosts contacted by the browser that are neither the frontend nor the backend (CDNs/fonts excluded by caller). */
export function captureExternalHosts(page: Page, webHost: string): Set<string> {
  const hosts = new Set<string>();
  page.on('request', (req) => {
    const h = new URL(req.url()).host;
    if (h && h !== webHost && h !== apiHost && !req.url().startsWith('data:')) hosts.add(h);
  });
  return hosts;
}

/** Depth-first search for keys matching `re`; returns [key, value] pairs. */
export function findKeys(o: unknown, re: RegExp, out: Array<[string, unknown]> = []): Array<[string, unknown]> {
  if (Array.isArray(o)) o.forEach((x) => findKeys(x, re, out));
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (re.test(k)) out.push([k, v]);
      findKeys(v, re, out);
    }
  }
  return out;
}

export const nonEmpty = (v: unknown): boolean =>
  v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0) &&
  !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0);

export function allNumbers(o: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof o === 'number') out.add(String(o));
  else if (typeof o === 'string') (o.match(/\d[\d,]*\.?\d*/g) || []).forEach((m) => out.add(m.replace(/,/g, '')));
  else if (Array.isArray(o)) o.forEach((x) => allNumbers(x, out));
  else if (o && typeof o === 'object') Object.values(o as object).forEach((x) => allNumbers(x, out));
  return out;
}

/** Poll until a predicate over entries added since `from` is satisfied, or timeout. */
export async function waitFor(log: Entry[], from: number, pred: (e: Entry[]) => boolean, timeoutMs = 20_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const slice = log.slice(from);
    if (pred(slice)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

/** Let in-flight responses finish. */
export async function settle(page: Page, ms = 1200) {
  await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  await page.waitForTimeout(ms);
}

export const isApi = (url: string) => url.startsWith(cfg.api) || url.includes('/api');
