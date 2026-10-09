import fs from 'node:fs';
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs';
import { decideHealthRetry } from './lib/health-retry-policy.mjs';

const origin = 'https://yapweijun1996.github.io';
const retryBudget = Math.max(0, Math.min(3, Number.parseInt(process.env.HEALTH_RETRIES || '2', 10) || 0));
const delayMs = Math.max(0, Math.min(5000, Number.parseInt(process.env.HEALTH_DELAY_MS || '125', 10) || 0));
const requestedIds = (process.env.HEALTH_IDS || '').split(',').map((value) => value.trim()).filter(Boolean);

const report = {
  origin,
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  evidenceModel: 'first pass is immutable evidence; retry-eligible first-pass failures receive bounded fresh-browser retries, provider-declared rate-limit backoff can defer same-run retries, and cadence-limited providers are excluded from generic automation',
  healthSemantics: 'point-in-time observational evidence only; never written into api-catalog.json health',
  classificationSemantics: 'same-run retry exhaustion is unresolved evidence, not proof of persistent provider failure; later independent browser confirmation is required before classifying durable drift',
  retryBudget,
  delayMs,
  firstPass: [],
  retries: {},
  retryDeferrals: {},
  summary: {},
  errors: [],
};

const sanitizeNetworkFailure = (failure) => {
  let endpoint = '';
  try {
    const url = new URL(failure.url || '');
    endpoint = `${url.origin}${url.pathname}`;
  } catch {}
  return {
    endpoint,
    errorText: failure.errorText || '',
    blockedReason: failure.blockedReason || '',
    corsError: failure.corsErrorStatus?.corsError || '',
    corsFailedParameter: failure.corsErrorStatus?.failedParameter || '',
  };
};

const probe = async (b, id, phase, attempt) => {
  const startedAt = Date.now();
  try {
    await b.ev(`location.hash=${JSON.stringify(`#/request-lab?api=${id}`)}`);
    await b.wait(`document.querySelector('.request-lab')?.dataset.apiId===${JSON.stringify(id)} && !!document.querySelector('form.parameter-card')`);
    const networkFailureStart = b.networkFailures.length;
    const result = await b.run();
    const networkFailures = b.networkFailures.slice(networkFailureStart).map(sanitizeNetworkFailure);
    const dom = await b.ev(`(() => {
      const lab = document.querySelector('.request-lab');
      const preview = document.querySelector('.demo-preview');
      const error = document.querySelector('.response-error');
      return {
        state: lab?.dataset.requestState || '',
        agentExecution: lab?.dataset.agentExecution || '',
        design: preview?.dataset.ssotDesign || '',
        layout: preview?.dataset.previewLayout || '',
        fallback: preview?.dataset.ssotFallback || '',
        apiId: preview?.dataset.apiId || '',
        errorType: error?.dataset.errorType || '',
        httpStatus: error?.dataset.httpStatus || '',
        documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    })()`);
    const semanticOk = result.ok && dom.state === 'success' && dom.agentExecution === 'enabled' && dom.apiId === id && dom.design === 'result-card-v2' && dom.fallback === 'false' && !dom.documentOverflow;
    return {
      id,
      phase,
      attempt,
      ok: semanticOk,
      requestOk: result.ok,
      elapsedMs: Date.now() - startedAt,
      state: dom.state,
      agentExecution: dom.agentExecution,
      design: dom.design,
      layout: dom.layout,
      fallback: dom.fallback,
      documentOverflow: dom.documentOverflow,
      errorType: result.ok ? '' : (result.errorType || dom.errorType || 'unknown'),
      httpStatus: result.httpStatus || dom.httpStatus || '',
      networkFailures,
      browserFailureClass: networkFailures.some((failure) => failure.corsError) ? 'cors' : networkFailures.length ? 'network' : '',
      error: result.ok ? (semanticOk ? '' : 'Successful request did not satisfy the SSOT result-card contract.') : String(result.error || '').slice(0, 500),
    };
  } catch (error) {
    return {
      id,
      phase,
      attempt,
      ok: false,
      requestOk: false,
      elapsedMs: Date.now() - startedAt,
      state: 'harness-error',
      agentExecution: '',
      design: '',
      layout: '',
      fallback: '',
      documentOverflow: false,
      errorType: 'harness-error',
      httpStatus: '',
      networkFailures: [],
      browserFailureClass: '',
      error: String(error).slice(0, 500),
    };
  }
};

const openCandidateBrowser = async () => {
  const b = await browser(root + '/dist');
  await b.call('Page.navigate', { url: `${origin}/Public-API/#/catalog` });
  await b.wait(`Boolean(document.querySelector('main'))`);
  return b;
};

let catalog;
let ids;
let manualOnly;
let cadenceLimited;
let verificationPolicyById = new Map();
let firstBrowser;
try {
  firstBrowser = await openCandidateBrowser();
  catalog = await firstBrowser.ev(`fetch('/Public-API/api-catalog.json', {cache:'no-store'}).then(response => response.json())`);
  if (catalog?.health !== 'not-included') throw new Error('Machine catalog must not synthesize live health.');
  const enabledApis = catalog.apis.filter((api) => api.agentExecution?.mode === 'enabled');
  const enabled = enabledApis.map((api) => api.id);
  const verificationEligible = enabledApis.filter((api) => api.automatedVerification?.mode !== 'cadence-limited').map((api) => api.id);
  verificationPolicyById = new Map(enabledApis.map((api) => [api.id, api.automatedVerification ?? catalog.automatedVerificationDefault ?? { mode: 'enabled' }]));
  cadenceLimited = enabledApis.filter((api) => api.automatedVerification?.mode === 'cadence-limited').map((api) => ({
    id: api.id,
    minimumIntervalSeconds: api.automatedVerification.minimumIntervalSeconds,
    retryOnNon2xx: api.automatedVerification.retryOnNon2xx,
    policyUrl: api.automatedVerification.policyUrl || '',
  }));
  manualOnly = catalog.apis.filter((api) => api.agentExecution?.mode === 'manual-only').map((api) => api.id);
  if (requestedIds.length) {
    const unknown = requestedIds.filter((id) => !enabled.includes(id));
    if (unknown.length) throw new Error(`HEALTH_IDS contains unknown or non-agent-enabled IDs: ${unknown.join(', ')}`);
    const cadenceBlocked = requestedIds.filter((id) => !verificationEligible.includes(id));
    if (cadenceBlocked.length) throw new Error(`HEALTH_IDS contains cadence-limited providers excluded from generic automated verification: ${cadenceBlocked.join(', ')}`);
    ids = requestedIds;
  } else {
    ids = verificationEligible;
  }
  report.catalogCount = catalog.catalogCount;
  report.agentEnabledCount = enabled.length;
  report.automatedVerificationEligibleCount = verificationEligible.length;
  report.manualOnly = manualOnly;
  report.cadenceLimited = cadenceLimited;
  report.selectedCount = ids.length;

  console.log(`Health sweep: ${ids.length} automated-verification APIs; ${manualOnly.length} manual-only and ${cadenceLimited.length} cadence-limited APIs excluded.`);
  for (const [index, id] of ids.entries()) {
    const row = await probe(firstBrowser, id, 'first-pass', 0);
    report.firstPass.push(row);
    console.log(`${String(index + 1).padStart(3, '0')}/${ids.length} ${id}: ${row.ok ? 'PASS' : `FAIL ${row.errorType}${row.httpStatus ? ` HTTP ${row.httpStatus}` : ''}`}`);
    if (delayMs) await sleep(delayMs);
  }
} catch (error) {
  report.errors.push(String(error));
} finally {
  if (firstBrowser) {
    report.errors.push(...firstBrowser.errors.map(String));
    await firstBrowser.close();
  }
}

if (report.firstPass.length) {
  const failures = report.firstPass.filter((row) => !row.ok);
  for (const failure of failures) {
    report.retries[failure.id] = [];
    const retryDecision = decideHealthRetry(failure, verificationPolicyById.get(failure.id));
    if (!retryDecision.retry) {
      report.retryDeferrals[failure.id] = retryDecision;
      console.log(`retry deferred ${failure.id}: ${retryDecision.reason}`);
      continue;
    }
    for (let attempt = 1; attempt <= retryBudget; attempt += 1) {
      let retryBrowser;
      try {
        retryBrowser = await openCandidateBrowser();
        const retry = await probe(retryBrowser, failure.id, 'fresh-browser-retry', attempt);
        report.retries[failure.id].push(retry);
        console.log(`retry ${attempt}/${retryBudget} ${failure.id}: ${retry.ok ? 'RECOVERED' : `FAIL ${retry.errorType}${retry.httpStatus ? ` HTTP ${retry.httpStatus}` : ''}`}`);
        if (retry.ok) break;
      } catch (error) {
        report.retries[failure.id].push({ id: failure.id, phase: 'fresh-browser-retry', attempt, ok: false, requestOk: false, state: 'harness-error', errorType: 'harness-error', httpStatus: '', elapsedMs: 0, error: String(error).slice(0, 500) });
      } finally {
        if (retryBrowser) {
          report.errors.push(...retryBrowser.errors.map(String));
          await retryBrowser.close();
        }
      }
    }
  }

  const firstPassFailures = report.firstPass.filter((row) => !row.ok);
  const recovered = firstPassFailures.filter((row) => report.retries[row.id]?.some((retry) => retry.ok));
  const deferred = firstPassFailures.filter((row) => report.retryDeferrals[row.id]);
  const retryExhausted = firstPassFailures.filter((row) => !report.retryDeferrals[row.id] && !report.retries[row.id]?.some((retry) => retry.ok));
  const unresolved = firstPassFailures.filter((row) => !report.retries[row.id]?.some((retry) => retry.ok));
  report.summary = {
    firstPassTotal: report.firstPass.length,
    firstPassSuccesses: report.firstPass.filter((row) => row.ok).length,
    firstPassFailures: firstPassFailures.map((row) => row.id),
    recoveredTransients: recovered.map((row) => row.id),
    deferredRateLimits: deferred.filter((row) => report.retryDeferrals[row.id]?.reason === 'rate-limit-backoff').map((row) => row.id),
    retryExhausted: retryExhausted.map((row) => row.id),
    unresolvedAfterRetries: unresolved.map((row) => row.id),
  };
  if (unresolved.length) {
    report.followUp = {
      status: 'required',
      reason: deferred.length
        ? 'One or more provider SSOT policies require backoff after a provider-declared rate-limit response, so no same-run retry was sent. Preserve the unresolved first-pass evidence and recheck in a later independent run rather than calling the provider persistently down.'
        : 'The bounded same-run retry window was exhausted. Preserve this evidence, but do not call the provider persistently down without a later independent browser check.',
      command: `HEALTH_IDS=${unresolved.map((row) => row.id).join(',')} HEALTH_RETRIES=0 npm run test:browser:health-sweep`,
    };
  }
  report.verdict = unresolved.length ? 'INVESTIGATE' : recovered.length ? 'PASS_WITH_TRANSIENTS' : 'PASS';
} else {
  report.verdict = 'FAIL';
  report.summary = { firstPassTotal: 0, firstPassSuccesses: 0, firstPassFailures: [], recoveredTransients: [], unresolvedAfterRetries: [] };
}

fs.writeFileSync(`${evidence}/browser-health-sweep.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ verdict: report.verdict, catalogCount: report.catalogCount, agentEnabledCount: report.agentEnabledCount, automatedVerificationEligibleCount: report.automatedVerificationEligibleCount, manualOnly: report.manualOnly, cadenceLimited: report.cadenceLimited, retryDeferrals: report.retryDeferrals, ...report.summary, evidence: `${evidence}/browser-health-sweep.json` }, null, 2));
process.exit(['PASS', 'PASS_WITH_TRANSIENTS'].includes(report.verdict) ? 0 : 1);
