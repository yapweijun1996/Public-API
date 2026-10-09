import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { Sparkline } from './ChartPrimitives'
import { formatNumber } from './previewData'
import { finiteNumber, isRecord, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

const MAX_YEAR_ROWS = 141
const FIXED_MRV_ROWS = 8

const fixedIndicatorContracts: Record<string, { country: 'SGP'; indicator: string }> = {
  'world-bank-gdp': { country: 'SGP', indicator: 'NY.GDP.MKTP.CD' },
  'world-bank-population': { country: 'SGP', indicator: 'SP.POP.TOTL' },
}

type IndicatorRequest = {
  mode: 'range' | 'mrv'
  country: string
  indicator: string
  yearCount: number
  perPage: number
  startYear?: number
  endYear?: number
  mrv?: number
}

type IndicatorObservation = {
  year: number
  value?: number
}

type IndicatorState = 'ready' | 'partial' | 'empty' | 'invalid'

type IndicatorViewModel = {
  state: IndicatorState
  reason?: string
  request?: IndicatorRequest
  envelopeContract: boolean
  paginationContract: boolean
  countryIdentityContract: boolean
  indicatorIdentityContract: boolean
  yearRangeContract: boolean
  yearOrderContract: boolean
  yearSeriesContract: boolean
  rowIdentityContract: boolean
  providerRecordCount: number
  validRecordCount: number
  invalidRecordCount: number
  validObservationCount: number
  missingObservationCount: number
  malformedObservationCount: number
  providerCountryAlpha2?: string
  providerCountryAlpha3?: string
  countryName?: string
  indicatorName?: string
  providerPage?: number
  providerPages?: number
  providerPerPage?: number
  providerTotal?: number
  observations: IndicatorObservation[]
}

const exactSearchKeys = (url: URL, allowedKeys: string[]) => {
  const entries = [...url.searchParams.entries()]
  return entries.length === allowedKeys.length
    && entries.every(([key]) => allowedKeys.includes(key))
    && allowedKeys.every((key) => entries.filter(([entryKey]) => entryKey === key).length === 1)
}

const parseYear = (value: string | null) => {
  if (!value || !/^[0-9]{4}$/.test(value)) return undefined
  const year = Number(value)
  return Number.isSafeInteger(year) && year >= 1960 && year <= 2100 ? year : undefined
}

const parseRequest = (api: ApiDemo, executedRequest?: ExecutedRequestContext): IndicatorRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const path = url.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment))
    const country = path[2]
    const indicator = path[4]
    const commonValid = url.protocol === 'https:'
      && url.hostname === 'api.worldbank.org'
      && url.port === ''
      && !url.username
      && !url.password
      && !url.hash
      && path.length === 5
      && path[0] === 'v2'
      && path[1] === 'country'
      && path[3] === 'indicator'
      && Boolean(country && indicator)
      && url.pathname === `/v2/country/${country}/indicator/${indicator}`
      && url.searchParams.get('format') === 'json'
    if (!commonValid || !country || !indicator) return undefined

    const fixed = fixedIndicatorContracts[api.id]
    if (fixed) {
      const valid = country === fixed.country
        && indicator === fixed.indicator
        && exactSearchKeys(url, ['format', 'mrv', 'per_page'])
        && url.searchParams.get('mrv') === String(FIXED_MRV_ROWS)
        && url.searchParams.get('per_page') === String(FIXED_MRV_ROWS)
      return valid
        ? { mode: 'mrv', country, indicator, mrv: FIXED_MRV_ROWS, yearCount: FIXED_MRV_ROWS, perPage: FIXED_MRV_ROWS }
        : undefined
    }

    if (api.id !== 'world-bank-indicator-explorer') return undefined
    const countryField = api.fields.find((field) => field.id === 'country')
    const indicatorField = api.fields.find((field) => field.id === 'indicator')
    const allowedIndicators = new Set(indicatorField?.options?.map((option) => option.value) ?? [])
    const countryPattern = countryField?.pattern ? new RegExp(`^(?:${countryField.pattern})$`) : undefined
    const date = url.searchParams.get('date')?.split(':')
    const startYear = date?.length === 2 ? parseYear(date[0]) : undefined
    const endYear = date?.length === 2 ? parseYear(date[1]) : undefined
    const yearCount = startYear !== undefined && endYear !== undefined && endYear >= startYear ? endYear - startYear + 1 : undefined
    const valid = Boolean(countryPattern?.test(country) && country === country.toUpperCase())
      && allowedIndicators.has(indicator)
      && exactSearchKeys(url, ['format', 'date', 'per_page'])
      && url.searchParams.get('per_page') === String(MAX_YEAR_ROWS)
      && startYear !== undefined
      && endYear !== undefined
      && yearCount !== undefined
      && yearCount >= 1
      && yearCount <= MAX_YEAR_ROWS
    return valid && startYear !== undefined && endYear !== undefined && yearCount !== undefined
      ? { mode: 'range', country, indicator, startYear, endYear, yearCount, perPage: MAX_YEAR_ROWS }
      : undefined
  } catch {
    return undefined
  }
}

const documentedPerPage = (value: unknown) => {
  if (typeof value === 'number') return positiveSafeInteger(value)
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

export const worldBankIndicatorModel = (api: ApiDemo, data: unknown, executedRequest?: ExecutedRequestContext): IndicatorViewModel => {
  const request = parseRequest(api, executedRequest)
  const envelopeContract = Array.isArray(data) && data.length === 2 && isRecord(data[0]) && Array.isArray(data[1])
  const metadata = envelopeContract ? data[0] as Record<string, unknown> : undefined
  const providerRows = envelopeContract ? data[1] as unknown[] : []
  const providerPage = positiveSafeInteger(metadata?.page)
  const providerPages = positiveSafeInteger(metadata?.pages)
  const providerPerPage = documentedPerPage(metadata?.per_page)
  const providerTotal = nonNegativeSafeInteger(metadata?.total)
  const paginationContract = Boolean(request
    && envelopeContract
    && providerPage === 1
    && providerPages === 1
    && providerPerPage === request.perPage
    && providerTotal === providerRows.length
    && providerTotal === request.yearCount)

  let countryIdentityContract = Boolean(request && envelopeContract && providerRows.length > 0)
  let indicatorIdentityContract = Boolean(request && envelopeContract && providerRows.length > 0)
  let invalidRecordCount = 0
  let missingObservationCount = 0
  let malformedObservationCount = 0
  let providerCountryAlpha2: string | undefined
  let providerCountryAlpha3: string | undefined
  let countryName: string | undefined
  let indicatorName: string | undefined
  const observations: IndicatorObservation[] = []
  const providerYearOrder: number[] = []
  const seenYears = new Set<number>()

  if (request) {
    for (const candidate of providerRows) {
      if (!isRecord(candidate)) {
        invalidRecordCount += 1
        countryIdentityContract = false
        indicatorIdentityContract = false
        continue
      }
      const providerIndicator = isRecord(candidate.indicator) ? candidate.indicator : undefined
      const providerCountry = isRecord(candidate.country) ? candidate.country : undefined
      const rowIndicator = trimmedText(providerIndicator?.id)
      const rowIndicatorName = trimmedText(providerIndicator?.value)
      const rowCountryAlpha2 = trimmedText(providerCountry?.id)
      const rowCountryAlpha3 = trimmedText(candidate.countryiso3code)
      const rowCountryName = trimmedText(providerCountry?.value)
      const rowYearText = trimmedText(candidate.date)
      const rowYear = rowYearText && /^[0-9]{4}$/.test(rowYearText) ? Number(rowYearText) : undefined
      const countryValid = Boolean(
        rowCountryAlpha2 && /^[A-Z]{2}$/.test(rowCountryAlpha2)
        && rowCountryAlpha3 && /^[A-Z]{3}$/.test(rowCountryAlpha3)
        && rowCountryName
        && request.country === (request.country.length === 2 ? rowCountryAlpha2 : rowCountryAlpha3)
        && (!providerCountryAlpha2 || providerCountryAlpha2 === rowCountryAlpha2)
        && (!providerCountryAlpha3 || providerCountryAlpha3 === rowCountryAlpha3)
        && (!countryName || countryName === rowCountryName),
      )
      const indicatorValid = Boolean(
        rowIndicator === request.indicator
        && rowIndicatorName
        && (!indicatorName || indicatorName === rowIndicatorName),
      )
      const yearValid = rowYear !== undefined
        && Number.isSafeInteger(rowYear)
        && rowYear >= 1960
        && rowYear <= 2100
        && !seenYears.has(rowYear)
        && (request.mode === 'mrv' || (request.startYear !== undefined && request.endYear !== undefined && rowYear >= request.startYear && rowYear <= request.endYear))

      if (!countryValid || !indicatorValid || !yearValid) {
        invalidRecordCount += 1
        if (!countryValid) countryIdentityContract = false
        if (!indicatorValid) indicatorIdentityContract = false
        continue
      }

      providerCountryAlpha2 = rowCountryAlpha2
      providerCountryAlpha3 = rowCountryAlpha3
      countryName = rowCountryName
      indicatorName = rowIndicatorName
      seenYears.add(rowYear)
      providerYearOrder.push(rowYear)

      if (candidate.value === undefined || candidate.value === null) {
        missingObservationCount += 1
        observations.push({ year: rowYear })
        continue
      }
      const value = finiteNumber(candidate.value)
      if (value === undefined) {
        malformedObservationCount += 1
        observations.push({ year: rowYear })
        continue
      }
      observations.push({ year: rowYear, value })
    }
  }

  const rangeStartYear = request?.mode === 'range' ? request.startYear : undefined
  const yearRangeContract = Boolean(request?.mode === 'range'
    && rangeStartYear !== undefined
    && invalidRecordCount === 0
    && observations.length === request.yearCount
    && [...observations].sort((left, right) => left.year - right.year)
      .every((observation, index) => observation.year === rangeStartYear + index))
  const yearOrderContract = Boolean(request?.mode === 'mrv'
    && invalidRecordCount === 0
    && providerYearOrder.length === request.yearCount
    && providerYearOrder.every((year, index) => index === 0 || providerYearOrder[index - 1] > year))
  const yearSeriesContract = request?.mode === 'range' ? yearRangeContract : request?.mode === 'mrv' ? yearOrderContract : false

  observations.sort((left, right) => left.year - right.year)
  const validRecordCount = observations.length
  const validObservationCount = observations.filter((observation) => observation.value !== undefined).length
  const rowIdentityContract = countryIdentityContract && indicatorIdentityContract && yearSeriesContract

  let state: IndicatorState = 'invalid'
  let reason: string | undefined
  if (!request) {
    reason = 'The executed request is not the exact supported World Bank V2 indicator GET request.'
  } else if (!envelopeContract) {
    reason = 'The HTTP-success payload does not use the documented two-part World Bank V2 JSON envelope.'
  } else if (!paginationContract) {
    reason = request.mode === 'mrv'
      ? 'World Bank pagination does not describe one complete eight-row MRV response.'
      : 'World Bank pagination does not describe one complete page for the inclusive requested year range.'
  } else if (validRecordCount === 0) {
    reason = 'No provider-owned country, indicator, and year records could be validated.'
  } else if (validObservationCount === 0 && malformedObservationCount === 0 && rowIdentityContract && missingObservationCount === request.yearCount) {
    state = 'empty'
  } else if (validObservationCount === 0) {
    reason = 'No native JSON-number observations could be validated.'
  } else if (rowIdentityContract && missingObservationCount === 0 && malformedObservationCount === 0) {
    state = 'ready'
  } else {
    state = 'partial'
    reason = 'Only request-matching records with native JSON-number observations are shown; unavailable or malformed values and invalid identities or year ordering are withheld.'
  }

  return {
    state,
    reason,
    request,
    envelopeContract,
    paginationContract,
    countryIdentityContract,
    indicatorIdentityContract,
    yearRangeContract,
    yearOrderContract,
    yearSeriesContract,
    rowIdentityContract,
    providerRecordCount: providerRows.length,
    validRecordCount,
    invalidRecordCount,
    validObservationCount,
    missingObservationCount,
    malformedObservationCount,
    providerCountryAlpha2,
    providerCountryAlpha3,
    countryName,
    indicatorName,
    providerPage,
    providerPages,
    providerPerPage,
    providerTotal,
    observations,
  }
}

export function WorldBankIndicatorPreview({ api, data, executedRequest }: { api: ApiDemo; data: unknown; executedRequest?: ExecutedRequestContext }) {
  const model = worldBankIndicatorModel(api, data, executedRequest)
  const request = model.request
  const values = model.observations.flatMap((observation) => observation.value === undefined ? [] : [observation.value])
  const valuedObservations = model.observations.filter((observation): observation is Required<IndicatorObservation> => observation.value !== undefined)
  const latest = valuedObservations.at(-1)
  const earliestProviderYear = model.observations[0]?.year
  const latestProviderYear = model.observations.at(-1)?.year
  const periodDescription = request?.mode === 'range'
    ? `${request.startYear}–${request.endYear}`
    : request?.mode === 'mrv'
      ? `the most recent ${request.mrv} provider rows`
      : 'this request'
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(Boolean(request)),
    'data-request-method': request ? 'GET' : undefined,
    'data-request-mode': request?.mode,
    'data-request-country-code': request?.country,
    'data-request-indicator': request?.indicator,
    'data-request-start-year': request?.startYear,
    'data-request-end-year': request?.endYear,
    'data-request-mrv': request?.mrv,
    'data-request-year-count': request?.yearCount,
    'data-provider-country-alpha2': model.providerCountryAlpha2,
    'data-provider-country-alpha3': model.providerCountryAlpha3,
    'data-provider-page': model.providerPage,
    'data-provider-pages': model.providerPages,
    'data-provider-per-page': model.providerPerPage,
    'data-provider-total': model.providerTotal,
    'data-provider-record-count': model.providerRecordCount,
    'data-valid-record-count': model.validRecordCount,
    'data-invalid-record-count': model.invalidRecordCount,
    'data-valid-observation-count': model.validObservationCount,
    'data-missing-observation-count': model.missingObservationCount,
    'data-malformed-observation-count': model.malformedObservationCount,
    'data-envelope-contract': String(model.envelopeContract),
    'data-pagination-contract': String(model.paginationContract),
    'data-country-identity-contract': String(model.countryIdentityContract),
    'data-indicator-identity-contract': String(model.indicatorIdentityContract),
    'data-year-range-contract': String(model.yearRangeContract),
    'data-year-order-contract': String(model.yearOrderContract),
    'data-year-series-contract': String(model.yearSeriesContract),
    'data-row-identity-contract': String(model.rowIdentityContract),
  }

  if (model.state === 'invalid') return <div className="market-preview" data-domain-card="world-bank-indicator-series" {...evidence}>
    <div className="market-summary"><div><span>World Bank indicator unavailable</span><strong>—</strong><small>{model.reason}</small></div></div>
  </div>

  if (model.state === 'empty') return <div className="market-preview" data-domain-card="world-bank-indicator-series" {...evidence}>
    <div className="market-summary"><div><span>{model.indicatorName} · {model.countryName}</span><strong>—</strong><small>No observations available in {periodDescription}.</small></div></div>
  </div>

  return <div className="market-preview" data-domain-card="world-bank-indicator-series" data-primary-year={latest?.year} data-primary-value={latest?.value} {...evidence}>
    <div className="market-summary"><div><span>{model.indicatorName} · {model.countryName}</span><strong>{latest ? formatNumber(latest.value, 2) : '—'}</strong><small>{latest ? `${latest.year} · Latest observation` : model.reason}</small></div><div className="market-range"><span>{request?.mode === 'range' ? request.startYear : earliestProviderYear}</span><span>{request?.mode === 'range' ? request.endYear : latestProviderYear}</span></div></div>
    <Sparkline values={values} label={`${model.indicatorName} yearly observations for ${periodDescription}`}/>
    <div className="market-metrics">
      <article><small>Observed years</small><strong>{model.validObservationCount} / {request?.yearCount}</strong></article>
      <article><small>Value range</small><strong>{values.length ? `${formatNumber(Math.min(...values), 2)} – ${formatNumber(Math.max(...values), 2)}` : '—'}</strong></article>
      <article><small>Unavailable / malformed</small><strong>{model.missingObservationCount} / {model.malformedObservationCount}</strong></article>
    </div>
    {model.state === 'partial' && <div className="market-metrics"><article><small>Validation</small><strong>Partial response</strong><span>{model.reason}</span></article></div>}
    <ol className="sr-only" aria-label="World Bank yearly observation evidence">
      {model.observations.map((observation) => <li key={observation.year}>{observation.year}: {observation.value ?? 'Unavailable or malformed'}</li>)}
    </ol>
  </div>
}
