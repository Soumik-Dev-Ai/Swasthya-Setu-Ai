import * as fs from 'fs';
import * as path from 'path';
import { Page } from '@playwright/test';
import { cfg } from './config';

export type Status = 'PASS' | 'FAIL' | 'PARTIAL' | 'BLOCKED';

/** BLOCKED = the check could not be executed (wrong selector, missing fixture, tool missing).
 *  It is NEVER counted as a pass. PARTIAL = executed, but only part of the claim was shown. */
export function record(r: { id: string; claim: string; status: Status; evidence: unknown }) {
  fs.mkdirSync(cfg.results, { recursive: true });
  fs.appendFileSync(
    path.join(cfg.results, 'results.jsonl'),
    JSON.stringify({ ...r, ts: new Date().toISOString() }) + '\n',
  );
  const dir = path.join(cfg.results, 'evidence');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${r.id}.json`), JSON.stringify(r, null, 2));
}

export async function shot(page: Page, id: string): Promise<string> {
  const dir = path.join(cfg.results, 'screens');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `${id}.png`);
  await page.screenshot({ path: p, fullPage: true }).catch(() => undefined);
  return p;
}

export function writeJson(rel: string, data: unknown) {
  const p = path.join(cfg.results, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}
