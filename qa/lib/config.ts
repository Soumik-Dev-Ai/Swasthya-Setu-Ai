import * as fs from 'fs';
import * as path from 'path';

export const ROOT = path.resolve(__dirname, '..');
const envFile = path.join(ROOT, '.env.qa');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).replace(/\s+#.*$/, '').trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const e = (k: string, d: string): string => (process.env[k] && process.env[k] !== '' ? (process.env[k] as string) : d);
const trim = (s: string) => s.replace(/\/$/, '');

/** Every project-specific assumption lives here and is overridable from .env.qa.
 *  Phase 1 (recon) exists to find the real values; do not hard-code them elsewhere. */
export const cfg = {
  web: trim(e('WEB_BASE', 'http://localhost:5173')),
  api: trim(e('API_BASE', 'http://localhost:8000')),
  apiDegraded: trim(e('API_BASE_DEGRADED', '')),   // backend started with invalid LLM/vision keys
  runId: e('RUN_ID', String(Date.now())),

  routes: {
    home: e('ROUTE_HOME', '/'),
    login: e('ROUTE_LOGIN', '/login'),
    triage: e('ROUTE_TRIAGE', '/triage'),
    cost: e('ROUTE_COST', '/cost'),
    facilities: e('ROUTE_FACILITIES', '/facilities'),
    worklist: e('ROUTE_WORKLIST', '/followups'),
    refreshRace: e('ROUTE_REFRESH_RACE', '/dashboard'), // an authenticated page that fires >=3 API calls on mount
  },

  paths: {
    login: e('API_LOGIN_PATH', '/auth/login'),
    refresh: e('API_REFRESH_PATH', '/auth/refresh'),
    approve: e('API_APPROVE_PATH', '/admin/users/{id}/approve'),   // {id} or {username} substituted
    patients: e('API_PATIENTS_PATH', '/patients'),
  },

  // Regexes identifying the triage endpoints (Flow 2 contradiction test).
  re: {
    intent: new RegExp(e('RE_INTENT', '/v3/intent\\b')),
    reason: new RegExp(e('RE_REASON', '/v3/reason\\b')),
    analyze: new RegExp(e('RE_ANALYZE', '/triage/analyze\\b')),
    cost: new RegExp(e('RE_COST', '/(cost|estimate|scheme)')),
  },

  sel: {
    symptom: e('SEL_SYMPTOM', 'textarea, input[type=text]'),
    submitName: e('SEL_SUBMIT_NAME', 'analy[sz]e|submit|check|assess|get (result|advice)'),
    uiL4: new RegExp(e('RE_UI_L4', 'level\\s*4|\\bL4\\b|emergency|call 108|critical'), 'i'),
  },

  creds: {
    adminUser: e('QA_ADMIN_USER', ''), adminPass: e('QA_ADMIN_PASS', ''),
    ashaUser: e('QA_ASHA_USER', ''), ashaPass: e('QA_ASHA_PASS', ''),
  },

  providerHosts: ['generativelanguage.googleapis.com', 'api.groq.com', 'integrate.api.nvidia.com'],
  results: path.join(ROOT, 'results'),
};

export const webHost = new URL(cfg.web).host;
export const apiHost = new URL(cfg.api).host;
