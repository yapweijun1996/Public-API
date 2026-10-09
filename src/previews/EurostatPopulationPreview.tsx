import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, numericText, text } from './cardPrimitives'

const expectedDimensionOrder = ['freq', 'unit', 'age', 'sex', 'geo', 'time'] as const
const fixedDimensions: Record<string, string> = { freq: 'A', unit: 'NR', age: 'TOTAL', sex: 'T' }
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

const singleDimensionValue = (root: Record<string, unknown>, key: string) => {
  const dimension = asRecord(asRecord(root.dimension)[key])
  const category = asRecord(dimension.category)
  const index = asRecord(category.index)
  const labels = asRecord(category.label)
  const entries = Object.entries(index)
  if (entries.length !== 1 || entries[0][1] !== 0) return undefined
  const code = entries[0][0]
  return { code, label: text(labels[code]) ?? code }
}

type EurostatRequest = { geo: string; year: string }
type BoundEurostatRequest = { request?: EurostatRequest; transportBound: boolean; invalidReason?: string }

const REQUEST_PATH = '/eurostat/api/dissemination/statistics/1.0/data/demo_pjan'
const REQUEST_KEYS = ['format', 'geo', 'sex', 'age', 'time'] as const

export const parseEurostatPopulationRequest = (requestUrl?: string): EurostatRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'ec.europa.eu' || url.port || url.username || url.password || url.hash
      || url.pathname !== REQUEST_PATH || keys.length !== REQUEST_KEYS.length
      || REQUEST_KEYS.some((key) => url.searchParams.getAll(key).length !== 1)
      || keys.some((key) => !REQUEST_KEYS.includes(key as (typeof REQUEST_KEYS)[number]))) return undefined

    const format = url.searchParams.get('format')
    const geo = url.searchParams.get('geo') ?? ''
    const sex = url.searchParams.get('sex')
    const age = url.searchParams.get('age')
    const year = url.searchParams.get('time') ?? ''
    if (format !== 'JSON' || sex !== 'T' || age !== 'TOTAL' || !/^[A-Z]{2}$/.test(geo) || !/^\d{4}$/.test(year)) return undefined
    const numericYear = Number(year)
    if (!Number.isInteger(numericYear) || numericYear < 2010 || numericYear > 2025) return undefined

    const canonical = `https://ec.europa.eu${REQUEST_PATH}?${new URLSearchParams({ format: 'JSON', geo, sex: 'T', age: 'TOTAL', time: year }).toString()}`
    return requestUrl === canonical ? { geo, year } : undefined
  } catch {
    return undefined
  }
}

const bindEurostatPopulationRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): BoundEurostatRequest => {
  if (!requestUrl) return { transportBound: false }
  const request = parseEurostatPopulationRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported Eurostat demo_pjan single-cell request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET Eurostat request.' }
  }
  const executed = parseEurostatPopulationRequest(executedRequest.url)
  if (!executed || executed.geo !== request.geo || executed.year !== request.year) {
    return { request, transportBound: false, invalidReason: 'The displayed Eurostat request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const exactCellValue = (value: unknown) => {
  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: 'empty' as const }
    if (value.length !== 1) return { kind: 'invalid' as const }
    const population = value[0]
    if (population === null) return { kind: 'empty' as const }
    return typeof population === 'number' && Number.isInteger(population) && population >= 0
      ? { kind: 'value' as const, population } : { kind: 'invalid' as const }
  }
  if (!isRecord(value)) return { kind: 'invalid' as const }
  const keys = Object.keys(value)
  if (keys.length === 0) return { kind: 'empty' as const }
  if (keys.length !== 1 || keys[0] !== '0') return { kind: 'invalid' as const }
  const population = value['0']
  if (population === null) return { kind: 'empty' as const }
  return typeof population === 'number' && Number.isInteger(population) && population >= 0
    ? { kind: 'value' as const, population } : { kind: 'invalid' as const }
}

export function EurostatPopulationPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!isRecord(data)) return <CardEmpty domain="population-statistic" title="Invalid Eurostat population response" detail="Eurostat returned HTTP-success data that was not a JSON-stat dataset object." state="invalid"/>

  const root = data
  const ids = Array.isArray(root.id) ? root.id : undefined
  const sizes = Array.isArray(root.size) ? root.size : undefined
  const dimensions = expectedDimensionOrder.map((key) => [key, singleDimensionValue(root, key)] as const)
  const dimensionMap = Object.fromEntries(dimensions) as Record<(typeof expectedDimensionOrder)[number], { code: string; label: string } | undefined>
  const idsValid = Boolean(ids && ids.length === expectedDimensionOrder.length && ids.every((id, index) => id === expectedDimensionOrder[index]))
  const sizesValid = Boolean(sizes && sizes.length === expectedDimensionOrder.length && sizes.every((size) => size === 1))
  const dimensionObject = isRecord(root.dimension) ? root.dimension : undefined
  const dimensionKeysValid = Boolean(dimensionObject && Object.keys(dimensionObject).length === expectedDimensionOrder.length && expectedDimensionOrder.every((key) => key in dimensionObject))
  const dimensionsValid = dimensionKeysValid && dimensions.every(([, value]) => Boolean(value))
  const fixedDimensionsValid = Object.entries(fixedDimensions).every(([key, expected]) => dimensionMap[key as keyof typeof dimensionMap]?.code === expected)
  const providerMetadataValid = root.version === '2.0' && root.class === 'dataset' && root.source === 'ESTAT'
  const binding = bindEurostatPopulationRequest(requestUrl, executedRequest)
  const request = binding.request
  const identityMatch = request ? dimensionMap.geo?.code === request.geo && dimensionMap.time?.code === request.year : undefined
  const cubeContractValid = idsValid && sizesValid && dimensionsValid && fixedDimensionsValid && providerMetadataValid && !binding.invalidReason && identityMatch !== false

  if (!cubeContractValid) return <CardEmpty domain="population-statistic" title="Invalid Eurostat population response" detail={binding.invalidReason ?? 'The HTTP-success response did not match the documented single-cell demo_pjan JSON-stat dimension contract for this request.'} state="invalid"/>

  const cell = exactCellValue(root.value)
  if (cell.kind === 'invalid') return <CardEmpty domain="population-statistic" title="Invalid Eurostat population response" detail="The exact JSON-stat cube did not contain a valid non-negative integer population cell." state="invalid"/>
  if (cell.kind === 'empty') {
    const resultState = binding.transportBound ? 'empty' : 'partial'
    return <div className="domain-card domain-empty" data-domain-card="population-statistic" data-result-state={resultState}
      data-request-bound={String(binding.transportBound)} data-request-contract="exact-eurostat-demo-pjan-single-cell-v2"
      data-requested-geo-code={request?.geo ?? ''} data-requested-reference-year={request?.year ?? ''} data-identity-match={request ? 'true' : 'unbound'}>
      <h3>{resultState === 'empty' ? 'Population statistic unavailable' : 'Population statistic not request-bound'}</h3>
      <p>{resultState === 'empty' ? 'Eurostat returned the exact requested single statistical cell without a published population value.' : 'Eurostat returned a coherent empty single-cell dataset, but executed request evidence was unavailable, so the result is not claimed as request-bound empty.'}</p>
    </div>
  }

  const geo = dimensionMap.geo!, year = dimensionMap.time!, unit = dimensionMap.unit!, sex = dimensionMap.sex!, age = dimensionMap.age!, frequency = dimensionMap.freq!
  const updated = text(root.updated)
  const status = text(root.status) ?? (isRecord(root.status) ? text(root.status['0']) : Array.isArray(root.status) ? text(root.status[0]) : undefined)
  const resultState = binding.transportBound ? 'ready' : 'partial'

  return <div className="domain-card eurostat-population-preview" data-domain-card="population-statistic" data-result-state={resultState}
    data-request-bound={String(binding.transportBound)} data-request-contract="exact-eurostat-demo-pjan-single-cell-v2"
    data-primary-population={cell.population} data-geo-code={geo.code} data-reference-year={year.code} data-unit-code={unit.code}
    data-age-code={age.code} data-sex-code={sex.code} data-frequency-code={frequency.code} data-requested-geo-code={request?.geo ?? ''}
    data-requested-reference-year={request?.year ?? ''} data-identity-match={request ? 'true' : 'unbound'} data-cell-count="1"
    data-dimension-contract-valid="true" data-dataset="demo_pjan" data-dataset-updated={updated} data-provider-status={status}>
    <CardHeading eyebrow="Eurostat · demo_pjan" title={`${numericText(cell.population)} people`} description={`${geo.label} · Population on 1 January ${year.label}`}>
      <span className={`domain-state${resultState === 'partial' ? ' warning' : ''}`}>{resultState === 'ready' ? unit.label : 'Unbound execution identity'}</span>
    </CardHeading>
    {resultState === 'partial' && <p className="domain-note">The JSON-stat cell is internally coherent, but executed request evidence was unavailable to prove that the returned geography and year came from the exact supported bodyless GET request.</p>}
    <Facts items={[
      { label: 'Geography', value: `${geo.label} (${geo.code})` }, { label: 'Reference date', value: `1 January ${year.label}` },
      { label: 'Unit', value: `${unit.label} (${unit.code})` }, { label: 'Age class', value: age.label }, { label: 'Sex', value: sex.label },
      { label: 'Frequency', value: frequency.label }, { label: 'Dataset updated', value: updated ? <time dateTime={updated}>{updated}</time> : 'Not supplied' },
      { label: 'Provider status flag', value: status ?? 'None supplied' },
    ]}/>
    <p className="domain-note">Eurostat dataset <code>demo_pjan</code> is “Population on 1 January by age and sex”. This demo accepts only one JSON-stat cell whose dimensions are annual frequency, unit “Number”, total age, total sex, and the requested geography/year; malformed or multi-cell HTTP-success data is not reduced to an arbitrary first value.</p>
  </div>
}
