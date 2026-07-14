export const apiCategories = [
  'Calendar',
  'Data',
  'Developer',
  'Economy',
  'Environment',
  'Finance',
  'Geo',
  'Government',
  'Knowledge',
  'Media',
  'Nature',
  'People',
  'Singapore',
  'Utility',
  'Vehicle',
  'Weather',
] as const

export type ApiCategory = (typeof apiCategories)[number]

export type FieldOption = {
  label: string
  value: string
}

export type ApiField = {
  id: string
  label: string
  type: 'text' | 'number' | 'select'
  defaultValue: string
  help: string
  placeholder?: string
  min?: number
  max?: number
  options?: FieldOption[]
}

export type ApiDemo = {
  id: string
  name: string
  provider: string
  category: ApiCategory
  description: string
  documentationUrl: string
  accent: string
  monogram: string
  fields: ApiField[]
  buildUrl: (parameters: Record<string, string>) => string
  method?: 'GET' | 'POST'
  buildBody?: (parameters: Record<string, string>) => unknown
}

const encode = (value: string) => encodeURIComponent(value.trim())

const coreApis: ApiDemo[] = [
  {
    id: 'countries',
    name: 'Country Explorer',
    provider: 'World Bank',
    category: 'Data',
    description: 'Look up country metadata, capital cities, regions, and income groups.',
    documentationUrl: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/898590-country-api-queries',
    accent: '#ff7a59',
    monogram: 'RC',
    fields: [
      {
        id: 'code',
        label: 'Country code',
        type: 'text',
        defaultValue: 'SGP',
        placeholder: 'e.g. SGP',
        help: 'Use an ISO 2- or 3-letter country code.',
      },
    ],
    buildUrl: ({ code = 'SGP' }) =>
      `https://api.worldbank.org/v2/country/${encode(code || 'SGP')}?format=json`,
  },
  {
    id: 'weather',
    name: 'Live Weather',
    provider: 'Open-Meteo',
    category: 'Utility',
    description: 'Fetch current conditions for any latitude and longitude—no API key required.',
    documentationUrl: 'https://open-meteo.com/en/docs',
    accent: '#4da3ff',
    monogram: 'OM',
    fields: [
      {
        id: 'latitude',
        label: 'Latitude',
        type: 'number',
        defaultValue: '1.3521',
        min: -90,
        max: 90,
        help: 'A value from -90 to 90.',
      },
      {
        id: 'longitude',
        label: 'Longitude',
        type: 'number',
        defaultValue: '103.8198',
        min: -180,
        max: 180,
        help: 'A value from -180 to 180.',
      },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198' }) => {
      const query = new URLSearchParams({
        latitude,
        longitude,
        current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
        timezone: 'auto',
      })
      return `https://api.open-meteo.com/v1/forecast?${query.toString()}`
    },
  },
  {
    id: 'people',
    name: 'People Generator',
    provider: 'Random User',
    category: 'People',
    description: 'Generate realistic placeholder profiles for prototypes, tests, and demos.',
    documentationUrl: 'https://randomuser.me/documentation',
    accent: '#a57cff',
    monogram: 'RU',
    fields: [
      {
        id: 'count',
        label: 'Profiles',
        type: 'number',
        defaultValue: '3',
        min: 1,
        max: 10,
        help: 'Generate between 1 and 10 profiles.',
      },
      {
        id: 'nationality',
        label: 'Nationality',
        type: 'select',
        defaultValue: 'au',
        help: 'Limit results to one nationality.',
        options: [
          { label: 'Australia', value: 'au' },
          { label: 'Canada', value: 'ca' },
          { label: 'France', value: 'fr' },
          { label: 'United Kingdom', value: 'gb' },
          { label: 'United States', value: 'us' },
        ],
      },
    ],
    buildUrl: ({ count = '3', nationality = 'au' }) => {
      const safeCount = Math.min(10, Math.max(1, Number.parseInt(count, 10) || 3))
      const query = new URLSearchParams({ results: String(safeCount), nat: nationality })
      return `https://randomuser.me/api/?${query.toString()}`
    },
  },
  {
    id: 'dogs',
    name: 'Dog Gallery',
    provider: 'Dog CEO',
    category: 'Nature',
    description: 'Bring a little joy to a prototype with random dog photography.',
    documentationUrl: 'https://dog.ceo/dog-api/documentation/random',
    accent: '#efad32',
    monogram: 'DG',
    fields: [
      {
        id: 'count',
        label: 'Photos',
        type: 'number',
        defaultValue: '4',
        min: 1,
        max: 10,
        help: 'Request between 1 and 10 image URLs.',
      },
    ],
    buildUrl: ({ count = '4' }) => {
      const safeCount = Math.min(10, Math.max(1, Number.parseInt(count, 10) || 4))
      return `https://dog.ceo/api/breeds/image/random/${safeCount}`
    },
  },
  {
    id: 'posts',
    name: 'Post Sandbox',
    provider: 'JSONPlaceholder',
    category: 'Data',
    description: 'Prototype content views with predictable fake REST data.',
    documentationUrl: 'https://jsonplaceholder.typicode.com/guide/',
    accent: '#37b98b',
    monogram: 'JP',
    fields: [
      {
        id: 'postId',
        label: 'Post ID',
        type: 'number',
        defaultValue: '7',
        min: 1,
        max: 100,
        help: 'Choose a post from 1 to 100.',
      },
    ],
    buildUrl: ({ postId = '7' }) => {
      const safeId = Math.min(100, Math.max(1, Number.parseInt(postId, 10) || 7))
      return `https://jsonplaceholder.typicode.com/posts/${safeId}`
    },
  },
  {
    id: 'holidays',
    name: 'Holiday Calendar',
    provider: 'Nager.Date',
    category: 'Utility',
    description: 'Fetch official public holidays by country and year for planning and scheduling demos.',
    documentationUrl: 'https://date.nager.at/Api',
    accent: '#e95f87',
    monogram: 'ND',
    fields: [
      {
        id: 'year',
        label: 'Year',
        type: 'number',
        defaultValue: '2026',
        min: 2000,
        max: 2100,
        help: 'Choose a year from 2000 to 2100.',
      },
      {
        id: 'country',
        label: 'Country',
        type: 'select',
        defaultValue: 'SG',
        help: 'Select an ISO two-letter country code.',
        options: [
          { label: 'Singapore', value: 'SG' },
          { label: 'Malaysia', value: 'MY' },
          { label: 'Australia', value: 'AU' },
          { label: 'Canada', value: 'CA' },
          { label: 'Germany', value: 'DE' },
          { label: 'Japan', value: 'JP' },
          { label: 'United Kingdom', value: 'GB' },
          { label: 'United States', value: 'US' },
        ],
      },
    ],
    buildUrl: ({ year = '2026', country = 'SG' }) => {
      const safeYear = Math.min(2100, Math.max(2000, Number.parseInt(year, 10) || 2026))
      return `https://date.nager.at/api/v3/PublicHolidays/${safeYear}/${encode(country || 'SG').toUpperCase()}`
    },
  },
]

type FixedApi = Omit<ApiDemo, 'fields' | 'buildUrl'> & {
  endpoint: string
}

const fixedApi = ({ endpoint, ...api }: FixedApi): ApiDemo => ({
  ...api,
  fields: [],
  buildUrl: () => endpoint,
})

const importedRecommendedApis: ApiDemo[] = [
  fixedApi({
    id: 'carbon-intensity-gb', name: 'Carbon Intensity GB', provider: 'National Energy System Operator', category: 'Environment',
    description: 'Check the current carbon intensity of electricity generation across Great Britain.',
    documentationUrl: 'https://carbon-intensity.github.io/api-definitions/', endpoint: 'https://api.carbonintensity.org.uk/intensity',
    accent: '#10a37f', monogram: 'CI',
  }),
  fixedApi({
    id: 'data-gov-24hr-forecast', name: 'data.gov.sg 24-Hour Forecast', provider: 'data.gov.sg', category: 'Singapore',
    description: 'Read Singapore weather forecasts and temperature, humidity, and wind ranges for the next 24 hours.',
    documentationUrl: 'https://guide.data.gov.sg/developer-guide/api-overview', endpoint: 'https://api.data.gov.sg/v1/environment/24-hour-weather-forecast',
    accent: '#ef4444', monogram: '24',
  }),
  fixedApi({
    id: 'data-gov-4day-forecast', name: 'data.gov.sg 4-Day Forecast', provider: 'data.gov.sg', category: 'Singapore',
    description: 'Retrieve Singapore\'s four-day outlook with daily conditions and temperature ranges.',
    documentationUrl: 'https://guide.data.gov.sg/developer-guide/api-overview', endpoint: 'https://api.data.gov.sg/v1/environment/4-day-weather-forecast',
    accent: '#f97316', monogram: '4D',
  }),
  fixedApi({
    id: 'data-gov-air-temperature', name: 'data.gov.sg Air Temperature', provider: 'data.gov.sg', category: 'Singapore',
    description: 'Inspect recent temperature readings from weather stations around Singapore.',
    documentationUrl: 'https://guide.data.gov.sg/developer-guide/api-overview', endpoint: 'https://api.data.gov.sg/v1/environment/air-temperature',
    accent: '#fb7185', monogram: 'AT',
  }),
  fixedApi({
    id: 'data-gov-carpark', name: 'data.gov.sg Carpark Availability', provider: 'data.gov.sg', category: 'Singapore',
    description: 'View available lots and capacity across Singapore public carparks.',
    documentationUrl: 'https://guide.data.gov.sg/developer-guide/api-overview', endpoint: 'https://api.data.gov.sg/v1/transport/carpark-availability',
    accent: '#0ea5e9', monogram: 'CP',
  }),
  fixedApi({
    id: 'data-gov-forecast-2hr', name: 'data.gov.sg 2-Hour Forecast', provider: 'data.gov.sg', category: 'Singapore',
    description: 'Fetch short-range weather conditions for named areas across Singapore.',
    documentationUrl: 'https://guide.data.gov.sg/developer-guide/api-overview', endpoint: 'https://api.data.gov.sg/v1/environment/2-hour-weather-forecast',
    accent: '#38bdf8', monogram: '2H',
  }),
  fixedApi({
    id: 'data-gov-pm25', name: 'data.gov.sg PM2.5', provider: 'data.gov.sg', category: 'Singapore',
    description: 'Read regional PM2.5 measurements for Singapore air-quality demos.',
    documentationUrl: 'https://guide.data.gov.sg/developer-guide/api-overview', endpoint: 'https://api.data.gov.sg/v1/environment/pm25',
    accent: '#64748b', monogram: 'PM',
  }),
  fixedApi({
    id: 'data-gov-psi', name: 'data.gov.sg PSI', provider: 'data.gov.sg', category: 'Singapore',
    description: 'Retrieve Singapore Pollutant Standards Index readings by region.',
    documentationUrl: 'https://guide.data.gov.sg/developer-guide/api-overview', endpoint: 'https://api.data.gov.sg/v1/environment/psi',
    accent: '#7c3aed', monogram: 'PS',
  }),
  fixedApi({
    id: 'data-gov-rainfall', name: 'data.gov.sg Rainfall', provider: 'data.gov.sg', category: 'Singapore',
    description: 'Inspect recent rainfall readings reported by stations across Singapore.',
    documentationUrl: 'https://guide.data.gov.sg/developer-guide/api-overview', endpoint: 'https://api.data.gov.sg/v1/environment/rainfall',
    accent: '#2563eb', monogram: 'RF',
  }),
  fixedApi({
    id: 'data-gov-relative-humidity', name: 'data.gov.sg Relative Humidity', provider: 'data.gov.sg', category: 'Singapore',
    description: 'Read recent relative-humidity observations from Singapore weather stations.',
    documentationUrl: 'https://guide.data.gov.sg/developer-guide/api-overview', endpoint: 'https://api.data.gov.sg/v1/environment/relative-humidity',
    accent: '#06b6d4', monogram: 'RH',
  }),
  fixedApi({
    id: 'data-gov-taxi', name: 'data.gov.sg Taxi Availability', provider: 'data.gov.sg', category: 'Singapore',
    description: 'Retrieve the latest geographic positions of available taxis in Singapore.',
    documentationUrl: 'https://guide.data.gov.sg/developer-guide/api-overview', endpoint: 'https://api.data.gov.sg/v1/transport/taxi-availability',
    accent: '#eab308', monogram: 'TX',
  }),
  fixedApi({
    id: 'data-gov-traffic-images', name: 'data.gov.sg Traffic Images', provider: 'data.gov.sg', category: 'Singapore',
    description: 'Get current image URLs and coordinates for Singapore traffic cameras.',
    documentationUrl: 'https://guide.data.gov.sg/developer-guide/api-overview', endpoint: 'https://api.data.gov.sg/v1/transport/traffic-images',
    accent: '#6366f1', monogram: 'TI',
  }),
  fixedApi({
    id: 'data-gov-uv-index', name: 'data.gov.sg UV Index', provider: 'data.gov.sg', category: 'Singapore',
    description: 'View Singapore ultraviolet index observations and reporting timestamps.',
    documentationUrl: 'https://guide.data.gov.sg/developer-guide/api-overview', endpoint: 'https://api.data.gov.sg/v1/environment/uv-index',
    accent: '#f59e0b', monogram: 'UV',
  }),
  fixedApi({
    id: 'data-gov-wind-direction', name: 'data.gov.sg Wind Direction', provider: 'data.gov.sg', category: 'Singapore',
    description: 'Read recent wind-direction measurements from Singapore weather stations.',
    documentationUrl: 'https://guide.data.gov.sg/developer-guide/api-overview', endpoint: 'https://api.data.gov.sg/v1/environment/wind-direction',
    accent: '#14b8a6', monogram: 'WD',
  }),
  fixedApi({
    id: 'data-gov-wind-speed', name: 'data.gov.sg Wind Speed', provider: 'data.gov.sg', category: 'Singapore',
    description: 'Read recent wind-speed measurements from Singapore weather stations.',
    documentationUrl: 'https://guide.data.gov.sg/developer-guide/api-overview', endpoint: 'https://api.data.gov.sg/v1/environment/wind-speed',
    accent: '#0891b2', monogram: 'WS',
  }),
  fixedApi({
    id: 'data-usa', name: 'Data USA API', provider: 'Data USA', category: 'Economy',
    description: 'Explore United States population figures grouped by nation and year.',
    documentationUrl: 'https://datausa.io/about/api/', endpoint: 'https://api.datausa.io/tesseract/data.jsonrecords?cube=acs_yg_total_population_5&drilldowns=State,Year&measures=Population&include=Year:2023&limit=8,0',
    accent: '#2563eb', monogram: 'DU',
  }),
  fixedApi({
    id: 'devto', name: 'DEV.to / Forem API', provider: 'Forem', category: 'Developer',
    description: 'Browse recent JavaScript articles published to the DEV community.',
    documentationUrl: 'https://developers.forem.com/api', endpoint: 'https://dev.to/api/articles?per_page=8&tag=javascript',
    accent: '#111827', monogram: 'DV',
  }),
  fixedApi({
    id: 'fiscal-data-treasury', name: 'Fiscal Data Treasury API', provider: 'U.S. Treasury', category: 'Finance',
    description: 'Inspect recent debt-to-the-penny records from the U.S. Treasury.',
    documentationUrl: 'https://fiscaldata.treasury.gov/api-documentation/', endpoint: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?page%5Bsize%5D=8',
    accent: '#1d4ed8', monogram: 'FT',
  }),
  fixedApi({
    id: 'github', name: 'GitHub Public Repos', provider: 'GitHub', category: 'Developer',
    description: 'List public repositories owned by GitHub\'s Octocat example account.',
    documentationUrl: 'https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user', endpoint: 'https://api.github.com/users/octocat/repos?per_page=8',
    accent: '#24292f', monogram: 'GH',
  }),
  fixedApi({
    id: 'hacker-news', name: 'Hacker News API', provider: 'Y Combinator', category: 'Developer',
    description: 'Load a public Hacker News item and its metadata from Firebase.',
    documentationUrl: 'https://github.com/HackerNews/API', endpoint: 'https://hacker-news.firebaseio.com/v0/item/8863.json?print=pretty',
    accent: '#f97316', monogram: 'HN',
  }),
  fixedApi({
    id: 'ipify-public-ip', name: 'ipify Public IP', provider: 'ipify', category: 'Developer',
    description: 'Return the caller\'s public IPv4 or IPv6 address as JSON.',
    documentationUrl: 'https://www.ipify.org/', endpoint: 'https://api64.ipify.org?format=json',
    accent: '#0ea5e9', monogram: 'IP',
  }),
  fixedApi({
    id: 'met-museum-object-detail', name: 'Met Museum Object', provider: 'The Metropolitan Museum of Art', category: 'Media',
    description: 'Retrieve one artwork record from The Met collection.',
    documentationUrl: 'https://metmuseum.github.io/', endpoint: 'https://collectionapi.metmuseum.org/public/collection/v1/objects/436535',
    accent: '#dc2626', monogram: 'MO',
  }),
  fixedApi({
    id: 'met-museum-search', name: 'Met Museum Search', provider: 'The Metropolitan Museum of Art', category: 'Media',
    description: 'Search The Met collection for objects with images related to Singapore.',
    documentationUrl: 'https://metmuseum.github.io/', endpoint: 'https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=singapore',
    accent: '#b91c1c', monogram: 'MS',
  }),
  fixedApi({
    id: 'nhtsa-vpic', name: 'NHTSA vPIC Vehicle API', provider: 'NHTSA', category: 'Vehicle',
    description: 'List vehicle makes from the U.S. vehicle product information catalog.',
    documentationUrl: 'https://vpic.nhtsa.dot.gov/api/', endpoint: 'https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=json',
    accent: '#1e40af', monogram: 'NH',
  }),
  fixedApi({
    id: 'npm-search', name: 'npm Registry Search', provider: 'npm', category: 'Developer',
    description: 'Search the npm registry for popular packages related to React.',
    documentationUrl: 'https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md', endpoint: 'https://registry.npmjs.org/-/v1/search?text=react&size=8',
    accent: '#cb3837', monogram: 'NP',
  }),
  fixedApi({
    id: 'nvd-cpe-search', name: 'NVD CPE Search', provider: 'NIST NVD', category: 'Developer',
    description: 'Search the National Vulnerability Database product dictionary for OpenSSL.',
    documentationUrl: 'https://nvd.nist.gov/developers/products', endpoint: 'https://services.nvd.nist.gov/rest/json/cpes/2.0?keywordSearch=openssl&resultsPerPage=8',
    accent: '#0369a1', monogram: 'CP',
  }),
  fixedApi({
    id: 'nvd-cve-detail', name: 'NVD CVE Detail', provider: 'NIST NVD', category: 'Developer',
    description: 'Retrieve the vulnerability record for CVE-2024-3094.',
    documentationUrl: 'https://nvd.nist.gov/developers/vulnerabilities', endpoint: 'https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2024-3094',
    accent: '#075985', monogram: 'CD',
  }),
  fixedApi({
    id: 'nvd-cves', name: 'NVD CVE Search', provider: 'NIST NVD', category: 'Developer',
    description: 'Search vulnerability records that mention PostgreSQL.',
    documentationUrl: 'https://nvd.nist.gov/developers/vulnerabilities', endpoint: 'https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=postgresql&resultsPerPage=8',
    accent: '#0c4a6e', monogram: 'CS',
  }),
  fixedApi({
    id: 'nvd-recent-cves', name: 'NVD Recently Modified CVEs', provider: 'NIST NVD', category: 'Developer',
    description: 'Load a small page of recently maintained vulnerability records.',
    documentationUrl: 'https://nvd.nist.gov/developers/vulnerabilities', endpoint: 'https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=8',
    accent: '#155e75', monogram: 'NR',
  }),
  fixedApi({
    id: 'nws-weather', name: 'NWS Weather API', provider: 'National Weather Service', category: 'Weather',
    description: 'Read active weather alerts issued for California.',
    documentationUrl: 'https://www.weather.gov/documentation/services-web-api', endpoint: 'https://api.weather.gov/alerts/active?area=CA',
    accent: '#2563eb', monogram: 'NW',
  }),
  fixedApi({
    id: 'postcodes-io', name: 'Postcodes.io', provider: 'Postcodes.io', category: 'Geo',
    description: 'Look up geographic and administrative details for a UK postcode.',
    documentationUrl: 'https://postcodes.io/docs', endpoint: 'https://api.postcodes.io/postcodes/SW1A1AA',
    accent: '#7c3aed', monogram: 'PC',
  }),
  fixedApi({
    id: 'pypi-json', name: 'PyPI JSON API', provider: 'Python Package Index', category: 'Developer',
    description: 'Inspect package metadata and releases for the Python requests library.',
    documentationUrl: 'https://docs.pypi.org/api/json/', endpoint: 'https://pypi.org/pypi/requests/json',
    accent: '#3775a9', monogram: 'PY',
  }),
  fixedApi({
    id: 'stack-exchange', name: 'Stack Exchange Questions', provider: 'Stack Exchange', category: 'Developer',
    description: 'Browse active JavaScript questions from Stack Overflow.',
    documentationUrl: 'https://api.stackexchange.com/docs', endpoint: 'https://api.stackexchange.com/2.3/questions?order=desc&sort=activity&tagged=javascript&site=stackoverflow&pagesize=8',
    accent: '#f48024', monogram: 'SE',
  }),
  fixedApi({
    id: 'uk-bank-holidays', name: 'UK Bank Holidays', provider: 'GOV.UK', category: 'Calendar',
    description: 'Retrieve official bank-holiday calendars for the United Kingdom.',
    documentationUrl: 'https://www.gov.uk/bank-holidays', endpoint: 'https://www.gov.uk/bank-holidays.json',
    accent: '#1d70b8', monogram: 'UK',
  }),
  fixedApi({
    id: 'usaspending', name: 'USAspending API', provider: 'USAspending.gov', category: 'Government',
    description: 'Search a sample of recent United States federal contract awards.',
    documentationUrl: 'https://github.com/fedspendingtransparency/usaspending-api/blob/master/usaspending_api/api_contracts/contracts/v2/search/spending_by_award.md', endpoint: 'https://api.usaspending.gov/api/v2/search/spending_by_award/',
    accent: '#0f4c81', monogram: 'US', method: 'POST',
    buildBody: () => {
      const year = new Date().getUTCFullYear() - 1
      return {
        filters: {
          time_period: [{ start_date: `${year}-01-01`, end_date: `${year}-12-31` }],
          award_type_codes: ['A', 'B', 'C', 'D'],
        },
        fields: ['Award ID', 'Recipient Name', 'Award Amount'],
        page: 1,
        limit: 8,
        subawards: false,
      }
    },
  }),
  fixedApi({
    id: 'usgs', name: 'USGS Earthquakes', provider: 'U.S. Geological Survey', category: 'Geo',
    description: 'Map earthquakes of magnitude 2.5 or greater reported during the past day.',
    documentationUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php', endpoint: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
    accent: '#92400e', monogram: 'EQ',
  }),
  fixedApi({
    id: 'wikidata-sparql', name: 'Wikidata SPARQL', provider: 'Wikimedia Foundation', category: 'Knowledge',
    description: 'Run a small SPARQL query for city entities and English labels.',
    documentationUrl: 'https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service', endpoint: 'https://query.wikidata.org/sparql?query=SELECT%20%3Fitem%20%3FitemLabel%20WHERE%20%7B%20%3Fitem%20wdt%3AP31%20wd%3AQ515%20.%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22en%22%20.%20%7D%20%7D%20LIMIT%208&format=json',
    accent: '#339966', monogram: 'WD',
  }),
  fixedApi({
    id: 'world-bank-gdp', name: 'World Bank GDP', provider: 'World Bank', category: 'Economy',
    description: 'Explore recent Singapore gross domestic product figures.',
    documentationUrl: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures', endpoint: 'https://api.worldbank.org/v2/country/SGP/indicator/NY.GDP.MKTP.CD?format=json&per_page=8',
    accent: '#0071bc', monogram: 'GDP',
  }),
  fixedApi({
    id: 'world-bank-population', name: 'World Bank Population', provider: 'World Bank', category: 'Economy',
    description: 'Explore recent Singapore population totals by year.',
    documentationUrl: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures', endpoint: 'https://api.worldbank.org/v2/country/SGP/indicator/SP.POP.TOTL?format=json&per_page=8',
    accent: '#005a9c', monogram: 'POP',
  }),
]

export const apiCatalog: ApiDemo[] = [...coreApis, ...importedRecommendedApis]

export const getDefaultParameters = (api: ApiDemo): Record<string, string> =>
  Object.fromEntries(api.fields.map((field) => [field.id, field.defaultValue]))

export const getApiById = (id: string): ApiDemo | undefined =>
  apiCatalog.find((api) => api.id === id)

export const validateParameters = (
  api: ApiDemo,
  parameters: Record<string, string>,
): Record<string, string> => {
  const errors: Record<string, string> = {}

  for (const field of api.fields) {
    const value = parameters[field.id]?.trim() ?? ''
    if (!value) {
      errors[field.id] = `${field.label} is required.`
      continue
    }

    if (field.type === 'number') {
      const numericValue = Number(value)
      if (!Number.isFinite(numericValue)) {
        errors[field.id] = `${field.label} must be a number.`
      } else if (field.min !== undefined && numericValue < field.min) {
        errors[field.id] = `${field.label} must be at least ${field.min}.`
      } else if (field.max !== undefined && numericValue > field.max) {
        errors[field.id] = `${field.label} must be at most ${field.max}.`
      }
    }
  }

  return errors
}
