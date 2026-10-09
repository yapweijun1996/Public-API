import assert from 'node:assert/strict'
import { browser, root, sleep } from './lib/pages-origin-browser.mjs'

const cases = [
  {
    id: 'color-api', bundle: 'DiagnosticPreviewBundle', cssBundles: ['DiagnosticPreviewBundle'], cssBudgetBytes: 12000, url: 'https://www.thecolorapi.com/id?hex=24B1E0',
    body: { hex: { value: '#24B1E0', clean: '24B1E0' }, name: { value: 'Cerulean' }, rgb: { value: 'rgb(36, 177, 224)', r: 36, g: 177, b: 224 }, hsl: { value: 'hsl(195, 76%, 51%)' }, hsv: { value: 'hsv(195, 84%, 88%)' }, cmyk: { value: 'cmyk(84, 21, 0, 12)' }, XYZ: { value: 'XYZ(30, 38, 76)' }, contrast: { value: '#000000' } },
  },
  {
    id: 'github', bundle: 'DeveloperSemanticPreviewBundle', cssBundles: ['SemanticCards'], cssBudgetBytes: 9000, url: 'https://api.github.com/users/octocat/repos?type=owner&sort=full_name&direction=asc&per_page=8',
    allowHeaders: 'Accept, Content-Type, X-GitHub-Api-Version',
    body: [{ id: 1, name: 'semantic-demo', full_name: 'octocat/semantic-demo', owner: { login: 'octocat' }, private: false, visibility: 'public', html_url: 'https://github.com/octocat/semantic-demo', description: 'Synthetic code-splitting fixture.', fork: false, archived: false, disabled: false, language: 'TypeScript', default_branch: 'main', stargazers_count: 3, forks_count: 1, open_issues_count: 0, topics: ['semantic'], updated_at: '2026-09-08T12:00:00Z', pushed_at: '2026-09-08T11:00:00Z' }],
  },
  {
    id: 'ipify-public-ip', bundle: 'SpecializedCatalogPreviews', cssBundles: ['SpecializedCatalogPreviews', 'SemanticCards', 'DateList'], cssBudgetBytes: 24000, url: 'https://api64.ipify.org?format=json',
    body: { ip: '203.0.113.10' },
  },
  {
    id: 'pypi-json', bundle: 'PackageSemanticPreviewBundle', cssBundles: ['PackageSemanticPreviewBundle', 'SemanticCards'], cssBudgetBytes: 10000, url: 'https://pypi.org/pypi/requests/json',
    body: { info: { name: 'requests', version: '2.34.2', summary: 'Python HTTP for Humans.', requires_python: '>=3.10', license_expression: 'Apache-2.0', maintainer: 'Kenneth Reitz', yanked: false }, vulnerabilities: [] },
  },
  {
    id: 'openverse-search', bundle: 'CatalogFamilyPreviews', cssBundles: ['CatalogFamilyPreviews', 'DateList', 'SemanticCards'], cssBudgetBytes: 32000, url: 'https://api.openverse.org/v1/images/?q=space&page_size=8&page=1',
    body: { page: 1, page_count: 1, page_size: 8, result_count: 1, results: [{ id: '11111111-1111-4111-8111-111111111111', title: 'Space work', creator: 'Fixture creator', license: 'by', license_version: '4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/', foreign_landing_url: 'https://example.test/work/11111111-1111-4111-8111-111111111111', url: 'https://example.test/media/11111111-1111-4111-8111-111111111111.jpg', thumbnail: 'https://example.test/thumb/11111111-1111-4111-8111-111111111111.jpg', source: 'fixture', provider: 'fixture' }] },
  },
  {
    id: 'data-gov-taxi', bundle: 'CatalogFamilyPreviews', cssBundles: ['CatalogFamilyPreviews', 'DateList', 'SemanticCards'], cssBudgetBytes: 32000, url: 'https://api.data.gov.sg/v1/transport/taxi-availability',
    body: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'MultiPoint', coordinates: [[103.8, 1.3], [103.81, 1.31]] }, properties: { timestamp: '2026-09-17T12:34:56+08:00', taxi_count: 2 } }] },
  },
  {
    id: 'data-gov-traffic-images', bundle: 'TrafficCameraPreviewBundle', cssBundles: ['TrafficCameraPreviewBundle'], cssBudgetBytes: 6000, url: 'https://api.data.gov.sg/v1/transport/traffic-images',
    body: { items: [{ timestamp: '2026-09-17T12:34:56+08:00', cameras: [{ timestamp: '2026-09-17T12:34:56+08:00', camera_id: '1001', image: 'https://example.test/traffic-camera-1001.jpg', location: { latitude: 1.29531332, longitude: 103.871146 }, image_metadata: { height: 1080, width: 1920, md5: '0123456789abcdef0123456789abcdef' } }] }], api_info: { status: 'healthy' } },
  },
  {
    id: 'weather', bundle: 'WeatherPreviews', cssBundles: ['WeatherPreviews', 'stationList'], cssBudgetBytes: 17000, url: 'https://api.open-meteo.com/v1/forecast?latitude=1.3521&longitude=103.8198&current=temperature_2m%2Crelative_humidity_2m%2Cwind_speed_10m%2Cweather_code&timezone=auto',
    body: { latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore', current: { temperature_2m: 30, relative_humidity_2m: 70, wind_speed_10m: 5, weather_code: 1, time: '2026-09-08T20:00' }, current_units: { temperature_2m: '°C', wind_speed_10m: 'km/h' } },
  },
  {
    id: 'mempool-space-btc', bundle: 'OperationalPreviews', cssBundles: ['OperationalPreviews', 'SemanticCards'], cssBudgetBytes: 9000, url: 'https://mempool.space/api/v1/fees/recommended',
    body: { fastestFee: 5, halfHourFee: 4, hourFee: 3, economyFee: 2, minimumFee: 1 },
  },
  {
    id: 'coinpaprika-ticker', bundle: 'MarketPreviews', cssBundles: ['MarketPreviews'], cssBudgetBytes: 5500, url: 'https://api.coinpaprika.com/v1/tickers/btc-bitcoin',
    body: { id: 'btc-bitcoin', name: 'Bitcoin', symbol: 'BTC', last_updated: '2026-09-08T12:00:00Z', quotes: { USD: { price: 100000, percent_change_24h: 1.5, market_cap: 1980000000000, volume_24h: 50000000000 } } },
  },
  {
    id: 'carbon-intensity-gb', bundle: 'SemanticPreviewBundle', cssBundles: ['SemanticPreviewBundle', 'SemanticCards', 'stationList'], cssBudgetBytes: 32000, url: 'https://api.carbonintensity.org.uk/intensity',
    body: { data: [{ from: '2026-09-08T12:00Z', to: '2026-09-08T12:30Z', intensity: { forecast: 80, actual: 75, index: 'low' } }] },
  },
  {
    id: 'pubchem-compound', bundle: 'ScienceSemanticPreviewBundle', cssBundles: ['ScienceSemanticPreviewBundle'], cssBudgetBytes: 15000, url: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/aspirin/property/MolecularFormula,MolecularWeight,IUPACName/JSON',
    body: { PropertyTable: { Properties: [{ CID: 2244, MolecularFormula: 'C9H8O4', MolecularWeight: '180.16', IUPACName: '2-acetyloxybenzoic acid' }] } },
  },
  {
    id: 'openfda-drug-labels', bundle: 'ScienceSemanticPreviewBundle', cssBundles: ['ScienceSemanticPreviewBundle'], cssBudgetBytes: 15000, url: 'https://api.fda.gov/drug/label.json?search=openfda.brand_name%3A%22Advil%22&limit=8',
    body: { meta: { last_updated: '2026-09-04', results: { skip: 0, limit: 8, total: 39 } }, results: [{ openfda: { brand_name: ['Advil Dual Action with Acetaminophen'], generic_name: ['IBUPROFEN, ACETAMINOPHEN TABLET, FILM COATED'], manufacturer_name: ["Lil' Drug Store Products, Inc."], product_type: ['HUMAN OTC DRUG'], route: ['ORAL'], substance_name: ['IBUPROFEN', 'ACETAMINOPHEN'] }, active_ingredient: ['Acetaminophen 250 mg Ibuprofen 125 mg'], indications_and_usage: ['Temporarily relieves minor aches and pains.'], warnings: ['This product contains acetaminophen and ibuprofen.'], dosage_and_administration: ['Adults take 2 caplets.'] }] },
  },
  {
    id: 'jolpica-f1', bundle: 'SportsSemanticPreviewBundle', cssBundles: ['SportsSemanticPreviewBundle'], cssBudgetBytes: 10000, url: 'https://api.jolpi.ca/ergast/f1/2025/drivers.json?limit=8',
    body: { MRData: { series: 'f1', limit: '8', offset: '0', total: '1', DriverTable: { season: '2025', Drivers: [{ driverId: 'norris', permanentNumber: '4', code: 'NOR', givenName: 'Lando', familyName: 'Norris', dateOfBirth: '1999-11-13', nationality: 'British', url: 'https://example.invalid/norris' }] } } },
  },
  {
    id: 'opendota-pro-matches', bundle: 'SportsSemanticPreviewBundle', cssBundles: ['SportsSemanticPreviewBundle'], cssBudgetBytes: 10000, url: 'https://api.opendota.com/api/proMatches',
    body: [{ match_id: 8988152817, duration: 2045, start_time: 1788819538, radiant_team_id: 10122515, radiant_name: 'The House Esports', dire_team_id: 2885851, dire_name: 'GIOR DOTA', leagueid: 20206, league_name: 'NEXUS SERIES I', series_id: 1139391, series_type: 1, radiant_score: 16, dire_score: 30, radiant_win: false, version: 22 }],
  },
  {
    id: 'openligadb-matches', bundle: 'SportsSemanticPreviewBundle', cssBundles: ['SportsSemanticPreviewBundle'], cssBudgetBytes: 10000, url: 'https://api.openligadb.de/getmatchdata/bl1/2025/1',
    body: [{ matchID: 77257, matchDateTime: '2025-08-23T15:30:00', timeZoneID: 'W. Europe Standard Time', leagueId: 4821, leagueName: '1. Fußball-Bundesliga 2025/2026', leagueSeason: 2025, leagueShortcut: 'bl1', matchDateTimeUTC: '2025-08-23T13:30:00Z', group: { groupName: '1. Spieltag', groupOrderID: 1 }, team1: { teamId: 6, teamName: 'Bayer 04 Leverkusen' }, team2: { teamId: 175, teamName: 'TSG Hoffenheim' }, matchIsFinished: true, matchResults: [{ resultName: 'Halbzeit', pointsTeam1: 1, pointsTeam2: 1, resultOrderID: 1, resultTypeKind: 'HalfTime' }, { resultName: 'Endergebnis', pointsTeam1: 1, pointsTeam2: 2, resultOrderID: 2, resultTypeKind: 'After90Minutes' }], goals: [{ goalID: 1 }, { goalID: 2 }, { goalID: 3 }] }],
  },
]

const bundleNames = cases.map((entry) => entry.bundle)
const jsAssetNames = (entries) => entries.map((entry) => new URL(entry.name).pathname).filter((name) => name.endsWith('.js'))
const implementationBundles = (entries) => jsAssetNames(entries).filter((name) => bundleNames.some((bundle) => name.includes(`/${bundle}-`)))
const cssAssetNames = (entries) => entries.map((entry) => new URL(entry.name).pathname).filter((name) => name.endsWith('.css'))
const decodedBytes = (entries) => entries.reduce((sum, entry) => sum + Number(entry.decodedBodySize || 0), 0)
const report = { origin: 'https://yapweijun1996.github.io', source: 'synthetic fixtures; no live provider health claims', cases: [], verdict: 'PASS' }

for (const entry of cases) {
  const fixtures = new Map([[entry.url, { body: entry.body, allowHeaders: entry.allowHeaders }]])
  const b = await browser(`${root}/dist`, { fixtures })
  try {
    await b.nav(entry.id)
    const before = await b.ev(`performance.getEntriesByType('resource').map(e=>({name:e.name,decodedBodySize:e.decodedBodySize})).filter(e=>e.name.includes('/assets/'))`)
    assert.equal(before.some((asset) => asset.name.includes('/responsePreview-')), false, `${entry.id}: response preview loaded before run`)
    assert.deepEqual(implementationBundles(before), [], `${entry.id}: implementation bundle loaded before run`)

    const result = await b.run()
    assert.equal(result.ok, true, `${entry.id}: ${result.error || 'request failed'}`)
    await sleep(100)
    const after = await b.ev(`performance.getEntriesByType('resource').map(e=>({name:e.name,decodedBodySize:e.decodedBodySize})).filter(e=>e.name.includes('/assets/'))`)
    const added = after.filter((asset) => !before.some((prior) => prior.name === asset.name))
    const loadedBundles = implementationBundles(added)
    assert.equal(loadedBundles.length, 1, `${entry.id}: expected exactly one implementation bundle, got ${loadedBundles.join(', ')}`)
    assert(loadedBundles[0].includes(`/${entry.bundle}-`), `${entry.id}: loaded ${loadedBundles[0]} instead of ${entry.bundle}`)
    assert.equal(added.filter((asset) => new URL(asset.name).pathname.includes('/responsePreview-') && new URL(asset.name).pathname.endsWith('.js')).length, 1, `${entry.id}: expected one registry chunk`)

    const beforeCssBytes = decodedBytes(before.filter((asset) => new URL(asset.name).pathname.endsWith('.css')))
    assert(beforeCssBytes <= 50000, `${entry.id}: initial CSS ${beforeCssBytes} B exceeds 50000 B cold-load budget`)
    const cssAssets = cssAssetNames(added)
    const implementationCss = cssAssets.filter((name) => !name.includes('/responsePreview-'))
    assert.equal(cssAssets.filter((name) => name.includes('/responsePreview-')).length, 1, `${entry.id}: expected one shared domain-card CSS chunk`)
    const expectedCssBundles = entry.cssBundles || []
    const cssBundleMatch = (name, bundle) => name.toLowerCase().includes(`/${bundle.toLowerCase()}-`)
    for (const bundle of expectedCssBundles) {
      assert.equal(implementationCss.filter((name) => cssBundleMatch(name, bundle)).length, 1, `${entry.id}: expected CSS dependency ${bundle}, got ${implementationCss.join(', ')}`)
    }
    const unexpectedCss = implementationCss.filter((name) => !expectedCssBundles.some((bundle) => cssBundleMatch(name, bundle)))
    assert.deepEqual(unexpectedCss, [], `${entry.id}: loaded unrelated implementation CSS: ${unexpectedCss.join(', ')}`)
    const decodedCssBytes = decodedBytes(added.filter((asset) => new URL(asset.name).pathname.endsWith('.css')))
    assert(decodedCssBytes <= entry.cssBudgetBytes, `${entry.id}: result CSS ${decodedCssBytes} B exceeds ${entry.cssBudgetBytes} B budget`)

    const dom = await b.ev(`(()=>{const shell=document.querySelector('.demo-preview');return {apiId:shell?.dataset.apiId||'',fallback:shell?.dataset.ssotFallback||'',layout:shell?.dataset.previewLayout||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)
    assert.equal(dom.apiId, entry.id)
    assert.equal(dom.fallback, 'false')
    assert.equal(dom.overflow, false)
    await b.viewport(390, 844)
    const mobileOverflow = await b.ev(`document.documentElement.scrollWidth>document.documentElement.clientWidth+1`)
    assert.equal(mobileOverflow, false, `${entry.id}: 390px result viewport has horizontal document overflow`)
    const liveProviderRequests = b.fixtureRequests.filter((request) => request.source !== 'synthetic-fixture').length
    assert.equal(liveProviderRequests, 0)
    report.cases.push({ id: entry.id, bundle: entry.bundle, layout: dom.layout, mobile390Overflow: mobileOverflow, initialCssBytes: beforeCssBytes, decodedResultAssets: decodedBytes(added), decodedResultCss: decodedCssBytes, loadedBundle: new URL(loadedBundles[0], report.origin).pathname, loadedCss: cssAssets })
  } finally {
    await b.close()
  }
}



// A rejected implementation chunk must be contained inside Request Lab. Raw JSON stays usable,
// and a full reload provides a portable recovery path without relying on same-document import retry behavior.
{
  const entry = cases[0]
  const fixtures = new Map([[entry.url, { body: entry.body }]])
  const b = await browser(`${root}/dist`, {
    fixtures,
    appAssetFailures: [{ includes: '/DiagnosticPreviewBundle-', remaining: 1 }],
  })
  try {
    await b.nav(entry.id)
    await b.ev(`document.querySelector('.parameter-card').requestSubmit()`)
    await b.wait(`document.querySelector('.request-lab')?.dataset.requestState==='success'`, 24000)
    await b.wait(`document.querySelector('[data-preview-load-state="error"]')`)

    const failedState = await b.ev(`(()=>({
      requestState:document.querySelector('.request-lab')?.dataset.requestState||'',
      alertText:document.querySelector('[data-preview-load-state="error"]')?.innerText||'',
      reloadName:document.querySelector('[data-preview-load-state="error"] button')?.textContent||'',
      rawJson:document.querySelector('.response-body pre')?.textContent||'',
      formPresent:Boolean(document.querySelector('form.parameter-card')),
      previewPresent:Boolean(document.querySelector('.demo-preview')),
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
    }))()`)
    assert.equal(failedState.requestState, 'success')
    assert.equal(failedState.formPresent, true)
    assert.equal(failedState.previewPresent, false)
    assert.equal(failedState.reloadName, 'Reload application')
    assert(failedState.alertText.includes('Raw JSON'), 'Preview failure message must preserve the Raw JSON recovery path')
    assert(failedState.rawJson.includes('#24B1E0'), 'Raw JSON disappeared after preview chunk failure')
    assert.equal(failedState.overflow, false)
    assert.equal(b.appAssetFailureRequests.length, 1)
    assert(b.appAssetFailureRequests[0].path.includes('/DiagnosticPreviewBundle-'))

    const ax = await b.call('Accessibility.getFullAXTree')
    const reloadButton = ax.nodes.find((node) => !node.ignored && node.role?.value === 'button' && node.name?.value === 'Reload application')
    const alert = ax.nodes.find((node) => !node.ignored && node.role?.value === 'alert' && node.name?.value === 'Semantic preview failed to load')
    assert(reloadButton, 'Reload application button missing from accessibility tree')
    assert(alert, 'Semantic preview failure alert missing from accessibility tree')

    await b.ev(`document.querySelector('[data-preview-load-state="error"] button').click()`)
    await b.wait(`document.querySelector('.request-lab')?.dataset.apiId==='color-api' && !!document.querySelector('form.parameter-card')`, 12000)
    await b.ev(`document.querySelector('.parameter-card').requestSubmit()`)
    await b.wait(`document.querySelector('.request-lab')?.dataset.requestState==='success'`, 24000)
    await b.wait(`document.querySelector('.demo-preview')`)
    const recovered = await b.ev(`(()=>{const shell=document.querySelector('.demo-preview');return {layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',card:Boolean(shell?.querySelector('[data-domain-card="color-swatch"]')),error:Boolean(document.querySelector('[data-preview-load-state="error"]'))}})()`)
    assert.equal(recovered.layout, 'color-swatch')
    assert.equal(recovered.fallback, 'false')
    assert.equal(recovered.card, true)
    assert.equal(recovered.error, false)
    assert.equal(b.appAssetFailureRequests.length, 1, 'One-shot chunk fault fired more than once')
    assert.equal(b.blockedProviders.length, 0)

    report.failureRecovery = {
      id: entry.id,
      failedAsset: b.appAssetFailureRequests[0].path,
      containment: 'PASS',
      rawJsonPreserved: true,
      accessibleReload: true,
      fullReloadRecovery: 'PASS',
      liveProviderRequests: 0,
    }
  } finally {
    await b.close()
  }
}

console.log(JSON.stringify(report, null, 2))
