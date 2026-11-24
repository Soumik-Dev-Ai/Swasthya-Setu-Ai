import { test, expect } from '@playwright/test';
import { cfg } from '../lib/config';
import { record, shot, writeJson } from '../lib/evidence';
import { captureApi, findKeys, nonEmpty, settle } from '../lib/net';
import { symptomInput, submitBtn, resultText } from '../lib/ui';

const PHRASE = 'fever for 4 days, dry cough, mild fatigue';   // exact example from the blueprint's Flow 2

test('P2 Flow 2: which endpoints does text triage actually call?', async ({ page }) => {
  const log = captureApi(page);
  await page.goto(cfg.web + cfg.routes.triage);
  const start = log.length;
  await symptomInput(page).fill(PHRASE);
  await submitBtn(page).click();
  await settle(page, 2500);

  const calls = log.slice(start).filter((e) => e.method !== 'OPTIONS');
  const sequence = calls.map((e) => `${e.method} ${e.path} -> ${e.status} (${e.ms ?? '?'}ms)`);
  const hit = (re: RegExp) => calls.filter((e) => re.test(e.path));
  const intent = hit(cfg.re.intent), reason = hit(cfg.re.reason), analyze = hit(cfg.re.analyze);

  const grounding = calls.flatMap((e) =>
    findKeys(e.body, /^grounding_(reference|references|quote)s?$/i).filter(([, v]) => nonEmpty(v)).map(([k, v]) => ({ path: e.path, key: k, value: v })));
  const abstained = calls.some((e) => findKeys(e.body, /^(abstain(ed)?|needs_manual_confirmation)$/i).some(([, v]) => v === true));
  const text = await resultText(page);
  const screenshot = await shot(page, 'P2-FLOW2');

  writeJson('flow2_grounding.json', { phrase: PHRASE, grounding, sequence });

  let status: 'PASS' | 'FAIL' | 'PARTIAL' | 'BLOCKED';
  let verdict: string;
  if (calls.length === 0) { status = 'BLOCKED'; verdict = 'No API call fired: selectors in .env.qa/forms are probably wrong (check results/recon/ui_map.json).'; }
  else if (intent.length && !reason.length && !analyze.length) { status = 'FAIL'; verdict = 'REOPENED doc 27 Priority 1: frontend called the intent endpoint only; the Reasoning Engine endpoint was never called (bypass).'; }
  else if (!grounding.length && abstained) { status = 'PARTIAL'; verdict = 'Reasoning ran but abstained; no grounding to verify (acceptable behaviour, but claim "grounded answer" not demonstrated).'; }
  else if (!grounding.length) { status = 'FAIL'; verdict = 'Result returned with NO grounding_reference: answer is not traceable to a retrieved guideline chunk.'; }
  else { status = 'PASS'; verdict = (analyze.length && !reason.length && !intent.length ? 'Consolidated gateway: /triage/analyze alone carried the reasoning (blueprint design). ' : '') + 'Reasoning/analyze endpoint called and a non-empty grounding_reference returned. Chunk existence is verified by scripts/verify_grounding.py.'; }

  record({
    id: 'P2-FLOW2-ENDPOINTS', status,
    claim: 'Text triage runs through the Reasoning Engine and returns a grounded result (resolves integration-report vs blueprint contradiction)',
    evidence: { verdict, sequence, calledIntent: intent.length, calledReason: reason.length, calledAnalyze: analyze.length,
      groundingCount: grounding.length, analyzeRequestBody: analyze[0]?.reqBody ?? null,
      providerFields: calls.flatMap((e) => findKeys(e.body, /^(provider|model|llm_provider|backend)$/i)).map(([k, v]) => ({ k, v })), abstained, renderedTextExcerpt: text.slice(0, 600), screenshot },
  });
  expect(status, verdict).not.toBe('FAIL');
});
