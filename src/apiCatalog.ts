import { buildOpenFoodFactsProductUrl } from './openFoodFactsContract'

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

export type AgentExecutionPolicy =
  | { mode: 'enabled' }
  | { mode: 'manual-only'; reason: string; policyUrl?: string }

export type AutomatedVerificationPolicy =
  | {
      mode: 'enabled'
      retryOnRateLimit?: false
      rateLimitStatuses?: number[]
      reason?: string
      policyUrl?: string
    }
  | {
      mode: 'cadence-limited'
      minimumIntervalSeconds: number
      retryOnNon2xx: false
      reason: string
      policyUrl?: string
    }

export type ApiField = {
  id: string
  label: string
  type: 'text' | 'number' | 'select' | 'date'
  defaultValue: string
  help: string
  placeholder?: string
  min?: number
  max?: number
  step?: number
  minimumFromField?: string
  minLength?: number
  maxLength?: number
  pattern?: string
  patternDescription?: string
  options?: FieldOption[]
}

export type ApiResponseType = 'json' | 'text' | 'image'

export type ApiDemo = {
  id: string
  name: string
  provider: string
  category: ApiCategory
  description: string
  keywords?: string[]
  documentationUrl: string
  accent: string
  monogram: string
  fields: ApiField[]
  buildUrl: (parameters: Record<string, string>) => string
  method?: 'GET' | 'POST'
  buildBody?: (parameters: Record<string, string>) => unknown
  bodyEncoding?: 'json' | 'form'
  headers?: Record<string, string>
  responseType?: Exclude<ApiResponseType, 'json'>
  responseContentTypes?: string[]
  parseResponse?: (text: string) => unknown
  successNoContent?: { statuses: number[]; data: unknown }
  risk?: 'Low' | 'Review'
  usageNote?: string
  agentExecution?: Extract<AgentExecutionPolicy, { mode: 'manual-only' }>
  automatedVerification?: AutomatedVerificationPolicy
}

export const getApiResponseType = (api: Pick<ApiDemo, 'responseType'>): ApiResponseType => api.responseType ?? 'json'

const SEARCH_STOP_WORDS = new Set([
  'a', 'an', 'and', 'api', 'apis', 'are', 'by', 'can', 'could', 'find', 'for', 'from', 'get', 'give', 'help', 'how', 'i', 'in', 'into', 'is', 'me', 'my',
  'need', 'of', 'on', 'or', 'please', 'show', 'tell', 'the', 'to', 'use', 'using', 'want', 'what', 'when', 'where', 'which', 'with', 'would', 'you',
])

const normalizeSearchText = (value: string): string =>
  value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export const matchesApiSearch = (api: Pick<ApiDemo, 'id' | 'name' | 'provider' | 'category' | 'description' | 'keywords'>, query: string): boolean => {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true
  const rawTokens = normalizedQuery.split(/\s+/).filter(Boolean)
  const meaningfulTokens = rawTokens.filter((token) => !SEARCH_STOP_WORDS.has(token))
  const tokens = meaningfulTokens.length ? meaningfulTokens : rawTokens
  const haystack = normalizeSearchText([
    api.id,
    api.name,
    api.provider,
    api.category,
    api.description,
    ...(api.keywords ?? []),
  ].join(' '))
  return tokens.every((token) => haystack.includes(token))
}

const encode = (value: string) => encodeURIComponent(value.trim())

// GOPROXY path elements use Go's case-escape convention: A-Z become !a-!z.
const escapeGoProxyModulePath = (value: string): string =>
  [...value.trim()].map((character) => /[A-Z]/.test(character) ? `!${character.toLowerCase()}` : character).join('')

const isIsoCalendarDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

const toDmyDate = (value: string): string => {
  const trimmed = value.trim()
  if (!isIsoCalendarDate(trimmed)) return trimmed
  const [year, month, day] = trimmed.split('-')
  return `${day}-${month}-${year}`
}

const clampInt = (value: string, min: number, max: number, fallback: number): number => {
  const parsed = Number.parseInt(value, 10)
  return Math.min(max, Math.max(min, Number.isNaN(parsed) ? fallback : parsed))
}

const strictBoundedInteger = (value: string, min: number, max: number, label: string): number => {
  const parsed = Number(value.trim())
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}.`)
  }
  return parsed
}

const sparqlStringLiteral = (value: string): string =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`

const numberField = (id: string, params: Omit<ApiField, 'id' | 'type'>): ApiField => ({ id, type: 'number', ...params })
const textField = (id: string, params: Omit<ApiField, 'id' | 'type'>): ApiField => ({ id, type: 'text', ...params })

const CVE_ID_PATTERN = 'CVE-[0-9]{4}-[0-9]{4,}'
const CVE_ID_PATTERN_DESCRIPTION = 'must use the CVE-YYYY-NNNN format with four or more sequence digits.'
const cveField = (label: string, defaultValue = 'CVE-2021-44228'): ApiField => textField('cve', {
  label,
  defaultValue,
  placeholder: 'e.g. CVE-2021-44228',
  pattern: CVE_ID_PATTERN,
  patternDescription: CVE_ID_PATTERN_DESCRIPTION,
  help: 'Enter a published CVE identifier using the CVE-YYYY-NNNN format.',
})

const NVD_USAGE_NOTE = 'NVD allows five requests in a rolling 30-second window without an API key and recommends a six-second sleep between requests. Automated verification is therefore isolated from generic health sweeps and must not retry a non-2xx response in the same run. Treat CVSS as one assessment source and confirm affected versions and remediation with the vendor.'
const NVD_AUTOMATED_VERIFICATION: AutomatedVerificationPolicy = {
  mode: 'cadence-limited',
  minimumIntervalSeconds: 6,
  retryOnNon2xx: false,
  reason: 'NVD documents a public limit of five requests per rolling 30 seconds and recommends sleeping six seconds between requests. Automated verification must use an isolated cadence-aware journey and stop after a non-2xx response instead of joining the generic sweep.',
  policyUrl: 'https://nvd.nist.gov/developers/start-here',
}
const NVD_RECENT_LOOKBACK_OPTIONS: FieldOption[] = [
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '120', label: 'Last 120 days' },
]
const NVD_RECENT_LOOKBACK_VALUES = new Set(NVD_RECENT_LOOKBACK_OPTIONS.map(({ value }) => value))


const appleItunesEntityOptions: FieldOption[] = [
  { label: 'Music · Song', value: 'song' },
  { label: 'Music · Track', value: 'musicTrack' },
  { label: 'Music · Album', value: 'album' },
  { label: 'Music · Artist', value: 'musicArtist' },
  { label: 'Music · Video', value: 'musicVideo' },
  { label: 'Music · Mix', value: 'mix' },
  { label: 'Podcast · Show', value: 'podcast' },
  { label: 'Podcast · Author', value: 'podcastAuthor' },
]
const appleItunesPodcastEntities = new Set(['podcast', 'podcastAuthor'])

const aladhanMethodOptions: FieldOption[] = [
  { value: '11', label: '11 — Majlis Ugama Islam Singapura, Singapore' },
  { value: '17', label: '17 — JAKIM, Malaysia' },
  { value: '3', label: '3 — Muslim World League' },
  { value: '2', label: '2 — Islamic Society of North America (ISNA)' },
  { value: '5', label: '5 — Egyptian General Authority of Survey' },
  { value: '4', label: '4 — Umm Al-Qura University, Makkah' },
  { value: '1', label: '1 — University of Islamic Sciences, Karachi' },
  { value: '7', label: '7 — Institute of Geophysics, University of Tehran' },
  { value: '0', label: '0 — Shia Ithna-Ashari, Leva Institute, Qum' },
  { value: '8', label: '8 — Gulf Region' },
  { value: '9', label: '9 — Kuwait' },
  { value: '10', label: '10 — Qatar' },
  { value: '12', label: '12 — Union Organization Islamic de France' },
  { value: '13', label: '13 — Diyanet İşleri Başkanlığı, Turkey' },
  { value: '14', label: '14 — Spiritual Administration of Muslims of Russia' },
  { value: '15', label: '15 — Moonsighting Committee Worldwide' },
  { value: '16', label: '16 — Dubai' },
  { value: '18', label: '18 — Tunisia' },
  { value: '19', label: '19 — Algeria' },
  { value: '20', label: '20 — Kementerian Agama Republik Indonesia' },
  { value: '21', label: '21 — Morocco' },
  { value: '22', label: '22 — Comunidade Islamica de Lisboa' },
  { value: '23', label: '23 — Ministry of Awqaf, Islamic Affairs and Holy Places, Jordan' },
]

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

export const ART_INSTITUTE_SEARCH_CONTRACT = {
  fields: 'id,title,artist_title,date_display,image_id,is_public_domain',
  publicDomainFilter: 'true',
  maxLimit: 20,
} as const

const nagerCurrentYear = new Date().getUTCFullYear()
const nagerLatestCommunityYear = nagerCurrentYear + 5
const nagerDefaultYear = String(nagerCurrentYear)

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
        minLength: 2,
        maxLength: 3,
        pattern: '[A-Za-z]{2,3}',
        patternDescription: 'must contain exactly two or three letters for an ISO 3166-1 alpha-2 or alpha-3 country code.',
        help: 'Use an ISO 3166-1 alpha-2 or alpha-3 country code such as SG or SGP.',
      },
    ],
    buildUrl: ({ code = 'SGP' }) =>
      `https://api.worldbank.org/v2/country/${encode((code || 'SGP').toUpperCase())}?format=json`,
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
      countField({ label: 'Profiles', defaultValue: '3', min: 1, max: 10, step: 1, help: 'Generate between 1 and 10 synthetic test profiles.' }),
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
    usageNote: 'Synthetic test data for prototypes and demos. The primary semantic card intentionally avoids generated contact, credential, street-address, and national-ID-like fields; review Random User copyright/UI Faces guidance before redistributing portraits.',
    buildUrl: ({ count = '3', nationality = 'au' }) => {
      const query = new URLSearchParams({ results: count.trim(), nat: nationality.trim() })
      return `https://randomuser.me/api/1.4/?${query.toString()}`
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
      countField({ label: 'Photos', defaultValue: '4', min: 1, max: 10, step: 1, help: 'Request between 1 and 10 image URLs.' }),
    ],
    usageNote: 'Keep request frequency bounded and respect Dog CEO hosting. Dog CEO identifies the Stanford Dogs Dataset as the original source and describes the collection as open source, but the API or repository code licence does not establish reuse rights for each photo; verify image rights before reuse.',
    buildUrl: ({ count = '4' }) => {
      const trimmed = count.trim()
      const numeric = Number(trimmed)
      const pathCount = Number.isSafeInteger(numeric) && numeric >= 1 && numeric <= 10 ? String(numeric) : encodeURIComponent(trimmed)
      return `https://dog.ceo/api/breeds/image/random/${pathCount}`
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
        step: 1,
        help: 'Choose a post from 1 to 100.',
      },
    ],
    buildUrl: ({ postId = '7' }) => {
      const trimmed = postId.trim()
      const numeric = Number(trimmed)
      const pathId = Number.isSafeInteger(numeric) && numeric >= 1 && numeric <= 100 ? String(numeric) : trimmed
      return `https://jsonplaceholder.typicode.com/posts/${encode(pathId)}`
    },
  },
  {
    id: 'holidays',
    name: 'Holiday Calendar',
    provider: 'Nager.Holidays',
    category: 'Utility',
    description: 'Plan with the current Nager.Holidays Community API holiday calendar by country and year.',
    documentationUrl: 'https://nagerholidays.com/api',
    accent: '#e95f87',
    monogram: 'NHD',
    fields: [
      {
        id: 'year',
        label: 'Year',
        type: 'number',
        defaultValue: nagerDefaultYear,
        min: nagerCurrentYear,
        max: nagerLatestCommunityYear,
        step: 1,
        help: `Choose the current UTC year through ${nagerLatestCommunityYear}, matching the Community API v4 planning window.`,
      },
      {
        id: 'country',
        label: 'Country',
        type: 'select',
        defaultValue: 'SG',
        help: 'Select an ISO 3166-1 alpha-2 country code admitted by this workbench.',
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
    usageNote: 'Uses the browser-ready Nager.Holidays Community API v4. The public documentation currently advertises CORS support and no rate limit; the Community API is intended for the current year through five years ahead.',
    buildUrl: ({ year = nagerDefaultYear, country = 'SG' }) =>
      `https://nagerholidays.com/api/v4/Holidays/${encode(country).toUpperCase()}/${encode(year)}`,
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
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const today = isoDate(localNow)
const federalFiscalYearForDate = (date: Date) => date.getUTCMonth() >= 9 ? date.getUTCFullYear() + 1 : date.getUTCFullYear()
const currentFederalFiscalYear = federalFiscalYearForDate(localNow)
const defaultFederalFiscalYear = currentFederalFiscalYear - 1
const federalFiscalYearPeriod = (fiscalYear: number) => ({
  start_date: `${fiscalYear - 1}-10-01`,
  end_date: `${fiscalYear}-09-30`,
  date_type: 'new_awards_only',
})
const compactDate = (date: Date) => `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
const daysAgo = (days: number) => {
  const date = new Date(localNow)
  date.setDate(date.getDate() - days)
  return date
}

const additionalInteractiveApis: ApiDemo[] = [
  {
    id: 'geocoding-search', name: 'Global Geocoding', provider: 'Open-Meteo', category: 'Geo',
    description: 'Search worldwide cities and postal codes, then inspect coordinates, timezones, and population.',
    documentationUrl: 'https://open-meteo.com/en/docs/geocoding-api', accent: '#2563eb', monogram: 'GC',
    keywords: ['geocoding', 'geocoder', 'place name to coordinates', 'postal code lookup', 'city lookup'],
    usageNote: 'Searches place names and postal codes using location data based on GeoNames. Open-Meteo documents two-character exact-name matching and three-or-more-character prefix matching; this demo does not claim street-address geocoding.',
    fields: [
      { id: 'name', label: 'Location', type: 'text', defaultValue: 'Singapore', placeholder: 'e.g. Singapore', minLength: 2, help: 'Enter a place name or postal code. Two characters use exact-name matching; three or more use prefix matching.' },
      countField({ label: 'Results', defaultValue: '6', min: 1, max: 10, step: 1, help: 'Return between 1 and 10 matching locations.' }),
    ],
    buildUrl: ({ name = 'Singapore', count = '6' }) => {
      const query = new URLSearchParams({ name: name.trim(), count: count.trim(), language: 'en', format: 'json' })
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
    keywords: ['sunrise time', 'sunset time', 'solar times', 'golden hour'],
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
      { id: 'days', label: 'Recent days', type: 'number', defaultValue: '30', min: 1, max: 365, step: 1, help: 'Look back between 1 and 365 days.' },
      limitField({ label: 'Events', defaultValue: '6', min: 1, max: 10, step: 1, help: 'Return between 1 and 10 active events.' }),
    ],
    buildUrl: ({ category = 'all', days = '30', limit = '6' }) => {
      const query = new URLSearchParams({ status: 'open', days: days.trim(), limit: limit.trim() })
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
      const query = new URLSearchParams({ 'filter[type]': routeType })
      return `https://api-v3.mbta.com/routes?${query.toString()}`
    },
    usageNote: 'The MBTA allows keyless experimentation with a lower request allowance; production apps should request a free API key.',
  },
  {
    id: 'open-trivia', name: 'Trivia Challenge', provider: 'Open Trivia DB', category: 'Games',
    description: 'Generate multiple-choice trivia questions for quiz prototypes and interactive demos.',
    documentationUrl: 'https://opentdb.com/api_config.php', accent: '#7c3aed', monogram: 'Q',
    fields: [
      { id: 'amount', label: 'Questions', type: 'number', defaultValue: '6', min: 1, max: 10, step: 1, help: 'Generate between 1 and 10 questions.' },
      { id: 'category', label: 'Category', type: 'select', defaultValue: '9', help: 'Choose a trivia category.', options: [
        { label: 'General knowledge', value: '9' }, { label: 'Books', value: '10' }, { label: 'Film', value: '11' }, { label: 'Science & nature', value: '17' },
        { label: 'Computers', value: '18' }, { label: 'Geography', value: '22' }, { label: 'History', value: '23' }, { label: 'Sports', value: '21' },
      ] },
      { id: 'difficulty', label: 'Difficulty', type: 'select', defaultValue: 'medium', help: 'Choose the question difficulty.', options: [
        { label: 'Easy', value: 'easy' }, { label: 'Medium', value: 'medium' }, { label: 'Hard', value: 'hard' },
      ] },
    ],
    buildUrl: ({ amount = '6', category = '9', difficulty = 'medium' }) => {
      const query = new URLSearchParams({ amount: amount.trim(), category, difficulty, type: 'multiple' })
      return `https://opentdb.com/api.php?${query.toString()}`
    },
    usageNote: 'Free and keyless. Open Trivia DB data is licensed CC BY-SA 4.0. The provider limits each IP to one API request every 5 seconds and allows at most 50 questions per call; this browser demo caps a request at 10 questions.',
    automatedVerification: {
      mode: 'cadence-limited',
      minimumIntervalSeconds: 5,
      retryOnNon2xx: false,
      reason: 'Open Trivia DB limits each IP to one API request every 5 seconds. Automated verification must use one isolated request per cadence window and must not add a same-run non-2xx retry.',
      policyUrl: 'https://opentdb.com/api_config.php',
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
    documentationUrl: 'https://data.gov.sg/collections/352/datasets/d_e25662f1a062dd046453926aa284ba64/view', endpoint: 'https://api.data.gov.sg/v1/transport/taxi-availability',
    accent: '#eab308', monogram: 'TX',
    usageNote: 'Latest anonymous availability snapshot. The provider recommends calling at most once per minute; the timestamp is data.gov.sg acquisition time, not a per-taxi observation time.',
  }),
  fixedApi({
    id: 'data-gov-traffic-images', name: 'data.gov.sg Traffic Images', provider: 'data.gov.sg', category: 'Singapore',
    description: 'Get current image URLs and coordinates for Singapore traffic cameras.',
    documentationUrl: 'https://data.gov.sg/datasets/d_6cdb6b405b25aaaacbaf7689bcc6fae0/view', endpoint: 'https://api.data.gov.sg/v1/transport/traffic-images',
    accent: '#6366f1', monogram: 'TI',
    usageNote: 'LTA real-time traffic-camera data under the Singapore Open Data Licence. data.gov.sg permits keyless exploration and testing; an API key is recommended for production use and higher limits.',
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
    description: 'Inspect the first page of 2023 United States state population estimates from the ACS 5-year dataset.',
    documentationUrl: 'https://datausa.io/about/api/', endpoint: 'https://api.datausa.io/tesseract/data.jsonrecords?cube=acs_yg_total_population_5&drilldowns=State,Year&measures=Population&include=Year:2023&limit=8,0',
    accent: '#2563eb', monogram: 'DU',
  }),
  {
    id: 'devto', name: 'DEV.to / Forem API', provider: 'Forem', category: 'Developer',
    description: 'Browse published DEV community articles by exact tag.',
    keywords: ['DEV articles', 'Forem articles', 'developer community articles'],
    documentationUrl: 'https://developers.forem.com/api/v1', accent: '#111827', monogram: 'DV',
    usageNote: 'Uses the current Forem API v1 media type. This public article-list endpoint does not require an API key; tag-filtered results are provider-ranked and should not be described as a guaranteed chronological feed.',
    fields: [
      { id: 'tag', label: 'Tag', type: 'text', defaultValue: 'javascript', placeholder: 'e.g. javascript', minLength: 1, maxLength: 50, help: 'Filter published DEV articles by one exact tag.' },
      limitField({ label: 'Articles', defaultValue: '8', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 published articles from page 1.' }),
    ],
    headers: { Accept: 'application/vnd.forem.api-v1+json' },
    buildUrl: ({ tag = 'javascript', limit = '8' }) => `https://dev.to/api/articles?${new URLSearchParams({ tag: tag.trim(), per_page: limit.trim(), page: '1' }).toString()}`,
  },
  fixedApi({
    id: 'fiscal-data-treasury', name: 'U.S. Treasury Agency Overview', provider: 'USAspending.gov', category: 'Finance',
    description: 'Inspect the Department of the Treasury agency overview, including its mission, identifiers, current fiscal-year context, subtier count, and official reference links.',
    documentationUrl: 'https://api.usaspending.gov/docs/endpoints', endpoint: 'https://api.usaspending.gov/api/v2/agency/020/',
    accent: '#1d4ed8', monogram: 'FT',
    usageNote: 'This USAspending endpoint is an agency overview. It does not itself return award obligations or budgetary-resource totals; those are separate agency endpoints.',
  }),
  fixedApi({
    id: 'github', name: 'GitHub Public Repos', provider: 'GitHub', category: 'Developer',
    description: 'List public repositories owned by GitHub\'s Octocat example account.',
    documentationUrl: 'https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user', endpoint: 'https://api.github.com/users/octocat/repos?type=owner&sort=full_name&direction=asc&per_page=8',
    accent: '#24292f', monogram: 'GH',
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' },
    usageNote: 'GitHub permits unauthenticated access to public repositories, with a primary limit of 60 requests per hour per originating IP. GitHub may return HTTP 403 or 429 for primary or secondary rate-limit exhaustion and requires clients to wait for the reset/Retry-After window before retrying. This demo pins the supported 2026-03-10 REST API version and requests only Octocat-owned public repositories.',
    automatedVerification: {
      mode: 'enabled',
      retryOnRateLimit: false,
      rateLimitStatuses: [403, 429],
      reason: 'GitHub documents HTTP 403 or 429 for primary or secondary rate-limit exhaustion and requires clients to wait for x-ratelimit-reset, Retry-After, or at least one minute before retrying. Generic health verification therefore records the first 403/429 and defers another provider request to a later independent run.',
      policyUrl: 'https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api',
    },
  }),
  {
    id: 'hacker-news', name: 'Hacker News API', provider: 'Y Combinator', category: 'Developer',
    description: 'Look up a public Hacker News story, comment, job, poll, or poll option by item ID.',
    keywords: ['Hacker News item lookup', 'HN story comment item ID'],
    documentationUrl: 'https://github.com/HackerNews/API', accent: '#f97316', monogram: 'HNR',
    fields: [textField('itemId', {
      label: 'Item ID', defaultValue: '8863', placeholder: 'e.g. 8863', minLength: 1, maxLength: 15,
      pattern: '[1-9][0-9]*', patternDescription: 'must be a positive decimal Hacker News item ID.',
      help: 'Enter the positive integer ID of a Hacker News story, comment, job, poll, or poll option.',
    })],
    buildUrl: ({ itemId = '8863' }) => `https://hacker-news.firebaseio.com/v0/item/${encode(itemId)}.json?print=pretty`,
    usageNote: 'The official Hacker News v0 API currently has no rate limit. Item lookup returns JSON null for an unknown ID; clients should tolerate additional provider fields.',
  },
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
    description: 'Search the first paginated page of The Met collection for image-bearing objects related to Singapore.',
    documentationUrl: 'https://metmuseum.github.io/', endpoint: 'https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&q=singapore&offset=0&limit=12',
    accent: '#b91c1c', monogram: 'MS',
    usageNote: 'Uses The Met Collection API v1.1 paginated search introduced September 4, 2026. The previous /v1/search endpoint is deprecated and scheduled for retirement on October 1, 2026. This demo requests only the first 12 image-bearing Singapore matches; The Met asks API clients to stay within 80 requests per second.',
  }),
  fixedApi({
    id: 'nhtsa-vpic', name: 'NHTSA vPIC Vehicle API', provider: 'NHTSA', category: 'Vehicle',
    description: 'List vehicle makes from the U.S. vehicle product information catalog.',
    documentationUrl: 'https://vpic.nhtsa.dot.gov/api/', endpoint: 'https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=json',
    accent: '#1e40af', monogram: 'NH',
  }),
  {
    id: 'npm-search', name: 'npm Registry Search', provider: 'npm', category: 'Developer',
    description: 'Search the npm registry for packages by query and inspect trusted package metadata and download activity.',
    documentationUrl: 'https://api-docs.npmjs.com/', accent: '#cb3837', monogram: 'NP',
    keywords: ['npm package search', 'node package registry', 'javascript packages', 'dependencies'],
    fields: [
      queryField({ label: 'Package search', defaultValue: 'react', placeholder: 'e.g. react', minLength: 1, help: 'Search npm packages using the registry text query.' }),
      limitField({ label: 'Packages', defaultValue: '8', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 npm registry search results.' }),
    ],
    buildUrl: ({ query = 'react', limit = '8' }) =>
      `https://registry.npmjs.org/-/v1/search?${new URLSearchParams({ text: query.trim(), size: limit.trim() }).toString()}`,
  },
  {
    id: 'nvd-cpe-search', name: 'NVD CPE Search', provider: 'NIST NVD', category: 'Developer',
    description: 'Search the National Vulnerability Database CPE 2.3 product dictionary by keyword.',
    documentationUrl: 'https://nvd.nist.gov/developers/products',
    accent: '#0369a1', monogram: 'NV',
    usageNote: NVD_USAGE_NOTE,
    automatedVerification: NVD_AUTOMATED_VERIFICATION,
    fields: [
      queryField({ label: 'CPE keyword', defaultValue: 'openssl', placeholder: 'e.g. openssl', minLength: 1, help: 'Search across components of NVD CPE product names.' }),
      limitField({ label: 'Products', defaultValue: '8', min: 1, max: 20, step: 1, help: 'Return a bounded first page of 1 to 20 whole CPE product identities.' }),
    ],
    buildUrl: ({ query = 'openssl', limit = '8' }) =>
      `https://services.nvd.nist.gov/rest/json/cpes/2.0?${new URLSearchParams({ keywordSearch: query.trim(), resultsPerPage: limit.trim() }).toString()}`,
  },
  {
    id: 'nvd-cve-detail', name: 'NVD CVE Detail', provider: 'NIST NVD', category: 'Developer',
    description: 'Retrieve one request-bound NVD CVE record with provider descriptions, dates, references, and sourced CVSS assessment.',
    documentationUrl: 'https://nvd.nist.gov/developers/vulnerabilities',
    accent: '#075985', monogram: 'CD',
    risk: 'Review',
    usageNote: NVD_USAGE_NOTE,
    automatedVerification: NVD_AUTOMATED_VERIFICATION,
    fields: [cveField('CVE identifier', 'CVE-2024-3094')],
    buildUrl: ({ cve = 'CVE-2024-3094' }) => `https://services.nvd.nist.gov/rest/json/cves/2.0?${new URLSearchParams({ cveId: cve.trim() }).toString()}`,
  },
  {
    id: 'nvd-cves', name: 'NVD CVE Search', provider: 'NIST NVD', category: 'Developer',
    description: 'Search current NVD CVE descriptions for all supplied keyword terms and inspect request-bound vulnerability records.',
    documentationUrl: 'https://nvd.nist.gov/developers/vulnerabilities',
    accent: '#0c4a6e', monogram: 'CS',
    usageNote: NVD_USAGE_NOTE,
    automatedVerification: NVD_AUTOMATED_VERIFICATION,
    keywords: ['CVE keyword search', 'vulnerability description search', 'security vulnerability discovery'],
    fields: [
      queryField({ label: 'CVE description keywords', defaultValue: 'postgresql', placeholder: 'e.g. postgresql', minLength: 1, maxLength: 100, help: 'Search current CVE descriptions. NVD requires every space-separated term to match and applies a trailing wildcard to each term.' }),
      limitField({ label: 'CVEs', defaultValue: '8', min: 1, max: 20, step: 1, help: 'Return a bounded first page of 1 to 20 whole matching CVE records.' }),
    ],
    buildUrl: ({ query = 'postgresql', limit = '8' }) =>
      `https://services.nvd.nist.gov/rest/json/cves/2.0?${new URLSearchParams({ keywordSearch: query.trim(), resultsPerPage: limit.trim() }).toString()}`,
  },
  {
    id: 'nvd-recent-cves', name: 'NVD Recently Modified CVEs', provider: 'NIST NVD', category: 'Developer',
    description: 'Review CVEs whose NVD records were modified within a bounded recent window.',
    documentationUrl: 'https://nvd.nist.gov/developers/vulnerabilities',
    accent: '#155e75', monogram: 'NR',
    usageNote: NVD_USAGE_NOTE,
    automatedVerification: NVD_AUTOMATED_VERIFICATION,
    fields: [{
      id: 'lookbackDays', label: 'Modified within', type: 'select', defaultValue: '7',
      options: NVD_RECENT_LOOKBACK_OPTIONS,
      help: 'Choose a bounded NVD last-modified window. NVD requires paired lastModStartDate/lastModEndDate values and limits one window to 120 consecutive days.',
    }],
    buildUrl: ({ lookbackDays = '7' }) => {
      const normalized = lookbackDays.trim()
      if (!NVD_RECENT_LOOKBACK_VALUES.has(normalized)) throw new Error('Unsupported NVD modified-window lookback.')
      const end = new Date(localNow)
      const start = new Date(end.getTime() - Number(normalized) * 86_400_000)
      return `https://services.nvd.nist.gov/rest/json/cves/2.0?${new URLSearchParams({ lastModStartDate: start.toISOString(), lastModEndDate: end.toISOString(), resultsPerPage: '8' }).toString()}`
    },
  },
  fixedApi({
    id: 'postcodes-io', name: 'Postcodes.io', provider: 'Postcodes.io', category: 'Geo',
    description: 'Look up geographic and administrative details for a UK postcode.',
    documentationUrl: 'https://postcodes.io/docs', endpoint: 'https://api.postcodes.io/postcodes/SW1A1AA',
    accent: '#7c3aed', monogram: 'PC',
  }),
  fixedApi({
    id: 'pypi-json', name: 'PyPI JSON API', provider: 'Python Package Index', category: 'Developer',
    description: 'Inspect current project metadata for the Python requests package.',
    documentationUrl: 'https://docs.pypi.org/api/json/', endpoint: 'https://pypi.org/pypi/requests/json',
    accent: '#3775a9', monogram: 'PY',
    usageNote: 'PyPI marks the project-level releases key and legacy downloads, has_sig, and bugtrack_url fields as deprecated. The semantic preview does not depend on those fields for readiness.',
  }),
  {
    id: 'stack-exchange', name: 'Stack Exchange Questions', provider: 'Stack Exchange', category: 'Developer',
    description: 'Browse recently active Stack Overflow questions for one to five required tags.',
    documentationUrl: 'https://api.stackexchange.com/docs/questions', accent: '#f48024', monogram: 'SE',
    usageNote: 'Stack Exchange heavily caches API responses. Do not repeat semantically identical requests more than once per minute, and obey any provider backoff value before calling the same method again.',
    automatedVerification: {
      mode: 'cadence-limited',
      minimumIntervalSeconds: 60,
      retryOnNon2xx: false,
      reason: 'Stack Exchange says semantically identical API requests should not be made more than once per minute; automated verification uses one request per cadence window and no same-run non-2xx retry.',
      policyUrl: 'https://api.stackexchange.com/docs/throttle',
    },
    fields: [
      textField('tags', { label: 'Required tags', defaultValue: 'javascript', placeholder: 'e.g. javascript;reactjs', minLength: 1, maxLength: 200, pattern: '[^;]+(?:;[^;]+){0,4}', patternDescription: 'Enter one to five semicolon-delimited Stack Overflow tags.', help: 'Every returned question must contain all requested tags. Separate up to five tags with semicolons.' }),
      limitField({ label: 'Questions', defaultValue: '8', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 recently active questions.' }),
    ],
    buildUrl: ({ tags = 'javascript', limit = '8' }) => {
      const params = new URLSearchParams({ order: 'desc', sort: 'activity', tagged: tags.trim(), site: 'stackoverflow', pagesize: limit.trim() })
      return `https://api.stackexchange.com/2.3/questions?${params.toString()}`
    },
  },
  fixedApi({
    id: 'uk-bank-holidays', name: 'UK Bank Holidays', provider: 'GOV.UK', category: 'Calendar',
    description: 'Retrieve official bank-holiday calendars for the United Kingdom.',
    documentationUrl: 'https://www.gov.uk/bank-holidays', endpoint: 'https://www.gov.uk/bank-holidays.json',
    accent: '#1d70b8', monogram: 'UK',
  }),
  {
    id: 'usaspending', name: 'USAspending Contract Awards', provider: 'USAspending.gov', category: 'Government',
    description: 'Inspect new prime federal contract awards whose base transaction date falls within a selected federal fiscal year, sorted by Base Obligation Date.',
    documentationUrl: 'https://github.com/fedspendingtransparency/usaspending-api/blob/master/usaspending_api/api_contracts/contracts/v2/search/spending_by_award.md',
    accent: '#0f4c81', monogram: 'US', method: 'POST',
    usageNote: 'Federal fiscal years run from October 1 through September 30. This demo sets date_type=new_awards_only so only awards whose base transaction date falls inside the selected fiscal year are returned, searches prime contract award types A-D, and sorts by Base Obligation Date descending. For contract awards, USAspending maps Award Amount to the award total_obligation field; it is not a transaction amount or potential award ceiling.',
    fields: [
      numberField('fiscalYear', { label: 'Federal fiscal year', defaultValue: String(defaultFederalFiscalYear), min: 2008, max: currentFederalFiscalYear, step: 1, help: 'Choose FY2008 through the current federal fiscal year. The request uses new_awards_only, so the award’s base transaction date must fall between October 1 and September 30.' }),
      limitField({ label: 'Awards', defaultValue: '8', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 new prime contract awards for the selected federal fiscal year.' }),
    ],
    buildUrl: () => 'https://api.usaspending.gov/api/v2/search/spending_by_award/',
    buildBody: ({ fiscalYear = String(defaultFederalFiscalYear), limit = '8' }) => {
      const safeFiscalYear = strictBoundedInteger(fiscalYear, 2008, currentFederalFiscalYear, 'Federal fiscal year')
      const safeLimit = strictBoundedInteger(limit, 1, 20, 'Awards limit')
      return {
        filters: {
          time_period: [federalFiscalYearPeriod(safeFiscalYear)],
          award_type_codes: ['A', 'B', 'C', 'D'],
        },
        fields: [
          'Award ID',
          'Recipient Name',
          'Award Amount',
          'Base Obligation Date',
          'Awarding Agency',
          'Awarding Sub Agency',
          'Funding Agency',
          'Funding Sub Agency',
          'Contract Award Type',
          'Description',
        ],
        page: 1,
        limit: safeLimit,
        sort: 'Base Obligation Date',
        order: 'desc',
        subawards: false,
      }
    },
  },
  fixedApi({
    id: 'usgs', name: 'USGS Earthquakes', provider: 'U.S. Geological Survey', category: 'Geo',
    description: 'Map earthquakes of magnitude 2.5 or greater reported during the past day.',
    keywords: ['earthquake data', 'seismic events', 'earthquake feed'],
    documentationUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php', endpoint: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
    accent: '#92400e', monogram: 'EQ',
  }),
  fixedApi({
    id: 'wikidata-sparql', name: 'Wikidata SPARQL', provider: 'Wikimedia Foundation', category: 'Knowledge',
    description: 'Run a bounded Wikidata Query Service SPARQL query for entities classified as cities and their English labels.',
    documentationUrl: 'https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service', endpoint: 'https://query.wikidata.org/sparql?query=SELECT%20%3Fitem%20%3FitemLabel%20WHERE%20%7B%20%3Fitem%20wdt%3AP31%20wd%3AQ515%20.%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22en%22%20.%20%7D%20%7D%20LIMIT%208&format=json',
    accent: '#339966', monogram: 'WQ',
    headers: { Accept: 'application/sparql-results+json', 'Api-User-Agent': 'Public-API/0.1 (https://yapweijun1996.github.io/Public-API/)' },
    usageNote: 'Wikidata Query Service is rate-limited and can lag behind Wikidata edits. Public-API identifies its browser requests with Wikimedia’s Api-User-Agent fallback for browser JavaScript. On HTTP 429, Wikimedia says to obey the Retry-After header before repeating the query.',
    automatedVerification: {
      mode: 'enabled',
      retryOnRateLimit: false,
      reason: 'Wikidata Query Service says HTTP 429 clients must wait until the Retry-After window before repeating the query; generic health verification records the first 429 and defers another provider request to a later independent run.',
      policyUrl: 'https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual',
    },
  }),
  fixedApi({
    id: 'world-bank-gdp', name: 'World Bank GDP', provider: 'World Bank', category: 'Economy',
    description: 'Explore recent Singapore gross domestic product figures.',
    documentationUrl: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures', endpoint: 'https://api.worldbank.org/v2/country/SGP/indicator/NY.GDP.MKTP.CD?format=json&mrv=8&per_page=8',
    accent: '#0071bc', monogram: 'GDP',
  }),
  fixedApi({
    id: 'world-bank-population', name: 'World Bank Population', provider: 'World Bank', category: 'Economy',
    description: 'Explore recent Singapore population totals by year.',
    documentationUrl: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures', endpoint: 'https://api.worldbank.org/v2/country/SGP/indicator/SP.POP.TOTL?format=json&mrv=8&per_page=8',
    accent: '#005a9c', monogram: 'POP',
  }),
  {
    id: 'frankfurter-sgd-myr-history', name: 'SGD/MYR FX History', provider: 'Frankfurter · ECB', category: 'Finance',
    description: 'Explore monthly SGD/MYR reference rates from the euro-era starting point in 1999.',
    documentationUrl: 'https://frankfurter.dev/', accent: '#0f766e', monogram: 'FX',
    fields: [
      { id: 'from', label: 'Start date', type: 'date', defaultValue: '1999-01-04', help: 'Use an ISO date in YYYY-MM-DD format. ECB history begins at the euro-era starting point.' },
      { id: 'to', label: 'End date', type: 'date', defaultValue: today, minimumFromField: 'from', help: 'Use an ISO date in YYYY-MM-DD format on or after the start date, up to today.' },
      { id: 'group', label: 'Grouping', type: 'select', defaultValue: 'month', help: 'Monthly grouping keeps the long history compact.', options: [{ label: 'Monthly', value: 'month' }, { label: 'Weekly', value: 'week' }] },
    ],
    buildUrl: ({ from = '1999-01-04', to = today, group = 'month' }) => {
      const safeFrom = isIsoCalendarDate(from.trim()) ? from.trim() : '1999-01-04'
      const safeTo = isIsoCalendarDate(to.trim()) ? to.trim() : today
      const query = new URLSearchParams({ from: safeFrom, to: safeTo, base: 'SGD', quotes: 'MYR', providers: 'ECB', group })
      return `https://api.frankfurter.dev/v2/rates?${query.toString()}`
    },
  },
  {
    id: 'open-library-search', name: 'Open Library Search', provider: 'Internet Archive', category: 'Books',
    description: 'Search books, authors, and publication years in the Open Library catalogue.',
    documentationUrl: 'https://openlibrary.org/developers/api', accent: '#b45309', monogram: 'OL',
    usageNote: 'Open Library is intended for human-facing, low-volume discovery rather than bulk/high-traffic backend use. Unidentified requests are limited to 1 request/second; cache responses when practical.',
    fields: [
      queryField({ label: 'Book search', defaultValue: 'artificial intelligence', minLength: 1, help: 'Search by title, author, subject, or keyword.' }),
      limitField({ label: 'Results', defaultValue: '8', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 books.' }),
    ],
    buildUrl: ({ query = 'artificial intelligence', limit = '8' }) => {
      const params = new URLSearchParams({ q: query.trim(), limit, fields: 'key,title,author_name,first_publish_year,cover_i' })
      return `https://openlibrary.org/search.json?${params.toString()}`
    },
  },
  {
    id: 'open-food-facts', name: 'Open Food Facts', provider: 'Open Food Facts', category: 'Food',
    description: 'Look up a request-bound food product identity, selected nutrition facts, ingredients, and labels by barcode.',
    documentationUrl: 'https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/', accent: '#65a30d', monogram: 'OF',
    usageNote: 'Open Food Facts limits product reads to 15 product reads/minute/IP and asks API clients to identify their app with a custom User-Agent. Its official JavaScript SDK also documents browser window.fetch usage. Keep this browser demo low-volume and human-triggered; product data is community-contributed and may be incomplete or incorrect.',
    fields: [{ id: 'barcode', label: 'Barcode', type: 'text', defaultValue: '3017620422003', minLength: 1, maxLength: 32, pattern: '[0-9]+', patternDescription: 'must contain digits only.', help: 'Enter an EAN, UPC, or GTIN barcode as digits. Open Food Facts may normalize leading zeros on the server.' }],
    buildUrl: ({ barcode = '3017620422003' }) => buildOpenFoodFactsProductUrl(barcode),
  },
  {
    id: 'free-dictionary', name: 'Free Dictionary', provider: 'FreeDictionaryAPI.com', category: 'Language',
    description: 'Look up English definitions, pronunciations, examples, synonyms, and antonyms.',
    documentationUrl: 'https://freedictionaryapi.com/', accent: '#7c3aed', monogram: 'DI',
    usageNote: 'FreeDictionaryAPI.com allows 1,000 requests/hour/IP, serves Wiktionary-derived CC BY-SA 4.0 content, and requires visible FreeDictionaryAPI.com attribution plus a link back to the original Wiktionary page supplied in the response.',
    fields: [{ id: 'word', label: 'English word', type: 'text', defaultValue: 'hello', minLength: 1, help: 'Enter one English word or headword.' }],
    buildUrl: ({ word = 'hello' }) => `https://freedictionaryapi.com/api/v1/entries/en/${encode(word || 'hello')}`,
  },
  {
    id: 'pokeapi', name: 'PokéAPI Explorer', provider: 'PokéAPI', category: 'Games',
    description: 'Explore a Pokémon profile, abilities, types, sprites, and game statistics.',
    documentationUrl: 'https://pokeapi.co/docs', accent: '#eab308', monogram: 'PK',
    usageNote: 'PokéAPI is keyless and consumption-only. Its current fair-use policy asks clients to limit request frequency even though static hosting has no fixed rate limit; avoid bulk or abusive traffic.',
    fields: [{ id: 'pokemon', label: 'Pokémon', type: 'text', defaultValue: 'pikachu', minLength: 1, help: 'Use an exact Pokémon resource name or positive Pokédex/resource ID.' }],
    buildUrl: ({ pokemon = 'pikachu' }) => `https://pokeapi.co/api/v2/pokemon/${encode(pokemon.trim()).toLowerCase()}`,
  },
  {
    id: 'art-institute-search', name: 'Art Institute Search', provider: 'Art Institute of Chicago', category: 'Media',
    description: 'Search public-domain artworks and preview only records with trustworthy provider image identity and IIIF evidence.',
    documentationUrl: 'https://api.artic.edu/docs/', accent: '#dc2626', monogram: 'AI',
    usageNote: 'Anonymous API access is limited to 60 requests/minute. This demo filters for public-domain artworks, displays only records with provider image identity, derives images from the provider IIIF configuration, and treats API response data as CC0 subject to the Art Institute terms. Review the artwork record before downstream image reuse.',
    fields: [
      queryField({ label: 'Artwork search', defaultValue: 'monet', minLength: 1, help: 'Search artwork titles, artists, or subjects.' }),
      limitField({ label: 'Results', defaultValue: '8', min: 1, max: ART_INSTITUTE_SEARCH_CONTRACT.maxLimit, step: 1, help: 'Return between 1 and 20 public-domain search results; image-less rows are withheld from the semantic gallery.' }),
    ],
    buildUrl: ({ query = 'monet', limit = '8' }) => {
      const params = new URLSearchParams({
        q: query.trim(),
        limit: limit.trim(),
        fields: ART_INSTITUTE_SEARCH_CONTRACT.fields,
        'query[term][is_public_domain]': ART_INSTITUTE_SEARCH_CONTRACT.publicDomainFilter,
      })
      return `https://api.artic.edu/api/v1/artworks/search?${params.toString()}`
    },
  },
  {
    id: 'tvmaze-search', name: 'TVmaze Show Search', provider: 'TVmaze', category: 'Entertainment',
    description: 'Search television shows with schedules, genres, ratings, and image metadata.',
    documentationUrl: 'https://www.tvmaze.com/api', accent: '#ec4899', monogram: 'TV',
    usageNote: 'TVmaze public API data is CC BY-SA and requires source attribution and ShareAlike. The free service promises at least 20 calls per 10 seconds per IP; back off after HTTP 429. Show images may be null, and this demo makes no separate image-reuse-rights claim.',
    fields: [{ id: 'show', label: 'Show title', type: 'text', defaultValue: 'severance', minLength: 1, help: 'Search for a television series.' }],
    buildUrl: ({ show = 'severance' }) => `https://api.tvmaze.com/search/shows?q=${encode(show.trim())}`,
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
    fields: [{ id: 'condition', label: 'Condition', type: 'text', defaultValue: 'Diabetes', minLength: 1, help: 'Search the ClinicalTrials.gov condition/disease search area, which may match condition terms, titles, MeSH terms, keywords, and provider synonyms.' }],
    buildUrl: ({ condition = 'Diabetes' }) => {
      const params = new URLSearchParams({ 'query.cond': condition.trim(), pageSize: '8', format: 'json' })
      return `https://clinicaltrials.gov/api/v2/studies?${params.toString()}`
    },
  },
  {
    id: 'openfda-drug-labels', name: 'openFDA Drug Labels', provider: 'U.S. Food and Drug Administration', category: 'Health',
    description: 'Search public drug-label records by brand name and inspect product identity, active ingredients, indications, warnings, and directions.',
    documentationUrl: 'https://open.fda.gov/apis/drug/label/', accent: '#0369a1', monogram: 'FD', risk: 'Review',
    usageNote: 'For informational demonstrations only. Labels may be incomplete or outdated; never use this response for medical decisions.',
    fields: [{ id: 'brand', label: 'Brand name', type: 'text', defaultValue: 'Advil', minLength: 1, maxLength: 80, pattern: '[^"\\\\]+', patternDescription: 'must not contain double quotes or backslashes because those characters alter openFDA search syntax.', help: 'Search a drug brand-name phrase indexed by openFDA. Multi-word names are sent as one quoted phrase.' }],
    buildUrl: ({ brand = 'Advil' }) => {
      const phrase = brand.trim()
      const params = new URLSearchParams({ search: `openfda.brand_name:"${phrase}"`, limit: '8' })
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
    id: 'malaysia-fuel-price', name: 'Malaysia Fuel Price', provider: 'data.gov.my', category: 'Finance',
    description: 'Compare Malaysia’s weekly RON95, RON97, diesel, and targeted-subsidy fuel prices.',
    documentationUrl: 'https://data.gov.my/data-catalogue/fuelprice', accent: '#d9485f', monogram: 'MY',
    usageNote: 'Official open data licensed under CC BY 4.0. Keep data.gov.my attribution visible when republishing the results.',
    fields: [
      limitField({ label: 'History rows', defaultValue: '52', min: 12, max: 104, help: 'Each week can include a price level and a weekly-change row.' }),
    ],
    buildUrl: ({ limit = '52' }) => `https://api.data.gov.my/data-catalogue/?id=fuelprice&limit=${limit.trim()}&sort=-date`,
  },
  {
    id: 'open-meteo-marine', name: 'Marine Weather', provider: 'Open-Meteo', category: 'Weather',
    description: 'Inspect wave height, period, direction, sea temperature, and ocean currents for coastal demos.',
    documentationUrl: 'https://open-meteo.com/en/docs/marine-weather-api', accent: '#087ea4', monogram: 'MW', risk: 'Review',
    usageNote: 'Open-Meteo attribution is required. Forecasts are not suitable for coastal navigation or safety-critical decisions.',
    fields: [
      ...latLongFields(),
      { id: 'days', label: 'Forecast days', type: 'number', defaultValue: '3', min: 1, max: 7, step: 1, help: 'Return between 1 and 7 whole forecast days.' },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', days = '3' }) => {
      const query = new URLSearchParams({
        latitude,
        longitude,
        hourly: 'wave_height,wave_direction,wave_period,sea_surface_temperature,ocean_current_velocity,ocean_current_direction',
        timezone: 'auto',
        forecast_days: days.trim(),
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
      limitField({ label: 'Prize years', defaultValue: '6', min: 1, max: 12, step: 1, help: 'Return between 1 and 12 whole recent prize records.' }),
    ],
    buildUrl: ({ category = 'phy', limit = '6' }) => {
      const query = new URLSearchParams({ nobelPrizeCategory: category.trim(), limit: limit.trim(), sort: 'desc' })
      return `https://api.nobelprize.org/2.1/nobelPrizes?${query.toString()}`
    },
  },
  {
    id: 'chess-player-stats', name: 'Lichess Player Ratings', provider: 'Lichess', category: 'Games',
    description: 'Inspect a public Lichess player’s rating, game count, rating deviation, and progress across supported chess modes.',
    documentationUrl: 'https://lichess.org/api#tag/Users/operation/apiUser', accent: '#63863c', monogram: 'LR',
    usageNote: 'Public read-only user endpoint. Lichess asks clients to make only one API request at a time and, after HTTP 429, wait a full minute before resuming API usage.',
    automatedVerification: {
      mode: 'enabled',
      retryOnRateLimit: false,
      reason: 'Lichess says clients receiving HTTP 429 must wait a full minute before resuming API usage; generic health verification records the first 429 and defers another provider request to a later independent run.',
      policyUrl: 'https://lichess.org/page/api-tips',
    },
    fields: [
      { id: 'username', label: 'Lichess username', type: 'text', defaultValue: 'thibault', placeholder: 'e.g. thibault', minLength: 1, help: 'Enter one public Lichess username. The request reads only public user data.' },
    ],
    buildUrl: ({ username = 'thibault' }) => `https://lichess.org/api/user/${encode(username.trim().toLowerCase())}`,
  },
  {
    id: 'crossref-works', name: 'Crossref Works Search', provider: 'Crossref', category: 'Research',
    description: 'Search scholarly works and inspect DOI, authorship, publisher, type, year, and citation counts.',
    documentationUrl: 'https://www.crossref.org/documentation/retrieve-metadata/rest-api/', accent: '#4f46a5', monogram: 'CR',
    usageNote: 'Uses Crossref’s public pool without authentication. Cache results and keep request volume modest.',
    fields: [
      queryField({ label: 'Research query', defaultValue: 'agentic AI', placeholder: 'e.g. climate adaptation', minLength: 1, help: 'Search titles, authors, abstracts, and other Crossref metadata.' }),
      { id: 'rows', label: 'Results', type: 'number', defaultValue: '8', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 whole work records.' },
    ],
    buildUrl: ({ query = 'agentic AI', rows = '8' }) => {
      const params = new URLSearchParams({ query: query.trim(), rows: rows.trim(), select: 'DOI,title,author,published,publisher,is-referenced-by-count,type,URL' })
      return `https://api.crossref.org/v1/works?${params.toString()}`
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
    fields: [{ id: 'vulnerabilityId', label: 'OSV or GHSA ID', type: 'text', defaultValue: 'GHSA-jfh8-c2jp-5v3q', placeholder: 'e.g. GHSA-jfh8-c2jp-5v3q', help: 'Enter the exact case-sensitive OSV, CVE, or GitHub Security Advisory identifier. OSV API request values are case-sensitive.' }],
    buildUrl: ({ vulnerabilityId = 'GHSA-jfh8-c2jp-5v3q' }) => `https://api.osv.dev/v1/vulns/${encode(vulnerabilityId.trim() || 'GHSA-jfh8-c2jp-5v3q')}`,
  },
  {
    id: 'federal-register-documents', name: 'Federal Register Documents', provider: 'U.S. Federal Register', category: 'Government',
    description: 'Search recent U.S. rules, notices, proposed rules, presidential documents, and agency publications.',
    documentationUrl: 'https://www.federalregister.gov/developers/documentation/api/v1', accent: '#344054', monogram: 'FR',
    usageNote: 'FederalRegister.gov exposes this public API without an API key and documents browser CORS support. Its web edition is an unofficial informational resource; legal research should verify the corresponding official edition or PDF on govinfo.gov.',
    fields: [
      queryField({ label: 'Search term', defaultValue: 'artificial intelligence', placeholder: 'e.g. artificial intelligence', minLength: 1, help: 'Search document titles and indexed Federal Register content.' }),
      limitField({ label: 'Documents', defaultValue: '8', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 recent documents.' }),
    ],
    buildUrl: ({ query = 'artificial intelligence', limit = '8' }) => {
      const params = new URLSearchParams({ per_page: limit.trim(), order: 'newest', 'conditions[term]': query.trim() })
      return `https://www.federalregister.gov/api/v1/documents.json?${params.toString()}`
    },
  },
  {
    id: 'wikipedia-search', name: 'Wikipedia Search', provider: 'Wikimedia Foundation', category: 'Knowledge',
    description: 'Search Wikipedia and return article extracts, thumbnails, page identifiers, and canonical titles.',
    documentationUrl: 'https://www.mediawiki.org/wiki/API:Search', accent: '#202122', monogram: 'WP',
    usageNote: 'Wikimedia asks API clients to identify themselves; browser requests send Api-User-Agent: Public-API/0.1 (https://yapweijun1996.github.io/Public-API/). Wikipedia article text is available under CC BY-SA terms with attribution and share-alike obligations. Article thumbnails can carry separate image licenses, so inspect the source file before reuse.',
    fields: [
      queryField({ label: 'Article search', defaultValue: 'Singapore', placeholder: 'e.g. Singapore', minLength: 1, help: 'Search English Wikipedia titles and article text.' }),
      limitField({ label: 'Results', defaultValue: '8', min: 1, max: 12, step: 1, help: 'Return between 1 and 12 matching pages.' }),
    ],
    headers: { 'Api-User-Agent': 'Public-API/0.1 (https://yapweijun1996.github.io/Public-API/)' },
    buildUrl: ({ query = 'Singapore', limit = '8' }) => {
      const params = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: query.trim(), gsrlimit: limit.trim(), prop: 'pageimages|extracts', exintro: '1', explaintext: '1', piprop: 'thumbnail', pithumbsize: '480', format: 'json', origin: '*' })
      return `https://en.wikipedia.org/w/api.php?${params.toString()}`
    },
  },
  {
    id: 'open-meteo-flood', name: 'Global Flood Forecast', provider: 'Open-Meteo', category: 'Environment',
    description: 'Inspect forecast river-discharge guidance for any coordinate.',
    documentationUrl: 'https://open-meteo.com/en/docs/flood-api', accent: '#0284c7', monogram: 'FL', risk: 'Review',
    usageNote: 'Hydrological model guidance only. Do not use this demo for emergency or life-safety decisions.',
    fields: [
      ...latLongFields(),
      { id: 'days', label: 'Forecast days', type: 'number', defaultValue: '7', min: 1, max: 30, step: 1, help: 'Return between 1 and 30 daily discharge values.' },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', days = '7' }) => {
      const params = new URLSearchParams({ latitude, longitude, daily: 'river_discharge,river_discharge_mean,river_discharge_max', forecast_days: days.trim() })
      return `https://flood-api.open-meteo.com/v1/flood?${params.toString()}`
    },
  },
  {
    id: 'open-meteo-history', name: 'Historical Weather', provider: 'Open-Meteo', category: 'Weather',
    description: 'Compare historical daily temperature and precipitation series for a selected place and date range.',
    documentationUrl: 'https://open-meteo.com/en/docs/historical-weather-api', accent: '#2563eb', monogram: 'HW',
    fields: [
      ...latLongFields(),
      { id: 'startDate', label: 'Start date', type: 'date', defaultValue: '2025-01-01', help: 'Open-Meteo requires an ISO date in YYYY-MM-DD format.' },
      { id: 'endDate', label: 'End date', type: 'date', defaultValue: '2025-01-14', minimumFromField: 'startDate', help: 'Open-Meteo requires YYYY-MM-DD; choose an end date on or after the start date.' },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', startDate = '2025-01-01', endDate = '2025-01-14' }) => {
      const params = new URLSearchParams({ latitude, longitude, start_date: startDate.trim(), end_date: endDate.trim(), daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum', timezone: 'auto' })
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
    buildUrl: ({ pair = 'XBTUSD' }) => {
      const supportedPair = ['XBTUSD', 'ETHUSD', 'SOLUSD', 'XBTEUR'].includes(pair) ? pair : 'XBTUSD'
      return `https://api.kraken.com/0/public/Ticker?${new URLSearchParams({ pair: supportedPair, assetVersion: '1' }).toString()}`
    },
  },
  {
    id: 'gitlab-public-projects', name: 'GitLab Public Projects', provider: 'GitLab', category: 'Developer',
    description: 'Discover public GitLab projects and compare stars, forks, activity, topics, and programming language.',
    documentationUrl: 'https://docs.gitlab.com/api/projects/', accent: '#fc6d26', monogram: 'GL',
    fields: [
      queryField({ label: 'Project search', defaultValue: 'artificial intelligence', placeholder: 'e.g. artificial intelligence', minLength: 1, help: 'Search public project names, paths, and descriptions.' }),
      limitField({ label: 'Projects', defaultValue: '8', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 public projects.' }),
    ],
    buildUrl: ({ query = 'artificial intelligence', limit = '8' }) => {
      const params = new URLSearchParams({ visibility: 'public', search: query.trim(), order_by: 'star_count', sort: 'desc', per_page: limit.trim() })
      return `https://gitlab.com/api/v4/projects?${params.toString()}`
    },
  },
  {
    id: 'uk-police-street-crime', name: 'UK Street Crime', provider: 'UK Home Office', category: 'Government',
    description: 'Explore recent anonymised street-level crime categories around a selected UK coordinate.',
    documentationUrl: 'https://data.police.uk/docs/method/crime-street/', accent: '#1d4f91', monogram: 'UP', risk: 'Review',
    usageNote: 'Locations are approximate and anonymised by the source. Present the data as area-level context, not individual-level evidence. persistent_id is the documented stable 64-character crime identity; API id is not guaranteed stable, so rows without persistent_id are withheld.',
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
    documentationUrl: 'https://api.openbrewerydb.org/docs/', accent: '#b7791f', monogram: 'BR',
    usageNote: 'Open Brewery DB is keyless. Its current API documentation states 60 requests per minute per IP and instructs clients that receive HTTP 429 to wait for the Retry-After period before retrying; keep automated checks bounded even if live rate-limit headers advertise a different temporary allowance.',
    automatedVerification: {
      mode: 'enabled',
      retryOnRateLimit: false,
      rateLimitStatuses: [429],
      reason: 'Open Brewery DB documents Retry-After handling for HTTP 429. Generic health verification records the rate-limit response and defers another provider request to a later independent run instead of immediately retrying.',
      policyUrl: 'https://api.openbrewerydb.org/docs/',
    },
    fields: [
      { id: 'country', label: 'Country', type: 'select', defaultValue: 'united_states', help: 'Filter the public brewery directory by country.', options: [
        { label: 'United States', value: 'united_states' }, { label: 'Ireland', value: 'ireland' }, { label: 'France', value: 'france' }, { label: 'South Korea', value: 'south_korea' },
      ] },
      { id: 'type', label: 'Brewery type', type: 'select', defaultValue: 'all', help: 'Optionally filter the business model.', options: [
        { label: 'All types', value: 'all' }, { label: 'Micro', value: 'micro' }, { label: 'Brewpub', value: 'brewpub' }, { label: 'Regional', value: 'regional' }, { label: 'Contract', value: 'contract' },
      ] },
    ],
    buildUrl: ({ country = 'united_states', type = 'all' }) => {
      const params = new URLSearchParams({ by_country: country.trim(), per_page: '8' })
      if (type.trim() !== 'all') params.set('by_type', type.trim())
      return `https://api.openbrewerydb.org/v1/breweries?${params.toString()}`
    },
  },
  {
    id: 'rick-morty-characters', name: 'Rick and Morty Characters', provider: 'Rick and Morty API', category: 'Entertainment',
    description: 'Search characters and inspect species, status, origin, current location, images, and episode counts.',
    documentationUrl: 'https://rickandmortyapi.com/documentation/#character', accent: '#22a2bd', monogram: 'RM',
    usageNote: 'The API project is open source under BSD, but its official About page says show data and images are used without an ownership claim and belong to their respective owners. Do not treat character images as BSD-licensed reusable media.',
    fields: [
      { id: 'name', label: 'Character name', type: 'text', defaultValue: 'Rick', minLength: 1, placeholder: 'e.g. Rick', help: 'Search character names using the provider’s documented partial-name filter.' },
      { id: 'status', label: 'Status', type: 'select', defaultValue: 'all', help: 'Optionally filter characters by the provider’s documented life-status values.', options: [
        { label: 'All statuses', value: 'all' }, { label: 'Alive', value: 'alive' }, { label: 'Dead', value: 'dead' }, { label: 'Unknown', value: 'unknown' },
      ] },
    ],
    buildUrl: ({ name = 'Rick', status = 'all' }) => {
      const params = new URLSearchParams({ name: name.trim() })
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
    id: 'openf1-historical', name: 'Jolpica F1 Qualifying', provider: 'Jolpica', category: 'Sports',
    description: 'Inspect Formula 1 qualifying classification, drivers, constructors, and Q1/Q2/Q3 lap times.',
    documentationUrl: 'https://github.com/jolpica/jolpica-f1/blob/main/docs/README.md', accent: '#e10600', monogram: 'F1', risk: 'Review',
    usageNote: 'This qualifying-specific Jolpica demo complements the separate drivers, constructors, and races catalogue demo. Keep automated request volume modest.',
    fields: [
      { id: 'season', label: 'Season', type: 'select', defaultValue: '2025', help: 'Choose a completed Formula 1 season.', options: [{ label: '2025', value: '2025' }, { label: '2024', value: '2024' }, { label: '2023', value: '2023' }] },
      { id: 'round', label: 'Race round', type: 'number', defaultValue: '1', min: 1, max: 30, help: 'Choose the Grand Prix round number.' },
    ],
    buildUrl: ({ season = '2025', round = '1' }) => `https://api.jolpi.ca/ergast/f1/${season || '2025'}/${String(clampInt(round, 1, 30, 1))}/qualifying/`,
  },
  {
    id: 'packagist-search', name: 'Packagist Package Search', provider: 'Packagist', category: 'Developer',
    description: 'Search Composer packages for metadata, stars, licenses, and source links.',
    documentationUrl: 'https://packagist.org/apidoc', accent: '#4f46e5', monogram: 'PKG',
    usageNote: 'Composer package search is anonymous and community maintained. Packagist recommends avoiding synchronized scheduled jobs, identifying API clients with a contact-bearing User-Agent, and limiting parallel requests to 10. Normal browser JavaScript cannot set User-Agent, so keep this browser demo and automated verification bounded.',
    fields: [
      queryField({ label: 'Package search', defaultValue: 'react', placeholder: 'e.g. react', minLength: 1, help: 'Search package names and descriptions.' }),
      limitField({ label: 'Packages', defaultValue: '8', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 package records.' }),
    ],
    buildUrl: ({ query = 'react', limit = '8' }) =>
      `https://packagist.org/search.json?${new URLSearchParams({ q: query.trim(), per_page: limit.trim() }).toString()}`,
  },
  {
    id: 'nhtsa-vehicle-recalls', name: 'NHTSA Vehicle Recalls', provider: 'NHTSA', category: 'Vehicle',
    description: 'Search U.S. vehicle recall campaigns by make, model, and year.',
    documentationUrl: 'https://www.nhtsa.gov/nhtsa-datasets-and-apis', accent: '#1f3fd4', monogram: 'NRC',
    fields: [
      { id: 'make', label: 'Vehicle make', type: 'text', defaultValue: 'honda', help: 'Use an American-style vehicle make such as Honda or Toyota.' },
      { id: 'model', label: 'Vehicle model', type: 'text', defaultValue: 'accord', help: 'Use a model name supported by the selected manufacturer.' },
      numberField('year', { label: 'Model year', defaultValue: '2020', min: 1949, max: localNow.getFullYear() + 1, step: 1, help: 'Narrow by model year to reduce response size.' }),
    ],
    buildUrl: ({ make = 'honda', model = 'accord', year = '2020' }) => {
      const query = new URLSearchParams({ make: make.trim(), model: model.trim(), modelYear: year.trim() })
      return `https://api.nhtsa.gov/recalls/recallsByVehicle?${query.toString()}`
    },
  },
  {
    id: 'anilist-graphql', name: 'AniList Media Search', provider: 'AniList', category: 'Entertainment',
    description: 'Search anime and manga titles with status, year, score, formats, genres, and cover images.',
    documentationUrl: 'https://docs.anilist.co/guide/graphql/', accent: '#2e51a2', monogram: 'ANI', method: 'POST', risk: 'Review',
    usageNote: 'AniList provides a public GraphQL API and documents rate-limit headers plus Retry-After on HTTP 429. Its normal quota may be temporarily reduced during degraded service, so keep browser checks bounded and never retry a 429 immediately.',
    automatedVerification: {
      mode: 'enabled',
      retryOnRateLimit: false,
      reason: 'AniList documents Retry-After and X-RateLimit-Reset on HTTP 429, and may temporarily lower its normal quota during degraded service. Generic health verification records the first 429 and defers another provider request to a later independent run.',
      policyUrl: 'https://docs.anilist.co/guide/rate-limiting',
    },
    fields: [
      queryField({ label: 'Anime or manga search', defaultValue: 'Fullmetal Alchemist', placeholder: 'e.g. Fullmetal Alchemist', help: 'Search titles by English or romanized name.' }),
      { id: 'mediaType', label: 'Media type', type: 'select', defaultValue: 'ANIME', help: 'Search anime or manga media.', options: [{ label: 'Anime', value: 'ANIME' }, { label: 'Manga', value: 'MANGA' }] },
      { id: 'page', label: 'Page', type: 'number', defaultValue: '1', min: 1, max: 10, help: 'Return page 1 to 10.' },
      limitField({ label: 'Results', defaultValue: '6', min: 1, max: 20, help: 'Return between 1 and 20 records.' }),
    ],
    buildUrl: () => 'https://graphql.anilist.co',
    buildBody: ({ query = 'Fullmetal Alchemist', mediaType = 'ANIME', page = '1', limit = '6' }) => ({
      query: `query ($search: String, $page: Int, $perPage: Int, $type: MediaType) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            perPage
            currentPage
            hasNextPage
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
        perPage: clampInt(limit, 1, 20, 6),
        type: mediaType.toUpperCase() === 'MANGA' ? 'MANGA' : 'ANIME',
      },
    }),
  },
  {
    id: 'openverse-search', name: 'Openverse Media Search', provider: 'Openverse', category: 'Media',
    description: 'Search openly licensed images and audio by keyword, then reuse attribution-ready media results.',
    documentationUrl: 'https://api.openverse.org/v1/', accent: '#24b1e0', monogram: 'OVR',
    usageNote: 'Anonymous Openverse requests are rate limited. Openverse aggregates openly licensed media but does not guarantee license metadata accuracy; verify each work’s source license and attribution requirements before reuse.',
    fields: [
      queryField({ label: 'Media search', defaultValue: 'space', placeholder: 'e.g. moon', minLength: 1, help: 'Search openly licensed media titles, descriptions, and tags.' }),
      { id: 'contentType', label: 'Media type', type: 'select', defaultValue: 'image', help: 'Query images or audio separately.', options: [{ label: 'Images', value: 'image' }, { label: 'Audio', value: 'audio' }] },
      limitField({ label: 'Results', defaultValue: '8', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 media records.' }),
    ],
    buildUrl: ({ query = 'space', contentType = 'image', limit = '8' }) => {
      const mediaPath = contentType === 'audio' ? 'audio' : contentType === 'image' ? 'images' : contentType.trim()
      return `https://api.openverse.org/v1/${mediaPath}/?${new URLSearchParams({ q: query.trim(), page_size: limit.trim(), page: '1' }).toString()}`
    },
  },
  {
    id: 'apple-itunes-search', name: 'Apple iTunes Search', provider: 'Apple', category: 'Media',
    description: 'Search Apple music and podcast catalog identities, metadata, and storefront links without embedding promotional artwork or previews.',
    documentationUrl: 'https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html',
    accent: '#f4af3f', monogram: 'ITN',
    usageNote: 'Apple defines entity values relative to the selected media type and documents an approximate 20 calls/minute Search API limit subject to change. This demo exposes compatible music/podcast result types and derives the media parameter from that declared entity. Apple promotional-content terms impose store-promotion, badge, attribution, streaming, and placement conditions, so the semantic card intentionally does not embed artwork or audio/video previews.',
    fields: [
      queryField({ label: 'Search term', defaultValue: 'Beatles', placeholder: 'e.g. Beatles', minLength: 1, help: 'Search across Apple public media indexes.' }),
      { id: 'entity', label: 'Result type', type: 'select', defaultValue: 'song', help: 'Choose one result entity; Public-API derives the compatible Apple media category from this same selection.', options: appleItunesEntityOptions },
      { id: 'country', label: 'Country', type: 'text', defaultValue: 'sg', placeholder: 'e.g. sg', minLength: 2, maxLength: 2, pattern: '[A-Za-z]{2}', patternDescription: 'must contain exactly two letters for an ISO 3166-1 alpha-2 country code.', help: 'Use a two-letter ISO 3166-1 alpha-2 country code for the iTunes Store storefront, such as SG or US.' },
      limitField({ label: 'Results', defaultValue: '8', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 results.' }),
    ],
    buildUrl: ({ query = 'Beatles', entity = 'song', country = 'sg', limit = '8' }) => {
      const media = appleItunesPodcastEntities.has(entity) ? 'podcast' : 'music'
      return `https://itunes.apple.com/search?${new URLSearchParams({
        term: query.trim(),
        media,
        entity,
        country: country.trim().toLowerCase(),
        limit: limit.trim(),
      }).toString()}`
    },
  },
  {
    id: 'hebcal-calendar', name: 'Hebcal Calendar', provider: 'Hebcal', category: 'Calendar',
    description: 'Browse a full Hebrew year of Jewish holidays, weekly Torah portions, Rosh Chodesh, and modern observances.',
    documentationUrl: 'https://www.hebcal.com/home/195/jewish-calendar-rest-api', accent: '#9f7aea', monogram: 'HB',
    usageNote: 'Hebcal Jewish Calendar API content is CC BY 4.0 and requires attribution. No API key is required. Hebcal warns that clients making more than 90 requests in a 10-second window may receive HTTP 429, so automated checks stay bounded and do not immediately retry a rate-limited request.',
    automatedVerification: {
      mode: 'enabled',
      retryOnRateLimit: false,
      rateLimitStatuses: [429],
      reason: 'Hebcal documents HTTP 429 after more than 90 requests in a 10-second window. Automated verification records the first 429 and defers another provider request instead of compounding the rate limit.',
      policyUrl: 'https://www.hebcal.com/home/developer-apis',
    },
    fields: [
      { id: 'year', label: 'Hebrew year', type: 'number', defaultValue: '5787', min: 5700, max: 5800, step: 1, help: 'Use a four-digit Hebrew year. Public-API sends yt=H so the provider interprets the year as Hebrew, not Gregorian.' },
      { id: 'israel', label: 'Holiday schedule', type: 'select', defaultValue: 'off', help: 'Choose the Diaspora or Israel holiday schedule for the full Hebrew year.', options: [{ label: 'Diaspora', value: 'off' }, { label: 'Israel', value: 'on' }] },
    ],
    buildUrl: ({ year = '5787', israel = 'off' }) => `https://www.hebcal.com/hebcal?${new URLSearchParams({
      v: '1', cfg: 'json', year: year.trim(), yt: 'H', month: 'x',
      maj: 'on', min: 'on', mod: 'on', nx: 'on', mf: 'on', ss: 'on', s: 'on', leyning: 'off', i: israel,
    }).toString()}`,
  },
  {
    id: 'aladhan-prayer-times', name: 'AlAdhan Prayer Times', provider: 'Al-Adhan', category: 'Calendar',
    description: 'Return prayer timings, Hijri date metadata, and calculation data from coordinates.',
    documentationUrl: 'https://aladhan.com/prayer-times-api', accent: '#5a6ee1', monogram: 'ADH',
    usageNote: 'The calculation-method selector is limited to AlAdhan’s current built-in method IDs. Method 11 is the default Singapore preset. Custom method 99 is excluded because this demo does not expose the required methodSettings contract.',
    fields: [
      ...latLongFields({
        latitude: { defaultValue: '1.3521', help: 'Use a valid WGS84 latitude from -90 to 90.' },
        longitude: { defaultValue: '103.8198', help: 'Use a valid WGS84 longitude from -180 to 180.' },
      }),
      { id: 'method', label: 'Calculation method', type: 'select', defaultValue: '11', help: 'Choose one built-in method advertised by AlAdhan. Method 11 is the Singapore preset.', options: aladhanMethodOptions },
      { id: 'date', label: 'Date', type: 'date', defaultValue: today, help: 'Use a Gregorian date in YYYY-MM-DD format. Public-API converts it to AlAdhan’s DD-MM-YYYY path format.' },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', method = '11', date = today }) => {
      const safeMethod = aladhanMethodOptions.some((option) => option.value === method) ? method : '11'
      return `https://api.aladhan.com/v1/timings/${toDmyDate(date || today)}?${new URLSearchParams({
        latitude: latitude.trim() || '1.3521',
        longitude: longitude.trim() || '103.8198',
        method: safeMethod,
      }).toString()}`
    },
  },
  {
    id: 'jolpica-f1', name: 'Jolpica F1 Data', provider: 'Jolpica', category: 'Sports',
    description: 'Browse Formula 1 season driver, constructor, or race-catalogue records from the Ergast-compatible Jolpica API.',
    documentationUrl: 'https://github.com/jolpica/jolpica-f1/blob/main/docs/README.md', accent: '#e10600', monogram: 'JOL', risk: 'Review',
    usageNote: 'Non-commercial use under CC BY-NC-SA 4.0. Unauthenticated access is currently limited to 4 requests/second and 500 requests/hour; cache historical data where practical. The dataset selector changes the response shape: drivers and constructors are season participation catalogues, while races are the season calendar, not standings or race results.',
    fields: [
      { id: 'season', label: 'Season', type: 'select', defaultValue: '2025', help: 'Choose an F1 season.', options: [{ label: '2025', value: '2025' }, { label: '2024', value: '2024' }, { label: '2023', value: '2023' }] },
      { id: 'dataset', label: 'Dataset', type: 'select', defaultValue: 'drivers', help: 'Pick a public F1 data table.', options: [{ label: 'Drivers', value: 'drivers' }, { label: 'Constructors', value: 'constructors' }, { label: 'Races', value: 'races' }] },
      limitField({ label: 'Rows', defaultValue: '8', min: 1, max: 30, help: 'Return between 1 and 30 rows.' }),
    ],
    buildUrl: ({ season = '2025', dataset = 'drivers', limit = '8' }) => {
      const safeLimit = clampInt(limit, 1, 30, 8)
      const safeDataset = ['drivers', 'constructors', 'races'].includes(dataset) ? dataset : 'drivers'
      return `https://api.jolpi.ca/ergast/f1/${season || '2025'}/${safeDataset}.json?${new URLSearchParams({ limit: String(safeLimit) }).toString()}`
    },
  },
  {
    id: 'hn-search-algolia', name: 'HN Search', provider: 'Algolia', category: 'News',
    description: 'Search Hacker News stories and comments with scoring, points, and publication data.',
    documentationUrl: 'https://hn.algolia.com/api', accent: '#ff6600', monogram: 'HN',
    fields: [
      queryField({ label: 'Search term', defaultValue: 'OpenAI', placeholder: 'e.g. OpenAI', minLength: 1, help: 'Search public Hacker News posts and comments.' }),
      { id: 'tag', label: 'Content type', type: 'select', defaultValue: 'story', help: 'Choose stories or comments.', options: [{ label: 'Stories', value: 'story' }, { label: 'Comments', value: 'comment' }, { label: 'Stories and comments', value: '(story,comment)' }] },
      limitField({ label: 'Results', defaultValue: '6', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 search hits.' }),
    ],
    buildUrl: ({ query = 'OpenAI', tag = 'story', limit = '6' }) =>
      `https://hn.algolia.com/api/v1/search?${new URLSearchParams({ query: query.trim(), tags: tag, hitsPerPage: limit.trim() }).toString()}`,
  },
  {
    id: 'bank-of-canada-valet', name: 'Bank of Canada Valet', provider: 'Bank of Canada', category: 'Finance',
    description: 'Read official BOC observations such as USD/CAD and interest-rate series.',
    documentationUrl: 'https://www.bankofcanada.ca/valet-api-how-to/', accent: '#0066cc', monogram: 'BOC', risk: 'Review',
    fields: [
      { id: 'series', label: 'Series', type: 'text', defaultValue: 'FXUSDCAD', placeholder: 'e.g. FXUSDCAD', minLength: 1, pattern: '[A-Za-z0-9_.-]+', patternDescription: 'must be one Bank of Canada series code using only letters, digits, underscores, periods, or hyphens.', help: 'Use one public Bank of Canada series code. This card intentionally renders one request-bound series at a time.' },
      { id: 'startDate', label: 'Start date', type: 'date', defaultValue: isoDate(daysAgo(30)), help: 'Bank of Canada Valet requires YYYY-MM-DD.' },
      { id: 'endDate', label: 'End date', type: 'date', defaultValue: today, minimumFromField: 'startDate', help: 'Bank of Canada Valet requires YYYY-MM-DD on or after the start date.' },
    ],
    buildUrl: ({ series = 'FXUSDCAD', startDate = isoDate(daysAgo(30)), endDate = today }) =>
      `https://www.bankofcanada.ca/valet/observations/${encode(series.trim())}/json?${new URLSearchParams({ start_date: startDate.trim(), end_date: endDate.trim() }).toString()}`,
  },
  {
    id: 'swiss-transit-connections', name: 'Swiss Transit Connections', provider: 'Swiss Mobility', category: 'Utility',
    description: 'Search Swiss public-transit connections by origin and destination with transfers and timing metadata.',
    keywords: ['train connections', 'rail journey', 'public transport'],
    documentationUrl: 'https://transport.opendata.ch/docs.html', accent: '#009966', monogram: 'SCT',
    fields: [
      { id: 'from', label: 'Origin', type: 'text', defaultValue: 'Zurich', placeholder: 'e.g. Zurich', minLength: 1, help: 'Enter a station or place name.' },
      { id: 'to', label: 'Destination', type: 'text', defaultValue: 'Geneva', placeholder: 'e.g. Geneva', minLength: 1, help: 'Enter a destination station or place name.' },
      limitField({ label: 'Connections', defaultValue: '6', min: 1, max: 10, step: 1, help: 'Return between 1 and 10 connections.' }),
    ],
    buildUrl: ({ from = 'Zurich', to = 'Geneva', limit = '6' }) =>
      `https://transport.opendata.ch/v1/connections?${new URLSearchParams({ from: from.trim(), to: to.trim(), limit: limit.trim() }).toString()}`,
  },
  {
    id: 'nasa-power-climate', name: 'NASA POWER Climate', provider: 'NASA POWER', category: 'Environment',
    description: 'Fetch climate and weather variables such as temperature, humidity, solar radiation, and precipitation.',
    keywords: ['climate data by coordinates', 'weather by coordinates', 'daily climate variables'],
    documentationUrl: 'https://power.larc.nasa.gov/docs/', accent: '#0b3d91', monogram: 'PWR', risk: 'Review',
    fields: [
      ...latLongFields(),
      { id: 'startDate', label: 'Start date', type: 'date', defaultValue: isoDate(daysAgo(30)), help: 'Choose an ISO date in YYYY-MM-DD format. Public-API converts it to NASA POWER’s YYYYMMDD wire format.' },
      { id: 'endDate', label: 'End date', type: 'date', defaultValue: today, minimumFromField: 'startDate', help: 'Choose an ISO date in YYYY-MM-DD format on or after the start date. Public-API converts it to NASA POWER’s YYYYMMDD wire format.' },
      { id: 'parameters', label: 'Parameters', type: 'text', defaultValue: 'T2M,PRECTOTCORR,WS10M,RH2M,ALLSKY_SFC_SW_DWN', minLength: 1, help: 'Comma-separated POWER parameter codes.' },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', startDate = isoDate(daysAgo(30)), endDate = today, parameters = 'T2M,PRECTOTCORR,WS10M,RH2M,ALLSKY_SFC_SW_DWN' }) => {
      const start = startDate.trim()
      const end = endDate.trim()
      const providerStart = isIsoCalendarDate(start) ? start.replace(/-/g, '') : start
      const providerEnd = isIsoCalendarDate(end) ? end.replace(/-/g, '') : end
      return `https://power.larc.nasa.gov/api/temporal/daily/point?${new URLSearchParams({
        parameters: parameters.trim(),
        community: 'AG',
        latitude,
        longitude,
        start: providerStart,
        end: providerEnd,
        format: 'JSON',
      }).toString()}`
    },
  },
  {
    id: 'open-meteo-elevation', name: 'Open-Meteo Elevation', provider: 'Open-Meteo', category: 'Geo',
    description: 'Fetch terrain elevation in meters for selected WGS84 coordinates from the Copernicus DEM 2021 GLO-90 dataset.',
    documentationUrl: 'https://open-meteo.com/en/docs/elevation-api', accent: '#047857', monogram: 'ELV', usageNote: 'Copernicus DEM 2021 GLO-90 terrain data at 90 m resolution. Open-Meteo requires clear attribution to both the Copernicus programme and Open-Meteo.',
    fields: [
      ...latLongFields(),
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198' }) =>
      `https://api.open-meteo.com/v1/elevation?${new URLSearchParams({
        latitude: latitude || '1.3521',
        longitude: longitude || '103.8198',
      }).toString()}`,
  },
  {
    id: 'zippopotam-postcode', name: 'Zippopotam Postcode', provider: 'Zippopotam', category: 'Geo',
    description: 'Convert a country code and postal code into city, state, and coordinate metadata.',
    documentationUrl: 'https://docs.zippopotam.us/docs/v1/', accent: '#2d9cdb', monogram: 'ZIP', risk: 'Review',
    usageNote: 'Zippopotam.us v1 looks up places by ISO 3166-1 alpha-2 country and country-specific postal code; one postal code may return multiple places, and the documented latitude/longitude fields are JSON strings. Use focused user-driven lookups rather than broad scans.',
    fields: [
      { id: 'country', label: 'Country code', type: 'text', defaultValue: 'us', placeholder: 'e.g. us', minLength: 2, maxLength: 2, pattern: '[A-Za-z]{2}', patternDescription: 'must contain exactly two letters for an ISO 3166-1 alpha-2 country code.', help: 'Use a supported ISO 3166-1 alpha-2 country code such as US, GB, or MY.' },
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
      queryField({ label: 'News search', defaultValue: 'NASA', minLength: 1, placeholder: 'e.g. NASA', help: 'Search titles and summaries from indexed spaceflight publishers.' }),
      limitField({ label: 'Articles', defaultValue: '6', min: 1, max: 10, step: 1, help: 'Return between 1 and 10 articles.' }),
    ],
    buildUrl: ({ query = 'NASA', limit = '6' }) => {
      return `https://api.spaceflightnewsapi.net/v4/articles/?${new URLSearchParams({ search: query, limit, ordering: '-published_at' }).toString()}`
    },
  },
  {
    id: 'launch-library-upcoming', name: 'Upcoming Space Launches', provider: 'The Space Devs', category: 'Calendar',
    description: 'Track upcoming rocket launches with mission, provider, pad, status, image, and scheduled launch time.',
    documentationUrl: 'https://ll.thespacedevs.com/', accent: '#0f766e', monogram: 'LL',
    usageNote: 'Launch Library 2.3.0 is the current supported production API; 2.2.0 is unsupported. Anonymous production access is limited to 15 requests per hour. Automated verification is conservatively spaced to at most one production request every four minutes; use the provider development endpoint for repeated integration testing.',
    automatedVerification: {
      mode: 'cadence-limited',
      minimumIntervalSeconds: 240,
      retryOnNon2xx: false,
      reason: 'TheSpaceDevs documents anonymous Launch Library access at up to 15 requests per hour. Automated production verification therefore spaces probes by at least four minutes and never adds an immediate same-run retry after a non-2xx response.',
      policyUrl: 'https://thespacedevs.com/llapi',
    },
    fields: [
      queryField({ label: 'Launch search', defaultValue: 'SpaceX', placeholder: 'e.g. SpaceX', minLength: 1, maxLength: 120, help: 'Filter upcoming launches by the provider\'s documented mission, launch, pad, rocket, spacecraft, or launch-service-provider search fields.' }),
      limitField({ label: 'Launches', defaultValue: '4', min: 1, max: 6, step: 1, help: 'Return between 1 and 6 upcoming launches.' }),
    ],
    buildUrl: ({ query = 'SpaceX', limit = '4' }) => `https://ll.thespacedevs.com/2.3.0/launches/upcoming/?${new URLSearchParams({ search: query.trim(), limit, ordering: 'net' }).toString()}`,
  },
  {
    id: 'wiktionary-entry', name: 'Wiktionary Definitions', provider: 'Wikimedia Foundation', category: 'Language',
    description: 'Look up structured English definitions, parts of speech, examples, related words, and language information.',
    documentationUrl: 'https://en.wiktionary.org/api/rest_v1/', accent: '#7c3aed', monogram: 'WK',
    fields: [{ id: 'word', label: 'English word', type: 'text', defaultValue: 'hello', placeholder: 'e.g. serendipity', minLength: 1, help: 'Enter one English Wiktionary headword.' }],
    buildUrl: ({ word = 'hello' }) => `https://en.wiktionary.org/api/rest_v1/page/definition/${encode(word)}`,
  },
  {
    id: 'animechan-random-quote', name: 'Anime Quote Generator', provider: 'AnimeChan', category: 'Entertainment',
    description: 'Generate an anime quote with its character and series metadata for cards, prompts, and entertainment demos.',
    documentationUrl: 'https://animechan.io/docs', accent: '#2e51a2', monogram: 'AC',
    usageNote: 'The keyless free tier allows 100 requests per day per IP address. Exceeding that limit returns HTTP 429, and the free-tier window refills 24 hours after its first request. Keep requests user-driven and avoid high-frequency refreshes.',
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
    usageNote: 'DummyJSON supplies synthetic placeholder data intended for prototypes, demonstrations, and UI development. Its repository code licence does not establish reuse rights for individual recipe content or images.',
    fields: [
      queryField({ label: 'Recipe search', defaultValue: 'pasta', minLength: 1, placeholder: 'e.g. pasta', help: 'Search recipe names and indexed recipe text.' }),
      limitField({ label: 'Recipes', defaultValue: '6', min: 1, max: 10, step: 1, help: 'Return between 1 and 10 recipes.' }),
    ],
    buildUrl: ({ query = 'pasta', limit = '6' }) => {
      return `https://dummyjson.com/recipes/search?${new URLSearchParams({ q: query.trim(), limit: limit.trim() }).toString()}`
    },
  },
  {
    id: 'brasilapi-postcode', name: 'Brazil Postcode Explorer', provider: 'BrasilAPI', category: 'Geo',
    description: 'Resolve a Brazilian CEP into address, neighbourhood, city, state, timezone, provider, and coordinates.',
    documentationUrl: 'https://brasilapi.com.br/docs#tag/CEP-V2', accent: '#16a34a', monogram: 'BP',
    usageNote: 'Use bounded single-CEP lookups only. BrasilAPI asks clients not to crawl or full-scan the CEP range.',
    fields: [{
      id: 'postcode',
      label: 'Brazilian CEP',
      type: 'text',
      defaultValue: '01310930',
      placeholder: 'e.g. 01310-930',
      pattern: '\\d{5}-?\\d{3}',
      patternDescription: 'must contain exactly eight digits, optionally formatted as 12345-678.',
      help: 'Enter exactly eight digits, with or without a hyphen.',
    }],
    buildUrl: ({ postcode = '01310930' }) => `https://brasilapi.com.br/api/cep/v2/${encode(postcode.trim().replace('-', ''))}`,
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
    usageNote: 'Shared keyless IP-based rate-limit pool for light, non-commercial experimentation. CoinGecko says HTTP 429 means the rate limit was exceeded, to reduce call frequency, and that all requests including 4xx/5xx count toward the per-minute limit.',
    automatedVerification: {
      mode: 'enabled',
      retryOnRateLimit: false,
      reason: 'CoinGecko says HTTP 429 means the rate limit was exceeded and all requests, including errors, count toward the per-minute limit. Generic health verification records the first 429 and defers another provider request to a later independent run instead of immediately adding another counted call.',
      policyUrl: 'https://docs.coingecko.com/docs/errors-and-rate-limits',
    },
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
    description: 'Track Malaysia’s monthly overall core consumer price index, with index level and reporting month kept explicit.',
    documentationUrl: 'https://data.gov.my/data-catalogue/cpi_core', accent: '#0284c7', monogram: 'MCC', risk: 'Review',
    usageNote: 'DOSM defines this as a monthly CPI index with base 2010 = 100, not an inflation percentage. Core CPI excludes volatile-price or government-administered items. The demo filters division=overall and retains CC BY 4.0 attribution.',
    fields: [limitField({ label: 'Months', defaultValue: '12', min: 6, max: 60, step: 1, help: 'Return between 6 and 60 monthly overall-index observations.' })],
    buildUrl: ({ limit = '12' }) => `https://api.data.gov.my/data-catalogue/?${new URLSearchParams({ id: 'cpi_core', filter: 'overall@division', limit: limit.trim(), sort: '-date' }).toString()}`,
  },
  {
    id: 'malaysia-household-income', name: 'Malaysia Household Income', provider: 'data.gov.my', category: 'Economy',
    description: 'Compare Malaysia mean and median nominal gross monthly household income across published HIES survey observations.',
    documentationUrl: 'https://data.gov.my/data-catalogue/hh_income', accent: '#0369a1', monogram: 'MHI', risk: 'Review',
    usageNote: 'DOSM publishes nominal RM values that are not inflation-adjusted. HIES observations are survey years, not a complete consecutive annual series.',
    fields: [limitField({ label: 'Survey observations', defaultValue: '10', min: 6, max: 30, step: 1, help: 'Return between 6 and 30 published HIES observations.' })],
    buildUrl: ({ limit = '10' }) => `https://api.data.gov.my/data-catalogue/?${new URLSearchParams({ id: 'hh_income', limit: limit.trim(), sort: '-date' }).toString()}`,
  },
  {
    id: 'malaysia-population', name: 'Malaysia Population', provider: 'data.gov.my', category: 'Economy',
    description: 'Track Malaysia national total population by year using both sexes, all ages, and all ethnicities.',
    documentationUrl: 'https://data.gov.my/data-catalogue/population_malaysia', accent: '#0ea5e9', monogram: 'MPO', risk: 'Review',
    usageNote: "DOSM publishes population in thousands of people ('000). This demo filters all demographic dimensions to their overall totals so each row is one national yearly observation.",
    fields: [limitField({ label: 'Years', defaultValue: '10', min: 6, max: 57, step: 1, help: 'Return between 6 and 57 annual national-total observations.' })],
    buildUrl: ({ limit = '10' }) => `https://api.data.gov.my/data-catalogue/?${new URLSearchParams({ id: 'population_malaysia', filter: 'both@sex,overall@age,overall@ethnicity', limit: limit.trim(), sort: '-date' }).toString()}`,
  },
  {
    id: 'openfda-food-recalls', name: 'openFDA Food Recalls', provider: 'U.S. FDA', category: 'Food',
    description: 'Explore FDA food recall notices by product, manufacturer, reason, and enforcement event.',
    documentationUrl: 'https://open.fda.gov/apis/food/enforcement/', accent: '#4f46e5', monogram: 'OFR', risk: 'Review',
    fields: [
      queryField({ label: 'Recall search', defaultValue: 'peanut', placeholder: 'e.g. peanut', minLength: 1, maxLength: 80, pattern: '[^"\\\\]+', patternDescription: 'must not contain double quotes or backslashes because those characters alter openFDA search syntax.', help: 'Search one quoted phrase across FDA product descriptions and reasons for recall.' }),
      limitField({ label: 'Records', defaultValue: '8', min: 1, max: 30, help: 'Return between 1 and 30 records.' }),
    ],
    buildUrl: ({ query = 'peanut', limit = '8' }) => {
      const safeLimit = clampInt(limit, 1, 30, 8)
      const phrase = query.trim() || 'peanut'
      return `https://api.fda.gov/food/enforcement.json?${new URLSearchParams({
        search: `product_description:"${phrase}" OR reason_for_recall:"${phrase}"`,
        limit: String(safeLimit),
      }).toString()}`
    },
  },
  {
    id: 'iconify-search', name: 'Iconify Search', provider: 'Iconify', category: 'Utility',
    description: 'Search Iconify icon identifiers and preserve the matching icon-set author and licence metadata for UI prototyping.',
    documentationUrl: 'https://iconify.design/docs/api/search.html', accent: '#7c3aed', monogram: 'ICS', usageNote: 'Show icon licensing and attribution context when exporting catalog entries.',
    fields: [
      queryField({ label: 'Icon keyword', defaultValue: 'home', placeholder: 'e.g. home', help: 'Search icon keywords across public sets.' }),
      limitField({ label: 'Icons', defaultValue: '32', min: 32, max: 60, help: 'Iconify accepts 32 to 999 search results; this demo caps the browser payload at 60.' }),
    ],
    buildUrl: ({ query = 'home', limit = '32' }) => {
      const safeLimit = clampInt(limit, 32, 60, 32)
      return `https://api.iconify.design/search?${new URLSearchParams({ query: query.trim() || 'home', limit: String(safeLimit) }).toString()}`
    },
  },
  {
    id: 'homebrew-formula-json', name: 'Homebrew Formula JSON', provider: 'Homebrew', category: 'Developer',
    description: 'Inspect one exact Homebrew formula or cask token, preserving package identity, version, dependencies or app artifacts, licence, and platform metadata.',
    documentationUrl: 'https://formulae.brew.sh/docs/api/', accent: '#ef4444', monogram: 'HBF',
    usageNote: 'Homebrew API is community-maintained; keep request volume low for reliability.',
    fields: [
      { id: 'formula', label: 'Formula or cask token', type: 'text', defaultValue: 'node', placeholder: 'e.g. node', minLength: 1, help: 'Enter the exact current Homebrew formula/cask token used in formulae.brew.sh URLs; aliases and former tokens are not direct JSON endpoint names.' },
      { id: 'collection', label: 'Collection', type: 'select', defaultValue: 'formula', help: 'Select Formula or Cask metadata source.',
        options: [{ label: 'Formula', value: 'formula' }, { label: 'Cask', value: 'cask' }] },
    ],
    buildUrl: ({ formula = 'node', collection = 'formula' }) => {
      const name = encode(formula.trim() || 'node')
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
    description: 'Inspect gbOpen administrative-boundary layer metadata, provenance, per-unit geometry statistics, and provider download links.',
    documentationUrl: 'https://www.geoboundaries.org/api.html', accent: '#0369a1', monogram: 'GBD',
    usageNote: 'geoBoundaries requires attribution for programmatic/API use. This demo uses gbOpen. The returned boundaryLicense is the original source-data license; geometry is provided through download URLs, and meanAreaSqKM/meanPerimeterLengthKM are averages across administrative units rather than total country measurements. Country code ALL is supported but returns a large multi-country layer collection; prefer a specific ISO code when you only need one country.',
    fields: [
      { id: 'countryIso', label: 'Country ISO', type: 'text', defaultValue: 'SGP', minLength: 3, maxLength: 3, pattern: '[A-Za-z]{3}', patternDescription: 'must contain exactly three letters (an ISO 3166-1 alpha-3 code or the special ALL code).', help: 'Use an ISO 3166-1 alpha-3 country code such as SGP, GBR, or USA. The special ALL code returns a multi-country collection for the selected administrative level.' },
      { id: 'adminLevel', label: 'Admin level', type: 'select', defaultValue: 'ADM0', help: 'geoBoundaries accepts ADM0 through ADM5, but available levels vary by country.',
        options: [{ label: 'ADM0', value: 'ADM0' }, { label: 'ADM1', value: 'ADM1' }, { label: 'ADM2', value: 'ADM2' }, { label: 'ADM3', value: 'ADM3' }, { label: 'ADM4', value: 'ADM4' }, { label: 'ADM5', value: 'ADM5' }] },
    ],
    buildUrl: ({ countryIso = 'SGP', adminLevel = 'ADM0' }) =>
      `https://www.geoboundaries.org/api/current/gbOpen/${encode((countryIso || 'SGP').toUpperCase())}/${encode(adminLevel || 'ADM0')}/`,
  },
  {
    id: 'osrm-route', name: 'OSRM Route', provider: 'Project OSRM', category: 'Geo',
    description: 'Calculate route distance, estimated duration, snapped endpoints, route geometry, and turn-by-turn steps on public roads from start to destination.',
    documentationUrl: 'https://project-osrm.org/docs/v26.6.1/http', accent: '#0f766e', monogram: 'OSR',
    usageNote: 'The public OSRM demo server is restricted to reasonable, non-commercial use, must not exceed 1 request per second, and provides no uptime, latency, or data-update guarantees. Keep requests bounded; self-host OSRM for production workloads.',
    automatedVerification: {
      mode: 'cadence-limited',
      minimumIntervalSeconds: 1,
      retryOnNon2xx: false,
      reason: 'The official OSRM demo-server policy says not to exceed one request per second. Automated verification therefore uses a cadence-aware journey and does not immediately retry a non-2xx response.',
      policyUrl: 'https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server',
    },
    fields: [
      { id: 'startLatitude', label: 'Start latitude', type: 'number', defaultValue: '1.3521', min: -90, max: 90, help: 'Source latitude in degrees.' },
      { id: 'startLongitude', label: 'Start longitude', type: 'number', defaultValue: '103.8198', min: -180, max: 180, help: 'Source longitude in degrees.' },
      { id: 'endLatitude', label: 'End latitude', type: 'number', defaultValue: '1.290270', min: -90, max: 90, help: 'Destination latitude in degrees.' },
      { id: 'endLongitude', label: 'End longitude', type: 'number', defaultValue: '103.851959', min: -180, max: 180, help: 'Destination longitude in degrees.' },
      numberField('alternatives', { label: 'Alternatives', defaultValue: '1', min: 1, max: 3, step: 1, help: 'Request up to one to three alternative routes; OSRM does not guarantee that every requested alternative exists.' }),
    ],
    buildUrl: ({ startLatitude = '1.3521', startLongitude = '103.8198', endLatitude = '1.290270', endLongitude = '103.851959', alternatives = '1' }) => {
      const coordinate = (value: string) => {
        const trimmed = value.trim()
        const parsed = Number(trimmed)
        return trimmed && Number.isFinite(parsed) ? String(parsed) : trimmed
      }
      const route = `${coordinate(startLongitude)},${coordinate(startLatitude)};${coordinate(endLongitude)},${coordinate(endLatitude)}`
      return `https://router.project-osrm.org/route/v1/driving/${route}?${new URLSearchParams({
        alternatives: alternatives.trim(),
        geometries: 'geojson',
        overview: 'full',
        steps: 'true',
      }).toString()}`
    },
  },
  {
    id: 'opendota-pro-matches', name: 'OpenDota Matches', provider: 'OpenDota', category: 'Games',
    description: 'Pull the provider-defined recent batch of professional Dota 2 matches with league and team metadata for esports inspection.',
    documentationUrl: 'https://docs.opendota.com/', accent: '#16a34a', monogram: 'ODT',
    usageNote: 'OpenDota /proMatches does not expose a result-count limit; it currently returns a provider-sized recent batch and supports less_than_match_id only for older-match pagination. The Request Lab therefore does not claim a non-existent limit control.',
    fields: [],
    buildUrl: () => 'https://api.opendota.com/api/proMatches',
  },
  {
    id: 'openligadb-matches', name: 'OpenLigaDB', provider: 'OpenLigaDB', category: 'Sports',
    description: 'Read community football match schedules and outcomes from OpenLigaDB leagues.',
    documentationUrl: 'https://api.openligadb.de/', accent: '#0284c7', monogram: 'OLB',
    usageNote: 'OpenLigaDB is a community-maintained, keyless API whose data is licensed under ODbL 1.0. The provider asks clients to query sparingly and documents a limit of 60 requests per minute and IP.',
    fields: [
      { id: 'league', label: 'League shortcut', type: 'text', defaultValue: 'bl1', placeholder: 'e.g. bl1', help: 'Use a short league identifier, such as bl1.' },
      { id: 'season', label: 'Season year', type: 'number', defaultValue: '2025', min: 2000, max: localNow.getFullYear(), help: 'Use a published season start year.' },
      { id: 'matchday', label: 'Matchday', type: 'number', defaultValue: '1', min: 1, max: 50, help: 'Load one matchday to keep the browser response small and reliable.' },
    ],
    buildUrl: ({ league = 'bl1', season = '2025', matchday = '1' }) => {
      const safeSeason = clampInt(season, 2000, localNow.getFullYear(), 2025)
      const safeMatchday = clampInt(matchday, 1, 50, 1)
      return `https://api.openligadb.de/getmatchdata/${encode(league || 'bl1')}/${String(safeSeason)}/${String(safeMatchday)}`
    },
  },
  {
    id: 'uk-parliament-members', name: 'UK Parliament Members', provider: 'UK Parliament', category: 'Government',
    description: 'Search current members of the UK House of Commons or House of Lords with party and latest-house membership metadata.',
    documentationUrl: 'https://members-api.parliament.uk/index.html', accent: '#7c3aed', monogram: 'UKM',
    fields: [
      queryField({ label: 'Member name', defaultValue: 'Rishi', placeholder: 'e.g. Rishi', help: 'Match current Commons or Lords members whose name contains this text.' }),
      limitField({ label: 'Members', defaultValue: '10', min: 1, max: 20, help: 'Return between 1 and 20 members. The provider calls this parameter take and caps it at 20.' }),
    ],
    buildUrl: ({ query = 'Rishi', limit = '10' }) => {
      const safeLimit = clampInt(limit, 1, 20, 10)
      return `https://members-api.parliament.uk/api/Members/Search?${new URLSearchParams({
        Name: query.trim() || 'Rishi',
        skip: '0',
        take: String(safeLimit),
      }).toString()}`
    },
  },
  {
    id: 'mlb-stats-api', name: 'MLB Stats', provider: 'MLB', category: 'Sports',
    description: 'Pull MLB schedule snapshots and scoreboard data for date-based sports viewing and trend surfaces.',
    documentationUrl: 'https://github.com/toddrob99/MLB-StatsAPI/wiki/Endpoints', accent: '#0891b2', monogram: 'MLBS', risk: 'Review',
    usageNote: 'Unofficial MLB Stats API; this demo is intentionally fixed to MLB sportId=1 so Minor League schedules are not presented as MLB. MLB content/copyright terms apply.',
    fields: [
      { id: 'date', label: 'Schedule date', type: 'date', defaultValue: today, help: 'Use a published game date in YYYY-MM-DD format.' },
    ],
    buildUrl: ({ date = today }) => {
      const targetDate = isIsoCalendarDate(date.trim()) ? date.trim() : today
      const params = new URLSearchParams({
        sportId: '1',
        date: targetDate,
      })
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
      { id: 'name', label: 'Domain name', type: 'text', defaultValue: 'example.com', placeholder: 'e.g. example.com', minLength: 1, help: 'Enter a domain name to resolve. Google requires a non-empty DNS name; escaped-label and trailing-dot length rules remain provider-validated.' },
      { id: 'type', label: 'Record type', type: 'select', defaultValue: 'A', help: 'Choose a DNS record type.', options: [
        { label: 'A (IPv4)', value: 'A' }, { label: 'AAAA (IPv6)', value: 'AAAA' }, { label: 'MX (Mail)', value: 'MX' },
        { label: 'TXT', value: 'TXT' }, { label: 'CNAME', value: 'CNAME' }, { label: 'NS', value: 'NS' },
      ] },
    ],
    buildUrl: ({ name = 'example.com', type = 'A' }) => `https://dns.google/resolve?${new URLSearchParams({ name: name.trim(), type }).toString()}`,
  },
  {
    id: 'color-api', name: 'The Color API', provider: 'TheColorAPI', category: 'Utility',
    description: 'Convert a hex color into RGB, HSL, HSV, CMYK, a named color match, and a contrast recommendation.',
    documentationUrl: 'https://www.thecolorapi.com/docs', accent: '#24b1e0', monogram: 'HEX',
    fields: [{ id: 'hex', label: 'Hex color', type: 'text', defaultValue: '24B1E0', placeholder: 'e.g. 24B1E0', pattern: '#?(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})', patternDescription: 'must be a 3- or 6-digit hexadecimal color, with an optional leading #.', help: 'Enter 3 or 6 hexadecimal digits, with or without the leading #.' }],
    buildUrl: ({ hex = '24B1E0' }) => `https://www.thecolorapi.com/id?hex=${encode((hex || '24B1E0').replace(/^#/, ''))}`,
  },
  {
    id: 'nasa-image-search', name: 'NASA Image & Video Library', provider: 'NASA', category: 'Media',
    description: 'Search NASA imagery, video, and audio with titles, descriptions, and thumbnail links.',
    documentationUrl: 'https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf', accent: '#0b3d91', monogram: 'NASA',
    usageNote: 'NASA Images search defaults to 100 results per page; this browser demo requests eight. NASA content is generally not subject to U.S. copyright, but NASA brand identifiers and some third-party material have separate restrictions. Acknowledge NASA as the source and review NASA Media Usage Guidelines before reuse.',
    fields: [
      { id: 'query', label: 'Search term', type: 'text', defaultValue: 'moon', placeholder: 'e.g. moon', minLength: 1, help: 'Search NASA media titles and descriptions.' },
      { id: 'mediaType', label: 'Media type', type: 'select', defaultValue: 'image', help: 'Filter by media type.', options: [{ label: 'Image', value: 'image' }, { label: 'Video', value: 'video' }, { label: 'Audio', value: 'audio' }] },
    ],
    buildUrl: ({ query = 'moon', mediaType = 'image' }) => `https://images-api.nasa.gov/search?${new URLSearchParams({ q: query.trim(), media_type: mediaType, page_size: '8' }).toString()}`,
  },
  {
    id: 'lichess-top-players', name: 'Lichess Top Players', provider: 'Lichess', category: 'Games',
    description: 'Browse the current Lichess leaderboard for a chosen time control, including titles and ratings.',
    documentationUrl: 'https://lichess.org/api', accent: '#3893e8', monogram: 'LI',
    usageNote: 'Public read-only endpoint. Lichess asks clients to make only one API request at a time and, after HTTP 429, wait a full minute before resuming API usage.',
    automatedVerification: {
      mode: 'enabled',
      retryOnRateLimit: false,
      reason: 'Lichess says clients receiving HTTP 429 must wait a full minute before resuming API usage; generic health verification records the first 429 and defers another provider request to a later independent run.',
      policyUrl: 'https://lichess.org/page/api-tips',
    },
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
    usageNote: 'NCBI recommends no more than 3 E-utility requests per second without an API key and encourages distributed software developers to register tool/email identifiers. This bounded search returns PMIDs only; NCBI disclaimer and copyright terms apply to downstream content.',
    fields: [
      { id: 'term', label: 'Search term', type: 'text', defaultValue: 'covid', minLength: 1, placeholder: 'e.g. covid', help: 'Search PubMed indexed terms and MeSH headings.' },
      { id: 'retmax', label: 'Results', type: 'number', defaultValue: '5', min: 1, max: 10, step: 1, help: 'Return between 1 and 10 article identifiers.' },
    ],
    buildUrl: ({ term = 'covid', retmax = '5' }) => `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${new URLSearchParams({ db: 'pubmed', term: term.trim(), retmode: 'json', retmax: retmax.trim() }).toString()}`,
  },
  {
    id: 'rxnorm-drug-search', name: 'RxNorm Drug Search', provider: 'U.S. National Library of Medicine', category: 'Health', risk: 'Review',
    description: 'Look up standardized drug names, brand products, and dosage forms from the RxNorm terminology.',
    documentationUrl: 'https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html', accent: '#0369a1', monogram: 'RX',
    usageNote: 'Data source: U.S. National Library of Medicine (NLM) RxNorm. For terminology normalization demonstrations only. Never treat this response as medical or prescribing advice.',
    fields: [{ id: 'name', label: 'Drug name', type: 'text', defaultValue: 'ibuprofen', minLength: 1, placeholder: 'e.g. ibuprofen', help: 'Enter a generic or brand drug name.' }],
    buildUrl: ({ name = 'ibuprofen' }) => `https://rxnav.nlm.nih.gov/REST/drugs.json?${new URLSearchParams({ name: name.trim() }).toString()}`,
  },
  {
    id: 'inaturalist-observations', name: 'iNaturalist Observations', provider: 'iNaturalist', category: 'Biodiversity',
    description: 'Browse real, photographed species observations with location, date, and taxonomy.',
    documentationUrl: 'https://www.inaturalist.org/pages/api+reference', accent: '#74ac00', monogram: 'INAT',
    fields: [
      { id: 'taxonName', label: 'Species search', type: 'text', defaultValue: 'Panthera', placeholder: 'e.g. Panthera', minLength: 1, help: 'Search by scientific or common name. Taxon-name matches can include descendant taxa.' },
      { id: 'perPage', label: 'Observations', type: 'number', defaultValue: '6', min: 1, max: 10, step: 1, help: 'Return between 1 and 10 observations.' },
    ],
    usageNote: 'Public read-only search. Keep automated requests near 1 request/second and about 10,000/day; respect HTTP 429 throttling. Photo rights are per image. iNaturalist warns that obscured API records can still expose exact dates and other clues; the semantic card coarsens restricted dates and withholds place labels, while Raw JSON remains the provider response.',
    automatedVerification: {
      mode: 'enabled',
      retryOnRateLimit: false,
      rateLimitStatuses: [429],
      reason: 'iNaturalist recommends about one API request per second and around 10,000 requests per day, and may throttle excess traffic with HTTP 429. Generic verification records the 429 and defers another provider request instead of immediately retrying.',
      policyUrl: 'https://www.inaturalist.org/pages/api+recommended+practices',
    },
    buildUrl: ({ taxonName = 'Panthera', perPage = '6' }) => `https://api.inaturalist.org/v1/observations?${new URLSearchParams({ taxon_name: taxonName.trim(), per_page: perPage, photos: 'true' }).toString()}`,
  },
]

const verifiedSecondExpansionApis: ApiDemo[] = [
  {
    id: 'first-epss', name: 'FIRST EPSS Score', provider: 'FIRST.org', category: 'Developer',
    description: 'Look up a CVE\'s Exploit Prediction Scoring System probability and percentile of real-world exploitation.',
    documentationUrl: 'https://www.first.org/epss/api', accent: '#b42318', monogram: 'EPS', risk: 'Review',
    usageNote: 'EPSS is a probability estimate, not a guarantee of exploitation. Use alongside CVSS and CISA KEV status.',
    fields: [cveField('CVE identifier')],
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
    description: 'Inspect a package\'s published versions, default release, publish dates, and deprecation status across supported ecosystems.',
    keywords: ['package versions', 'default package version', 'package deprecation'],
    documentationUrl: 'https://docs.deps.dev/api/v3/', accent: '#4285f4', monogram: 'DD',
    fields: [
      { id: 'system', label: 'Package ecosystem', type: 'select', defaultValue: 'npm', help: 'Choose a package system.', options: [
        { label: 'npm', value: 'npm' }, { label: 'PyPI', value: 'pypi' }, { label: 'Maven', value: 'maven' }, { label: 'Go', value: 'go' }, { label: 'Cargo', value: 'cargo' },
      ] },
      { id: 'packageName', label: 'Package name', type: 'text', defaultValue: 'react', minLength: 1, placeholder: 'e.g. react', help: 'Enter a package name for the selected ecosystem.' },
    ],
    buildUrl: ({ system = 'npm', packageName = 'react' }) => `https://api.deps.dev/v3/systems/${encode(system || 'npm')}/packages/${encode(packageName || 'react')}`,
  },
  {
    id: 'ecb-fx-rates', name: 'Coinbase Exchange Rates', provider: 'Coinbase', category: 'Finance',
    description: 'Read current fiat and crypto exchange rates for a selected base currency from Coinbase.',
    documentationUrl: 'https://docs.cdp.coinbase.com/coinbase-app/track-apis/exchange-rates', accent: '#0052ff', monogram: 'CBX',
    fields: [{ id: 'currency', label: 'Base currency', type: 'select', defaultValue: 'EUR', help: 'Choose the base currency for the rate table.', options: [
      { label: 'Euro', value: 'EUR' }, { label: 'US Dollar', value: 'USD' }, { label: 'Singapore Dollar', value: 'SGD' }, { label: 'British Pound', value: 'GBP' },
    ] }],
    buildUrl: ({ currency = 'EUR' }) => `https://api.coinbase.com/v2/exchange-rates?${new URLSearchParams({ currency: currency || 'EUR' }).toString()}`,
  },
  {
    id: 'un-sdg-goals', name: 'UN Sustainable Development Goals', provider: 'United Nations Statistics Division', category: 'Government',
    description: 'Browse the official United Nations Sustainable Development Goal catalogue with goal codes, titles, descriptions, and API paths.',
    documentationUrl: 'https://unstats.un.org/SDGAPI/swagger/', accent: '#1cabe2', monogram: 'SDG',
    fields: [],
    buildUrl: () => 'https://unstats.un.org/SDGAPI/v1/sdg/Goal/List',
  },
  {
    id: 'datacite-search', name: 'DataCite DOI Search', provider: 'DataCite', category: 'Research',
    description: 'Search DOI records for research datasets, software, preprints, and publications.',
    documentationUrl: 'https://support.datacite.org/docs/api', accent: '#00b1e2', monogram: 'DC',
    fields: [
      { id: 'query', label: 'Research query', type: 'text', defaultValue: 'climate change', placeholder: 'e.g. climate change', minLength: 1, help: 'Search DataCite-indexed titles and metadata.' },
      { id: 'count', label: 'Results', type: 'number', defaultValue: '5', min: 1, max: 10, step: 1, help: 'Return between 1 and 10 DOI records.' },
    ],
    buildUrl: ({ query = 'climate change', count = '5' }) =>
      `https://api.datacite.org/dois?${new URLSearchParams({ query: query.trim(), 'page[size]': count.trim() }).toString()}`,
    automatedVerification: {
      mode: 'enabled',
      retryOnRateLimit: false,
      reason: 'DataCite returns HTTP 429 when rate limited and recommends incremental backoff after failures. Generic health verification records the first 429 and defers another provider request to a later independent run instead of immediately retrying.',
      policyUrl: 'https://support.datacite.org/docs/rate-limit',
    },
  },
  {
    id: 'ror-search', name: 'ROR Organization Registry', provider: 'Research Organization Registry', category: 'Research',
    description: 'Look up standardized identifiers, names, locations, and links for universities and research institutions.',
    documentationUrl: 'https://ror.readme.io/docs/rest-api', accent: '#1a4cb3', monogram: 'ROR',
    fields: [{ id: 'query', label: 'Organization search', type: 'text', defaultValue: 'stanford', placeholder: 'e.g. stanford', minLength: 1, help: 'Search research organization names or external identifiers for an interactive choice.' }],
    buildUrl: ({ query = 'stanford' }) => `https://api.ror.org/v2/organizations?${new URLSearchParams({ query: query.trim() }).toString()}`,
  },
  {
    id: 'celestrak-satellites', name: 'CelesTrak Orbital Elements', provider: 'CelesTrak', category: 'Geo',
    description: 'Inspect a bounded CelesTrak General Perturbations orbital-element set for space stations or operational GPS satellites.',
    keywords: ['satellite orbit', 'orbital elements', 'space stations', 'GPS satellites'],
    documentationUrl: 'https://celestrak.org/NORAD/documentation/gp-data-formats.php', accent: '#111827', monogram: 'SAT',
    usageNote: 'CelesTrak JSON uses CCSDS OMM keywords for GP elements. Values describe an orbit at the supplied epoch, not a live position. This browser demo intentionally excludes large Active and Starlink groups to reduce provider load and payload size. GP data updates about every two hours; automated verification must not poll more often than the update cadence and must stop immediately after any non-200 response.',
    automatedVerification: {
      mode: 'cadence-limited',
      minimumIntervalSeconds: 7200,
      retryOnNon2xx: false,
      reason: 'CelesTrak asks machine clients to download GP data only once per update and to stop immediately after any non-200 response.',
      policyUrl: 'https://celestrak.org/usage-policy.php',
    },
    fields: [{ id: 'group', label: 'Bounded satellite group', type: 'select', defaultValue: 'stations', help: 'Choose a bounded GP group. Large Active and Starlink sets are intentionally excluded from this browser demo.', options: [
      { label: 'Space stations', value: 'stations' }, { label: 'GPS operational', value: 'gps-ops' },
    ] }],
    buildUrl: ({ group = 'stations' }) => `https://celestrak.org/NORAD/elements/gp.php?${new URLSearchParams({ GROUP: group || 'stations', FORMAT: 'json' }).toString()}`,
  },
  {
    id: 'cleveland-museum-search', name: 'Cleveland Museum Open Access', provider: 'The Cleveland Museum of Art', category: 'Media',
    description: 'Search image-bearing artwork records explicitly designated CC0 by the museum\'s open-access program.',
    documentationUrl: 'https://www.clevelandart.org/open-access-api', accent: '#8b1d3f', monogram: 'CMA',
    usageNote: 'This demo explicitly requests image-bearing records marked CC0 by the Cleveland Museum of Art. CMA waives its applicable rights through CC0, but its terms disclaim warranties about third-party rights; verify the source artwork page before downstream reuse.',
    fields: [
      { id: 'query', label: 'Artwork search', type: 'text', defaultValue: 'monet', minLength: 1, placeholder: 'e.g. monet', help: 'Search artwork titles, artists, or subjects.' },
      { id: 'limit', label: 'Results', type: 'number', defaultValue: '6', min: 1, max: 10, step: 1, help: 'Return between 1 and 10 artworks.' },
    ],
    buildUrl: ({ query = 'monet', limit = '6' }) => {
      const params = new URLSearchParams({ q: query.trim(), limit: limit.trim(), has_image: '1', cc0: '' })
      return `https://openaccess-api.clevelandart.org/api/artworks/?${params.toString()}`
    },
  },
  {
    id: 'scryfall-card-search', name: 'Scryfall Card Search', provider: 'Scryfall', category: 'Games',
    description: 'Search Magic: The Gathering cards with mana cost, type, set, and full card artwork.',
    documentationUrl: 'https://scryfall.com/docs/api', accent: '#f97316', monogram: 'MTG',
    usageNote: 'Scryfall asks clients to stay under 10 requests per second and never power through HTTP 429 responses. Requests use HTTPS and send Accept: application/json; the browser supplies its own User-Agent because application code cannot set the forbidden User-Agent header. Keep searches interactive and modest.',
    automatedVerification: {
      mode: 'enabled',
      retryOnRateLimit: false,
      rateLimitStatuses: [429],
      reason: 'Scryfall documents a rate limit under 10 requests per second and asks clients not to power through 429 responses; this verifier makes one live request and never immediately retries a 429.',
      policyUrl: 'https://scryfall.com/docs/faqs',
    },
    fields: [{ id: 'query', label: 'Card search', type: 'text', defaultValue: 'dragon', minLength: 1, placeholder: 'e.g. dragon', help: 'Search card names, types, or rules text.' }],
    headers: { Accept: 'application/json' },
    buildUrl: ({ query = 'dragon' }) => `https://api.scryfall.com/cards/search?${new URLSearchParams({ q: query.trim() }).toString()}`,
  },
  {
    id: 'dnd5e-spell-lookup', name: 'D&D 5e Spell Lookup', provider: 'D&D 5e API', category: 'Games',
    description: 'Look up a Dungeons & Dragons 5th edition spell with range, components, and effect description.',
    documentationUrl: 'https://www.dnd5eapi.co/docs/', accent: '#7c2d12', monogram: 'DND',
    fields: [{ id: 'spellIndex', label: 'Spell', type: 'text', defaultValue: 'fireball', minLength: 1, maxLength: 80, pattern: '[a-z0-9]+(?:-[a-z0-9]+)*', patternDescription: 'must be a lowercase D&D 5e resource slug using letters, numbers, and single hyphens.', placeholder: 'e.g. fireball', help: 'Enter the exact 2014 spell resource slug, such as magic-missile.' }],
    buildUrl: ({ spellIndex = 'fireball' }) => `https://www.dnd5eapi.co/api/2014/spells/${encode(spellIndex)}`,
  },
  {
    id: 'qr-code-generator', name: 'QR Code Generator', provider: 'goQR.me', category: 'Utility',
    description: 'Generate a scannable QR code image for any text or URL, entirely from a GET request.',
    documentationUrl: 'https://goqr.me/api/', accent: '#111827', monogram: 'QR',
    usageNote: 'The response body is a binary PNG image, not JSON; the Response details tab shows a metadata summary instead.',
    fields: [
      { id: 'data', label: 'Text or URL', type: 'text', defaultValue: 'https://example.com', placeholder: 'e.g. https://example.com', help: 'Enter the text or URL to encode.' },
      { id: 'size', label: 'Image size', type: 'select', defaultValue: '200x200', help: 'Choose the output image dimensions.', options: [{ label: '150 × 150', value: '150x150' }, { label: '200 × 200', value: '200x200' }, { label: '300 × 300', value: '300x300' }] },
    ],
    headers: { Accept: 'image/png' },
    buildUrl: ({ data = 'https://example.com', size = '200x200' }) => `https://api.qrserver.com/v1/create-qr-code/?${new URLSearchParams({ data: data.trim() || 'https://example.com', size: size || '200x200' }).toString()}`,
    responseType: 'image',
    responseContentTypes: ['image/png'],
  },
  {
    id: 'where-the-iss-at', name: 'Where The ISS At', provider: 'Where The ISS At', category: 'Geo',
    description: 'Track the International Space Station\'s current latitude, longitude, altitude, and velocity.',
    documentationUrl: 'https://wheretheiss.at/w/developer', accent: '#0ea5e9', monogram: 'ISS',
    usageNote: 'The provider limits requests to roughly one per second. This demo makes one current-position request per user run and reports provider orbital position data in kilometers.',
    fields: [],
    buildUrl: () => 'https://api.wheretheiss.at/v1/satellites/25544',
  },
]

const verifiedThirdExpansionApis: ApiDemo[] = [
  {
    id: 'eurostat-population', name: 'Eurostat Population Statistics', provider: 'Eurostat', category: 'Economy',
    description: 'Read Eurostat population-on-1-January totals by country and published reference year.',
    documentationUrl: 'https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-getting-started', accent: '#003399', monogram: 'EU',
    usageNote: 'Uses Eurostat dataset demo_pjan with annual frequency, unit Number, age Total, and sex Total. The dataset currently publishes through reference year 2025.',
    fields: [
      { id: 'country', label: 'Country', type: 'select', defaultValue: 'DE', help: 'Choose an EU member state.', options: [
        { label: 'Germany', value: 'DE' }, { label: 'France', value: 'FR' }, { label: 'Italy', value: 'IT' }, { label: 'Spain', value: 'ES' }, { label: 'Netherlands', value: 'NL' },
      ] },
      { id: 'year', label: 'Reference year', type: 'number', defaultValue: '2025', min: 2010, max: 2025, step: 1, help: 'Choose a published demo_pjan reference year from 2010 through 2025.' },
    ],
    buildUrl: ({ country = 'DE', year = '2025' }) => `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_pjan?${new URLSearchParams({ format: 'JSON', geo: country, sex: 'T', age: 'TOTAL', time: year }).toString()}`,
  },
  {
    id: 'bls-timeseries', name: 'BLS Labor Statistics', provider: 'U.S. Bureau of Labor Statistics', category: 'Economy',
    description: 'Read official U.S. economic time series including unemployment rate and consumer price index.',
    documentationUrl: 'https://www.bls.gov/developers/api_signature.htm', accent: '#005ea2', monogram: 'BLS',
    usageNote: 'Uses BLS Public Data API Version 1.0 because it is the explicitly unregistered public API. The single-series GET returns the past three years. Unregistered users may make 25 queries per day and up to 50 requests per 10 seconds. Cite the API retrieval date and state that BLS cannot vouch for data or analyses after retrieval. BLS may limit or block attempts to exceed or circumvent usage limits.',
    automatedVerification: {
      mode: 'enabled',
      retryOnRateLimit: false,
      rateLimitStatuses: [429],
      reason: 'BLS limits unregistered Version 1.0 users to 25 queries per day and returns HTTP 429 when query limits are exceeded. Automated verification records the first 429 and defers another provider request to a later independent run instead of immediately consuming another query.',
      policyUrl: 'https://www.bls.gov/developers/api_FAQs.htm',
    },
    fields: [{ id: 'seriesId', label: 'Series', type: 'select', defaultValue: 'LNS14000000', help: 'Choose a tracked BLS time series.', options: [
      { label: 'Unemployment rate', value: 'LNS14000000' }, { label: 'CPI — all items', value: 'CUUR0000SA0' }, { label: 'CPI — food', value: 'CUUR0000SAF1' },
    ] }],
    buildUrl: ({ seriesId = 'LNS14000000' }) => `https://api.bls.gov/publicAPI/v1/timeseries/data/${encode(seriesId || 'LNS14000000')}`,
  },
  {
    id: 'fema-disasters', name: 'FEMA Disaster Declarations', provider: 'FEMA OpenFEMA', category: 'Government',
    description: 'Browse recently declared geographic areas within United States federal disaster declarations.',
    documentationUrl: 'https://www.fema.gov/about/openfema/disaster-declarations-summaries', accent: '#1a4480', monogram: 'FEMA',
    usageNote: 'DisasterDeclarationsSummaries is area-level: one federal declaration can appear in many rows, one per designated geographic area. OpenFEMA describes the source as raw NEMIS data that may contain a small percentage of human error.',
    fields: [{ id: 'limit', label: 'Declared-area rows', type: 'number', defaultValue: '5', min: 1, max: 10, help: 'Return between 1 and 10 recent designated-area records; repeated disaster IDs are expected.' }],
    buildUrl: ({ limit = '5' }) => {
      const safeLimit = Math.min(10, Math.max(1, Number.parseInt(limit, 10) || 5))
      return `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?${new URLSearchParams({ '$top': String(safeLimit), '$orderby': 'declarationDate desc' }).toString()}`
    },
  },
  {
    id: 'noaa-tides', name: 'NOAA Tides & Currents', provider: 'NOAA Tides and Currents', category: 'Weather',
    description: "Read NOAA CO-OPS' latest coastal water-level observation with station, datum, timestamp, and quality-control context.",
    documentationUrl: 'https://api.tidesandcurrents.noaa.gov/api/prod/', accent: '#0f6ba3', monogram: 'TIDE',
    usageNote: 'The demo requests NOAA CO-OPS water_level date=latest, which NOAA defines as the last available data point within 18 minutes. Values are metric relative to MLLW and timestamps use GMT; the provider may mark the latest value preliminary or verified.',
    fields: [{ id: 'station', label: 'CO-OPS station', type: 'select', defaultValue: '8518750', help: 'Choose a NOAA coastal water-level station.', options: [
      { label: 'The Battery, NY', value: '8518750' }, { label: 'San Francisco, CA', value: '9414290' }, { label: 'Key West, FL', value: '8724580' },
    ] }],
    buildUrl: ({ station = '8518750' }) => `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${new URLSearchParams({ station: station || '8518750', product: 'water_level', date: 'latest', datum: 'MLLW', units: 'metric', time_zone: 'gmt', application: 'Public_API_Workbench', format: 'json' }).toString()}`,
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
    keywords: ['spell check', 'proofreading', 'grammar correction'],
    documentationUrl: 'https://languagetool.org/http-api/', accent: '#39a845', monogram: 'LT',
    usageNote: 'For interactive, human-driven checks only. The free public endpoint prohibits automated requests; use a self-hosted or Enterprise instance for automation. Submitted text is sent to LanguageTool: do not send confidential text.',
    agentExecution: {
      mode: 'manual-only',
      reason: 'LanguageTool’s free public endpoint prohibits automated requests. Use a self-hosted or Enterprise instance for automation.',
      policyUrl: 'https://dev.languagetool.org/public-http-api.html',
    },
    fields: [{ id: 'text', label: 'Text to check', type: 'text', defaultValue: 'This are a test.', placeholder: 'e.g. This are a test.', help: 'Enter a short English sentence to check.' }],
    method: 'POST', bodyEncoding: 'form',
    buildUrl: () => 'https://api.languagetool.org/v2/check',
    buildBody: ({ text = 'This are a test.' }) => ({ text: text.trim() || 'This are a test.', language: 'en-US' }),
  },
  {
    id: 'doaj-search', name: 'DOAJ Open Access Articles', provider: 'Directory of Open Access Journals', category: 'Research',
    description: 'Search fully open-access journal articles with authors, journal, and identifiers.',
    documentationUrl: 'https://doaj.org/api/docs', accent: '#f68212', monogram: 'DOAJ',
    usageNote: 'DOAJ states its website search and API remain fully open and current after the March 2026 Premium Metadata Services change. Article metadata is publisher-supplied discovery metadata and may contain source errors.',
    fields: [
      { id: 'query', label: 'Article search', type: 'text', defaultValue: 'climate', placeholder: 'e.g. climate', minLength: 1, help: 'Search open-access article titles and metadata.' },
      { id: 'pageSize', label: 'Results', type: 'number', defaultValue: '5', min: 1, max: 10, step: 1, help: 'Return between 1 and 10 articles.' },
    ],
    buildUrl: ({ query = 'climate', pageSize = '5' }) =>
      `https://doaj.org/api/search/articles/${encode(query.trim())}?${new URLSearchParams({ pageSize }).toString()}`,
  },
  {
    id: 'pubchem-compound', name: 'PubChem Compound Lookup', provider: 'PubChem', category: 'Research',
    description: 'Look up a chemical compound\'s molecular formula, weight, and IUPAC name by common name.',
    documentationUrl: 'https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest-tutorial', accent: '#2e6da4', monogram: 'PCH',
    fields: [{ id: 'name', label: 'Compound name', type: 'text', defaultValue: 'aspirin', placeholder: 'e.g. aspirin', minLength: 1, help: 'Enter a common chemical or drug name.' }],
    buildUrl: ({ name = 'aspirin' }) => `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encode(name.trim() || 'aspirin')}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`,
  },
  {
    id: 'chembl-molecule', name: 'ChEMBL Molecule Profile', provider: 'ChEMBL', category: 'Health', risk: 'Review',
    description: 'Inspect a ChEMBL molecule\'s development phase, calculated properties, structure identifiers, and classifications.',
    documentationUrl: 'https://www.ebi.ac.uk/chembl/api/data/docs', accent: '#6a1b9a', monogram: 'CHM',
    usageNote: 'For research and education demonstrations only. Not a substitute for clinical or regulatory drug information.',
    fields: [{ id: 'chemblId', label: 'ChEMBL ID', type: 'text', defaultValue: 'CHEMBL25', placeholder: 'e.g. CHEMBL25', help: 'Enter a ChEMBL molecule identifier (CHEMBL25 is aspirin).' }],
    buildUrl: ({ chemblId = 'CHEMBL25' }) => `https://www.ebi.ac.uk/chembl/api/data/molecule/${encode(chemblId || 'CHEMBL25')}.json`,
  },
  {
    id: 'uniprot-protein', name: 'UniProt Protein Lookup', provider: 'UniProt', category: 'Research',
    description: 'Look up a protein\'s function, organism, gene, and annotation score by accession number.',
    documentationUrl: 'https://www.uniprot.org/help/accession_numbers', accent: '#00639c', monogram: 'UNI',
    fields: [{ id: 'accession', label: 'UniProt accession', type: 'text', defaultValue: 'P05067', placeholder: 'e.g. P05067', pattern: '[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2}', patternDescription: 'must be a valid 6- or 10-character UniProtKB accession.', help: 'Use the official 6- or 10-character UniProtKB accession format, such as P05067 or A0A023GPI8.' }],
    buildUrl: ({ accession = 'P05067' }) => `https://rest.uniprot.org/uniprotkb/${encode(accession.trim() || 'P05067')}.json`,
  },
  {
    id: 'rcsb-pdb-entry', name: 'RCSB Protein Data Bank Entry', provider: 'RCSB PDB', category: 'Research',
    description: 'Inspect an experimentally determined PDB structure\'s method, archive facts, and primary publication details.',
    documentationUrl: 'https://www.rcsb.org/docs/programmatic-access/web-apis-overview', accent: '#4a4a4a', monogram: 'PDB',
    usageNote: 'RCSB and wwPDB are transitioning to 12-character extended PDB IDs. This direct core-entry demo accepts a current four-character PDB ID or its official transitional pdb_0000XXXX alias; because the live Data API does not currently resolve that alias directly, the browser normalizes the one-to-one transitional form back to its four-character ID at the provider boundary. Extended-only IDs issued after the July 21, 2027 archive transition are not yet claimed as supported and this contract must be re-evaluated before that cutover.',
    fields: [{ id: 'entryId', label: 'PDB entry ID', type: 'text', defaultValue: '4HHB', placeholder: 'e.g. 4HHB or pdb_00004hhb', minLength: 4, maxLength: 12, pattern: '(?:[A-Za-z0-9]{4}|[Pp][Dd][Bb]_0000[A-Za-z0-9]{4})', patternDescription: 'must be a four-character PDB ID or a transitional pdb_0000XXXX extended alias for an entry that still has a legacy ID.', help: 'Enter 4HHB or its transitional extended alias pdb_00004hhb. Extended-only IDs issued after the 2027 transition are not yet supported by this direct core-entry demo.' }],
    buildUrl: ({ entryId = '4HHB' }) => {
      const normalized = (entryId.trim() || '4HHB').toUpperCase()
      const transitionalAlias = normalized.match(/^PDB_0000([A-Z0-9]{4})$/)
      const providerEntryId = transitionalAlias?.[1] ?? normalized
      return `https://data.rcsb.org/rest/v1/core/entry/${encode(providerEntryId)}`
    },
  },
  {
    id: 'ensembl-gene-lookup', name: 'Ensembl Gene Lookup', provider: 'Ensembl', category: 'Research',
    description: 'Inspect an Ensembl gene\'s stable identity, species, genome assembly location, strand, biotype, description, and canonical transcript when supplied.',
    documentationUrl: 'https://rest.ensembl.org/documentation/info/lookup', accent: '#7a1fa2', monogram: 'ENS',
    usageNote: 'Ensembl lookup/id accepts stable IDs for genes, transcripts, proteins, and other features. This demo accepts only unversioned Ensembl gene stable IDs and requires the returned ID to match with object_type Gene. The classic REST service remains available but is frozen at Ensembl release 116; newer datasets are moving to the new Ensembl platform and its GraphQL/refget services.',
    fields: [{
      id: 'geneId', label: 'Ensembl gene ID', type: 'text', defaultValue: 'ENSG00000157764', placeholder: 'e.g. ENSG00000157764',
      pattern: 'ENS[A-Z]*G[0-9]{11}', patternDescription: 'must be an unversioned Ensembl gene stable ID such as ENSG00000157764.',
      help: 'Enter an unversioned Ensembl gene stable ID (default is human BRAF). Transcript, protein, and version-suffixed IDs are rejected before the provider request.',
    }],
    buildUrl: ({ geneId = 'ENSG00000157764' }) => `https://rest.ensembl.org/lookup/id/${encode(geneId.trim() || 'ENSG00000157764')}?${new URLSearchParams({ 'content-type': 'application/json' }).toString()}`,
  },
  {
    id: 'obis-marine-occurrences', name: 'OBIS Marine Occurrences', provider: 'Ocean Biodiversity Information System', category: 'Biodiversity',
    description: 'Inspect OBIS marine occurrence records by scientific name with occurrence status, record basis, event date, coordinates, dataset provenance, and provider QC flags.',
    documentationUrl: 'https://api.obis.org/', accent: '#0b6e99', monogram: 'OBIS',
    usageNote: 'OBIS aggregates Darwin Core occurrence records from many datasets with varying licences and data quality. Keep occurrence status, source dataset, identifiers, coordinates and provider QC flags visible rather than treating every returned row as equivalent evidence.',
    fields: [
      { id: 'scientificName', label: 'Species (scientific name)', type: 'text', defaultValue: 'Delphinus delphis', placeholder: 'e.g. Delphinus delphis', minLength: 1, help: 'Enter a marine species scientific name. OBIS may resolve historical or synonym names to a current accepted scientific name.' },
      { id: 'size', label: 'Occurrences', type: 'number', defaultValue: '5', min: 1, max: 10, step: 1, help: 'Return between 1 and 10 occurrence records.' },
    ],
    buildUrl: ({ scientificName = 'Delphinus delphis', size = '5' }) => `https://api.obis.org/v3/occurrence?${new URLSearchParams({ scientificname: scientificName.trim(), size: size.trim() }).toString()}`,
  },
  {
    id: 'worms-species-lookup', name: 'WoRMS Marine Species Registry', provider: 'World Register of Marine Species', category: 'Biodiversity',
    description: 'Resolve a marine scientific name in WoRMS while preserving whether the queried name is accepted and, when it is not, the current accepted name and AphiaID.',
    documentationUrl: 'https://www.marinespecies.org/rest/', accent: '#0e7c86', monogram: 'WMS',
    usageNote: 'WoRMS AphiaRecords preserve the queried name and its taxonomic status. valid_AphiaID identifies the current final accepted name; do not hide synonym or unaccepted-name relationships. AphiaRecordsByName documents HTTP 204 as Nothing found.',
    successNoContent: { statuses: [204], data: [] },
    fields: [{ id: 'name', label: 'Species (scientific name)', type: 'text', defaultValue: 'Delphinus delphis', placeholder: 'e.g. Delphinus delphis', help: 'Enter a marine species scientific name.' }],
    buildUrl: ({ name = 'Delphinus delphis' }) => `https://www.marinespecies.org/rest/AphiaRecordsByName/${encode(name || 'Delphinus delphis')}?${new URLSearchParams({ like: 'false' }).toString()}`,
  },
  {
    id: 'paleobiodb-taxa', name: 'Paleobiology Database Taxa', provider: 'Paleobiology Database', category: 'Nature',
    description: 'Inspect a Paleobiology Database taxon with rank, accepted-name identity, extancy, and the provider’s fossil-occurrence count.',
    documentationUrl: 'https://paleobiodb.org/data1.2/', accent: '#7a5230', monogram: 'PBDB',
    usageNote: 'PBDB defines n_occs as fossil occurrences identified as the named taxon or any of its subtaxa. It is not a direct-only count for the exact name.',
    fields: [{ id: 'name', label: 'Taxon name', type: 'text', defaultValue: 'Tyrannosaurus', placeholder: 'e.g. Tyrannosaurus', help: 'Enter a genus or species name.' }],
    buildUrl: ({ name = 'Tyrannosaurus' }) => `https://paleobiodb.org/data1.2/taxa/list.json?${new URLSearchParams({ name: name.trim() || 'Tyrannosaurus', vocab: 'pbdb' }).toString()}`,
  },
  {
    id: 'usgs-water-legacy', name: 'USGS Water Data V1', provider: 'U.S. Geological Survey', category: 'Environment',
    description: 'Read the latest continuous USGS sensor observation for streamflow or gage height at a monitoring location.',
    documentationUrl: 'https://api.waterdata.usgs.gov/docs/ogcapi/', accent: '#00264c', monogram: 'USGS',
    usageNote: 'Uses the modern USGS Water Data API V1 latest-continuous collection. API keys are optional and only increase rate limits; observations can be provisional or approved.',
    fields: [
      { id: 'site', label: 'Monitoring site', type: 'text', defaultValue: '01646500', placeholder: 'e.g. 01646500', minLength: 1, maxLength: 32, pattern: '[0-9]+', patternDescription: 'must contain only the numeric USGS monitoring-location identifier, without an agency prefix or comma-separated list.', help: 'Enter one USGS monitoring-location number (default is the Potomac River near Washington, D.C.).' },
      { id: 'parameter', label: 'Measurement', type: 'select', defaultValue: '00060', help: 'Choose the continuous sensor quantity to read.', options: [
        { label: 'Streamflow / discharge (00060)', value: '00060' },
        { label: 'Gage height (00065)', value: '00065' },
      ] },
    ],
    buildUrl: ({ site = '01646500', parameter = '00060' }) => {
      const siteNumber = site.trim().replace(/^USGS-/i, '') || '01646500'
      const parameterCode = parameter === '00065' ? '00065' : '00060'
      return `https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items?${new URLSearchParams({
        f: 'json',
        monitoring_location_id: `USGS-${siteNumber}`,
        parameter_code: parameterCode,
        limit: '1',
      }).toString()}`
    },
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
    usageNote: 'Uses NuGet.org’s SemVer 2 registration hive. Packages with 128+ versions can omit registration leaves from the index; this one-request demo reports page ranges honestly instead of following extra page requests.',
    fields: [{ id: 'packageId', label: 'Package ID', type: 'text', defaultValue: 'newtonsoft.json', placeholder: 'e.g. newtonsoft.json', help: 'Enter a published NuGet package identifier.' }],
    buildUrl: ({ packageId = 'newtonsoft.json' }) => `https://api.nuget.org/v3/registration5-gz-semver2/${encode((packageId || 'newtonsoft.json').toLowerCase())}/index.json`,
  },
  {
    id: 'internet-archive-search', name: 'Internet Archive Search', provider: 'Internet Archive', category: 'Media',
    description: 'Search millions of archived books, audio, video, and software items with cover thumbnails.',
    documentationUrl: 'https://archive.org/advancedsearch.php', accent: '#0b3c5d', monogram: 'IA',
    usageNote: 'Human-triggered interactive searches remain available in Request Lab. Internet Archive does not guarantee the copyright status of items; verify each item page and any uploader-supplied rights or license metadata before reuse.',
    agentExecution: {
      mode: 'manual-only',
      reason: 'Internet Archive requires every automated request to send a descriptive User-Agent identifying the tool/version and AI model. Browser JavaScript cannot set that protected header, so structured agent execution cannot satisfy the provider bot policy.',
      policyUrl: 'https://archive.org/developers/bots.html',
    },
    fields: [
      { id: 'query', label: 'Search term', type: 'text', defaultValue: 'singapore', placeholder: 'e.g. singapore', minLength: 1, help: 'Search titles and descriptions across the archive.' },
      { id: 'mediaType', label: 'Media type', type: 'select', defaultValue: 'texts', help: 'Filter by archived media type.', options: [{ label: 'Texts & books', value: 'texts' }, { label: 'Audio', value: 'audio' }, { label: 'Movies', value: 'movies' }, { label: 'Software', value: 'software' }] },
    ],
    buildUrl: (parameters) => {
      const query = parameters.query === undefined ? 'singapore' : parameters.query.trim()
      const mediaType = parameters.mediaType === undefined ? 'texts' : parameters.mediaType
      const params = new URLSearchParams({ q: `${query} AND mediatype:${mediaType}`, rows: '6', page: '1', output: 'json' })
      for (const field of ['identifier', 'title', 'creator', 'date', 'mediatype', 'rights', 'licenseurl']) params.append('fl[]', field)
      return `https://archive.org/advancedsearch.php?${params.toString()}`
    },
  },
  {
    id: 'ipwhois-lookup', name: 'IPWhoIs Geolocation', provider: 'ipwho.is', category: 'Developer',
    description: 'Inspect approximate IP-based location, timezone, ASN, network organization, and ISP metadata for one public IPv4 or IPv6 address.',
    documentationUrl: 'https://ipwhois.io/documentation', accent: '#0f766e', monogram: 'GEO',
    usageNote: 'IP geolocation is approximate network-derived data, not device GPS or a precise personal address. The free endpoint allows 1,000 requests/day; browser CORS requests are counted per domain, so the quota is shared across Public-API traffic from this origin.',
    fields: [{ id: 'ip', label: 'IP address', type: 'text', defaultValue: '8.8.8.8', placeholder: 'e.g. 8.8.8.8', help: 'Enter one public IPv4 or IPv6 address. Reserved or invalid addresses can return HTTP 200 with success=false.' }],
    buildUrl: ({ ip = '8.8.8.8' }) => `https://ipwho.is/${encode(ip.trim() || '8.8.8.8')}`,
  },
  {
    id: 'newton-math-solver', name: 'Newton Math Solver', provider: 'Newton API', category: 'Knowledge',
    description: 'Run a bounded symbolic-math operation and inspect the provider-returned expression and result.',
    keywords: ['symbolic math', 'solve equation', 'differentiate', 'factor polynomial'],
    documentationUrl: 'https://github.com/aunyks/newton-api', accent: '#4c1d95', monogram: 'MATH', risk: 'Review',
    usageNote: 'A community-maintained symbolic math service. The legacy newton.now.sh hostname redirects to the current newton.vercel.app deployment; Public-API calls the Vercel deployment directly to avoid a redirect dependency. Treat this as an education demo rather than a guaranteed-uptime dependency.',
    fields: [
      { id: 'operation', label: 'Operation', type: 'select', defaultValue: 'simplify', help: 'Choose a math operation.', options: [
        { label: 'Simplify', value: 'simplify' }, { label: 'Factor', value: 'factor' }, { label: 'Derive', value: 'derive' }, { label: 'Zeroes', value: 'zeroes' },
      ] },
      { id: 'expression', label: 'Expression', type: 'text', defaultValue: '2x+2x', placeholder: 'e.g. 2x+2x', minLength: 1, help: 'Use ^ for powers and avoid spaces.' },
    ],
    buildUrl: ({ operation = 'simplify', expression = '2x+2x' }) => `https://newton.vercel.app/api/v2/${encode(operation || 'simplify')}/${encode(expression || '2x+2x')}`,
  },
  {
    id: 'datamuse-rhymes', name: 'Datamuse Sounds-Like Finder', provider: 'Datamuse', category: 'Language',
    description: "Find English words and phrases pronounced similarly to a supplied term using Datamuse's documented sounds-like constraint.",
    keywords: ['pronunciation', 'phonetic similarity', 'sounds like'],
    documentationUrl: 'https://www.datamuse.com/api/', accent: '#be185d', monogram: 'DTM',
    usageNote: 'The stable catalog ID is retained for deep-link compatibility, but the live request now uses the documented sl=sounds-like contract rather than the older undocumented rel_rhy parameter. Datamuse says result score values are useful only for ordering, asks public apps to acknowledge Datamuse, and allows keyless use up to 100,000 requests/day only through 2026-12-31; starting 2027-01-01 every request will require an API key, so this browser-native demo must be re-evaluated before then.',
    fields: [{ id: 'word', label: 'Sounds like', type: 'text', defaultValue: 'orange', placeholder: 'e.g. orange', minLength: 1, maxLength: 80, help: 'Enter an English word or phrase. Datamuse will rank vocabulary entries with similar pronunciation.' }],
    buildUrl: ({ word = 'orange' }) => `https://api.datamuse.com/words?${new URLSearchParams({ sl: word.trim() || 'orange', max: '8', md: 'psr', ipa: '1' }).toString()}`,
  },
  {
    id: 'open5e-monster-search', name: 'Open5e Monster Search', provider: 'Open5e', category: 'Games',
    description: 'Search the current Open5e V2 creature catalogue for open-license tabletop RPG monsters with source-aware combat statistics.',
    documentationUrl: 'https://open5e.com/api-docs', accent: '#166534', monogram: 'O5E',
    usageNote: 'Uses the current Open5e V2 creatures endpoint with case-insensitive name matching. The live demo caps results at 8 and requests only the source, identity, combat, movement, and perception fields used by the semantic card; familiar monster names can appear more than once when different source documents or game systems provide distinct versions.',
    fields: [{ id: 'search', label: 'Monster name contains', type: 'text', defaultValue: 'dragon', placeholder: 'e.g. dragon', help: 'Case-insensitive partial-name search across Open5e V2 creatures.' }],
    buildUrl: ({ search = 'dragon' }) => `https://api.open5e.com/v2/creatures/?${new URLSearchParams({
      name__icontains: search.trim() || 'dragon',
      limit: '8',
      fields: 'name,key,document,type,size,challenge_rating,armor_class,hit_points,hit_dice,speed,alignment,passive_perception',
      document__fields: 'name,key,gamesystem',
    }).toString()}`,
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
    headers: { Accept: 'image/svg+xml' },
    buildUrl: ({ style = 'identicon', seed = 'test' }) => `https://api.dicebear.com/9.x/${encode(style || 'identicon')}/svg?${new URLSearchParams({ seed: seed.trim() || 'test' }).toString()}`,
    responseType: 'image',
    responseContentTypes: ['image/svg+xml'],
  },
  {
    id: 'catfacts', name: 'Cat Facts Generator', provider: 'Cat Facts API', category: 'Nature',
    description: 'Generate a random, bite-sized fact about cats for lightweight content demos.',
    documentationUrl: 'https://catfact.ninja/', accent: '#ea580c', monogram: 'CAT',
    fields: [],
    buildUrl: () => 'https://catfact.ninja/fact',
  },
  {
    id: 'gleif-lei',
    name: 'GLEIF LEI Explorer',
    provider: 'GLEIF',
    category: 'Finance',
    description: 'Search official legal entities by name and review LEI status, headquarters, registration state, and available corporate relationship links.',
    documentationUrl: 'https://www.gleif.org/en/lei-data/gleif-api',
    accent: '#0f7c90',
    monogram: 'GLE',
    usageNote: 'GLEIF API legal-name search can use provider matching rather than exact text equality. Treat the provider-owned LEI as the stable entity identity and review the returned legal name/status before using a result.',
    fields: [
      { id: 'query', label: 'Legal name', type: 'text', defaultValue: 'Royal Bank of Canada', minLength: 1, placeholder: 'e.g. Royal Bank', help: 'Enter a legal name fragment to search public LEI records.' },
      { id: 'count', label: 'Results', type: 'number', defaultValue: '8', min: 1, max: 50, step: 1, help: 'Return between 1 and 50 records.' },
    ],
    buildUrl: ({ query = 'Royal Bank of Canada', count = '8' }) => `https://api.gleif.org/api/v1/lei-records?${new URLSearchParams({
      'filter[entity.legalName]': query.trim(),
      'page[size]': count.trim(),
    }).toString()}`,
  },
  {
    id: 'fdic-bankfind',
    name: 'FDIC BankFind Suite',
    provider: 'FDIC',
    category: 'Finance',
    description: 'Search FDIC institution records by bank name and inspect operating status, headquarters, reported assets/deposits, office counts, and regulator metadata.',
    documentationUrl: 'https://api.fdic.gov/banks/docs',
    accent: '#0060a8',
    monogram: 'FDI',
    fields: [
      { id: 'bankName', label: 'Bank name', type: 'text', defaultValue: 'Wells Fargo', placeholder: 'e.g. Wells Fargo', minLength: 1, help: 'Search FDIC bank metadata by public institution name.' },
      { id: 'count', label: 'Results', type: 'number', defaultValue: '6', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 institutions.' },
    ],
    buildUrl: ({ bankName = 'Wells Fargo', count = '6' }) => {
      const normalizedBankName = bankName.trim().toUpperCase()
      return `https://api.fdic.gov/banks/institutions?${new URLSearchParams({
        search: `NAME: ${normalizedBankName}`,
        limit: count.trim(),
        format: 'json',
      }).toString()}`
    },
  },
  {
    id: 'uk-food-hygiene',
    name: 'UK Food Hygiene Ratings',
    provider: 'Food Standards Agency',
    category: 'Food',
    description: 'Search food establishments by name and inspect provider ratings, inspection dates, local-authority identity, and FHRS component scores.',
    documentationUrl: 'https://api.ratings.food.gov.uk/help',
    accent: '#0b5f66',
    monogram: 'FKH',
    usageNote: 'For FHRS, the overall rating runs 0–5 with higher better, while Hygiene/Structural/Confidence intervention scores run in the opposite direction with lower better. Component scores apply to FHRS, not FHIS, and may be absent after a rescore.',
    fields: [
      { id: 'name', label: 'Establishment name', type: 'text', defaultValue: 'Cafe', placeholder: 'e.g. Cafe', help: 'Search UK food businesses by name.' },
      { id: 'count', label: 'Results', type: 'number', defaultValue: '5', min: 1, max: 50, help: 'Return between 1 and 50 establishments from the first result page.' },
    ],
    headers: { 'x-api-version': '2' },
    buildUrl: ({ name = 'Cafe', count = '5' }) => {
      const safeCount = Math.min(50, Math.max(1, Number.parseInt(count, 10) || 5))
      return `https://api.ratings.food.gov.uk/Establishments?${new URLSearchParams({
        name: name.trim() || 'Cafe',
        pageNumber: '1',
        pageSize: String(safeCount),
      }).toString()}`
    },
  },
  {
    id: 'uk-flood-monitoring',
    name: 'UK Flood Monitoring',
    provider: 'DEFRA',
    category: 'Environment',
    description: 'Find Environment Agency monitoring stations for an exact river name, including location, status, catchment, and available measurement types.',
    keywords: ['flood stations', 'river monitoring', 'Environment Agency stations'],
    documentationUrl: 'https://environment.data.gov.uk/flood-monitoring/doc/reference',
    accent: '#065f46',
    monogram: 'FLD',
    usageNote: 'The provider documents riverName as an exact-match filter. This endpoint returns station and available-measure metadata, not current readings or flood warnings.',
    fields: [
      { id: 'riverName', label: 'Exact river name', type: 'text', defaultValue: 'River Severn', placeholder: 'e.g. River Severn', minLength: 1, help: 'Use the Environment Agency river name exactly; the provider does not treat this field as a contains search.' },
      { id: 'count', label: 'Stations', type: 'number', defaultValue: '8', min: 1, max: 50, help: 'Return between 1 and 50 matching station records.' },
    ],
    buildUrl: ({ riverName = 'River Severn', count = '8' }) => {
      const safeCount = Math.min(50, Math.max(1, Number.parseInt(count, 10) || 8))
      return `https://environment.data.gov.uk/flood-monitoring/id/stations?${new URLSearchParams({
        riverName: riverName.trim() || 'River Severn',
        _limit: String(safeCount),
      }).toString()}`
    },
  },
  {
    id: 'unhcr-refugees', name: 'UNHCR Refugee Statistics', provider: 'UNHCR', category: 'Data',
    description: 'Read UNHCR end-of-year displacement population figures for one ISO3 country of origin and reporting year.',
    documentationUrl: 'https://www.unhcr.org/refugee-statistics/insights/explainers/forcibly-displaced-api.html', accent: '#7c2d12', monogram: 'UNH',
    usageNote: 'The request sets cf_type=ISO so the origin input is interpreted as ISO3. Country of asylum is omitted, so UNHCR aggregates that dimension into one year-end row.',
    fields: [
      { id: 'origin', label: 'Origin country ISO3', type: 'text', defaultValue: 'SYR', placeholder: 'e.g. SYR', minLength: 3, maxLength: 3, pattern: '[A-Za-z]{3}', patternDescription: 'must contain exactly three letters for an ISO 3166-1 alpha-3 country code.', help: 'Use exactly three ISO 3166-1 alpha-3 letters such as SYR; cf_type=ISO makes UNHCR interpret this field as ISO3.' },
      { id: 'year', label: 'Year', type: 'number', defaultValue: '2025', min: 2010, max: 2025, help: 'Choose a published annual end-of-year snapshot from 2010 through 2025.' },
    ],
    buildUrl: ({ origin = 'SYR', year = '2025' }) => {
      const safeYear = Math.min(2025, Math.max(2010, Number.parseInt(year, 10) || 2025))
      return `https://api.unhcr.org/population/v1/population/?${new URLSearchParams({ yearFrom: String(safeYear), yearTo: String(safeYear), coo: (origin.trim() || 'SYR').toUpperCase(), cf_type: 'ISO', limit: '1' }).toString()}`
    },
  },
  {
    id: 'hdx-humanitarian-datasets', name: 'IFRC GO Emergency Events', provider: 'IFRC GO', category: 'Data',
    description: 'Review recent IFRC GO emergency events ordered by disaster start date, with source-specific field-report impacts when available.',
    documentationUrl: 'https://goadmin.ifrc.org/api-docs/swagger-ui/', accent: '#d9232e', monogram: 'IFR', risk: 'Review',
    usageNote: 'IFRC GO exposes event-level and field-report impact figures from different sources. Keep IFRC, government, and other-source figures separate and verify source reports before operational decisions.',
    fields: [],
    buildUrl: () => 'https://goadmin.ifrc.org/api/v2/event/?limit=6&ordering=-disaster_start_date',
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
      { id: 'endYear', label: 'End year', type: 'number', defaultValue: '2026', min: 1950, max: 2050, minimumFromField: 'startYear', help: 'Choose a projection window end year greater than or equal to the start year.' },
      { id: 'model', label: 'Model', type: 'select', defaultValue: 'CMCC_CM2_VHR4', help: 'Select one of the seven climate models currently documented by Open-Meteo.',
        options: [
          { label: 'CMCC CM2 VHR4', value: 'CMCC_CM2_VHR4' },
          { label: 'FGOALS f3 H', value: 'FGOALS_f3_H' },
          { label: 'HiRAM SIT HR', value: 'HiRAM_SIT_HR' },
          { label: 'MRI AGCM3 2 S', value: 'MRI_AGCM3_2_S' },
          { label: 'EC-Earth3P HR', value: 'EC_Earth3P_HR' },
          { label: 'MPI ESM1 2 XR', value: 'MPI_ESM1_2_XR' },
          { label: 'NICAM16 8S', value: 'NICAM16_8S' },
        ] },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', startYear = '2020', endYear = '2026', model = 'CMCC_CM2_VHR4' }) => {
      const safeStartYear = Math.min(2050, Math.max(1950, Number.parseInt(startYear, 10) || 2020))
      const safeEndYear = Math.min(2050, Math.max(1950, Number.parseInt(endYear, 10) || 2026))
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
    usageNote: 'Open-Meteo climate projections use downscaled HighResMIP / CMIP6 climate models. Treat them as modelled projections rather than observations, and retain the selected model and date range when presenting outcomes.',
  },
  {
    id: 'models-dev', name: 'Hugging Face Model Search', provider: 'Hugging Face', category: 'Developer',
    description: 'Search public AI model metadata, downloads, likes, pipeline tags, and update timestamps.',
    documentationUrl: 'https://huggingface.co/docs/hub/api', accent: '#f6c343', monogram: 'HFM',
    fields: [
      { id: 'query', label: 'Model search', type: 'text', defaultValue: 'gpt', placeholder: 'e.g. gpt', minLength: 1, help: 'Search public model IDs. Hugging Face documents this search string as being contained in returned model IDs.' },
      { id: 'count', label: 'Results', type: 'number', defaultValue: '8', min: 1, max: 25, step: 1, help: 'Return between 1 and 25 models.' },
    ],
    buildUrl: ({ query = 'gpt', count = '8' }) => `https://huggingface.co/api/models?${new URLSearchParams({ search: query.trim() || 'gpt', limit: String(Math.min(25, Math.max(1, Number.parseInt(count, 10) || 8))), full: 'true' }).toString()}`,
  },
  {
    id: 'vatcomply',
    name: 'VATComply Exchange Rates',
    provider: 'VATComply',
    category: 'Finance',
    description: 'Read daily currency exchange rates for a selected base currency and target symbols from VATComply’s /rates endpoint.',
    documentationUrl: 'https://api.vatcomply.com/docs',
    accent: '#7c3aed',
    monogram: 'VPC',
    usageNote: 'This Public-API entry calls VATComply’s /rates endpoint only. VAT-number and IBAN validation are separate provider operations and are not part of this demo.',
    fields: [
      { id: 'base', label: 'Base currency', type: 'text', defaultValue: 'EUR', placeholder: 'e.g. EUR', minLength: 3, maxLength: 3, pattern: '[A-Za-z]{3}', patternDescription: 'must be a three-letter currency code.', help: 'Use a supported three-letter currency code such as EUR, USD, or SGD.' },
      { id: 'symbols', label: 'Target currencies', type: 'text', defaultValue: 'USD,SGD,GBP', placeholder: 'e.g. USD,SGD,GBP', minLength: 3, pattern: '[A-Za-z]{3}(?:\\s*,\\s*[A-Za-z]{3})*', patternDescription: 'must be a comma-separated list of three-letter currency codes.', help: 'Comma-separate supported three-letter currency codes. VATComply filters the response to those currencies.' },
    ],
    buildUrl: ({ base = 'EUR', symbols = 'USD,SGD,GBP' }) => {
      const normalizedBase = base.trim().toUpperCase() || 'EUR'
      const normalizedSymbols = symbols.split(',').map((symbol) => symbol.trim().toUpperCase()).join(',') || 'USD,SGD,GBP'
      return `https://api.vatcomply.com/rates?${new URLSearchParams({ base: normalizedBase, symbols: normalizedSymbols }).toString()}`
    },
  },
  {
    id: 'mempool-space-btc',
    name: 'mempool.space Bitcoin',
    provider: 'mempool.space',
    category: 'Finance',
    description: 'Read mempool.space recommended Bitcoin transaction fee rates for fastest, half-hour, hour, economy, and minimum targets.',
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
    description: 'Find the latest indexed CPAN release metadata for an exact Perl module name.',
    documentationUrl: 'https://github.com/metacpan/metacpan-api/blob/master/docs/API-docs.md',
    accent: '#1f2937',
    monogram: 'MCP',
    fields: [
      { id: 'query', label: 'Module name', type: 'text', defaultValue: 'Mojolicious', placeholder: 'e.g. DBIx::Class', minLength: 1, help: 'Enter an exact Perl module name. MetaCPAN searches module.name and keeps only the latest indexed release.' },
      { id: 'count', label: 'Maximum matches', type: 'number', defaultValue: '6', min: 1, max: 20, help: 'Limit the exact-name result set to between 1 and 20 records.' },
    ],
    buildUrl: ({ query = 'Mojolicious', count = '6' }) => {
      const safeCount = Math.min(20, Math.max(1, Number.parseInt(count, 10) || 6))
      return `https://fastapi.metacpan.org/v1/module/_search?${new URLSearchParams({ q: `module.name:${JSON.stringify(query.trim())} AND status:latest`, size: String(safeCount) }).toString()}`
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
    id: 'pub-dev', name: 'pub.dev Package Lookup', provider: 'pub.dev', category: 'Developer',
    description: 'Inspect one Dart or Flutter package with its latest release, SDK constraints, topics, and version history.',
    documentationUrl: 'https://pub.dev/help/api', accent: '#0ea5e9', monogram: 'PUB',
    usageNote: 'Uses the Hosted Pub Repository Specification v2 package endpoint and its recommended v2 media type. Direct package misses are provider HTTP 404 responses, not semantic empty package objects.',
    fields: [{ id: 'packageName', label: 'Package name', type: 'text', defaultValue: 'riverpod', placeholder: 'e.g. riverpod', help: 'Enter an exact package name from pub.dev.' }],
    headers: { Accept: 'application/vnd.pub.v2+json' },
    buildUrl: ({ packageName = 'riverpod' }) => `https://pub.dev/api/packages/${encode(packageName.trim() || 'riverpod')}`,
  },
  {
    id: 'go-module-proxy',
    name: 'Go Module Proxy',
    provider: 'Go',
    category: 'Developer',
    description: 'Read the official Go module proxy version list for one module path.',
    documentationUrl: 'https://go.dev/ref/mod',
    accent: '#6366f1',
    monogram: 'GOP',
    fields: [
      { id: 'module', label: 'Module path', type: 'text', defaultValue: 'github.com/gin-gonic/gin', placeholder: 'e.g. github.com/gin-gonic/gin', help: 'Enter a fully-qualified module path.' },
    ],
    buildUrl: ({ module = 'github.com/gin-gonic/gin' }) => {
      const requestedModule = module.trim() || 'github.com/gin-gonic/gin'
      const modulePath = encode(escapeGoProxyModulePath(requestedModule)).replace(/%2F/g, '/')
      return `https://proxy.golang.org/${modulePath}/@v/list`
    },
    responseType: 'text',
    responseContentTypes: ['text/plain'],
    parseResponse: (text) => ({ versions: text.split(/\r?\n/).map((version) => version.trim()).filter(Boolean) }),
  },
  {
    id: 'flathub-appstream',
    name: 'Flathub Appstream',
    provider: 'Flathub',
    category: 'Developer',
    description: 'Inspect one Flathub desktop application with screenshots, release history, license, categories, and project links.',
    documentationUrl: 'https://docs.flathub.org/docs/for-app-authors/appstream/',
    accent: '#0f766e',
    monogram: 'FLA',
    fields: [
      { id: 'appId', label: 'Flathub app ID', type: 'text', defaultValue: 'org.gnome.Calculator', placeholder: 'e.g. org.gnome.Calculator', minLength: 1, help: 'Enter an exact non-empty Flathub application ID.' },
    ],
    buildUrl: ({ appId = 'org.gnome.Calculator' }) => `https://flathub.org/api/v2/appstream/${encode(appId.trim())}`,
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
    id: 'opencitations-index', name: 'OpenCitations Citation Count', provider: 'OpenCitations', category: 'Research',
    description: 'Look up the number of incoming citations recorded in OpenCitations Index v2 for a DOI.',
    documentationUrl: 'https://opencitations.net/index/api/v2', accent: '#0f766e', monogram: 'OCI',
    usageNote: 'OpenCitations citation-count is index-scoped, not a universal citation total. Anonymous REST API calls are rate-limited to 180 requests/minute per IP; OpenCitations recommends data dumps for large-scale retrieval.',
    fields: [{ id: 'doi', label: 'DOI', type: 'text', defaultValue: '10.1109/5.771073', placeholder: 'e.g. 10.1109/5.771073', help: 'Use a valid DOI string.' }],
    buildUrl: ({ doi = '10.1109/5.771073' }) => `https://api.opencitations.net/index/v2/citation-count/doi:${encodeURIComponent(doi.trim() || '10.1109/5.771073')}`,
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
        minLength: 1,
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
        step: 1,
        help: 'Return between 1 and 20 records.',
      },
    ],
    buildUrl: ({ query = 'eastern', count = '6' }) => {
      return `https://api.vam.ac.uk/v2/objects/search?${new URLSearchParams({
        q: query.trim(),
        page_size: count,
      }).toString()}`
    },
  },
]

const publicApi200MilestoneApis: ApiDemo[] = [
  {
    id: 'github-global-advisories', name: 'GitHub Global Advisories', provider: 'GitHub', category: 'Security',
    description: 'Search GitHub-reviewed global security advisories by ecosystem and severity without authentication.',
    documentationUrl: 'https://docs.github.com/en/rest/security-advisories/global-advisories', accent: '#24292f', monogram: 'GHA',
    usageNote: 'Public global advisories are available without authentication. GitHub may return HTTP 403 or 429 for primary or secondary rate-limit exhaustion and requires clients to wait for the reset/Retry-After window before retrying. Keep anonymous request volume modest and review upstream package guidance before acting on a result.',
    automatedVerification: {
      mode: 'enabled',
      retryOnRateLimit: false,
      rateLimitStatuses: [403, 429],
      reason: 'GitHub documents HTTP 403 or 429 for primary or secondary rate-limit exhaustion and requires clients to wait for x-ratelimit-reset, Retry-After, or at least one minute before retrying. Generic health verification therefore records the first 403/429 and defers another provider request to a later independent run.',
      policyUrl: 'https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api',
    },
    fields: [
      { id: 'ecosystem', label: 'Ecosystem', type: 'select', defaultValue: 'npm', help: 'Filter advisories by package ecosystem.', options: [
        { label: 'npm', value: 'npm' }, { label: 'pip', value: 'pip' }, { label: 'Maven', value: 'maven' }, { label: 'NuGet', value: 'nuget' }, { label: 'RubyGems', value: 'rubygems' }, { label: 'Composer', value: 'composer' }, { label: 'Go', value: 'go' }, { label: 'Rust', value: 'rust' },
      ] },
      { id: 'severity', label: 'Severity', type: 'select', defaultValue: 'high', help: 'Filter by GitHub advisory severity.', options: [
        { label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' }, { label: 'High', value: 'high' }, { label: 'Critical', value: 'critical' },
      ] },
      limitField({ label: 'Advisories', defaultValue: '6', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 advisories.' }),
    ],
    headers: { Accept: 'application/vnd.github+json' },
    buildUrl: ({ ecosystem = 'npm', severity = 'high', limit = '6' }) => `https://api.github.com/advisories?${new URLSearchParams({ ecosystem, severity, per_page: limit.trim() }).toString()}`,
  },
  {
    id: 'dblp-search', name: 'DBLP Publication Search', provider: 'DBLP', category: 'Research',
    description: 'Search computer-science publication titles and inspect authors, venues, years, DOI, and persistent DBLP record URLs.',
    documentationUrl: 'https://blog.dblp.org/2024/09/09/introducing-our-public-sparql-query-service/', accent: '#1f6f8b', monogram: 'DBL',
    usageNote: 'Uses DBLP’s official public SPARQL service, which is currently described as public beta. DBLP asks clients not to overwhelm live APIs; its current crawling guidance says HTTP 429 responses carry Retry-After and recommends waiting at least one or two seconds between automated requests.',
    automatedVerification: {
      mode: 'enabled',
      retryOnRateLimit: false,
      rateLimitStatuses: [429],
      reason: 'DBLP documents HTTP 429 with Retry-After for excessive automated traffic. Automated verification records a 429 and defers another provider request instead of immediately retrying against the live beta service.',
      policyUrl: 'https://dblp.org/faq/Am%2BI%2Ballowed%2Bto%2Bcrawl%2Bthe%2Bdblp%2Bwebsite',
    },
    fields: [
      queryField({ label: 'Publication title search', defaultValue: 'large language models', placeholder: 'e.g. retrieval augmented generation', minLength: 1, maxLength: 120, help: 'Case-insensitive substring search over DBLP publication titles.' }),
      limitField({ label: 'Results', defaultValue: '6', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 matching publications.' }),
    ],
    headers: { Accept: 'application/sparql-results+json' },
    buildUrl: ({ query = 'large language models', limit = '6' }) => {
      const queryText = query.trim()
      const requestedLimit = limit.trim()
      const sparql = `PREFIX dblp: <https://dblp.org/rdf/schema#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?publ ?title ?year ?venue ?doi ?authorName WHERE {
  {
    SELECT ?publ ?title WHERE {
      ?publ a dblp:Publication ; dblp:title ?title .
      FILTER(CONTAINS(LCASE(STR(?title)), LCASE(${sparqlStringLiteral(queryText)})))
    }
    LIMIT ${requestedLimit}
  }
  OPTIONAL { ?publ dblp:yearOfPublication ?year . }
  OPTIONAL { ?publ dblp:publishedIn ?venue . }
  OPTIONAL { ?publ dblp:doi ?doi . }
  OPTIONAL { ?publ dblp:authoredBy ?author . ?author rdfs:label ?authorName . }
}
ORDER BY ?publ ?authorName`
      return `https://sparql.dblp.org/sparql?${new URLSearchParams({ query: sparql }).toString()}`
    },
  },
  {
    id: 'citybikes-network', name: 'CityBikes Live Stations', provider: 'CityBikes', category: 'Geo',
    description: 'Inspect live bike-sharing stations, available bicycles, empty docks, and coordinates for a selected city network.',
    documentationUrl: 'https://docs.citybik.es/api/v2', accent: '#16a34a', monogram: 'CBK',
    usageNote: 'CityBikes limits the public API to 300 requests/hour and requires a clear CityBikes source link in projects using the API. Cache repeated network reads and avoid aggressive polling.',
    fields: [{ id: 'network', label: 'Bike network', type: 'select', defaultValue: 'youbike-taipei', help: 'Choose a public bike-sharing network.', options: [
      { label: 'Taipei · YouBike', value: 'youbike-taipei' }, { label: 'Paris · Vélib', value: 'velib' }, { label: 'London · Santander Cycles', value: 'santander-cycles' }, { label: 'New York · Citi Bike', value: 'citi-bike-nyc' }, { label: 'Barcelona · Bicing', value: 'bicing' },
    ] }],
    buildUrl: ({ network = 'youbike-taipei' }) => `https://api.citybik.es/v2/networks/${encodeURIComponent(network.trim())}`,
  },
  {
    id: 'wikimedia-commons-search', name: 'Wikimedia Commons Search', provider: 'Wikimedia Foundation', category: 'Media',
    description: 'Search Wikimedia Commons files and return browser-ready thumbnails with license metadata.',
    documentationUrl: 'https://www.mediawiki.org/wiki/API:Main_page', accent: '#006699', monogram: 'WMC',
    usageNote: 'Wikimedia asks API clients to identify themselves; browser requests send Api-User-Agent: Public-API/0.1 (https://yapweijun1996.github.io/Public-API/). Respect the license and attribution metadata attached to each media result; Commons content does not share one universal license.',
    fields: [
      queryField({ label: 'Media search', defaultValue: 'Singapore skyline', placeholder: 'e.g. Singapore skyline', minLength: 1, help: 'Search file titles and descriptions on Wikimedia Commons.' }),
      limitField({ label: 'Results', defaultValue: '6', min: 1, max: 12, step: 1, help: 'Return between 1 and 12 media files.' }),
    ],
    headers: { 'Api-User-Agent': 'Public-API/0.1 (https://yapweijun1996.github.io/Public-API/)' },
    buildUrl: ({ query = 'Singapore skyline', limit = '6' }) => `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: query.trim(), gsrnamespace: '6', gsrlimit: limit.trim(), prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '400', format: 'json', origin: '*' }).toString()}`,
  },

  {
    id: 'jsdelivr-package', name: 'jsDelivr Package Metadata', provider: 'jsDelivr', category: 'Developer',
    description: 'Inspect npm package tags and published versions from the jsDelivr public package metadata API.',
    documentationUrl: 'https://www.jsdelivr.com/docs/data.jsdelivr.com', accent: '#f97316', monogram: 'JSD',
    fields: [{ id: 'packageName', label: 'npm package', type: 'text', defaultValue: 'react', placeholder: 'e.g. react', help: 'Enter an npm package name available through jsDelivr.' }],
    buildUrl: ({ packageName = 'react' }) => `https://data.jsdelivr.com/v1/packages/npm/${encode(packageName.trim() || 'react')}`,
  },
  {
    id: 'canada-open-data-search', name: 'Canada Open Data Search', provider: 'Government of Canada', category: 'Government',
    description: 'Search Canada’s open-government dataset and publication catalogue through its CKAN API.',
    documentationUrl: 'https://open.canada.ca/en/access-our-application-programming-interface-api', accent: '#d52b1e', monogram: 'CAN',
    fields: [
      queryField({ label: 'Catalogue search', defaultValue: 'artificial intelligence', placeholder: 'e.g. artificial intelligence', minLength: 1, help: 'Search Canadian datasets and publications by keyword.' }),
      limitField({ label: 'Results', defaultValue: '6', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 catalogue records.' }),
    ],
    buildUrl: ({ query = 'artificial intelligence', limit = '6' }) => `https://open.canada.ca/data/api/3/action/package_search?${new URLSearchParams({ q: query.trim(), rows: limit.trim() }).toString()}`,
  },
  {
    id: 'gbif-occurrence-search', name: 'GBIF Occurrence Search', provider: 'GBIF', category: 'Biodiversity',
    description: 'Find real-world biodiversity occurrence records with species, observation date, locality, and coordinates.',
    documentationUrl: 'https://techdocs.gbif.org/en/openapi/v1/occurrence', accent: '#65a30d', monogram: 'GBO',
    usageNote: 'Occurrence records come from many publishers with varying licences and data quality. Treat locations and identifications as source data rather than authoritative ground truth.',
    fields: [
      { id: 'scientificName', label: 'Scientific name', type: 'text', defaultValue: 'Panthera leo', placeholder: 'e.g. Panthera leo', minLength: 1, help: 'Use a scientific species or taxon name.' },
      limitField({ label: 'Records', defaultValue: '6', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 occurrence records.' }),
    ],
    buildUrl: ({ scientificName = 'Panthera leo', limit = '6' }) => `https://api.gbif.org/v1/occurrence/search?${new URLSearchParams({ scientificName: scientificName.trim(), limit: limit.trim(), hasCoordinate: 'true' }).toString()}`,
  },

  {
    id: 'open-meteo-ensemble', name: 'Open-Meteo Ensemble Forecast', provider: 'Open-Meteo', category: 'Weather',
    description: 'Compare ensemble forecast members to understand uncertainty around temperature, rain, and wind predictions.',
    documentationUrl: 'https://open-meteo.com/en/docs/ensemble-api', accent: '#3b82f6', monogram: 'OME',
    usageNote: 'Uses the documented ICON seamless EPS model. Ensemble members represent forecast uncertainty, not independent observations; communicate the spread or range instead of treating any one member as certain.',
    fields: [
      ...latLongFields(),
      { id: 'variable', label: 'Forecast variable', type: 'select', defaultValue: 'temperature_2m', help: 'Choose the hourly quantity to compare across ensemble members.', options: [
        { label: 'Temperature · 2 m', value: 'temperature_2m' }, { label: 'Precipitation', value: 'precipitation' }, { label: 'Wind speed · 10 m', value: 'wind_speed_10m' },
      ] },
      { id: 'forecastDays', label: 'Forecast days', type: 'number', defaultValue: '3', min: 1, max: 7, step: 1, help: 'Request between 1 and 7 whole forecast days.' },
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', variable = 'temperature_2m', forecastDays = '3' }) => `https://ensemble-api.open-meteo.com/v1/ensemble?${new URLSearchParams({ latitude, longitude, models: 'icon_seamless_eps', hourly: variable, forecast_days: forecastDays.trim(), timezone: 'Asia/Singapore' }).toString()}`,
  },
  {
    id: 'world-bank-indicator-explorer', name: 'World Bank Indicator Explorer', provider: 'World Bank', category: 'Economy',
    description: 'Explore selectable World Bank development indicators by country and year range instead of relying on one hard-coded series.',
    documentationUrl: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation', accent: '#1d4ed8', monogram: 'WBI',
    fields: [
      { id: 'country', label: 'Country code', type: 'text', defaultValue: 'SGP', placeholder: 'e.g. SGP', minLength: 2, maxLength: 3, pattern: '[A-Za-z]{2,3}', patternDescription: 'must contain exactly two or three letters for an ISO 3166-1 alpha-2 or alpha-3 country code.', help: 'Use an ISO 3166-1 alpha-2 or alpha-3 country code such as SG or SGP.' },
      { id: 'indicator', label: 'Indicator', type: 'select', defaultValue: 'SP.DYN.LE00.IN', help: 'Choose a commonly used World Bank indicator.', options: [
        { label: 'Life expectancy', value: 'SP.DYN.LE00.IN' }, { label: 'GDP · current US$', value: 'NY.GDP.MKTP.CD' }, { label: 'GDP per capita · current US$', value: 'NY.GDP.PCAP.CD' }, { label: 'Population', value: 'SP.POP.TOTL' }, { label: 'Inflation · consumer prices %', value: 'FP.CPI.TOTL.ZG' }, { label: 'Unemployment · %', value: 'SL.UEM.TOTL.ZS' }, { label: 'Internet users · %', value: 'IT.NET.USER.ZS' },
      ] },
      { id: 'startYear', label: 'Start year', type: 'number', defaultValue: '2015', min: 1960, max: 2100, step: 1, help: 'Beginning of the requested time series.' },
      { id: 'endYear', label: 'End year', type: 'number', defaultValue: '2025', min: 1960, max: 2100, step: 1, minimumFromField: 'startYear', help: 'End of the requested time series; choose a year greater than or equal to the start year.' },
    ],
    buildUrl: ({ country = 'SGP', indicator = 'SP.DYN.LE00.IN', startYear = '2015', endYear = '2025' }) => {
      const requestedStart = startYear.trim()
      const requestedEnd = endYear.trim()
      return `https://api.worldbank.org/v2/country/${encode(country || 'SGP').toUpperCase()}/indicator/${encode(indicator || 'SP.DYN.LE00.IN')}?${new URLSearchParams({ format: 'json', date: `${requestedStart}:${requestedEnd}`, per_page: '141' }).toString()}`
    },
  },
  {
    id: 'exchange-rate-current', name: 'Current FX Rates', provider: 'ExchangeRate-API', category: 'Finance',
    description: 'Read a current keyless exchange-rate table for a selected base currency.',
    keywords: ['currency conversion', 'convert currency', 'foreign exchange', 'FX conversion'],
    documentationUrl: 'https://www.exchangerate-api.com/docs/free', accent: '#0f766e', monogram: 'ERX',
    usageNote: 'The open endpoint requires ExchangeRate-API attribution, updates once per day, permits caching but not redistribution, and returns HTTP 429 when rate limited. The provider says a rate-limited IP is allowed again after about 20 minutes.',
    automatedVerification: {
      mode: 'enabled',
      retryOnRateLimit: false,
      reason: 'ExchangeRate-API says its open endpoint returns HTTP 429 when rate limited and that the rate limit remains in effect for about 20 minutes. Generic health verification records the first 429 and defers another provider request to a later independent run instead of retrying within that window.',
      policyUrl: 'https://www.exchangerate-api.com/docs/free',
    },
    fields: [{ id: 'base', label: 'Base currency', type: 'select', defaultValue: 'SGD', help: 'Choose the currency whose current cross-rates should be displayed.', options: [
      { label: 'SGD · Singapore Dollar', value: 'SGD' }, { label: 'MYR · Malaysian Ringgit', value: 'MYR' }, { label: 'USD · US Dollar', value: 'USD' }, { label: 'EUR · Euro', value: 'EUR' }, { label: 'GBP · Pound Sterling', value: 'GBP' }, { label: 'JPY · Japanese Yen', value: 'JPY' }, { label: 'AUD · Australian Dollar', value: 'AUD' },
    ] }],
    buildUrl: ({ base = 'SGD' }) => `https://open.er-api.com/v6/latest/${encode(base || 'SGD').toUpperCase()}`,
  },
  {
    id: 'circl-vulnerability', name: 'CIRCL Vulnerability Lookup', provider: 'CIRCL', category: 'Security',
    description: 'Fetch a normalized CVE 5 record from CIRCL Vulnerability-Lookup with CNA descriptions and affected products.',
    documentationUrl: 'https://vulnerability.circl.lu/api/', accent: '#7c3aed', monogram: 'CIR', risk: 'Review',
    usageNote: 'CIRCL permits anonymous use up to 20 requests per minute and requires automated clients to identify themselves with a meaningful User-Agent containing a contact URL or email. This browser workbench cannot set that protected header, so structured agent execution and automated live verification are disabled; the human-triggered Request Lab remains available for targeted interactive lookups. Use vulnerability records as investigation evidence, not as an automatic patching decision, and confirm affected versions and remediation guidance from the vendor or package ecosystem.',
    agentExecution: {
      mode: 'manual-only',
      reason: 'CIRCL requires automated clients to send a meaningful User-Agent containing a contact URL or email. Browser JavaScript cannot set that protected header, so generic structured execution cannot satisfy the provider policy.',
      policyUrl: 'https://vulnerability.circl.lu/.well-known/api-policy.json',
    },
    fields: [cveField('CVE ID')],
    buildUrl: ({ cve = 'CVE-2021-44228' }) => `https://vulnerability.circl.lu/api/vulnerability/${encode(cve.trim().toUpperCase() || 'CVE-2021-44228')}`,
  },
]


const curatedFiveApiExpansionApis: ApiDemo[] = [
  {
    id: 'open-meteo-seasonal', name: 'Open-Meteo Seasonal Outlook', provider: 'Open-Meteo', category: 'Weather',
    description: 'Compare calendar-aligned weekly ECMWF EC46 temperature and precipitation means with model-climatology anomalies over a bounded forecast-day horizon.',
    keywords: ['seasonal forecast', 'long range weather', 'weather anomaly', 'ECMWF EC46', 'climate outlook'],
    documentationUrl: 'https://open-meteo.com/en/docs/seasonal-forecast-api', accent: '#2563eb', monogram: 'OMS',
    usageNote: 'Seasonal data are coarse-resolution ensemble area forecasts and are not bias-corrected. The provider input is a forecast-day horizon, while weekly products are calendar-aligned: a 42-day horizon can intersect seven labelled weekly buckets because the first or final bucket may be partial. Do not interpret returned bucket count as an exact number of requested weeks.',
    fields: [
      ...latLongFields(),
      numberField('forecastDays', { label: 'Forecast horizon (days)', defaultValue: '42', min: 1, max: 46, step: 1, help: 'Request 1–46 whole forecast days of EC46 weekly products. Calendar-aligned weekly buckets can include partial boundary weeks, so their count may differ from forecast days divided by seven.' }),
    ],
    buildUrl: ({ latitude = '1.3521', longitude = '103.8198', forecastDays = '42' }) => `https://seasonal-api.open-meteo.com/v1/seasonal?${new URLSearchParams({ latitude, longitude, weekly: 'temperature_2m_mean,temperature_2m_anomaly,precipitation_mean,precipitation_anomaly', forecast_days: forecastDays.trim(), timezone: 'Asia/Singapore' }).toString()}`,
  },
  {
    id: 'nhtsa-safety-ratings', name: 'NHTSA Safety Ratings', provider: 'NHTSA', category: 'Vehicle',
    description: 'Look up official U.S. NCAP crash-test, rollover, complaint, recall, and investigation facts for one NHTSA VehicleId.',
    keywords: ['car safety rating', 'crash test rating', 'NCAP', 'vehicle rollover', 'vehicle safety'],
    documentationUrl: 'https://www.nhtsa.gov/nhtsa-datasets-and-apis', accent: '#1d4ed8', monogram: 'NCAP',
    usageNote: 'Ratings describe the provider record for a specific NHTSA VehicleId. “Not Rated” is a provider value, not a zero-star rating. NHTSA calls OverallRating the Overall Vehicle Score; do not confuse it with an overall frontal or side crash rating. Overall Vehicle Scores and frontal crash ratings should only be compared with vehicles in the same class and within ±250 lb, while side and rollover ratings may be compared across classes. This VehicleId response does not include the curb-weight/class facts needed to validate an Overall/frontal competitive comparison. This demo is not a VIN eligibility or recall-repair lookup.',
    fields: [textField('vehicleId', {
      label: 'NHTSA Vehicle ID', defaultValue: '19426', placeholder: 'e.g. 19426', minLength: 1, maxLength: 6,
      pattern: '[1-9][0-9]{0,5}',
      patternDescription: 'must be a canonical positive decimal ID from 1 to 999999.',
      help: 'Enter a canonical VehicleId returned by the NHTSA Safety Ratings API, for example 19426 for a 2024 Toyota Camry FWD. This demo supports IDs from 1 to 999999; that workbench bound is not a provider-wide maximum.',
    })],
    buildUrl: ({ vehicleId = '19426' }) => `https://api.nhtsa.gov/SafetyRatings/VehicleId/${encode(vehicleId.trim())}?format=json`,
  },
  {
    id: 'singstat-cpi-monthly', name: 'Singapore CPI Monthly', provider: 'Singapore Department of Statistics', category: 'Singapore',
    description: 'Read the official seasonally adjusted Singapore all-items Consumer Price Index with 2024 as the base year.',
    keywords: ['Singapore CPI', 'Singapore inflation', 'consumer price index', 'SingStat prices'],
    documentationUrl: 'https://tablebuilder.singstat.gov.sg/view-api/for-developers', accent: '#dc2626', monogram: 'CPI',
    usageNote: 'SingStat Developer APIs are rate-limited to 100 calls per minute per IP. This demo asks the provider for the latest 12 All Items observations using the documented limit and key-descending sort parameters instead of downloading the full history. Values may be revised; preserve the provider update date and 2024-base-year index context.',
    fields: [],
    buildUrl: () => `https://tablebuilder.singstat.gov.sg/api/table/tabledata/M213752?${new URLSearchParams({ seriesNoORrowNo: '1', limit: '12', sortBy: 'key desc' }).toString()}`,
  },
  {
    id: 'openalex-works-search', name: 'OpenAlex Works Search', provider: 'OpenAlex', category: 'Research',
    description: 'Search the OpenAlex research graph for works with citation counts, DOI identity, authorship, and open-access status.',
    keywords: ['research graph', 'academic works', 'citation search', 'open access papers', 'scholarly graph'],
    documentationUrl: 'https://help.openalex.org/api/searching/', accent: '#7c3aed', monogram: 'OA',
    usageNote: 'Casual OpenAlex API use can be keyless; a free API key raises the daily usage budget. This demo uses the current documented search/per_page/select request shape. Citation counts and open-access metadata are OpenAlex graph facts and may differ from other indexes.',
    automatedVerification: {
      mode: 'enabled',
      retryOnRateLimit: false,
      reason: 'OpenAlex requires exponential backoff after HTTP 429. Generic health verification records the first 429 and defers another provider request to a later independent run instead of retrying immediately.',
      policyUrl: 'https://help.openalex.org/api/errors/',
    },
    fields: [
      queryField({ label: 'Works search', defaultValue: 'artificial intelligence', placeholder: 'e.g. artificial intelligence', minLength: 1, help: 'Search OpenAlex indexed works by text.' }),
      limitField({ label: 'Works', defaultValue: '8', min: 1, max: 20, step: 1, help: 'Return between 1 and 20 research works.' }),
    ],
    buildUrl: ({ query = 'artificial intelligence', limit = '8' }) => `https://api.openalex.org/works?${new URLSearchParams({ search: query.trim(), per_page: limit.trim(), select: 'id,title,publication_year,cited_by_count,doi,authorships,open_access' }).toString()}`,
  },
  {
    id: 'oecd-cli', name: 'OECD Composite Leading Indicator', provider: 'OECD', category: 'Economy',
    description: 'Track the OECD harmonised monthly Composite Leading Indicator for a selected economy as a directional turning-point signal.',
    keywords: ['OECD CLI', 'leading indicator', 'business cycle', 'economic turning point', 'macro outlook'],
    documentationUrl: 'https://www.oecd.org/en/data/insights/data-explainers/2024/09/api.html', accent: '#2563eb', monogram: 'CLI',
    usageNote: 'The OECD CLI is designed for qualitative short-term movement and turning-point signals, not as a quantitative GDP forecast. OECD Data Explorer APIs are free of charge and rate-limited.',
    fields: [
      { id: 'area', label: 'Economy', type: 'select', defaultValue: 'USA', help: 'Choose an OECD CLI reference area.', options: [
        { label: 'United States', value: 'USA' }, { label: 'Japan', value: 'JPN' }, { label: 'Germany', value: 'DEU' }, { label: 'United Kingdom', value: 'GBR' }, { label: 'Canada', value: 'CAN' }, { label: 'Australia', value: 'AUS' },
      ] },
      numberField('startYear', { label: 'Start year', defaultValue: '2025', min: 2000, max: 2100, help: 'Beginning year for the monthly CLI series.' }),
    ],
    buildUrl: ({ area = 'USA', startYear = '2025' }) => `https://sdmx.oecd.org/public/rest/v1/data/OECD.SDD.STES,DSD_STES@DF_CLI/${encode(area || 'USA').toUpperCase()}.M.LI...AA...H?${new URLSearchParams({ startPeriod: `${clampInt(startYear, 2000, 2100, 2025)}-01`, dimensionAtObservation: 'AllDimensions', format: 'jsondata' }).toString()}`,
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
  ...curatedFiveApiExpansionApis,
]

export const getAgentExecutionPolicy = (api: ApiDemo): AgentExecutionPolicy =>
  api.agentExecution ?? { mode: 'enabled' }

export const getAutomatedVerificationPolicy = (api: ApiDemo): AutomatedVerificationPolicy =>
  api.automatedVerification ?? { mode: 'enabled' }

export const getDefaultParameters = (api: ApiDemo): Record<string, string> =>
  Object.fromEntries(api.fields.map((field) => [field.id, field.defaultValue]))

export const getApiById = (id: string): ApiDemo | undefined =>
  apiCatalog.find((api) => api.id === id)

export const validateParameters = (
  api: ApiDemo,
  parameters: Record<string, string>,
): Record<string, string> => {
  const errors: Record<string, string> = {}
  const declaredFieldIds = new Set(api.fields.map((field) => field.id))

  for (const key of Object.keys(parameters)) {
    if (!declaredFieldIds.has(key)) errors[key] = `Unknown parameter: ${key}.`
  }

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
      } else if (field.step !== undefined) {
        const stepBase = field.min ?? 0
        const stepOffset = (numericValue - stepBase) / field.step
        if (Math.abs(stepOffset - Math.round(stepOffset)) > 1e-9) {
          errors[field.id] = `${field.label} must use increments of ${field.step}.`
        }
      }
    } else if (field.type === 'text') {
      if (field.minLength !== undefined && value.length < field.minLength) {
        errors[field.id] = `${field.label} must be at least ${field.minLength} characters.`
      } else if (field.maxLength !== undefined && value.length > field.maxLength) {
        errors[field.id] = `${field.label} must be at most ${field.maxLength} characters.`
      } else if (field.pattern && !new RegExp(`^(?:${field.pattern})$`).test(value)) {
        errors[field.id] = `${field.label} ${field.patternDescription ?? 'has an invalid format.'}`
      }
    } else if (field.type === 'date' && !isIsoCalendarDate(value)) {
      errors[field.id] = `${field.label} must be a valid date in YYYY-MM-DD format.`
    } else if (field.options?.length && !field.options.some((option) => option.value === value)) {
      errors[field.id] = `${field.label} must be one of the supported options.`
    }
  }

  for (const field of api.fields) {
    if (!field.minimumFromField || errors[field.id] || errors[field.minimumFromField]) continue
    const minimumField = api.fields.find((candidate) => candidate.id === field.minimumFromField)
    if (!minimumField || minimumField.type !== field.type) continue

    const value = parameters[field.id]?.trim() ?? ''
    const minimumValue = parameters[minimumField.id]?.trim() ?? ''
    if (!value || !minimumValue) continue

    if (field.type === 'date' && isIsoCalendarDate(value) && isIsoCalendarDate(minimumValue) && value < minimumValue) {
      errors[field.id] = `${field.label} must be on or after ${minimumField.label}.`
    } else if (field.type === 'number') {
      const numericValue = Number(value)
      const numericMinimum = Number(minimumValue)
      if (Number.isFinite(numericValue) && Number.isFinite(numericMinimum) && numericValue < numericMinimum) {
        errors[field.id] = `${field.label} must be greater than or equal to ${minimumField.label}.`
      }
    }
  }

  return errors
}
