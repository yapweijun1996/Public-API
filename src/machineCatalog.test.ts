import { describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { buildMachineCatalog } from './machineCatalog'

describe('machine-readable API catalog', () => {
  it('exports the catalog from the API SSOT without live-health claims', () => {
    const catalog = buildMachineCatalog(apiCatalog, '/Public-API/')
    expect(catalog.schemaVersion).toBe(1)
    expect(catalog.catalogCount).toBe(196)
    expect(catalog.catalogPath).toBe('/Public-API/')
    expect(catalog.requestLabPattern).toBe('/Public-API/#/request-lab?api={api-id}')
    expect(catalog.health).toBe('not-included')
    expect(catalog.automatedVerificationDefault).toEqual({ mode: 'enabled' })
    expect(catalog.apis).toHaveLength(apiCatalog.length)
    expect(new Set(catalog.apis.map((api) => api.id)).size).toBe(apiCatalog.length)
    expect(JSON.stringify(catalog)).not.toContain('buildUrl')
    expect(JSON.stringify(catalog)).not.toContain('lastReviewed')
    expect(JSON.stringify(catalog)).not.toContain('healthy')
  })

  it('carries provider execution policy and deterministic Request Lab paths', () => {
    const catalog = buildMachineCatalog(apiCatalog, 'Public-API')
    const languageTool = catalog.apis.find((api) => api.id === 'languagetool-grammar-check')
    const geocoding = catalog.apis.find((api) => api.id === 'geocoding-search')
    const color = catalog.apis.find((api) => api.id === 'color-api')
    const celestrak = catalog.apis.find((api) => api.id === 'celestrak-satellites')
    const stackExchange = catalog.apis.find((api) => api.id === 'stack-exchange')
    const openAlex = catalog.apis.find((api) => api.id === 'openalex-works-search')
    const datacite = catalog.apis.find((api) => api.id === 'datacite-search')
    const ror = catalog.apis.find((api) => api.id === 'ror-search')
    const coinGecko = catalog.apis.find((api) => api.id === 'coingecko-keyless-market')
    const wikidata = catalog.apis.find((api) => api.id === 'wikidata-sparql')
    const lichess = catalog.apis.find((api) => api.id === 'lichess-top-players')
    const github = catalog.apis.find((api) => api.id === 'github')
    const githubAdvisories = catalog.apis.find((api) => api.id === 'github-global-advisories')
    const exchangeRates = catalog.apis.find((api) => api.id === 'exchange-rate-current')
    const nvd = catalog.apis.find((api) => api.id === 'nvd-cve-detail')
    const nvdCpe = catalog.apis.find((api) => api.id === 'nvd-cpe-search')
    const nvdCves = catalog.apis.find((api) => api.id === 'nvd-cves')
    const internetArchive = catalog.apis.find((api) => api.id === 'internet-archive-search')
    const dogs = catalog.apis.find((api) => api.id === 'dogs')
    const qr = catalog.apis.find((api) => api.id === 'qr-code-generator')
    const goModule = catalog.apis.find((api) => api.id === 'go-module-proxy')
    const npmSearch = catalog.apis.find((api) => api.id === 'npm-search')
    const usaspending = catalog.apis.find((api) => api.id === 'usaspending')
    const crossrefWorks = catalog.apis.find((api) => api.id === 'crossref-works')

    expect(languageTool).toMatchObject({
      method: 'POST',
      keyRequired: false,
      requestLabUrl: '/Public-API/#/request-lab?api=languagetool-grammar-check',
      agentExecution: {
        mode: 'manual-only',
        policyUrl: 'https://dev.languagetool.org/public-http-api.html',
      },
    })
    expect(catalog.apis.some((api) => api.id === 'nominatim-search')).toBe(false)
    expect(geocoding?.agentExecution).toEqual({ mode: 'enabled' })
    expect(geocoding?.parameters).toEqual([
      expect.objectContaining({ id: 'name', type: 'text', minLength: 2 }),
      expect.objectContaining({ id: 'count', type: 'number', min: 1, max: 10, step: 1 }),
    ])
    expect(dogs?.parameters).toEqual([
      expect.objectContaining({ id: 'count', type: 'number', min: 1, max: 10, step: 1 }),
    ])
    expect(dogs?.responseType).toBe('json')
    expect(dogs?.responseContentTypes).toBeUndefined()
    expect(qr?.responseType).toBe('image')
    expect(qr?.responseContentTypes).toEqual(['image/png'])
    expect(goModule?.responseType).toBe('text')
    expect(goModule?.responseContentTypes).toEqual(['text/plain'])
    expect(npmSearch?.parameters).toEqual([
      expect.objectContaining({ id: 'query', type: 'text', minLength: 1 }),
      expect.objectContaining({ id: 'limit', type: 'number', min: 1, max: 20, step: 1 }),
    ])
    expect(usaspending?.parameters).toEqual([
      expect.objectContaining({ id: 'fiscalYear', type: 'number', min: 2008, step: 1 }),
      expect.objectContaining({ id: 'limit', type: 'number', min: 1, max: 20, step: 1 }),
    ])
    expect(crossrefWorks?.parameters).toEqual([
      expect.objectContaining({ id: 'query', type: 'text', minLength: 1 }),
      expect.objectContaining({ id: 'rows', type: 'number', min: 1, max: 20, step: 1 }),
    ])
    expect(stackExchange?.parameters).toEqual([
      expect.objectContaining({ id: 'tags', type: 'text', minLength: 1, maxLength: 200, pattern: '[^;]+(?:;[^;]+){0,4}' }),
      expect.objectContaining({ id: 'limit', type: 'number', min: 1, max: 20, step: 1 }),
    ])
    expect(catalog.apis.every((api) => ['json', 'text', 'image'].includes(api.responseType))).toBe(true)
    expect(color?.agentExecution).toEqual({ mode: 'enabled' })
    expect(color?.automatedVerification).toBeUndefined()
    expect(celestrak?.automatedVerification).toMatchObject({
      mode: 'cadence-limited',
      minimumIntervalSeconds: 7200,
      retryOnNon2xx: false,
      policyUrl: 'https://celestrak.org/usage-policy.php',
    })
    expect(stackExchange?.automatedVerification).toMatchObject({
      mode: 'cadence-limited',
      minimumIntervalSeconds: 60,
      retryOnNon2xx: false,
      policyUrl: 'https://api.stackexchange.com/docs/throttle',
    })
    expect(nvd?.automatedVerification).toMatchObject({
      mode: 'cadence-limited',
      minimumIntervalSeconds: 6,
      retryOnNon2xx: false,
      policyUrl: 'https://nvd.nist.gov/developers/start-here',
    })
    expect(nvd?.parameters).toContainEqual(expect.objectContaining({
      id: 'cve',
      defaultValue: 'CVE-2024-3094',
      pattern: 'CVE-[0-9]{4}-[0-9]{4,}',
    }))
    expect(nvdCpe?.parameters).toEqual([
      expect.objectContaining({ id: 'query', type: 'text', defaultValue: 'openssl', minLength: 1 }),
      expect.objectContaining({ id: 'limit', type: 'number', defaultValue: '8', min: 1, max: 20, step: 1 }),
    ])
    expect(nvdCves?.parameters).toEqual([
      expect.objectContaining({ id: 'query', type: 'text', defaultValue: 'postgresql', minLength: 1, maxLength: 100 }),
      expect.objectContaining({ id: 'limit', type: 'number', defaultValue: '8', min: 1, max: 20, step: 1 }),
    ])
    expect(openAlex?.automatedVerification).toMatchObject({
      mode: 'enabled',
      retryOnRateLimit: false,
      policyUrl: 'https://help.openalex.org/api/errors/',
    })
    expect(datacite?.automatedVerification).toMatchObject({
      mode: 'enabled',
      retryOnRateLimit: false,
      policyUrl: 'https://support.datacite.org/docs/rate-limit',
    })
    expect(datacite?.parameters).toEqual([
      expect.objectContaining({ id: 'query', type: 'text', minLength: 1 }),
      expect.objectContaining({ id: 'count', type: 'number', min: 1, max: 10, step: 1 }),
    ])
    expect(ror?.parameters).toEqual([
      expect.objectContaining({ id: 'query', type: 'text', defaultValue: 'stanford', minLength: 1 }),
    ])
    expect(coinGecko?.automatedVerification).toMatchObject({
      mode: 'enabled',
      retryOnRateLimit: false,
      policyUrl: 'https://docs.coingecko.com/docs/errors-and-rate-limits',
    })
    expect(wikidata?.automatedVerification).toMatchObject({
      mode: 'enabled',
      retryOnRateLimit: false,
      policyUrl: 'https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual',
    })
    expect(lichess?.automatedVerification).toMatchObject({
      mode: 'enabled',
      retryOnRateLimit: false,
      policyUrl: 'https://lichess.org/page/api-tips',
    })
    for (const githubApi of [github, githubAdvisories]) {
      expect(githubApi?.automatedVerification).toMatchObject({
        mode: 'enabled',
        retryOnRateLimit: false,
        rateLimitStatuses: [403, 429],
        policyUrl: 'https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api',
      })
    }
    expect(stackExchange?.parameters.find((field) => field.id === 'tags')).toMatchObject({ pattern: '[^;]+(?:;[^;]+){0,4}', minLength: 1, maxLength: 200 })
    expect(exchangeRates?.keywords).toContain('currency conversion')
    expect(catalog.apis.some((api) => api.id === 'musicbrainz-artist-search')).toBe(false)
    expect(catalog.apis.some((api) => api.id === 'yahoo-finance-sgx-history')).toBe(false)
    expect(catalog.apis.some((api) => api.id === 'gutendex-books')).toBe(false)
    expect(catalog.apis.some((api) => api.id === 'crates-io-search')).toBe(false)
    expect(catalog.apis.some((api) => api.id === 'nws-weather')).toBe(false)
    expect(internetArchive).toMatchObject({
      method: 'GET',
      agentExecution: { mode: 'manual-only', policyUrl: 'https://archive.org/developers/bots.html' },
      parameters: [
        expect.objectContaining({ id: 'query', type: 'text', defaultValue: 'singapore', minLength: 1 }),
        expect.objectContaining({ id: 'mediaType', type: 'select', defaultValue: 'texts' }),
      ],
    })
    expect(internetArchive?.automatedVerification).toBeUndefined()
    expect(internetArchive?.usageNote).toContain('Human-triggered interactive searches')
  })

  it('exports parameter bounds and select options without executable request functions', () => {
    const catalog = buildMachineCatalog(apiCatalog, '/')
    const randomUser = catalog.apis.find((api) => api.id === 'people')
    const geoBoundaries = catalog.apis.find((api) => api.id === 'geoboundaries-admin-boundaries')
    const aladhan = catalog.apis.find((api) => api.id === 'aladhan-prayer-times')
    const brasil = catalog.apis.find((api) => api.id === 'brasilapi-postcode')
    const uniprot = catalog.apis.find((api) => api.id === 'uniprot-protein')
    const pdb = catalog.apis.find((api) => api.id === 'rcsb-pdb-entry')
    const ensembl = catalog.apis.find((api) => api.id === 'ensembl-gene-lookup')
    const firstEpss = catalog.apis.find((api) => api.id === 'first-epss')
    const circl = catalog.apis.find((api) => api.id === 'circl-vulnerability')
    const unhcr = catalog.apis.find((api) => api.id === 'unhcr-refugees')
    const apple = catalog.apis.find((api) => api.id === 'apple-itunes-search')
    const tvmaze = catalog.apis.find((api) => api.id === 'tvmaze-search')
    const zippopotam = catalog.apis.find((api) => api.id === 'zippopotam-postcode')
    const openMeteoClimate = catalog.apis.find((api) => api.id === 'open-meteo-climate')
    const openMeteoHistory = catalog.apis.find((api) => api.id === 'open-meteo-history')
    const openMeteoSeasonal = catalog.apis.find((api) => api.id === 'open-meteo-seasonal')
    const nasaPower = catalog.apis.find((api) => api.id === 'nasa-power-climate')
    const nhtsa = catalog.apis.find((api) => api.id === 'nhtsa-safety-ratings')
    const countries = catalog.apis.find((api) => api.id === 'countries')
    const worldBankIndicator = catalog.apis.find((api) => api.id === 'world-bank-indicator-explorer')
    const bankOfCanada = catalog.apis.find((api) => api.id === 'bank-of-canada-valet')
    const vatcomply = catalog.apis.find((api) => api.id === 'vatcomply')
    expect(countries?.parameters.find((field) => field.id === 'code')).toMatchObject({
      minLength: 2, maxLength: 3, pattern: '[A-Za-z]{2,3}',
      patternDescription: 'must contain exactly two or three letters for an ISO 3166-1 alpha-2 or alpha-3 country code.',
    })
    expect(worldBankIndicator?.parameters.find((field) => field.id === 'country')).toMatchObject({
      minLength: 2, maxLength: 3, pattern: '[A-Za-z]{2,3}',
      patternDescription: 'must contain exactly two or three letters for an ISO 3166-1 alpha-2 or alpha-3 country code.',
    })
    expect(worldBankIndicator?.parameters.find((field) => field.id === 'startYear')).toMatchObject({ step: 1 })
    expect(worldBankIndicator?.parameters.find((field) => field.id === 'endYear')).toMatchObject({ step: 1 })
    expect(bankOfCanada?.parameters.find((field) => field.id === 'series')).toMatchObject({
      minLength: 1,
      pattern: '[A-Za-z0-9_.-]+',
      patternDescription: 'must be one Bank of Canada series code using only letters, digits, underscores, periods, or hyphens.',
    })
    expect(vatcomply?.parameters.find((field) => field.id === 'base')).toMatchObject({ minLength: 3, maxLength: 3, pattern: '[A-Za-z]{3}' })
    expect(tvmaze?.parameters.find((field) => field.id === 'show')).toMatchObject({ type: 'text', defaultValue: 'severance', minLength: 1 })
    expect(vatcomply?.parameters.find((field) => field.id === 'symbols')).toMatchObject({
      minLength: 3,
      pattern: '[A-Za-z]{3}(?:\\s*,\\s*[A-Za-z]{3})*',
      patternDescription: 'must be a comma-separated list of three-letter currency codes.',
    })
    expect(nasaPower?.parameters.find((field) => field.id === 'parameters')).toMatchObject({ type: 'text', minLength: 1 })
    expect(openMeteoSeasonal?.parameters.map((field) => field.id)).toEqual(['latitude', 'longitude', 'forecastDays'])
    expect(openMeteoSeasonal?.parameters.find((field) => field.id === 'forecastDays')).toMatchObject({ type: 'number', defaultValue: '42', min: 1, max: 46, step: 1 })
    expect(nhtsa?.parameters.find((field) => field.id === 'vehicleId')).toMatchObject({
      type: 'text', defaultValue: '19426', minLength: 1, maxLength: 6,
      pattern: '[1-9][0-9]{0,5}',
      patternDescription: 'must be a canonical positive decimal ID from 1 to 999999.',
    })
    expect(randomUser?.parameters.find((field) => field.id === 'count')).toMatchObject({ min: 1, max: 10 })
    expect(randomUser?.parameters.find((field) => field.id === 'nationality')?.options).toContainEqual({ label: 'Australia', value: 'au' })
    expect(geoBoundaries?.parameters.find((field) => field.id === 'countryIso')).toMatchObject({
      minLength: 3, maxLength: 3, pattern: '[A-Za-z]{3}',
      patternDescription: 'must contain exactly three letters (an ISO 3166-1 alpha-3 code or the special ALL code).',
    })
    expect(aladhan?.parameters.find((field) => field.id === 'method')).toMatchObject({ type: 'select', defaultValue: '11' })
    expect(aladhan?.parameters.find((field) => field.id === 'method')?.options?.map((option) => option.value)).toContain('0')
    expect(aladhan?.parameters.find((field) => field.id === 'method')?.options?.map((option) => option.value)).not.toContain('99')
    expect(brasil?.parameters.find((field) => field.id === 'postcode')).toMatchObject({ pattern: '\\d{5}-?\\d{3}', patternDescription: 'must contain exactly eight digits, optionally formatted as 12345-678.' })
    expect(catalog.apis.find((api) => api.id === 'color-api')?.parameters.find((field) => field.id === 'hex')).toMatchObject({
      pattern: '#?(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})',
      patternDescription: 'must be a 3- or 6-digit hexadecimal color, with an optional leading #.',
    })
    expect(uniprot?.parameters.find((field) => field.id === 'accession')).toMatchObject({
      pattern: '[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2}',
      patternDescription: 'must be a valid 6- or 10-character UniProtKB accession.',
    })
    expect(pdb?.parameters.find((field) => field.id === 'entryId')).toMatchObject({
      minLength: 4,
      maxLength: 12,
      pattern: '(?:[A-Za-z0-9]{4}|[Pp][Dd][Bb]_0000[A-Za-z0-9]{4})',
      patternDescription: 'must be a four-character PDB ID or a transitional pdb_0000XXXX extended alias for an entry that still has a legacy ID.',
    })
    expect(ensembl?.parameters.find((field) => field.id === 'geneId')).toMatchObject({
      pattern: 'ENS[A-Z]*G[0-9]{11}',
      patternDescription: 'must be an unversioned Ensembl gene stable ID such as ENSG00000157764.',
    })
    expect(circl?.agentExecution).toEqual({
      mode: 'manual-only',
      reason: 'CIRCL requires automated clients to send a meaningful User-Agent containing a contact URL or email. Browser JavaScript cannot set that protected header, so generic structured execution cannot satisfy the provider policy.',
      policyUrl: 'https://vulnerability.circl.lu/.well-known/api-policy.json',
    })
    expect(circl?.usageNote).toMatch(/anonymous use up to 20 requests per minute/i)
    for (const api of [firstEpss, circl]) {
      expect(api?.parameters.find((field) => field.id === 'cve')).toMatchObject({
        pattern: 'CVE-[0-9]{4}-[0-9]{4,}',
        patternDescription: 'must use the CVE-YYYY-NNNN format with four or more sequence digits.',
      })
    }
    expect(unhcr?.parameters.find((field) => field.id === 'origin')).toMatchObject({
      minLength: 3, maxLength: 3, pattern: '[A-Za-z]{3}',
      patternDescription: 'must contain exactly three letters for an ISO 3166-1 alpha-3 country code.',
    })
    for (const api of [apple, zippopotam]) {
      expect(api?.parameters.find((field) => field.id === 'country')).toMatchObject({
        minLength: 2, maxLength: 2, pattern: '[A-Za-z]{2}',
        patternDescription: 'must contain exactly two letters for an ISO 3166-1 alpha-2 country code.',
      })
    }
    expect(apple?.parameters.map((field) => field.id)).toEqual(['query', 'entity', 'country', 'limit'])
    expect(apple?.parameters.find((field) => field.id === 'entity')).toMatchObject({ type: 'select', defaultValue: 'song' })
    expect(apple?.parameters.find((field) => field.id === 'entity')?.options?.map((option) => option.value)).toEqual([
      'song', 'musicTrack', 'album', 'musicArtist', 'musicVideo', 'mix', 'podcast', 'podcastAuthor',
    ])
    expect(openMeteoClimate?.parameters.find((field) => field.id === 'model')).toMatchObject({ type: 'select', defaultValue: 'CMCC_CM2_VHR4' })
    expect(openMeteoClimate?.parameters.find((field) => field.id === 'model')?.options?.map((option) => option.value)).toEqual([
      'CMCC_CM2_VHR4', 'FGOALS_f3_H', 'HiRAM_SIT_HR', 'MRI_AGCM3_2_S', 'EC_Earth3P_HR', 'MPI_ESM1_2_XR', 'NICAM16_8S',
    ])
    expect(openMeteoHistory?.parameters.find((field) => field.id === 'endDate')).toMatchObject({ minimumFromField: 'startDate' })
    expect(openMeteoClimate?.parameters.find((field) => field.id === 'endYear')).toMatchObject({ minimumFromField: 'startYear' })
    expect(worldBankIndicator?.parameters.find((field) => field.id === 'endYear')).toMatchObject({ minimumFromField: 'startYear' })
  })
})
