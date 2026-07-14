export const apiCategories = [
  'Biodiversity',
  'Books',
  'Calendar',
  'Data',
  'Developer',
  'Economy',
  'Entertainment',
  'Environment',
  'Finance',
  'Food',
  'Games',
  'Geo',
  'Government',
  'Health',
  'Knowledge',
  'Language',
  'Media',
  'Nature',
  'People',
  'Research',
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
  parseResponse?: (text: string) => unknown
  risk?: 'Low' | 'Review'
  usageNote?: string
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

const today = new Date().toISOString().slice(0, 10)

export const yahooSgxSymbols: FieldOption[] = [
  { value: 'D05', label: 'D05 · DBS Group' },
  { value: 'O39', label: 'O39 · OCBC Bank' },
  { value: 'U11', label: 'U11 · UOB' },
  { value: 'Z74', label: 'Z74 · Singtel' },
  { value: 'C6L', label: 'C6L · Singapore Airlines' },
  { value: 'S68', label: 'S68 · Singapore Exchange' },
  { value: 'A17U', label: 'A17U · CapitaLand Ascendas REIT' },
  { value: 'C38U', label: 'C38U · CapitaLand Integrated Commercial Trust' },
  { value: 'M44U', label: 'M44U · Mapletree Logistics Trust' },
  { value: 'N2IU', label: 'N2IU · Mapletree Pan Asia Commercial Trust' },
  { value: 'ME8U', label: 'ME8U · Mapletree Industrial Trust' },
  { value: 'AJBU', label: 'AJBU · Keppel DC REIT' },
  { value: 'BN4', label: 'BN4 · Keppel' },
  { value: 'F34', label: 'F34 · Wilmar International' },
  { value: 'G13', label: 'G13 · Genting Singapore' },
  { value: 'C52', label: 'C52 · ComfortDelGro' },
  { value: 'S63', label: 'S63 · ST Engineering' },
  { value: 'Y92', label: 'Y92 · Thai Beverage' },
  { value: 'V03', label: 'V03 · Venture Corporation' },
  { value: 'U14', label: 'U14 · UOL Group' },
  { value: 'BS6', label: 'BS6 · Yangzijiang Shipbuilding' },
  { value: 'S58', label: 'S58 · SATS' },
]

const parseReaderJson = (text: string): unknown => {
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      const data = (parsed as { data?: unknown }).data
      if (data && typeof data === 'object' && 'content' in data) {
        const content = (data as { content?: unknown }).content
        if (typeof content === 'string') return JSON.parse(content) as unknown
      }
    }
    return parsed
  }

  const marker = 'Markdown Content:'
  const markerIndex = text.indexOf(marker)
  if (markerIndex === -1) {
    const preview = trimmed.replace(/\s+/g, ' ').slice(0, 120)
    throw new Error(`The compatibility relay returned an unexpected response${preview ? `: ${preview}` : '.'}`)
  }
  return JSON.parse(text.slice(markerIndex + marker.length).trim()) as unknown
}

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
  {
    id: 'frankfurter-sgd-myr-history', name: 'SGD/MYR FX History', provider: 'Frankfurter · ECB', category: 'Finance',
    description: 'Explore monthly SGD/MYR reference rates from the euro-era starting point in 1999.',
    documentationUrl: 'https://frankfurter.dev/', accent: '#0f766e', monogram: 'FX',
    fields: [
      { id: 'from', label: 'Start date', type: 'text', defaultValue: '1999-01-04', placeholder: 'YYYY-MM-DD', help: 'ECB history begins at the euro-era starting point.' },
      { id: 'to', label: 'End date', type: 'text', defaultValue: today, placeholder: 'YYYY-MM-DD', help: 'Use an ISO date up to today.' },
      { id: 'group', label: 'Grouping', type: 'select', defaultValue: 'month', help: 'Monthly grouping keeps the long history compact.', options: [{ label: 'Monthly', value: 'month' }, { label: 'Weekly', value: 'week' }] },
    ],
    buildUrl: ({ from = '1999-01-04', to = today, group = 'month' }) => {
      const query = new URLSearchParams({ from, to, base: 'SGD', quotes: 'MYR', providers: 'ECB', group })
      return `https://api.frankfurter.dev/v2/rates?${query.toString()}`
    },
  },
  {
    id: 'open-library-search', name: 'Open Library Search', provider: 'Internet Archive', category: 'Books',
    description: 'Search books, authors, and publication years in the Open Library catalogue.',
    documentationUrl: 'https://openlibrary.org/developers/api', accent: '#b45309', monogram: 'OL',
    usageNote: 'Designed for low-volume, human-facing discovery. Cache results and follow Open Library usage limits.',
    fields: [
      { id: 'query', label: 'Book search', type: 'text', defaultValue: 'artificial intelligence', help: 'Search by title, author, subject, or keyword.' },
      { id: 'limit', label: 'Results', type: 'number', defaultValue: '8', min: 1, max: 20, help: 'Return between 1 and 20 books.' },
    ],
    buildUrl: ({ query = 'artificial intelligence', limit = '8' }) => {
      const params = new URLSearchParams({ q: query, limit, fields: 'key,title,author_name,first_publish_year,cover_i' })
      return `https://openlibrary.org/search.json?${params.toString()}`
    },
  },
  {
    id: 'free-dictionary', name: 'Free Dictionary', provider: 'Free Dictionary API', category: 'Language',
    description: 'Look up English definitions, pronunciations, examples, synonyms, and antonyms.',
    documentationUrl: 'https://dictionaryapi.dev/', accent: '#7c3aed', monogram: 'DI',
    fields: [{ id: 'word', label: 'English word', type: 'text', defaultValue: 'hello', help: 'Enter one English word.' }],
    buildUrl: ({ word = 'hello' }) => `https://api.dictionaryapi.dev/api/v2/entries/en/${encode(word || 'hello')}`,
  },
  {
    id: 'pokeapi', name: 'PokéAPI Explorer', provider: 'PokéAPI', category: 'Games',
    description: 'Explore a Pokémon profile, abilities, types, sprites, and game statistics.',
    documentationUrl: 'https://pokeapi.co/docs', accent: '#eab308', monogram: 'PK',
    fields: [{ id: 'pokemon', label: 'Pokémon', type: 'text', defaultValue: 'pikachu', help: 'Use a Pokémon name or Pokédex number.' }],
    buildUrl: ({ pokemon = 'pikachu' }) => `https://pokeapi.co/api/v2/pokemon/${encode(pokemon || 'pikachu').toLowerCase()}`,
  },
  {
    id: 'art-institute-search', name: 'Art Institute Search', provider: 'Art Institute of Chicago', category: 'Media',
    description: 'Search artwork records with artist and IIIF image identifiers.',
    documentationUrl: 'https://api.artic.edu/docs/', accent: '#dc2626', monogram: 'AI',
    usageNote: 'Anonymous access is rate-limited. Review image rights and use public-domain media for demonstrations.',
    fields: [
      { id: 'query', label: 'Artwork search', type: 'text', defaultValue: 'monet', help: 'Search artwork titles, artists, or subjects.' },
      { id: 'limit', label: 'Results', type: 'number', defaultValue: '8', min: 1, max: 20, help: 'Return between 1 and 20 artworks.' },
    ],
    buildUrl: ({ query = 'monet', limit = '8' }) => {
      const params = new URLSearchParams({ q: query, limit, fields: 'id,title,artist_title,date_display,image_id' })
      return `https://api.artic.edu/api/v1/artworks/search?${params.toString()}`
    },
  },
  {
    id: 'tvmaze-search', name: 'TVmaze Show Search', provider: 'TVmaze', category: 'Entertainment',
    description: 'Search television shows with schedules, genres, ratings, and image metadata.',
    documentationUrl: 'https://www.tvmaze.com/api', accent: '#ec4899', monogram: 'TV',
    usageNote: 'TVmaze data requires source attribution and ShareAlike compliance.',
    fields: [{ id: 'show', label: 'Show title', type: 'text', defaultValue: 'severance', help: 'Search for a television series.' }],
    buildUrl: ({ show = 'severance' }) => `https://api.tvmaze.com/search/shows?q=${encode(show || 'severance')}`,
  },
  {
    id: 'open-food-facts', name: 'Open Food Facts', provider: 'Open Food Facts', category: 'Food',
    description: 'Look up ingredients, nutrition, labels, and product images by barcode.',
    documentationUrl: 'https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/', accent: '#65a30d', monogram: 'OF',
    fields: [{ id: 'barcode', label: 'Barcode', type: 'text', defaultValue: '3017620422003', help: 'Enter an EAN or UPC product barcode.' }],
    buildUrl: ({ barcode = '3017620422003' }) => `https://world.openfoodfacts.org/api/v3/product/${encode(barcode || '3017620422003')}.json`,
  },
  {
    id: 'gbif-species-search', name: 'GBIF Species Search', provider: 'GBIF', category: 'Biodiversity',
    description: 'Search scientific names, taxonomy, vernacular names, and species records.',
    documentationUrl: 'https://techdocs.gbif.org/en/openapi/v1/species', accent: '#16a34a', monogram: 'GB',
    fields: [{ id: 'query', label: 'Species search', type: 'text', defaultValue: 'panthera', help: 'Search by scientific or common name.' }],
    buildUrl: ({ query = 'panthera' }) => `https://api.gbif.org/v1/species/search?q=${encode(query || 'panthera')}&limit=8`,
  },
  {
    id: 'clinical-trials-search', name: 'ClinicalTrials.gov Search', provider: 'U.S. National Library of Medicine', category: 'Health',
    description: 'Search public clinical study records by condition or disease.',
    documentationUrl: 'https://clinicaltrials.gov/data-about-studies/learn-about-api', accent: '#0284c7', monogram: 'CT', risk: 'Review',
    usageNote: 'For research demonstrations only. Do not use API results as medical advice or a substitute for professional care.',
    fields: [{ id: 'condition', label: 'Condition', type: 'text', defaultValue: 'Diabetes', help: 'Search a condition or disease name.' }],
    buildUrl: ({ condition = 'Diabetes' }) => {
      const params = new URLSearchParams({ 'query.cond': condition, pageSize: '8', format: 'json' })
      return `https://clinicaltrials.gov/api/v2/studies?${params.toString()}`
    },
  },
  {
    id: 'europe-pmc-search', name: 'Europe PMC Search', provider: 'Europe PMC', category: 'Research',
    description: 'Search life-sciences papers, preprints, citations, and open-access literature.',
    documentationUrl: 'https://europepmc.org/RestfulWebService', accent: '#2563eb', monogram: 'EP',
    fields: [{ id: 'query', label: 'Literature search', type: 'text', defaultValue: 'OPEN_ACCESS:Y AND machine learning', help: 'Use Europe PMC search syntax.' }],
    buildUrl: ({ query = 'OPEN_ACCESS:Y AND machine learning' }) => {
      const params = new URLSearchParams({ query, format: 'json', pageSize: '8' })
      return `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params.toString()}`
    },
  },
  {
    id: 'openfda-drug-labels', name: 'openFDA Drug Labels', provider: 'U.S. Food and Drug Administration', category: 'Health',
    description: 'Search public drug-label records by brand name and inspect regulated product metadata.',
    documentationUrl: 'https://open.fda.gov/apis/drug/label/', accent: '#0369a1', monogram: 'FD', risk: 'Review',
    usageNote: 'For informational demonstrations only. Labels may be incomplete or outdated; never use this response for medical decisions.',
    fields: [{ id: 'brand', label: 'Brand name', type: 'text', defaultValue: 'Advil', help: 'Search a drug brand name indexed by openFDA.' }],
    buildUrl: ({ brand = 'Advil' }) => {
      const params = new URLSearchParams({ search: `openfda.brand_name:${brand}`, limit: '8' })
      return `https://api.fda.gov/drug/label.json?${params.toString()}`
    },
  },
  {
    id: 'coinpaprika-ticker', name: 'CoinPaprika Ticker', provider: 'CoinPaprika', category: 'Finance',
    description: 'Inspect current cryptocurrency price, market capitalization, volume, and percentage changes.',
    documentationUrl: 'https://docs.coinpaprika.com/', accent: '#f59e0b', monogram: 'CP', risk: 'Review',
    usageNote: 'Market data is informational, not investment advice. Display CoinPaprika attribution when publishing results.',
    fields: [{ id: 'coin', label: 'Cryptocurrency', type: 'select', defaultValue: 'btc-bitcoin', help: 'Select a public ticker.', options: [{ label: 'Bitcoin', value: 'btc-bitcoin' }, { label: 'Ethereum', value: 'eth-ethereum' }, { label: 'Solana', value: 'sol-solana' }, { label: 'Tether', value: 'usdt-tether' }] }],
    buildUrl: ({ coin = 'btc-bitcoin' }) => `https://api.coinpaprika.com/v1/tickers/${encode(coin || 'btc-bitcoin')}`,
  },
  {
    id: 'yahoo-finance-sgx-history', name: 'Yahoo Finance SGX History', provider: 'Yahoo Finance', category: 'Finance',
    description: 'Explore maximum available history for 22 SGX blue-chip and large-cap listings, including D05 from 2000.',
    documentationUrl: 'https://help.yahoo.com/kb/finance-for-web/download-historical-data-yahoo-finance-sln2311.html', accent: '#6f2dbd', monogram: 'YF', risk: 'Review',
    usageNote: 'Yahoo does not publish this chart route as a supported public API and blocks browser CORS. This demo uses a read-only Jina Reader compatibility relay; do not use it for trading or production workloads.',
    fields: [
      { id: 'symbol', label: 'SGX symbol', type: 'select', defaultValue: 'D05', help: 'Choose one of 22 verified Yahoo Finance .SI listings.', options: yahooSgxSymbols },
      { id: 'interval', label: 'History interval', type: 'select', defaultValue: '1mo', help: 'Monthly data is recommended for maximum history.', options: [{ label: 'Weekly', value: '1wk' }, { label: 'Monthly', value: '1mo' }, { label: 'Quarterly', value: '3mo' }] },
    ],
    buildUrl: ({ symbol = 'D05', interval = '1mo' }) => {
      const safeSymbol = encode(symbol || 'D05').toUpperCase()
      const safeInterval = ['1wk', '1mo', '3mo'].includes(interval) ? interval : '1mo'
      return `https://r.jina.ai/http://query1.finance.yahoo.com/v8/finance/chart/${safeSymbol}.SI?range=max&interval=${safeInterval}&events=history&includeAdjustedClose=true`
    },
    parseResponse: parseReaderJson,
  },
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
