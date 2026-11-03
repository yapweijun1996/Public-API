import { describe, expect, it } from 'vitest'
import { apiCatalog, getDefaultParameters, getApiById } from './apiCatalog'
import { buildRequestFromSpec, type DeclarativeRequestSpec } from './declarativeRequest'

describe('declarative request interpreter', () => {
  it('expands level-three path and query expressions with closed parameter transforms', () => {
    const spec: DeclarativeRequestSpec = {
      declarative: true,
      method: 'GET',
      urlTemplate: 'https://example.test/{country}{?from,to}',
      hosts: ['example.test'],
      transforms: { country: 'uppercase', from: 'date:YYYYMMDD', to: 'omitIfEmpty' },
      responseTransform: 'json',
    }
    expect(buildRequestFromSpec(spec, { country: 'sg', from: '2026-01-02', to: '' })).toEqual({
      method: 'GET', url: 'https://example.test/SG?from=20260102', headers: {},
    })
  })

  it('renders ampersand query continuation, maps, joins, headers, and JSON body slots', () => {
    const spec: DeclarativeRequestSpec = {
      declarative: true,
      method: 'POST',
      urlTemplate: 'https://example.test/search{?kind}{&tags}',
      hosts: ['example.test'],
      headers: { Accept: 'application/json' },
      transforms: { kind: { map: { short: 'S' } }, tags: { join: '|' } },
      body: { query: '{query}', count: '{count}' },
      responseTransform: 'json',
    }
    expect(buildRequestFromSpec(spec, { kind: 'short', tags: 'a,b', query: 'fox', count: '0' })).toEqual({
      method: 'POST', url: 'https://example.test/search?kind=S&tags=a%7Cb',
      headers: { Accept: 'application/json' }, body: { query: 'fox', count: '0' },
    })
  })
  it('trims query inputs before URI-component encoding', () => {
    const spec: DeclarativeRequestSpec = {
      declarative: true,
      method: 'GET',
      urlTemplate: 'https://example.test/search{?query}',
      hosts: ['example.test'],
      transforms: { query: 'trim' },
      responseTransform: 'json',
    }
    expect(buildRequestFromSpec(spec, { query: '  climate change  ' }).url).toBe('https://example.test/search?query=climate%20change')
  })

  it('preserves captured Nager request outputs for default, enum, and representative inputs', () => {
    const api = getApiById('holidays')
    if (!api || !api.request || api.request.declarative !== true) throw new Error('Holiday API must use a declarative request.')
    const defaultParams = getDefaultParameters(api)
    const cases = [
      { params: defaultParams, captured: `https://nagerholidays.com/api/v4/Holidays/SG/${defaultParams.year}` },
      { params: { year: '2030', country: 'us' }, captured: 'https://nagerholidays.com/api/v4/Holidays/US/2030' },
      { params: { year: '2026', country: 'GB' }, captured: 'https://nagerholidays.com/api/v4/Holidays/GB/2026' },
    ]
    for (const { params, captured } of cases) {
      expect(api.buildUrl(params)).toBe(captured)
      const request = buildRequestFromSpec(api.request, params)
      expect(request).toMatchObject({ method: 'GET', url: captured, headers: {} })
      const expanded = new URL(request.url)
      expect(expanded.protocol).toBe('https:')
      expect(api.request.hosts).toContain(expanded.host)
    }
  })

  it('preserves captured Research, Government, and Finance request outputs', () => {
    const cases = [
      ['ecb-fx-rates', { currency: 'SGD' }, 'https://api.coinbase.com/v2/exchange-rates?currency=SGD'],
      ['un-sdg-goals', {}, 'https://unstats.un.org/SDGAPI/v1/sdg/Goal/List'],
      ['datacite-search', { query: 'machine learning', count: '8' }, 'https://api.datacite.org/dois?query=machine+learning&page%5Bsize%5D=8'],
      ['ror-search', { query: 'University of Oxford' }, 'https://api.ror.org/v2/organizations?query=University+of+Oxford'],
      ['doaj-search', { query: 'climate research', pageSize: '7' }, 'https://doaj.org/api/search/articles/climate%20research?pageSize=7'],
      ['exchange-rate-current', { base: 'myr' }, 'https://open.er-api.com/v6/latest/MYR'],
      ['openalex-works-search', { query: 'machine learning', limit: '12' }, 'https://api.openalex.org/works?search=machine+learning&per_page=12&select=id,title,publication_year,cited_by_count,doi,authorships,open_access'],
      ['coinpaprika-ticker', { coin: 'eth-ethereum' }, 'https://api.coinpaprika.com/v1/tickers/eth-ethereum'],
      ['malaysia-fuel-price', { limit: '60' }, 'https://api.data.gov.my/data-catalogue/?id=fuelprice&limit=60&sort=-date'],
      ['federal-register-documents', { query: 'climate policy', limit: '10' }, 'https://www.federalregister.gov/api/v1/documents.json?per_page=10&order=newest&conditions%5Bterm%5D=climate+policy'],
      ['uk-police-street-crime', { latitude: '52.4862', longitude: '-1.8904', category: 'all-crime' }, 'https://data.police.uk/api/crimes-street/all-crime?lat=52.4862&lng=-1.8904'],
      ['malaysia-core-cpi', { limit: '24' }, 'https://api.data.gov.my/data-catalogue/?id=cpi_core&filter=overall%40division&limit=24&sort=-date'],
      ['malaysia-household-income', { limit: '12' }, 'https://api.data.gov.my/data-catalogue/?id=hh_income&limit=12&sort=-date'],
      ['malaysia-population', { limit: '20' }, 'https://api.data.gov.my/data-catalogue/?id=population_malaysia&filter=both%40sex%2Coverall%40age%2Coverall%40ethnicity&limit=20&sort=-date'],
      ['pubmed-search', { term: 'machine learning', retmax: '8' }, 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=machine+learning&retmode=json&retmax=8'],
      ['eurostat-population', { country: 'FR', year: '2024' }, 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_pjan?format=JSON&geo=FR&sex=T&age=TOTAL&time=2024'],
      ['canada-open-data-search', { query: 'machine learning', limit: '9' }, 'https://open.canada.ca/data/api/3/action/package_search?q=machine+learning&rows=9'],
      ['singstat-cpi-monthly', {}, 'https://tablebuilder.singstat.gov.sg/api/table/tabledata/M213752?seriesNoORrowNo=1&limit=12&sortBy=key+desc'],
      ['ecb-fx-rates', { currency: 'EUR' }, 'https://api.coinbase.com/v2/exchange-rates?currency=EUR'],
      ['datacite-search', { query: 'climate change', count: '5' }, 'https://api.datacite.org/dois?query=climate+change&page%5Bsize%5D=5'],
      ['ror-search', { query: 'stanford' }, 'https://api.ror.org/v2/organizations?query=stanford'],
      ['doaj-search', { query: 'climate', pageSize: '5' }, 'https://doaj.org/api/search/articles/climate?pageSize=5'],
      ['exchange-rate-current', { base: 'SGD' }, 'https://open.er-api.com/v6/latest/SGD'],
      ['openalex-works-search', { query: 'artificial intelligence', limit: '8' }, 'https://api.openalex.org/works?search=artificial+intelligence&per_page=8&select=id,title,publication_year,cited_by_count,doi,authorships,open_access'],
      ['coinpaprika-ticker', { coin: 'btc-bitcoin' }, 'https://api.coinpaprika.com/v1/tickers/btc-bitcoin'],
      ['malaysia-fuel-price', { limit: '52' }, 'https://api.data.gov.my/data-catalogue/?id=fuelprice&limit=52&sort=-date'],
      ['federal-register-documents', { query: 'artificial intelligence', limit: '8' }, 'https://www.federalregister.gov/api/v1/documents.json?per_page=8&order=newest&conditions%5Bterm%5D=artificial+intelligence'],
      ['uk-police-street-crime', { latitude: '51.5074', longitude: '-0.1278', category: 'burglary' }, 'https://data.police.uk/api/crimes-street/burglary?lat=51.5074&lng=-0.1278'],
      ['malaysia-core-cpi', { limit: '12' }, 'https://api.data.gov.my/data-catalogue/?id=cpi_core&filter=overall%40division&limit=12&sort=-date'],
      ['malaysia-household-income', { limit: '10' }, 'https://api.data.gov.my/data-catalogue/?id=hh_income&limit=10&sort=-date'],
      ['malaysia-population', { limit: '10' }, 'https://api.data.gov.my/data-catalogue/?id=population_malaysia&filter=both%40sex%2Coverall%40age%2Coverall%40ethnicity&limit=10&sort=-date'],
      ['pubmed-search', { term: 'covid', retmax: '5' }, 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=covid&retmode=json&retmax=5'],
      ['eurostat-population', { country: 'DE', year: '2025' }, 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_pjan?format=JSON&geo=DE&sex=T&age=TOTAL&time=2025'],
      ['canada-open-data-search', { query: 'artificial intelligence', limit: '6' }, 'https://open.canada.ca/data/api/3/action/package_search?q=artificial+intelligence&rows=6'],
      ['gleif-lei', { query: 'Royal Bank of Canada', count: '8' }, 'https://api.gleif.org/api/v1/lei-records?filter%5Bentity.legalName%5D=Royal+Bank+of+Canada&page%5Bsize%5D=8'],
      ['gleif-lei', { query: 'Bank of America', count: '10' }, 'https://api.gleif.org/api/v1/lei-records?filter%5Bentity.legalName%5D=Bank+of+America&page%5Bsize%5D=10'],
      ['mempool-space-btc', {}, 'https://mempool.space/api/v1/fees/recommended'],
      ['hdx-humanitarian-datasets', {}, 'https://goadmin.ifrc.org/api/v2/event/?limit=6&ordering=-disaster_start_date'],
      ['bls-timeseries', { seriesId: 'LNS14000000' }, 'https://api.bls.gov/publicAPI/v1/timeseries/data/LNS14000000'],
      ['bls-timeseries', { seriesId: 'CUUR0000SA0' }, 'https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0'],
      ['world-bank-indicator-explorer', { country: 'SGP', indicator: 'SP.DYN.LE00.IN', startYear: '2015', endYear: '2025' }, 'https://api.worldbank.org/v2/country/SGP/indicator/SP.DYN.LE00.IN?format=json&date=2015%3A2025&per_page=141'],
      ['world-bank-indicator-explorer', { country: 'us', indicator: 'NY.GDP.MKTP.CD', startYear: '2010', endYear: '2020' }, 'https://api.worldbank.org/v2/country/US/indicator/NY.GDP.MKTP.CD?format=json&date=2010%3A2020&per_page=141'],
      ['pubchem-compound', { name: 'aspirin' }, 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/aspirin/property/MolecularFormula,MolecularWeight,IUPACName/JSON'],
      ['pubchem-compound', { name: 'caffeine' }, 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/caffeine/property/MolecularFormula,MolecularWeight,IUPACName/JSON'],
      ['uniprot-protein', { accession: 'P05067' }, 'https://rest.uniprot.org/uniprotkb/P05067.json'],
      ['uniprot-protein', { accession: 'A0A023GPI8' }, 'https://rest.uniprot.org/uniprotkb/A0A023GPI8.json'],
      ['ensembl-gene-lookup', { geneId: 'ENSG00000157764' }, 'https://rest.ensembl.org/lookup/id/ENSG00000157764?content-type=application%2Fjson'],
      ['ensembl-gene-lookup', { geneId: 'ENSG00000139618' }, 'https://rest.ensembl.org/lookup/id/ENSG00000139618?content-type=application%2Fjson'],
      ['nobel-prizes', { category: 'phy', limit: '6' }, 'https://api.nobelprize.org/2.1/nobelPrizes?nobelPrizeCategory=phy&limit=6&sort=desc'],
      ['nobel-prizes', { category: 'eco', limit: '4' }, 'https://api.nobelprize.org/2.1/nobelPrizes?nobelPrizeCategory=eco&limit=4&sort=desc'],
      ['crossref-works', { query: 'agentic AI', rows: '8' }, 'https://api.crossref.org/v1/works?query=agentic+AI&rows=8&select=DOI%2Ctitle%2Cauthor%2Cpublished%2Cpublisher%2Cis-referenced-by-count%2Ctype%2CURL'],
      ['crossref-works', { query: 'climate adaptation', rows: '12' }, 'https://api.crossref.org/v1/works?query=climate+adaptation&rows=12&select=DOI%2Ctitle%2Cauthor%2Cpublished%2Cpublisher%2Cis-referenced-by-count%2Ctype%2CURL'],
      ['opencitations-index', { doi: '10.1109/5.771073' }, 'https://api.opencitations.net/index/v2/citation-count/doi:10.1109%2F5.771073'],
      ['opencitations-index', { doi: '10.1000/xyz123' }, 'https://api.opencitations.net/index/v2/citation-count/doi:10.1000%2Fxyz123'],
      ['coingecko-keyless-market', { coin: 'bitcoin', currency: 'usd' }, 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true'],
      ['coingecko-keyless-market', { coin: 'dogecoin', currency: 'eur' }, 'https://api.coingecko.com/api/v3/simple/price?ids=dogecoin&vs_currencies=eur&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true'],
      ['countries', { code: 'SGP' }, 'https://api.worldbank.org/v2/country/SGP?format=json'],
      ['weather', {}, 'https://api.open-meteo.com/v1/forecast?latitude=1.3521&longitude=103.8198&current=temperature_2m%2Crelative_humidity_2m%2Cwind_speed_10m%2Cweather_code&timezone=auto'],
      ['weather', { latitude: '37.7749', longitude: '-122.4194' }, 'https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current=temperature_2m%2Crelative_humidity_2m%2Cwind_speed_10m%2Cweather_code&timezone=auto'],
      ['geocoding-search', {}, 'https://geocoding-api.open-meteo.com/v1/search?name=Singapore&count=6&language=en&format=json'],
      ['geocoding-search', { name: 'New York', count: '4' }, 'https://geocoding-api.open-meteo.com/v1/search?name=New+York&count=4&language=en&format=json'],
      ['open-meteo-air-quality', {}, 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=1.3521&longitude=103.8198&current=us_aqi%2Cpm2_5%2Cpm10%2Cnitrogen_dioxide%2Cozone&timezone=auto'],
      ['open-meteo-air-quality', { latitude: '40.7128', longitude: '-74.0060' }, 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=40.7128&longitude=-74.0060&current=us_aqi%2Cpm2_5%2Cpm10%2Cnitrogen_dioxide%2Cozone&timezone=auto'],
      ['sunrise-sunset', {}, `https://api.sunrise-sunset.org/v2?lat=1.3521&lng=103.8198&date=${getDefaultParameters(getApiById('sunrise-sunset')!).date}`],
      ['sunrise-sunset', { latitude: '51.5074', longitude: '-0.1278', date: '2026-06-01' }, 'https://api.sunrise-sunset.org/v2?lat=51.5074&lng=-0.1278&date=2026-06-01'],
      ['mbta-transit-routes', {}, 'https://api-v3.mbta.com/routes?filter%5Btype%5D=0%2C1'],
      ['mbta-transit-routes', { routeType: '3' }, 'https://api-v3.mbta.com/routes?filter%5Btype%5D=3'],
      ['open-trivia', {}, 'https://opentdb.com/api.php?amount=6&category=9&difficulty=medium&type=multiple'],
      ['open-trivia', { amount: '10', category: '17', difficulty: 'hard' }, 'https://opentdb.com/api.php?amount=10&category=17&difficulty=hard&type=multiple'],
      ['devto', {}, 'https://dev.to/api/articles?tag=javascript&per_page=8&page=1'],
      ['devto', { tag: 'web development', limit: '12' }, 'https://dev.to/api/articles?tag=web+development&per_page=12&page=1'],
      ['hacker-news', {}, 'https://hacker-news.firebaseio.com/v0/item/8863.json?print=pretty'],
      ['hacker-news', { itemId: '2921983' }, 'https://hacker-news.firebaseio.com/v0/item/2921983.json?print=pretty'],
      ['npm-search', {}, 'https://registry.npmjs.org/-/v1/search?text=react&size=8'],
      ['npm-search', { query: 'web components', limit: '15' }, 'https://registry.npmjs.org/-/v1/search?text=web+components&size=15'],
      ['nvd-cpe-search', {}, 'https://services.nvd.nist.gov/rest/json/cpes/2.0?keywordSearch=openssl&resultsPerPage=8'],
      ['nvd-cpe-search', { query: 'postgresql', limit: '12' }, 'https://services.nvd.nist.gov/rest/json/cpes/2.0?keywordSearch=postgresql&resultsPerPage=12'],
      ['nvd-cve-detail', {}, 'https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2024-3094'],
      ['nvd-cve-detail', { cve: 'CVE-2023-44487' }, 'https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2023-44487'],
      ['nvd-cves', {}, 'https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=postgresql&resultsPerPage=8'],
      ['nvd-cves', { query: 'remote code', limit: '6' }, 'https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=remote+code&resultsPerPage=6'],
      ['stack-exchange', {}, 'https://api.stackexchange.com/2.3/questions?order=desc&sort=activity&tagged=javascript&site=stackoverflow&pagesize=8'],
      ['stack-exchange', { tags: 'java;python', limit: '12' }, 'https://api.stackexchange.com/2.3/questions?order=desc&sort=activity&tagged=java%3Bpython&site=stackoverflow&pagesize=12'],
      ['open-library-search', {}, 'https://openlibrary.org/search.json?q=artificial+intelligence&limit=8&fields=key%2Ctitle%2Cauthor_name%2Cfirst_publish_year%2Ccover_i'],
      ['open-library-search', { query: 'climate change', limit: '12' }, 'https://openlibrary.org/search.json?q=climate+change&limit=12&fields=key%2Ctitle%2Cauthor_name%2Cfirst_publish_year%2Ccover_i'],
      ['free-dictionary', {}, 'https://freedictionaryapi.com/api/v1/entries/en/hello'],
      ['free-dictionary', { word: 'serendipity' }, 'https://freedictionaryapi.com/api/v1/entries/en/serendipity'],
      ['tvmaze-search', {}, 'https://api.tvmaze.com/search/shows?q=severance'],
      ['tvmaze-search', { show: 'The Bear' }, 'https://api.tvmaze.com/search/shows?q=The%20Bear'],
      ['clinical-trials-search', {}, 'https://clinicaltrials.gov/api/v2/studies?query.cond=Diabetes&pageSize=8&format=json'],
      ['clinical-trials-search', { condition: 'heart failure' }, 'https://clinicaltrials.gov/api/v2/studies?query.cond=heart+failure&pageSize=8&format=json'],
      ['countries', { code: 'us' }, 'https://api.worldbank.org/v2/country/US?format=json'],
    ] as const
    for (const [id, params, captured] of cases) {
      const api = getApiById(id)
      if (!api || api.request?.declarative !== true) throw new Error(`${id} must use a declarative request.`)
      const request = buildRequestFromSpec(api.request, { ...getDefaultParameters(api), ...params })
      expect(api.buildUrl({ ...getDefaultParameters(api), ...params })).toBe(captured)
      expect(request.url).toBe(captured)
      expect(api.request.hosts).toContain(new URL(captured).host)
    }
  })
  it('preserves captured Bank of Canada default and date-range request outputs', () => {
    const api = getApiById('bank-of-canada-valet')
    if (!api || api.request?.declarative !== true) throw new Error('Bank of Canada API must use a declarative request.')
    const defaults = getDefaultParameters(api)
    const defaultUrl = `https://www.bankofcanada.ca/valet/observations/${defaults.series}/json?start_date=${defaults.startDate}&end_date=${defaults.endDate}`
    expect(api.buildUrl(defaults)).toBe(defaultUrl)
    const sample = { series: 'FXUSDCAD', startDate: '2024-01-01', endDate: '2024-01-31' }
    const captured = 'https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?start_date=2024-01-01&end_date=2024-01-31'
    expect(api.buildUrl(sample)).toBe(captured)
    expect(buildRequestFromSpec(api.request, sample).url).toBe(captured)
  })
  it('keeps every declarative API URL HTTPS and within its declared host set', () => {
    const declarativeApis = apiCatalog.filter((api) => api.request?.declarative === true)
    expect(declarativeApis.length).toBeGreaterThan(1)
    for (const api of declarativeApis) {
      const spec = api.request
      if (!spec || spec.declarative !== true) continue
      const request = buildRequestFromSpec(spec, getDefaultParameters(api))
      expect(api.buildUrl(getDefaultParameters(api))).toBe(request.url)
      const expanded = new URL(request.url)
      expect(expanded.protocol).toBe('https:')
      expect(spec.hosts).toContain(expanded.host)
    }
  })

  it('leaves custom request builders out of declarative claims', () => {
    expect(apiCatalog.filter((api) => !api.request || api.request.declarative === false).length).toBeGreaterThan(0)
  })
})
