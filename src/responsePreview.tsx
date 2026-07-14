import type { CSSProperties, ReactNode } from 'react'
import type { ApiDemo } from './apiCatalog'

export type PreviewLayout =
  | 'weather-dashboard'
  | 'country-profile'
  | 'market-chart'
  | 'media-gallery'
  | 'location-map'
  | 'calendar-timeline'
  | 'result-list'

export type DemoPreviewItem = {
  title: string
  fields: Array<{ label: string; value: string }>
}

type MediaItem = { image: string; title: string; subtitle?: string }
type LocationPoint = { latitude: number; longitude: number; label: string; detail?: string }
type MarketSnapshot = { label: string; value: number; currency?: string; points: number[]; dates: string[]; metrics: Array<{ label: string; value: string }> }

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const previewTitleKeys = ['name', 'title', 'label', 'commonname', 'country', 'city', 'id', 'code']
const previewCollectionKeys = ['results', 'items', 'records', 'data', 'features', 'entries', 'result', 'docs']

const previewLabel = (key: string) => key
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .split(' ')
  .filter(Boolean)
  .map((word) => ['id', 'url', 'api', 'iso', 'utc', 'gdp'].includes(word.toLowerCase()) ? word.toUpperCase() : `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
  .join(' ')

const previewValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)
  if (typeof value === 'string') return value.length > 90 ? `${value.slice(0, 87)}…` : value
  if (Array.isArray(value)) {
    const scalars = value.filter((item) => ['string', 'number', 'boolean'].includes(typeof item))
    return scalars.length === value.length ? scalars.slice(0, 4).map(previewValue).join(', ') : `${value.length} items`
  }
  if (isRecord(value)) {
    for (const key of ['value', 'name', 'title', 'label', 'id', 'code']) {
      if (key in value && !isRecord(value[key]) && !Array.isArray(value[key])) return previewValue(value[key])
    }
    return `${Object.keys(value).length} properties`
  }
  return String(value)
}

const findPreviewRecords = (value: unknown, depth = 0): Array<Record<string, unknown>> => {
  if (depth > 6) return []
  if (Array.isArray(value)) {
    const directRecords = value.filter(isRecord)
    if (directRecords.length && directRecords.length === value.length) return directRecords
    for (const item of value) {
      const nested = findPreviewRecords(item, depth + 1)
      if (nested.length) return nested
    }
    return directRecords
  }
  if (!isRecord(value)) return []
  for (const key of previewCollectionKeys) {
    if (key in value) {
      const nested = findPreviewRecords(value[key], depth + 1)
      if (nested.length) return nested
    }
  }
  for (const item of Object.values(value)) {
    if (!Array.isArray(item) && !isRecord(item)) continue
    const nested = findPreviewRecords(item, depth + 1)
    if (nested.length) return nested
  }
  return depth === 0 ? [value] : []
}

export const buildDemoPreview = (data: unknown): DemoPreviewItem[] => {
  const records = findPreviewRecords(data)
  if (!records.length) {
    if (Array.isArray(data)) return data.slice(0, 6).map((value, index) => ({ title: `Result ${index + 1}`, fields: [{ label: 'Value', value: previewValue(value) }] }))
    return [{ title: 'Response value', fields: [{ label: 'Value', value: previewValue(data) }] }]
  }
  return records.slice(0, 6).map((record, index) => {
    const entries = Object.entries(record)
    let titleEntry: [string, unknown] | undefined
    for (const preferredKey of previewTitleKeys) {
      titleEntry = entries.find(([key, value]) => key.toLowerCase() === preferredKey && ['string', 'number'].includes(typeof value))
      if (titleEntry) break
    }
    const fields = entries
      .filter(([key, value]) => key !== titleEntry?.[0] && value !== undefined)
      .slice(0, 6)
      .map(([key, value]) => ({ label: previewLabel(key), value: previewValue(value) }))
    return { title: titleEntry ? previewValue(titleEntry[1]) : `Result ${index + 1}`, fields: fields.length ? fields : [{ label: 'Value', value: previewValue(record) }] }
  })
}

const weatherIds = ['weather', 'data-gov-24hr-forecast', 'data-gov-4day-forecast', 'data-gov-air-temperature', 'data-gov-forecast-2hr', 'data-gov-pm25', 'data-gov-psi', 'data-gov-rainfall', 'data-gov-relative-humidity', 'data-gov-uv-index', 'data-gov-wind-direction', 'data-gov-wind-speed']
const mapIds = ['data-gov-carpark', 'data-gov-taxi', 'postcodes-io', 'usgs', 'nhtsa-vpic']
const galleryIds = ['dogs', 'people', 'data-gov-traffic-images', 'met-museum-object-detail', 'met-museum-search', 'art-institute-search', 'pokeapi', 'tvmaze-search', 'open-food-facts', 'gbif-species-search']

export function selectPreviewLayout(api: Pick<ApiDemo, 'id' | 'category'>): PreviewLayout {
  if (api.id === 'countries') return 'country-profile'
  if (['nws-weather', 'carbon-intensity-gb'].includes(api.id)) return 'result-list'
  if (weatherIds.includes(api.id) || api.category === 'Weather') return 'weather-dashboard'
  if (api.category === 'Finance' || api.category === 'Economy') return 'market-chart'
  if (galleryIds.includes(api.id) || ['Media', 'Nature', 'People', 'Food', 'Games', 'Entertainment', 'Biodiversity'].includes(api.category)) return 'media-gallery'
  if (mapIds.includes(api.id) || ['Geo', 'Vehicle'].includes(api.category)) return 'location-map'
  if (api.category === 'Calendar' || api.id === 'holidays') return 'calendar-timeline'
  return 'result-list'
}

const scalar = (value: unknown) => ['string', 'number', 'boolean'].includes(typeof value) ? value : undefined
const numberValue = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined
const textValue = (value: unknown) => scalar(value) === undefined ? undefined : String(value)
const recordValue = (value: unknown, key: string) => isRecord(value) ? value[key] : undefined

const findByKey = (value: unknown, keys: string[], depth = 0): unknown => {
  if (depth > 7 || value === null || value === undefined) return undefined
  if (isRecord(value)) {
    const entry = Object.entries(value).find(([key, item]) => keys.some((candidate) => key.toLowerCase() === candidate.toLowerCase()) && scalar(item) !== undefined)
    if (entry) return entry[1]
    for (const item of Object.values(value)) {
      const found = findByKey(item, keys, depth + 1)
      if (found !== undefined) return found
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findByKey(item, keys, depth + 1)
      if (found !== undefined) return found
    }
  }
  return undefined
}

const formatNumber = (value: number, digits = 1) => new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value)
const compactNumber = (value: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
const cleanText = (value: unknown) => textValue(value)?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

const weatherCondition = (code: number | undefined) => {
  if (code === undefined) return { label: 'Live conditions', icon: '◌' }
  if (code === 0) return { label: 'Clear sky', icon: '☀' }
  if (code <= 3) return { label: 'Partly cloudy', icon: '☁' }
  if ([45, 48].includes(code)) return { label: 'Foggy', icon: '≋' }
  if (code <= 67 || [80, 81, 82].includes(code)) return { label: 'Rain showers', icon: '☂' }
  if (code >= 95) return { label: 'Thunderstorms', icon: 'ϟ' }
  return { label: 'Mixed conditions', icon: '◒' }
}

const measurementMeta = (api: ApiDemo) => {
  if (api.id === 'data-gov-pm25') return { label: 'PM2.5 reading', unit: ' µg/m³' }
  if (api.id === 'data-gov-psi') return { label: 'Air quality index', unit: ' PSI' }
  if (api.id === 'data-gov-rainfall') return { label: 'Rainfall', unit: ' mm' }
  if (api.id === 'data-gov-relative-humidity') return { label: 'Relative humidity', unit: '%' }
  if (api.id === 'data-gov-uv-index') return { label: 'UV index', unit: '' }
  if (api.id === 'data-gov-wind-direction') return { label: 'Wind direction', unit: '°' }
  if (api.id === 'data-gov-wind-speed') return { label: 'Wind speed', unit: ' km/h' }
  return { label: 'Current conditions', unit: undefined }
}

function WeatherPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const root = isRecord(data) ? data : {}
  const current = isRecord(root.current) ? root.current : findPreviewRecords(data)[0] ?? {}
  const units = isRecord(root.current_units) ? root.current_units : {}
  const temperature = numberValue(current.temperature_2m ?? findByKey(data, ['temperature_2m', 'temperature', 'value']))
  const humidity = numberValue(current.relative_humidity_2m ?? findByKey(data, ['relative_humidity_2m', 'humidity']))
  const wind = numberValue(current.wind_speed_10m ?? findByKey(data, ['wind_speed_10m', 'wind_speed']))
  const code = numberValue(current.weather_code ?? findByKey(data, ['weather_code']))
  const condition = weatherCondition(code)
  const timezone = textValue(root.timezone) ?? textValue(findByKey(data, ['area', 'location'])) ?? 'Live station'
  const location = timezone.split('/').at(-1)?.replace(/_/g, ' ') ?? timezone
  const time = textValue(current.time ?? findByKey(data, ['timestamp', 'date']))
  const temperatureUnit = textValue(units.temperature_2m) ?? '°C'
  const measurement = measurementMeta(api)
  const primaryUnit = measurement.unit ?? temperatureUnit
  const metrics = [
    { label: 'Humidity', value: humidity === undefined ? 'Live reading' : `${formatNumber(humidity)}%`, icon: '◉' },
    { label: 'Wind speed', value: wind === undefined ? 'Live reading' : `${formatNumber(wind)} ${textValue(units.wind_speed_10m) ?? 'km/h'}`, icon: '≈' },
    { label: 'Coordinates', value: root.latitude !== undefined && root.longitude !== undefined ? `${formatNumber(Number(root.latitude), 3)}, ${formatNumber(Number(root.longitude), 3)}` : 'Station supplied', icon: '⌖' },
  ]
  return <div className="weather-preview">
    <div className="weather-hero">
      <div><span className="weather-location">⌖ {location}</span><strong>{temperature === undefined ? 'Live' : `${formatNumber(temperature)}${primaryUnit}`}</strong><b>{code === undefined ? measurement.label : condition.label}</b><small>{time ? `Updated ${time.replace('T', ' ')}` : 'Current observation'}</small></div>
      <span className="weather-symbol" aria-hidden="true">{condition.icon}</span>
    </div>
    <div className="weather-metrics">{metrics.map((metric) => <article key={metric.label}><span aria-hidden="true">{metric.icon}</span><div><small>{metric.label}</small><strong>{metric.value}</strong></div></article>)}</div>
  </div>
}

function CountryPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const country = findPreviewRecords(data)[0] ?? (isRecord(data) ? data : {})
  const name = textValue(country.name) ?? 'Country profile'
  const code = textValue(country.iso2Code ?? country.id ?? country.code) ?? api.monogram
  const region = previewValue(country.region ?? 'Regional data')
  const facts = [
    ['Capital city', previewValue(country.capitalCity)],
    ['Income group', previewValue(country.incomeLevel)],
    ['Lending type', previewValue(country.lendingType)],
    ['Coordinates', country.latitude !== undefined && country.longitude !== undefined ? `${previewValue(country.latitude)}, ${previewValue(country.longitude)}` : '—'],
  ]
  return <div className="country-preview">
    <div className="country-hero"><span className="country-code">{code}</span><div><small>World profile</small><h3>{name}</h3><p><span>●</span> {region}</p></div><span className="country-globe" aria-hidden="true">◎</span></div>
    <dl className="country-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </div>
}

function marketSnapshot(api: ApiDemo, data: unknown): MarketSnapshot {
  if (api.id === 'yahoo-finance-sgx-history' && isRecord(data)) {
    const chart = isRecord(data.chart) ? data.chart : {}
    const result = Array.isArray(chart.result) && isRecord(chart.result[0]) ? chart.result[0] : {}
    const meta = isRecord(result.meta) ? result.meta : {}
    const quote = isRecord(result.indicators) && Array.isArray(result.indicators.quote) && isRecord(result.indicators.quote[0]) ? result.indicators.quote[0] : {}
    const closes = Array.isArray(quote.close) ? quote.close.map(numberValue).filter((item): item is number => item !== undefined) : []
    const timestamps = Array.isArray(result.timestamp) ? result.timestamp.map((item) => typeof item === 'number' ? new Date(item * 1000).toISOString().slice(0, 10) : String(item)) : []
    const latest = closes.at(-1) ?? numberValue(meta.regularMarketPrice) ?? 0
    return { label: textValue(meta.symbol) ?? api.name, value: latest, currency: textValue(meta.currency), points: closes, dates: timestamps, metrics: [['Day high', quote.high], ['Day low', quote.low], ['Volume', quote.volume]].map(([label, values]) => ({ label: String(label), value: Array.isArray(values) ? previewValue(values.at(-1)) : previewValue(values) })) }
  }
  if (api.id === 'coinpaprika-ticker' && isRecord(data)) {
    const usd = isRecord(data.quotes) && isRecord(data.quotes.USD) ? data.quotes.USD : {}
    const price = numberValue(usd.price) ?? 0
    return { label: `${textValue(data.name) ?? api.name} · ${textValue(data.symbol) ?? ''}`, value: price, currency: 'USD', points: [price], dates: [textValue(data.last_updated) ?? 'Latest'], metrics: [['24h change', usd.percent_change_24h], ['Market cap', usd.market_cap], ['24h volume', usd.volume_24h]].map(([label, value]) => ({ label: String(label), value: numberValue(value) === undefined ? '—' : label === '24h change' ? `${formatNumber(Number(value), 2)}%` : compactNumber(Number(value)) })) }
  }
  const records = findPreviewRecords(data)
  const rateRecords = records.map((record) => ({ record, value: numberValue(record.rate ?? record.value ?? record.close ?? record.price), date: textValue(record.date ?? record.period ?? record.year) })).filter((item): item is { record: Record<string, unknown>; value: number; date: string | undefined } => item.value !== undefined)
  const points = rateRecords.map((item) => item.value)
  const latestRecord = rateRecords.at(-1)?.record ?? records[0] ?? {}
  const latest = points.at(-1) ?? numberValue(findByKey(data, ['rate', 'value', 'price', 'close'])) ?? 0
  const pair = latestRecord.base && (latestRecord.quote || latestRecord.currency) ? `${latestRecord.base}/${latestRecord.quote ?? latestRecord.currency}` : api.name
  const series = points.length ? points : [latest]
  return {
    label: String(pair),
    value: latest,
    currency: textValue(latestRecord.quote ?? latestRecord.currency),
    points: series,
    dates: rateRecords.map((item) => item.date ?? ''),
    metrics: [
      { label: 'Period high', value: formatNumber(Math.max(...series), 4) },
      { label: 'Period low', value: formatNumber(Math.min(...series), 4) },
      { label: 'Observations', value: compactNumber(series.length) },
    ],
  }
}

function Sparkline({ values }: { values: number[] }) {
  const clean = values.filter(Number.isFinite).slice(-60)
  const points = clean.length > 1 ? clean : [clean[0] ?? 0, clean[0] ?? 0]
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const path = points.map((value, index) => `${(index / (points.length - 1)) * 100},${34 - ((value - min) / range) * 27}`).join(' ')
  return <svg className="market-sparkline" viewBox="0 0 100 38" preserveAspectRatio="none" role="img" aria-label="Price history sparkline"><defs><linearGradient id="marketArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3975f7" stopOpacity=".28"/><stop offset="1" stopColor="#3975f7" stopOpacity="0"/></linearGradient></defs><polygon points={`0,38 ${path} 100,38`} fill="url(#marketArea)"/><polyline points={path} fill="none" stroke="#3975f7" strokeWidth="1.8" vectorEffect="non-scaling-stroke"/></svg>
}

function MarketPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const snapshot = marketSnapshot(api, data)
  const first = snapshot.points[0] ?? snapshot.value
  const change = first ? ((snapshot.value - first) / Math.abs(first)) * 100 : 0
  return <div className="market-preview">
    <div className="market-summary"><div><span>{snapshot.label}</span><strong>{snapshot.currency ? `${snapshot.currency} ` : ''}{formatNumber(snapshot.value, snapshot.value < 10 ? 4 : 2)}</strong><small className={change < 0 ? 'negative' : ''}>{change < 0 ? '↓' : '↑'} {formatNumber(Math.abs(change), 2)}% across this response</small></div><div className="market-range"><span>{snapshot.dates[0] || 'First point'}</span><span>{snapshot.dates.at(-1) || 'Latest'}</span></div></div>
    <Sparkline values={snapshot.points}/>
    <div className="market-metrics">{(snapshot.metrics.length ? snapshot.metrics : [{ label: 'Data points', value: String(snapshot.points.length) }]).map((metric) => <article key={metric.label}><small>{metric.label}</small><strong>{metric.value}</strong></article>)}</div>
  </div>
}

const collectImageUrls = (value: unknown, found: string[] = [], depth = 0): string[] => {
  if (depth > 7 || found.length >= 8) return found
  if (typeof value === 'string' && /^https?:\/\//.test(value) && /\.(?:jpe?g|png|webp)(?:\?|$)/i.test(value)) found.push(value)
  else if (Array.isArray(value)) value.forEach((item) => collectImageUrls(item, found, depth + 1))
  else if (isRecord(value)) Object.entries(value).forEach(([key, item]) => {
    if (/image|picture|photo|sprite|thumbnail/i.test(key)) collectImageUrls(item, found, depth + 1)
  })
  return [...new Set(found)]
}

function mediaItems(api: ApiDemo, data: unknown): MediaItem[] {
  if (api.id === 'dogs' && isRecord(data) && Array.isArray(data.message)) return data.message.filter((item): item is string => typeof item === 'string').slice(0, 6).map((image, index) => ({ image, title: `Dog ${index + 1}`, subtitle: 'Random Dog gallery' }))
  if (api.id === 'people' && isRecord(data) && Array.isArray(data.results)) return data.results.filter(isRecord).slice(0, 6).map((person, index) => ({ image: textValue(recordValue(person.picture, 'large') ?? recordValue(person.picture, 'medium')) ?? '', title: isRecord(person.name) ? `${textValue(person.name.first) ?? ''} ${textValue(person.name.last) ?? ''}`.trim() : `Person ${index + 1}`, subtitle: textValue(person.email) })).filter((item) => item.image)
  if (api.id === 'art-institute-search' && isRecord(data)) {
    const base = isRecord(data.config) ? textValue(data.config.iiif_url) : undefined
    if (base && Array.isArray(data.data)) return data.data.filter(isRecord).filter((item) => item.image_id).slice(0, 6).map((item) => ({ image: `${base}/2/${item.image_id}/full/500,/0/default.jpg`, title: textValue(item.title) ?? 'Artwork', subtitle: textValue(item.artist_title) }))
  }
  const records = findPreviewRecords(data)
  const urls = collectImageUrls(data)
  return urls.slice(0, 6).map((image, index) => {
    const record = records[index] ?? records[0] ?? {}
    const nested = isRecord(record.show) ? record.show : isRecord(record.product) ? record.product : record
    return { image, title: textValue(nested.name ?? nested.title ?? nested.product_name) ?? `${api.name} ${index + 1}`, subtitle: cleanText(nested.artist_title ?? nested.email ?? nested.summary ?? nested.brands) }
  })
}

function MediaGalleryPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const items = mediaItems(api, data)
  if (!items.length) return <ResultListPreview data={data} api={api}/>
  return <div className={`media-preview ${items.length === 1 ? 'single' : ''}`}>{items.map((item, index) => <article key={`${item.image}-${index}`}><img src={item.image} alt="" loading="lazy"/><div><small>{api.category}</small><h3>{item.title}</h3>{item.subtitle && <p>{item.subtitle}</p>}</div></article>)}</div>
}

function locationPoints(data: unknown): LocationPoint[] {
  const points: LocationPoint[] = []
  const visit = (value: unknown, depth = 0) => {
    if (depth > 7 || points.length >= 8) return
    if (isRecord(value)) {
      const geometry = isRecord(value.geometry) ? value.geometry : undefined
      const coordinates = geometry && Array.isArray(geometry.coordinates) ? geometry.coordinates : undefined
      const latitude = numberValue(value.latitude ?? value.lat ?? (coordinates && coordinates.length === 2 ? coordinates[1] : undefined))
      const longitude = numberValue(value.longitude ?? value.lon ?? value.lng ?? (coordinates && coordinates.length === 2 ? coordinates[0] : undefined))
      if (latitude !== undefined && longitude !== undefined) {
        const properties = isRecord(value.properties) ? value.properties : value
        points.push({ latitude, longitude, label: textValue(properties.title ?? properties.place ?? properties.name ?? properties.camera_id ?? properties.postcode) ?? `Location ${points.length + 1}`, detail: properties.mag !== undefined ? `Magnitude ${previewValue(properties.mag)}` : undefined })
      }
      Object.values(value).forEach((item) => visit(item, depth + 1))
    } else if (Array.isArray(value)) value.forEach((item) => visit(item, depth + 1))
  }
  visit(data)
  return points
}

function LocationPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const points = locationPoints(data)
  if (!points.length) return <ResultListPreview data={data} api={api}/>
  const lats = points.map((point) => point.latitude)
  const lons = points.map((point) => point.longitude)
  const latMin = Math.min(...lats); const latRange = Math.max(...lats) - latMin || 1
  const lonMin = Math.min(...lons); const lonRange = Math.max(...lons) - lonMin || 1
  return <div className="location-preview"><div className="location-map" role="img" aria-label={`Map with ${points.length} response locations`}><span className="map-compass">N</span>{points.map((point, index) => <i key={`${point.latitude}-${point.longitude}-${index}`} style={{ '--point-x': `${10 + ((point.longitude - lonMin) / lonRange) * 80}%`, '--point-y': `${90 - ((point.latitude - latMin) / latRange) * 80}%` } as CSSProperties}><b>{index + 1}</b></i>)}</div><ol>{points.slice(0, 5).map((point, index) => <li key={`${point.label}-${index}`}><span>{index + 1}</span><div><strong>{point.label}</strong><small>{point.detail ?? `${formatNumber(point.latitude, 4)}, ${formatNumber(point.longitude, 4)}`}</small></div></li>)}</ol></div>
}

function CalendarPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const records = findPreviewRecords(data).slice(0, 6)
  if (!records.length) return <ResultListPreview data={data} api={api}/>
  return <ol className="calendar-preview">{records.map((record, index) => {
    const dateText = textValue(record.date ?? record.start ?? record.datetime) ?? 'Upcoming'
    const parsed = new Date(dateText)
    const valid = !Number.isNaN(parsed.getTime())
    return <li key={`${dateText}-${index}`}><time dateTime={dateText}><strong>{valid ? parsed.toLocaleDateString('en', { day: '2-digit' }) : '—'}</strong><span>{valid ? parsed.toLocaleDateString('en', { month: 'short' }) : dateText.slice(0, 3)}</span></time><div><small>{textValue(record.countryCode) ?? api.provider}</small><h3>{textValue(record.name ?? record.localName ?? record.title) ?? `Event ${index + 1}`}</h3><p>{record.localName && record.localName !== record.name ? textValue(record.localName) : record.global === true ? 'Observed nationally' : 'Public calendar event'}</p></div></li>
  })}</ol>
}

function ResultListPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const items = buildDemoPreview(data)
  return <div className="demo-preview-grid">{items.map((item, index) => <article className="demo-preview-card" aria-label={`${item.title} preview`} key={`${item.title}-${index}`}><div className="demo-preview-card-title"><span style={{ '--api-color': api.accent } as CSSProperties}>{api.monogram}</span><div><small>{api.name}</small><h3>{item.title}</h3></div></div><dl>{item.fields.map((field, fieldIndex) => <div key={`${field.label}-${fieldIndex}`}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl></article>)}</div>
}

const previewMeta: Record<PreviewLayout, { icon: string; eyebrow: string; title: string; description: string }> = {
  'weather-dashboard': { icon: '☀', eyebrow: 'Live response · Weather layout', title: 'Current conditions', description: 'A ready-to-use weather dashboard built from observations, units, and location data.' },
  'country-profile': { icon: '◎', eyebrow: 'Live response · Profile layout', title: 'Country profile', description: 'A structured destination profile using regional and economic metadata.' },
  'market-chart': { icon: '↗', eyebrow: 'Live response · Market layout', title: 'Market snapshot', description: 'A financial panel that turns price history and rates into an at-a-glance trend.' },
  'media-gallery': { icon: '▧', eyebrow: 'Live response · Visual layout', title: 'Visual gallery', description: 'An image-led interface using media, profile, or catalogue fields from the response.' },
  'location-map': { icon: '⌖', eyebrow: 'Live response · Location layout', title: 'Location explorer', description: 'A spatial interface that maps coordinates and keeps every location agent-readable.' },
  'calendar-timeline': { icon: '□', eyebrow: 'Live response · Calendar layout', title: 'Event timeline', description: 'A chronological interface built from dates, event names, and regional metadata.' },
  'result-list': { icon: '✦', eyebrow: 'Live response · Results layout', title: 'Result explorer', description: 'A structured result browser adapted to this API response.' },
}

export function ResponseDemoPreview({ api, data }: { api: ApiDemo; data: unknown }) {
  const layout = selectPreviewLayout(api)
  const meta = previewMeta[layout]
  let content: ReactNode
  if (layout === 'weather-dashboard') content = <WeatherPreview data={data} api={api}/>
  else if (layout === 'country-profile') content = <CountryPreview data={data} api={api}/>
  else if (layout === 'market-chart') content = <MarketPreview data={data} api={api}/>
  else if (layout === 'media-gallery') content = <MediaGalleryPreview data={data} api={api}/>
  else if (layout === 'location-map') content = <LocationPreview data={data} api={api}/>
  else if (layout === 'calendar-timeline') content = <CalendarPreview data={data} api={api}/>
  else content = <ResultListPreview data={data} api={api}/>

  const headingId = `demo-preview-${api.id}`
  return <section className={`demo-preview preview-${layout}`} aria-labelledby={headingId} aria-live="polite" data-webmcp-surface="api-demo-preview" data-preview-layout={layout} data-api-id={api.id}>
    <div className="demo-preview-head"><span aria-hidden="true">{meta.icon}</span><div><small>{meta.eyebrow}</small><h2 id={headingId}>{meta.title}</h2><p>{meta.description}</p></div><em><span aria-hidden="true">✓</span> Adaptive UI</em></div>
    {content}
    <p className="demo-preview-note">Generated only from the live JSON response · Layout: {layout}</p>
  </section>
}
