export type ApiCategory = 'Data' | 'Nature' | 'People' | 'Utility'

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
}

const encode = (value: string) => encodeURIComponent(value.trim())

export const apiCatalog: ApiDemo[] = [
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
