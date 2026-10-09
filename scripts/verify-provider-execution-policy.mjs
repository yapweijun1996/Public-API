import fs from 'node:fs';
import assert from 'node:assert/strict';
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs';

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle',
  providerPolicy: 'Manual-only provider policies and bounded usage constraints are derived from the catalog SSOT',
  checks: [],
  errors: [],
};
const cvePattern = 'CVE-[0-9]{4}-[0-9]{4,}';
console.log('Evidence directory:', evidence);

const colorFixtureUrl = 'https://www.thecolorapi.com/id?hex=24B1E0';
const colorFixture = {
  hex: { value: '#24b1e0' }, name: { value: 'Cerulean', exact_match_name: false, closest_named_hex: '#1DACD6' },
  rgb: { value: 'rgb(36, 177, 224)' }, hsl: { value: 'hsl(195, 75%, 51%)' },
  hsv: { value: 'hsv(195, 84%, 88%)' }, cmyk: { value: 'cmyk(84, 21, 0, 12)' },
  XYZ: { value: 'XYZ(46, 59, 92)' }, contrast: { value: '#000000' },
};
const b = await browser(root + '/dist', {
  fixtures: new Map([[colorFixtureUrl, { body: colorFixture }]]),
  blockedProviderPatterns: ['https://vulnerability.circl.lu/*', 'https://services.nvd.nist.gov/*'],
});
try {
  await b.call('Page.navigate', { url: `${report.origin}/Public-API/#/catalog` });
  await b.wait(`Boolean(document.modelContext?.getTools) && document.querySelector('.agent-connection')?.textContent?.includes('Agent connected')`);
  const nativeTools = await b.ev(`document.modelContext.getTools().then(tools => tools.map(tool => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })))`);
  assert.equal(nativeTools.length, 5);
  const nativeRunTool = nativeTools.find((tool) => tool.name === 'run_public_api_demo');
  assert(nativeRunTool);
  const nativeRunSchema = typeof nativeRunTool.inputSchema === 'string' ? JSON.parse(nativeRunTool.inputSchema) : nativeRunTool.inputSchema;
  const nativeRunIds = nativeRunSchema?.properties?.id?.enum ?? [];
  assert.equal(nativeRunIds.length, 193);
  assert(!nativeRunIds.includes('languagetool-grammar-check'));
  assert(!nativeRunIds.includes('nominatim-search'));
  assert(!nativeRunIds.includes('circl-vulnerability'));
  assert(!nativeRunIds.includes('internet-archive-search'));
  assert(nativeRunIds.includes('color-api'));
  report.checks.push({ nativeWebMcp: 'PASS', browser: 'Chrome testing feature', registeredTools: nativeTools.map((tool) => tool.name).sort(), runnableIds: nativeRunIds.length });

  const getNativeToolSchema = (name) => {
    const tool = nativeTools.find((candidate) => candidate.name === name);
    assert(tool, `Missing native WebMCP tool: ${name}`);
    return typeof tool.inputSchema === 'string' ? JSON.parse(tool.inputSchema) : tool.inputSchema;
  };
  const executeNativeTool = async (name, input = {}) => {
    const inputJson = JSON.stringify(input);
    const result = await b.ev(`document.modelContext.getTools().then(async tools => {
      const tool = tools.find(candidate => candidate.name === ${JSON.stringify(name)});
      if (!tool) return { ok: false, message: 'WEBMCP_TOOL_NOT_FOUND' };
      try {
        const value = await document.modelContext.executeTool(tool, ${JSON.stringify(inputJson)});
        return { ok: true, value };
      } catch (error) {
        return { ok: false, message: String(error?.message || error) };
      }
    })`);
    if (result.ok && typeof result.value === 'string') {
      try {
        return { ...result, value: JSON.parse(result.value) };
      } catch {
        return result;
      }
    }
    return result;
  };
  const waitForCatalog = async () => {
    await b.wait(`document.querySelector('.table-footer')?.dataset.pageCount === '4' && document.querySelectorAll('input[name=\"selected-api\"]').length > 0`);
  };
  const setCatalogSearch = async (value) => {
    await b.ev(`(() => {
      const input = document.querySelector('.module-search input');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(value)} }));
    })()`);
    await b.wait(`document.querySelector('.module-search input')?.value === ${JSON.stringify(value)}`);
    await sleep(50);
  };

  await waitForCatalog();
  const catalogDocumentationLinks = [];
  for (let page = 1; page <= 4; page += 1) {
    const pageLinks = await b.ev(`[...document.querySelectorAll('a[data-api-docs-for]')].map(link => ({ id: link.dataset.apiDocsFor, label: link.getAttribute('aria-label') || '' }))`);
    catalogDocumentationLinks.push(...pageLinks);
    if (page < 4) {
      await b.ev(`document.querySelector('button[aria-label="Next catalog page"]').click()`);
      await b.wait(`document.querySelector('.table-footer')?.dataset.catalogPage === ${JSON.stringify(String(page + 1))}`);
    }
  }
  assert.equal(catalogDocumentationLinks.length, 196);
  assert.equal(new Set(catalogDocumentationLinks.map((link) => link.id)).size, 196);
  assert.equal(new Set(catalogDocumentationLinks.map((link) => link.label)).size, 196);
  assert.deepEqual(catalogDocumentationLinks.find((link) => link.id === 'countries'), { id: 'countries', label: 'Open Country Explorer documentation' });
  assert.equal(await b.ev(`document.querySelectorAll('tbody tr[data-api-id]').length`), catalogDocumentationLinks.length % 50 || 50);
  report.checks.push({ catalogPagination: 'PASS', pageSize: 50, pages: 4, exactCoverage: 196, catalogDocumentationAccessibleNames: 'PASS', uniqueNames: 196 });

  const discoveryResult = await executeNativeTool('list_public_api_demos', { query: 'LanguageTool', category: 'Language' });
  assert.equal(discoveryResult.ok, true, discoveryResult.message);
  const discovery = discoveryResult.value;
  assert.equal(discovery.count, 1);
  assert.equal(discovery.demos[0].id, 'languagetool-grammar-check');
  assert.equal(discovery.demos[0].responseType, 'json');
  assert.equal(discovery.demos[0].agentExecution.mode, 'manual-only');
  assert.match(discovery.demos[0].agentExecution.reason, /prohibits automated requests/i);
  assert.equal(discovery.demos[0].agentExecution.policyUrl, 'https://dev.languagetool.org/public-http-api.html');
  assert.match(discovery.demos[0].usageNote, /interactive, human-driven checks/i);

  const geocodingDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'place name to coordinates', category: 'Geo' });
  assert.equal(geocodingDiscoveryResult.ok, true, geocodingDiscoveryResult.message);
  const geocodingDiscovery = geocodingDiscoveryResult.value;
  assert.equal(geocodingDiscovery.count, 1);
  assert.equal(geocodingDiscovery.demos[0].id, 'geocoding-search');
  assert.equal(geocodingDiscovery.demos[0].responseType, 'json');
  assert.equal(geocodingDiscovery.demos[0].agentExecution.mode, 'enabled');
  assert.deepEqual(geocodingDiscovery.demos[0].parameters.map((field) => field.id), ['name', 'count']);
  assert.equal(geocodingDiscovery.demos[0].parameters[0].minLength, 2);
  assert.equal(geocodingDiscovery.demos[0].parameters[1].step, 1);
  assert.match(geocodingDiscovery.demos[0].usageNote, /place names and postal codes/i);

  const goModuleDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'Go Module Proxy', category: 'Developer' });
  assert.equal(goModuleDiscoveryResult.ok, true, goModuleDiscoveryResult.message);
  assert.equal(goModuleDiscoveryResult.value.count, 1);
  assert.equal(goModuleDiscoveryResult.value.demos[0].id, 'go-module-proxy');
  assert.equal(goModuleDiscoveryResult.value.demos[0].responseType, 'text');
  assert.deepEqual(goModuleDiscoveryResult.value.demos[0].responseContentTypes, ['text/plain']);

  const taskDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'please show me an API for package deprecation', category: 'Developer' });
  assert.equal(taskDiscoveryResult.ok, true, taskDiscoveryResult.message);
  assert.equal(taskDiscoveryResult.value.count, 1);
  assert.equal(taskDiscoveryResult.value.demos[0].id, 'deps-dev');
  assert(taskDiscoveryResult.value.demos[0].keywords.includes('package deprecation'));

  const geocodeDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'can you find me a place name geocoder', category: 'Geo' });
  assert.equal(geocodeDiscoveryResult.ok, true, geocodeDiscoveryResult.message);
  assert.equal(geocodeDiscoveryResult.value.count, 1);
  assert.equal(geocodeDiscoveryResult.value.demos[0].id, 'geocoding-search');

  const nhtsaDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'NCAP crash test rating', category: 'Vehicle' });
  assert.equal(nhtsaDiscoveryResult.ok, true, nhtsaDiscoveryResult.message);
  assert.equal(nhtsaDiscoveryResult.value.count, 1);
  assert.equal(nhtsaDiscoveryResult.value.demos[0].id, 'nhtsa-safety-ratings');
  assert.deepEqual(nhtsaDiscoveryResult.value.demos[0].parameters.find((field) => field.id === 'vehicleId'), {
    id: 'vehicleId', label: 'NHTSA Vehicle ID', type: 'text', defaultValue: '19426',
    help: 'Enter a canonical VehicleId returned by the NHTSA Safety Ratings API, for example 19426 for a 2024 Toyota Camry FWD. This demo supports IDs from 1 to 999999; that workbench bound is not a provider-wide maximum.',
    minLength: 1, maxLength: 6, pattern: '[1-9][0-9]{0,5}',
    patternDescription: 'must be a canonical positive decimal ID from 1 to 999999.',
  });
  assert.match(nhtsaDiscoveryResult.value.demos[0].usageNote, /Overall Vehicle Score/i);
  assert.match(nhtsaDiscoveryResult.value.demos[0].usageNote, /same class and within ±250 lb/i);
  assert.match(nhtsaDiscoveryResult.value.demos[0].usageNote, /side and rollover ratings may be compared across classes/i);
  report.checks.push({ capabilityDiscovery: 'PASS', nativeQueries: ['please show me an API for package deprecation', 'can you find me a place name geocoder', 'NCAP crash test rating'], sharedKeywordSsot: true, nhtsaComparisonScope: 'PASS' });

  const machineHead = await b.ev(`(() => {
    const link = document.querySelector('link[rel="alternate"][type="application/json"]');
    return { href: link?.href || '', title: link?.getAttribute('title') || '' };
  })()`);
  assert.equal(machineHead.href, `${report.origin}/Public-API/api-catalog.json`);
  assert.equal(machineHead.title, 'Public API machine catalog');
  const machineResponse = await b.ev(`fetch('/Public-API/api-catalog.json', {cache:'no-store'}).then(async response => ({
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    body: await response.json(),
  }))`);
  assert.equal(machineResponse.status, 200);
  assert.match(machineResponse.contentType, /application\/json/i);
  assert.equal(machineResponse.body.schemaVersion, 1);
  assert.equal(machineResponse.body.catalogCount, 196);
  assert.equal(machineResponse.body.health, 'not-included');
  assert.equal(machineResponse.body.apis.length, 196);
  assert(!machineResponse.body.apis.some((api) => api.id === 'musicbrainz-artist-search'));
  assert(!machineResponse.body.apis.some((api) => api.id === 'yahoo-finance-sgx-history'));
  assert(!machineResponse.body.apis.some((api) => api.id === 'gutendex-books'));
  assert(!machineResponse.body.apis.some((api) => api.id === 'crates-io-search'));
  assert(!machineResponse.body.apis.some((api) => api.id === 'nws-weather'));
  assert(!machineResponse.body.apis.some((api) => api.id === 'europe-pmc-search'));
  assert(!machineResponse.body.apis.some((api) => api.id === 'zenodo-search'));
  assert(!machineResponse.body.apis.some((api) => api.id === 'nominatim-search'));
  const machineCountries = machineResponse.body.apis.find((api) => api.id === 'countries');
  const machineLanguageTool = machineResponse.body.apis.find((api) => api.id === 'languagetool-grammar-check');
  const machineGeocoding = machineResponse.body.apis.find((api) => api.id === 'geocoding-search');
  const machineColor = machineResponse.body.apis.find((api) => api.id === 'color-api');
  const machineQr = machineResponse.body.apis.find((api) => api.id === 'qr-code-generator');
  const machineGoModule = machineResponse.body.apis.find((api) => api.id === 'go-module-proxy');
  const machineCelestrak = machineResponse.body.apis.find((api) => api.id === 'celestrak-satellites');
  const machineStackExchange = machineResponse.body.apis.find((api) => api.id === 'stack-exchange');
  const machineHnSearch = machineResponse.body.apis.find((api) => api.id === 'hn-search-algolia');
  const machineLaunchLibrary = machineResponse.body.apis.find((api) => api.id === 'launch-library-upcoming');
  const machineOsrm = machineResponse.body.apis.find((api) => api.id === 'osrm-route');
  const machineOpenTrivia = machineResponse.body.apis.find((api) => api.id === 'open-trivia');
  const machineDevto = machineResponse.body.apis.find((api) => api.id === 'devto');
  const machineNpmSearch = machineResponse.body.apis.find((api) => api.id === 'npm-search');
  const machineGbifOccurrence = machineResponse.body.apis.find((api) => api.id === 'gbif-occurrence-search');
  const machineOpenAlex = machineResponse.body.apis.find((api) => api.id === 'openalex-works-search');
  const machineDataCite = machineResponse.body.apis.find((api) => api.id === 'datacite-search');
  const machineCoinGecko = machineResponse.body.apis.find((api) => api.id === 'coingecko-keyless-market');
  const machineWikidata = machineResponse.body.apis.find((api) => api.id === 'wikidata-sparql');
  const machineLichessApis = ['lichess-top-players', 'chess-player-stats'].map((id) => machineResponse.body.apis.find((api) => api.id === id));
  const machineGitHub = machineResponse.body.apis.find((api) => api.id === 'github');
  const machineGitHubAdvisories = machineResponse.body.apis.find((api) => api.id === 'github-global-advisories');
  const machineNhtsa = machineResponse.body.apis.find((api) => api.id === 'nhtsa-safety-ratings');
  const machineGeoBoundaries = machineResponse.body.apis.find((api) => api.id === 'geoboundaries-admin-boundaries');
  const machineExchangeRates = machineResponse.body.apis.find((api) => api.id === 'exchange-rate-current');
  const machineBrasilPostcode = machineResponse.body.apis.find((api) => api.id === 'brasilapi-postcode');
  const machineUniprot = machineResponse.body.apis.find((api) => api.id === 'uniprot-protein');
  const machinePdb = machineResponse.body.apis.find((api) => api.id === 'rcsb-pdb-entry');
  const machineFirstEpss = machineResponse.body.apis.find((api) => api.id === 'first-epss');
  const machineCircl = machineResponse.body.apis.find((api) => api.id === 'circl-vulnerability');
  const machineInternetArchive = machineResponse.body.apis.find((api) => api.id === 'internet-archive-search');
  const machineNvdApis = ['nvd-cpe-search', 'nvd-cve-detail', 'nvd-cves', 'nvd-recent-cves'].map((id) => machineResponse.body.apis.find((api) => api.id === id));
  const machineNvdCveSearch = machineResponse.body.apis.find((api) => api.id === 'nvd-cves');
  const machineUnhcr = machineResponse.body.apis.find((api) => api.id === 'unhcr-refugees');
  const machineApple = machineResponse.body.apis.find((api) => api.id === 'apple-itunes-search');
  const machineZippopotam = machineResponse.body.apis.find((api) => api.id === 'zippopotam-postcode');
  const machineBankOfCanada = machineResponse.body.apis.find((api) => api.id === 'bank-of-canada-valet');
  const machineSwissTransit = machineResponse.body.apis.find((api) => api.id === 'swiss-transit-connections');
  assert.deepEqual({
    minLength: machineCountries.parameters.find((field) => field.id === 'code')?.minLength,
    maxLength: machineCountries.parameters.find((field) => field.id === 'code')?.maxLength,
    pattern: machineCountries.parameters.find((field) => field.id === 'code')?.pattern,
  }, { minLength: 2, maxLength: 3, pattern: '[A-Za-z]{2,3}' });
  assert.deepEqual({
    minLength: machineBankOfCanada.parameters.find((field) => field.id === 'series')?.minLength,
    pattern: machineBankOfCanada.parameters.find((field) => field.id === 'series')?.pattern,
  }, { minLength: 1, pattern: '[A-Za-z0-9_.-]+' });
  assert.deepEqual({
    fromMinLength: machineSwissTransit.parameters.find((field) => field.id === 'from')?.minLength,
    toMinLength: machineSwissTransit.parameters.find((field) => field.id === 'to')?.minLength,
    limitStep: machineSwissTransit.parameters.find((field) => field.id === 'limit')?.step,
  }, { fromMinLength: 1, toMinLength: 1, limitStep: 1 });
  assert.equal(machineCountries.responseType, 'json');
  assert.equal(machineCountries.responseContentTypes, undefined);
  assert.equal(machineQr.responseType, 'image');
  assert.deepEqual(machineQr.responseContentTypes, ['image/png']);
  assert.equal(machineGoModule.responseType, 'text');
  assert.deepEqual(machineGoModule.responseContentTypes, ['text/plain']);
  assert(machineResponse.body.apis.every((api) => ['json', 'text', 'image'].includes(api.responseType)));
  assert.equal(machineLanguageTool.agentExecution.mode, 'manual-only');
  assert.equal(machineGeocoding.agentExecution.mode, 'enabled');
  assert.deepEqual(machineGeocoding.parameters.map((field) => field.id), ['name', 'count']);
  assert.equal(machineGeocoding.parameters[0].minLength, 2);
  assert.equal(machineGeocoding.parameters[1].step, 1);
  assert.equal(machineCircl.agentExecution.mode, 'manual-only');
  assert.equal(machineCircl.agentExecution.policyUrl, 'https://vulnerability.circl.lu/.well-known/api-policy.json');
  assert.match(machineCircl.agentExecution.reason, /meaningful User-Agent containing a contact URL or email/i);
  assert.match(machineCircl.usageNote, /20 requests per minute/i);
  assert.equal(machineInternetArchive.agentExecution.mode, 'manual-only');
  assert.equal(machineInternetArchive.agentExecution.policyUrl, 'https://archive.org/developers/bots.html');
  assert.match(machineInternetArchive.agentExecution.reason, /descriptive User-Agent identifying the tool\/version and AI model/i);
  assert.match(machineInternetArchive.usageNote, /Human-triggered interactive searches/i);
  assert.equal(machineColor.agentExecution.mode, 'enabled');
  assert.deepEqual({ pattern: machineColor.parameters.find((field) => field.id === 'hex')?.pattern, patternDescription: machineColor.parameters.find((field) => field.id === 'hex')?.patternDescription }, { pattern: '#?(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})', patternDescription: 'must be a 3- or 6-digit hexadecimal color, with an optional leading #.' });
  assert.deepEqual(machineNvdCveSearch.parameters.map((field) => field.id), ['query', 'limit']);
  assert.deepEqual({ minLength: machineNvdCveSearch.parameters[0].minLength, maxLength: machineNvdCveSearch.parameters[0].maxLength }, { minLength: 1, maxLength: 100 });
  assert.deepEqual({ min: machineNvdCveSearch.parameters[1].min, max: machineNvdCveSearch.parameters[1].max }, { min: 1, max: 20 });
  assert.deepEqual({ minLength: machineDevto.parameters.find((field) => field.id === 'tag')?.minLength, limitStep: machineDevto.parameters.find((field) => field.id === 'limit')?.step }, { minLength: 1, limitStep: 1 });
  assert.deepEqual({ queryMinLength: machineNpmSearch.parameters.find((field) => field.id === 'query')?.minLength, limitMin: machineNpmSearch.parameters.find((field) => field.id === 'limit')?.min, limitMax: machineNpmSearch.parameters.find((field) => field.id === 'limit')?.max, limitStep: machineNpmSearch.parameters.find((field) => field.id === 'limit')?.step }, { queryMinLength: 1, limitMin: 1, limitMax: 20, limitStep: 1 });
  assert.deepEqual({ queryMinLength: machineHnSearch.parameters.find((field) => field.id === 'query')?.minLength, limitMin: machineHnSearch.parameters.find((field) => field.id === 'limit')?.min, limitMax: machineHnSearch.parameters.find((field) => field.id === 'limit')?.max, limitStep: machineHnSearch.parameters.find((field) => field.id === 'limit')?.step }, { queryMinLength: 1, limitMin: 1, limitMax: 20, limitStep: 1 });
  assert.deepEqual({ scientificNameMinLength: machineGbifOccurrence.parameters.find((field) => field.id === 'scientificName')?.minLength, limitMin: machineGbifOccurrence.parameters.find((field) => field.id === 'limit')?.min, limitMax: machineGbifOccurrence.parameters.find((field) => field.id === 'limit')?.max, limitStep: machineGbifOccurrence.parameters.find((field) => field.id === 'limit')?.step }, { scientificNameMinLength: 1, limitMin: 1, limitMax: 20, limitStep: 1 });
  assert.equal(machineResponse.body.automatedVerificationDefault.mode, 'enabled');
  assert.equal(machineColor.automatedVerification, undefined);
  assert.equal(machineCelestrak.automatedVerification.mode, 'cadence-limited');
  assert.equal(machineCelestrak.automatedVerification.minimumIntervalSeconds, 7200);
  assert.equal(machineCelestrak.automatedVerification.retryOnNon2xx, false);
  assert.equal(machineCelestrak.automatedVerification.policyUrl, 'https://celestrak.org/usage-policy.php');
  assert.equal(machineStackExchange.automatedVerification.mode, 'cadence-limited');
  assert.equal(machineStackExchange.automatedVerification.minimumIntervalSeconds, 60);
  assert.equal(machineStackExchange.automatedVerification.retryOnNon2xx, false);
  assert.equal(machineStackExchange.automatedVerification.policyUrl, 'https://api.stackexchange.com/docs/throttle');
  assert.equal(machineLaunchLibrary.agentExecution.mode, 'enabled');
  assert.equal(machineLaunchLibrary.automatedVerification.mode, 'cadence-limited');
  assert.equal(machineLaunchLibrary.automatedVerification.minimumIntervalSeconds, 240);
  assert.equal(machineLaunchLibrary.automatedVerification.retryOnNon2xx, false);
  assert.equal(machineLaunchLibrary.automatedVerification.policyUrl, 'https://thespacedevs.com/llapi');
  assert.deepEqual(machineLaunchLibrary.parameters.map((field) => field.id), ['query', 'limit']);
  assert.deepEqual({ minLength: machineLaunchLibrary.parameters[0].minLength, maxLength: machineLaunchLibrary.parameters[0].maxLength }, { minLength: 1, maxLength: 120 });
  assert.equal(machineOsrm.agentExecution.mode, 'enabled');
  assert.equal(machineOsrm.automatedVerification.mode, 'cadence-limited');
  assert.equal(machineOsrm.automatedVerification.minimumIntervalSeconds, 1);
  assert.equal(machineOsrm.automatedVerification.retryOnNon2xx, false);
  assert.equal(machineOsrm.automatedVerification.policyUrl, 'https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server');
  assert.equal(machineOsrm.parameters.find((field) => field.id === 'alternatives')?.step, 1);
  assert.match(machineOsrm.usageNote, /reasonable, non-commercial/i);
  assert.match(machineOsrm.usageNote, /1 request per second/i);
  assert.equal(machineOpenTrivia.agentExecution.mode, 'enabled');
  assert.equal(machineOpenTrivia.automatedVerification.mode, 'cadence-limited');
  assert.equal(machineOpenTrivia.automatedVerification.minimumIntervalSeconds, 5);
  assert.equal(machineOpenTrivia.automatedVerification.retryOnNon2xx, false);
  assert.equal(machineOpenTrivia.automatedVerification.policyUrl, 'https://opentdb.com/api_config.php');
  assert.equal(machineOpenTrivia.parameters.find((field) => field.id === 'amount')?.step, 1);
  assert.match(machineOpenTrivia.usageNote, /CC BY-SA 4\.0/i);
  assert.match(machineOpenTrivia.usageNote, /one API request every 5 seconds/i);
  assert.deepEqual({ min: machineLaunchLibrary.parameters[1].min, max: machineLaunchLibrary.parameters[1].max, step: machineLaunchLibrary.parameters[1].step }, { min: 1, max: 6, step: 1 });
  for (const machineNvd of machineNvdApis) {
    assert(machineNvd);
    assert.equal(machineNvd.agentExecution.mode, 'enabled');
    assert.equal(machineNvd.automatedVerification.mode, 'cadence-limited');
    assert.equal(machineNvd.automatedVerification.minimumIntervalSeconds, 6);
    assert.equal(machineNvd.automatedVerification.retryOnNon2xx, false);
    assert.equal(machineNvd.automatedVerification.policyUrl, 'https://nvd.nist.gov/developers/start-here');
    assert.match(machineNvd.usageNote, /five requests in a rolling 30-second window/i);
  }
  assert.equal(machineNvdApis[1].parameters.find((field) => field.id === 'cve')?.pattern, cvePattern);
  assert.equal(machineOpenAlex.automatedVerification.mode, 'enabled');
  assert.equal(machineOpenAlex.automatedVerification.retryOnRateLimit, false);
  assert.equal(machineOpenAlex.automatedVerification.policyUrl, 'https://help.openalex.org/api/errors/');
  assert.equal(machineDataCite.automatedVerification.mode, 'enabled');
  assert.equal(machineDataCite.automatedVerification.retryOnRateLimit, false);
  assert.equal(machineDataCite.automatedVerification.policyUrl, 'https://support.datacite.org/docs/rate-limit');
  assert.deepEqual(machineDataCite.parameters.map((field) => ({ id: field.id, minLength: field.minLength, min: field.min, max: field.max, step: field.step })), [
    { id: 'query', minLength: 1, min: undefined, max: undefined, step: undefined },
    { id: 'count', minLength: undefined, min: 1, max: 10, step: 1 },
  ]);
  assert.equal(machineCoinGecko.automatedVerification.mode, 'enabled');
  assert.equal(machineCoinGecko.automatedVerification.retryOnRateLimit, false);
  assert.equal(machineCoinGecko.automatedVerification.policyUrl, 'https://docs.coingecko.com/docs/errors-and-rate-limits');
  assert.equal(machineWikidata.automatedVerification.mode, 'enabled');
  assert.equal(machineWikidata.automatedVerification.retryOnRateLimit, false);
  assert.equal(machineWikidata.automatedVerification.policyUrl, 'https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual');
  for (const machineLichess of machineLichessApis) {
    assert(machineLichess);
    assert.equal(machineLichess.automatedVerification.mode, 'enabled');
    assert.equal(machineLichess.automatedVerification.retryOnRateLimit, false);
    assert.equal(machineLichess.automatedVerification.policyUrl, 'https://lichess.org/page/api-tips');
  }
  for (const machineGitHubApi of [machineGitHub, machineGitHubAdvisories]) {
    assert.equal(machineGitHubApi.automatedVerification.mode, 'enabled');
    assert.equal(machineGitHubApi.automatedVerification.retryOnRateLimit, false);
    assert.deepEqual(machineGitHubApi.automatedVerification.rateLimitStatuses, [403, 429]);
    assert.equal(machineGitHubApi.automatedVerification.policyUrl, 'https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api');
  }
  assert.match(machineNhtsa.usageNote, /Overall Vehicle Score/i);
  assert.match(machineNhtsa.usageNote, /same class and within ±250 lb/i);
  assert.match(machineNhtsa.usageNote, /side and rollover ratings may be compared across classes/i);
  assert.match(machineNhtsa.usageNote, /curb-weight\/class facts needed to validate/i);
  assert.deepEqual(machineNhtsa.parameters.find((field) => field.id === 'vehicleId'), {
    id: 'vehicleId', label: 'NHTSA Vehicle ID', type: 'text', defaultValue: '19426',
    help: 'Enter a canonical VehicleId returned by the NHTSA Safety Ratings API, for example 19426 for a 2024 Toyota Camry FWD. This demo supports IDs from 1 to 999999; that workbench bound is not a provider-wide maximum.',
    minLength: 1, maxLength: 6, pattern: '[1-9][0-9]{0,5}',
    patternDescription: 'must be a canonical positive decimal ID from 1 to 999999.',
  });
  assert.equal(machineStackExchange.parameters.find((field) => field.id === 'tags')?.pattern, '[^;]+(?:;[^;]+){0,4}');
  assert.deepEqual(machineCelestrak.parameters.find((field) => field.id === 'group')?.options?.map((option) => option.value), ['stations', 'gps-ops']);
  assert.match(machineCelestrak.usageNote, /excludes large Active and Starlink groups/i);
  assert.deepEqual(machineGeoBoundaries.parameters.find((field) => field.id === 'countryIso'), {
    id: 'countryIso', label: 'Country ISO', type: 'text', defaultValue: 'SGP', help: 'Use an ISO 3166-1 alpha-3 country code such as SGP, GBR, or USA. The special ALL code returns a multi-country collection for the selected administrative level.', minLength: 3, maxLength: 3,
    pattern: '[A-Za-z]{3}', patternDescription: 'must contain exactly three letters (an ISO 3166-1 alpha-3 code or the special ALL code).',
  });
  assert.deepEqual(machineGeoBoundaries.parameters.find((field) => field.id === 'adminLevel')?.options?.map((option) => option.value), ['ADM0', 'ADM1', 'ADM2', 'ADM3', 'ADM4', 'ADM5']);
  assert.match(machineGeoBoundaries.usageNote, /attribution/i);
  assert(machineExchangeRates.keywords.includes('currency conversion'));
  assert.deepEqual({ pattern: machineBrasilPostcode.parameters.find((field) => field.id === 'postcode')?.pattern, patternDescription: machineBrasilPostcode.parameters.find((field) => field.id === 'postcode')?.patternDescription }, { pattern: '\\d{5}-?\\d{3}', patternDescription: 'must contain exactly eight digits, optionally formatted as 12345-678.' });
  assert.deepEqual({ pattern: machineUniprot.parameters.find((field) => field.id === 'accession')?.pattern, patternDescription: machineUniprot.parameters.find((field) => field.id === 'accession')?.patternDescription }, { pattern: '[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2}', patternDescription: 'must be a valid 6- or 10-character UniProtKB accession.' });
  assert.deepEqual({ minLength: machinePdb.parameters.find((field) => field.id === 'entryId')?.minLength, maxLength: machinePdb.parameters.find((field) => field.id === 'entryId')?.maxLength, pattern: machinePdb.parameters.find((field) => field.id === 'entryId')?.pattern }, { minLength: 4, maxLength: 12, pattern: '(?:[A-Za-z0-9]{4}|[Pp][Dd][Bb]_0000[A-Za-z0-9]{4})' });
  assert.match(machinePdb.usageNote || '', /July 21, 2027/);
  for (const machineApi of [machineFirstEpss, machineCircl]) {
    assert.deepEqual({ pattern: machineApi.parameters.find((field) => field.id === 'cve')?.pattern, patternDescription: machineApi.parameters.find((field) => field.id === 'cve')?.patternDescription }, { pattern: 'CVE-[0-9]{4}-[0-9]{4,}', patternDescription: 'must use the CVE-YYYY-NNNN format with four or more sequence digits.' });
  }
  assert.deepEqual({ minLength: machineUnhcr.parameters.find((field) => field.id === 'origin')?.minLength, maxLength: machineUnhcr.parameters.find((field) => field.id === 'origin')?.maxLength, pattern: machineUnhcr.parameters.find((field) => field.id === 'origin')?.pattern }, { minLength: 3, maxLength: 3, pattern: '[A-Za-z]{3}' });
  for (const machineApi of [machineApple, machineZippopotam]) {
    assert.deepEqual({ minLength: machineApi.parameters.find((field) => field.id === 'country')?.minLength, maxLength: machineApi.parameters.find((field) => field.id === 'country')?.maxLength, pattern: machineApi.parameters.find((field) => field.id === 'country')?.pattern }, { minLength: 2, maxLength: 2, pattern: '[A-Za-z]{2}' });
  }
  assert.deepEqual(machineApple.parameters.map((field) => field.id), ['query', 'entity', 'country', 'limit']);
  assert.deepEqual(machineApple.parameters.find((field) => field.id === 'entity')?.options?.map((option) => option.value), ['song', 'musicTrack', 'album', 'musicArtist', 'musicVideo', 'mix', 'podcast', 'podcastAuthor']);
  const machineAladhan = machineResponse.body.apis.find((api) => api.id === 'aladhan-prayer-times');
  assert.equal(machineAladhan.parameters.find((field) => field.id === 'date')?.type, 'date');
  const machineAladhanMethod = machineAladhan.parameters.find((field) => field.id === 'method');
  assert.equal(machineAladhanMethod?.type, 'select');
  assert(machineAladhanMethod?.options?.some((option) => option.value === '0'));
  assert(!machineAladhanMethod?.options?.some((option) => option.value === '6'));
  assert(!machineAladhanMethod?.options?.some((option) => option.value === '99'));
  const machineOpenMeteoHistory = machineResponse.body.apis.find((api) => api.id === 'open-meteo-history');
  const machineNasaPower = machineResponse.body.apis.find((api) => api.id === 'nasa-power-climate');
  const machineOpenMeteoClimate = machineResponse.body.apis.find((api) => api.id === 'open-meteo-climate');
  for (const machineClimateApi of [machineOpenMeteoHistory, machineNasaPower]) {
    assert.equal(machineClimateApi.parameters.find((field) => field.id === 'startDate')?.type, 'date');
    assert.equal(machineClimateApi.parameters.find((field) => field.id === 'endDate')?.type, 'date');
  }
  assert.equal(machineNasaPower.parameters.find((field) => field.id === 'parameters')?.minLength, 1);
  assert.deepEqual(machineOpenMeteoClimate.parameters.find((field) => field.id === 'model')?.options?.map((option) => option.value), ['CMCC_CM2_VHR4', 'FGOALS_f3_H', 'HiRAM_SIT_HR', 'MRI_AGCM3_2_S', 'EC_Earth3P_HR', 'MPI_ESM1_2_XR', 'NICAM16_8S']);
  const machineUsaspending = machineResponse.body.apis.find((api) => api.id === 'usaspending');
  assert.deepEqual(machineUsaspending.parameters.map((field) => field.id), ['fiscalYear', 'limit']);
  const machineUsaspendingFiscalYear = machineUsaspending.parameters.find((field) => field.id === 'fiscalYear');
  const machineUsaspendingLimit = machineUsaspending.parameters.find((field) => field.id === 'limit');
  assert.equal(machineUsaspendingFiscalYear.type, 'number');
  assert.equal(machineUsaspendingFiscalYear.min, 2008);
  assert.equal(machineUsaspendingFiscalYear.step, 1);
  assert(machineUsaspendingFiscalYear.max >= Number(machineUsaspendingFiscalYear.defaultValue));
  assert.deepEqual({ min: machineUsaspendingLimit.min, max: machineUsaspendingLimit.max, step: machineUsaspendingLimit.step }, { min: 1, max: 20, step: 1 });
  assert.equal(Object.hasOwn(machineColor, 'buildUrl'), false);

  await b.ev(`location.hash='#/agent-tools'`);
  await b.wait(`Boolean(document.querySelector('[data-agent-catalog="api-catalog-json"]'))`);
  const machineDom = await b.ev(`(() => {
    const link = document.querySelector('[data-agent-catalog="api-catalog-json"]');
    return { href: link?.href || '', text: link?.innerText || '', height: link?.getBoundingClientRect().height || 0 };
  })()`);
  assert.equal(machineDom.href, `${report.origin}/Public-API/api-catalog.json`);
  assert.match(machineDom.text, /Machine-readable API catalog/i);
  assert(machineDom.height >= 44);
  await b.ev(`location.hash='#/catalog'`);
  await waitForCatalog();

  const celestrakDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'CelesTrak', category: 'Geo' });
  assert.equal(celestrakDiscoveryResult.ok, true, celestrakDiscoveryResult.message);
  const celestrakDiscovery = celestrakDiscoveryResult.value;
  assert.equal(celestrakDiscovery.count, 1);
  assert.equal(celestrakDiscovery.demos[0].agentExecution.mode, 'enabled');
  assert.equal(celestrakDiscovery.demos[0].automatedVerification.mode, 'cadence-limited');
  assert.equal(celestrakDiscovery.demos[0].automatedVerification.minimumIntervalSeconds, 7200);
  assert.equal(celestrakDiscovery.demos[0].automatedVerification.retryOnNon2xx, false);
  assert.equal(celestrakDiscovery.demos[0].automatedVerification.policyUrl, 'https://celestrak.org/usage-policy.php');
  assert.deepEqual(celestrakDiscovery.demos[0].parameters.find((field) => field.id === 'group')?.options?.map((option) => option.value), ['stations', 'gps-ops']);
  assert.match(celestrakDiscovery.demos[0].usageNote, /excludes large Active and Starlink groups/i);

  const stackExchangeDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'Stack Exchange', category: 'Developer' });
  assert.equal(stackExchangeDiscoveryResult.ok, true, stackExchangeDiscoveryResult.message);
  const stackExchangeDiscovery = stackExchangeDiscoveryResult.value;
  assert.equal(stackExchangeDiscovery.count, 1);
  assert.equal(stackExchangeDiscovery.demos[0].agentExecution.mode, 'enabled');
  assert.equal(stackExchangeDiscovery.demos[0].automatedVerification.mode, 'cadence-limited');
  assert.equal(stackExchangeDiscovery.demos[0].automatedVerification.minimumIntervalSeconds, 60);
  assert.equal(stackExchangeDiscovery.demos[0].automatedVerification.retryOnNon2xx, false);
  assert.equal(stackExchangeDiscovery.demos[0].automatedVerification.policyUrl, 'https://api.stackexchange.com/docs/throttle');
  assert.equal(stackExchangeDiscovery.demos[0].parameters.find((field) => field.id === 'tags')?.pattern, '[^;]+(?:;[^;]+){0,4}');
  assert.deepEqual(stackExchangeDiscovery.demos[0].parameters.map((field) => field.id), ['tags', 'limit']);
  assert.deepEqual(
    stackExchangeDiscovery.demos[0].parameters.map((field) => ({ id: field.id, minLength: field.minLength, maxLength: field.maxLength, pattern: field.pattern, min: field.min, max: field.max, step: field.step })),
    [
      { id: 'tags', minLength: 1, maxLength: 200, pattern: '[^;]+(?:;[^;]+){0,4}', min: undefined, max: undefined, step: undefined },
      { id: 'limit', minLength: undefined, maxLength: undefined, pattern: undefined, min: 1, max: 20, step: 1 },
    ],
  );
  assert.match(stackExchangeDiscovery.demos[0].usageNote, /once per minute/i);

  const launchDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'Upcoming Space Launches', category: 'Calendar' });
  assert.equal(launchDiscoveryResult.ok, true, launchDiscoveryResult.message);
  const launchDiscovery = launchDiscoveryResult.value;
  assert.equal(launchDiscovery.count, 1);
  assert.equal(launchDiscovery.demos[0].id, 'launch-library-upcoming');
  assert.equal(launchDiscovery.demos[0].agentExecution.mode, 'enabled');
  assert.equal(launchDiscovery.demos[0].automatedVerification.mode, 'cadence-limited');
  assert.equal(launchDiscovery.demos[0].automatedVerification.minimumIntervalSeconds, 240);
  assert.equal(launchDiscovery.demos[0].automatedVerification.retryOnNon2xx, false);
  assert.equal(launchDiscovery.demos[0].automatedVerification.policyUrl, 'https://thespacedevs.com/llapi');
  assert.deepEqual(launchDiscovery.demos[0].parameters.map((field) => field.id), ['query', 'limit']);
  assert.match(launchDiscovery.demos[0].usageNote, /15 requests per hour/i);

  const nvdDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'NVD CVE Detail', category: 'Developer' });
  assert.equal(nvdDiscoveryResult.ok, true, nvdDiscoveryResult.message);
  const nvdDiscovery = nvdDiscoveryResult.value;
  assert.equal(nvdDiscovery.count, 1);
  assert.equal(nvdDiscovery.demos[0].id, 'nvd-cve-detail');
  assert.equal(nvdDiscovery.demos[0].agentExecution.mode, 'enabled');
  assert.equal(nvdDiscovery.demos[0].automatedVerification.mode, 'cadence-limited');
  assert.equal(nvdDiscovery.demos[0].automatedVerification.minimumIntervalSeconds, 6);
  assert.equal(nvdDiscovery.demos[0].automatedVerification.retryOnNon2xx, false);
  assert.equal(nvdDiscovery.demos[0].automatedVerification.policyUrl, 'https://nvd.nist.gov/developers/start-here');
  assert.equal(nvdDiscovery.demos[0].parameters.find((field) => field.id === 'cve')?.pattern, cvePattern);
  assert.match(nvdDiscovery.demos[0].usageNote, /six-second sleep/i);

  const nvdSearchDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'NVD CVE Search', category: 'Developer' });
  assert.equal(nvdSearchDiscoveryResult.ok, true, nvdSearchDiscoveryResult.message);
  const nvdSearchDiscovery = nvdSearchDiscoveryResult.value;
  assert.equal(nvdSearchDiscovery.count, 1);
  assert.equal(nvdSearchDiscovery.demos[0].id, 'nvd-cves');
  assert.deepEqual(nvdSearchDiscovery.demos[0].parameters.map((field) => field.id), ['query', 'limit']);
  assert.equal(nvdSearchDiscovery.demos[0].parameters.find((field) => field.id === 'query')?.maxLength, 100);
  assert.equal(nvdSearchDiscovery.demos[0].parameters.find((field) => field.id === 'limit')?.step, 1);
  assert.equal(nvdSearchDiscovery.demos[0].automatedVerification.minimumIntervalSeconds, 6);

  const seasonalDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'Open-Meteo Seasonal Outlook', category: 'Weather' });
  assert.equal(seasonalDiscoveryResult.ok, true, seasonalDiscoveryResult.message);
  const seasonalDiscovery = seasonalDiscoveryResult.value;
  assert.equal(seasonalDiscovery.count, 1);
  assert.deepEqual(seasonalDiscovery.demos[0].parameters.map((field) => field.id), ['latitude', 'longitude', 'forecastDays']);
  assert.deepEqual(seasonalDiscovery.demos[0].parameters.find((field) => field.id === 'forecastDays'), {
    id: 'forecastDays', label: 'Forecast horizon (days)', type: 'number', defaultValue: '42',
    help: 'Request 1–46 whole forecast days of EC46 weekly products. Calendar-aligned weekly buckets can include partial boundary weeks, so their count may differ from forecast days divided by seven.',
    min: 1, max: 46, step: 1,
  });
  assert.match(seasonalDiscovery.demos[0].usageNote, /calendar-aligned/i);
  assert.match(seasonalDiscovery.demos[0].usageNote, /first or final bucket may be partial/i);

  const marineDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'Open-Meteo Marine Weather', category: 'Weather' });
  assert.equal(marineDiscoveryResult.ok, true, marineDiscoveryResult.message);
  const marineDiscovery = marineDiscoveryResult.value;
  assert.equal(marineDiscovery.count, 1);
  assert.equal(marineDiscovery.demos[0].id, 'open-meteo-marine');
  assert.deepEqual(marineDiscovery.demos[0].parameters.map((field) => field.id), ['latitude', 'longitude', 'days']);
  assert.deepEqual(
    { min: marineDiscovery.demos[0].parameters.find((field) => field.id === 'days')?.min, max: marineDiscovery.demos[0].parameters.find((field) => field.id === 'days')?.max, step: marineDiscovery.demos[0].parameters.find((field) => field.id === 'days')?.step },
    { min: 1, max: 7, step: 1 },
  );

  const floodDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'Global Flood Forecast', category: 'Environment' });
  assert.equal(floodDiscoveryResult.ok, true, floodDiscoveryResult.message);
  const floodDiscovery = floodDiscoveryResult.value;
  assert.equal(floodDiscovery.count, 1);
  assert.equal(floodDiscovery.demos[0].id, 'open-meteo-flood');
  assert.deepEqual(floodDiscovery.demos[0].parameters.map((field) => field.id), ['latitude', 'longitude', 'days']);
  assert.deepEqual(
    { min: floodDiscovery.demos[0].parameters.find((field) => field.id === 'days')?.min, max: floodDiscovery.demos[0].parameters.find((field) => field.id === 'days')?.max, step: floodDiscovery.demos[0].parameters.find((field) => field.id === 'days')?.step },
    { min: 1, max: 30, step: 1 },
  );

  const crossrefDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'Crossref Works Search', category: 'Research' });
  assert.equal(crossrefDiscoveryResult.ok, true, crossrefDiscoveryResult.message);
  const crossrefDiscovery = crossrefDiscoveryResult.value;
  assert.equal(crossrefDiscovery.count, 1);
  assert.equal(crossrefDiscovery.demos[0].id, 'crossref-works');
  assert.deepEqual(crossrefDiscovery.demos[0].parameters.map((field) => field.id), ['query', 'rows']);
  assert.deepEqual(
    crossrefDiscovery.demos[0].parameters.map((field) => ({ id: field.id, minLength: field.minLength, min: field.min, max: field.max, step: field.step })),
    [
      { id: 'query', minLength: 1, min: undefined, max: undefined, step: undefined },
      { id: 'rows', minLength: undefined, min: 1, max: 20, step: 1 },
    ],
  );

  const openAlexDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'OpenAlex', category: 'Research' });
  assert.equal(openAlexDiscoveryResult.ok, true, openAlexDiscoveryResult.message);
  const openAlexDiscovery = openAlexDiscoveryResult.value;
  assert.equal(openAlexDiscovery.count, 1);
  assert.equal(openAlexDiscovery.demos[0].agentExecution.mode, 'enabled');
  assert.equal(openAlexDiscovery.demos[0].automatedVerification.mode, 'enabled');
  assert.equal(openAlexDiscovery.demos[0].automatedVerification.retryOnRateLimit, false);
  assert.equal(openAlexDiscovery.demos[0].automatedVerification.policyUrl, 'https://help.openalex.org/api/errors/');

  const dataCiteDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'DataCite DOI Search', category: 'Research' });
  assert.equal(dataCiteDiscoveryResult.ok, true, dataCiteDiscoveryResult.message);
  const dataCiteDiscovery = dataCiteDiscoveryResult.value;
  assert.equal(dataCiteDiscovery.count, 1);
  assert.equal(dataCiteDiscovery.demos[0].automatedVerification.mode, 'enabled');
  assert.equal(dataCiteDiscovery.demos[0].automatedVerification.retryOnRateLimit, false);
  assert.equal(dataCiteDiscovery.demos[0].automatedVerification.policyUrl, 'https://support.datacite.org/docs/rate-limit');
  assert.deepEqual(dataCiteDiscovery.demos[0].parameters.map((field) => ({ id: field.id, minLength: field.minLength, min: field.min, max: field.max, step: field.step })), [
    { id: 'query', minLength: 1, min: undefined, max: undefined, step: undefined },
    { id: 'count', minLength: undefined, min: 1, max: 10, step: 1 },
  ]);

  const coinGeckoDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'CoinGecko', category: 'Finance' });
  assert.equal(coinGeckoDiscoveryResult.ok, true, coinGeckoDiscoveryResult.message);
  const coinGeckoDiscovery = coinGeckoDiscoveryResult.value;
  assert.equal(coinGeckoDiscovery.count, 1);
  assert.equal(coinGeckoDiscovery.demos[0].agentExecution.mode, 'enabled');
  assert.equal(coinGeckoDiscovery.demos[0].automatedVerification.mode, 'enabled');
  assert.equal(coinGeckoDiscovery.demos[0].automatedVerification.retryOnRateLimit, false);
  assert.equal(coinGeckoDiscovery.demos[0].automatedVerification.policyUrl, 'https://docs.coingecko.com/docs/errors-and-rate-limits');

  const wikidataDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'Wikidata SPARQL', category: 'Knowledge' });
  assert.equal(wikidataDiscoveryResult.ok, true, wikidataDiscoveryResult.message);
  const wikidataDiscovery = wikidataDiscoveryResult.value;
  assert.equal(wikidataDiscovery.count, 1);
  assert.equal(wikidataDiscovery.demos[0].automatedVerification.mode, 'enabled');
  assert.equal(wikidataDiscovery.demos[0].automatedVerification.retryOnRateLimit, false);
  assert.equal(wikidataDiscovery.demos[0].automatedVerification.policyUrl, 'https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual');
  assert.match(wikidataDiscovery.demos[0].usageNote, /Retry-After/i);

  const githubDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'GitHub Public Repos', category: 'Developer' });
  assert.equal(githubDiscoveryResult.ok, true, githubDiscoveryResult.message);
  const githubDiscovery = githubDiscoveryResult.value;
  assert.equal(githubDiscovery.count, 1);
  assert.equal(githubDiscovery.demos[0].automatedVerification.mode, 'enabled');
  assert.equal(githubDiscovery.demos[0].automatedVerification.retryOnRateLimit, false);
  assert.deepEqual(githubDiscovery.demos[0].automatedVerification.rateLimitStatuses, [403, 429]);
  assert.equal(githubDiscovery.demos[0].automatedVerification.policyUrl, 'https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api');
  assert.match(githubDiscovery.demos[0].usageNote, /403 or 429/i);

  const githubAdvisoryDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'GitHub Global Advisories', category: 'Security' });
  assert.equal(githubAdvisoryDiscoveryResult.ok, true, githubAdvisoryDiscoveryResult.message);
  const githubAdvisoryDiscovery = githubAdvisoryDiscoveryResult.value;
  assert.equal(githubAdvisoryDiscovery.count, 1);
  assert.deepEqual(githubAdvisoryDiscovery.demos[0].automatedVerification.rateLimitStatuses, [403, 429]);

  const lichessDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'Lichess', category: 'Games' });
  assert.equal(lichessDiscoveryResult.ok, true, lichessDiscoveryResult.message);
  const lichessDiscovery = lichessDiscoveryResult.value;
  assert.equal(lichessDiscovery.count, 2);
  assert.deepEqual(lichessDiscovery.demos.map((demo) => demo.id).sort(), ['chess-player-stats', 'lichess-top-players']);
  for (const demo of lichessDiscovery.demos) {
    assert.equal(demo.automatedVerification.mode, 'enabled');
    assert.equal(demo.automatedVerification.retryOnRateLimit, false);
    assert.equal(demo.automatedVerification.policyUrl, 'https://lichess.org/page/api-tips');
    assert.match(demo.usageNote, /full minute/i);
  }

  const cityBikesDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'CityBikes', category: 'Geo' });
  assert.equal(cityBikesDiscoveryResult.ok, true, cityBikesDiscoveryResult.message);
  const cityBikesDiscovery = cityBikesDiscoveryResult.value;
  assert.equal(cityBikesDiscovery.count, 1);
  assert.equal(cityBikesDiscovery.demos[0].agentExecution.mode, 'enabled');
  assert.match(cityBikesDiscovery.demos[0].usageNote, /300 requests\/hour/i);
  assert.match(cityBikesDiscovery.demos[0].usageNote, /source link/i);

  const geoBoundariesDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'geoBoundaries', category: 'Geo' });
  assert.equal(geoBoundariesDiscoveryResult.ok, true, geoBoundariesDiscoveryResult.message);
  const geoBoundariesDiscovery = geoBoundariesDiscoveryResult.value;
  assert.equal(geoBoundariesDiscovery.count, 1);
  const geoCountryIso = geoBoundariesDiscovery.demos[0].parameters.find((field) => field.id === 'countryIso');
  const geoAdminLevel = geoBoundariesDiscovery.demos[0].parameters.find((field) => field.id === 'adminLevel');
  assert.deepEqual({ minLength: geoCountryIso.minLength, maxLength: geoCountryIso.maxLength, pattern: geoCountryIso.pattern }, { minLength: 3, maxLength: 3, pattern: '[A-Za-z]{3}' });
  assert(geoAdminLevel.options.some((option) => option.value === 'ADM3'));

  const colorDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'Color API', category: 'Utility' });
  assert.equal(colorDiscoveryResult.ok, true, colorDiscoveryResult.message);
  assert.equal(colorDiscoveryResult.value.count, 1);
  const colorHexField = colorDiscoveryResult.value.demos[0].parameters.find((field) => field.id === 'hex');
  assert.equal(colorHexField?.pattern, '#?(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})');
  assert.match(colorHexField?.patternDescription || '', /3- or 6-digit hexadecimal/i);

  const aladhanDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'AlAdhan', category: 'Calendar' });
  assert.equal(aladhanDiscoveryResult.ok, true, aladhanDiscoveryResult.message);
  const aladhanDiscovery = aladhanDiscoveryResult.value;
  assert.equal(aladhanDiscovery.count, 1);
  assert.equal(aladhanDiscovery.demos[0].parameters.find((field) => field.id === 'date')?.type, 'date');
  const aladhanMethodDiscovery = aladhanDiscovery.demos[0].parameters.find((field) => field.id === 'method');
  assert.equal(aladhanMethodDiscovery?.type, 'select');
  assert(aladhanMethodDiscovery?.options?.some((option) => option.value === '0'));
  assert(!aladhanMethodDiscovery?.options?.some((option) => option.value === '99'));

  const bankDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'Bank of Canada Valet', category: 'Finance' });
  assert.equal(bankDiscoveryResult.ok, true, bankDiscoveryResult.message);
  const bankDiscovery = bankDiscoveryResult.value;
  assert.equal(bankDiscovery.count, 1);
  assert.equal(bankDiscovery.demos[0].parameters.find((field) => field.id === 'startDate')?.type, 'date');
  assert.equal(bankDiscovery.demos[0].parameters.find((field) => field.id === 'endDate')?.type, 'date');
  assert.equal(bankDiscovery.demos[0].parameters.find((field) => field.id === 'endDate')?.minimumFromField, 'startDate');

  const openMeteoHistoryDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'Historical Weather', category: 'Weather' });
  assert.equal(openMeteoHistoryDiscoveryResult.ok, true, openMeteoHistoryDiscoveryResult.message);
  const openMeteoHistoryDiscovery = openMeteoHistoryDiscoveryResult.value;
  assert.equal(openMeteoHistoryDiscovery.count, 1);
  assert.equal(openMeteoHistoryDiscovery.demos[0].parameters.find((field) => field.id === 'startDate')?.type, 'date');
  assert.equal(openMeteoHistoryDiscovery.demos[0].parameters.find((field) => field.id === 'endDate')?.type, 'date');
  assert.equal(openMeteoHistoryDiscovery.demos[0].parameters.find((field) => field.id === 'endDate')?.minimumFromField, 'startDate');

  const nasaPowerDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'NASA POWER Climate', category: 'Environment' });
  assert.equal(nasaPowerDiscoveryResult.ok, true, nasaPowerDiscoveryResult.message);
  const nasaPowerDiscovery = nasaPowerDiscoveryResult.value;
  assert.equal(nasaPowerDiscovery.count, 1);
  assert.equal(nasaPowerDiscovery.demos[0].parameters.find((field) => field.id === 'startDate')?.type, 'date');
  assert.equal(nasaPowerDiscovery.demos[0].parameters.find((field) => field.id === 'endDate')?.type, 'date');
  assert.equal(nasaPowerDiscovery.demos[0].parameters.find((field) => field.id === 'endDate')?.minimumFromField, 'startDate');

  const openMeteoClimateDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'Open-Meteo Climate', category: 'Environment' });
  assert.equal(openMeteoClimateDiscoveryResult.ok, true, openMeteoClimateDiscoveryResult.message);
  const openMeteoClimateDiscovery = openMeteoClimateDiscoveryResult.value;
  assert.equal(openMeteoClimateDiscovery.count, 1);
  const openMeteoClimateModel = openMeteoClimateDiscovery.demos[0].parameters.find((field) => field.id === 'model');
  assert.equal(openMeteoClimateModel?.defaultValue, 'CMCC_CM2_VHR4');
  assert.deepEqual(openMeteoClimateModel?.options?.map((option) => option.value), ['CMCC_CM2_VHR4', 'FGOALS_f3_H', 'HiRAM_SIT_HR', 'MRI_AGCM3_2_S', 'EC_Earth3P_HR', 'MPI_ESM1_2_XR', 'NICAM16_8S']);
  assert.equal(openMeteoClimateDiscovery.demos[0].parameters.find((field) => field.id === 'endYear')?.minimumFromField, 'startYear');

  const worldBankIndicatorDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'World Bank Indicator', category: 'Economy' });
  assert.equal(worldBankIndicatorDiscoveryResult.ok, true, worldBankIndicatorDiscoveryResult.message);
  const worldBankIndicatorDiscovery = worldBankIndicatorDiscoveryResult.value;
  assert.equal(worldBankIndicatorDiscovery.count, 1);
  assert.equal(worldBankIndicatorDiscovery.demos[0].parameters.find((field) => field.id === 'startYear')?.step, 1);
  assert.equal(worldBankIndicatorDiscovery.demos[0].parameters.find((field) => field.id === 'endYear')?.step, 1);
  assert.equal(worldBankIndicatorDiscovery.demos[0].parameters.find((field) => field.id === 'endYear')?.minimumFromField, 'startYear');

  const frankfurterDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'SGD/MYR FX History', category: 'Finance' });
  assert.equal(frankfurterDiscoveryResult.ok, true, frankfurterDiscoveryResult.message);
  const frankfurterDiscovery = frankfurterDiscoveryResult.value;
  assert.equal(frankfurterDiscovery.count, 1);
  assert.equal(frankfurterDiscovery.demos[0].parameters.find((field) => field.id === 'from')?.type, 'date');
  assert.equal(frankfurterDiscovery.demos[0].parameters.find((field) => field.id === 'to')?.type, 'date');
  assert.equal(frankfurterDiscovery.demos[0].parameters.find((field) => field.id === 'to')?.minimumFromField, 'from');

  const mlbDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'MLB Stats', category: 'Sports' });
  assert.equal(mlbDiscoveryResult.ok, true, mlbDiscoveryResult.message);
  const mlbDiscovery = mlbDiscoveryResult.value;
  assert.equal(mlbDiscovery.count, 1);
  assert.equal(mlbDiscovery.demos[0].parameters.find((field) => field.id === 'date')?.type, 'date');
  assert.deepEqual(mlbDiscovery.demos[0].parameters.map((field) => field.id), ['date']);

  const brasilDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'Brazil Postcode', category: 'Geo' });
  assert.equal(brasilDiscoveryResult.ok, true, brasilDiscoveryResult.message);
  const brasilDiscovery = brasilDiscoveryResult.value;
  assert.equal(brasilDiscovery.count, 1);
  const brasilPostcodeField = brasilDiscovery.demos[0].parameters.find((field) => field.id === 'postcode');
  assert.equal(brasilPostcodeField?.pattern, '\\d{5}-?\\d{3}');
  assert.match(brasilPostcodeField?.patternDescription || '', /exactly eight digits/i);

  const uniprotDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'UniProt Protein', category: 'Research' });
  assert.equal(uniprotDiscoveryResult.ok, true, uniprotDiscoveryResult.message);
  const uniprotDiscovery = uniprotDiscoveryResult.value;
  assert.equal(uniprotDiscovery.count, 1);
  const uniprotAccessionField = uniprotDiscovery.demos[0].parameters.find((field) => field.id === 'accession');
  assert.equal(uniprotAccessionField?.pattern, '[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2}');
  assert.match(uniprotAccessionField?.patternDescription || '', /6- or 10-character UniProtKB accession/i);

  const pdbDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'RCSB Protein Data Bank', category: 'Research' });
  assert.equal(pdbDiscoveryResult.ok, true, pdbDiscoveryResult.message);
  const pdbDiscovery = pdbDiscoveryResult.value;
  assert.equal(pdbDiscovery.count, 1);
  const pdbEntryField = pdbDiscovery.demos[0].parameters.find((field) => field.id === 'entryId');
  assert.deepEqual({ minLength: pdbEntryField?.minLength, maxLength: pdbEntryField?.maxLength, pattern: pdbEntryField?.pattern }, { minLength: 4, maxLength: 12, pattern: '(?:[A-Za-z0-9]{4}|[Pp][Dd][Bb]_0000[A-Za-z0-9]{4})' });
  assert.match(pdbDiscovery.demos[0].usageNote || '', /extended PDB IDs/i);

  for (const [query, category, id] of [['FIRST EPSS', 'Developer', 'first-epss'], ['CIRCL Vulnerability', 'Security', 'circl-vulnerability']]) {
    const cveDiscoveryResult = await executeNativeTool('list_public_api_demos', { query, category });
    assert.equal(cveDiscoveryResult.ok, true, cveDiscoveryResult.message);
    assert.equal(cveDiscoveryResult.value.count, 1);
    assert.equal(cveDiscoveryResult.value.demos[0].id, id);
    const cveField = cveDiscoveryResult.value.demos[0].parameters.find((field) => field.id === 'cve');
    assert.equal(cveField?.pattern, 'CVE-[0-9]{4}-[0-9]{4,}');
    assert.match(cveField?.patternDescription || '', /four or more sequence digits/i);
  }
  const circlDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'CIRCL Vulnerability', category: 'Security' });
  assert.equal(circlDiscoveryResult.ok, true, circlDiscoveryResult.message);
  assert.equal(circlDiscoveryResult.value.demos[0].agentExecution.mode, 'manual-only');
  assert.equal(circlDiscoveryResult.value.demos[0].agentExecution.policyUrl, 'https://vulnerability.circl.lu/.well-known/api-policy.json');
  assert.match(circlDiscoveryResult.value.demos[0].agentExecution.reason, /meaningful User-Agent containing a contact URL or email/i);
  assert.match(circlDiscoveryResult.value.demos[0].usageNote, /20 requests per minute/i);

  for (const [query, category, id, fieldId, pattern] of [
    ['Country Explorer', 'Data', 'countries', 'code', '[A-Za-z]{2,3}'],
    ['UNHCR Refugee Statistics', 'Data', 'unhcr-refugees', 'origin', '[A-Za-z]{3}'],
    ['Apple iTunes Search', 'Media', 'apple-itunes-search', 'country', '[A-Za-z]{2}'],
    ['Zippopotam Postcode', 'Geo', 'zippopotam-postcode', 'country', '[A-Za-z]{2}'],
  ]) {
    const result = await executeNativeTool('list_public_api_demos', { query, category });
    assert.equal(result.ok, true, result.message);
    assert.equal(result.value.count, 1);
    assert.equal(result.value.demos[0].id, id);
    assert.equal(result.value.demos[0].parameters.find((field) => field.id === fieldId)?.pattern, pattern);
  }

  const appleDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'Apple iTunes Search', category: 'Media' });
  assert.equal(appleDiscoveryResult.ok, true, appleDiscoveryResult.message);
  const appleDiscovery = appleDiscoveryResult.value.demos[0];
  assert.deepEqual(appleDiscovery.parameters.map((field) => field.id), ['query', 'entity', 'country', 'limit']);
  assert.deepEqual(appleDiscovery.parameters.find((field) => field.id === 'entity')?.options?.map((option) => option.value), ['song', 'musicTrack', 'album', 'musicArtist', 'musicVideo', 'mix', 'podcast', 'podcastAuthor']);

  const usaspendingDiscoveryResult = await executeNativeTool('list_public_api_demos', { query: 'USAspending Contract Awards', category: 'Government' });
  assert.equal(usaspendingDiscoveryResult.ok, true, usaspendingDiscoveryResult.message);
  const usaspendingDiscovery = usaspendingDiscoveryResult.value;
  assert.equal(usaspendingDiscovery.count, 1);
  assert.equal(usaspendingDiscovery.demos[0].id, 'usaspending');
  assert.deepEqual(usaspendingDiscovery.demos[0].parameters.map((field) => field.id), ['fiscalYear', 'limit']);
  assert.deepEqual(
    { min: usaspendingDiscovery.demos[0].parameters.find((field) => field.id === 'fiscalYear')?.min, step: usaspendingDiscovery.demos[0].parameters.find((field) => field.id === 'fiscalYear')?.step },
    { min: 2008, step: 1 },
  );
  assert.deepEqual(
    { max: usaspendingDiscovery.demos[0].parameters.find((field) => field.id === 'limit')?.max, step: usaspendingDiscovery.demos[0].parameters.find((field) => field.id === 'limit')?.step },
    { max: 20, step: 1 },
  );

  const runIds = getNativeToolSchema('run_public_api_demo').properties.id.enum;
  assert(!runIds.includes('languagetool-grammar-check'));
  assert(!runIds.includes('nominatim-search'));
  assert(!runIds.includes('circl-vulnerability'));
  assert(!runIds.includes('internet-archive-search'));
  assert(!runIds.includes('yahoo-finance-sgx-history'));
  assert(!runIds.includes('gutendex-books'));
  assert(!runIds.includes('crates-io-search'));
  assert(!runIds.includes('nws-weather'));
  assert(runIds.includes('color-api'));
  assert.equal(runIds.length, 193);
  const openIds = getNativeToolSchema('open_public_api_demo').properties.id.enum;
  const removedIds = ['musicbrainz-artist-search', 'yahoo-finance-sgx-history', 'gutendex-books', 'crates-io-search', 'nws-weather', 'europe-pmc-search', 'zenodo-search', 'nominatim-search'];
  for (const removedId of removedIds) assert(!openIds.includes(removedId));
  for (const removedId of removedIds) {
    assert.equal(await b.ev(`Boolean(document.querySelector('[data-api-id=${JSON.stringify(removedId)}]'))`), false);
    await b.ev(`location.hash=${JSON.stringify(`#/request-lab?api=${removedId}`)}`);
    await b.wait(`document.querySelector('.request-lab')?.dataset.apiId === 'countries'`);
    assert.equal(await b.ev(`location.hash`), '#/request-lab?api=countries');
  }
  report.checks.push({ removedProviderDeepLinks: 'PASS', removed: removedIds, canonicalFallback: 'countries' });
  await b.ev(`location.hash='#/catalog'`);
  await waitForCatalog();
  const machineRunnableIds = machineResponse.body.apis.filter((api) => api.agentExecution.mode === 'enabled').map((api) => api.id).sort();
  const machineAutomatedVerificationEligibleIds = machineResponse.body.apis
    .filter((api) => api.agentExecution.mode === 'enabled' && api.automatedVerification?.mode !== 'cadence-limited')
    .map((api) => api.id)
    .sort();
  const machineCadenceLimitedIds = machineResponse.body.apis
    .filter((api) => api.agentExecution.mode === 'enabled' && api.automatedVerification?.mode === 'cadence-limited')
    .map((api) => api.id)
    .sort();
  assert.deepEqual([...runIds].sort(), machineRunnableIds);
  assert.equal(machineAutomatedVerificationEligibleIds.length, 184);
  assert.deepEqual(machineCadenceLimitedIds, ['celestrak-satellites', 'launch-library-upcoming', 'nvd-cpe-search', 'nvd-cve-detail', 'nvd-cves', 'nvd-recent-cves', 'open-trivia', 'osrm-route', 'stack-exchange']);
  report.checks.push({ machineCatalog: 'PASS', count: machineResponse.body.catalogCount, health: machineResponse.body.health, headDiscovery: 'PASS', domDiscovery: 'PASS', runnablePolicyAligned: true, automatedVerificationEligible: machineAutomatedVerificationEligibleIds.length, cadenceLimited: machineCadenceLimitedIds, textLengthContract: 'PASS', dateContract: 'PASS' });
  report.checks.push({ discovery: 'PASS', runnableIds: runIds.length, languageTool: 'manual-only', nominatim: 'removed-policy-admission', geocoding: 'open-meteo-enabled', circl: 'manual-only-contact-bearing-user-agent-required', celestrakVerification: 'cadence-limited', launchLibraryVerification: 'cadence-limited-240-seconds', nvdVerification: 'cadence-limited-6-seconds', openAlexRateLimitRetry: 'deferred', wikidataRateLimitRetry: 'deferred', lichessRateLimitRetry: 'deferred', githubRateLimitStatuses: [403, 429], githubRateLimitRetry: 'deferred', cityBikes: 'enabled-with-usage-note', geoBoundariesTextLength: '3 letters / ISO alpha-3 or ALL', colorHexPattern: '3 or 6 hex digits with optional #', uniprotAccessionPattern: 'official 6/10-character UniProtKB accession syntax', pdbEntryPattern: '4-character ID or transitional pdb_0000XXXX alias; future extended-only IDs blocked pending 2027 cutover', cveIdPattern: 'CVE-YYYY-NNNN with 4+ sequence digits', openMeteoSeasonalContract: 'forecastDays 1..46 with calendar-aligned weekly buckets', openMeteoClimateModels: '7 current documented HighResMIP models', aladhanDateType: 'date', aladhanMethodContract: 'built-in select incl. 0, excluding custom 99', bankOfCanadaDateType: 'date', historicalWeatherDateType: 'date', nasaPowerDateType: 'date', frankfurterDateType: 'date', mlbDateType: 'date', brasilCepPattern: '8 digits with optional standard hyphen', isoCountryCodePatterns: 'World Bank alpha-2/alpha-3; UNHCR alpha-3; Apple/Zippopotam alpha-2', usaspendingParameters: 'fiscalYear+limit' });

  const beforeInvalidAgentInput = b.requestCount;
  const invalidAgentInput = await executeNativeTool('run_public_api_demo', { id: 'people', parameters: { count: 3, nationality: 'xx' } });
  assert.equal(invalidAgentInput.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeInvalidAgentInput, 'Invalid WebMCP select input reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'people'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredInputValidation: 'PASS', api: 'people', invalidField: 'nationality', networkRequests: 0, stateAfterBlock: 'idle' });

  const beforeUnknownParameter = b.requestCount;
  const unknownParameter = await executeNativeTool('run_public_api_demo', { id: 'mlb-stats-api', parameters: { teamId: '147' } });
  assert.equal(unknownParameter.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeUnknownParameter, 'Undeclared MLB teamId reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'mlb-stats-api'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredUnknownParameterValidation: 'PASS', api: 'mlb-stats-api', invalidField: 'teamId', networkRequests: 0, stateAfterBlock: 'idle' });

  const beforeMlbSportOverride = b.requestCount;
  const mlbSportOverride = await executeNativeTool('run_public_api_demo', { id: 'mlb-stats-api', parameters: { sportId: '11' } });
  assert.equal(mlbSportOverride.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeMlbSportOverride, 'Undeclared MLB sportId override reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'mlb-stats-api'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredUnknownParameterValidation: 'PASS', api: 'mlb-stats-api', invalidField: 'sportId', invalidValue: '11', networkRequests: 0, stateAfterBlock: 'idle' });

  const beforeInvalidAppleEntity = b.requestCount;
  const invalidAppleEntity = await executeNativeTool('run_public_api_demo', { id: 'apple-itunes-search', parameters: { entity: 'bogus' } });
  assert.equal(invalidAppleEntity.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeInvalidAppleEntity, 'Invalid Apple entity reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'apple-itunes-search'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredSelectValidation: 'PASS', api: 'apple-itunes-search', invalidField: 'entity', invalidValue: 'bogus', networkRequests: 0, stateAfterBlock: 'idle' });

  const beforeInvalidBrasilCep = b.requestCount;
  const invalidBrasilCep = await executeNativeTool('run_public_api_demo', { id: 'brasilapi-postcode', parameters: { postcode: '01310-930abc' } });
  assert.equal(invalidBrasilCep.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeInvalidBrasilCep, 'Invalid Brazilian CEP reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'brasilapi-postcode'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredPatternValidation: 'PASS', api: 'brasilapi-postcode', invalidField: 'postcode', invalidValue: '01310-930abc', networkRequests: 0, stateAfterBlock: 'idle' });

  const beforeInvalidNhtsaVehicleId = b.requestCount;
  const invalidNhtsaVehicleId = await executeNativeTool('run_public_api_demo', { id: 'nhtsa-safety-ratings', parameters: { vehicleId: 19426.9 } });
  assert.equal(invalidNhtsaVehicleId.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeInvalidNhtsaVehicleId, 'Decimal NHTSA VehicleId reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'nhtsa-safety-ratings'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredIdentifierValidation: 'PASS', api: 'nhtsa-safety-ratings', invalidField: 'vehicleId', invalidValue: 19426.9, networkRequests: 0, stateAfterBlock: 'idle' });

  for (const [id, field, value] of [['color-api', 'hex', 'GGGGGG'], ['geoboundaries-admin-boundaries', 'countryIso', '123']]) {
    const beforeInvalidPattern = b.requestCount;
    const invalidPattern = await executeNativeTool('run_public_api_demo', { id, parameters: { [field]: value } });
    assert.equal(invalidPattern.ok, false);
    await sleep(150);
    assert.equal(b.requestCount, beforeInvalidPattern, `Invalid ${id}.${field} reached a provider request`);
    await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === ${JSON.stringify(id)}`);
    assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
    report.checks.push({ structuredPatternValidation: 'PASS', api: id, invalidField: field, invalidValue: value, networkRequests: 0, stateAfterBlock: 'idle' });
  }

  const beforeInvalidNvdKeyword = b.requestCount;
  const invalidNvdKeyword = await executeNativeTool('run_public_api_demo', { id: 'nvd-cves', parameters: { query: '' } });
  assert.equal(invalidNvdKeyword.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeInvalidNvdKeyword, 'Empty NVD CVE keyword reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'nvd-cves'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredTextValidation: 'PASS', api: 'nvd-cves', invalidField: 'query', invalidValue: '', networkRequests: 0, stateAfterBlock: 'idle' });

  const beforeFractionalNvdLimit = b.requestCount;
  const fractionalNvdLimit = await executeNativeTool('run_public_api_demo', { id: 'nvd-cves', parameters: { query: 'postgresql', limit: 8.5 } });
  assert.equal(fractionalNvdLimit.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeFractionalNvdLimit, 'Fractional NVD CVE result limit reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'nvd-cves'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredNumericValidation: 'PASS', api: 'nvd-cves', invalidField: 'limit', invalidValue: 8.5, networkRequests: 0, stateAfterBlock: 'idle' });


  for (const [id, field, value] of [
    ['countries', 'code', 'S1'],
    ['unhcr-refugees', 'origin', '123'],
    ['apple-itunes-search', 'country', '12'],
    ['zippopotam-postcode', 'country', '1x'],
  ]) {
    const beforeInvalidCountryCode = b.requestCount;
    const invalidCountryCode = await executeNativeTool('run_public_api_demo', { id, parameters: { [field]: value } });
    assert.equal(invalidCountryCode.ok, false);
    await sleep(150);
    assert.equal(b.requestCount, beforeInvalidCountryCode, `Invalid ${id}.${field} reached a provider request`);
    await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === ${JSON.stringify(id)}`);
    assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
    report.checks.push({ structuredCountryCodeValidation: 'PASS', api: id, invalidField: field, invalidValue: value, networkRequests: 0, stateAfterBlock: 'idle' });
  }

  for (const id of ['first-epss', 'nvd-cve-detail']) {
    const beforeInvalidCve = b.requestCount;
    const invalidCve = await executeNativeTool('run_public_api_demo', { id, parameters: { cve: 'not-a-cve' } });
    assert.equal(invalidCve.ok, false);
    await sleep(150);
    assert.equal(b.requestCount, beforeInvalidCve, `Invalid ${id}.cve reached a provider request`);
    await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === ${JSON.stringify(id)}`);
    assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
    report.checks.push({ structuredIdentifierValidation: 'PASS', api: id, invalidField: 'cve', invalidValue: 'not-a-cve', networkRequests: 0, stateAfterBlock: 'idle' });
  }

  const openCircl = await executeNativeTool('open_public_api_demo', { id: 'circl-vulnerability' });
  assert.equal(openCircl.ok, true, openCircl.message);
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'circl-vulnerability'`);
  const beforeCirclBlock = b.requestCount;
  const circlBlocked = await executeNativeTool('run_public_api_demo', { id: 'circl-vulnerability', parameters: { cve: 'CVE-2021-44228' } });
  assert.equal(circlBlocked.ok, false);
  assert.match(circlBlocked.message, /failed/i);
  await sleep(150);
  assert.equal(b.requestCount, beforeCirclBlock, 'Blocked CIRCL WebMCP execution sent a network request');
  assert(!b.blockedProviders.some((url) => url.includes('vulnerability.circl.lu')), 'CIRCL request reached the browser interception boundary');
  assert.equal(await b.ev(`document.querySelector('.request-lab').dataset.requestState`), 'idle');
  assert.equal(await b.ev(`Boolean(document.querySelector('[data-output-tab="code"]'))`), false, 'Manual-only CIRCL exposed generic fetch code');
  report.checks.push({ structuredAgentBlock: 'PASS', api: 'circl-vulnerability', policy: 'manual-only', networkRequests: 0, stateAfterBlock: 'idle', fetchCodeWithheld: true });

  for (const [id, field, value] of [
    ['uniprot-protein', 'accession', 'INVALID'],
    ['rcsb-pdb-entry', 'entryId', 'pdb_10004hhb'],
    ['ensembl-gene-lookup', 'geneId', 'ENST00000646891'],
  ]) {
    const beforeInvalidIdentifier = b.requestCount;
    const invalidIdentifier = await executeNativeTool('run_public_api_demo', { id, parameters: { [field]: value } });
    assert.equal(invalidIdentifier.ok, false);
    await sleep(150);
    assert.equal(b.requestCount, beforeInvalidIdentifier, `Invalid ${id}.${field} reached a provider request`);
    await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === ${JSON.stringify(id)}`);
    assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
    report.checks.push({ structuredIdentifierValidation: 'PASS', api: id, invalidField: field, invalidValue: value, networkRequests: 0, stateAfterBlock: 'idle' });
  }

  const pdbAliasOpen = await executeNativeTool('open_public_api_demo', { id: 'rcsb-pdb-entry' });
  assert.equal(pdbAliasOpen.ok, true, pdbAliasOpen.message);
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'rcsb-pdb-entry'`);
  const pdbAliasInputPattern = await b.ev(`document.querySelector('input[name="entryId"]')?.pattern || ''`);
  assert.equal(pdbAliasInputPattern, '(?:[A-Za-z0-9]{4}|[Pp][Dd][Bb]_0000[A-Za-z0-9]{4})');
  report.checks.push({ humanIdentifierContract: 'PASS', api: 'rcsb-pdb-entry', transitionalAlias: 'pdb_0000XXXX', futureExtendedOnly: 'blocked pending verified Data API support' });

  const beforeInvalidDateInput = b.requestCount;
  const invalidDateInput = await executeNativeTool('run_public_api_demo', { id: 'aladhan-prayer-times', parameters: { date: '2026-02-30' } });
  assert.equal(invalidDateInput.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeInvalidDateInput, 'Invalid WebMCP date input reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'aladhan-prayer-times'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredDateValidation: 'PASS', api: 'aladhan-prayer-times', invalidField: 'date', networkRequests: 0, stateAfterBlock: 'idle' });

  const beforeInvalidBankDate = b.requestCount;
  const invalidBankDate = await executeNativeTool('run_public_api_demo', { id: 'bank-of-canada-valet', parameters: { startDate: '20260901' } });
  assert.equal(invalidBankDate.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeInvalidBankDate, 'Invalid compact Bank of Canada date reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'bank-of-canada-valet'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredDateValidation: 'PASS', api: 'bank-of-canada-valet', invalidField: 'startDate', invalidValue: '20260901', networkRequests: 0, stateAfterBlock: 'idle' });

  const beforeInvalidBankSeries = b.requestCount;
  const invalidBankSeries = await executeNativeTool('run_public_api_demo', { id: 'bank-of-canada-valet', parameters: { series: 'FXUSDCAD,FXEURCAD' } });
  assert.equal(invalidBankSeries.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeInvalidBankSeries, 'Invalid multi-series Bank of Canada input reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'bank-of-canada-valet'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredPatternValidation: 'PASS', api: 'bank-of-canada-valet', invalidField: 'series', invalidValue: 'FXUSDCAD,FXEURCAD', networkRequests: 0, stateAfterBlock: 'idle' });

  for (const [id, label] of [['open-meteo-history', 'Open-Meteo Historical Weather'], ['nasa-power-climate', 'NASA POWER Climate']]) {
    const beforeInvalidClimateDate = b.requestCount;
    const invalidClimateDate = await executeNativeTool('run_public_api_demo', { id, parameters: { startDate: '20260803' } });
    assert.equal(invalidClimateDate.ok, false);
    await sleep(150);
    assert.equal(b.requestCount, beforeInvalidClimateDate, `Invalid compact ${label} date reached a provider request`);
    await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === ${JSON.stringify(id)}`);
    assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
    report.checks.push({ structuredDateValidation: 'PASS', api: id, invalidField: 'startDate', invalidValue: '20260803', networkRequests: 0, stateAfterBlock: 'idle' });
  }

  const beforeBlankNasaParameters = b.requestCount;
  const blankNasaParameters = await executeNativeTool('run_public_api_demo', { id: 'nasa-power-climate', parameters: { parameters: '' } });
  assert.equal(blankNasaParameters.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeBlankNasaParameters, 'Blank NASA POWER parameter list reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'nasa-power-climate'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredTextValidation: 'PASS', api: 'nasa-power-climate', invalidField: 'parameters', invalidValue: '', networkRequests: 0, stateAfterBlock: 'idle' });

  for (const [id, field, invalidValue] of [['frankfurter-sgd-myr-history', 'from', '20260803'], ['mlb-stats-api', 'date', '20250415']]) {
    const beforeInvalidStrictDate = b.requestCount;
    const invalidStrictDate = await executeNativeTool('run_public_api_demo', { id, parameters: { [field]: invalidValue } });
    assert.equal(invalidStrictDate.ok, false);
    await sleep(150);
    assert.equal(b.requestCount, beforeInvalidStrictDate, `Invalid compact date reached a provider request for ${id}`);
    await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === ${JSON.stringify(id)}`);
    assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
    report.checks.push({ structuredDateValidation: 'PASS', api: id, invalidField: field, invalidValue, networkRequests: 0, stateAfterBlock: 'idle' });
  }

  for (const [id, parameters, invalidField] of [
    ['bank-of-canada-valet', { startDate: '2026-08-07', endDate: '2026-08-03' }, 'endDate'],
    ['open-meteo-history', { startDate: '2026-08-07', endDate: '2026-08-03' }, 'endDate'],
    ['nasa-power-climate', { startDate: '2026-08-07', endDate: '2026-08-03' }, 'endDate'],
    ['frankfurter-sgd-myr-history', { from: '2026-08-07', to: '2026-08-03' }, 'to'],
    ['open-meteo-climate', { startYear: '2030', endYear: '2020' }, 'endYear'],
    ['world-bank-indicator-explorer', { startYear: '2025', endYear: '2015' }, 'endYear'],
  ]) {
    const beforeInvalidRange = b.requestCount;
    const invalidRange = await executeNativeTool('run_public_api_demo', { id, parameters });
    assert.equal(invalidRange.ok, false);
    await sleep(150);
    assert.equal(b.requestCount, beforeInvalidRange, `Reversed range reached a provider request for ${id}`);
    await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === ${JSON.stringify(id)}`);
    assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
    report.checks.push({ structuredRangeValidation: 'PASS', api: id, invalidField, networkRequests: 0, stateAfterBlock: 'idle' });
  }

  const beforeFractionalWorldBankYear = b.requestCount;
  const fractionalWorldBankYear = await executeNativeTool('run_public_api_demo', {
    id: 'world-bank-indicator-explorer',
    parameters: { startYear: '2015.5', endYear: '2025' },
  });
  assert.equal(fractionalWorldBankYear.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeFractionalWorldBankYear, 'Fractional World Bank year reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'world-bank-indicator-explorer'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredStepValidation: 'PASS', api: 'world-bank-indicator-explorer', invalidField: 'startYear', invalidValue: '2015.5', networkRequests: 0, stateAfterBlock: 'idle' });

  const beforeFractionalPostId = b.requestCount;
  const fractionalPostId = await executeNativeTool('run_public_api_demo', {
    id: 'posts',
    parameters: { postId: '7.5' },
  });
  assert.equal(fractionalPostId.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeFractionalPostId, 'Fractional JSONPlaceholder post ID reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'posts'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredStepValidation: 'PASS', api: 'posts', invalidField: 'postId', invalidValue: '7.5', networkRequests: 0, stateAfterBlock: 'idle' });

  const beforeFractionalEonetDays = b.requestCount;
  const fractionalEonetDays = await executeNativeTool('run_public_api_demo', {
    id: 'nasa-eonet-events',
    parameters: { category: 'all', days: '30.5', limit: '6' },
  });
  assert.equal(fractionalEonetDays.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeFractionalEonetDays, 'Fractional NASA EONET day count reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'nasa-eonet-events'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredStepValidation: 'PASS', api: 'nasa-eonet-events', invalidField: 'days', invalidValue: '30.5', networkRequests: 0, stateAfterBlock: 'idle' });

  const beforeFractionalSeasonalDays = b.requestCount;
  const fractionalSeasonalDays = await executeNativeTool('run_public_api_demo', {
    id: 'open-meteo-seasonal',
    parameters: { latitude: '1.3521', longitude: '103.8198', forecastDays: '42.5' },
  });
  assert.equal(fractionalSeasonalDays.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeFractionalSeasonalDays, 'Fractional Open-Meteo Seasonal forecast days reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'open-meteo-seasonal'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredStepValidation: 'PASS', api: 'open-meteo-seasonal', invalidField: 'forecastDays', invalidValue: '42.5', networkRequests: 0, stateAfterBlock: 'idle' });

  const beforeFractionalEnsembleDays = b.requestCount;
  const fractionalEnsembleDays = await executeNativeTool('run_public_api_demo', {
    id: 'open-meteo-ensemble',
    parameters: { latitude: '1.3521', longitude: '103.8198', variable: 'temperature_2m', forecastDays: '3.5' },
  });
  assert.equal(fractionalEnsembleDays.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeFractionalEnsembleDays, 'Fractional Open-Meteo Ensemble forecast days reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'open-meteo-ensemble'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredStepValidation: 'PASS', api: 'open-meteo-ensemble', invalidField: 'forecastDays', invalidValue: '3.5', networkRequests: 0, stateAfterBlock: 'idle' });

  const beforeFractionalMarineDays = b.requestCount;
  const fractionalMarineDays = await executeNativeTool('run_public_api_demo', {
    id: 'open-meteo-marine',
    parameters: { latitude: '1.3521', longitude: '103.8198', days: '3.5' },
  });
  assert.equal(fractionalMarineDays.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeFractionalMarineDays, 'Fractional Open-Meteo Marine forecast days reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'open-meteo-marine'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredStepValidation: 'PASS', api: 'open-meteo-marine', invalidField: 'days', invalidValue: '3.5', networkRequests: 0, stateAfterBlock: 'idle' });

  const beforeFractionalFloodDays = b.requestCount;
  const fractionalFloodDays = await executeNativeTool('run_public_api_demo', {
    id: 'open-meteo-flood',
    parameters: { latitude: '1.3521', longitude: '103.8198', days: '7.5' },
  });
  assert.equal(fractionalFloodDays.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeFractionalFloodDays, 'Fractional Open-Meteo Flood forecast days reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'open-meteo-flood'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredStepValidation: 'PASS', api: 'open-meteo-flood', invalidField: 'days', invalidValue: '7.5', networkRequests: 0, stateAfterBlock: 'idle' });

  for (const [parameters, invalidField, invalidValue, validationKind] of [
    [{ query: '   ', rows: '8' }, 'query', 'blank', 'structuredTextValidation'],
    [{ query: 'agentic AI', rows: '8.5' }, 'rows', '8.5', 'structuredStepValidation'],
  ]) {
    const beforeInvalidCrossref = b.requestCount;
    const invalidCrossref = await executeNativeTool('run_public_api_demo', { id: 'crossref-works', parameters });
    assert.equal(invalidCrossref.ok, false);
    await sleep(150);
    assert.equal(b.requestCount, beforeInvalidCrossref, `Invalid Crossref ${invalidField} reached a provider request`);
    await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'crossref-works'`);
    assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
    report.checks.push({ [validationKind]: 'PASS', api: 'crossref-works', invalidField, invalidValue, networkRequests: 0, stateAfterBlock: 'idle' });
  }

  for (const [parameters, invalidField, invalidValue, validationKind] of [
    [{ tags: '   ', limit: '8' }, 'tags', 'blank', 'structuredTextValidation'],
    [{ tags: 'javascript', limit: '8.5' }, 'limit', '8.5', 'structuredStepValidation'],
  ]) {
    const beforeInvalidStackExchange = b.requestCount;
    const invalidStackExchange = await executeNativeTool('run_public_api_demo', { id: 'stack-exchange', parameters });
    assert.equal(invalidStackExchange.ok, false);
    await sleep(150);
    assert.equal(b.requestCount, beforeInvalidStackExchange, `Invalid Stack Exchange ${invalidField} reached a provider request`);
    await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'stack-exchange'`);
    assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
    report.checks.push({ [validationKind]: 'PASS', api: 'stack-exchange', invalidField, invalidValue, networkRequests: 0, stateAfterBlock: 'idle' });
  }

  for (const [parameters, invalidField, invalidValue, validationKind] of [
    [{ query: '   ', tag: 'story', limit: '6' }, 'query', 'blank', 'structuredTextValidation'],
    [{ query: 'OpenAI', tag: 'story', limit: '6.5' }, 'limit', '6.5', 'structuredStepValidation'],
    [{ query: 'OpenAI', tag: 'poll', limit: '6' }, 'tag', 'poll', 'structuredSelectValidation'],
  ]) {
    const beforeInvalidHnSearch = b.requestCount;
    const invalidHnSearch = await executeNativeTool('run_public_api_demo', { id: 'hn-search-algolia', parameters });
    assert.equal(invalidHnSearch.ok, false);
    await sleep(150);
    assert.equal(b.requestCount, beforeInvalidHnSearch, `Invalid HN Search ${invalidField} reached a provider request`);
    await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'hn-search-algolia'`);
    assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
    report.checks.push({ [validationKind]: 'PASS', api: 'hn-search-algolia', invalidField, invalidValue, networkRequests: 0, stateAfterBlock: 'idle' });
  }

  for (const [parameters, invalidField, invalidValue, validationKind] of [
    [{ from: '   ', to: 'Geneva', limit: '6' }, 'from', 'blank', 'structuredTextValidation'],
    [{ from: 'Zurich', to: '   ', limit: '6' }, 'to', 'blank', 'structuredTextValidation'],
    [{ from: 'Zurich', to: 'Geneva', limit: '6.5' }, 'limit', '6.5', 'structuredStepValidation'],
  ]) {
    const beforeInvalidSwissTransit = b.requestCount;
    const invalidSwissTransit = await executeNativeTool('run_public_api_demo', { id: 'swiss-transit-connections', parameters });
    assert.equal(invalidSwissTransit.ok, false);
    await sleep(150);
    assert.equal(b.requestCount, beforeInvalidSwissTransit, `Invalid Swiss Transit ${invalidField} reached a provider request`);
    await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'swiss-transit-connections'`);
    assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
    report.checks.push({ [validationKind]: 'PASS', api: 'swiss-transit-connections', invalidField, invalidValue, networkRequests: 0, stateAfterBlock: 'idle' });
  }

  const beforeFractionalTriviaAmount = b.requestCount;
  const fractionalTriviaAmount = await executeNativeTool('run_public_api_demo', {
    id: 'open-trivia',
    parameters: { amount: '6.5', category: '9', difficulty: 'medium' },
  });
  assert.equal(fractionalTriviaAmount.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeFractionalTriviaAmount, 'Fractional Open Trivia amount reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'open-trivia'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredStepValidation: 'PASS', api: 'open-trivia', invalidField: 'amount', invalidValue: '6.5', networkRequests: 0, stateAfterBlock: 'idle' });

  const beforeFractionalDevtoLimit = b.requestCount;
  const fractionalDevtoLimit = await executeNativeTool('run_public_api_demo', {
    id: 'devto',
    parameters: { tag: 'javascript', limit: '8.5' },
  });
  assert.equal(fractionalDevtoLimit.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeFractionalDevtoLimit, 'Fractional DEV.to article limit reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'devto'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredStepValidation: 'PASS', api: 'devto', invalidField: 'limit', invalidValue: '8.5', networkRequests: 0, stateAfterBlock: 'idle' });

  for (const [parameters, invalidField, invalidValue] of [
    [{ fiscalYear: '2025.5', limit: '8' }, 'fiscalYear', '2025.5'],
    [{ fiscalYear: '2025', limit: '8.5' }, 'limit', '8.5'],
  ]) {
    const beforeFractionalUsaspending = b.requestCount;
    const fractionalUsaspending = await executeNativeTool('run_public_api_demo', { id: 'usaspending', parameters });
    assert.equal(fractionalUsaspending.ok, false);
    await sleep(150);
    assert.equal(b.requestCount, beforeFractionalUsaspending, `Fractional USAspending ${invalidField} reached a provider request`);
    await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'usaspending'`);
    assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
    report.checks.push({ structuredStepValidation: 'PASS', api: 'usaspending', invalidField, invalidValue, networkRequests: 0, stateAfterBlock: 'idle' });
  }

  const beforeFractionalNpmSize = b.requestCount;
  const fractionalNpmSize = await executeNativeTool('run_public_api_demo', {
    id: 'npm-search',
    parameters: { query: 'react', limit: '8.5' },
  });
  assert.equal(fractionalNpmSize.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeFractionalNpmSize, 'Fractional npm registry search size reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'npm-search'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredStepValidation: 'PASS', api: 'npm-search', invalidField: 'limit', invalidValue: '8.5', networkRequests: 0, stateAfterBlock: 'idle' });

  for (const [parameters, invalidField, invalidValue, validationKind] of [
    [{ query: '   ', limit: '8' }, 'query', 'blank', 'structuredTextValidation'],
    [{ query: 'react', limit: '8.5' }, 'limit', '8.5', 'structuredStepValidation'],
  ]) {
    const beforeInvalidPackagist = b.requestCount;
    const invalidPackagist = await executeNativeTool('run_public_api_demo', { id: 'packagist-search', parameters });
    assert.equal(invalidPackagist.ok, false);
    await sleep(150);
    assert.equal(b.requestCount, beforeInvalidPackagist, `Invalid Packagist ${invalidField} reached a provider request`);
    await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'packagist-search'`);
    assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
    report.checks.push({ [validationKind]: 'PASS', api: 'packagist-search', invalidField, invalidValue, networkRequests: 0, stateAfterBlock: 'idle' });
  }

  for (const [parameters, invalidField, invalidValue, validationKind] of [
    [{ scientificName: '   ', limit: '6' }, 'scientificName', 'blank', 'structuredTextValidation'],
    [{ scientificName: 'Panthera leo', limit: '6.5' }, 'limit', '6.5', 'structuredStepValidation'],
  ]) {
    const beforeInvalidGbif = b.requestCount;
    const invalidGbif = await executeNativeTool('run_public_api_demo', { id: 'gbif-occurrence-search', parameters });
    assert.equal(invalidGbif.ok, false);
    await sleep(150);
    assert.equal(b.requestCount, beforeInvalidGbif, `Invalid GBIF ${invalidField} reached a provider request`);
    await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'gbif-occurrence-search'`);
    assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
    report.checks.push({ [validationKind]: 'PASS', api: 'gbif-occurrence-search', invalidField, invalidValue, networkRequests: 0, stateAfterBlock: 'idle' });
  }

  const beforeInvalidClimateModel = b.requestCount;
  const invalidClimateModel = await executeNativeTool('run_public_api_demo', { id: 'open-meteo-climate', parameters: { model: 'nasa_nex_gddp' } });
  assert.equal(invalidClimateModel.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeInvalidClimateModel, 'Unsupported Open-Meteo Climate model reached a provider request');
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'open-meteo-climate'`);
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredSelectValidation: 'PASS', api: 'open-meteo-climate', invalidField: 'model', invalidValue: 'nasa_nex_gddp', networkRequests: 0, stateAfterBlock: 'idle' });

  const beforeInvalidAladhanMethod = b.requestCount;
  const invalidAladhanMethod = await executeNativeTool('run_public_api_demo', { id: 'aladhan-prayer-times', parameters: { method: '6' } });
  assert.equal(invalidAladhanMethod.ok, false);
  await sleep(150);
  assert.equal(b.requestCount, beforeInvalidAladhanMethod, 'Unsupported AlAdhan method reached a provider request');
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  report.checks.push({ structuredSelectValidation: 'PASS', api: 'aladhan-prayer-times', invalidField: 'method', invalidValue: '6', networkRequests: 0, stateAfterBlock: 'idle' });

  const openGeoBoundaries = await executeNativeTool('open_public_api_demo', { id: 'geoboundaries-admin-boundaries' });
  assert.equal(openGeoBoundaries.ok, true, openGeoBoundaries.message);
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'geoboundaries-admin-boundaries'`);
  const geoInputContract = await b.ev(`(() => {
    const input = document.querySelector('input[name="countryIso"]');
    return { minLength: input?.minLength, maxLength: input?.maxLength, value: input?.value, describedBy: input?.getAttribute('aria-describedby') };
  })()`);
  assert.deepEqual(geoInputContract, { minLength: 3, maxLength: 3, value: 'SGP', describedBy: 'parameter-countryIso-help' });
  const beforeInvalidHumanInput = b.requestCount;
  await b.ev(`(() => {
    const input = document.querySelector('input[name="countryIso"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '123');
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '123' }));
    document.querySelector('form.parameter-card').requestSubmit();
  })()`);
  await b.wait(`document.querySelector('input[name="countryIso"]')?.getAttribute('aria-invalid') === 'true'`);
  await sleep(150);
  assert.equal(b.requestCount, beforeInvalidHumanInput, 'Invalid human ISO-format input reached a provider request');
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle');
  assert.match(await b.ev(`document.querySelector('#parameter-countryIso-help')?.textContent || ''`), /exactly three letters/i);
  report.checks.push({ humanInputValidation: 'PASS', api: 'geoboundaries-admin-boundaries', field: 'countryIso', nativeMinLength: 3, nativeMaxLength: 3, nativePattern: await b.ev(`document.querySelector('input[name="countryIso"]')?.pattern || ''`), rejectedValue: '123', networkRequests: 0 });

  await b.ev(`location.hash='#/catalog'`);
  await waitForCatalog();
  await b.viewport(390, 844);
  await b.ev(`document.querySelector('button[aria-label="Open navigation"]').click()`);
  await b.wait(`document.querySelector('#primary-navigation')?.classList.contains('mobile-open')`);
  const mobileNavigation = await b.ev(`(() => {
    const nav = document.querySelector('#primary-navigation');
    const main = document.querySelector('.admin-main');
    const detail = document.querySelector('.detail-panel');
    const scrim = document.querySelector('.nav-scrim');
    const close = document.querySelector('button[aria-label="Close navigation menu"]');
    return {
      role: nav?.getAttribute('role'),
      modal: nav?.getAttribute('aria-modal'),
      mainInert: main?.hasAttribute('inert'),
      detailInert: detail?.hasAttribute('inert'),
      activeClose: document.activeElement === close,
      scrimAriaHidden: scrim?.getAttribute('aria-hidden'),
      scrimTabIndex: scrim?.tabIndex,
    };
  })()`);
  assert.deepEqual(mobileNavigation, { role: 'dialog', modal: 'true', mainInert: true, detailInert: true, activeClose: true, scrimAriaHidden: 'true', scrimTabIndex: -1 });
  await b.ev(`(() => {
    const last = [...document.querySelectorAll('#primary-navigation nav button')].at(-1);
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  })()`);
  assert.equal(await b.ev(`document.activeElement?.getAttribute('aria-label')`), 'Close navigation from API Console brand');
  await b.ev(`(() => {
    const first = document.querySelector('button[aria-label="Close navigation from API Console brand"]');
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
  })()`);
  assert.equal(await b.ev(`document.activeElement?.textContent?.trim()`), 'Documentation');
  await b.ev(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`);
  await b.wait(`!document.querySelector('#primary-navigation')?.classList.contains('mobile-open')`);
  assert.equal(await b.ev(`document.activeElement?.getAttribute('aria-label')`), 'Open navigation');
  assert.equal(await b.ev(`document.querySelector('.admin-main')?.hasAttribute('inert')`), false);
  report.checks.push({ mobileNavigation: 'PASS', modal: true, backgroundInert: true, focusContained: true, escapeRestoresOpener: true });

  await b.viewport(900, 844);
  await setCatalogSearch('please show me how to convert currency');
  await b.wait(`document.querySelectorAll('tbody tr[data-api-id]').length === 1 && document.querySelector('tr[data-api-id="exchange-rate-current"]')`);
  report.checks.push({ humanTaskSearch: 'PASS', query: 'please show me how to convert currency', matchedApi: 'exchange-rate-current' });
  await setCatalogSearch('');

  await setCatalogSearch('Live Weather');
  await b.wait(`document.querySelector('tr[data-api-id="weather"] input[type="radio"]')`);
  await b.ev(`(() => {
    const trigger = document.querySelector('tr[data-api-id="weather"] input[type="radio"]');
    trigger.focus();
    trigger.click();
  })()`);
  await b.wait(`document.querySelector('.detail-panel')?.getAttribute('role') === 'dialog'`);
  const compactDetail = await b.ev(`(() => {
    const panel = document.querySelector('.detail-panel');
    const main = document.querySelector('.admin-main');
    const nav = document.querySelector('#primary-navigation');
    const close = document.querySelector('button[aria-label="Close selected API details"]');
    const scrim = document.querySelector('.detail-scrim');
    return {
      name: panel?.getAttribute('aria-label'),
      modal: panel?.getAttribute('aria-modal'),
      mainInert: main?.hasAttribute('inert'),
      navInert: nav?.hasAttribute('inert'),
      activeClose: document.activeElement === close,
      scrimAriaHidden: scrim?.getAttribute('aria-hidden'),
    };
  })()`);
  assert.deepEqual(compactDetail, { name: 'Live Weather details', modal: 'true', mainInert: true, navInert: true, activeClose: true, scrimAriaHidden: 'true' });
  await b.ev(`(() => {
    const panel = document.querySelector('.detail-panel');
    const items = [...panel.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    const last = items.at(-1);
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  })()`);
  assert.equal(await b.ev(`document.activeElement?.getAttribute('aria-label')`), 'Close selected API details');
  await b.ev(`(() => {
    const close = document.querySelector('button[aria-label="Close selected API details"]');
    close.focus();
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
  })()`);
  assert.equal(await b.ev(`/Copy fetch/i.test(document.activeElement?.textContent || '')`), true);
  await b.ev(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`);
  await b.wait(`document.querySelector('.detail-panel')?.getAttribute('role') !== 'dialog'`);
  assert.equal(await b.ev(`document.activeElement?.getAttribute('aria-label')`), 'Select Live Weather');
  assert.equal(await b.ev(`document.querySelector('.admin-main')?.hasAttribute('inert')`), false);
  report.checks.push({ compactDetailDrawer: 'PASS', viewport: '900x844', modal: true, backgroundInert: true, focusContained: true, escapeRestoresInvoker: true });

  await b.viewport(1440, 1000);
  await setCatalogSearch('');
  await waitForCatalog();
  assert.equal(await b.ev(`Boolean(document.querySelector('button[aria-label="Close selected API details"]'))`), false, 'Desktop sticky details exposed a no-op close button');

  const openLanguageToolInitial = await executeNativeTool('open_public_api_demo', { id: 'languagetool-grammar-check' });
  assert.equal(openLanguageToolInitial.ok, true, openLanguageToolInitial.message);
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'languagetool-grammar-check'`);
  const manualUi = await b.ev(`(() => {
    const lab = document.querySelector('.request-lab');
    const form = document.querySelector('.parameter-card');
    const button = form.querySelector('button[type="submit"]');
    const note = document.querySelector('.agent-policy-note');
    return {
      labPolicy: lab.dataset.agentExecution,
      formPolicy: form.dataset.agentExecution,
      buttonPolicy: button.dataset.agentExecution,
      describedBy: button.getAttribute('aria-describedby'),
      noteId: note?.id,
      noteLabel: note?.getAttribute('aria-label'),
      noteText: note?.innerText,
      requestState: lab.dataset.requestState,
    };
  })()`);
  assert.equal(manualUi.labPolicy, 'manual-only');
  assert.equal(manualUi.formPolicy, 'manual-only');
  assert.equal(manualUi.buttonPolicy, 'manual-only');
  assert.equal(manualUi.describedBy, manualUi.noteId);
  assert.equal(manualUi.noteLabel, 'Agent execution restriction');
  assert.match(manualUi.noteText, /Interactive use only/i);
  assert.match(manualUi.noteText, /prohibits automated requests/i);
  assert.equal(manualUi.requestState, 'idle');
  assert.equal(await b.ev(`Boolean(document.querySelector('[data-output-tab="code"]'))`), false, 'Manual-only provider exposed generic fetch code');

  const beforeBlockedRun = b.requestCount;
  const blocked = await executeNativeTool('run_public_api_demo', { id: 'languagetool-grammar-check' });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /failed/i);
  await sleep(150);
  assert.equal(b.requestCount, beforeBlockedRun, 'Blocked WebMCP execution sent a network request');
  assert(!b.blockedProviders.some((url) => url.includes('api.languagetool.org')), 'LanguageTool request reached the browser interception boundary');
  assert.equal(await b.ev(`document.querySelector('.request-lab').dataset.requestState`), 'idle');
  report.checks.push({ structuredAgentBlock: 'PASS', api: 'languagetool-grammar-check', networkRequests: 0, stateAfterBlock: 'idle' });

  const openLanguageTool = await executeNativeTool('open_public_api_demo', { id: 'languagetool-grammar-check' });
  assert.equal(openLanguageTool.ok, true, openLanguageTool.message);
  await b.wait(`document.querySelector('.parameter-card')?.dataset.apiId === 'languagetool-grammar-check'`);
  await b.viewport(390, 844);
  const mobile = await b.ev(`(() => {
    const note = document.querySelector('.agent-policy-note');
    const form = document.querySelector('.parameter-card');
    return {
      documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      formOverflow: form.scrollWidth > form.clientWidth + 1,
      noteOverflow: note.scrollWidth > note.clientWidth + 1,
      noteWidth: Math.round(note.getBoundingClientRect().width),
    };
  })()`);
  assert.equal(mobile.documentOverflow || mobile.formOverflow || mobile.noteOverflow, false, JSON.stringify(mobile));
  await b.screenshot(`${evidence}/provider-policy-languagetool-390.png`);
  report.checks.push({ mobilePolicyNote: 'PASS', ...mobile });

  await b.viewport(1440, 1000);
  const permitted = await executeNativeTool('run_public_api_demo', { id: 'color-api' });
  assert.equal(permitted.ok, true, permitted.message);
  await b.wait(`document.querySelector('.demo-preview')?.dataset.apiId === 'color-api'`);
  const permittedUi = await b.ev(`(() => {
    const lab = document.querySelector('.request-lab');
    const preview = document.querySelector('.demo-preview');
    return {
      state: lab.dataset.requestState,
      policy: lab.dataset.agentExecution,
      design: preview.dataset.ssotDesign,
      layout: preview.dataset.previewLayout,
      fallback: preview.dataset.ssotFallback,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  })()`);
  assert.deepEqual(permittedUi, {
    state: 'success', policy: 'enabled', design: 'result-card-v2', layout: 'color-swatch', fallback: 'false', overflow: false,
  });
  const colorFixtureRequests = b.fixtureRequests.filter((request) => request.url === colorFixtureUrl && request.method === 'GET');
  assert.equal(colorFixtureRequests.length, 1, JSON.stringify(colorFixtureRequests));
  report.checks.push({ permittedAgentExecution: 'PASS', api: 'color-api', source: 'synthetic-fixture', liveProviderRequests: 0, fixtureRequests: colorFixtureRequests.length, ...permittedUi });

  const ax = await b.call('Accessibility.getFullAXTree');
  const active = ax.nodes.filter((node) => !node.ignored);
  const unnamed = active.filter((node) => ['button', 'combobox', 'textbox', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim());
  assert.equal(unnamed.length, 0, JSON.stringify(unnamed));
  report.checks.push({ accessibilityTree: 'PASS', unnamedControls: 0 });

  assert.deepEqual(b.errors, []);
  report.verdict = 'PASS';
} catch (error) {
  report.verdict = 'FAIL';
  report.error = String(error);
  console.error(error);
} finally {
  report.errors.push(...b.errors);
  await b.close();
  fs.writeFileSync(`${evidence}/provider-policy-verification.json`, JSON.stringify(report, null, 2));
}

console.log(JSON.stringify({ verdict: report.verdict, error: report.error, checks: report.checks }, null, 2));
process.exit(report.verdict === 'PASS' ? 0 : 1);
