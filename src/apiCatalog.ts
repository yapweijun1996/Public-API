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
  'News',
  'People',
  'Research',
  'Security',
  'Singapore',
  'Sports',
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
  bodyEncoding?: 'json' | 'form'
  headers?: Record<string, string>
  parseResponse?: (text: string) => unknown
  risk?: 'Low' | 'Review'
  usageNote?: string
}

const encode = (value: string) => encodeURIComponent(value.trim())

const clampInt = (value: string, min: number, max: number, fallback: number): number =>
  Math.min(max, Math.max(min, Number.parseInt(value, 10) || fallback))

const numberField = (id: string, params: Omit<ApiField, 'id' | 'type'>): ApiField => ({ id, type: 'number', ...params })
const textField = (id: string, params: Omit<ApiField, 'id' | 'type'>): ApiField => ({ id, type: 'text', ...params })

const latLongFields = (overrides: {
  latitude?: Partial<Pick<ApiField, 'defaultValue' | 'min' | 'max' | 'help'>>
  longitude?: Partial<Pick<ApiField, 'defaultValue' | 'min' | 'max' | 'help'>>
} = {}): [ApiField, ApiField] => [
  { id: 'latitude', label: 'Latitude', type: 'number', defaultValue: '1.3521', min: -90, max: 90, help: 'A WGS84 latitude from -90 to 90.', ...overrides.latitude },
  { id: 'longitude', label: 'Longitude', type: 'number', defaultValue: '103.8198', min: -180, max: 180, help: 'A WGS84 longitude from -180 to 180.', ...overrides.longitude },
]

const countField = (params: Omit<ApiField, 'id' | 'type' | 'label'> & { label?: string }) =>
  numberField('count', { label: 'Count', ...params })
const limitField = (params: Omit<ApiField, 'id' | 'type' | 'label'> & { label?: string }) =>
  numberField('limit', { label: 'Results', ...params })
const queryField = (params: Omit<ApiField, 'id' | 'type'>) => textField('query', params)

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
    fields: [...latLongFields()],
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
      countField({ label: 'Profiles', defaultValue: '3', min: 1, max: 10, help: 'Generate between 1 and 10 profiles.' }),
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
      const safeCount = clampInt(count, 1, 10, 3)
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
      countField({ label: 'Photos', defaultValue: '4', min: 1, max: 10, help: 'Request between 1 and 10 image URLs.' }),
    ],
    buildUrl: ({ count = '4' }) => {
      const safeCount = clampInt(count, 1, 10, 4)
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
      const safeId = clampInt(postId, 1, 100, 7)
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
      const safeYear = clampInt(year, 2000, 2100, 2026)
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

const localNow = new Date()
const today = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`
const compactDate = (date: Date) => `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
const daysAgo = (days: number) => {
  const date = new Date(localNow)
  date.setDate(date.getDate() - days)
  return date
}

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

const additionalInteractiveApis: ApiDemo[] = [
  {
    id: 'geocoding-search', name: 'Global Geocoding', provider: 'Open-Meteo', category: 'Geo',
    description: 'Search worldwide cities and postal codes, then inspect coordinates, timezones, and population.',
    documentationUrl: 'https://open-meteo.com/en/docs/geocoding-api', accent: '#2563eb', monogram: 'GC',
    fields: [
      { id: 'name', label: 'Location', type: 'text', defaultValue: 'Singapore', placeholder: 'e.g. Singapore', help: 'Enter at least three characters for fuzzy matching.' },
      countField({ label: 'Results', defaultValue: '6', min: 1, max: 10, help: 'Return between 1 and 10 matching locations.' }),
    ],
    buildUrl: ({ name = 'Singapore', count = '6' }) => {
      const safeCount = clampInt(count, 1, 10, 6)
      const query = new URLSearchParams({ name: name.trim() || 'Singapore', count: String(safeCount), language: 'en', format: 'json' })
      return `https://geocoding-api.open-meteo.com/v1/search?${query.toString()}`
    },
  },
  {
    id: 'open-meteo-air-quality', name: 'Global Air Quality', provider: 'Open-Meteo', category: 'Environment',
    description: 'Read current AQI, particulate matter, nitrogen dioxide, and ozone for any coordinate.',
    documentationUrl: 'https://open-meteo.com/en/docs/air-quality-api', accent: '#0f9f8f', monogram: 'AQ',
    fields: [
      ...latLongFields(),
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198' }) => {
      const query = new URLSearchParams({ latitude, longitude, current: 'us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone', timezone: 'auto' })
      return `https://air-quality-api.open-meteo.com/v1/air-quality?${query.toString()}`
    },
    usageNote: 'Air-quality data requires attribution to Open-Meteo and the Copernicus Atmosphere Monitoring Service (CAMS).',
  },
  {
    id: 'sunrise-sunset', name: 'Sunrise & Sunset', provider: 'Sunrise-Sunset.org', category: 'Calendar',
    description: 'Calculate sunrise, sunset, twilight, golden hour, solar noon, and moon data for a location.',
    documentationUrl: 'https://sunrise-sunset.org/api', accent: '#f59e0b', monogram: 'SS',
    fields: [
      ...latLongFields(),
      { id: 'date', label: 'Date', type: 'text', defaultValue: today, placeholder: 'YYYY-MM-DD', help: 'Use YYYY-MM-DD, today, or tomorrow.' },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', date = today }) => {
      const query = new URLSearchParams({ lat: latitude, lng: longitude, date: date.trim() || 'today' })
      return `https://api.sunrise-sunset.org/v2?${query.toString()}`
    },
    usageNote: 'Free and keyless. Display visible attribution to sunrise-sunset.org when using the data.',
  },
  {
    id: 'nasa-eonet-events', name: 'NASA Natural Events', provider: 'NASA EONET', category: 'Nature',
    description: 'Explore near-real-time wildfires, storms, volcanoes, floods, and other natural events worldwide.',
    documentationUrl: 'https://eonet.gsfc.nasa.gov/docs/v3', accent: '#e23b3b', monogram: 'NE',
    fields: [
      { id: 'category', label: 'Category', type: 'select', defaultValue: 'all', help: 'Filter active events by NASA EONET category.', options: [
        { label: 'All events', value: 'all' }, { label: 'Wildfires', value: 'wildfires' }, { label: 'Severe storms', value: 'severeStorms' },
        { label: 'Volcanoes', value: 'volcanoes' }, { label: 'Floods', value: 'floods' }, { label: 'Earthquakes', value: 'earthquakes' },
      ] },
      { id: 'days', label: 'Recent days', type: 'number', defaultValue: '30', min: 1, max: 365, help: 'Look back between 1 and 365 days.' },
      limitField({ label: 'Events', defaultValue: '6', min: 1, max: 10, help: 'Return between 1 and 10 active events.' }),
    ],
    buildUrl: ({ category = 'all', days = '30', limit = '6' }) => {
      const query = new URLSearchParams({ status: 'open', days: String(clampInt(days, 1, 365, 30)), limit: String(clampInt(limit, 1, 10, 6)) })
      if (category !== 'all') query.set('category', category)
      return `https://eonet.gsfc.nasa.gov/api/v3/events?${query.toString()}`
    },
  },
  {
    id: 'mbta-transit-routes', name: 'MBTA Transit Routes', provider: 'MBTA', category: 'Utility',
    description: 'Browse Boston subway, commuter rail, bus, and ferry routes from the MBTA v3 service.',
    documentationUrl: 'https://api-v3.mbta.com/docs/swagger', accent: '#165c96', monogram: 'T',
    fields: [
      { id: 'routeType', label: 'Transit mode', type: 'select', defaultValue: '0,1', help: 'Choose a family of MBTA routes.', options: [
        { label: 'Subway & light rail', value: '0,1' }, { label: 'Commuter rail', value: '2' }, { label: 'Bus', value: '3' }, { label: 'Ferry', value: '4' },
      ] },
    ],
    buildUrl: ({ routeType = '0,1' }) => {
      const query = new URLSearchParams({ 'filter[type]': routeType || '0,1' })
      return `https://api-v3.mbta.com/routes?${query.toString()}`
    },
    usageNote: 'The MBTA allows keyless experimentation with a lower request allowance; production apps should request a free API key.',
  },
  {
    id: 'open-trivia', name: 'Trivia Challenge', provider: 'Open Trivia DB', category: 'Games',
    description: 'Generate multiple-choice trivia questions for quiz prototypes and interactive demos.',
    documentationUrl: 'https://opentdb.com/api_config.php', accent: '#7c3aed', monogram: 'Q',
    fields: [
      { id: 'amount', label: 'Questions', type: 'number', defaultValue: '6', min: 1, max: 10, help: 'Generate between 1 and 10 questions.' },
      { id: 'category', label: 'Category', type: 'select', defaultValue: '9', help: 'Choose a trivia category.', options: [
        { label: 'General knowledge', value: '9' }, { label: 'Books', value: '10' }, { label: 'Film', value: '11' }, { label: 'Science & nature', value: '17' },
        { label: 'Computers', value: '18' }, { label: 'Geography', value: '22' }, { label: 'History', value: '23' }, { label: 'Sports', value: '21' },
      ] },
      { id: 'difficulty', label: 'Difficulty', type: 'select', defaultValue: 'medium', help: 'Choose the question difficulty.', options: [
        { label: 'Easy', value: 'easy' }, { label: 'Medium', value: 'medium' }, { label: 'Hard', value: 'hard' },
      ] },
    ],
    buildUrl: ({ amount = '6', category = '9', difficulty = 'medium' }) => {
      const safeAmount = clampInt(amount, 1, 10, 6)
      const query = new URLSearchParams({ amount: String(safeAmount), category, difficulty, type: 'multiple' })
      return `https://opentdb.com/api.php?${query.toString()}`
    },
  },
]

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
    accent: '#f97316', monogram: 'HNR',
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
    accent: '#0369a1', monogram: 'NV',
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
    accent: '#339966', monogram: 'WQ',
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
      queryField({ label: 'Book search', defaultValue: 'artificial intelligence', help: 'Search by title, author, subject, or keyword.' }),
      limitField({ label: 'Results', defaultValue: '8', min: 1, max: 20, help: 'Return between 1 and 20 books.' }),
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
      queryField({ label: 'Artwork search', defaultValue: 'monet', help: 'Search artwork titles, artists, or subjects.' }),
      limitField({ label: 'Results', defaultValue: '8', min: 1, max: 20, help: 'Return between 1 and 20 artworks.' }),
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
    fields: [queryField({ label: 'Species search', defaultValue: 'panthera', help: 'Search by scientific or common name.' })],
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
    fields: [queryField({ label: 'Literature search', defaultValue: 'OPEN_ACCESS:Y AND machine learning', help: 'Use Europe PMC search syntax.' })],
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
    documentationUrl: 'https://docs.coinpaprika.com/', accent: '#f59e0b', monogram: 'CK', risk: 'Review',
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
  {
    id: 'malaysia-fuel-price', name: 'Malaysia Fuel Price', provider: 'data.gov.my', category: 'Finance',
    description: 'Compare Malaysia’s weekly RON95, RON97, diesel, and targeted-subsidy fuel prices.',
    documentationUrl: 'https://data.gov.my/data-catalogue/fuelprice', accent: '#d9485f', monogram: 'MY',
    usageNote: 'Official open data licensed under CC BY 4.0. Keep data.gov.my attribution visible when republishing the results.',
    fields: [
      limitField({ label: 'History rows', defaultValue: '52', min: 12, max: 104, help: 'Each week can include a price level and a weekly-change row.' }),
    ],
    buildUrl: ({ limit = '52' }) => {
      const safeLimit = clampInt(limit, 12, 104, 52)
      return `https://api.data.gov.my/data-catalogue/?id=fuelprice&limit=${safeLimit}&sort=-date`
    },
  },
  {
    id: 'open-meteo-marine', name: 'Marine Weather', provider: 'Open-Meteo', category: 'Weather',
    description: 'Inspect wave height, period, direction, sea temperature, and ocean currents for coastal demos.',
    documentationUrl: 'https://open-meteo.com/en/docs/marine-weather-api', accent: '#087ea4', monogram: 'MW', risk: 'Review',
    usageNote: 'Open-Meteo attribution is required. Forecasts are not suitable for coastal navigation or safety-critical decisions.',
    fields: [
      ...latLongFields(),
      { id: 'days', label: 'Forecast days', type: 'number', defaultValue: '3', min: 1, max: 7, help: 'Return between 1 and 7 forecast days.' },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', days = '3' }) => {
      const safeDays = clampInt(days, 1, 7, 3)
      const query = new URLSearchParams({
        latitude,
        longitude,
        hourly: 'wave_height,wave_direction,wave_period,sea_surface_temperature,ocean_current_velocity,ocean_current_direction',
        timezone: 'auto',
        forecast_days: String(safeDays),
      })
      return `https://marine-api.open-meteo.com/v1/marine?${query.toString()}`
    },
  },
  {
    id: 'nobel-prizes', name: 'Nobel Prize Explorer', provider: 'Nobel Prize Outreach', category: 'Research',
    description: 'Browse recent Nobel Prizes, laureates, motivations, award years, and prize amounts by category.',
    documentationUrl: 'https://www.nobelprize.org/about/developer-zone-2/', accent: '#a66b18', monogram: 'NB',
    usageNote: 'Uses the official Nobel Prize API. Follow the linked API terms and licence when republishing data.',
    fields: [
      { id: 'category', label: 'Prize category', type: 'select', defaultValue: 'phy', help: 'Choose a Nobel Prize category.', options: [
        { label: 'Physics', value: 'phy' }, { label: 'Chemistry', value: 'che' }, { label: 'Physiology or Medicine', value: 'med' },
        { label: 'Literature', value: 'lit' }, { label: 'Peace', value: 'pea' }, { label: 'Economic Sciences', value: 'eco' },
      ] },
      limitField({ label: 'Prize years', defaultValue: '6', min: 1, max: 12, help: 'Return between 1 and 12 recent prize records.' }),
    ],
    buildUrl: ({ category = 'phy', limit = '6' }) => {
      const safeLimit = clampInt(limit, 1, 12, 6)
      const query = new URLSearchParams({ nobelPrizeCategory: category || 'phy', limit: String(safeLimit), sort: 'desc' })
      return `https://api.nobelprize.org/2.1/nobelPrizes?${query.toString()}`
    },
  },
  {
    id: 'chess-player-stats', name: 'Chess.com Player Ratings', provider: 'Chess.com', category: 'Games',
    description: 'Compare a public player’s blitz, bullet, rapid, daily, FIDE, tactics, and match records.',
    documentationUrl: 'https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it', accent: '#63863c', monogram: 'CH',
    usageNote: 'The PubAPI is read-only. Keep requests serial, respect cache headers, and avoid rapid repeated refreshes.',
    fields: [
      { id: 'username', label: 'Chess.com username', type: 'text', defaultValue: 'hikaru', placeholder: 'e.g. hikaru', help: 'Enter a public Chess.com username.' },
    ],
    buildUrl: ({ username = 'hikaru' }) => `https://api.chess.com/pub/player/${encode(username || 'hikaru').toLowerCase()}/stats`,
  },
  {
    id: 'crossref-works', name: 'Crossref Works Search', provider: 'Crossref', category: 'Research',
    description: 'Search scholarly works and inspect DOI, authorship, publisher, type, year, and citation counts.',
    documentationUrl: 'https://www.crossref.org/documentation/retrieve-metadata/rest-api/', accent: '#4f46a5', monogram: 'CR',
    usageNote: 'Uses Crossref’s public pool without authentication. Cache results and keep request volume modest.',
    fields: [
      queryField({ label: 'Research query', defaultValue: 'agentic AI', placeholder: 'e.g. climate adaptation', help: 'Search titles, authors, abstracts, and other Crossref metadata.' }),
      { id: 'rows', label: 'Results', type: 'number', defaultValue: '8', min: 1, max: 20, help: 'Return between 1 and 20 works.' },
    ],
    buildUrl: ({ query = 'agentic AI', rows = '8' }) => {
      const safeRows = clampInt(rows, 1, 20, 8)
      const params = new URLSearchParams({ query: query.trim() || 'agentic AI', rows: String(safeRows), select: 'DOI,title,author,published,publisher,is-referenced-by-count,type,URL' })
      return `https://api.crossref.org/works?${params.toString()}`
    },
  },
]

const nextKeylessApis: ApiDemo[] = [
  fixedApi({
    id: 'noaa-space-weather', name: 'NOAA Space Weather', provider: 'NOAA SWPC', category: 'Environment',
    description: 'Monitor current radio blackouts, solar radiation storms, and geomagnetic storm scales.',
    documentationUrl: 'https://www.spaceweather.gov/content/data-access', endpoint: 'https://services.swpc.noaa.gov/products/noaa-scales.json',
    accent: '#0b5cab', monogram: 'NS', usageNote: 'Official NOAA operational data. Treat forecasts as guidance and retain NOAA attribution.',
  }),
  {
    id: 'osv-vulnerability', name: 'OSV Vulnerability', provider: 'Google Open Source Security', category: 'Developer',
    description: 'Inspect an open-source vulnerability, affected packages, ecosystem ranges, aliases, and references.',
    documentationUrl: 'https://google.github.io/osv.dev/api/', accent: '#b42318', monogram: 'OS',
    fields: [{ id: 'vulnerabilityId', label: 'OSV or GHSA ID', type: 'text', defaultValue: 'GHSA-jfh8-c2jp-5v3q', placeholder: 'e.g. GHSA-jfh8-c2jp-5v3q', help: 'Enter a public OSV, CVE, or GitHub Security Advisory identifier.' }],
    buildUrl: ({ vulnerabilityId = 'GHSA-jfh8-c2jp-5v3q' }) => `https://api.osv.dev/v1/vulns/${encode(vulnerabilityId || 'GHSA-jfh8-c2jp-5v3q')}`,
  },
  {
    id: 'federal-register-documents', name: 'Federal Register Documents', provider: 'U.S. Federal Register', category: 'Government',
    description: 'Search recent U.S. rules, notices, proposed rules, presidential documents, and agency publications.',
    documentationUrl: 'https://www.federalregister.gov/developers/documentation/api/v1', accent: '#344054', monogram: 'FR',
    fields: [
      queryField({ label: 'Search term', defaultValue: 'artificial intelligence', placeholder: 'e.g. artificial intelligence', help: 'Search document titles and indexed Federal Register content.' }),
      limitField({ label: 'Documents', defaultValue: '8', min: 1, max: 20, help: 'Return between 1 and 20 recent documents.' }),
    ],
    buildUrl: ({ query = 'artificial intelligence', limit = '8' }) => {
      const safeLimit = clampInt(limit, 1, 20, 8)
      const params = new URLSearchParams({ per_page: String(safeLimit), order: 'newest', 'conditions[term]': query.trim() || 'artificial intelligence' })
      return `https://www.federalregister.gov/api/v1/documents.json?${params.toString()}`
    },
  },
  {
    id: 'wikipedia-search', name: 'Wikipedia Search', provider: 'Wikimedia Foundation', category: 'Knowledge',
    description: 'Search Wikipedia and return article extracts, thumbnails, page identifiers, and canonical titles.',
    documentationUrl: 'https://www.mediawiki.org/wiki/API:Search', accent: '#202122', monogram: 'WP',
    fields: [
      queryField({ label: 'Article search', defaultValue: 'Singapore', placeholder: 'e.g. Singapore', help: 'Search English Wikipedia titles and article text.' }),
      limitField({ label: 'Results', defaultValue: '8', min: 1, max: 12, help: 'Return between 1 and 12 matching pages.' }),
    ],
    buildUrl: ({ query = 'Singapore', limit = '8' }) => {
      const safeLimit = clampInt(limit, 1, 12, 8)
      const params = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: query.trim() || 'Singapore', gsrlimit: String(safeLimit), prop: 'pageimages|extracts', exintro: '1', explaintext: '1', piprop: 'thumbnail', pithumbsize: '480', format: 'json', origin: '*' })
      return `https://en.wikipedia.org/w/api.php?${params.toString()}`
    },
  },
  {
    id: 'open-meteo-flood', name: 'Global Flood Forecast', provider: 'Open-Meteo', category: 'Environment',
    description: 'Inspect forecast river discharge and recent hydrological conditions for any coordinate.',
    documentationUrl: 'https://open-meteo.com/en/docs/flood-api', accent: '#0284c7', monogram: 'FL', risk: 'Review',
    usageNote: 'Hydrological model guidance only. Do not use this demo for emergency or life-safety decisions.',
    fields: [
      ...latLongFields(),
      { id: 'days', label: 'Forecast days', type: 'number', defaultValue: '7', min: 1, max: 30, help: 'Return between 1 and 30 daily discharge values.' },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', days = '7' }) => {
      const safeDays = clampInt(days, 1, 30, 7)
      const params = new URLSearchParams({ latitude, longitude, daily: 'river_discharge,river_discharge_mean,river_discharge_max', forecast_days: String(safeDays) })
      return `https://flood-api.open-meteo.com/v1/flood?${params.toString()}`
    },
  },
  {
    id: 'open-meteo-history', name: 'Historical Weather', provider: 'Open-Meteo', category: 'Weather',
    description: 'Compare historical daily temperature and precipitation series for a selected place and date range.',
    documentationUrl: 'https://open-meteo.com/en/docs/historical-weather-api', accent: '#2563eb', monogram: 'HW',
    fields: [
      ...latLongFields(),
      { id: 'startDate', label: 'Start date', type: 'text', defaultValue: '2025-01-01', placeholder: 'YYYY-MM-DD', help: 'Use an ISO date supported by the historical archive.' },
      { id: 'endDate', label: 'End date', type: 'text', defaultValue: '2025-01-14', placeholder: 'YYYY-MM-DD', help: 'Choose an end date on or after the start date.' },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', startDate = '2025-01-01', endDate = '2025-01-14' }) => {
      const params = new URLSearchParams({ latitude, longitude, start_date: startDate.trim() || '2025-01-01', end_date: endDate.trim() || '2025-01-14', daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum', timezone: 'auto' })
      return `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`
    },
  },
  {
    id: 'kraken-public-ticker', name: 'Kraken Market Ticker', provider: 'Kraken', category: 'Finance',
    description: 'Read live cryptocurrency bid, ask, last trade, volume, high, and low market data.',
    documentationUrl: 'https://docs.kraken.com/api/docs/rest-api/get-ticker-information', accent: '#5741d9', monogram: 'KR', risk: 'Review',
    usageNote: 'Public market data only. This demo does not provide trading or financial advice.',
    fields: [{ id: 'pair', label: 'Market pair', type: 'select', defaultValue: 'XBTUSD', help: 'Choose a public Kraken spot market.', options: [
      { label: 'BTC / USD', value: 'XBTUSD' }, { label: 'ETH / USD', value: 'ETHUSD' }, { label: 'SOL / USD', value: 'SOLUSD' }, { label: 'BTC / EUR', value: 'XBTEUR' },
    ] }],
    buildUrl: ({ pair = 'XBTUSD' }) => `https://api.kraken.com/0/public/Ticker?${new URLSearchParams({ pair: pair || 'XBTUSD' }).toString()}`,
  },
  {
    id: 'gitlab-public-projects', name: 'GitLab Public Projects', provider: 'GitLab', category: 'Developer',
    description: 'Discover public GitLab projects and compare stars, forks, activity, topics, and programming language.',
    documentationUrl: 'https://docs.gitlab.com/api/projects/', accent: '#fc6d26', monogram: 'GL',
    fields: [
      queryField({ label: 'Project search', defaultValue: 'artificial intelligence', placeholder: 'e.g. artificial intelligence', help: 'Search public project names, paths, and descriptions.' }),
      limitField({ label: 'Projects', defaultValue: '8', min: 1, max: 20, help: 'Return between 1 and 20 public projects.' }),
    ],
    buildUrl: ({ query = 'artificial intelligence', limit = '8' }) => {
      const safeLimit = clampInt(limit, 1, 20, 8)
      const params = new URLSearchParams({ visibility: 'public', search: query.trim() || 'artificial intelligence', order_by: 'star_count', sort: 'desc', per_page: String(safeLimit) })
      return `https://gitlab.com/api/v4/projects?${params.toString()}`
    },
  },
  {
    id: 'uk-police-street-crime', name: 'UK Street Crime', provider: 'UK Home Office', category: 'Government',
    description: 'Explore recent anonymised street-level crime categories around a selected UK coordinate.',
    documentationUrl: 'https://data.police.uk/docs/method/crime-street/', accent: '#1d4f91', monogram: 'UP', risk: 'Review',
    usageNote: 'Locations are anonymised by the source. Present the data as area-level context, not individual-level evidence.',
    fields: [
      ...latLongFields({
        latitude: { defaultValue: '51.5074', min: 49, max: 61, help: 'Choose a coordinate within the United Kingdom.' },
        longitude: { defaultValue: '-0.1278', min: -9, max: 3, help: 'Choose a coordinate within the United Kingdom.' },
      }),
      { id: 'category', label: 'Crime category', type: 'select', defaultValue: 'burglary', help: 'Filter the street-level dataset by category. A focused default keeps the demo response lightweight.', options: [
        { label: 'All crime', value: 'all-crime' }, { label: 'Anti-social behaviour', value: 'anti-social-behaviour' }, { label: 'Burglary', value: 'burglary' }, { label: 'Vehicle crime', value: 'vehicle-crime' }, { label: 'Violence and sexual offences', value: 'violent-crime' },
      ] },
    ],
    buildUrl: ({ latitude = '51.5074', longitude = '-0.1278', category = 'burglary' }) => `https://data.police.uk/api/crimes-street/${encode(category || 'burglary')}?${new URLSearchParams({ lat: latitude, lng: longitude }).toString()}`,
  },
  {
    id: 'open-brewery-directory', name: 'Open Brewery Directory', provider: 'Open Brewery DB', category: 'Food',
    description: 'Browse brewery locations, business types, websites, cities, states, and countries.',
    documentationUrl: 'https://www.openbrewerydb.org/documentation', accent: '#b7791f', monogram: 'BR',
    fields: [
      { id: 'country', label: 'Country', type: 'select', defaultValue: 'united_states', help: 'Filter the public brewery directory by country.', options: [
        { label: 'United States', value: 'united_states' }, { label: 'Ireland', value: 'ireland' }, { label: 'France', value: 'france' }, { label: 'South Korea', value: 'south_korea' },
      ] },
      { id: 'type', label: 'Brewery type', type: 'select', defaultValue: 'all', help: 'Optionally filter the business model.', options: [
        { label: 'All types', value: 'all' }, { label: 'Micro', value: 'micro' }, { label: 'Brewpub', value: 'brewpub' }, { label: 'Regional', value: 'regional' }, { label: 'Contract', value: 'contract' },
      ] },
    ],
    buildUrl: ({ country = 'united_states', type = 'all' }) => {
      const params = new URLSearchParams({ by_country: country || 'united_states', per_page: '8' })
      if (type !== 'all') params.set('by_type', type)
      return `https://api.openbrewerydb.org/v1/breweries?${params.toString()}`
    },
  },
  {
    id: 'rick-morty-characters', name: 'Rick and Morty Characters', provider: 'Rick and Morty API', category: 'Entertainment',
    description: 'Search characters and inspect species, status, origin, current location, images, and episode counts.',
    documentationUrl: 'https://rickandmortyapi.com/documentation/#character', accent: '#22a2bd', monogram: 'RM',
    fields: [
      { id: 'name', label: 'Character name', type: 'text', defaultValue: 'Rick', placeholder: 'e.g. Rick', help: 'Search character names using a partial match.' },
      { id: 'status', label: 'Status', type: 'select', defaultValue: 'all', help: 'Optionally filter characters by life status.', options: [
        { label: 'All statuses', value: 'all' }, { label: 'Alive', value: 'alive' }, { label: 'Dead', value: 'dead' }, { label: 'Unknown', value: 'unknown' },
      ] },
    ],
    buildUrl: ({ name = 'Rick', status = 'all' }) => {
      const params = new URLSearchParams({ name: name.trim() || 'Rick' })
      if (status !== 'all') params.set('status', status)
      return `https://rickandmortyapi.com/api/character?${params.toString()}`
    },
  },
  {
    id: 'wikimedia-pageviews', name: 'Wikimedia Pageviews', provider: 'Wikimedia Foundation', category: 'Knowledge',
    description: 'Chart daily Wikipedia article traffic across desktop, mobile web, and app access.',
    documentationUrl: 'https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html', accent: '#6366f1', monogram: 'PV',
    fields: [
      { id: 'article', label: 'Article title', type: 'text', defaultValue: 'Singapore', placeholder: 'e.g. Singapore', help: 'Use an English Wikipedia article title.' },
      { id: 'days', label: 'History days', type: 'number', defaultValue: '14', min: 7, max: 90, help: 'Chart between 7 and 90 completed days.' },
    ],
    buildUrl: ({ article = 'Singapore', days = '14' }) => {
      const safeDays = clampInt(days, 7, 90, 14)
      const end = daysAgo(1)
      const start = daysAgo(safeDays)
      const title = encode((article.trim() || 'Singapore').replace(/\s+/g, '_'))
      return `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/${title}/daily/${compactDate(start)}/${compactDate(end)}`
    },
  },
]

const verifiedKeylessApis: ApiDemo[] = [
  {
    id: 'openf1-historical', name: 'OpenF1 Race Sessions', provider: 'OpenF1', category: 'Sports',
    description: 'Explore completed Formula 1 race sessions, circuits, meeting names, dates, and session identifiers.',
    documentationUrl: 'https://openf1.org/docs/', accent: '#e10600', monogram: 'F1', risk: 'Review',
    usageNote: 'Historical sessions from 2023 onward are keyless. Real-time data requires a paid authenticated plan.',
    fields: [
      { id: 'season', label: 'Season', type: 'select', defaultValue: '2025', help: 'Choose a completed season available to anonymous users.', options: [{ label: '2025', value: '2025' }, { label: '2024', value: '2024' }, { label: '2023', value: '2023' }] },
      { id: 'country', label: 'Grand Prix country', type: 'select', defaultValue: 'Singapore', help: 'Filter the race-session calendar by country.', options: [{ label: 'Singapore', value: 'Singapore' }, { label: 'Monaco', value: 'Monaco' }, { label: 'Great Britain', value: 'Great Britain' }, { label: 'Japan', value: 'Japan' }, { label: 'Australia', value: 'Australia' }] },
    ],
    buildUrl: ({ season = '2025', country = 'Singapore' }) => `https://api.openf1.org/v1/sessions?${new URLSearchParams({ year: season || '2025', country_name: country || 'Singapore', session_name: 'Race' }).toString()}`,
  },
  {
    id: 'packagist-search', name: 'Packagist Package Search', provider: 'Packagist', category: 'Developer',
    description: 'Search Composer packages for metadata, stars, licenses, and source links.',
    documentationUrl: 'https://packagist.org/apidoc', accent: '#4f46e5', monogram: 'PKG',
    usageNote: 'Composer package records are keyless and community maintained. Keep automated crawls to a minimum.',
    fields: [
      queryField({ label: 'Package search', defaultValue: 'react', placeholder: 'e.g. react', help: 'Search package names and descriptions.' }),
      limitField({ label: 'Packages', defaultValue: '8', min: 1, max: 20, help: 'Return between 1 and 20 package records.' }),
    ],
    buildUrl: ({ query = 'react', count = '8' }) => {
      const safeCount = clampInt(count, 1, 20, 8)
      return `https://packagist.org/search.json?${new URLSearchParams({ q: query.trim() || 'react', per_page: String(safeCount) }).toString()}`
    },
  },
  {
    id: 'nhtsa-vehicle-recalls', name: 'NHTSA Vehicle Recalls', provider: 'NHTSA', category: 'Vehicle',
    description: 'Search U.S. vehicle recall campaigns by make, model, and year.',
    documentationUrl: 'https://www.nhtsa.gov/nhtsa-datasets-and-apis', accent: '#1f3fd4', monogram: 'NRC',
    fields: [
      { id: 'make', label: 'Vehicle make', type: 'text', defaultValue: 'honda', help: 'Use an American-style vehicle make such as Honda or Toyota.' },
      { id: 'model', label: 'Vehicle model', type: 'text', defaultValue: 'accord', help: 'Use a model name supported by the selected manufacturer.' },
      numberField('year', { label: 'Model year', defaultValue: '2020', min: 1949, max: localNow.getFullYear() + 1, help: 'Narrow by model year to reduce response size.' }),
    ],
    buildUrl: ({ make = 'honda', model = 'accord', year = '2020' }) => {
      const safeYear = clampInt(year, 1949, localNow.getFullYear() + 1, 2020)
      const query = new URLSearchParams({
        make: make.trim() || 'honda',
        model: model.trim() || 'accord',
        modelYear: String(safeYear),
        format: 'json',
      })
      return `https://api.nhtsa.gov/recalls/recallsByVehicle?${query.toString()}`
    },
  },
  {
    id: 'anilist-graphql', name: 'AniList Media Search', provider: 'AniList', category: 'Entertainment',
    description: 'Search anime and manga titles with status, year, score, formats, genres, and cover images.',
    documentationUrl: 'https://docs.anilist.co/guide/auth/', accent: '#2e51a2', monogram: 'ANI', method: 'POST', risk: 'Review',
    usageNote: 'AniList is public but may apply per-app usage controls. Keep calls burst-safe.',
    fields: [
      queryField({ label: 'Anime or manga search', defaultValue: 'Fullmetal Alchemist', placeholder: 'e.g. Fullmetal Alchemist', help: 'Search titles by English or romanized name.' }),
      { id: 'mediaType', label: 'Media type', type: 'select', defaultValue: 'ANIME', help: 'Search anime or manga media.', options: [{ label: 'Anime', value: 'ANIME' }, { label: 'Manga', value: 'MANGA' }] },
      { id: 'page', label: 'Page', type: 'number', defaultValue: '1', min: 1, max: 10, help: 'Return page 1 to 10.' },
      limitField({ label: 'Results', defaultValue: '6', min: 1, max: 20, help: 'Return between 1 and 20 records.' }),
    ],
    buildUrl: () => 'https://graphql.anilist.co',
    buildBody: ({ query = 'Fullmetal Alchemist', mediaType = 'ANIME', page = '1', count = '6' }) => ({
      query: `query ($search: String, $page: Int, $perPage: Int, $type: MediaType) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            perPage
            currentPage
            hasNextPage
            hasPreviousPage
          }
          media(search: $search, type: $type, sort: POPULARITY_DESC) {
            id
            title { romaji english native }
            format
            status
            type
            episodes
            startDate { year month day }
            genres
            averageScore
            description(asHtml: false)
            coverImage { medium large }
          }
        }
      }`,
      variables: {
        search: query.trim() || 'Fullmetal Alchemist',
        page: clampInt(page, 1, 10, 1),
        perPage: clampInt(count, 1, 20, 6),
        type: mediaType.toUpperCase() === 'MANGA' ? 'MANGA' : 'ANIME',
      },
    }),
  },
  {
    id: 'openverse-search', name: 'Openverse Media Search', provider: 'Openverse', category: 'Media',
    description: 'Search openly licensed images and audio by keyword, then reuse attribution-ready media results.',
    documentationUrl: 'https://docs.openverse.org', accent: '#24b1e0', monogram: 'OVR',
    usageNote: 'Always keep attribution and license text visible when presenting media.',
    fields: [
      queryField({ label: 'Media search', defaultValue: 'space', placeholder: 'e.g. moon', help: 'Search openly licensed media titles and descriptions.' }),
      { id: 'contentType', label: 'Media type', type: 'select', defaultValue: 'image', help: 'Query images or audio separately.', options: [{ label: 'Images', value: 'image' }, { label: 'Audio', value: 'audio' }] },
      limitField({ label: 'Results', defaultValue: '8', min: 1, max: 20, help: 'Return between 1 and 20 media records.' }),
    ],
    buildUrl: ({ query = 'space', contentType = 'image', count = '8' }) => {
      const safeCount = clampInt(count, 1, 20, 8)
      return `https://api.openverse.org/v1/${contentType === 'audio' ? 'audio' : 'images'}/?${new URLSearchParams({ q: query.trim() || 'space', page_size: String(safeCount), page: '1' }).toString()}`
    },
  },
  {
    id: 'apple-itunes-search', name: 'Apple iTunes Search', provider: 'Apple', category: 'Media',
    description: 'Search music and media from iTunes, including songs, artists, albums, podcasts, and media previews.',
    documentationUrl: 'https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html',
    accent: '#f4af3f', monogram: 'ITN',
    usageNote: 'Honor Apple attribution and preview usage terms for artwork and sample clips.',
    fields: [
      queryField({ label: 'Search term', defaultValue: 'Beatles', placeholder: 'e.g. Beatles', help: 'Search across iTunes public indexes.' }),
      { id: 'media', label: 'Media', type: 'select', defaultValue: 'music', help: 'Choose media category.', options: [{ label: 'Music', value: 'music' }, { label: 'Podcast', value: 'podcast' }] },
      { id: 'entity', label: 'Entity', type: 'text', defaultValue: 'song', placeholder: 'e.g. song', help: 'Use iTunes entity filters such as song, album, musicArtist.' },
      { id: 'country', label: 'Country', type: 'text', defaultValue: 'sg', placeholder: 'e.g. sg', help: 'Two-letter ISO country code for localized results.' },
      limitField({ label: 'Results', defaultValue: '8', min: 1, max: 20, help: 'Return between 1 and 20 results.' }),
    ],
    buildUrl: ({ query = 'Beatles', media = 'music', entity = 'song', country = 'sg', count = '8' }) => {
      const safeCount = clampInt(count, 1, 20, 8)
      return `https://itunes.apple.com/search?${new URLSearchParams({
        term: query.trim() || 'Beatles',
        media: media.trim() || 'music',
        entity: entity.trim() || 'song',
        country: country.trim() || 'sg',
        limit: String(safeCount),
      }).toString()}`
    },
  },
  {
    id: 'hebcal-calendar', name: 'Hebcal Calendar', provider: 'Hebcal', category: 'Calendar',
    description: 'Fetch Jewish holidays, observances, and date metadata across Gregorian or Hebrew calendars.',
    documentationUrl: 'https://www.hebcal.com/home/developer-apis', accent: '#9f7aea', monogram: 'HB',
    usageNote: 'Display license attribution where required for generated event and observance data.',
    fields: [
      { id: 'year', label: 'Hebrew year', type: 'number', defaultValue: '5786', min: 5700, max: 5800, help: 'Use a valid Hebrew year to center festival output.' },
      { id: 'month', label: 'Month', type: 'number', defaultValue: '0', min: 0, max: 13, help: 'Use 0 for full-year results.' },
      { id: 'type', label: 'Response mode', type: 'select', defaultValue: 'h', help: 'Return Jewish events in holiday-only or full daily mode.',
        options: [{ label: 'Hebrew month mode', value: 'h' }, { label: 'Holiday mode', value: 'h1' }, { label: 'Public events', value: 'h2' }, { label: 'Daily events', value: 'd' }],
      },
    ],
    buildUrl: ({ year = '5786', month = '0', type = 'h' }) => `https://www.hebcal.com/hebcal/?${new URLSearchParams({
      v: '1', cfg: 'json', year: String(clampInt(year, 5700, 5800, 5786)),
      month: String(clampInt(month, 0, 13, 0)),
      h: 'on',
      s: 'on',
      type,
      ny: 'on',
      ns: 'on',
    }).toString()}`,
  },
  {
    id: 'aladhan-prayer-times', name: 'AlAdhan Prayer Times', provider: 'Al-Adhan', category: 'Calendar',
    description: 'Return prayer timings, Hijri date metadata, and calculation data from coordinates.',
    documentationUrl: 'https://aladhan.com/prayer-times-api', accent: '#5a6ee1', monogram: 'ADH',
    usageNote: 'Use the coordinate endpoint with Method 11 for this catalog’s Singapore-style timing preset.',
    fields: [
      ...latLongFields({
        latitude: { defaultValue: '1.3521', help: 'Use a valid WGS84 latitude from -90 to 90.' },
        longitude: { defaultValue: '103.8198', help: 'Use a valid WGS84 longitude from -180 to 180.' },
      }),
      { id: 'method', label: 'Calculation method', type: 'number', defaultValue: '11', min: 0, max: 99, help: 'Method 11 is used in the catalog for Singapore-compatible timing behavior.' },
      { id: 'date', label: 'Date', type: 'text', defaultValue: today, help: 'Use YYYY-MM-DD, today, or tomorrow.' },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', method = '11', date = today }) => {
      const safeMethod = clampInt(method, 0, 99, 11)
      return `https://api.aladhan.com/v1/timings/${encode((date || today).trim() || today)}?${new URLSearchParams({
        latitude: latitude.trim() || '1.3521',
        longitude: longitude.trim() || '103.8198',
        method: String(safeMethod),
      }).toString()}`
    },
  },
  {
    id: 'jolpica-f1', name: 'Jolpica F1 Data', provider: 'Jolpica', category: 'Sports',
    description: 'Load Formula 1 season data including races, drivers, and constructors from the Ergast-compatible Jolpica API.',
    documentationUrl: 'https://github.com/jolpica/jolpica-f1/blob/main/docs/README.md', accent: '#e10600', monogram: 'JOL', risk: 'Review',
    fields: [
      { id: 'season', label: 'Season', type: 'select', defaultValue: '2025', help: 'Choose an F1 season.', options: [{ label: '2025', value: '2025' }, { label: '2024', value: '2024' }, { label: '2023', value: '2023' }] },
      { id: 'dataset', label: 'Dataset', type: 'select', defaultValue: 'drivers', help: 'Pick a public F1 data table.', options: [{ label: 'Drivers', value: 'drivers' }, { label: 'Constructors', value: 'constructors' }, { label: 'Races', value: 'races' }] },
      limitField({ label: 'Rows', defaultValue: '8', min: 1, max: 30, help: 'Return between 1 and 30 rows.' }),
    ],
    buildUrl: ({ season = '2025', dataset = 'drivers', count = '8' }) => {
      const safeCount = clampInt(count, 1, 30, 8)
      const safeDataset = ['drivers', 'constructors', 'races'].includes(dataset) ? dataset : 'drivers'
      return `https://api.jolpi.ca/ergast/f1/${season || '2025'}/${safeDataset}.json?${new URLSearchParams({ limit: String(safeCount) }).toString()}`
    },
  },
  {
    id: 'hn-search-algolia', name: 'HN Search', provider: 'Algolia', category: 'News',
    description: 'Search Hacker News stories and comments with scoring, points, and publication data.',
    documentationUrl: 'https://hn.algolia.com/api', accent: '#ff6600', monogram: 'HN',
    fields: [
      queryField({ label: 'Search term', defaultValue: 'OpenAI', placeholder: 'e.g. OpenAI', help: 'Search public Hacker News posts and comments.' }),
      { id: 'tag', label: 'Content type', type: 'select', defaultValue: 'story', help: 'Choose stories or comments.', options: [{ label: 'Stories', value: 'story' }, { label: 'Comments', value: 'comment' }, { label: 'Stories and comments', value: 'story,comment' }] },
      limitField({ label: 'Results', defaultValue: '6', min: 1, max: 20, help: 'Return between 1 and 20 search hits.' }),
    ],
    buildUrl: ({ query = 'OpenAI', tag = 'story', count = '6' }) => {
      const safeCount = clampInt(count, 1, 20, 6)
      return `https://hn.algolia.com/api/v1/search?${new URLSearchParams({ query: query.trim() || 'OpenAI', tags: tag || 'story', hitsPerPage: String(safeCount) }).toString()}`
    },
  },
  {
    id: 'bank-of-canada-valet', name: 'Bank of Canada Valet', provider: 'Bank of Canada', category: 'Finance',
    description: 'Read official BOC observations such as USD/CAD and interest-rate series.',
    documentationUrl: 'https://www.bankofcanada.ca/valet-api-how-to/', accent: '#0066cc', monogram: 'BOC', risk: 'Review',
    fields: [
      { id: 'series', label: 'Series', type: 'text', defaultValue: 'FXUSDCAD', placeholder: 'e.g. FXUSDCAD', help: 'Use a public Bank of Canada series code.' },
      { id: 'startDate', label: 'Start date', type: 'text', defaultValue: compactDate(daysAgo(30)), placeholder: 'YYYY-MM-DD', help: 'Use YYYY-MM-DD or YYYYMMDD.' },
      { id: 'endDate', label: 'End date', type: 'text', defaultValue: today, placeholder: 'YYYY-MM-DD', help: 'Use YYYY-MM-DD or YYYYMMDD.' },
    ],
    buildUrl: ({ series = 'FXUSDCAD', startDate = compactDate(daysAgo(30)), endDate = today }) => {
      const safeStart = (startDate || compactDate(daysAgo(30))).replace(/\D/g, '')
      const safeEnd = (endDate || today).replace(/\D/g, '')
      return `https://www.bankofcanada.ca/valet/observations/${encode(series || 'FXUSDCAD')}/json?${new URLSearchParams({ start_date: safeStart, end_date: safeEnd }).toString()}`
    },
  },
  {
    id: 'swiss-transit-connections', name: 'Swiss Transit Connections', provider: 'Swiss Mobility', category: 'Utility',
    description: 'Search Swiss public-transit connections by origin and destination with transfers and timing metadata.',
    documentationUrl: 'https://transport.opendata.ch/docs.html', accent: '#009966', monogram: 'SCT',
    fields: [
      { id: 'from', label: 'Origin', type: 'text', defaultValue: 'Zurich', placeholder: 'e.g. Zurich', help: 'Enter a station or place name.' },
      { id: 'to', label: 'Destination', type: 'text', defaultValue: 'Geneva', placeholder: 'e.g. Geneva', help: 'Enter a destination station or place name.' },
      limitField({ label: 'Connections', defaultValue: '6', min: 1, max: 10, help: 'Return between 1 and 10 connections.' }),
    ],
    buildUrl: ({ from = 'Zurich', to = 'Geneva', count = '6' }) => {
      const safeCount = clampInt(count, 1, 10, 6)
      return `https://transport.opendata.ch/v1/connections?${new URLSearchParams({ from: from.trim() || 'Zurich', to: to.trim() || 'Geneva', limit: String(safeCount) }).toString()}`
    },
  },
  {
    id: 'nasa-power-climate', name: 'NASA POWER Climate', provider: 'NASA POWER', category: 'Environment',
    description: 'Fetch climate and weather variables such as temperature, humidity, solar radiation, and precipitation.',
    documentationUrl: 'https://power.larc.nasa.gov/docs/', accent: '#0b3d91', monogram: 'PWR', risk: 'Review',
    fields: [
      ...latLongFields(),
      { id: 'startDate', label: 'Start date', type: 'text', defaultValue: compactDate(daysAgo(30)), placeholder: 'YYYY-MM-DD', help: 'Use YYYY-MM-DD or YYYYMMDD.' },
      { id: 'endDate', label: 'End date', type: 'text', defaultValue: today, placeholder: 'YYYY-MM-DD', help: 'Use YYYY-MM-DD or YYYYMMDD.' },
      { id: 'parameters', label: 'Parameters', type: 'text', defaultValue: 'T2M,PRECTOTCORR,WS10M,RH2M,ALLSKY_SFC_SW_DWN', help: 'Comma-separated POWER parameter codes.' },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', startDate = compactDate(daysAgo(30)), endDate = today, parameters = 'T2M,PRECTOTCORR,WS10M,RH2M,ALLSKY_SFC_SW_DWN' }) => {
      const safeStart = (startDate || compactDate(daysAgo(30))).replace(/\D/g, '')
      const safeEnd = (endDate || today).replace(/\D/g, '')
      return `https://power.larc.nasa.gov/api/temporal/daily/point?${new URLSearchParams({
        parameters: parameters.trim() || 'T2M,PRECTOTCORR,WS10M,RH2M,ALLSKY_SFC_SW_DWN',
        community: 'AG',
        latitude,
        longitude,
        start: safeStart,
        end: safeEnd,
        format: 'JSON',
      }).toString()}`
    },
  },
  {
    id: 'open-meteo-elevation', name: 'Open-Meteo Elevation', provider: 'Open-Meteo', category: 'Geo',
    description: 'Fetch terrain elevation in meters for selected coordinates from Open-Meteo’s global model.',
    documentationUrl: 'https://open-meteo.com/en/docs/elevation-api', accent: '#047857', monogram: 'ELV', usageNote: 'Use returned elevation for non-critical use. Data is typically around 90-metre terrain resolution.',
    fields: [
      ...latLongFields(),
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198' }) =>
      `https://api.open-meteo.com/v1/elevation?${new URLSearchParams({
        latitude: latitude || '1.3521',
        longitude: longitude || '103.8198',
        format: 'json',
      }).toString()}`,
  },
  {
    id: 'zippopotam-postcode', name: 'Zippopotam Postcode', provider: 'Zippopotam', category: 'Geo',
    description: 'Convert a country code and postal code into city, state, and coordinate metadata.',
    documentationUrl: 'https://api.zippopotam.us', accent: '#2d9cdb', monogram: 'ZIP', risk: 'Review',
    usageNote: 'Useful for form autofill and map context; keep requests focused to avoid unnecessary retries.',
    fields: [
      { id: 'country', label: 'Country code', type: 'text', defaultValue: 'us', placeholder: 'e.g. us', help: 'Use a supported two-letter ISO country code.' },
      { id: 'postalCode', label: 'Postcode', type: 'text', defaultValue: '10001', placeholder: 'e.g. 10001', help: 'Provide a supported country-specific postcode.' },
    ],
    buildUrl: ({ country = 'us', postalCode = '10001' }) =>
      `https://api.zippopotam.us/${encode((country || 'us').toLowerCase())}/${encode(postalCode || '10001')}`,
  },
  {
    id: 'irail-liveboard', name: 'Belgian Rail Liveboard', provider: 'iRail', category: 'Utility',
    description: 'Read live Belgian train departures or arrivals with platforms, delays, cancellations, and destinations.',
    documentationUrl: 'https://docs.irail.be/', accent: '#1257a6', monogram: 'IR',
    usageNote: 'Public community service. Keep requests user-driven and retain a modest refresh interval.',
    fields: [
      { id: 'station', label: 'Station', type: 'select', defaultValue: 'Brussels-South', help: 'Choose a Belgian railway station.', options: [{ label: 'Brussels-South', value: 'Brussels-South' }, { label: 'Gent-Sint-Pieters', value: 'Gent-Sint-Pieters' }, { label: 'Antwerpen-Centraal', value: 'Antwerpen-Centraal' }, { label: 'Brugge', value: 'Brugge' }] },
      { id: 'direction', label: 'Board direction', type: 'select', defaultValue: 'departure', help: 'Show departing or arriving services.', options: [{ label: 'Departures', value: 'departure' }, { label: 'Arrivals', value: 'arrival' }] },
    ],
    buildUrl: ({ station = 'Brussels-South', direction = 'departure' }) => `https://api.irail.be/liveboard/?${new URLSearchParams({ station: station || 'Brussels-South', format: 'json', lang: 'en', arrdep: direction || 'departure', alerts: 'false' }).toString()}`,
  },
  {
    id: 'spaceflight-news', name: 'Spaceflight News', provider: 'The Space Devs', category: 'News',
    description: 'Browse recent spaceflight reporting with publishers, summaries, images, publication dates, and related missions.',
    documentationUrl: 'https://api.spaceflightnewsapi.net/v4/docs/', accent: '#4f46e5', monogram: 'SN',
    fields: [
      queryField({ label: 'News search', defaultValue: 'NASA', placeholder: 'e.g. NASA', help: 'Search titles and summaries from indexed spaceflight publishers.' }),
      limitField({ label: 'Articles', defaultValue: '6', min: 1, max: 10, help: 'Return between 1 and 10 recent articles.' }),
    ],
    buildUrl: ({ query = 'NASA', limit = '6' }) => {
      const safeLimit = clampInt(limit, 1, 10, 6)
      return `https://api.spaceflightnewsapi.net/v4/articles/?${new URLSearchParams({ search: query.trim() || 'NASA', limit: String(safeLimit), ordering: '-published_at' }).toString()}`
    },
  },
  {
    id: 'launch-library-upcoming', name: 'Upcoming Space Launches', provider: 'The Space Devs', category: 'Calendar',
    description: 'Track upcoming rocket launches with mission, provider, pad, status, image, and scheduled launch time.',
    documentationUrl: 'https://thespacedevs.com/llapi', accent: '#0f766e', monogram: 'LL',
    usageNote: 'The anonymous service is limited to 15 requests per hour; avoid automatic polling.',
    fields: [
      queryField({ label: 'Launch search', defaultValue: 'SpaceX', placeholder: 'e.g. SpaceX', help: 'Filter upcoming launches by mission, rocket, or provider text.' }),
      limitField({ label: 'Launches', defaultValue: '4', min: 1, max: 6, help: 'Return between 1 and 6 upcoming launches.' }),
    ],
    buildUrl: ({ query = 'SpaceX', limit = '4' }) => {
      const safeLimit = clampInt(limit, 1, 6, 4)
      return `https://ll.thespacedevs.com/2.2.0/launch/upcoming/?${new URLSearchParams({ search: query.trim() || 'SpaceX', limit: String(safeLimit), ordering: 'net' }).toString()}`
    },
  },
  {
    id: 'wiktionary-entry', name: 'Wiktionary Definitions', provider: 'Wikimedia Foundation', category: 'Language',
    description: 'Look up structured English definitions, parts of speech, examples, related words, and language information.',
    documentationUrl: 'https://en.wiktionary.org/api/rest_v1/', accent: '#7c3aed', monogram: 'WK',
    fields: [{ id: 'word', label: 'English word', type: 'text', defaultValue: 'hello', placeholder: 'e.g. serendipity', help: 'Enter one English Wiktionary headword.' }],
    buildUrl: ({ word = 'hello' }) => `https://en.wiktionary.org/api/rest_v1/page/definition/${encode(word || 'hello')}`,
  },
  {
    id: 'animechan-random-quote', name: 'Anime Quote Generator', provider: 'AnimeChan', category: 'Entertainment',
    description: 'Generate an anime quote with its character and series metadata for cards, prompts, and entertainment demos.',
    documentationUrl: 'https://animechan.io/docs', accent: '#2e51a2', monogram: 'AC',
    usageNote: 'Public community service. Keep requests user-driven and avoid automated high-frequency refreshes.',
    fields: [],
    buildUrl: () => 'https://api.animechan.io/v1/quotes/random',
  },
  {
    id: 'jokeapi-safe', name: 'Safe Joke Generator', provider: 'JokeAPI', category: 'Games',
    description: 'Generate a safe joke with category, language, delivery style, and moderation flags.',
    documentationUrl: 'https://v2.jokeapi.dev/', accent: '#9333ea', monogram: 'JA',
    usageNote: 'Safe mode is always enabled. The anonymous service permits up to 120 requests per minute.',
    fields: [
      { id: 'category', label: 'Category', type: 'select', defaultValue: 'Programming', help: 'Choose a safe joke category.', options: [{ label: 'Programming', value: 'Programming' }, { label: 'Pun', value: 'Pun' }, { label: 'Miscellaneous', value: 'Misc' }, { label: 'Christmas', value: 'Christmas' }] },
      { id: 'type', label: 'Joke format', type: 'select', defaultValue: 'twopart', help: 'Return a one-line or setup-and-delivery joke.', options: [{ label: 'Setup and delivery', value: 'twopart' }, { label: 'Single line', value: 'single' }] },
    ],
    buildUrl: ({ category = 'Programming', type = 'twopart' }) => `https://v2.jokeapi.dev/joke/${encode(category || 'Programming')}?${new URLSearchParams({ safe_mode: '', type: type || 'twopart', amount: '1' }).toString().replace('safe_mode=', 'safe-mode')}`,
  },
  {
    id: 'dummyjson-recipes', name: 'Recipe Explorer', provider: 'DummyJSON', category: 'Food',
    description: 'Prototype a recipe application using structured ingredients, instructions, cuisine, ratings, and food imagery.',
    documentationUrl: 'https://dummyjson.com/docs/recipes', accent: '#ea580c', monogram: 'RE',
    usageNote: 'Synthetic test data intended for prototypes, demonstrations, and UI development.',
    fields: [
      queryField({ label: 'Recipe search', defaultValue: 'pasta', placeholder: 'e.g. pasta', help: 'Search recipe names and indexed recipe text.' }),
      limitField({ label: 'Recipes', defaultValue: '6', min: 1, max: 10, help: 'Return between 1 and 10 recipes.' }),
    ],
    buildUrl: ({ query = 'pasta', limit = '6' }) => {
      const safeLimit = clampInt(limit, 1, 10, 6)
      return `https://dummyjson.com/recipes/search?${new URLSearchParams({ q: query.trim() || 'pasta', limit: String(safeLimit) }).toString()}`
    },
  },
  {
    id: 'brasilapi-postcode', name: 'Brazil Postcode Explorer', provider: 'BrasilAPI', category: 'Geo',
    description: 'Resolve a Brazilian CEP into address, neighbourhood, city, state, timezone, provider, and coordinates.',
    documentationUrl: 'https://brasilapi.com.br/docs#tag/CEP-V2', accent: '#16a34a', monogram: 'BP',
    usageNote: 'User-driven lookups only. BrasilAPI prohibits automated crawling and full-range scans.',
    fields: [{ id: 'postcode', label: 'Brazilian CEP', type: 'text', defaultValue: '01310930', placeholder: 'e.g. 01310-930', help: 'Enter exactly eight digits, with or without a hyphen.' }],
    buildUrl: ({ postcode = '01310930' }) => `https://brasilapi.com.br/api/cep/v2/${encode((postcode || '01310930').replace(/\D/g, ''))}`,
  },
  {
    id: 'poetrydb-poems', name: 'PoetryDB Reader', provider: 'PoetryDB', category: 'Books',
    description: 'Read a small random selection of public-domain poems from a selected author with titles and full lines.',
    documentationUrl: 'https://github.com/thundercomb/poetrydb', accent: '#9f1239', monogram: 'PO',
    fields: [
      { id: 'author', label: 'Poet', type: 'select', defaultValue: 'Emily Dickinson', help: 'Choose a poet represented in PoetryDB.', options: [{ label: 'Emily Dickinson', value: 'Emily Dickinson' }, { label: 'William Shakespeare', value: 'William Shakespeare' }, { label: 'William Blake', value: 'William Blake' }, { label: 'Edgar Allan Poe', value: 'Edgar Allan Poe' }] },
      countField({ label: 'Poems', defaultValue: '3', min: 1, max: 4, help: 'Return between 1 and 4 randomly selected poems.' }),
    ],
    buildUrl: ({ author = 'Emily Dickinson', count = '3' }) => {
      const safeCount = clampInt(count, 1, 4, 3)
      return `https://poetrydb.org/author,random/${encode(author || 'Emily Dickinson')};${safeCount}/title,author,lines,linecount`
    },
  },
  {
    id: 'coingecko-keyless-market', name: 'CoinGecko Keyless Market', provider: 'CoinGecko', category: 'Finance',
    description: 'Read a keyless cryptocurrency price snapshot with market cap, 24-hour volume, and daily change.',
    documentationUrl: 'https://docs.coingecko.com/docs/keyless-public-api', accent: '#75b798', monogram: 'CG', risk: 'Review',
    usageNote: 'Shared public pool for light, non-commercial experimentation. Handle 429 responses with backoff.',
    fields: [
      { id: 'coin', label: 'Cryptocurrency', type: 'select', defaultValue: 'bitcoin', help: 'Choose one CoinGecko asset identifier.', options: [{ label: 'Bitcoin', value: 'bitcoin' }, { label: 'Ethereum', value: 'ethereum' }, { label: 'Solana', value: 'solana' }, { label: 'Dogecoin', value: 'dogecoin' }] },
      { id: 'currency', label: 'Quote currency', type: 'select', defaultValue: 'usd', help: 'Choose a supported quote currency.', options: [{ label: 'USD', value: 'usd' }, { label: 'SGD', value: 'sgd' }, { label: 'EUR', value: 'eur' }] },
    ],
    buildUrl: ({ coin = 'bitcoin', currency = 'usd' }) => `https://api.coingecko.com/api/v3/simple/price?${new URLSearchParams({ ids: coin || 'bitcoin', vs_currencies: currency || 'usd', include_market_cap: 'true', include_24hr_vol: 'true', include_24hr_change: 'true', include_last_updated_at: 'true' }).toString()}`,
  },
  {
    id: 'swapi-people', name: 'Star Wars People', provider: 'SWAPI', category: 'Entertainment',
    description: 'Search Star Wars characters and inspect species-era profile fields including birth year, homeworld, and films.',
    documentationUrl: 'https://swapi.dev/documentation', accent: '#ca8a04', monogram: 'SW',
    fields: [queryField({ label: 'Character search', defaultValue: 'Luke', placeholder: 'e.g. Luke', help: 'Search Star Wars character names.' })],
    buildUrl: ({ query = 'Luke' }) => `https://swapi.dev/api/people/?${new URLSearchParams({ search: query.trim() || 'Luke' }).toString()}`,
  },
  {
    id: 'malaysia-core-cpi', name: 'Malaysia Core CPI', provider: 'data.gov.my', category: 'Economy',
    description: 'Load Malaysia core CPI points for core inflation monitoring and public-price snapshots.',
    documentationUrl: 'https://data.gov.my/data-catalogue/cpi_core', accent: '#0284c7', monogram: 'MCC', risk: 'Review',
    usageNote: 'Retain official attribution for Malaysia Public Data when redisplaying records.',
    fields: [limitField({ label: 'Records', defaultValue: '12', min: 12, max: 120, help: 'Return between 12 and 120 rows.' })],
    buildUrl: ({ count = '12' }) => {
      const safeCount = clampInt(count, 12, 120, 12)
      return `https://api.data.gov.my/data-catalogue/?${new URLSearchParams({ id: 'cpi_core', limit: String(safeCount), sort: '-date' }).toString()}`
    },
  },
  {
    id: 'malaysia-household-income', name: 'Malaysia Household Income', provider: 'data.gov.my', category: 'Economy',
    description: 'Track Malaysian household income trends with household, mean, median, and distribution metadata.',
    documentationUrl: 'https://data.gov.my/data-catalogue/hh_income', accent: '#0369a1', monogram: 'MHI', risk: 'Review',
    usageNote: 'Retain official attribution for Malaysia Public Data when redisplaying records.',
    fields: [limitField({ label: 'Records', defaultValue: '10', min: 6, max: 120, help: 'Return between 6 and 120 rows.' })],
    buildUrl: ({ count = '10' }) => {
      const safeCount = clampInt(count, 6, 120, 10)
      return `https://api.data.gov.my/data-catalogue/?${new URLSearchParams({ id: 'hh_income', limit: String(safeCount), sort: '-date' }).toString()}`
    },
  },
  {
    id: 'malaysia-population', name: 'Malaysia Population', provider: 'data.gov.my', category: 'Economy',
    description: 'Retrieve Malaysia population and demographic breakdowns for age, gender, and ethnicity.',
    documentationUrl: 'https://data.gov.my/data-catalogue/population_malaysia', accent: '#0ea5e9', monogram: 'MPO', risk: 'Review',
    usageNote: 'Retain official attribution for Malaysia Public Data when redisplaying records.',
    fields: [limitField({ label: 'Records', defaultValue: '10', min: 6, max: 120, help: 'Return between 6 and 120 rows.' })],
    buildUrl: ({ count = '10' }) => {
      const safeCount = clampInt(count, 6, 120, 10)
      return `https://api.data.gov.my/data-catalogue/?${new URLSearchParams({ id: 'population_malaysia', limit: String(safeCount), sort: '-date' }).toString()}`
    },
  },
  {
    id: 'openfda-food-recalls', name: 'openFDA Food Recalls', provider: 'U.S. FDA', category: 'Food',
    description: 'Explore FDA food recall notices by product, manufacturer, reason, and enforcement event.',
    documentationUrl: 'https://open.fda.gov/apis/food/enforcement/', accent: '#4f46e5', monogram: 'OFR', risk: 'Review',
    fields: [
      queryField({ label: 'Recall search', defaultValue: 'peanut', placeholder: 'e.g. peanut', help: 'Search food recall text by product or recall reason.' }),
      limitField({ label: 'Records', defaultValue: '8', min: 1, max: 30, help: 'Return between 1 and 30 records.' }),
    ],
    buildUrl: ({ query = 'peanut', count = '8' }) => {
      const safeCount = clampInt(count, 1, 30, 8)
      return `https://api.fda.gov/food/enforcement.json?${new URLSearchParams({
        search: query.trim() || 'peanut',
        limit: String(safeCount),
      }).toString()}`
    },
  },
  {
    id: 'iconify-search', name: 'Iconify Search', provider: 'Iconify', category: 'Utility',
    description: 'Search open-source icon sets and metadata, including icon names and licensing for UI prototyping.',
    documentationUrl: 'https://iconify.design/docs/api/search.html', accent: '#7c3aed', monogram: 'ICS', usageNote: 'Show icon licensing and attribution context when exporting catalog entries.',
    fields: [
      queryField({ label: 'Icon keyword', defaultValue: 'home', placeholder: 'e.g. home', help: 'Search icon keywords across public sets.' }),
      limitField({ label: 'Icons', defaultValue: '12', min: 1, max: 60, help: 'Return between 1 and 60 results.' }),
    ],
    buildUrl: ({ query = 'home', count = '12' }) => {
      const safeCount = clampInt(count, 1, 60, 12)
      return `https://api.iconify.design/search?${new URLSearchParams({ query: query.trim() || 'home', limit: String(safeCount) }).toString()}`
    },
  },
  {
    id: 'homebrew-formula-json', name: 'Homebrew Formula JSON', provider: 'Homebrew', category: 'Developer',
    description: 'Inspect Homebrew formula and cask metadata, including versions, dependencies, and metadata fields.',
    documentationUrl: 'https://formulae.brew.sh/docs/api/', accent: '#ef4444', monogram: 'HBF',
    usageNote: 'Homebrew API is community-maintained; keep request volume low for reliability.',
    fields: [
      { id: 'formula', label: 'Formula or cask name', type: 'text', defaultValue: 'node', placeholder: 'e.g. node', help: 'Search by formula/cask package name.' },
      { id: 'collection', label: 'Collection', type: 'select', defaultValue: 'formula', help: 'Select Formula or Cask metadata source.',
        options: [{ label: 'Formula', value: 'formula' }, { label: 'Cask', value: 'cask' }] },
    ],
    buildUrl: ({ formula = 'node', collection = 'formula' }) => {
      const name = encode(formula || 'node')
      return collection === 'cask'
        ? `https://formulae.brew.sh/api/cask/${name}.json`
        : `https://formulae.brew.sh/api/formula/${name}.json`
    },
  },
  {
    id: 'npm-download-counts', name: 'npm Download Counts', provider: 'npm', category: 'Developer',
    description: 'Track npm package download counts via point windows suitable for popularity trend snapshots.',
    documentationUrl: 'https://github.com/npm/registry/blob/main/docs/download-counts.md', accent: '#dc2626', monogram: 'NDC',
    fields: [
      { id: 'packageName', label: 'Package name', type: 'text', defaultValue: 'react', placeholder: 'e.g. react', help: 'Use npm scope syntax if needed (left side only).' },
      { id: 'period', label: 'Window', type: 'select', defaultValue: 'last-week', help: 'Choose a point download period.',
        options: [{ label: 'Last week', value: 'last-week' }, { label: 'Last month', value: 'last-month' }, { label: 'Last day', value: 'last-day' }] },
    ],
    buildUrl: ({ packageName = 'react', period = 'last-week' }) => {
      const safePeriod = ['last-day', 'last-week', 'last-month'].includes(period) ? period : 'last-week'
      return `https://api.npmjs.org/downloads/point/${safePeriod}/${encode(packageName || 'react')}`
    },
  },
  {
    id: 'geoboundaries-admin-boundaries', name: 'geoBoundaries Admin Boundaries', provider: 'geoBoundaries', category: 'Geo',
    description: 'Load open administrative boundary downloads and GeoJSON polygons across official ADM levels.',
    documentationUrl: 'https://www.geoboundaries.org/api.html', accent: '#0369a1', monogram: 'GBD',
    usageNote: 'Use downloaded geometry data for informational map views and attribution surfaces.',
    fields: [
      { id: 'countryIso', label: 'Country ISO', type: 'text', defaultValue: 'SGP', min: 3, max: 3, help: 'Use a three-letter country code.' },
      { id: 'adminLevel', label: 'Admin level', type: 'select', defaultValue: 'ADM0', help: 'Choose the administrative level.',
        options: [{ label: 'ADM0', value: 'ADM0' }, { label: 'ADM1', value: 'ADM1' }, { label: 'ADM2', value: 'ADM2' }, { label: 'ADM3', value: 'ADM3' }] },
    ],
    buildUrl: ({ countryIso = 'SGP', adminLevel = 'ADM0' }) =>
      `https://www.geoboundaries.org/api/current/gbOpen/${encode((countryIso || 'SGP').toUpperCase())}/${encode(adminLevel || 'ADM0')}`,
  },
  {
    id: 'osrm-route', name: 'OSRM Route', provider: 'Project OSRM', category: 'Geo',
    description: 'Calculate route distance, duration, and turn-by-turn geometry on public roads from start to destination.',
    documentationUrl: 'https://github.com/Project-OSRM/osrm-backend', accent: '#0f766e', monogram: 'OSR',
    usageNote: 'Demonstration server is not production-grade; cache and throttle UI requests accordingly.',
    fields: [
      { id: 'startLatitude', label: 'Start latitude', type: 'number', defaultValue: '1.3521', min: -90, max: 90, help: 'Source latitude in degrees.' },
      { id: 'startLongitude', label: 'Start longitude', type: 'number', defaultValue: '103.8198', min: -180, max: 180, help: 'Source longitude in degrees.' },
      { id: 'endLatitude', label: 'End latitude', type: 'number', defaultValue: '1.290270', min: -90, max: 90, help: 'Destination latitude in degrees.' },
      { id: 'endLongitude', label: 'End longitude', type: 'number', defaultValue: '103.851959', min: -180, max: 180, help: 'Destination longitude in degrees.' },
      limitField({ label: 'Alternatives', defaultValue: '1', min: 1, max: 3, help: 'Request one to three route alternatives.' }),
    ],
    buildUrl: ({ startLatitude = '1.3521', startLongitude = '103.8198', endLatitude = '1.290270', endLongitude = '103.851959', count = '1' }) => {
      const safeStartLatitude = Number.parseFloat(startLatitude)
      const safeStartLongitude = Number.parseFloat(startLongitude)
      const safeEndLatitude = Number.parseFloat(endLatitude)
      const safeEndLongitude = Number.parseFloat(endLongitude)
      const safeAlternatives = clampInt(count, 1, 3, 1)
      const route = `${Number.isFinite(safeStartLongitude) ? safeStartLongitude : 103.8198},${Number.isFinite(safeStartLatitude) ? safeStartLatitude : 1.3521};${Number.isFinite(safeEndLongitude) ? safeEndLongitude : 103.851959},${Number.isFinite(safeEndLatitude) ? safeEndLatitude : 1.29027}`
      return `https://router.project-osrm.org/route/v1/driving/${route}?${new URLSearchParams({
        alternatives: String(safeAlternatives),
        geometries: 'geojson',
        overview: 'full',
        steps: 'true',
      }).toString()}`
    },
  },
  {
    id: 'opendota-pro-matches', name: 'OpenDota Matches', provider: 'OpenDota', category: 'Games',
    description: 'Pull professional Dota 2 matches with patch, league, and team metadata for esports dashboarding.',
    documentationUrl: 'https://docs.opendota.com/', accent: '#16a34a', monogram: 'ODT',
    fields: [limitField({ label: 'Matches', defaultValue: '8', min: 1, max: 20, help: 'Return between 1 and 20 matches.' })],
    buildUrl: ({ count = '8' }) => `https://api.opendota.com/api/proMatches?${new URLSearchParams({ limit: String(clampInt(count, 1, 20, 8)) }).toString()}`,
  },
  {
    id: 'openligadb-matches', name: 'OpenLigaDB', provider: 'OpenLigaDB', category: 'Sports',
    description: 'Read community football match schedules and outcomes from OpenLigaDB leagues.',
    documentationUrl: 'https://api.openligadb.de/', accent: '#0284c7', monogram: 'OLB',
    fields: [
      { id: 'league', label: 'League shortcut', type: 'text', defaultValue: 'bl1', placeholder: 'e.g. bl1', help: 'Use a short league identifier, such as bl1.' },
      { id: 'season', label: 'Season year', type: 'number', defaultValue: '2026', min: 2000, max: localNow.getFullYear() + 1, help: 'Use a full numeric season year.' },
    ],
    buildUrl: ({ league = 'bl1', season = '2026' }) => {
      const safeSeason = clampInt(season, 2000, localNow.getFullYear() + 1, 2026)
      return `https://api.openligadb.de/api/getmatchdata/${encode(league || 'bl1')}/${String(safeSeason)}`
    },
  },
  {
    id: 'uk-parliament-members', name: 'UK Parliament Members', provider: 'UK Parliament', category: 'Government',
    description: 'Search active MPs and Lords for current constituencies and party-group metadata.',
    documentationUrl: 'https://developer.parliament.uk/apis/members-overview', accent: '#7c3aed', monogram: 'UKM',
    fields: [
      queryField({ label: 'Member name', defaultValue: 'Rishi', placeholder: 'e.g. Rishi', help: 'Search member names from official directories.' }),
      limitField({ label: 'Members', defaultValue: '10', min: 1, max: 50, help: 'Return between 1 and 50 members.' }),
    ],
    buildUrl: ({ query = 'Rishi', count = '10' }) => {
      const safeCount = clampInt(count, 1, 50, 10)
      return `https://members-api.parliament.uk/api/Members/Search?${new URLSearchParams({
        name: query.trim() || 'Rishi',
        skip: '0',
        limit: String(safeCount),
      }).toString()}`
    },
  },
  {
    id: 'mlb-stats-api', name: 'MLB Stats', provider: 'MLB', category: 'Sports',
    description: 'Pull MLB schedule snapshots and scoreboard data for date-based sports viewing and trend surfaces.',
    documentationUrl: 'https://github.com/toddrob99/MLB-StatsAPI/wiki/Endpoints', accent: '#0891b2', monogram: 'MLBS', risk: 'Review',
    usageNote: 'Unofficial endpoint; MLB content terms apply',
    fields: [
      { id: 'date', label: 'Schedule date', type: 'text', defaultValue: today, placeholder: 'YYYY-MM-DD', help: 'Use a published game date (YYYY-MM-DD).' },
      { id: 'sportId', label: 'Sport ID', type: 'number', defaultValue: '1', min: 1, max: 20, help: 'Use 1 for MLB regular schedule snapshots.' },
      { id: 'teamId', label: 'Team ID', type: 'number', defaultValue: '', min: 1, max: 9999, help: 'Optional: filter by team ID.' },
    ],
    buildUrl: ({ date = today, sportId = '1', teamId = '' }) => {
      const targetDate = (date || today).slice(0, 10)
      const params = new URLSearchParams({
        sportId: String(clampInt(sportId, 1, 20, 1)),
        date: targetDate,
        hydrate: 'team,venue',
      })
      if (teamId && Number.parseInt(teamId, 10)) params.set('teamId', encode(teamId))
      return `https://statsapi.mlb.com/api/v1/schedule?${params.toString()}`
    },
  },
]

const verifiedExpansionApis: ApiDemo[] = [
  {
    id: 'google-dns-doh', name: 'Google DNS over HTTPS', provider: 'Google Public DNS', category: 'Developer',
    description: 'Resolve a domain name to its DNS records over HTTPS for developer troubleshooting and diagnostics.',
    documentationUrl: 'https://developers.google.com/speed/public-dns/docs/doh/json', accent: '#4285f4', monogram: 'DNS',
    fields: [
      { id: 'name', label: 'Domain name', type: 'text', defaultValue: 'example.com', placeholder: 'e.g. example.com', help: 'Enter a domain name to resolve.' },
      { id: 'type', label: 'Record type', type: 'select', defaultValue: 'A', help: 'Choose a DNS record type.', options: [
        { label: 'A (IPv4)', value: 'A' }, { label: 'AAAA (IPv6)', value: 'AAAA' }, { label: 'MX (Mail)', value: 'MX' },
        { label: 'TXT', value: 'TXT' }, { label: 'CNAME', value: 'CNAME' }, { label: 'NS', value: 'NS' },
      ] },
    ],
    buildUrl: ({ name = 'example.com', type = 'A' }) => `https://dns.google/resolve?${new URLSearchParams({ name: name.trim() || 'example.com', type: type || 'A' }).toString()}`,
  },
  {
    id: 'color-api', name: 'The Color API', provider: 'TheColorAPI', category: 'Utility',
    description: 'Convert a hex color into RGB, HSL, HSV, CMYK, a named color match, and a contrast recommendation.',
    documentationUrl: 'https://www.thecolorapi.com/docs', accent: '#24b1e0', monogram: 'HEX',
    fields: [{ id: 'hex', label: 'Hex color', type: 'text', defaultValue: '24B1E0', placeholder: 'e.g. 24B1E0', help: 'Enter a hex color with or without the leading #.' }],
    buildUrl: ({ hex = '24B1E0' }) => `https://www.thecolorapi.com/id?hex=${encode((hex || '24B1E0').replace(/^#/, ''))}`,
  },
  {
    id: 'nasa-image-search', name: 'NASA Image & Video Library', provider: 'NASA', category: 'Media',
    description: 'Search NASA imagery, video, and audio with titles, descriptions, and thumbnail links.',
    documentationUrl: 'https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf', accent: '#0b3d91', monogram: 'NASA',
    fields: [
      { id: 'query', label: 'Search term', type: 'text', defaultValue: 'moon', placeholder: 'e.g. moon', help: 'Search NASA media titles and descriptions.' },
      { id: 'mediaType', label: 'Media type', type: 'select', defaultValue: 'image', help: 'Filter by media type.', options: [{ label: 'Image', value: 'image' }, { label: 'Video', value: 'video' }, { label: 'Audio', value: 'audio' }] },
    ],
    buildUrl: ({ query = 'moon', mediaType = 'image' }) => `https://images-api.nasa.gov/search?${new URLSearchParams({ q: query.trim() || 'moon', media_type: mediaType || 'image' }).toString()}`,
  },
  {
    id: 'lichess-top-players', name: 'Lichess Top Players', provider: 'Lichess', category: 'Games',
    description: 'Browse the current Lichess leaderboard for a chosen time control, including titles and ratings.',
    documentationUrl: 'https://lichess.org/api', accent: '#3893e8', monogram: 'LI',
    usageNote: 'Public read-only endpoint. Keep requests serial and back off if you receive a 429 response.',
    fields: [
      { id: 'perfType', label: 'Time control', type: 'select', defaultValue: 'blitz', help: 'Choose a Lichess rating leaderboard.', options: [
        { label: 'Bullet', value: 'bullet' }, { label: 'Blitz', value: 'blitz' }, { label: 'Rapid', value: 'rapid' }, { label: 'Classical', value: 'classical' },
      ] },
      { id: 'count', label: 'Players', type: 'number', defaultValue: '5', min: 1, max: 10, help: 'Return between 1 and 10 top players.' },
    ],
    buildUrl: ({ perfType = 'blitz', count = '5' }) => {
      const safeCount = Math.min(10, Math.max(1, Number.parseInt(count, 10) || 5))
      return `https://lichess.org/api/player/top/${safeCount}/${encode(perfType || 'blitz')}`
    },
  },
  {
    id: 'pubmed-search', name: 'PubMed Search', provider: 'NCBI PubMed', category: 'Research',
    description: 'Search PubMed and return matching article identifiers along with the total result count.',
    documentationUrl: 'https://www.ncbi.nlm.nih.gov/books/NBK25499/', accent: '#20558a', monogram: 'PB',
    usageNote: 'Keyless requests are limited to about 3 per second. This search step returns PMIDs; open pubmed.ncbi.nlm.nih.gov/{id} for full articles.',
    fields: [
      { id: 'term', label: 'Search term', type: 'text', defaultValue: 'covid', placeholder: 'e.g. covid', help: 'Search PubMed indexed terms and MeSH headings.' },
      { id: 'retmax', label: 'Results', type: 'number', defaultValue: '5', min: 1, max: 10, help: 'Return between 1 and 10 article identifiers.' },
    ],
    buildUrl: ({ term = 'covid', retmax = '5' }) => {
      const safeRetmax = Math.min(10, Math.max(1, Number.parseInt(retmax, 10) || 5))
      return `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${new URLSearchParams({ db: 'pubmed', term: term.trim() || 'covid', retmode: 'json', retmax: String(safeRetmax) }).toString()}`
    },
  },
  {
    id: 'rxnorm-drug-search', name: 'RxNorm Drug Search', provider: 'U.S. National Library of Medicine', category: 'Health', risk: 'Review',
    description: 'Look up standardized drug names, brand products, and dosage forms from the RxNorm terminology.',
    documentationUrl: 'https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html', accent: '#0369a1', monogram: 'RX',
    usageNote: 'For terminology normalization demonstrations only. Never treat this response as medical or prescribing advice.',
    fields: [{ id: 'name', label: 'Drug name', type: 'text', defaultValue: 'ibuprofen', placeholder: 'e.g. ibuprofen', help: 'Enter a generic or brand drug name.' }],
    buildUrl: ({ name = 'ibuprofen' }) => `https://rxnav.nlm.nih.gov/REST/drugs.json?${new URLSearchParams({ name: name.trim() || 'ibuprofen' }).toString()}`,
  },
  {
    id: 'inaturalist-observations', name: 'iNaturalist Observations', provider: 'iNaturalist', category: 'Biodiversity',
    description: 'Browse real, photographed species observations with location, date, and taxonomy.',
    documentationUrl: 'https://www.inaturalist.org/pages/api+reference', accent: '#74ac00', monogram: 'INAT',
    fields: [
      { id: 'taxonName', label: 'Species search', type: 'text', defaultValue: 'Panthera', placeholder: 'e.g. Panthera', help: 'Search by scientific or common name.' },
      { id: 'perPage', label: 'Observations', type: 'number', defaultValue: '6', min: 1, max: 10, help: 'Return between 1 and 10 observations.' },
    ],
    buildUrl: ({ taxonName = 'Panthera', perPage = '6' }) => {
      const safePerPage = Math.min(10, Math.max(1, Number.parseInt(perPage, 10) || 6))
      return `https://api.inaturalist.org/v1/observations?${new URLSearchParams({ taxon_name: taxonName.trim() || 'Panthera', per_page: String(safePerPage), photos: 'true' }).toString()}`
    },
  },
]

const verifiedSecondExpansionApis: ApiDemo[] = [
  {
    id: 'first-epss', name: 'FIRST EPSS Score', provider: 'FIRST.org', category: 'Developer',
    description: 'Look up a CVE\'s Exploit Prediction Scoring System probability and percentile of real-world exploitation.',
    documentationUrl: 'https://www.first.org/epss/api', accent: '#b42318', monogram: 'EPS', risk: 'Review',
    usageNote: 'EPSS is a probability estimate, not a guarantee of exploitation. Use alongside CVSS and CISA KEV status.',
    fields: [{ id: 'cve', label: 'CVE identifier', type: 'text', defaultValue: 'CVE-2021-44228', placeholder: 'e.g. CVE-2021-44228', help: 'Enter a published CVE identifier (e.g. the Log4Shell CVE).' }],
    buildUrl: ({ cve = 'CVE-2021-44228' }) => `https://api.first.org/data/v1/epss?${new URLSearchParams({ cve: cve.trim() || 'CVE-2021-44228' }).toString()}`,
  },
  {
    id: 'endoflife-date', name: 'endoflife.date Lifecycle', provider: 'endoflife.date', category: 'Developer',
    description: 'Check release, support, and end-of-life dates for popular software products and runtimes.',
    documentationUrl: 'https://endoflife.date/docs/api/v1/', accent: '#0f766e', monogram: 'EOL',
    fields: [{ id: 'product', label: 'Product', type: 'select', defaultValue: 'nodejs', help: 'Choose a tracked product.', options: [
      { label: 'Node.js', value: 'nodejs' }, { label: 'Python', value: 'python' }, { label: 'PostgreSQL', value: 'postgresql' },
      { label: 'Ubuntu', value: 'ubuntu' }, { label: 'PHP', value: 'php' }, { label: 'Java (OpenJDK)', value: 'java' },
    ] }],
    buildUrl: ({ product = 'nodejs' }) => `https://endoflife.date/api/v1/products/${encode(product || 'nodejs')}`,
  },
  {
    id: 'deps-dev', name: 'deps.dev Package Insights', provider: 'Google Open Source Insights', category: 'Developer',
    description: 'Inspect a package\'s published versions, dependencies, licenses, and security advisories across ecosystems.',
    documentationUrl: 'https://docs.deps.dev/api/v3/', accent: '#4285f4', monogram: 'DD',
    fields: [
      { id: 'system', label: 'Package ecosystem', type: 'select', defaultValue: 'npm', help: 'Choose a package system.', options: [
        { label: 'npm', value: 'npm' }, { label: 'PyPI', value: 'pypi' }, { label: 'Maven', value: 'maven' }, { label: 'Go', value: 'go' }, { label: 'Cargo', value: 'cargo' },
      ] },
      { id: 'packageName', label: 'Package name', type: 'text', defaultValue: 'react', placeholder: 'e.g. react', help: 'Enter a package name for the selected ecosystem.' },
    ],
    buildUrl: ({ system = 'npm', packageName = 'react' }) => `https://api.deps.dev/v3/systems/${encode(system || 'npm')}/packages/${encode(packageName || 'react')}`,
  },
  {
    id: 'ecb-fx-rates', name: 'ECB Reference Rates', provider: 'European Central Bank', category: 'Finance',
    description: 'Read official European Central Bank daily reference exchange rates against the euro.',
    documentationUrl: 'https://data.ecb.europa.eu/help/api/overview', accent: '#003399', monogram: 'ECB',
    fields: [
      { id: 'currency', label: 'Currency', type: 'select', defaultValue: 'USD', help: 'Choose a currency quoted against EUR.', options: [
        { label: 'US Dollar', value: 'USD' }, { label: 'British Pound', value: 'GBP' }, { label: 'Japanese Yen', value: 'JPY' }, { label: 'Swiss Franc', value: 'CHF' }, { label: 'Singapore Dollar', value: 'SGD' },
      ] },
      { id: 'observations', label: 'History points', type: 'number', defaultValue: '30', min: 5, max: 90, help: 'Return between 5 and 90 recent daily observations.' },
    ],
    buildUrl: ({ currency = 'USD', observations = '30' }) => {
      const safeObservations = Math.min(90, Math.max(5, Number.parseInt(observations, 10) || 30))
      return `https://data-api.ecb.europa.eu/service/data/EXR/D.${encode(currency || 'USD')}.EUR.SP00.A?${new URLSearchParams({ format: 'jsondata', lastNObservations: String(safeObservations) }).toString()}`
    },
  },
  {
    id: 'un-sdg-goals', name: 'UN Sustainable Development Goals', provider: 'United Nations Statistics Division', category: 'Government',
    description: 'Browse the official list of United Nations Sustainable Development Goals with descriptions.',
    documentationUrl: 'https://unstats.un.org/SDGAPI/swagger/', accent: '#1cabe2', monogram: 'SDG',
    fields: [],
    buildUrl: () => 'https://unstats.un.org/SDGAPI/v1/sdg/Goal/List',
  },
  {
    id: 'datacite-search', name: 'DataCite DOI Search', provider: 'DataCite', category: 'Research',
    description: 'Search DOI records for research datasets, software, preprints, and publications.',
    documentationUrl: 'https://support.datacite.org/docs/api', accent: '#00b1e2', monogram: 'DC',
    fields: [
      { id: 'query', label: 'Research query', type: 'text', defaultValue: 'climate change', placeholder: 'e.g. climate change', help: 'Search DataCite-indexed titles and metadata.' },
      { id: 'count', label: 'Results', type: 'number', defaultValue: '5', min: 1, max: 10, help: 'Return between 1 and 10 DOI records.' },
    ],
    buildUrl: ({ query = 'climate change', count = '5' }) => {
      const safeCount = Math.min(10, Math.max(1, Number.parseInt(count, 10) || 5))
      return `https://api.datacite.org/dois?${new URLSearchParams({ query: query.trim() || 'climate change', 'page[size]': String(safeCount) }).toString()}`
    },
  },
  {
    id: 'ror-search', name: 'ROR Organization Registry', provider: 'Research Organization Registry', category: 'Research',
    description: 'Look up standardized identifiers, names, locations, and links for universities and research institutions.',
    documentationUrl: 'https://ror.readme.io/docs/rest-api', accent: '#1a4cb3', monogram: 'ROR',
    fields: [{ id: 'query', label: 'Organization search', type: 'text', defaultValue: 'stanford', placeholder: 'e.g. stanford', help: 'Search research organization names.' }],
    buildUrl: ({ query = 'stanford' }) => `https://api.ror.org/v2/organizations?${new URLSearchParams({ query: query.trim() || 'stanford' }).toString()}`,
  },
  {
    id: 'celestrak-satellites', name: 'CelesTrak Satellite Tracker', provider: 'CelesTrak', category: 'Geo',
    description: 'Browse orbital elements for the ISS, Starlink, GPS, and other active satellite groups.',
    documentationUrl: 'https://celestrak.org/NORAD/documentation/gp-data-formats.php', accent: '#111827', monogram: 'SAT',
    usageNote: 'CelesTrak refreshes group data roughly every two hours; avoid frequent automated polling.',
    fields: [{ id: 'group', label: 'Satellite group', type: 'select', defaultValue: 'stations', help: 'Choose a tracked satellite group.', options: [
      { label: 'Space stations', value: 'stations' }, { label: 'Starlink', value: 'starlink' }, { label: 'GPS operational', value: 'gps-ops' }, { label: 'Active satellites', value: 'active' },
    ] }],
    buildUrl: ({ group = 'stations' }) => `https://celestrak.org/NORAD/elements/gp.php?${new URLSearchParams({ GROUP: group || 'stations', FORMAT: 'json' }).toString()}`,
  },
  {
    id: 'musicbrainz-artist-search', name: 'MusicBrainz Artist Search', provider: 'MusicBrainz', category: 'Entertainment',
    description: 'Search the MusicBrainz open music encyclopedia for artists, origin, type, and active years.',
    documentationUrl: 'https://musicbrainz.org/doc/MusicBrainz_API', accent: '#ba478f', monogram: 'MB',
    usageNote: 'Browsers cannot set a custom User-Agent header; keep request volume light and non-commercial per MusicBrainz terms.',
    fields: [{ id: 'query', label: 'Artist search', type: 'text', defaultValue: 'queen', placeholder: 'e.g. queen', help: 'Search MusicBrainz artist names.' }],
    buildUrl: ({ query = 'queen' }) => `https://musicbrainz.org/ws/2/artist/?${new URLSearchParams({ query: query.trim() || 'queen', fmt: 'json' }).toString()}`,
  },
  {
    id: 'cleveland-museum-search', name: 'Cleveland Museum Open Access', provider: 'The Cleveland Museum of Art', category: 'Media',
    description: 'Search artwork records with high-resolution images released under the museum\'s open-access CC0 program.',
    documentationUrl: 'https://www.clevelandart.org/open-access-api', accent: '#8b1d3f', monogram: 'CMA',
    fields: [
      { id: 'query', label: 'Artwork search', type: 'text', defaultValue: 'monet', placeholder: 'e.g. monet', help: 'Search artwork titles, artists, or subjects.' },
      { id: 'limit', label: 'Results', type: 'number', defaultValue: '6', min: 1, max: 10, help: 'Return between 1 and 10 artworks.' },
    ],
    buildUrl: ({ query = 'monet', limit = '6' }) => {
      const safeLimit = Math.min(10, Math.max(1, Number.parseInt(limit, 10) || 6))
      return `https://openaccess-api.clevelandart.org/api/artworks?${new URLSearchParams({ q: query.trim() || 'monet', limit: String(safeLimit) }).toString()}`
    },
  },
  {
    id: 'scryfall-card-search', name: 'Scryfall Card Search', provider: 'Scryfall', category: 'Games',
    description: 'Search Magic: The Gathering cards with mana cost, type, set, and full card artwork.',
    documentationUrl: 'https://scryfall.com/docs/api', accent: '#f97316', monogram: 'MTG',
    fields: [{ id: 'query', label: 'Card search', type: 'text', defaultValue: 'dragon', placeholder: 'e.g. dragon', help: 'Search card names, types, or rules text.' }],
    buildUrl: ({ query = 'dragon' }) => `https://api.scryfall.com/cards/search?${new URLSearchParams({ q: query.trim() || 'dragon' }).toString()}`,
  },
  {
    id: 'dnd5e-spell-lookup', name: 'D&D 5e Spell Lookup', provider: 'D&D 5e API', category: 'Games',
    description: 'Look up a Dungeons & Dragons 5th edition spell with range, components, and effect description.',
    documentationUrl: 'https://www.dnd5eapi.co/docs/', accent: '#7c2d12', monogram: 'DND',
    fields: [{ id: 'spellIndex', label: 'Spell', type: 'text', defaultValue: 'fireball', placeholder: 'e.g. fireball', help: 'Enter a spell slug using lowercase and hyphens (e.g. magic-missile).' }],
    buildUrl: ({ spellIndex = 'fireball' }) => `https://www.dnd5eapi.co/api/2014/spells/${encode(spellIndex || 'fireball').toLowerCase()}`,
  },
  {
    id: 'qr-code-generator', name: 'QR Code Generator', provider: 'goQR.me', category: 'Utility',
    description: 'Generate a scannable QR code image for any text or URL, entirely from a GET request.',
    documentationUrl: 'https://goqr.me/api/', accent: '#111827', monogram: 'QR',
    usageNote: 'The response body is a binary PNG image, not JSON; the raw response tab shows a placeholder summary instead.',
    fields: [
      { id: 'data', label: 'Text or URL', type: 'text', defaultValue: 'https://example.com', placeholder: 'e.g. https://example.com', help: 'Enter the text or URL to encode.' },
      { id: 'size', label: 'Image size', type: 'select', defaultValue: '200x200', help: 'Choose the output image dimensions.', options: [{ label: '150 × 150', value: '150x150' }, { label: '200 × 200', value: '200x200' }, { label: '300 × 300', value: '300x300' }] },
    ],
    buildUrl: ({ data = 'https://example.com', size = '200x200' }) => `https://api.qrserver.com/v1/create-qr-code/?${new URLSearchParams({ data: data.trim() || 'https://example.com', size: size || '200x200' }).toString()}`,
    parseResponse: (text) => ({ note: 'Binary PNG image response — see the rendered QR code below.', approximateBytes: text.length }),
  },
  {
    id: 'where-the-iss-at', name: 'Where The ISS At', provider: 'Where The ISS At', category: 'Geo',
    description: 'Track the International Space Station\'s current latitude, longitude, altitude, and velocity.',
    documentationUrl: 'https://wheretheiss.at/w/developer', accent: '#0ea5e9', monogram: 'ISS',
    fields: [],
    buildUrl: () => 'https://api.wheretheiss.at/v1/satellites/25544',
  },
]

const verifiedThirdExpansionApis: ApiDemo[] = [
  {
    id: 'eurostat-population', name: 'Eurostat Population Statistics', provider: 'Eurostat', category: 'Economy',
    description: 'Read official European Union population figures by country and year from Eurostat.',
    documentationUrl: 'https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-getting-started', accent: '#003399', monogram: 'EU',
    fields: [
      { id: 'country', label: 'Country', type: 'select', defaultValue: 'DE', help: 'Choose an EU member state.', options: [
        { label: 'Germany', value: 'DE' }, { label: 'France', value: 'FR' }, { label: 'Italy', value: 'IT' }, { label: 'Spain', value: 'ES' }, { label: 'Netherlands', value: 'NL' },
      ] },
      { id: 'year', label: 'Reference year', type: 'number', defaultValue: '2023', min: 2010, max: 2023, help: 'Choose a year between 2010 and 2023.' },
    ],
    buildUrl: ({ country = 'DE', year = '2023' }) => {
      const safeYear = Math.min(2023, Math.max(2010, Number.parseInt(year, 10) || 2023))
      return `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_pjan?${new URLSearchParams({ format: 'JSON', geo: country || 'DE', sex: 'T', age: 'TOTAL', time: String(safeYear) }).toString()}`
    },
  },
  {
    id: 'bls-timeseries', name: 'BLS Labor Statistics', provider: 'U.S. Bureau of Labor Statistics', category: 'Economy',
    description: 'Read official U.S. economic time series including unemployment rate and consumer price index.',
    documentationUrl: 'https://www.bls.gov/developers/api_signature_v2.htm', accent: '#005ea2', monogram: 'BLS',
    fields: [{ id: 'seriesId', label: 'Series', type: 'select', defaultValue: 'LNS14000000', help: 'Choose a tracked BLS time series.', options: [
      { label: 'Unemployment rate', value: 'LNS14000000' }, { label: 'CPI — all items', value: 'CUUR0000SA0' }, { label: 'CPI — food', value: 'CUUR0000SAF1' },
    ] }],
    buildUrl: ({ seriesId = 'LNS14000000' }) => `https://api.bls.gov/publicAPI/v2/timeseries/data/${encode(seriesId || 'LNS14000000')}`,
  },
  {
    id: 'fema-disasters', name: 'FEMA Disaster Declarations', provider: 'FEMA OpenFEMA', category: 'Government',
    description: 'Browse recent United States federal disaster declarations by state and incident type.',
    documentationUrl: 'https://www.fema.gov/about/openfema/api', accent: '#1a4480', monogram: 'FEMA',
    fields: [{ id: 'limit', label: 'Declarations', type: 'number', defaultValue: '5', min: 1, max: 10, help: 'Return between 1 and 10 recent declarations.' }],
    buildUrl: ({ limit = '5' }) => {
      const safeLimit = Math.min(10, Math.max(1, Number.parseInt(limit, 10) || 5))
      return `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?${new URLSearchParams({ '$top': String(safeLimit), '$orderby': 'declarationDate desc' }).toString()}`
    },
  },
  {
    id: 'noaa-tides', name: 'NOAA Tides & Currents', provider: 'NOAA Tides and Currents', category: 'Weather',
    description: 'Read the latest observed water level from a United States coastal tide station.',
    documentationUrl: 'https://api.tidesandcurrents.noaa.gov/api/prod/', accent: '#0f6ba3', monogram: 'TIDE',
    fields: [{ id: 'station', label: 'Tide station', type: 'select', defaultValue: '8518750', help: 'Choose a NOAA tide station.', options: [
      { label: 'The Battery, NY', value: '8518750' }, { label: 'San Francisco, CA', value: '9414290' }, { label: 'Key West, FL', value: '8724580' },
    ] }],
    buildUrl: ({ station = '8518750' }) => `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${new URLSearchParams({ station: station || '8518750', product: 'water_level', date: 'latest', datum: 'MLLW', units: 'metric', time_zone: 'gmt', format: 'json' }).toString()}`,
  },
  {
    id: 'rdap-domain-lookup', name: 'RDAP Domain Lookup', provider: 'RDAP.org', category: 'Developer',
    description: 'Look up a domain\'s registration status, registrar, nameservers, and key events using the modern WHOIS replacement.',
    documentationUrl: 'https://about.rdap.org/', accent: '#111827', monogram: 'RDAP',
    fields: [{ id: 'domain', label: 'Domain name', type: 'text', defaultValue: 'google.com', placeholder: 'e.g. google.com', help: 'Enter a registered domain name.' }],
    buildUrl: ({ domain = 'google.com' }) => `https://rdap.org/domain/${encode(domain || 'google.com')}`,
  },
  {
    id: 'languagetool-grammar-check', name: 'LanguageTool Grammar Check', provider: 'LanguageTool', category: 'Language',
    description: 'Check English text for grammar, spelling, and style issues with rule-based suggestions.',
    documentationUrl: 'https://languagetool.org/http-api/', accent: '#39a845', monogram: 'LT',
    usageNote: 'Intended for interactive, human-driven checks. The free public service allows roughly 20 requests per minute.',
    fields: [{ id: 'text', label: 'Text to check', type: 'text', defaultValue: 'This are a test.', placeholder: 'e.g. This are a test.', help: 'Enter a short English sentence to check.' }],
    method: 'POST', bodyEncoding: 'form',
    buildUrl: () => 'https://api.languagetool.org/v2/check',
    buildBody: ({ text = 'This are a test.' }) => ({ text: text.trim() || 'This are a test.', language: 'en-US' }),
  },
  {
    id: 'zenodo-search', name: 'Zenodo Research Records', provider: 'Zenodo', category: 'Research',
    description: 'Search open-access papers, datasets, and software archived on Zenodo with DOIs and licenses.',
    documentationUrl: 'https://developers.zenodo.org/', accent: '#1e3d59', monogram: 'ZEN',
    fields: [
      { id: 'query', label: 'Research query', type: 'text', defaultValue: 'climate', placeholder: 'e.g. climate', help: 'Search Zenodo record titles and metadata.' },
      { id: 'count', label: 'Results', type: 'number', defaultValue: '5', min: 1, max: 10, help: 'Return between 1 and 10 records.' },
    ],
    buildUrl: ({ query = 'climate', count = '5' }) => {
      const safeCount = Math.min(10, Math.max(1, Number.parseInt(count, 10) || 5))
      return `https://zenodo.org/api/records?${new URLSearchParams({ q: query.trim() || 'climate', size: String(safeCount) }).toString()}`
    },
  },
  {
    id: 'doaj-search', name: 'DOAJ Open Access Articles', provider: 'Directory of Open Access Journals', category: 'Research',
    description: 'Search fully open-access journal articles with authors, journal, and identifiers.',
    documentationUrl: 'https://doaj.org/api/docs', accent: '#f68212', monogram: 'DOAJ',
    fields: [
      { id: 'query', label: 'Article search', type: 'text', defaultValue: 'climate', placeholder: 'e.g. climate', help: 'Search open-access article titles and metadata.' },
      { id: 'pageSize', label: 'Results', type: 'number', defaultValue: '5', min: 1, max: 10, help: 'Return between 1 and 10 articles.' },
    ],
    buildUrl: ({ query = 'climate', pageSize = '5' }) => {
      const safePageSize = Math.min(10, Math.max(1, Number.parseInt(pageSize, 10) || 5))
      return `https://doaj.org/api/search/articles/${encode(query.trim() || 'climate')}?${new URLSearchParams({ pageSize: String(safePageSize) }).toString()}`
    },
  },
  {
    id: 'pubchem-compound', name: 'PubChem Compound Lookup', provider: 'PubChem', category: 'Research',
    description: 'Look up a chemical compound\'s molecular formula, weight, and IUPAC name by common name.',
    documentationUrl: 'https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest-tutorial', accent: '#2e6da4', monogram: 'PCH',
    fields: [{ id: 'name', label: 'Compound name', type: 'text', defaultValue: 'aspirin', placeholder: 'e.g. aspirin', help: 'Enter a common chemical or drug name.' }],
    buildUrl: ({ name = 'aspirin' }) => `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encode(name || 'aspirin')}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`,
  },
  {
    id: 'chembl-molecule', name: 'ChEMBL Molecule Profile', provider: 'ChEMBL', category: 'Health', risk: 'Review',
    description: 'Inspect bioactivity-relevant molecule data including approval status, properties, and classifications.',
    documentationUrl: 'https://www.ebi.ac.uk/chembl/api/data/docs', accent: '#6a1b9a', monogram: 'CHM',
    usageNote: 'For research and education demonstrations only. Not a substitute for clinical or regulatory drug information.',
    fields: [{ id: 'chemblId', label: 'ChEMBL ID', type: 'text', defaultValue: 'CHEMBL25', placeholder: 'e.g. CHEMBL25', help: 'Enter a ChEMBL molecule identifier (CHEMBL25 is aspirin).' }],
    buildUrl: ({ chemblId = 'CHEMBL25' }) => `https://www.ebi.ac.uk/chembl/api/data/molecule/${encode(chemblId || 'CHEMBL25')}.json`,
  },
  {
    id: 'uniprot-protein', name: 'UniProt Protein Lookup', provider: 'UniProt', category: 'Research',
    description: 'Look up a protein\'s function, organism, gene, and annotation score by accession number.',
    documentationUrl: 'https://www.uniprot.org/help/api_queries', accent: '#00639c', monogram: 'UNI',
    fields: [{ id: 'accession', label: 'UniProt accession', type: 'text', defaultValue: 'P05067', placeholder: 'e.g. P05067', help: 'Enter a UniProtKB accession number.' }],
    buildUrl: ({ accession = 'P05067' }) => `https://rest.uniprot.org/uniprotkb/${encode(accession || 'P05067')}.json`,
  },
  {
    id: 'rcsb-pdb-entry', name: 'RCSB Protein Data Bank Entry', provider: 'RCSB PDB', category: 'Research',
    description: 'Inspect a solved protein structure\'s experimental method, authors, and publication details.',
    documentationUrl: 'https://data.rcsb.org/index.html', accent: '#4a4a4a', monogram: 'PDB',
    fields: [{ id: 'entryId', label: 'PDB entry ID', type: 'text', defaultValue: '4HHB', placeholder: 'e.g. 4HHB', help: 'Enter a four-character PDB structure identifier.' }],
    buildUrl: ({ entryId = '4HHB' }) => `https://data.rcsb.org/rest/v1/core/entry/${encode(entryId || '4HHB').toUpperCase()}`,
  },
  {
    id: 'ensembl-gene-lookup', name: 'Ensembl Gene Lookup', provider: 'Ensembl', category: 'Research',
    description: 'Look up a human gene\'s genomic location, biotype, and description by Ensembl identifier.',
    documentationUrl: 'https://rest.ensembl.org/documentation/info/lookup', accent: '#7a1fa2', monogram: 'ENS',
    fields: [{ id: 'geneId', label: 'Ensembl gene ID', type: 'text', defaultValue: 'ENSG00000157764', placeholder: 'e.g. ENSG00000157764', help: 'Enter an Ensembl gene identifier (default is BRAF).' }],
    buildUrl: ({ geneId = 'ENSG00000157764' }) => `https://rest.ensembl.org/lookup/id/${encode(geneId || 'ENSG00000157764')}?${new URLSearchParams({ 'content-type': 'application/json' }).toString()}`,
  },
  {
    id: 'obis-marine-occurrences', name: 'OBIS Marine Occurrences', provider: 'Ocean Biodiversity Information System', category: 'Biodiversity',
    description: 'Search real recorded occurrences of marine species by scientific name across global datasets.',
    documentationUrl: 'https://api.obis.org/', accent: '#0b6e99', monogram: 'OBIS',
    fields: [
      { id: 'scientificName', label: 'Species (scientific name)', type: 'text', defaultValue: 'Delphinus delphis', placeholder: 'e.g. Delphinus delphis', help: 'Enter a marine species scientific name.' },
      { id: 'size', label: 'Occurrences', type: 'number', defaultValue: '5', min: 1, max: 10, help: 'Return between 1 and 10 occurrence records.' },
    ],
    buildUrl: ({ scientificName = 'Delphinus delphis', size = '5' }) => {
      const safeSize = Math.min(10, Math.max(1, Number.parseInt(size, 10) || 5))
      return `https://api.obis.org/v3/occurrence?${new URLSearchParams({ scientificname: scientificName.trim() || 'Delphinus delphis', size: String(safeSize) }).toString()}`
    },
  },
  {
    id: 'worms-species-lookup', name: 'WoRMS Marine Species Registry', provider: 'World Register of Marine Species', category: 'Biodiversity',
    description: 'Look up the accepted taxonomy, rank, and authority for a marine species name.',
    documentationUrl: 'https://www.marinespecies.org/rest/', accent: '#0e7c86', monogram: 'WMS',
    fields: [{ id: 'name', label: 'Species (scientific name)', type: 'text', defaultValue: 'Delphinus delphis', placeholder: 'e.g. Delphinus delphis', help: 'Enter a marine species scientific name.' }],
    buildUrl: ({ name = 'Delphinus delphis' }) => `https://www.marinespecies.org/rest/AphiaRecordsByName/${encode(name || 'Delphinus delphis')}?${new URLSearchParams({ like: 'false' }).toString()}`,
  },
  {
    id: 'paleobiodb-taxa', name: 'Paleobiology Database Taxa', provider: 'Paleobiology Database', category: 'Nature',
    description: 'Look up a fossil taxon\'s rank, extinction status, and number of recorded occurrences.',
    documentationUrl: 'https://paleobiodb.org/data1.2/', accent: '#7a5230', monogram: 'PBDB',
    fields: [{ id: 'name', label: 'Taxon name', type: 'text', defaultValue: 'Tyrannosaurus', placeholder: 'e.g. Tyrannosaurus', help: 'Enter a genus or species name.' }],
    buildUrl: ({ name = 'Tyrannosaurus' }) => `https://paleobiodb.org/data1.2/taxa/list.json?${new URLSearchParams({ name: name.trim() || 'Tyrannosaurus', vocab: 'pbdb' }).toString()}`,
  },
  {
    id: 'usgs-water-legacy', name: 'USGS Water Data (Legacy)', provider: 'U.S. Geological Survey', category: 'Environment', risk: 'Review',
    description: 'Read the latest river gauge measurement from a United States water monitoring site.',
    documentationUrl: 'https://waterservices.usgs.gov/', accent: '#00264c', monogram: 'USGS',
    usageNote: 'This legacy USGS water service is scheduled for retirement in early 2027; migrate to the newer Water Data APIs when available.',
    fields: [{ id: 'site', label: 'Monitoring site', type: 'text', defaultValue: '01646500', placeholder: 'e.g. 01646500', help: 'Enter a USGS site number (default is the Potomac River near Washington, D.C.).' }],
    buildUrl: ({ site = '01646500' }) => `https://waterservices.usgs.gov/nwis/iv/?${new URLSearchParams({ sites: site.trim() || '01646500', format: 'json', siteStatus: 'all' }).toString()}`,
  },
  {
    id: 'crates-io-search', name: 'crates.io Package Lookup', provider: 'crates.io', category: 'Developer',
    description: 'Inspect a Rust crate\'s latest version, downloads, license, and repository links.',
    documentationUrl: 'https://crates.io/data-access', accent: '#f74c00', monogram: 'RS',
    fields: [{ id: 'crateName', label: 'Crate name', type: 'text', defaultValue: 'serde', placeholder: 'e.g. serde', help: 'Enter a published crates.io package name.' }],
    buildUrl: ({ crateName = 'serde' }) => `https://crates.io/api/v1/crates/${encode(crateName || 'serde')}`,
  },
  {
    id: 'rubygems-lookup', name: 'RubyGems Package Lookup', provider: 'RubyGems.org', category: 'Developer',
    description: 'Inspect a Ruby gem\'s latest version, downloads, authors, and license.',
    documentationUrl: 'https://guides.rubygems.org/rubygems-org-api/', accent: '#e9573f', monogram: 'GEM',
    fields: [{ id: 'gemName', label: 'Gem name', type: 'text', defaultValue: 'rails', placeholder: 'e.g. rails', help: 'Enter a published RubyGems package name.' }],
    buildUrl: ({ gemName = 'rails' }) => `https://rubygems.org/api/v1/gems/${encode(gemName || 'rails')}.json`,
  },
  {
    id: 'nuget-package-lookup', name: 'NuGet Package Lookup', provider: 'NuGet Gallery', category: 'Developer',
    description: 'Browse a .NET package\'s published version history from the NuGet registration catalog.',
    documentationUrl: 'https://learn.microsoft.com/nuget/api/overview', accent: '#004880', monogram: 'NUG',
    usageNote: 'Very actively maintained packages paginate their version history externally; this demo reads only the most recent inline page.',
    fields: [{ id: 'packageId', label: 'Package ID', type: 'text', defaultValue: 'newtonsoft.json', placeholder: 'e.g. newtonsoft.json', help: 'Enter a published NuGet package identifier.' }],
    buildUrl: ({ packageId = 'newtonsoft.json' }) => `https://api.nuget.org/v3/registration5-semver1/${encode((packageId || 'newtonsoft.json').toLowerCase())}/index.json`,
  },
  {
    id: 'internet-archive-search', name: 'Internet Archive Search', provider: 'Internet Archive', category: 'Media',
    description: 'Search millions of archived books, audio, video, and software items with cover thumbnails.',
    documentationUrl: 'https://archive.org/advancedsearch.php', accent: '#0b3c5d', monogram: 'IA',
    fields: [
      { id: 'query', label: 'Search term', type: 'text', defaultValue: 'singapore', placeholder: 'e.g. singapore', help: 'Search titles and descriptions across the archive.' },
      { id: 'mediaType', label: 'Media type', type: 'select', defaultValue: 'texts', help: 'Filter by archived media type.', options: [{ label: 'Texts & books', value: 'texts' }, { label: 'Audio', value: 'audio' }, { label: 'Movies', value: 'movies' }, { label: 'Software', value: 'software' }] },
    ],
    buildUrl: ({ query = 'singapore', mediaType = 'texts' }) => {
      const params = new URLSearchParams({ q: `${query.trim() || 'singapore'} AND mediatype:${mediaType || 'texts'}`, rows: '6', output: 'json' })
      params.append('fl[]', 'identifier'); params.append('fl[]', 'title'); params.append('fl[]', 'creator'); params.append('fl[]', 'date')
      return `https://archive.org/advancedsearch.php?${params.toString()}`
    },
  },
  {
    id: 'ipwhois-lookup', name: 'IPWhoIs Geolocation', provider: 'ipwho.is', category: 'Developer',
    description: 'Look up an IP address\'s country, region, city, timezone, and network provider.',
    documentationUrl: 'https://ipwho.is/documentation', accent: '#0f766e', monogram: 'GEO',
    usageNote: 'IP-based geolocation is approximate and reflects the network provider, not a precise personal address.',
    fields: [{ id: 'ip', label: 'IP address', type: 'text', defaultValue: '8.8.8.8', placeholder: 'e.g. 8.8.8.8', help: 'Enter a public IPv4 or IPv6 address.' }],
    buildUrl: ({ ip = '8.8.8.8' }) => `https://ipwho.is/${encode(ip || '8.8.8.8')}`,
  },
  {
    id: 'newton-math-solver', name: 'Newton Math Solver', provider: 'Newton API', category: 'Knowledge',
    description: 'Simplify, factor, derive, or solve a mathematical expression for education demos.',
    documentationUrl: 'https://newton.vercel.app/', accent: '#4c1d95', monogram: 'MATH', risk: 'Review',
    usageNote: 'A community-maintained service; treat as an education demo rather than a guaranteed-uptime dependency.',
    fields: [
      { id: 'operation', label: 'Operation', type: 'select', defaultValue: 'simplify', help: 'Choose a math operation.', options: [
        { label: 'Simplify', value: 'simplify' }, { label: 'Factor', value: 'factor' }, { label: 'Derive', value: 'derive' }, { label: 'Zeroes', value: 'zeroes' },
      ] },
      { id: 'expression', label: 'Expression', type: 'text', defaultValue: '2x+2x', placeholder: 'e.g. 2x+2x', help: 'Use ^ for powers and avoid spaces.' },
    ],
    buildUrl: ({ operation = 'simplify', expression = '2x+2x' }) => `https://newton.now.sh/api/v2/${encode(operation || 'simplify')}/${encode(expression || '2x+2x')}`,
  },
  {
    id: 'gutendex-books', name: 'Gutendex Book Search', provider: 'Gutendex (Project Gutenberg)', category: 'Books',
    description: 'Search public-domain books with authors, subjects, languages, and download formats.',
    documentationUrl: 'https://gutendex.com/', accent: '#5a3e2b', monogram: 'PG',
    fields: [{ id: 'search', label: 'Book search', type: 'text', defaultValue: 'shakespeare', placeholder: 'e.g. shakespeare', help: 'Search public-domain book titles and authors.' }],
    buildUrl: ({ search = 'shakespeare' }) => `https://gutendex.com/books?${new URLSearchParams({ search: search.trim() || 'shakespeare' }).toString()}`,
  },
  {
    id: 'datamuse-rhymes', name: 'Datamuse Word Finder', provider: 'Datamuse', category: 'Language',
    description: 'Find rhymes, related words, and spelling suggestions using the Datamuse word-relations engine.',
    documentationUrl: 'https://www.datamuse.com/api/', accent: '#be185d', monogram: 'DTM',
    fields: [{ id: 'word', label: 'Word to rhyme with', type: 'text', defaultValue: 'orange', placeholder: 'e.g. orange', help: 'Enter a word to find rhyming matches.' }],
    buildUrl: ({ word = 'orange' }) => `https://api.datamuse.com/words?${new URLSearchParams({ rel_rhy: word.trim() || 'orange' }).toString()}`,
  },
  {
    id: 'open5e-monster-search', name: 'Open5e Monster Search', provider: 'Open5e', category: 'Games',
    description: 'Search open-license tabletop RPG monsters with stat blocks, hit points, and armor class.',
    documentationUrl: 'https://open5e.com/api-docs', accent: '#166534', monogram: 'O5E',
    fields: [{ id: 'search', label: 'Monster search', type: 'text', defaultValue: 'dragon', placeholder: 'e.g. dragon', help: 'Search open-license monster names.' }],
    buildUrl: ({ search = 'dragon' }) => `https://api.open5e.com/v1/monsters/?${new URLSearchParams({ search: search.trim() || 'dragon' }).toString()}`,
  },
  {
    id: 'dicebear-avatar', name: 'DiceBear Avatar Generator', provider: 'DiceBear', category: 'Utility',
    description: 'Generate a deterministic SVG avatar from any seed text, useful for prototype user profiles.',
    documentationUrl: 'https://www.dicebear.com/', accent: '#f97316', monogram: 'AVA',
    fields: [
      { id: 'style', label: 'Avatar style', type: 'select', defaultValue: 'identicon', help: 'Choose a DiceBear avatar style.', options: [
        { label: 'Identicon', value: 'identicon' }, { label: 'Bottts', value: 'bottts' }, { label: 'Pixel art', value: 'pixel-art' }, { label: 'Thumbs', value: 'thumbs' },
      ] },
      { id: 'seed', label: 'Seed text', type: 'text', defaultValue: 'test', placeholder: 'e.g. test', help: 'Any text seed deterministically generates the same avatar.' },
    ],
    buildUrl: ({ style = 'identicon', seed = 'test' }) => `https://api.dicebear.com/9.x/${encode(style || 'identicon')}/svg?${new URLSearchParams({ seed: seed.trim() || 'test' }).toString()}`,
    parseResponse: (text) => ({ note: 'Raw SVG image response — see the rendered avatar below.', approximateBytes: text.length }),
  },
  {
    id: 'catfacts', name: 'Cat Facts Generator', provider: 'Cat Facts API', category: 'Nature',
    description: 'Generate a random, bite-sized fact about cats for lightweight content demos.',
    documentationUrl: 'https://catfact.ninja/', accent: '#ea580c', monogram: 'CAT',
    fields: [],
    buildUrl: () => 'https://catfact.ninja/fact',
  },
  {
    id: 'randomfox-photo', name: 'Random Fox Photo', provider: 'randomfox.ca', category: 'Nature',
    description: 'Fetch a random fox photograph, a lighter alternative to the existing dog photo gallery.',
    documentationUrl: 'https://randomfox.ca/', accent: '#c2410c', monogram: 'FOX',
    fields: [],
    buildUrl: () => 'https://randomfox.ca/floof',
  },
  {
    id: 'gleif-lei',
    name: 'GLEIF LEI Explorer',
    provider: 'GLEIF',
    category: 'Finance',
    description: 'Search official legal entities by name and review LEI status, headquarters, and parent/child relations.',
    documentationUrl: 'https://www.gleif.org/en/lei-data/access-and-use-lei-data',
    accent: '#0f7c90',
    monogram: 'GLE',
    fields: [
      { id: 'query', label: 'Legal name', type: 'text', defaultValue: 'Royal Bank of Canada', placeholder: 'e.g. Royal Bank', help: 'Enter a legal name fragment to search public LEI records.' },
      { id: 'count', label: 'Results', type: 'number', defaultValue: '8', min: 1, max: 50, help: 'Return between 1 and 50 records.' },
    ],
    buildUrl: ({ query = 'Royal Bank of Canada', count = '8' }) => {
      const safeCount = Math.min(50, Math.max(1, Number.parseInt(count, 10) || 8))
      return `https://api.gleif.org/api/v1/lei-records?${new URLSearchParams({
        'filter[entity.legalName]': query.trim() || 'Royal Bank of Canada',
        'page[size]': String(safeCount),
      }).toString()}`
    },
  },
  {
    id: 'fdic-bankfind',
    name: 'FDIC BankFind Suite',
    provider: 'FDIC',
    category: 'Finance',
    description: 'Inspect U.S. bank records, including assets, deposit volume, operation status, and branch history.',
    documentationUrl: 'https://api.fdic.gov/banks/docs',
    accent: '#0060a8',
    monogram: 'FDI',
    fields: [
      { id: 'bankName', label: 'Bank name', type: 'text', defaultValue: 'Wells Fargo', placeholder: 'e.g. Wells Fargo', help: 'Search FDIC bank metadata by public institution name.' },
      { id: 'count', label: 'Results', type: 'number', defaultValue: '6', min: 1, max: 20, help: 'Return between 1 and 20 institutions.' },
    ],
    buildUrl: ({ bankName = 'Wells Fargo', count = '6' }) => {
      const safeCount = Math.min(20, Math.max(1, Number.parseInt(count, 10) || 6))
      return `https://banks.data.fdic.gov/api/institutions?${new URLSearchParams({
        q: bankName.trim() || 'Wells Fargo',
        limit: String(safeCount),
        format: 'json',
      }).toString()}`
    },
  },
  {
    id: 'uk-food-hygiene',
    name: 'UK Food Hygiene Ratings',
    provider: 'Food Standards Agency',
    category: 'Food',
    description: 'Search establishments by name and retrieve hygiene, structural, and management scores plus service classification.',
    documentationUrl: 'https://api.ratings.food.gov.uk/help',
    accent: '#0b5f66',
    monogram: 'FKH',
    fields: [
      { id: 'name', label: 'Establishment name', type: 'text', defaultValue: 'Cafe', placeholder: 'e.g. Cafe', help: 'Search UK food businesses by name fragment.' },
      { id: 'count', label: 'Results', type: 'number', defaultValue: '5', min: 1, max: 50, help: 'Return between 1 and 50 establishments.' },
    ],
    headers: { 'x-api-version': '2' },
    buildUrl: ({ name = 'Cafe', count = '5' }) => {
      const safeCount = Math.min(50, Math.max(1, Number.parseInt(count, 10) || 5))
      return `https://api.ratings.food.gov.uk/Establishments?${new URLSearchParams({
        name: name.trim() || 'Cafe',
        pageSize: String(safeCount),
      }).toString()}`
    },
  },
  {
    id: 'uk-flood-monitoring',
    name: 'UK Flood Monitoring',
    provider: 'DEFRA',
    category: 'Environment',
    description: 'Query active flood stations and reading points, including alerts, flow, and water-level metadata.',
    documentationUrl: 'https://environment.data.gov.uk/flood-monitoring/doc/reference',
    accent: '#065f46',
    monogram: 'FLD',
    fields: [
      { id: 'query', label: 'Search keyword', type: 'text', defaultValue: 'river', placeholder: 'e.g. river', help: 'Search flood-monitoring stations by text keyword.' },
      { id: 'count', label: 'Stations', type: 'number', defaultValue: '8', min: 1, max: 50, help: 'Return between 1 and 50 station records.' },
    ],
    buildUrl: ({ query = 'river', count = '8' }) => {
      const safeCount = Math.min(50, Math.max(1, Number.parseInt(count, 10) || 8))
      return `https://environment.data.gov.uk/flood-monitoring/id/stations?${new URLSearchParams({
        q: query.trim() || 'river',
        _limit: String(safeCount),
      }).toString()}`
    },
  },
  {
    id: 'unhcr-refugees',
    name: 'UNHCR Refugee Statistics',
    provider: 'UNHCR',
    category: 'Data',
    description: 'Explore refuge and asylum-related humanitarian statistics with filters for origin country and reporting year.',
    documentationUrl: 'https://www.unhcr.org/refugee-statistics/insights/explainers/forcibly-displaced-api.html',
    accent: '#7c2d12',
    monogram: 'UNH',
    fields: [
      { id: 'country', label: 'Country', type: 'text', defaultValue: 'Syrian Arab Republic', placeholder: 'e.g. Syrian Arab Republic', help: 'Filter records by country naming string.' },
      { id: 'year', label: 'Year', type: 'number', defaultValue: '2026', min: 2010, max: 2026, help: 'Choose an annual snapshot year.' },
      { id: 'count', label: 'Results', type: 'number', defaultValue: '5', min: 1, max: 20, help: 'Return between 1 and 20 records.' },
    ],
    buildUrl: ({ country = 'Syrian Arab Republic', year = '2026', count = '5' }) => {
      const safeYear = Math.min(2026, Math.max(2010, Number.parseInt(year, 10) || 2026))
      const safeCount = Math.min(20, Math.max(1, Number.parseInt(count, 10) || 5))
      return `https://api.unhcr.org/population/v1/refugees?${new URLSearchParams({
        country: country.trim() || 'Syrian Arab Republic',
        year: String(safeYear),
        pageSize: String(safeCount),
      }).toString()}`
    },
  },
  {
    id: 'hdx-humanitarian-datasets',
    name: 'HDX Humanitarian Dataset Search',
    provider: 'Humanitarian Data Exchange',
    category: 'Data',
    description: 'Search discoverable humanitarian datasets and inspect ownership, formats, and licensing metadata.',
    documentationUrl: 'https://hdx-hapi.readthedocs.io/en/latest/data_usage_guides/metadata',
    accent: '#0369a1',
    monogram: 'HDX',
    fields: [
      { id: 'query', label: 'Topic or keyword', type: 'text', defaultValue: 'water', placeholder: 'e.g. water', help: 'Search humanitarian data by keyword or topic.' },
      { id: 'count', label: 'Results', type: 'number', defaultValue: '6', min: 1, max: 20, help: 'Return between 1 and 20 dataset records.' },
    ],
    buildUrl: ({ query = 'water', count = '6' }) => {
      const safeCount = Math.min(20, Math.max(1, Number.parseInt(count, 10) || 6))
      return `https://data.humdata.org/api/3/action/package_search?${new URLSearchParams({
        q: query.trim() || 'water',
        rows: String(safeCount),
      }).toString()}`
    },
  },
  {
    id: 'open-meteo-climate',
    name: 'Open-Meteo Climate',
    provider: 'Open-Meteo',
    category: 'Environment',
    description: 'Retrieve climate-model projections and historical climate indicators for a chosen location and period.',
    documentationUrl: 'https://open-meteo.com/en/docs/climate-api',
    accent: '#1d4ed8',
    monogram: 'CLM',
    fields: [
      ...latLongFields(),
      { id: 'startYear', label: 'Start year', type: 'number', defaultValue: '2020', min: 1950, max: 2050, help: 'Choose a projection window start year.' },
      { id: 'endYear', label: 'End year', type: 'number', defaultValue: '2026', min: 1950, max: 2050, help: 'Choose a projection window end year.' },
      { id: 'model', label: 'Model', type: 'select', defaultValue: 'ecmwf_ifs04', help: 'Select a climate model source.',
        options: [
          { label: 'ECMWF IFS 04', value: 'ecmwf_ifs04' },
          { label: 'NASA NEX-GDDP', value: 'nasa_nex_gddp' },
        ] },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', startYear = '2020', endYear = '2026', model = 'ecmwf_ifs04' }) => {
      const safeStartYear = Math.min(2050, Math.max(1950, Number.parseInt(startYear, 10) || 2020))
      const safeEndYear = Math.max(safeStartYear, Math.min(2050, Number.parseInt(endYear, 10) || 2026))
      return `https://climate-api.open-meteo.com/v1/climate?${new URLSearchParams({
        latitude: latitude || '1.3521',
        longitude: longitude || '103.8198',
        start_date: `${safeStartYear}-01-01`,
        end_date: `${safeEndYear}-12-31`,
        models: model,
        daily: 'temperature_2m_mean,precipitation_sum',
        format: 'json',
      }).toString()}`
    },
    usageNote: 'Use climate projections for decision support contexts only; retain model details when presenting outcomes.',
  },
  {
    id: 'models-dev',
    name: 'models.dev Model Registry',
    provider: 'models.dev',
    category: 'Developer',
    description: 'Search standardized AI model metadata and compare context limits, pricing model, API readiness, and modality details.',
    documentationUrl: 'https://github.com/sst/models.dev',
    accent: '#4f46e5',
    monogram: 'MDL',
    fields: [
      { id: 'query', label: 'Model search', type: 'text', defaultValue: 'gpt', placeholder: 'e.g. gpt', help: 'Search model name or family across providers.' },
      { id: 'count', label: 'Results', type: 'number', defaultValue: '8', min: 1, max: 25, help: 'Return between 1 and 25 models.' },
    ],
    buildUrl: ({ query = 'gpt', count = '8' }) => {
      const safeCount = Math.min(25, Math.max(1, Number.parseInt(count, 10) || 8))
      return `https://models.dev/api/v1/models?${new URLSearchParams({ q: query.trim() || 'gpt', limit: String(safeCount) }).toString()}`
    },
  },
  {
    id: 'vatcomply',
    name: 'VATComply API',
    provider: 'VATComply',
    category: 'Finance',
    description: 'Retrieve currency exchange rates, VAT-number checks, and IBAN validation helpers for lightweight compliance demos.',
    documentationUrl: 'https://api.vatcomply.com/docs',
    accent: '#7c3aed',
    monogram: 'VPC',
    fields: [
      { id: 'base', label: 'Base currency', type: 'text', defaultValue: 'EUR', placeholder: 'e.g. EUR', help: 'Choose the base currency for conversion output.' },
      { id: 'symbols', label: 'Target currencies', type: 'text', defaultValue: 'USD,SGD,GBP', placeholder: 'e.g. USD,SGD,GBP', help: 'Comma-separate up to ten currency codes.' },
    ],
    buildUrl: ({ base = 'EUR', symbols = 'USD,SGD,GBP' }) => `https://api.vatcomply.com/rates?${new URLSearchParams({ base: base.toUpperCase() || 'EUR', symbols }).toString()}`,
  },
  {
    id: 'mempool-space-btc',
    name: 'mempool.space Bitcoin',
    provider: 'mempool.space',
    category: 'Finance',
    description: 'Read Bitcoin mempool congestion, fee rates, and chain health signals from the public mempool service.',
    documentationUrl: 'https://mempool.space/docs/api/rest',
    accent: '#f59e0b',
    monogram: 'MPB',
    fields: [],
    buildUrl: () => 'https://mempool.space/api/v1/fees/recommended',
  },
  {
    id: 'metacpan',
    name: 'MetaCPAN API',
    provider: 'MetaCPAN',
    category: 'Developer',
    description: 'Search CPAN packages by module name, owner, release status, and ecosystem metadata.',
    documentationUrl: 'https://metacpan.org/pod/MetaCPAN::API',
    accent: '#1f2937',
    monogram: 'MCP',
    fields: [
      { id: 'query', label: 'Module search', type: 'text', defaultValue: 'Mojolicious', placeholder: 'e.g. Mojolicious', help: 'Search CPAN module and release records.' },
      { id: 'count', label: 'Results', type: 'number', defaultValue: '6', min: 1, max: 20, help: 'Return between 1 and 20 results.' },
    ],
    buildUrl: ({ query = 'Mojolicious', count = '6' }) => {
      const safeCount = Math.min(20, Math.max(1, Number.parseInt(count, 10) || 6))
      return `https://fastapi.metacpan.org/v1/module/_search?${new URLSearchParams({ q: query.trim() || 'Mojolicious', size: String(safeCount) }).toString()}`
    },
  },
  {
    id: 'hexpm',
    name: 'Hex.pm Package API',
    provider: 'Hex.pm',
    category: 'Developer',
    description: 'Fetch Elixir package metadata, maintainers, licensing, and versioning from the official package registry.',
    documentationUrl: 'https://hex.pm/docs/api',
    accent: '#0d9488',
    monogram: 'HXP',
    fields: [{ id: 'package', label: 'Package', type: 'text', defaultValue: 'ecto', placeholder: 'e.g. ecto', help: 'Enter an official Hex package name.' }],
    buildUrl: ({ package: packageName = 'ecto' }) => `https://hex.pm/api/packages/${encode(packageName.trim() || 'ecto')}`,
  },
  {
    id: 'pub-dev',
    name: 'pub.dev Package Search',
    provider: 'pub.dev',
    category: 'Developer',
    description: 'Search Dart and Flutter package metadata, pub scores, topics, and dependency relations.',
    documentationUrl: 'https://pub.dev/help/api',
    accent: '#0ea5e9',
    monogram: 'PUB',
    fields: [
      { id: 'query', label: 'Package search', type: 'text', defaultValue: 'flutter', placeholder: 'e.g. flutter', help: 'Search Dart and Flutter package names and summaries.' },
      { id: 'count', label: 'Results', type: 'number', defaultValue: '6', min: 1, max: 20, help: 'Return between 1 and 20 entries.' },
    ],
    buildUrl: ({ query = 'flutter', count = '6' }) => {
      const safeCount = Math.min(20, Math.max(1, Number.parseInt(count, 10) || 6))
      return `https://pub.dev/api/search?${new URLSearchParams({ q: query.trim() || 'flutter', pageSize: String(safeCount) }).toString()}`
    },
  },
  {
    id: 'go-module-proxy',
    name: 'Go Module Proxy',
    provider: 'Go',
    category: 'Developer',
    description: 'Read the official Go proxy module index for tags, versions, and latest release coordinates.',
    documentationUrl: 'https://go.dev/ref/mod',
    accent: '#6366f1',
    monogram: 'GOP',
    fields: [
      { id: 'module', label: 'Module path', type: 'text', defaultValue: 'github.com/gin-gonic/gin', placeholder: 'e.g. github.com/gin-gonic/gin', help: 'Enter a fully-qualified module path.' },
    ],
    buildUrl: ({ module = 'github.com/gin-gonic/gin' }) => {
      const modulePath = encode(module.trim() || 'github.com/gin-gonic/gin').replace(/%2F/g, '/')
      return `https://proxy.golang.org/${modulePath}/@v/list`
    },
  },
  {
    id: 'flathub-appstream',
    name: 'Flathub Appstream',
    provider: 'Flathub',
    category: 'Developer',
    description: 'Discover desktop applications with screenshots, license status, category tags, and installation metadata.',
    documentationUrl: 'https://docs.flathub.org/docs/for-app-authors/appstream/',
    accent: '#0f766e',
    monogram: 'FLA',
    fields: [
      { id: 'query', label: 'App search', type: 'text', defaultValue: 'org.gnome.Calculator', placeholder: 'e.g. org.gnome.Calculator', help: 'Search Flathub app identifiers or display names.' },
      { id: 'count', label: 'Results', type: 'number', defaultValue: '8', min: 1, max: 20, help: 'Return between 1 and 20 matches.' },
    ],
    buildUrl: ({ query = 'org.gnome.Calculator', count = '8' }) => {
      const safeCount = Math.min(20, Math.max(1, Number.parseInt(count, 10) || 8))
      return `https://flathub.org/api/v2/appstream?${new URLSearchParams({ q: query.trim() || 'org.gnome.Calculator', limit: String(safeCount) }).toString()}`
    },
  },
]

const verifiedFourthExpansionApis: ApiDemo[] = [
  {
    id: 'openssf-scorecard',
    name: 'OpenSSF Scorecard',
    provider: 'OpenSSF',
    category: 'Security',
    description: 'Review repository-level security scores, risk signals, and repository policy metadata from OpenSSF Scorecard.',
    documentationUrl: 'https://github.com/ossf/scorecard',
    accent: '#1d4ed8',
    monogram: 'OSS',
    usageNote: 'The score is heuristic; validate security posture independently before making operational decisions.',
    fields: [
      {
        id: 'repository',
        label: 'Repository',
        type: 'text',
        defaultValue: 'github.com/ossf/scorecard',
        placeholder: 'github.com/owner/repo',
        help: 'Enter owner/repo or a full github.com/owner/repo path.',
      },
    ],
    buildUrl: ({ repository = 'github.com/ossf/scorecard' }) => {
      const rawRepository = repository.trim() || 'github.com/ossf/scorecard'
      const normalizedRepository = rawRepository.replace(/^https?:\/\//, '').replace(/^www\./, '')
      const repoPath = normalizedRepository.includes('github.com/')
        ? normalizedRepository
        : `github.com/${normalizedRepository}`
      return `https://api.securityscorecards.dev/projects/${repoPath}`
    },
  },
  {
    id: 'opencitations-index',
    name: 'OpenCitations Index',
    provider: 'OpenCitations',
    category: 'Research',
    description: 'Look up citation links and citation counts for a DOI across the OpenCitations index.',
    documentationUrl: 'https://opencitations.net/index/api/v2',
    accent: '#0f766e',
    monogram: 'OCI',
    fields: [
      {
        id: 'doi',
        label: 'DOI',
        type: 'text',
        defaultValue: '10.1109/5.771073',
        placeholder: 'e.g. 10.1109/5.771073',
        help: 'Use a valid DOI string.',
      },
    ],
    buildUrl: ({ doi = '10.1109/5.771073' }) =>
      `https://opencitations.net/index/api/v2/citation/${encodeURIComponent(doi.trim() || '10.1109/5.771073')}?format=json`,
  },
  {
    id: 'vam-collections',
    name: 'V&A Collections',
    provider: 'V&A',
    category: 'Media',
    description: 'Browse artworks, objects, and exhibition-linked metadata from the V&A Collection API.',
    documentationUrl: 'https://developers.vam.ac.uk/guide/v2/',
    accent: '#b45309',
    monogram: 'VAM',
    fields: [
      {
        id: 'query',
        label: 'Collection search',
        type: 'text',
        defaultValue: 'eastern',
        placeholder: 'e.g. eastern',
        help: 'Search museum records by keyword.',
      },
      {
        id: 'count',
        label: 'Records',
        type: 'number',
        defaultValue: '6',
        min: 1,
        max: 20,
        help: 'Return between 1 and 20 records.',
      },
    ],
    buildUrl: ({ query = 'eastern', count = '6' }) => {
      const safeCount = Math.min(20, Math.max(1, Number.parseInt(count, 10) || 6))
      return `https://api.vam.ac.uk/v2/objects/search?${new URLSearchParams({
        q: query.trim() || 'eastern',
        page_size: String(safeCount),
      }).toString()}`
    },
  },
]

const publicApi200MilestoneApis: ApiDemo[] = [
  {
    id: 'github-global-advisories', name: 'GitHub Global Advisories', provider: 'GitHub', category: 'Security',
    description: 'Search GitHub-reviewed global security advisories by ecosystem and severity without authentication.',
    documentationUrl: 'https://docs.github.com/en/rest/security-advisories/global-advisories', accent: '#24292f', monogram: 'GHA',
    usageNote: 'Public global advisories are available without authentication. Keep anonymous request volume modest and review upstream package guidance before acting on a result.',
    fields: [
      { id: 'ecosystem', label: 'Ecosystem', type: 'select', defaultValue: 'npm', help: 'Filter advisories by package ecosystem.', options: [
        { label: 'npm', value: 'npm' }, { label: 'pip', value: 'pip' }, { label: 'Maven', value: 'maven' }, { label: 'NuGet', value: 'nuget' }, { label: 'RubyGems', value: 'rubygems' }, { label: 'Composer', value: 'composer' }, { label: 'Go', value: 'go' }, { label: 'Rust', value: 'rust' },
      ] },
      { id: 'severity', label: 'Severity', type: 'select', defaultValue: 'high', help: 'Filter by GitHub advisory severity.', options: [
        { label: 'Low', value: 'low' }, { label: 'Moderate', value: 'moderate' }, { label: 'High', value: 'high' }, { label: 'Critical', value: 'critical' },
      ] },
      limitField({ label: 'Advisories', defaultValue: '6', min: 1, max: 20, help: 'Return between 1 and 20 advisories.' }),
    ],
    headers: { Accept: 'application/vnd.github+json' },
    buildUrl: ({ ecosystem = 'npm', severity = 'high', limit = '6' }) => `https://api.github.com/advisories?${new URLSearchParams({ ecosystem, severity, per_page: String(clampInt(limit, 1, 20, 6)) }).toString()}`,
  },
  {
    id: 'dblp-search', name: 'DBLP Publication Search', provider: 'DBLP', category: 'Research',
    description: 'Search computer-science publications with authors, venues, years, and persistent bibliography links.',
    documentationUrl: 'https://dblp.org/faq/How+to+use+the+dblp+search+API.html', accent: '#1f6f8b', monogram: 'DBL',
    fields: [
      queryField({ label: 'Publication search', defaultValue: 'large language models', placeholder: 'e.g. retrieval augmented generation', help: 'Search publication titles, authors, and venue metadata.' }),
      limitField({ label: 'Results', defaultValue: '6', min: 1, max: 20, help: 'Return between 1 and 20 publication hits.' }),
    ],
    buildUrl: ({ query = 'large language models', limit = '6' }) => `https://dblp.org/search/publ/api?${new URLSearchParams({ q: query.trim() || 'large language models', h: String(clampInt(limit, 1, 20, 6)), format: 'json' }).toString()}`,
  },
  {
    id: 'citybikes-network', name: 'CityBikes Live Stations', provider: 'CityBikes', category: 'Geo',
    description: 'Inspect live bike-sharing stations, available bicycles, empty docks, and coordinates for a selected city network.',
    documentationUrl: 'https://api.citybik.es/v2/', accent: '#16a34a', monogram: 'CBK',
    usageNote: 'CityBikes documents a 300 requests/hour limit. Cache repeated network reads and avoid aggressive polling.',
    fields: [{ id: 'network', label: 'Bike network', type: 'select', defaultValue: 'youbike-taipei', help: 'Choose a public bike-sharing network.', options: [
      { label: 'Taipei · YouBike', value: 'youbike-taipei' }, { label: 'Paris · Vélib', value: 'velib' }, { label: 'London · Santander Cycles', value: 'santander-cycles' }, { label: 'New York · Citi Bike', value: 'citi-bike-nyc' }, { label: 'Barcelona · Bicing', value: 'bicing' },
    ] }],
    buildUrl: ({ network = 'youbike-taipei' }) => `https://api.citybik.es/v2/networks/${encode(network || 'youbike-taipei')}`,
  },
  {
    id: 'wikimedia-commons-search', name: 'Wikimedia Commons Search', provider: 'Wikimedia Foundation', category: 'Media',
    description: 'Search Wikimedia Commons files and return browser-ready thumbnails with license metadata.',
    documentationUrl: 'https://www.mediawiki.org/wiki/API:Main_page', accent: '#006699', monogram: 'WMC',
    usageNote: 'Respect the license and attribution metadata attached to each media result; Commons content does not share one universal license.',
    fields: [
      queryField({ label: 'Media search', defaultValue: 'Singapore skyline', placeholder: 'e.g. Singapore skyline', help: 'Search file titles and descriptions on Wikimedia Commons.' }),
      limitField({ label: 'Results', defaultValue: '6', min: 1, max: 12, help: 'Return between 1 and 12 media files.' }),
    ],
    buildUrl: ({ query = 'Singapore skyline', limit = '6' }) => `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: query.trim() || 'Singapore skyline', gsrnamespace: '6', gsrlimit: String(clampInt(limit, 1, 12, 6)), prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '400', format: 'json', origin: '*' }).toString()}`,
  },

  {
    id: 'nominatim-search', name: 'OpenStreetMap Nominatim', provider: 'OpenStreetMap', category: 'Geo',
    description: 'Geocode places and addresses into OpenStreetMap coordinates and structured address metadata.',
    documentationUrl: 'https://nominatim.org/release-docs/latest/api/Search/', accent: '#7ebc6f', monogram: 'NOM',
    usageNote: 'The public Nominatim service requires OpenStreetMap attribution, identifiable browser requests, and no more than one request per second. Do not use it for autocomplete or bulk geocoding.',
    fields: [
      queryField({ label: 'Place or address', defaultValue: 'Singapore', placeholder: 'e.g. Marina Bay Singapore', help: 'Enter a place, landmark, postal address, or locality.' }),
      limitField({ label: 'Results', defaultValue: '5', min: 1, max: 10, help: 'Return between 1 and 10 geocoding matches.' }),
    ],
    buildUrl: ({ query = 'Singapore', limit = '5' }) => `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: query.trim() || 'Singapore', format: 'jsonv2', limit: String(clampInt(limit, 1, 10, 5)), addressdetails: '1' }).toString()}`,
  },
  {
    id: 'jsdelivr-package', name: 'jsDelivr Package Metadata', provider: 'jsDelivr', category: 'Developer',
    description: 'Inspect npm package tags and published versions from the jsDelivr public package metadata API.',
    documentationUrl: 'https://www.jsdelivr.com/docs/data.jsdelivr.com', accent: '#f97316', monogram: 'JSD',
    fields: [{ id: 'packageName', label: 'npm package', type: 'text', defaultValue: 'react', placeholder: 'e.g. react', help: 'Enter an npm package name available through jsDelivr.' }],
    buildUrl: ({ packageName = 'react' }) => `https://data.jsdelivr.com/v1/package/npm/${encode(packageName.trim() || 'react')}`,
  },
  {
    id: 'canada-open-data-search', name: 'Canada Open Data Search', provider: 'Government of Canada', category: 'Government',
    description: 'Search Canada’s open-government dataset and publication catalogue through its CKAN API.',
    documentationUrl: 'https://open.canada.ca/en/access-our-application-programming-interface-api', accent: '#d52b1e', monogram: 'CAN',
    fields: [
      queryField({ label: 'Catalogue search', defaultValue: 'artificial intelligence', placeholder: 'e.g. artificial intelligence', help: 'Search Canadian datasets and publications by keyword.' }),
      limitField({ label: 'Results', defaultValue: '6', min: 1, max: 20, help: 'Return between 1 and 20 catalogue records.' }),
    ],
    buildUrl: ({ query = 'artificial intelligence', limit = '6' }) => `https://open.canada.ca/data/api/3/action/package_search?${new URLSearchParams({ q: query.trim() || 'artificial intelligence', rows: String(clampInt(limit, 1, 20, 6)) }).toString()}`,
  },
  {
    id: 'gbif-occurrence-search', name: 'GBIF Occurrence Search', provider: 'GBIF', category: 'Biodiversity',
    description: 'Find real-world biodiversity occurrence records with species, observation date, locality, and coordinates.',
    documentationUrl: 'https://techdocs.gbif.org/en/openapi/v1/occurrence', accent: '#65a30d', monogram: 'GBO',
    usageNote: 'Occurrence records come from many publishers with varying licences and data quality. Treat locations and identifications as source data rather than authoritative ground truth.',
    fields: [
      { id: 'scientificName', label: 'Scientific name', type: 'text', defaultValue: 'Panthera leo', placeholder: 'e.g. Panthera leo', help: 'Use a scientific species or taxon name.' },
      limitField({ label: 'Records', defaultValue: '6', min: 1, max: 20, help: 'Return between 1 and 20 occurrence records.' }),
    ],
    buildUrl: ({ scientificName = 'Panthera leo', limit = '6' }) => `https://api.gbif.org/v1/occurrence/search?${new URLSearchParams({ scientificName: scientificName.trim() || 'Panthera leo', limit: String(clampInt(limit, 1, 20, 6)) }).toString()}`,
  },

  {
    id: 'open-meteo-ensemble', name: 'Open-Meteo Ensemble Forecast', provider: 'Open-Meteo', category: 'Weather',
    description: 'Compare ensemble forecast members to understand uncertainty around temperature, rain, and wind predictions.',
    documentationUrl: 'https://open-meteo.com/en/docs/ensemble-api', accent: '#3b82f6', monogram: 'OME',
    usageNote: 'Ensemble members represent forecast uncertainty, not independent observations. Communicate the spread or range instead of treating any one member as certain.',
    fields: [
      ...latLongFields(),
      { id: 'variable', label: 'Forecast variable', type: 'select', defaultValue: 'temperature_2m', help: 'Choose the hourly quantity to compare across ensemble members.', options: [
        { label: 'Temperature · 2 m', value: 'temperature_2m' }, { label: 'Precipitation', value: 'precipitation' }, { label: 'Wind speed · 10 m', value: 'wind_speed_10m' },
      ] },
      { id: 'forecastDays', label: 'Forecast days', type: 'number', defaultValue: '3', min: 1, max: 7, help: 'Request between 1 and 7 forecast days.' },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', variable = 'temperature_2m', forecastDays = '3' }) => `https://ensemble-api.open-meteo.com/v1/ensemble?${new URLSearchParams({ latitude, longitude, hourly: variable, forecast_days: String(clampInt(forecastDays, 1, 7, 3)), timezone: 'Asia/Singapore' }).toString()}`,
  },
  {
    id: 'world-bank-indicator-explorer', name: 'World Bank Indicator Explorer', provider: 'World Bank', category: 'Economy',
    description: 'Explore selectable World Bank development indicators by country and year range instead of relying on one hard-coded series.',
    documentationUrl: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation', accent: '#1d4ed8', monogram: 'WBI',
    fields: [
      { id: 'country', label: 'Country code', type: 'text', defaultValue: 'SGP', placeholder: 'e.g. SGP', help: 'Use an ISO 2- or 3-letter country code.' },
      { id: 'indicator', label: 'Indicator', type: 'select', defaultValue: 'SP.DYN.LE00.IN', help: 'Choose a commonly used World Bank indicator.', options: [
        { label: 'Life expectancy', value: 'SP.DYN.LE00.IN' }, { label: 'GDP · current US$', value: 'NY.GDP.MKTP.CD' }, { label: 'GDP per capita · current US$', value: 'NY.GDP.PCAP.CD' }, { label: 'Population', value: 'SP.POP.TOTL' }, { label: 'Inflation · consumer prices %', value: 'FP.CPI.TOTL.ZG' }, { label: 'Unemployment · %', value: 'SL.UEM.TOTL.ZS' }, { label: 'Internet users · %', value: 'IT.NET.USER.ZS' },
      ] },
      { id: 'startYear', label: 'Start year', type: 'number', defaultValue: '2015', min: 1960, max: 2100, help: 'Beginning of the requested time series.' },
      { id: 'endYear', label: 'End year', type: 'number', defaultValue: '2025', min: 1960, max: 2100, help: 'End of the requested time series.' },
    ],
    buildUrl: ({ country = 'SGP', indicator = 'SP.DYN.LE00.IN', startYear = '2015', endYear = '2025' }) => {
      const safeStart = clampInt(startYear, 1960, 2100, 2015)
      const safeEnd = clampInt(endYear, 1960, 2100, 2025)
      const from = Math.min(safeStart, safeEnd)
      const to = Math.max(safeStart, safeEnd)
      return `https://api.worldbank.org/v2/country/${encode(country || 'SGP').toUpperCase()}/indicator/${encode(indicator || 'SP.DYN.LE00.IN')}?${new URLSearchParams({ format: 'json', date: `${from}:${to}`, per_page: '100' }).toString()}`
    },
  },
  {
    id: 'exchange-rate-current', name: 'Current FX Rates', provider: 'ExchangeRate-API', category: 'Finance',
    description: 'Read a current keyless exchange-rate table for a selected base currency.',
    documentationUrl: 'https://www.exchangerate-api.com/docs/free', accent: '#0f766e', monogram: 'ERX',
    usageNote: 'The open endpoint is intended for lightweight current-rate use. Review the provider terms before building financial or commercial decision systems around the feed.',
    fields: [{ id: 'base', label: 'Base currency', type: 'select', defaultValue: 'SGD', help: 'Choose the currency whose current cross-rates should be displayed.', options: [
      { label: 'SGD · Singapore Dollar', value: 'SGD' }, { label: 'MYR · Malaysian Ringgit', value: 'MYR' }, { label: 'USD · US Dollar', value: 'USD' }, { label: 'EUR · Euro', value: 'EUR' }, { label: 'GBP · Pound Sterling', value: 'GBP' }, { label: 'JPY · Japanese Yen', value: 'JPY' }, { label: 'AUD · Australian Dollar', value: 'AUD' },
    ] }],
    buildUrl: ({ base = 'SGD' }) => `https://open.er-api.com/v6/latest/${encode(base || 'SGD').toUpperCase()}`,
  },
  {
    id: 'circl-vulnerability', name: 'CIRCL Vulnerability Lookup', provider: 'CIRCL', category: 'Security',
    description: 'Fetch a normalized CVE 5 record from CIRCL Vulnerability-Lookup with CNA descriptions and affected products.',
    documentationUrl: 'https://vulnerability.circl.lu/api/', accent: '#7c3aed', monogram: 'CIR', risk: 'Review',
    usageNote: 'Use vulnerability records as investigation evidence, not as an automatic patching decision. Confirm affected versions and remediation guidance from the vendor or package ecosystem.',
    fields: [{ id: 'cve', label: 'CVE ID', type: 'text', defaultValue: 'CVE-2021-44228', placeholder: 'e.g. CVE-2021-44228', help: 'Enter a published CVE identifier.' }],
    buildUrl: ({ cve = 'CVE-2021-44228' }) => `https://vulnerability.circl.lu/api/cve/${encode(cve.trim().toUpperCase() || 'CVE-2021-44228')}`,
  },
]

export const apiCatalog: ApiDemo[] = [
  ...coreApis,
  ...additionalInteractiveApis,
  ...importedRecommendedApis,
  ...nextKeylessApis,
  ...verifiedKeylessApis,
  ...verifiedExpansionApis,
  ...verifiedSecondExpansionApis,
  ...verifiedThirdExpansionApis,
  ...verifiedFourthExpansionApis,
  ...publicApi200MilestoneApis,
]

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
