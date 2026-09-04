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
    expect(apiCatalog).toHaveLength(200)
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
    expect(urls['chess-player-stats'].pathname).toBe('/pub/player/magnuscarlsen/stats')
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

    expect(urls['openf1-historical'].hostname).toBe('api.jolpi.ca')
    expect(urls['openf1-historical'].pathname).toBe('/ergast/f1/2025/1/qualifying/')
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
    expect(urls['ecb-fx-rates'].hostname).toBe('api.coinbase.com')
    expect(urls['ecb-fx-rates'].pathname).toBe('/v2/exchange-rates')
    expect(urls['ecb-fx-rates'].searchParams.get('currency')).toBe('EUR')
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
    expect(urls['open5e-monster-search'].hostname).toBe('api.open5e.com')
    expect(urls['open5e-monster-search'].searchParams.get('search')).toBe('dragon')
    expect(urls['open5e-monster-search'].searchParams.get('limit')).toBe('8')
    expect(urls['dicebear-avatar'].pathname).toBe('/9.x/identicon/svg')
    expect(urls['catfacts'].pathname).toBe('/fact')
    expect(urls['randomfox-photo'].pathname).toBe('/floof')

    const languageToolApi = getApiById('languagetool-grammar-check')
    expect(languageToolApi?.bodyEncoding).toBe('form')
    expect(languageToolApi?.buildBody?.({ text: 'Hello' })).toEqual({ text: 'Hello', language: 'en-US' })

    const diceBearApi = getApiById('dicebear-avatar')
    expect(diceBearApi?.parseResponse?.('<svg></svg>')).toEqual({ note: 'Raw SVG image response — see the rendered avatar below.', approximateBytes: 11 })
  })

  it('builds the thirteen newly prioritized keyless API requests', () => {
    const ids = [
      'packagist-search', 'anilist-graphql', 'openverse-search', 'apple-itunes-search', 'jolpica-f1', 'hn-search-algolia', 'bank-of-canada-valet', 'swiss-transit-connections', 'nasa-power-climate', 'open-meteo-elevation', 'zippopotam-postcode', 'hebcal-calendar', 'aladhan-prayer-times',
    ]
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['packagist-search'].hostname).toBe('packagist.org')
    expect(urls['packagist-search'].searchParams.get('q')).toBe('react')
    expect(urls['packagist-search'].searchParams.get('per_page')).toBe('8')
    expect(urls['anilist-graphql'].pathname).toBe('/')
    expect(urls['openverse-search'].pathname).toBe('/v1/images/')
    expect(urls['openverse-search'].searchParams.get('q')).toBe('space')
    expect(urls['openverse-search'].searchParams.get('page_size')).toBe('8')
    expect(urls['apple-itunes-search'].hostname).toBe('itunes.apple.com')
    expect(urls['apple-itunes-search'].pathname).toBe('/search')
    expect(urls['apple-itunes-search'].searchParams.get('term')).toBe('Beatles')
    expect(urls['apple-itunes-search'].searchParams.get('media')).toBe('music')
    expect(urls['apple-itunes-search'].searchParams.get('entity')).toBe('song')
    expect(urls['apple-itunes-search'].searchParams.get('country')).toBe('sg')
    expect(urls['apple-itunes-search'].searchParams.get('limit')).toBe('8')
    expect(urls['jolpica-f1'].pathname).toBe('/ergast/f1/2025/drivers.json')
    expect(urls['jolpica-f1'].searchParams.get('limit')).toBe('8')
    expect(urls['hn-search-algolia'].pathname).toBe('/api/v1/search')
    expect(urls['hn-search-algolia'].searchParams.get('query')).toBe('OpenAI')
    expect(urls['hn-search-algolia'].searchParams.get('hitsPerPage')).toBe('6')
    expect(urls['bank-of-canada-valet'].pathname).toBe('/valet/observations/FXUSDCAD/json')
    expect(urls['swiss-transit-connections'].pathname).toBe('/v1/connections')
    expect(urls['swiss-transit-connections'].searchParams.get('from')).toBe('Zurich')
    expect(urls['nasa-power-climate'].pathname).toBe('/api/temporal/daily/point')
    expect(urls['nasa-power-climate'].searchParams.get('community')).toBe('AG')
    expect(urls['nasa-power-climate'].searchParams.get('format')).toBe('JSON')
    expect(urls['nasa-power-climate'].searchParams.get('parameters')).toBe('T2M,PRECTOTCORR,WS10M,RH2M,ALLSKY_SFC_SW_DWN')
    expect(urls['open-meteo-elevation'].pathname).toBe('/v1/elevation')
    expect(urls['open-meteo-elevation'].searchParams.get('latitude')).toBe('1.3521')
    expect(urls['open-meteo-elevation'].searchParams.get('longitude')).toBe('103.8198')
    expect(urls['open-meteo-elevation'].searchParams.get('format')).toBe('json')
    expect(urls['zippopotam-postcode'].hostname).toBe('api.zippopotam.us')
    expect(urls['zippopotam-postcode'].pathname).toBe('/us/10001')

    expect(urls['hebcal-calendar'].hostname).toBe('www.hebcal.com')
    expect(urls['hebcal-calendar'].pathname).toBe('/hebcal/')
    expect(urls['aladhan-prayer-times'].hostname).toBe('api.aladhan.com')
    expect(urls['aladhan-prayer-times'].pathname).toContain('/v1/timings/')
    expect(urls['aladhan-prayer-times'].searchParams.get('method')).toBe('11')
    expect(urls['aladhan-prayer-times'].searchParams.get('latitude')).toBe('1.3521')
    expect(urls['aladhan-prayer-times'].searchParams.get('longitude')).toBe('103.8198')

    const anilist = getApiById('anilist-graphql')
    expect(anilist?.method).toBe('POST')
    expect(anilist?.buildBody?.({ query: 'Steins Gate', mediaType: 'MANGA', count: '4', page: '2' })).toEqual(expect.objectContaining({
      variables: expect.objectContaining({ search: 'Steins Gate', perPage: 4, page: 2, type: 'MANGA' }),
    }))
  })

  it('builds the latest 13 priority keyless API requests from the 2026-08-02 audit', () => {
    const ids = [
      'malaysia-core-cpi', 'malaysia-household-income', 'malaysia-population',
      'openfda-food-recalls', 'iconify-search', 'homebrew-formula-json',
      'npm-download-counts', 'geoboundaries-admin-boundaries', 'osrm-route',
      'opendota-pro-matches', 'openligadb-matches', 'uk-parliament-members', 'mlb-stats-api',
    ]
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['malaysia-core-cpi'].hostname).toBe('api.data.gov.my')
    expect(urls['malaysia-core-cpi'].searchParams.get('id')).toBe('cpi_core')
    expect(urls['malaysia-household-income'].hostname).toBe('api.data.gov.my')
    expect(urls['malaysia-household-income'].searchParams.get('id')).toBe('hh_income')
    expect(urls['malaysia-population'].hostname).toBe('api.data.gov.my')
    expect(urls['malaysia-population'].searchParams.get('id')).toBe('population_malaysia')
    expect(urls['openfda-food-recalls'].hostname).toBe('api.fda.gov')
    expect(urls['openfda-food-recalls'].pathname).toBe('/food/enforcement.json')
    expect(urls['openfda-food-recalls'].searchParams.get('search')).toBe('peanut')
    expect(urls['iconify-search'].hostname).toBe('api.iconify.design')
    expect(urls['iconify-search'].pathname).toBe('/search')
    expect(urls['iconify-search'].searchParams.get('query')).toBe('home')
    expect(urls['iconify-search'].searchParams.get('limit')).toBe('12')
    expect(urls['homebrew-formula-json'].hostname).toBe('formulae.brew.sh')
    expect(urls['homebrew-formula-json'].pathname).toBe('/api/formula/node.json')
    expect(urls['npm-download-counts'].hostname).toBe('api.npmjs.org')
    expect(urls['npm-download-counts'].pathname).toBe('/downloads/point/last-week/react')
    expect(urls['geoboundaries-admin-boundaries'].hostname).toBe('www.geoboundaries.org')
    expect(urls['geoboundaries-admin-boundaries'].pathname).toBe('/api/current/gbOpen/SGP/ADM0/')
    expect(urls['osrm-route'].hostname).toBe('router.project-osrm.org')
    expect(urls['osrm-route'].pathname).toBe('/route/v1/driving/103.8198,1.3521;103.851959,1.29027')
    expect(urls['osrm-route'].searchParams.get('alternatives')).toBe('1')
    expect(urls['opendota-pro-matches'].hostname).toBe('api.opendota.com')
    expect(urls['opendota-pro-matches'].pathname).toBe('/api/proMatches')
    expect(urls['opendota-pro-matches'].searchParams.get('limit')).toBe('8')
    expect(urls['openligadb-matches'].hostname).toBe('api.openligadb.de')
    expect(urls['openligadb-matches'].pathname).toBe('/getmatchdata/bl1/2025/1')
    expect(urls['uk-parliament-members'].hostname).toBe('members-api.parliament.uk')
    expect(urls['uk-parliament-members'].pathname).toBe('/api/Members/Search')
    expect(urls['uk-parliament-members'].searchParams.get('name')).toBe('Rishi')
    expect(urls['mlb-stats-api'].hostname).toBe('statsapi.mlb.com')
    expect(urls['mlb-stats-api'].pathname).toBe('/api/v1/schedule')
    expect(urls['mlb-stats-api'].searchParams.get('sportId')).toBe('1')
  })

  it('builds the latest 15 browser-ready third-round API requests from the 2026-08-02 audit', () => {
    const ids = [
      'gleif-lei', 'fdic-bankfind', 'uk-food-hygiene', 'uk-flood-monitoring', 'unhcr-refugees',
      'hdx-humanitarian-datasets', 'open-meteo-climate', 'models-dev', 'vatcomply', 'mempool-space-btc',
      'metacpan', 'hexpm', 'pub-dev', 'go-module-proxy', 'flathub-appstream',
    ]
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['gleif-lei'].hostname).toBe('api.gleif.org')
    expect(urls['gleif-lei'].searchParams.get('filter[entity.legalName]')).toBe('Royal Bank of Canada')
    expect(urls['gleif-lei'].searchParams.get('page[size]')).toBe('8')
    expect(urls['fdic-bankfind'].hostname).toBe('banks.data.fdic.gov')
    expect(urls['fdic-bankfind'].searchParams.get('q')).toBe('Wells Fargo')
    expect(urls['fdic-bankfind'].searchParams.get('limit')).toBe('6')

    const foodHygiene = getApiById('uk-food-hygiene')
    expect(foodHygiene?.headers).toEqual({ 'x-api-version': '2' })
    expect(urls['uk-food-hygiene'].hostname).toBe('api.ratings.food.gov.uk')
    expect(urls['uk-food-hygiene'].pathname).toBe('/Establishments')
    expect(urls['uk-food-hygiene'].searchParams.get('name')).toBe('Cafe')

    expect(urls['uk-flood-monitoring'].hostname).toBe('environment.data.gov.uk')
    expect(urls['uk-flood-monitoring'].pathname).toBe('/flood-monitoring/id/stations')
    expect(urls['uk-flood-monitoring'].searchParams.get('riverName')).toBe('Thames')
    expect(urls['unhcr-refugees'].hostname).toBe('api.unhcr.org')
    expect(urls['unhcr-refugees'].pathname).toBe('/population/v1/population/')
    expect(urls['unhcr-refugees'].searchParams.get('coo')).toBe('SYR')
    expect(urls['unhcr-refugees'].searchParams.get('yearFrom')).toBe('2024')
    expect(urls['hdx-humanitarian-datasets'].hostname).toBe('goadmin.ifrc.org')
    expect(urls['hdx-humanitarian-datasets'].pathname).toBe('/api/v2/event/')
    expect(urls['hdx-humanitarian-datasets'].searchParams.get('limit')).toBe('6')
    expect(urls['hdx-humanitarian-datasets'].searchParams.get('ordering')).toBe('-created_at')
    expect(urls['open-meteo-climate'].hostname).toBe('climate-api.open-meteo.com')
    expect(urls['open-meteo-climate'].pathname).toBe('/v1/climate')
    expect(urls['open-meteo-climate'].searchParams.get('daily')).toBe('temperature_2m_mean,precipitation_sum')
    expect(urls['models-dev'].hostname).toBe('huggingface.co')
    expect(urls['models-dev'].pathname).toBe('/api/models')
    expect(urls['models-dev'].searchParams.get('search')).toBe('gpt')
    expect(urls['models-dev'].searchParams.get('limit')).toBe('8')
    expect(urls['vatcomply'].hostname).toBe('api.vatcomply.com')
    expect(urls['vatcomply'].pathname).toBe('/rates')
    expect(urls['vatcomply'].searchParams.get('base')).toBe('EUR')
    expect(urls['mempool-space-btc'].hostname).toBe('mempool.space')
    expect(urls['mempool-space-btc'].pathname).toBe('/api/v1/fees/recommended')

    expect(urls['metacpan'].hostname).toBe('fastapi.metacpan.org')
    expect(urls['metacpan'].pathname).toBe('/v1/module/_search')
    expect(urls['metacpan'].searchParams.get('q')).toBe('Mojolicious')
    expect(urls['metacpan'].searchParams.get('size')).toBe('6')
    expect(urls['hexpm'].hostname).toBe('hex.pm')
    expect(urls['hexpm'].pathname).toBe('/api/packages/ecto')
    expect(urls['pub-dev'].hostname).toBe('pub.dev')
    expect(urls['pub-dev'].pathname).toBe('/api/packages/riverpod')
    expect(urls['pub-dev'].search).toBe('')
    expect(urls['go-module-proxy'].hostname).toBe('proxy.golang.org')
    expect(urls['go-module-proxy'].pathname).toBe('/github.com/gin-gonic/gin/@v/list')
    expect(urls['flathub-appstream'].hostname).toBe('flathub.org')
    expect(urls['flathub-appstream'].pathname).toBe('/api/v2/appstream/org.gnome.Calculator')
    expect(urls['flathub-appstream'].search).toBe('')
  })

  it('builds the legacy fourth-round URLs still used by UI mappings', () => {
    const ids = ['usgs', 'usaspending', 'fiscal-data-treasury', 'wikidata-sparql', 'carbon-intensity-gb', 'met-museum-object-detail', 'met-museum-search', 'holidays']
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['usgs'].pathname).toBe('/earthquakes/feed/v1.0/summary/2.5_day.geojson')
    expect(urls['usaspending'].pathname).toBe('/api/v2/search/spending_by_award/')
    expect(urls['fiscal-data-treasury'].hostname).toBe('api.usaspending.gov')
    expect(urls['fiscal-data-treasury'].pathname).toBe('/api/v2/agency/020/')
    expect(urls['fiscal-data-treasury'].search).toBe('')
    expect(urls['wikidata-sparql'].hostname).toBe('query.wikidata.org')
    expect(urls['wikidata-sparql'].pathname).toBe('/sparql')
    expect(urls['wikidata-sparql'].searchParams.get('format')).toBe('json')
    expect(urls['carbon-intensity-gb'].hostname).toBe('api.carbonintensity.org.uk')
    expect(urls['carbon-intensity-gb'].pathname).toBe('/intensity')
    expect(urls['met-museum-object-detail'].pathname).toBe('/public/collection/v1/objects/436535')
    expect(urls['met-museum-search'].pathname).toBe('/public/collection/v1/search')
    expect(urls['met-museum-search'].searchParams.get('q')).toBe('singapore')
    expect(urls['met-museum-search'].searchParams.get('hasImages')).toBe('true')
    expect(urls['holidays'].hostname).toBe('date.nager.at')
    expect(urls['holidays'].pathname).toBe('/api/v3/PublicHolidays/2026/SG')
  })

  it('builds the latest 3 browser-ready fourth-round API requests from the 2026-08-02 audit', () => {
    const ids = ['openssf-scorecard', 'opencitations-index', 'vam-collections']
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['openssf-scorecard'].hostname).toBe('api.securityscorecards.dev')
    expect(urls['openssf-scorecard'].pathname).toBe('/projects/github.com/ossf/scorecard')
    expect(urls['opencitations-index'].hostname).toBe('api.opencitations.net')
    expect(urls['opencitations-index'].pathname).toBe('/index/v2/citation-count/doi:10.1109%2F5.771073')
    expect(urls['opencitations-index'].search).toBe('')
    expect(urls['vam-collections'].hostname).toBe('api.vam.ac.uk')
    expect(urls['vam-collections'].pathname).toBe('/v2/objects/search')
    expect(urls['vam-collections'].searchParams.get('q')).toBe('eastern')
    expect(urls['vam-collections'].searchParams.get('page_size')).toBe('6')
  })

  it('builds the twelve Public-API 200 milestone requests', () => {
    const ids = [
      'github-global-advisories', 'dblp-search', 'citybikes-network', 'wikimedia-commons-search',
      'nominatim-search', 'jsdelivr-package', 'canada-open-data-search', 'gbif-occurrence-search',
      'open-meteo-ensemble', 'world-bank-indicator-explorer', 'exchange-rate-current', 'circl-vulnerability',
    ]
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['github-global-advisories'].hostname).toBe('api.github.com')
    expect(urls['github-global-advisories'].pathname).toBe('/advisories')
    expect(urls['github-global-advisories'].searchParams.get('ecosystem')).toBe('npm')
    expect(urls['github-global-advisories'].searchParams.get('severity')).toBe('high')
    expect(urls['dblp-search'].hostname).toBe('dblp.org')
    expect(urls['dblp-search'].pathname).toBe('/search/publ/api')
    expect(urls['dblp-search'].searchParams.get('format')).toBe('json')
    expect(urls['citybikes-network'].pathname).toBe('/v2/networks/youbike-taipei')
    expect(urls['wikimedia-commons-search'].hostname).toBe('commons.wikimedia.org')
    expect(urls['wikimedia-commons-search'].searchParams.get('origin')).toBe('*')
    expect(urls['wikimedia-commons-search'].searchParams.get('gsrnamespace')).toBe('6')
    expect(urls['nominatim-search'].hostname).toBe('nominatim.openstreetmap.org')
    expect(urls['nominatim-search'].searchParams.get('format')).toBe('jsonv2')
    expect(urls['jsdelivr-package'].hostname).toBe('data.jsdelivr.com')
    expect(urls['jsdelivr-package'].pathname).toBe('/v1/package/npm/react')
    expect(urls['canada-open-data-search'].hostname).toBe('open.canada.ca')
    expect(urls['canada-open-data-search'].pathname).toBe('/data/api/3/action/package_search')
    expect(urls['gbif-occurrence-search'].hostname).toBe('api.gbif.org')
    expect(urls['gbif-occurrence-search'].pathname).toBe('/v1/occurrence/search')
    expect(urls['open-meteo-ensemble'].hostname).toBe('ensemble-api.open-meteo.com')
    expect(urls['open-meteo-ensemble'].searchParams.get('hourly')).toBe('temperature_2m')
    expect(urls['world-bank-indicator-explorer'].hostname).toBe('api.worldbank.org')
    expect(urls['world-bank-indicator-explorer'].pathname).toBe('/v2/country/SGP/indicator/SP.DYN.LE00.IN')
    expect(urls['world-bank-indicator-explorer'].searchParams.get('date')).toBe('2015:2025')
    expect(urls['exchange-rate-current'].hostname).toBe('open.er-api.com')
    expect(urls['exchange-rate-current'].pathname).toBe('/v6/latest/SGD')
    expect(urls['circl-vulnerability'].hostname).toBe('vulnerability.circl.lu')
    expect(urls['circl-vulnerability'].pathname).toBe('/api/cve/CVE-2021-44228')
  })

  it('builds the NHTSA vehicle recall request', () => {
    const api = getApiById('nhtsa-vehicle-recalls')
    expect(api, 'nhtsa-vehicle-recalls').toBeDefined()
    if (!api) return

    const url = new URL(api.buildUrl(getDefaultParameters(api)))
    expect(url.hostname).toBe('api.nhtsa.gov')
    expect(url.pathname).toBe('/recalls/recallsByVehicle')
    expect(url.searchParams.get('make')).toBe('honda')
    expect(url.searchParams.get('model')).toBe('accord')
    expect(url.searchParams.get('modelYear')).toBe('2020')
    expect(url.searchParams.get('format')).toBe('json')
  })


  it('builds repaired browser-direct health contracts', () => {
    const dictionary = getApiById('free-dictionary')
    const bank = getApiById('bank-of-canada-valet')
    const aniList = getApiById('anilist-graphql')
    const mlb = getApiById('mlb-stats-api')
    expect(dictionary).toBeDefined()
    expect(bank).toBeDefined()
    expect(aniList).toBeDefined()
    expect(mlb).toBeDefined()
    if (!dictionary || !bank || !aniList || !mlb) return

    expect(new URL(dictionary.buildUrl(getDefaultParameters(dictionary))).hostname).toBe('freedictionaryapi.com')
    const bankUrl = new URL(bank.buildUrl(getDefaultParameters(bank)))
    expect(bankUrl.searchParams.get('start_date')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(bankUrl.searchParams.get('end_date')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const aniListBody = JSON.stringify(aniList.buildBody?.(getDefaultParameters(aniList)))
    expect(aniListBody).not.toContain('hasPreviousPage')
    expect(getDefaultParameters(mlb)).not.toHaveProperty('teamId')
    expect(new URL(mlb.buildUrl(getDefaultParameters(mlb))).searchParams.has('teamId')).toBe(false)
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
