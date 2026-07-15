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
      { id: 'count', label: 'Results', type: 'number', defaultValue: '6', min: 1, max: 10, help: 'Return between 1 and 10 matching locations.' },
    ],
    buildUrl: ({ name = 'Singapore', count = '6' }) => {
      const safeCount = Math.min(10, Math.max(1, Number.parseInt(count, 10) || 6))
      const query = new URLSearchParams({ name: name.trim() || 'Singapore', count: String(safeCount), language: 'en', format: 'json' })
      return `https://geocoding-api.open-meteo.com/v1/search?${query.toString()}`
    },
  },
  {
    id: 'open-meteo-air-quality', name: 'Global Air Quality', provider: 'Open-Meteo', category: 'Environment',
    description: 'Read current AQI, particulate matter, nitrogen dioxide, and ozone for any coordinate.',
    documentationUrl: 'https://open-meteo.com/en/docs/air-quality-api', accent: '#0f9f8f', monogram: 'AQ',
    fields: [
      { id: 'latitude', label: 'Latitude', type: 'number', defaultValue: '1.3521', min: -90, max: 90, help: 'A WGS84 latitude from -90 to 90.' },
      { id: 'longitude', label: 'Longitude', type: 'number', defaultValue: '103.8198', min: -180, max: 180, help: 'A WGS84 longitude from -180 to 180.' },
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
      { id: 'latitude', label: 'Latitude', type: 'number', defaultValue: '1.3521', min: -90, max: 90, help: 'A latitude from -90 to 90.' },
      { id: 'longitude', label: 'Longitude', type: 'number', defaultValue: '103.8198', min: -180, max: 180, help: 'A longitude from -180 to 180.' },
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
      { id: 'limit', label: 'Events', type: 'number', defaultValue: '6', min: 1, max: 10, help: 'Return between 1 and 10 active events.' },
    ],
    buildUrl: ({ category = 'all', days = '30', limit = '6' }) => {
      const query = new URLSearchParams({ status: 'open', days: String(Math.min(365, Math.max(1, Number.parseInt(days, 10) || 30))), limit: String(Math.min(10, Math.max(1, Number.parseInt(limit, 10) || 6))) })
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
      const safeAmount = Math.min(10, Math.max(1, Number.parseInt(amount, 10) || 6))
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
  {
    id: 'malaysia-fuel-price', name: 'Malaysia Fuel Price', provider: 'data.gov.my', category: 'Finance',
    description: 'Compare Malaysia’s weekly RON95, RON97, diesel, and targeted-subsidy fuel prices.',
    documentationUrl: 'https://data.gov.my/data-catalogue/fuelprice', accent: '#d9485f', monogram: 'MY',
    usageNote: 'Official open data licensed under CC BY 4.0. Keep data.gov.my attribution visible when republishing the results.',
    fields: [
      { id: 'limit', label: 'History rows', type: 'number', defaultValue: '52', min: 12, max: 104, help: 'Each week can include a price level and a weekly-change row.' },
    ],
    buildUrl: ({ limit = '52' }) => {
      const safeLimit = Math.min(104, Math.max(12, Number.parseInt(limit, 10) || 52))
      return `https://api.data.gov.my/data-catalogue/?id=fuelprice&limit=${safeLimit}&sort=-date`
    },
  },
  {
    id: 'open-meteo-marine', name: 'Marine Weather', provider: 'Open-Meteo', category: 'Weather',
    description: 'Inspect wave height, period, direction, sea temperature, and ocean currents for coastal demos.',
    documentationUrl: 'https://open-meteo.com/en/docs/marine-weather-api', accent: '#087ea4', monogram: 'MW', risk: 'Review',
    usageNote: 'Open-Meteo attribution is required. Forecasts are not suitable for coastal navigation or safety-critical decisions.',
    fields: [
      { id: 'latitude', label: 'Latitude', type: 'number', defaultValue: '1.3521', min: -90, max: 90, help: 'A WGS84 latitude from -90 to 90.' },
      { id: 'longitude', label: 'Longitude', type: 'number', defaultValue: '103.8198', min: -180, max: 180, help: 'A WGS84 longitude from -180 to 180.' },
      { id: 'days', label: 'Forecast days', type: 'number', defaultValue: '3', min: 1, max: 7, help: 'Return between 1 and 7 forecast days.' },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', days = '3' }) => {
      const safeDays = Math.min(7, Math.max(1, Number.parseInt(days, 10) || 3))
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
    documentationUrl: 'https://www.nobelprize.org/about/developer-zone-2/', accent: '#a66b18', monogram: 'NP',
    usageNote: 'Uses the official Nobel Prize API. Follow the linked API terms and licence when republishing data.',
    fields: [
      { id: 'category', label: 'Prize category', type: 'select', defaultValue: 'phy', help: 'Choose a Nobel Prize category.', options: [
        { label: 'Physics', value: 'phy' }, { label: 'Chemistry', value: 'che' }, { label: 'Physiology or Medicine', value: 'med' },
        { label: 'Literature', value: 'lit' }, { label: 'Peace', value: 'pea' }, { label: 'Economic Sciences', value: 'eco' },
      ] },
      { id: 'limit', label: 'Prize years', type: 'number', defaultValue: '6', min: 1, max: 12, help: 'Return between 1 and 12 recent prize records.' },
    ],
    buildUrl: ({ category = 'phy', limit = '6' }) => {
      const safeLimit = Math.min(12, Math.max(1, Number.parseInt(limit, 10) || 6))
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
      { id: 'query', label: 'Research query', type: 'text', defaultValue: 'agentic AI', placeholder: 'e.g. climate adaptation', help: 'Search titles, authors, abstracts, and other Crossref metadata.' },
      { id: 'rows', label: 'Results', type: 'number', defaultValue: '8', min: 1, max: 20, help: 'Return between 1 and 20 works.' },
    ],
    buildUrl: ({ query = 'agentic AI', rows = '8' }) => {
      const safeRows = Math.min(20, Math.max(1, Number.parseInt(rows, 10) || 8))
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
    accent: '#0b5cab', monogram: 'SW', usageNote: 'Official NOAA operational data. Treat forecasts as guidance and retain NOAA attribution.',
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
      { id: 'query', label: 'Search term', type: 'text', defaultValue: 'artificial intelligence', placeholder: 'e.g. artificial intelligence', help: 'Search document titles and indexed Federal Register content.' },
      { id: 'limit', label: 'Documents', type: 'number', defaultValue: '8', min: 1, max: 20, help: 'Return between 1 and 20 recent documents.' },
    ],
    buildUrl: ({ query = 'artificial intelligence', limit = '8' }) => {
      const safeLimit = Math.min(20, Math.max(1, Number.parseInt(limit, 10) || 8))
      const params = new URLSearchParams({ per_page: String(safeLimit), order: 'newest', 'conditions[term]': query.trim() || 'artificial intelligence' })
      return `https://www.federalregister.gov/api/v1/documents.json?${params.toString()}`
    },
  },
  {
    id: 'wikipedia-search', name: 'Wikipedia Search', provider: 'Wikimedia Foundation', category: 'Knowledge',
    description: 'Search Wikipedia and return article extracts, thumbnails, page identifiers, and canonical titles.',
    documentationUrl: 'https://www.mediawiki.org/wiki/API:Search', accent: '#202122', monogram: 'WP',
    fields: [
      { id: 'query', label: 'Article search', type: 'text', defaultValue: 'Singapore', placeholder: 'e.g. Singapore', help: 'Search English Wikipedia titles and article text.' },
      { id: 'limit', label: 'Results', type: 'number', defaultValue: '8', min: 1, max: 12, help: 'Return between 1 and 12 matching pages.' },
    ],
    buildUrl: ({ query = 'Singapore', limit = '8' }) => {
      const safeLimit = Math.min(12, Math.max(1, Number.parseInt(limit, 10) || 8))
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
      { id: 'latitude', label: 'Latitude', type: 'number', defaultValue: '1.3521', min: -90, max: 90, help: 'A WGS84 latitude from -90 to 90.' },
      { id: 'longitude', label: 'Longitude', type: 'number', defaultValue: '103.8198', min: -180, max: 180, help: 'A WGS84 longitude from -180 to 180.' },
      { id: 'days', label: 'Forecast days', type: 'number', defaultValue: '7', min: 1, max: 30, help: 'Return between 1 and 30 daily discharge values.' },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', days = '7' }) => {
      const safeDays = Math.min(30, Math.max(1, Number.parseInt(days, 10) || 7))
      const params = new URLSearchParams({ latitude, longitude, daily: 'river_discharge,river_discharge_mean,river_discharge_max', forecast_days: String(safeDays) })
      return `https://flood-api.open-meteo.com/v1/flood?${params.toString()}`
    },
  },
  {
    id: 'open-meteo-history', name: 'Historical Weather', provider: 'Open-Meteo', category: 'Weather',
    description: 'Compare historical daily temperature and precipitation series for a selected place and date range.',
    documentationUrl: 'https://open-meteo.com/en/docs/historical-weather-api', accent: '#2563eb', monogram: 'HW',
    fields: [
      { id: 'latitude', label: 'Latitude', type: 'number', defaultValue: '1.3521', min: -90, max: 90, help: 'A WGS84 latitude from -90 to 90.' },
      { id: 'longitude', label: 'Longitude', type: 'number', defaultValue: '103.8198', min: -180, max: 180, help: 'A WGS84 longitude from -180 to 180.' },
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
      { id: 'query', label: 'Project search', type: 'text', defaultValue: 'artificial intelligence', placeholder: 'e.g. artificial intelligence', help: 'Search public project names, paths, and descriptions.' },
      { id: 'limit', label: 'Projects', type: 'number', defaultValue: '8', min: 1, max: 20, help: 'Return between 1 and 20 public projects.' },
    ],
    buildUrl: ({ query = 'artificial intelligence', limit = '8' }) => {
      const safeLimit = Math.min(20, Math.max(1, Number.parseInt(limit, 10) || 8))
      const params = new URLSearchParams({ visibility: 'public', search: query.trim() || 'artificial intelligence', order_by: 'star_count', sort: 'desc', per_page: String(safeLimit) })
      return `https://gitlab.com/api/v4/projects?${params.toString()}`
    },
  },
  {
    id: 'uk-police-street-crime', name: 'UK Street Crime', provider: 'UK Home Office', category: 'Government',
    description: 'Explore recent anonymised street-level crime categories around a selected UK coordinate.',
    documentationUrl: 'https://data.police.uk/docs/method/crime-street/', accent: '#1d4f91', monogram: 'UK', risk: 'Review',
    usageNote: 'Locations are anonymised by the source. Present the data as area-level context, not individual-level evidence.',
    fields: [
      { id: 'latitude', label: 'Latitude', type: 'number', defaultValue: '51.5074', min: 49, max: 61, help: 'Choose a coordinate within the United Kingdom.' },
      { id: 'longitude', label: 'Longitude', type: 'number', defaultValue: '-0.1278', min: -9, max: 3, help: 'Choose a coordinate within the United Kingdom.' },
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
      const safeDays = Math.min(90, Math.max(7, Number.parseInt(days, 10) || 14))
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
      { id: 'query', label: 'News search', type: 'text', defaultValue: 'NASA', placeholder: 'e.g. NASA', help: 'Search titles and summaries from indexed spaceflight publishers.' },
      { id: 'limit', label: 'Articles', type: 'number', defaultValue: '6', min: 1, max: 10, help: 'Return between 1 and 10 recent articles.' },
    ],
    buildUrl: ({ query = 'NASA', limit = '6' }) => {
      const safeLimit = Math.min(10, Math.max(1, Number.parseInt(limit, 10) || 6))
      return `https://api.spaceflightnewsapi.net/v4/articles/?${new URLSearchParams({ search: query.trim() || 'NASA', limit: String(safeLimit), ordering: '-published_at' }).toString()}`
    },
  },
  {
    id: 'launch-library-upcoming', name: 'Upcoming Space Launches', provider: 'The Space Devs', category: 'Calendar',
    description: 'Track upcoming rocket launches with mission, provider, pad, status, image, and scheduled launch time.',
    documentationUrl: 'https://thespacedevs.com/llapi', accent: '#0f766e', monogram: 'LL',
    usageNote: 'The anonymous service is limited to 15 requests per hour; avoid automatic polling.',
    fields: [
      { id: 'query', label: 'Launch search', type: 'text', defaultValue: 'SpaceX', placeholder: 'e.g. SpaceX', help: 'Filter upcoming launches by mission, rocket, or provider text.' },
      { id: 'limit', label: 'Launches', type: 'number', defaultValue: '4', min: 1, max: 6, help: 'Return between 1 and 6 upcoming launches.' },
    ],
    buildUrl: ({ query = 'SpaceX', limit = '4' }) => {
      const safeLimit = Math.min(6, Math.max(1, Number.parseInt(limit, 10) || 4))
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
    documentationUrl: 'https://animechan.io/docs', accent: '#2e51a2', monogram: 'AQ',
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
      { id: 'query', label: 'Recipe search', type: 'text', defaultValue: 'pasta', placeholder: 'e.g. pasta', help: 'Search recipe names and indexed recipe text.' },
      { id: 'limit', label: 'Recipes', type: 'number', defaultValue: '6', min: 1, max: 10, help: 'Return between 1 and 10 recipes.' },
    ],
    buildUrl: ({ query = 'pasta', limit = '6' }) => {
      const safeLimit = Math.min(10, Math.max(1, Number.parseInt(limit, 10) || 6))
      return `https://dummyjson.com/recipes/search?${new URLSearchParams({ q: query.trim() || 'pasta', limit: String(safeLimit) }).toString()}`
    },
  },
  {
    id: 'brasilapi-postcode', name: 'Brazil Postcode Explorer', provider: 'BrasilAPI', category: 'Geo',
    description: 'Resolve a Brazilian CEP into address, neighbourhood, city, state, timezone, provider, and coordinates.',
    documentationUrl: 'https://brasilapi.com.br/docs#tag/CEP-V2', accent: '#16a34a', monogram: 'BR',
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
      { id: 'count', label: 'Poems', type: 'number', defaultValue: '3', min: 1, max: 4, help: 'Return between 1 and 4 randomly selected poems.' },
    ],
    buildUrl: ({ author = 'Emily Dickinson', count = '3' }) => {
      const safeCount = Math.min(4, Math.max(1, Number.parseInt(count, 10) || 3))
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
    fields: [{ id: 'query', label: 'Character search', type: 'text', defaultValue: 'Luke', placeholder: 'e.g. Luke', help: 'Search Star Wars character names.' }],
    buildUrl: ({ query = 'Luke' }) => `https://swapi.dev/api/people/?${new URLSearchParams({ search: query.trim() || 'Luke' }).toString()}`,
  },
]

export const apiCatalog: ApiDemo[] = [...coreApis, ...additionalInteractiveApis, ...importedRecommendedApis, ...nextKeylessApis, ...verifiedKeylessApis]

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
