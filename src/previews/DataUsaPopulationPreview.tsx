import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { formatNumber } from './previewData'
import { isRecord, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

const DATASET = 'acs_yg_total_population_5'
const DRILLDOWNS = 'State,Year'
const MEASURE = 'Population'
const YEAR = 2023
const PAGE_LIMIT = 8
const PAGE_OFFSET = 0
const EXPECTED_COLUMNS = ['State ID', 'State', 'Year', 'Population'] as const

type DataUsaRequest = {
  year: number
  limit: number
  offset: number
}

type PopulationRow = {
  stateId: string
  state: string
  year: number
  population: number
}

type PopulationState = 'ready' | 'partial' | 'empty' | 'invalid'

type PopulationModel = {
  state: PopulationState
  reason?: string
  request?: DataUsaRequest
  envelopeContract: boolean
  columnsContract: boolean
  paginationContract: boolean
  rowIdentityContract: boolean
  providerRecordCount: number
  validRecordCount: number
  invalidRecordCount: number
  malformedPopulationCount: number
  providerLimit?: number
  providerOffset?: number
  providerTotal?: number
  sourceName?: string
  datasetName?: string
  rows: PopulationRow[]
}

const exactSearchKeys = (url: URL, allowedKeys: string[]) => {
  const entries = [...url.searchParams.entries()]
  return entries.length === allowedKeys.length
    && entries.every(([key]) => allowedKeys.includes(key))
    && allowedKeys.every((key) => entries.filter(([candidate]) => candidate === key).length === 1)
}

const parseLimit = (value: string | null) => {
  if (!value || !/^[1-9][0-9]*,[0-9]+$/.test(value)) return undefined
  const [limitText, offsetText] = value.split(',')
  const limit = Number(limitText)
  const offset = Number(offsetText)
  return Number.isSafeInteger(limit) && limit > 0 && Number.isSafeInteger(offset) && offset >= 0
    ? { limit, offset }
    : undefined
}

const parseRequest = (executedRequest?: ExecutedRequestContext): DataUsaRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const limit = parseLimit(url.searchParams.get('limit'))
    const valid = url.protocol === 'https:'
      && url.hostname === 'api.datausa.io'
      && url.port === ''
      && !url.username
      && !url.password
      && !url.hash
      && url.pathname === '/tesseract/data.jsonrecords'
      && exactSearchKeys(url, ['cube', 'drilldowns', 'measures', 'include', 'limit'])
      && url.searchParams.get('cube') === DATASET
      && url.searchParams.get('drilldowns') === DRILLDOWNS
      && url.searchParams.get('measures') === MEASURE
      && url.searchParams.get('include') === `Year:${YEAR}`
      && limit?.limit === PAGE_LIMIT
      && limit.offset === PAGE_OFFSET
    return valid ? { year: YEAR, limit: PAGE_LIMIT, offset: PAGE_OFFSET } : undefined
  } catch {
    return undefined
  }
}

const exactColumns = (value: unknown) => Array.isArray(value)
  && value.length === EXPECTED_COLUMNS.length
  && value.every((column, index) => column === EXPECTED_COLUMNS[index])

export const dataUsaPopulationModel = (data: unknown, executedRequest?: ExecutedRequestContext): PopulationModel => {
  const request = parseRequest(executedRequest)
  const envelope = isRecord(data) ? data : undefined
  const page = envelope && isRecord(envelope.page) ? envelope.page : undefined
  const providerRows = envelope && Array.isArray(envelope.data) ? envelope.data : []
  const envelopeContract = Boolean(envelope && page && Array.isArray(envelope.columns) && Array.isArray(envelope.data))
  const columnsContract = envelopeContract && exactColumns(envelope?.columns)
  const providerLimit = positiveSafeInteger(page?.limit)
  const providerOffset = nonNegativeSafeInteger(page?.offset)
  const providerTotal = nonNegativeSafeInteger(page?.total)
  const expectedRowCount = request && providerTotal !== undefined
    ? Math.min(request.limit, Math.max(0, providerTotal - request.offset))
    : undefined
  const paginationContract = Boolean(
    request
    && envelopeContract
    && providerLimit === request.limit
    && providerOffset === request.offset
    && providerTotal !== undefined
    && expectedRowCount === providerRows.length,
  )

  const annotations = envelope && isRecord(envelope.annotations) ? envelope.annotations : undefined
  const sourceName = trimmedText(annotations?.source_name)
  const datasetName = trimmedText(annotations?.dataset_name)
  const rows: PopulationRow[] = []
  const seenStateIds = new Set<string>()
  const seenStateNames = new Set<string>()
  let invalidIdentityCount = 0
  let malformedPopulationCount = 0

  if (request) {
    for (const candidate of providerRows) {
      if (!isRecord(candidate)) {
        invalidIdentityCount += 1
        continue
      }
      const stateId = trimmedText(candidate['State ID'])
      const state = trimmedText(candidate.State)
      const year = nonNegativeSafeInteger(candidate.Year)
      const duplicateIdentity = Boolean(stateId && state && (seenStateIds.has(stateId) || seenStateNames.has(state)))
      const identityValid = Boolean(
        stateId && /^04000US[0-9]{2}$/.test(stateId)
        && state
        && year === request.year
        && !duplicateIdentity,
      )
      if (!identityValid) {
        invalidIdentityCount += 1
        continue
      }

      seenStateIds.add(stateId!)
      seenStateNames.add(state!)
      const population = nonNegativeSafeInteger(candidate.Population)
      if (population === undefined) {
        malformedPopulationCount += 1
        continue
      }
      rows.push({ stateId: stateId!, state: state!, year: year!, population })
    }
  }

  const invalidRecordCount = invalidIdentityCount + malformedPopulationCount
  const rowIdentityContract = Boolean(request && invalidIdentityCount === 0)

  let state: PopulationState = 'invalid'
  let reason: string | undefined
  if (!request) {
    reason = 'The executed request is not the exact supported Data USA Tesseract state-population GET request.'
  } else if (!envelopeContract) {
    reason = 'The HTTP-success payload does not use the documented Data USA annotations/page/columns/data envelope.'
  } else if (!columnsContract) {
    reason = 'Data USA returned columns that do not match State ID, State, Year, and Population.'
  } else if (!paginationContract) {
    reason = 'Data USA pagination does not match the requested first page and returned row count.'
  } else if (providerRows.length === 0 && providerTotal === 0) {
    state = 'empty'
    reason = 'No state population records returned for the requested year.'
  } else if (rows.length === 0) {
    reason = 'No trustworthy state population rows could be validated.'
  } else if (invalidRecordCount > 0) {
    state = 'partial'
    reason = 'Only request-matching state rows with native non-negative integer population values are shown; malformed or mismatched rows are withheld.'
  } else {
    state = 'ready'
  }

  return {
    state,
    reason,
    request,
    envelopeContract,
    columnsContract,
    paginationContract,
    rowIdentityContract,
    providerRecordCount: providerRows.length,
    validRecordCount: rows.length,
    invalidRecordCount,
    malformedPopulationCount,
    providerLimit,
    providerOffset,
    providerTotal,
    sourceName,
    datasetName,
    rows,
  }
}

export function DataUsaPopulationPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const model = dataUsaPopulationModel(data, executedRequest)
  const populations = model.rows.map((row) => row.population)
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(Boolean(model.request)),
    'data-request-method': model.request ? 'GET' : undefined,
    'data-request-year': model.request?.year,
    'data-request-limit': model.request?.limit,
    'data-request-offset': model.request?.offset,
    'data-provider-limit': model.providerLimit,
    'data-provider-offset': model.providerOffset,
    'data-provider-total': model.providerTotal,
    'data-provider-record-count': model.providerRecordCount,
    'data-valid-record-count': model.validRecordCount,
    'data-invalid-record-count': model.invalidRecordCount,
    'data-malformed-population-count': model.malformedPopulationCount,
    'data-envelope-contract': String(model.envelopeContract),
    'data-columns-contract': String(model.columnsContract),
    'data-pagination-contract': String(model.paginationContract),
    'data-row-identity-contract': String(model.rowIdentityContract),
  }

  if (model.state === 'invalid') return <div className="market-preview data-usa-population-preview" data-domain-card="data-usa-state-population" {...evidence}>
    <div className="market-summary"><div><span>Data USA population evidence unavailable</span><strong>—</strong><small>{model.reason}</small></div></div>
  </div>

  if (model.state === 'empty') return <div className="market-preview data-usa-population-preview" data-domain-card="data-usa-state-population" {...evidence}>
    <div className="market-summary"><div><span>Data USA · {model.request?.year} state population</span><strong>—</strong><small>No state population records returned for {model.request?.year}.</small></div></div>
  </div>

  return <div className="market-preview data-usa-population-preview" data-domain-card="data-usa-state-population" {...evidence}>
    <div className="market-summary" style={{ gridColumn: '1 / -1' }}>
      <div><span>Data USA · {model.request?.year} state population</span><strong>{model.validRecordCount} validated states</strong><small>{model.datasetName ?? 'ACS 5-year Estimate'} · {model.sourceName ?? 'Census Bureau'}</small></div>
      <div className="market-range"><span>First page · offset {model.request?.offset}</span><span>{model.validRecordCount} of {model.providerTotal ?? '—'} records</span></div>
    </div>
    <div className="market-metrics">
      <article><small>Validated rows</small><strong>{model.validRecordCount} / {model.providerRecordCount}</strong></article>
      <article><small>Population range</small><strong>{populations.length ? `${formatNumber(Math.min(...populations), 0)} – ${formatNumber(Math.max(...populations), 0)}` : '—'}</strong></article>
      <article><small>Withheld rows</small><strong>{model.invalidRecordCount}</strong></article>
    </div>
    {model.state === 'partial' && <div className="market-metrics"><article><small>Validation</small><strong>Partial response</strong><span>{model.reason}</span></article></div>}
    <div className="market-metrics data-usa-population-rows" aria-label={`Validated ${model.request?.year} state population evidence`}>
      {model.rows.map((row) => <article key={row.stateId} data-state-id={row.stateId} data-year={row.year} data-population={row.population}><small>{row.state}</small><strong>{formatNumber(row.population, 0)}</strong></article>)}
    </div>
  </div>
}
