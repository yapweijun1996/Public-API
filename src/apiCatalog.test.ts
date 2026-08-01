import { describe, expect, it } from 'vitest'
import { apiCatalog, getApiById, getDefaultParameters, validateParameters, yahooSgxSymbols } from './apiCatalog'
import { previewProfileIds, previewProfiles } from './previewProfiles'

describe('API catalog', () => {
  it('has unique IDs and builds valid HTTPS URLs from defaults', () => {
    expect(new Set(apiCatalog.map((api) => api.id)).size).toBe(apiCatalog.length)

    for (const api of apiCatalog) {
      const url = new URL(api.buildUrl(getDefaultParameters(api)))
      expect(url.protocol).toBe('https:')
    }
  })

  it('has unique monograms (no duplicate UI badges)', () => {
    expect(new Set(apiCatalog.map((api) => api.monogram)).size).toBe(apiCatalog.length)
  })

  it('assigns a valid 6-digit hex accent to every catalog entry', () => {
    for (const api of apiCatalog) {
      expect(api.accent, api.id).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('assigns one intentional demo preview profile to every catalog API', () => {
    const catalogIds = apiCatalog.map((api) => api.id).sort()
    const profileIds = [...previewProfileIds].sort()

    expect(new Set(previewProfileIds).size).toBe(previewProfileIds.length)
    expect(profileIds).toEqual(catalogIds)
    expect(Object.keys(previewProfiles).sort()).toEqual(catalogIds)
    expect(Object.values(previewProfiles).every((profile) => profile.layout !== 'result-list')).toBe(true)
    expect(new Set(Object.values(previewProfiles).map((profile) => profile.label)).size).toBe(apiCatalog.length)
  })

  it('includes the expanded recommendations without duplicating the five original providers', () => {
    expect(apiCatalog).toHaveLength(143)
    expect(apiCatalog.filter((api) => api.id.startsWith('data-gov-'))).toHaveLength(14)
    expect(getApiById('ipify-public-ip')?.provider).toBe('ipify')
    expect(getApiById('usaspending')?.method).toBe('POST')
    for (const provider of ['Random User', 'Dog CEO', 'JSONPlaceholder', 'Nager.Date']) {
      expect(apiCatalog.filter((api) => api.provider === provider), provider).toHaveLength(1)
    }
  })

  it('builds the six new keyless interactive API requests', () => {
    const urls = Object.fromEntries(['geocoding-search', 'open-meteo-air-quality', 'sunrise-sunset', 'nasa-eonet-events', 'mbta-transit-routes', 'open-trivia'].map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['geocoding-search'].searchParams.get('name')).toBe('Singapore')
    expect(urls['open-meteo-air-quality'].searchParams.get('current')).toContain('us_aqi')
    expect(urls['sunrise-sunset'].pathname).toBe('/v2')
    expect(urls['nasa-eonet-events'].searchParams.get('status')).toBe('open')
    expect(urls['mbta-transit-routes'].searchParams.get('filter[type]')).toBe('0,1')
    expect(urls['open-trivia'].searchParams.get('type')).toBe('multiple')
  })

  it('builds the requested long-history market demos', () => {
    const yahoo = getApiById('yahoo-finance-sgx-history')
    const frankfurter = getApiById('frankfurter-sgd-myr-history')

    expect(yahooSgxSymbols).toHaveLength(22)
    expect(yahoo).toBeDefined()
    expect(frankfurter).toBeDefined()
    if (!yahoo || !frankfurter) return

    expect(yahoo.buildUrl(getDefaultParameters(yahoo))).toContain('/D05.SI?range=max&interval=1mo')
    expect(yahoo?.parseResponse?.('Header\nMarkdown Content:\n{"chart":{"result":[]}}')).toEqual({ chart: { result: [] } })
    expect(yahoo.parseResponse?.('{"data":{"content":"{\\"chart\\":{\\"result\\":[]}}"}}')).toEqual({ chart: { result: [] } })
    expect(frankfurter.buildUrl(getDefaultParameters(frankfurter))).toContain('from=1999-01-04')
    expect(frankfurter.buildUrl(getDefaultParameters(frankfurter))).toContain('base=SGD&quotes=MYR&providers=ECB')
  })

  it('builds the five new keyless specialist API requests', () => {
    const ids = ['malaysia-fuel-price', 'open-meteo-marine', 'nobel-prizes', 'chess-player-stats', 'crossref-works']
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['malaysia-fuel-price'].hostname).toBe('api.data.gov.my')
    expect(urls['malaysia-fuel-price'].searchParams.get('id')).toBe('fuelprice')
    expect(urls['open-meteo-marine'].searchParams.get('hourly')).toContain('ocean_current_velocity')
    expect(urls['open-meteo-marine'].searchParams.get('forecast_days')).toBe('3')
    expect(urls['nobel-prizes'].searchParams.get('nobelPrizeCategory')).toBe('phy')
    expect(urls['chess-player-stats'].pathname).toBe('/pub/player/hikaru/stats')
    expect(urls['crossref-works'].searchParams.get('select')).toContain('DOI')
  })

  it('builds the next twelve browser-ready keyless API requests', () => {
    const ids = [
      'noaa-space-weather', 'osv-vulnerability', 'federal-register-documents', 'wikipedia-search',
      'open-meteo-flood', 'open-meteo-history', 'kraken-public-ticker', 'gitlab-public-projects',
      'uk-police-street-crime', 'open-brewery-directory', 'rick-morty-characters', 'wikimedia-pageviews',
    ]
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['noaa-space-weather'].pathname).toBe('/products/noaa-scales.json')
    expect(urls['osv-vulnerability'].pathname).toContain('/v1/vulns/GHSA-jfh8-c2jp-5v3q')
    expect(urls['federal-register-documents'].searchParams.get('conditions[term]')).toBe('artificial intelligence')
    expect(urls['wikipedia-search'].searchParams.get('generator')).toBe('search')
    expect(urls['open-meteo-flood'].searchParams.get('daily')).toContain('river_discharge')
    expect(urls['open-meteo-history'].searchParams.get('daily')).toContain('temperature_2m_max')
    expect(urls['kraken-public-ticker'].searchParams.get('pair')).toBe('XBTUSD')
    expect(urls['gitlab-public-projects'].searchParams.get('visibility')).toBe('public')
    expect(urls['uk-police-street-crime'].pathname).toContain('/burglary')
    expect(urls['open-brewery-directory'].searchParams.get('by_country')).toBe('united_states')
    expect(urls['rick-morty-characters'].searchParams.get('name')).toBe('Rick')
    expect(urls['wikimedia-pageviews'].pathname).toContain('/Singapore/daily/')
  })

  it('builds the twelve newly verified keyless API requests', () => {
    const ids = [
      'openf1-historical', 'irail-liveboard', 'spaceflight-news', 'launch-library-upcoming',
      'wiktionary-entry', 'animechan-random-quote', 'jokeapi-safe', 'dummyjson-recipes',
      'brasilapi-postcode', 'poetrydb-poems', 'coingecko-keyless-market', 'swapi-people',
    ]
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['openf1-historical'].pathname).toBe('/v1/sessions')
    expect(urls['openf1-historical'].searchParams.get('country_name')).toBe('Singapore')
    expect(urls['irail-liveboard'].pathname).toBe('/liveboard/')
    expect(urls['irail-liveboard'].searchParams.get('arrdep')).toBe('departure')
    expect(urls['spaceflight-news'].pathname).toBe('/v4/articles/')
    expect(urls['spaceflight-news'].searchParams.get('limit')).toBe('6')
    expect(urls['launch-library-upcoming'].pathname).toBe('/2.2.0/launch/upcoming/')
    expect(urls['launch-library-upcoming'].searchParams.get('limit')).toBe('4')
    expect(urls['wiktionary-entry'].pathname).toBe('/api/rest_v1/page/definition/hello')
    expect(urls['animechan-random-quote'].pathname).toBe('/v1/quotes/random')
    expect(urls['jokeapi-safe'].pathname).toBe('/joke/Programming')
    expect(urls['jokeapi-safe'].search).toContain('safe-mode')
    expect(urls['dummyjson-recipes'].pathname).toBe('/recipes/search')
    expect(urls['brasilapi-postcode'].pathname).toBe('/api/cep/v2/01310930')
    expect(decodeURIComponent(urls['poetrydb-poems'].pathname)).toContain('/Emily Dickinson;3/')
    expect(urls['coingecko-keyless-market'].searchParams.get('ids')).toBe('bitcoin')
    expect(urls['swapi-people'].searchParams.get('search')).toBe('Luke')
  })

  it('builds the seven externally-verified expansion API requests', () => {
    const ids = ['google-dns-doh', 'color-api', 'nasa-image-search', 'lichess-top-players', 'pubmed-search', 'rxnorm-drug-search', 'inaturalist-observations']
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['google-dns-doh'].searchParams.get('name')).toBe('example.com')
    expect(urls['color-api'].searchParams.get('hex')).toBe('24B1E0')
    expect(urls['nasa-image-search'].searchParams.get('media_type')).toBe('image')
    expect(urls['lichess-top-players'].pathname).toBe('/api/player/top/5/blitz')
    expect(urls['pubmed-search'].searchParams.get('db')).toBe('pubmed')
    expect(urls['rxnorm-drug-search'].searchParams.get('name')).toBe('ibuprofen')
    expect(urls['inaturalist-observations'].searchParams.get('taxon_name')).toBe('Panthera')
  })

  it('builds the fourteen second-expansion API requests', () => {
    const ids = [
      'first-epss', 'endoflife-date', 'deps-dev', 'ecb-fx-rates', 'un-sdg-goals', 'datacite-search',
      'ror-search', 'celestrak-satellites', 'musicbrainz-artist-search', 'cleveland-museum-search',
      'scryfall-card-search', 'dnd5e-spell-lookup', 'qr-code-generator', 'where-the-iss-at',
    ]
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['first-epss'].searchParams.get('cve')).toBe('CVE-2021-44228')
    expect(urls['endoflife-date'].pathname).toBe('/api/v1/products/nodejs')
    expect(urls['deps-dev'].pathname).toBe('/v3/systems/npm/packages/react')
    expect(urls['ecb-fx-rates'].pathname).toBe('/service/data/EXR/D.USD.EUR.SP00.A')
    expect(urls['ecb-fx-rates'].searchParams.get('lastNObservations')).toBe('30')
    expect(urls['un-sdg-goals'].pathname).toBe('/SDGAPI/v1/sdg/Goal/List')
    expect(urls['datacite-search'].searchParams.get('query')).toBe('climate change')
    expect(urls['ror-search'].searchParams.get('query')).toBe('stanford')
    expect(urls['celestrak-satellites'].searchParams.get('GROUP')).toBe('stations')
    expect(urls['musicbrainz-artist-search'].searchParams.get('query')).toBe('queen')
    expect(urls['cleveland-museum-search'].searchParams.get('q')).toBe('monet')
    expect(urls['scryfall-card-search'].searchParams.get('q')).toBe('dragon')
    expect(urls['dnd5e-spell-lookup'].pathname).toBe('/api/2014/spells/fireball')
    expect(urls['qr-code-generator'].searchParams.get('data')).toBe('https://example.com')
    expect(urls['where-the-iss-at'].pathname).toBe('/v1/satellites/25544')

    const qrApi = getApiById('qr-code-generator')
    expect(qrApi?.parseResponse?.('binary-png-bytes')).toEqual({ note: 'Binary PNG image response — see the rendered QR code below.', approximateBytes: 16 })
  })

  it('builds the twenty-nine third-expansion API requests', () => {
    const ids = [
      'eurostat-population', 'bls-timeseries', 'fema-disasters', 'noaa-tides', 'rdap-domain-lookup',
      'languagetool-grammar-check', 'zenodo-search', 'doaj-search', 'pubchem-compound', 'chembl-molecule',
      'uniprot-protein', 'rcsb-pdb-entry', 'ensembl-gene-lookup', 'obis-marine-occurrences', 'worms-species-lookup',
      'paleobiodb-taxa', 'usgs-water-legacy', 'crates-io-search', 'rubygems-lookup', 'nuget-package-lookup',
      'internet-archive-search', 'ipwhois-lookup', 'newton-math-solver', 'gutendex-books', 'datamuse-rhymes',
      'open5e-monster-search', 'dicebear-avatar', 'catfacts', 'randomfox-photo',
    ]
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['eurostat-population'].searchParams.get('geo')).toBe('DE')
    expect(urls['bls-timeseries'].pathname).toBe('/publicAPI/v2/timeseries/data/LNS14000000')
    expect(urls['fema-disasters'].searchParams.get('$top')).toBe('5')
    expect(urls['noaa-tides'].searchParams.get('station')).toBe('8518750')
    expect(urls['rdap-domain-lookup'].pathname).toBe('/domain/google.com')
    expect(urls['languagetool-grammar-check'].toString()).toBe('https://api.languagetool.org/v2/check')
    expect(urls['zenodo-search'].searchParams.get('q')).toBe('climate')
    expect(urls['doaj-search'].pathname).toBe('/api/search/articles/climate')
    expect(urls['pubchem-compound'].pathname).toContain('/compound/name/aspirin/property/')
    expect(urls['chembl-molecule'].pathname).toBe('/chembl/api/data/molecule/CHEMBL25.json')
    expect(urls['uniprot-protein'].pathname).toBe('/uniprotkb/P05067.json')
    expect(urls['rcsb-pdb-entry'].pathname).toBe('/rest/v1/core/entry/4HHB')
    expect(urls['ensembl-gene-lookup'].pathname).toBe('/lookup/id/ENSG00000157764')
    expect(urls['obis-marine-occurrences'].searchParams.get('scientificname')).toBe('Delphinus delphis')
    expect(urls['worms-species-lookup'].pathname).toBe('/rest/AphiaRecordsByName/Delphinus%20delphis')
    expect(urls['paleobiodb-taxa'].searchParams.get('name')).toBe('Tyrannosaurus')
    expect(urls['usgs-water-legacy'].searchParams.get('sites')).toBe('01646500')
    expect(urls['crates-io-search'].pathname).toBe('/api/v1/crates/serde')
    expect(urls['rubygems-lookup'].pathname).toBe('/api/v1/gems/rails.json')
    expect(urls['nuget-package-lookup'].pathname).toBe('/v3/registration5-semver1/newtonsoft.json/index.json')
    expect(urls['internet-archive-search'].searchParams.get('q')).toBe('singapore AND mediatype:texts')
    expect(urls['ipwhois-lookup'].pathname).toBe('/8.8.8.8')
    expect(urls['newton-math-solver'].pathname).toBe('/api/v2/simplify/2x%2B2x')
    expect(urls['gutendex-books'].searchParams.get('search')).toBe('shakespeare')
    expect(urls['datamuse-rhymes'].searchParams.get('rel_rhy')).toBe('orange')
    expect(urls['open5e-monster-search'].searchParams.get('search')).toBe('dragon')
    expect(urls['dicebear-avatar'].pathname).toBe('/9.x/identicon/svg')
    expect(urls['catfacts'].pathname).toBe('/fact')
    expect(urls['randomfox-photo'].pathname).toBe('/floof')

    const languageToolApi = getApiById('languagetool-grammar-check')
    expect(languageToolApi?.bodyEncoding).toBe('form')
    expect(languageToolApi?.buildBody?.({ text: 'Hello' })).toEqual({ text: 'Hello', language: 'en-US' })

    const diceBearApi = getApiById('dicebear-avatar')
    expect(diceBearApi?.parseResponse?.('<svg></svg>')).toEqual({ note: 'Raw SVG image response — see the rendered avatar below.', approximateBytes: 11 })
  })

  it('finds API demos by ID', () => {
    expect(getApiById('weather')?.provider).toBe('Open-Meteo')
    expect(getApiById('missing')).toBeUndefined()
  })

  it('validates required and bounded numeric parameters', () => {
    const weather = getApiById('weather')
    expect(weather).toBeDefined()
    if (!weather) return

    expect(validateParameters(weather, { latitude: '', longitude: '200' })).toEqual({
      latitude: 'Latitude is required.',
      longitude: 'Longitude must be at most 180.',
    })
  })
})
