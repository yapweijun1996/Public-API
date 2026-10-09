import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { Sparkline } from './ChartPrimitives'
import { finiteNumber, isRecord } from './semanticValidation'

type FrankfurterRequest = {
  from: string
  to: string
  fromDay: number
  toDay: number
  group: 'month' | 'week'
}

type FrankfurterRate = {
  date: string
  epochDay: number
  rate: number
}

type FrankfurterState = 'ready' | 'partial' | 'empty' | 'invalid'

type FrankfurterViewModel = {
  state: FrankfurterState
  reason?: string
  request?: FrankfurterRequest
  envelopeContract: boolean
  rowShapeContract: boolean
  pairIdentityContract: boolean
  dateContract: boolean
  uniqueDateContract: boolean
  nativeRateContract: boolean
  providerRecordCount: number
  validRecordCount: number
  invalidRecordCount: number
  invalidShapeCount: number
  wrongIdentityCount: number
  invalidDateCount: number
  duplicateDateCount: number
  outOfRangeCount: number
  malformedRateCount: number
  rates: FrankfurterRate[]
}

const EARLIEST_FRANKFURTER_DATE = '1999-01-04'

const parseIsoDay = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return undefined
  return Math.floor(date.getTime() / 86_400_000)
}

const earliestFrankfurterDay = parseIsoDay(EARLIEST_FRANKFURTER_DATE)!

const hasExactSearchKeys = (url: URL, expectedKeys: string[]) => {
  const entries = [...url.searchParams.entries()]
  return entries.length === expectedKeys.length
    && entries.every(([key]) => expectedKeys.includes(key))
    && expectedKeys.every((key) => entries.filter(([candidate]) => candidate === key).length === 1)
}

const parseExecutedRequest = (executedRequest?: ExecutedRequestContext): FrankfurterRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const fromDay = parseIsoDay(from)
    const toDay = parseIsoDay(to)
    const group = url.searchParams.get('group')
    const valid = url.protocol === 'https:'
      && url.hostname === 'api.frankfurter.dev'
      && url.port === ''
      && !url.username
      && !url.password
      && !url.hash
      && url.pathname === '/v2/rates'
      && hasExactSearchKeys(url, ['from', 'to', 'base', 'quotes', 'providers', 'group'])
      && url.searchParams.get('base') === 'SGD'
      && url.searchParams.get('quotes') === 'MYR'
      && url.searchParams.get('providers') === 'ECB'
      && (group === 'month' || group === 'week')
      && fromDay !== undefined
      && toDay !== undefined
      && fromDay >= earliestFrankfurterDay
      && toDay >= fromDay

    return valid && from && to && fromDay !== undefined && toDay !== undefined && (group === 'month' || group === 'week')
      ? { from, to, fromDay, toDay, group }
      : undefined
  } catch {
    return undefined
  }
}

const hasExactRowShape = (row: Record<string, unknown>) => {
  const keys = Object.keys(row)
  return keys.length === 4 && ['date', 'base', 'quote', 'rate'].every((key) => keys.includes(key))
}

export const frankfurterSgdMyrHistoryModel = (
  data: unknown,
  executedRequest?: ExecutedRequestContext,
): FrankfurterViewModel => {
  const request = parseExecutedRequest(executedRequest)
  const envelopeContract = Array.isArray(data)
  const providerRows = envelopeContract ? data : []
  const rates: FrankfurterRate[] = []
  const seenDays = new Set<number>()
  let invalidRecordCount = 0
  let invalidShapeCount = 0
  let wrongIdentityCount = 0
  let invalidDateCount = 0
  let duplicateDateCount = 0
  let outOfRangeCount = 0
  let malformedRateCount = 0

  if (request && envelopeContract) {
    for (const candidate of providerRows) {
      if (!isRecord(candidate) || !hasExactRowShape(candidate)) {
        invalidRecordCount += 1
        invalidShapeCount += 1
        continue
      }
      if (candidate.base !== 'SGD' || candidate.quote !== 'MYR') {
        invalidRecordCount += 1
        wrongIdentityCount += 1
        continue
      }
      const date = typeof candidate.date === 'string' ? candidate.date : undefined
      const epochDay = parseIsoDay(date ?? null)
      if (!date || epochDay === undefined) {
        invalidRecordCount += 1
        invalidDateCount += 1
        continue
      }
      if (epochDay < request.fromDay || epochDay > request.toDay) {
        invalidRecordCount += 1
        outOfRangeCount += 1
        continue
      }
      if (seenDays.has(epochDay)) {
        invalidRecordCount += 1
        duplicateDateCount += 1
        continue
      }
      seenDays.add(epochDay)
      const rate = finiteNumber(candidate.rate)
      if (rate === undefined || rate <= 0) {
        invalidRecordCount += 1
        malformedRateCount += 1
        continue
      }
      rates.push({ date, epochDay, rate })
    }
  } else if (envelopeContract) {
    invalidRecordCount = providerRows.length
  }

  rates.sort((left, right) => left.epochDay - right.epochDay)
  const rowShapeContract = Boolean(request && envelopeContract && invalidShapeCount === 0)
  const pairIdentityContract = Boolean(request && envelopeContract && wrongIdentityCount === 0)
  const dateContract = Boolean(request && envelopeContract && invalidDateCount === 0 && outOfRangeCount === 0)
  const uniqueDateContract = Boolean(request && envelopeContract && duplicateDateCount === 0)
  const nativeRateContract = Boolean(request && envelopeContract && malformedRateCount === 0)

  let state: FrankfurterState = 'invalid'
  let reason: string | undefined
  if (!request) {
    reason = 'The executed request is not the exact supported Frankfurter SGD/MYR history GET request.'
  } else if (!envelopeContract) {
    reason = 'The HTTP-success payload is not the documented flat Frankfurter rates array.'
  } else if (providerRows.length === 0) {
    state = 'empty'
  } else if (rates.length === 0) {
    reason = 'No request-matching Frankfurter rows with trustworthy native positive rates could be validated.'
  } else if (invalidRecordCount === 0) {
    state = 'ready'
  } else {
    state = 'partial'
    reason = 'Only request-matching rows with unique in-range dates and native positive rates are shown; invalid or malformed rows are withheld.'
  }

  return {
    state,
    reason,
    request,
    envelopeContract,
    rowShapeContract,
    pairIdentityContract,
    dateContract,
    uniqueDateContract,
    nativeRateContract,
    providerRecordCount: providerRows.length,
    validRecordCount: rates.length,
    invalidRecordCount,
    invalidShapeCount,
    wrongIdentityCount,
    invalidDateCount,
    duplicateDateCount,
    outOfRangeCount,
    malformedRateCount,
    rates,
  }
}

const displayRate = (rate: number) => rate.toLocaleString('en', { maximumFractionDigits: 10 })

export function FrankfurterSgdMyrHistoryPreview({
  data,
  executedRequest,
}: {
  data: unknown
  executedRequest?: ExecutedRequestContext
}) {
  const model = frankfurterSgdMyrHistoryModel(data, executedRequest)
  const latest = model.rates.at(-1)
  const high = model.rates.reduce<FrankfurterRate | undefined>((current, rate) => !current || rate.rate > current.rate ? rate : current, undefined)
  const low = model.rates.reduce<FrankfurterRate | undefined>((current, rate) => !current || rate.rate < current.rate ? rate : current, undefined)
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(Boolean(model.request)),
    'data-request-method': model.request ? 'GET' : undefined,
    'data-request-start-date': model.request?.from,
    'data-request-end-date': model.request?.to,
    'data-request-group': model.request?.group,
    'data-request-base': model.request ? 'SGD' : undefined,
    'data-request-quote': model.request ? 'MYR' : undefined,
    'data-request-provider': model.request ? 'ECB' : undefined,
    'data-provider-record-count': model.providerRecordCount,
    'data-valid-record-count': model.validRecordCount,
    'data-invalid-record-count': model.invalidRecordCount,
    'data-invalid-shape-count': model.invalidShapeCount,
    'data-wrong-identity-count': model.wrongIdentityCount,
    'data-invalid-date-count': model.invalidDateCount,
    'data-duplicate-date-count': model.duplicateDateCount,
    'data-out-of-range-count': model.outOfRangeCount,
    'data-malformed-rate-count': model.malformedRateCount,
    'data-envelope-contract': String(model.envelopeContract),
    'data-row-shape-contract': String(model.rowShapeContract),
    'data-row-identity-contract': String(model.pairIdentityContract),
    'data-date-range-contract': String(model.dateContract),
    'data-unique-date-contract': String(model.uniqueDateContract),
    'data-native-positive-rate-contract': String(model.nativeRateContract),
  }

  if (model.state === 'invalid') return <div className="market-preview" data-domain-card="frankfurter-fx-history" {...evidence}>
    <div className="market-summary"><div><span>Frankfurter evidence unavailable</span><strong>—</strong><small>{model.reason}</small></div></div>
  </div>

  if (model.state === 'empty') return <div className="market-preview" data-domain-card="frankfurter-fx-history" {...evidence}>
    <div className="market-summary"><div><span>SGD/MYR · ECB</span><strong>—</strong><small>No rates returned for {model.request?.from} – {model.request?.to}.</small></div></div>
  </div>

  const values = model.rates.map(({ rate }) => rate)
  return <div
    className="market-preview"
    data-domain-card="frankfurter-fx-history"
    data-primary-date={latest?.date}
    data-primary-rate={latest?.rate}
    {...evidence}
  >
    <div className="market-summary"><div><span>SGD/MYR · ECB</span><strong>{latest ? `MYR ${displayRate(latest.rate)}` : '—'}</strong><small>{latest?.date} · Latest validated observation</small></div><div className="market-range"><span>{model.request?.from}</span><span>{model.request?.to}</span></div></div>
    <Sparkline values={values} label={`Validated Frankfurter SGD/MYR rate evidence from ${model.request?.from} to ${model.request?.to}`}/>
    <div className="market-metrics">
      <article><small>Period high</small><strong>{high ? displayRate(high.rate) : '—'}</strong></article>
      <article><small>Period low</small><strong>{low ? displayRate(low.rate) : '—'}</strong></article>
      <article><small>Validated rates</small><strong>{model.validRecordCount} / {model.providerRecordCount}</strong></article>
      <article><small>Requested grouping</small><strong>{model.request?.group}</strong></article>
    </div>
    {model.state === 'partial' && <div className="market-metrics"><article><small>Validation</small><strong>Partial response</strong><span>{model.reason}</span></article></div>}
    <ol className="sr-only" aria-label="Frankfurter validated SGD/MYR rate evidence">
      {model.rates.map(({ date, rate }) => <li key={date}>{date}: 1 SGD = {rate} MYR; provider ECB</li>)}
    </ol>
  </div>
}
