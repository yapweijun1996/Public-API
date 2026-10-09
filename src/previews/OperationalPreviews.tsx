import './operationalCards.css'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { cleanText, formatNumber, isRecord, numberValue, previewValue, recordArray, textArray } from './previewData'
import { nonNegativeSafeInteger, positiveSafeInteger } from './semanticValidation'

const gleifDate = (value: unknown) => {
  const text = cleanText(value)
  if (!text) return '—'
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 10)
}

const gleifAddress = (value: unknown) => {
  const address = isRecord(value) ? value : {}
  const lines = textArray(address.addressLines)
  const parts = [...lines, cleanText(address.city), cleanText(address.region), cleanText(address.postalCode), cleanText(address.country)]
    .filter((part): part is string => Boolean(part))
  return parts.join(', ') || '—'
}

const gleifRelationshipLabels: Record<string, string> = {
  'direct-parent': 'Direct parent relation',
  'ultimate-parent': 'Ultimate parent relation',
  'direct-children': 'Direct children relation',
  'ultimate-children': 'Ultimate children relation',
  branches: 'Branch relation',
}

type GleifRequestIdentity = { query: string; pageSize: number }

type GleifTrustedRecord = {
  record: Record<string, unknown>
  attributes: Record<string, unknown>
  entity: Record<string, unknown>
  registration: Record<string, unknown>
  lei: string
  legalName?: string
  incomplete: boolean
}

const gleifLei = (value: unknown) => {
  const text = cleanText(value)?.toUpperCase()
  return text && /^[A-Z0-9]{20}$/.test(text) ? text : undefined
}

const gleifRequestIdentity = (requestUrl?: string): GleifRequestIdentity | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (
      url.protocol !== 'https:'
      || url.hostname.toLowerCase() !== 'api.gleif.org'
      || url.port
      || url.username
      || url.password
      || url.hash
      || url.pathname !== '/api/v1/lei-records'
    ) return undefined

    const entries = [...url.searchParams.entries()]
    const allowedKeys = new Set(['filter[entity.legalName]', 'page[size]'])
    if (entries.length !== 2 || entries.some(([key]) => !allowedKeys.has(key))) return undefined

    const queryValues = url.searchParams.getAll('filter[entity.legalName]')
    const sizeValues = url.searchParams.getAll('page[size]')
    if (queryValues.length !== 1 || sizeValues.length !== 1) return undefined

    const rawQuery = queryValues[0]
    const query = rawQuery.trim()
    const rawSize = sizeValues[0]
    if (!query || query !== rawQuery || !/^[1-9]\d?$/.test(rawSize)) return undefined
    const pageSize = Number(rawSize)
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) return undefined
    return { query, pageSize }
  } catch {
    return undefined
  }
}

const gleifState = (
  state: 'invalid' | 'empty',
  title: string,
  detail: string,
  request?: GleifRequestIdentity,
  providerRecords = 0,
  invalidRecords = 0,
) => <div
  className="legal-entity-preview"
  data-result-state={state}
  data-request-bound={request ? 'true' : 'false'}
  data-requested-legal-name={request?.query ?? ''}
  data-requested-page-size={request?.pageSize ?? ''}
  data-provider-record-count={providerRecords}
  data-valid-record-count="0"
  data-invalid-record-count={invalidRecords}
  data-incomplete-record-count="0"
  data-primary-lei=""
  data-primary-legal-name=""
  data-primary-entity-status=""
  data-primary-registration-status=""
><div className="weather-empty"><strong>{title}</strong><span>{detail}</span></div></div>

export function GleifLeiPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const transportValid = !executedRequest || (executedRequest.method === 'GET' && executedRequest.body === undefined && (!requestUrl || executedRequest.url === requestUrl))
  const effectiveRequestUrl = executedRequest?.url ?? requestUrl
  const request = transportValid ? gleifRequestIdentity(effectiveRequestUrl) : undefined
  if ((effectiveRequestUrl || executedRequest) && !request) {
    return gleifState('invalid', 'Invalid GLEIF request identity', 'The executed URL could not be bound to one supported GLEIF legal-name search.')
  }
  if (!isRecord(data)) {
    return gleifState('invalid', 'Invalid GLEIF response', 'GLEIF returned HTTP-success data without the documented JSON object response.', request)
  }
  const root = data
  if (!Array.isArray(root.data)) {
    return gleifState('invalid', 'Invalid GLEIF record envelope', 'The HTTP-success response did not include the documented data array.', request)
  }

  const providerRecords = root.data.length
  const meta = isRecord(root.meta) ? root.meta : undefined
  const pagination = meta && isRecord(meta.pagination) ? meta.pagination : undefined
  const providerCurrentPage = pagination ? positiveSafeInteger(pagination.currentPage) : undefined
  const providerPageSize = pagination ? positiveSafeInteger(pagination.perPage) : undefined
  const providerFrom = pagination?.from === null ? null : pagination ? positiveSafeInteger(pagination.from) : undefined
  const providerTo = pagination?.to === null ? null : pagination ? positiveSafeInteger(pagination.to) : undefined
  const providerTotal = pagination ? nonNegativeSafeInteger(pagination.total) : undefined
  const providerLastPage = pagination ? positiveSafeInteger(pagination.lastPage) : undefined
  const paginationValid = Boolean(
    pagination
    && providerCurrentPage === 1
    && providerPageSize !== undefined
    && providerTotal !== undefined
    && providerLastPage !== undefined
    && (!request || providerPageSize === request.pageSize)
    && (providerTotal === 0
      ? providerRecords === 0 && providerFrom === null && providerTo === null && providerLastPage === 1
      : providerRecords === Math.min(providerPageSize, providerTotal)
        && providerFrom === 1
        && providerTo === providerRecords
        && providerLastPage === Math.ceil(providerTotal / providerPageSize)),
  )

  if (providerRecords === 0) {
    if (!paginationValid) {
      return gleifState('invalid', 'Invalid empty GLEIF response', 'The empty HTTP-success response did not include coherent pagination metadata, so it cannot be trusted as a real no-match result.', request)
    }
    return gleifState('empty', 'No LEI records found', 'GLEIF returned a valid zero-record search result for this legal-name query.', request)
  }

  const trusted: GleifTrustedRecord[] = []
  let invalidRecords = 0
  for (const value of root.data) {
    if (!isRecord(value) || cleanText(value.type) !== 'lei-records') {
      invalidRecords += 1
      continue
    }
    const record = value
    const attributes = isRecord(record.attributes) ? record.attributes : undefined
    const id = gleifLei(record.id)
    const attributeLei = attributes ? gleifLei(attributes.lei) : undefined
    if (!attributes || !id || !attributeLei || id !== attributeLei) {
      invalidRecords += 1
      continue
    }
    const entity = isRecord(attributes.entity) ? attributes.entity : {}
    const registration = isRecord(attributes.registration) ? attributes.registration : {}
    const legalName = isRecord(entity.legalName) ? cleanText(entity.legalName.name) : undefined
    const entityStatus = cleanText(entity.status)
    const registrationStatus = cleanText(registration.status)
    trusted.push({
      record,
      attributes,
      entity,
      registration,
      lei: id,
      legalName,
      incomplete: !legalName || !entityStatus || !registrationStatus,
    })
  }

  if (!trusted.length) {
    return gleifState('invalid', 'Invalid GLEIF record identity', 'The HTTP-success response contained records, but none established a coherent provider-owned LEI identity.', request, providerRecords, invalidRecords)
  }

  const incompleteRecords = trusted.filter((entry) => entry.incomplete).length
  const resultState = invalidRecords > 0 || incompleteRecords > 0 || !request || !paginationValid ? 'partial' : 'ready'
  const visible = trusted.slice(0, 8)
  const cards: SemanticCard[] = visible.map(({ record, attributes, entity, registration, lei, legalName }) => {
    const relationships = isRecord(record.relationships) ? record.relationships : {}
    const relationTags = Object.entries(gleifRelationshipLabels).flatMap(([key, label]) => {
      const relationship = isRecord(relationships[key]) ? relationships[key] : {}
      const links = isRecord(relationship.links) ? relationship.links : {}
      return cleanText(links.related) ? [label] : []
    })
    const bics = textArray(attributes.bic)
    return {
      title: legalName ?? lei,
      eyebrow: 'GLEIF · Global LEI Index',
      badge: cleanText(entity.status) ?? cleanText(registration.status),
      description: 'Level 1 identity and registration facts from the returned LEI record. Relationship tags indicate provider links available from this record; no extra relationship request is made.',
      metrics: [
        { label: 'LEI', value: lei },
        { label: 'Headquarters', value: gleifAddress(entity.headquartersAddress) },
        { label: 'Jurisdiction', value: previewValue(entity.jurisdiction) },
        { label: 'Registration status', value: previewValue(registration.status) },
        { label: 'Initial registration', value: gleifDate(registration.initialRegistrationDate) },
        { label: 'Next renewal', value: gleifDate(registration.nextRenewalDate) },
        { label: 'BIC mappings', value: bics.length ? bics.join(', ') : '—' },
      ],
      tags: relationTags,
    }
  })

  const first = visible[0]
  return <div
    className="legal-entity-preview"
    data-result-state={resultState}
    data-request-bound={request ? 'true' : 'false'}
    data-requested-legal-name={request?.query ?? ''}
    data-requested-page-size={request?.pageSize ?? ''}
    data-provider-current-page={providerCurrentPage ?? ''}
    data-provider-page-size={providerPageSize ?? ''}
    data-provider-from={providerFrom ?? ''}
    data-provider-to={providerTo ?? ''}
    data-provider-match-count={providerTotal ?? ''}
    data-provider-last-page={providerLastPage ?? ''}
    data-pagination-contract-valid={paginationValid ? 'true' : 'false'}
    data-provider-record-count={providerRecords}
    data-valid-record-count={trusted.length}
    data-invalid-record-count={invalidRecords}
    data-incomplete-record-count={incompleteRecords}
    data-result-count={visible.length}
    data-primary-lei={first.lei}
    data-primary-legal-name={first.legalName ?? ''}
    data-primary-entity-status={cleanText(first.entity.status) ?? ''}
    data-primary-registration-status={cleanText(first.registration.status) ?? ''}
  >
    {resultState === 'partial' && <p className="domain-note">Some GLEIF response context is unavailable or inconsistent. Only records with coherent provider LEI identity are shown.</p>}
    <SemanticCards cards={cards} emptyTitle="LEI records unavailable"/>
  </div>
}

const fdicDate = (value: unknown) => cleanText(value) ?? '—'

const fdicMainOffice = (record: Record<string, unknown>) => {
  const cityStateZip = [cleanText(record.CITY), cleanText(record.STALP), cleanText(record.ZIP)].filter((part): part is string => Boolean(part)).join(' ')
  return [cleanText(record.ADDRESS), cityStateZip].filter(Boolean).join(', ') || '—'
}

const fdicFinancialValue = (value: unknown) => {
  const number = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
  return number === undefined ? '—' : formatNumber(number, 0)
}

type FdicRequestIdentity = { search: string; limit: number }

type FdicTrustedRecord = {
  record: Record<string, unknown>
  certificate: string
  name?: string
  active?: boolean
  assets?: number
  deposits?: number
  offices?: number
  incomplete: boolean
}

const fdicPositiveInteger = (value: unknown) => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : undefined
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return undefined
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? String(number) : undefined
}

const fdicNonNegativeInteger = (value: unknown) => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : undefined
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return undefined
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : undefined
}

const fdicNonNegativeNumber = (value: unknown) => {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

const fdicProviderNonNegativeInteger = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined

const fdicStatusLabel = (active: boolean | undefined) => active === undefined ? undefined : active ? 'Active' : 'Former / inactive'

const fdicRequestIdentity = (requestUrl?: string): FdicRequestIdentity | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (
      url.protocol !== 'https:'
      || url.hostname.toLowerCase() !== 'api.fdic.gov'
      || url.port
      || url.username
      || url.password
      || url.pathname !== '/banks/institutions'
      || url.hash
    ) return undefined
    const searches = url.searchParams.getAll('search')
    const limits = url.searchParams.getAll('limit')
    const formats = url.searchParams.getAll('format')
    const keys = [...url.searchParams.keys()]
    if (keys.length !== 3 || searches.length !== 1 || limits.length !== 1 || formats.length !== 1 || formats[0] !== 'json') return undefined
    const search = searches[0]
    const limit = fdicNonNegativeInteger(limits[0])
    if (!/^NAME: \S(?:.*\S)?$/.test(search) || limit === undefined || limit < 1 || limit > 20 || String(limit) !== limits[0]) return undefined
    return { search, limit }
  } catch {
    return undefined
  }
}

type FdicStateMeta = {
  request?: FdicRequestIdentity
  providerSearch?: string
  providerLimit?: number
  providerTotal?: number
  requestContractValid?: boolean
  providerRecords?: number
  invalidRecords?: number
}

const fdicState = (state: 'invalid' | 'empty', title: string, detail: string, meta: FdicStateMeta = {}) => <div
  className="bank-institution-preview"
  data-result-state={state}
  data-requested-search={meta.request?.search ?? ''}
  data-requested-limit={meta.request?.limit ?? ''}
  data-provider-search={meta.providerSearch ?? ''}
  data-provider-limit={meta.providerLimit ?? ''}
  data-acknowledgement-match={meta.requestContractValid ? 'true' : 'false'}
  data-request-contract-valid={meta.requestContractValid ? 'true' : 'false'}
  data-provider-total={meta.providerTotal ?? ''}
  data-provider-match-count={meta.providerTotal ?? ''}
  data-provider-record-count={meta.providerRecords ?? 0}
  data-valid-record-count="0"
  data-invalid-record-count={meta.invalidRecords ?? 0}
  data-incomplete-record-count="0"
  data-result-count="0"
  data-primary-bank-name=""
  data-primary-fdic-certificate=""
  data-primary-status=""
  data-primary-active=""
  data-primary-assets-thousands=""
  data-primary-deposits-thousands=""
  data-primary-office-count=""
><div className="weather-empty"><strong>{title}</strong><span>{detail}</span></div></div>

export function FdicBankPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const transportValid = !executedRequest || (executedRequest.method === 'GET' && executedRequest.body === undefined && (!requestUrl || executedRequest.url === requestUrl))
  const effectiveRequestUrl = executedRequest?.url ?? requestUrl
  const request = transportValid ? fdicRequestIdentity(effectiveRequestUrl) : undefined
  if ((effectiveRequestUrl || executedRequest) && !request) {
    return fdicState('invalid', 'Invalid FDIC request identity', 'The executed URL could not be bound to one supported FDIC institution-name search.')
  }
  if (!isRecord(data)) {
    return fdicState('invalid', 'Invalid FDIC response', 'FDIC returned HTTP-success data without the documented JSON object response.', { request })
  }
  if (!Array.isArray(data.data)) {
    return fdicState('invalid', 'Invalid FDIC record envelope', 'The HTTP-success response did not include the documented data array.', { request })
  }
  if (!isRecord(data.meta) || !isRecord(data.meta.parameters)) {
    return fdicState('invalid', 'Invalid FDIC response metadata', 'The HTTP-success response did not include the documented request-parameter acknowledgement.', { request, providerRecords: data.data.length })
  }

  const providerRecords = data.data.length
  const providerTotal = typeof data.meta.total === 'number' && Number.isSafeInteger(data.meta.total) && data.meta.total >= 0 ? data.meta.total : undefined
  const rawProviderSearch = data.meta.parameters.search
  const providerSearch = typeof rawProviderSearch === 'string' && rawProviderSearch.trim() ? rawProviderSearch : undefined
  const providerLimit = fdicNonNegativeInteger(data.meta.parameters.limit)
  const providerContractValid = Boolean(
    providerTotal !== undefined
    && providerSearch
    && providerLimit !== undefined && providerLimit >= 1 && providerLimit <= 20
    && providerRecords <= providerLimit
    && providerTotal >= providerRecords,
  )
  const requestContractValid = Boolean(
    providerContractValid
    && request
    && providerSearch === request.search
    && providerLimit === request.limit
    && providerRecords <= request.limit,
  )
  const stateMeta: FdicStateMeta = { request, providerSearch, providerLimit, providerTotal, requestContractValid, providerRecords }

  if (!providerContractValid || (request && !requestContractValid)) {
    return fdicState('invalid', 'Invalid FDIC search acknowledgement', 'The provider response did not coherently acknowledge the executed institution search, result limit, total, and returned row count.', stateMeta)
  }
  if (providerRecords === 0) {
    if (providerTotal !== 0 || !requestContractValid) {
      return fdicState('invalid', 'Invalid empty FDIC response', 'The empty HTTP-success response did not establish a matching request acknowledgement with zero provider matches, so it cannot be trusted as a real no-match result.', stateMeta)
    }
    return fdicState('empty', 'No FDIC institutions found', 'FDIC returned a valid zero-record result for this fuzzy institution-name search.', stateMeta)
  }

  const trusted: FdicTrustedRecord[] = []
  let invalidRecords = 0
  for (const value of data.data) {
    if (!isRecord(value) || !isRecord(value.data) || typeof value.score !== 'number' || !Number.isFinite(value.score)) {
      invalidRecords += 1
      continue
    }
    const record = value.data
    const certificate = fdicPositiveInteger(record.CERT)
    const hasId = Object.prototype.hasOwnProperty.call(record, 'ID')
    const id = hasId ? fdicPositiveInteger(record.ID) : undefined
    if (!certificate || (hasId && id !== certificate)) {
      invalidRecords += 1
      continue
    }
    const name = cleanText(record.NAME)
    const activeValue = record.ACTIVE
    const inactiveValue = record.INACTIVE
    const active = activeValue === 1 && inactiveValue === 0 ? true : inactiveValue === 1 && activeValue === 0 ? false : undefined
    const assets = fdicNonNegativeNumber(record.ASSET)
    const deposits = fdicNonNegativeNumber(record.DEP)
    const offices = fdicProviderNonNegativeInteger(record.OFFICES ?? record.OFFDOM)
    trusted.push({
      record,
      certificate,
      name,
      active,
      assets,
      deposits,
      offices,
      incomplete: !name || active === undefined || assets === undefined || deposits === undefined || offices === undefined,
    })
  }

  if (!trusted.length) {
    return fdicState('invalid', 'Invalid FDIC institution identity', 'The HTTP-success response contained rows, but none established a coherent positive FDIC certificate identity.', { ...stateMeta, invalidRecords })
  }

  const incompleteRecords = trusted.filter((entry) => entry.incomplete).length
  const resultState = invalidRecords > 0 || incompleteRecords > 0 || !request ? 'partial' : 'ready'
  const visible = trusted.slice(0, 8)
  const cards: SemanticCard[] = visible.map(({ record, certificate, name, active, assets, deposits, offices }) => ({
    title: name ?? `FDIC certificate ${certificate}`,
    eyebrow: `FDIC institution · Certificate ${certificate}`,
    badge: fdicStatusLabel(active) ?? 'Status unavailable',
    description: 'Institution identity, structure, and latest financial fields returned by the FDIC institutions endpoint. Monetary values are shown in the provider’s $000s reporting units.',
    metrics: [
      { label: 'Main office', value: fdicMainOffice(record) },
      { label: 'Established', value: fdicDate(record.ESTYMD) },
      { label: 'FDIC insured since', value: fdicDate(record.INSDATE) },
      { label: 'Total assets ($000s)', value: fdicFinancialValue(assets) },
      { label: 'Total deposits ($000s)', value: fdicFinancialValue(deposits) },
      { label: 'Domestic deposits ($000s)', value: fdicFinancialValue(record.DEPDOM) },
      { label: 'Offices', value: offices === undefined ? '—' : formatNumber(offices, 0) },
      { label: 'Primary regulator', value: previewValue(record.REGAGNT) },
      { label: 'Financial report date', value: fdicDate(record.REPDTE ?? record.RISDATE) },
    ],
    tags: [
      cleanText(record.BKCLASS) ? `Bank class ${cleanText(record.BKCLASS)}` : undefined,
      cleanText(record.FDICREGN) ? `FDIC region ${cleanText(record.FDICREGN)}` : undefined,
      record.INSFDIC === 1 ? 'FDIC insured' : undefined,
    ].filter((tag): tag is string => Boolean(tag)),
  }))

  const first = visible[0]
  return <div
    className="bank-institution-preview"
    data-result-state={resultState}
    data-requested-search={request?.search ?? ''}
    data-requested-limit={request?.limit ?? ''}
    data-provider-search={providerSearch}
    data-provider-limit={providerLimit}
    data-acknowledgement-match={requestContractValid ? 'true' : 'false'}
    data-request-contract-valid={requestContractValid ? 'true' : 'false'}
    data-provider-total={providerTotal}
    data-provider-match-count={providerTotal}
    data-provider-record-count={providerRecords}
    data-valid-record-count={trusted.length}
    data-invalid-record-count={invalidRecords}
    data-incomplete-record-count={incompleteRecords}
    data-result-count={visible.length}
    data-primary-bank-name={first.name ?? ''}
    data-primary-fdic-certificate={first.certificate}
    data-primary-status={fdicStatusLabel(first.active) ?? ''}
    data-primary-active={first.active === undefined ? '' : first.active ? 'true' : 'false'}
    data-primary-assets-thousands={first.assets ?? ''}
    data-primary-deposits-thousands={first.deposits ?? ''}
    data-primary-office-count={first.offices ?? ''}
  >
    {resultState === 'partial' && <p className="domain-note">Some FDIC response rows or core institution facts are unavailable or inconsistent. Only rows with coherent provider certificate identity are shown.</p>}
    <SemanticCards cards={cards} emptyTitle="FDIC institution records unavailable"/>
  </div>
}

const satPerVbyte = (value: number | undefined) => value === undefined ? '—' : `${formatNumber(value, 2)} sat/vB`

type MempoolFeeKey = 'fastestFee' | 'halfHourFee' | 'hourFee' | 'economyFee' | 'minimumFee'
const mempoolFeeKeys: MempoolFeeKey[] = ['fastestFee', 'halfHourFee', 'hourFee', 'economyFee', 'minimumFee']

const mempoolFeeValue = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined

const MEMPOOL_FEES_REQUEST_CONTRACT = 'exact-mempool-recommended-fees-v2'
const MEMPOOL_FEES_ENDPOINT = 'https://mempool.space/api/v1/fees/recommended'

const isMempoolRecommendedFeesRequest = (requestUrl?: string) => {
  if (!requestUrl) return false
  try {
    const url = new URL(requestUrl)
    return url.protocol === 'https:'
      && url.hostname.toLowerCase() === 'mempool.space'
      && url.port === ''
      && url.username === ''
      && url.password === ''
      && url.pathname === '/api/v1/fees/recommended'
      && url.search === ''
      && url.hash === ''
      && requestUrl === MEMPOOL_FEES_ENDPOINT
  } catch {
    return false
  }
}

type MempoolRequestBinding = { requestValid?: boolean; transportBound: boolean; invalidReason?: string }

const bindMempoolRecommendedFeesRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): MempoolRequestBinding => {
  if (!requestUrl) return { transportBound: false }
  if (!isMempoolRecommendedFeesRequest(requestUrl)) {
    return { requestValid: false, transportBound: false, invalidReason: 'The displayed request was not the exact supported recommended-fees endpoint.' }
  }
  if (!executedRequest) return { requestValid: true, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl || !isMempoolRecommendedFeesRequest(executedRequest.url)) {
    return { requestValid: false, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET recommended-fees request.' }
  }
  return { requestValid: true, transportBound: true }
}

const mempoolFeeState = (
  state: 'invalid' | 'partial',
  title: string,
  detail: string,
  requestBound: boolean,
  providerFieldCount = 0,
  validFieldCount = 0,
  invalidFieldCount = 0,
  missingFieldCount = mempoolFeeKeys.length - providerFieldCount,
) => <div
  className="transaction-fees-preview"
  data-result-state={state}
  data-request-bound={requestBound ? 'true' : 'false'}
  data-request-contract={MEMPOOL_FEES_REQUEST_CONTRACT}
  data-provider-fee-field-count={providerFieldCount}
  data-valid-fee-field-count={validFieldCount}
  data-invalid-fee-field-count={invalidFieldCount}
  data-missing-fee-field-count={missingFieldCount}
  data-primary-fee-sat-vb=""
  data-half-hour-fee-sat-vb=""
  data-hour-fee-sat-vb=""
  data-economy-fee-sat-vb=""
  data-minimum-fee-sat-vb=""
><div className="weather-empty"><strong>{title}</strong><span>{detail}</span></div></div>

export function MempoolFeePreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const binding = bindMempoolRecommendedFeesRequest(requestUrl, executedRequest)
  const requestBound = binding.transportBound
  if (binding.requestValid === false) {
    return mempoolFeeState('invalid', 'Invalid mempool.space request identity', binding.invalidReason ?? 'The executed request was not the supported recommended-fees endpoint.', false)
  }
  if (!isRecord(data)) {
    return mempoolFeeState('invalid', 'Invalid recommended-fees response', 'mempool.space returned HTTP-success data without the documented fee object.', requestBound)
  }

  const providerFieldCount = mempoolFeeKeys.filter((key) => Object.prototype.hasOwnProperty.call(data, key)).length
  const fees = Object.fromEntries(mempoolFeeKeys.map((key) => [key, mempoolFeeValue(data[key])])) as Record<MempoolFeeKey, number | undefined>
  const validFieldCount = mempoolFeeKeys.filter((key) => fees[key] !== undefined).length
  const invalidFieldCount = mempoolFeeKeys.filter((key) => Object.prototype.hasOwnProperty.call(data, key) && fees[key] === undefined).length
  const missingFieldCount = mempoolFeeKeys.length - providerFieldCount

  if (validFieldCount === 0) {
    return mempoolFeeState(
      'invalid',
      'Invalid recommended-fees response',
      'The HTTP-success response did not contain any finite non-negative mempool.space fee recommendation.',
      requestBound,
      providerFieldCount,
      validFieldCount,
      invalidFieldCount,
      missingFieldCount,
    )
  }

  const { fastestFee, halfHourFee, hourFee, economyFee, minimumFee } = fees
  const resultState = requestBound && validFieldCount === mempoolFeeKeys.length ? 'ready' : 'partial'
  const spread = fastestFee !== undefined && minimumFee !== undefined ? fastestFee - minimumFee : undefined
  return <div
    className="transaction-fees-preview"
    data-result-state={resultState}
    data-request-bound={requestBound ? 'true' : 'false'}
    data-request-contract={MEMPOOL_FEES_REQUEST_CONTRACT}
    data-provider-fee-field-count={providerFieldCount}
    data-valid-fee-field-count={validFieldCount}
    data-invalid-fee-field-count={invalidFieldCount}
    data-missing-fee-field-count={missingFieldCount}
    data-primary-fee-sat-vb={fastestFee ?? ''}
    data-half-hour-fee-sat-vb={halfHourFee ?? ''}
    data-hour-fee-sat-vb={hourFee ?? ''}
    data-economy-fee-sat-vb={economyFee ?? ''}
    data-minimum-fee-sat-vb={minimumFee ?? ''}
  >
    {resultState === 'partial' && <p className="domain-note">Some recommended fee fields or request identity are unavailable or invalid. Only finite non-negative provider fee values are shown.</p>}
    <SemanticCards cards={[{
      title: 'Recommended Bitcoin fee rates',
      eyebrow: 'mempool.space fee estimator',
      badge: fastestFee === undefined ? undefined : `${satPerVbyte(fastestFee)} fastest`,
      description: 'Current suggested fee rates for new Bitcoin transactions. This endpoint reports fee recommendations; it does not by itself provide full mempool backlog or chain-health data.',
      metrics: [
        { label: 'Fastest', value: satPerVbyte(fastestFee) },
        { label: 'Half-hour target', value: satPerVbyte(halfHourFee) },
        { label: 'One-hour target', value: satPerVbyte(hourFee) },
        { label: 'Economy', value: satPerVbyte(economyFee) },
        { label: 'Minimum', value: satPerVbyte(minimumFee) },
        { label: 'Fastest-to-minimum spread', value: satPerVbyte(spread) },
      ],
    }]} emptyTitle="Recommended fees unavailable"/>
  </div>
}

type RdapDomainIdentity = { raw: string; canonical: string }

const canonicalDomainIdentity = (value: unknown): RdapDomainIdentity | undefined => {
  const raw = cleanText(value)?.normalize('NFKC').replace(/\.+$/g, '')
  if (!raw) return undefined
  try {
    const url = new URL(`https://${raw}/`)
    if (url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) return undefined
    const canonical = url.hostname.replace(/\.+$/g, '').toLowerCase()
    if (!canonical || canonical.includes(':')) return undefined
    return { raw, canonical }
  } catch {
    return undefined
  }
}

const requestedRdapDomain = (requestUrl?: string): RdapDomainIdentity | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.hostname.toLowerCase() !== 'rdap.org') return undefined
    const match = url.pathname.match(/^\/domain\/([^/]+)\/?$/)
    if (!match) return undefined
    return canonicalDomainIdentity(decodeURIComponent(match[1]))
  } catch {
    return undefined
  }
}

const rdapInvalid = (title: string, detail: string, requested?: RdapDomainIdentity, providerLdhName?: string, providerUnicodeName?: string) => <div
  className="rdap-domain-preview"
  data-domain-card="domain-registration"
  data-result-state="invalid"
  data-requested-domain={requested?.canonical ?? ''}
  data-provider-ldh-name={providerLdhName ?? ''}
  data-provider-unicode-name={providerUnicodeName ?? ''}
  data-identity-match="false"
><div className="weather-empty"><strong>{title}</strong><span>{detail}</span></div></div>

export function RdapDomainPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!isRecord(data)) {
    return rdapInvalid('Invalid RDAP domain response', 'RDAP returned HTTP-success data without a domain object.')
  }

  const root = data
  if (executedRequest && (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && requestUrl !== executedRequest.url))) {
    return rdapInvalid('Invalid RDAP request transport', 'The successful response is not bound to the displayed exact bodyless GET request.')
  }
  const requested = executedRequest ? requestedRdapDomain(executedRequest.url) : undefined
  if (executedRequest && !requested) {
    return rdapInvalid('Invalid RDAP request identity', 'The executed RDAP URL could not be bound to one direct domain lookup.')
  }

  const providerLdhName = cleanText(root.ldhName)
  const providerUnicodeName = cleanText(root.unicodeName)
  const ldhIdentity = canonicalDomainIdentity(providerLdhName)
  const unicodeIdentity = canonicalDomainIdentity(providerUnicodeName)
  if ((!providerLdhName && !providerUnicodeName) || (providerLdhName && !ldhIdentity) || (providerUnicodeName && !unicodeIdentity)) {
    return rdapInvalid('Invalid RDAP domain identity', 'The HTTP-success response did not include a usable provider-owned LDH or Unicode domain name.', requested, providerLdhName, providerUnicodeName)
  }
  if (ldhIdentity && unicodeIdentity && ldhIdentity.canonical !== unicodeIdentity.canonical) {
    return rdapInvalid('Conflicting RDAP domain identity', 'The provider LDH and Unicode domain names do not identify the same domain, so registration details are not presented as trustworthy.', requested, providerLdhName, providerUnicodeName)
  }

  const providerIdentity = ldhIdentity ?? unicodeIdentity
  if (!providerIdentity) {
    return rdapInvalid('Invalid RDAP domain identity', 'The HTTP-success response did not establish a provider-owned domain identity.', requested, providerLdhName, providerUnicodeName)
  }

  const objectClassName = cleanText(root.objectClassName)
  if (objectClassName && objectClassName.toLowerCase() !== 'domain') {
    return rdapInvalid('RDAP object-type mismatch', 'The direct domain lookup returned a non-domain RDAP object, so its registration fields are not presented as trustworthy.', requested, providerLdhName, providerUnicodeName)
  }

  const identityMatch = requested ? requested.canonical === providerIdentity.canonical : undefined
  if (identityMatch === false) {
    return rdapInvalid('RDAP domain identity mismatch', 'The domain returned by RDAP does not match the executed direct lookup, so registrar, lifecycle, and nameserver details are hidden.', requested, providerLdhName, providerUnicodeName)
  }

  const statusShapeValid = root.status === undefined || (Array.isArray(root.status) && root.status.every((value) => Boolean(cleanText(value))))
  const statuses = statusShapeValid ? textArray(root.status) : []

  const nameserverShapeValid = root.nameservers === undefined || (Array.isArray(root.nameservers) && root.nameservers.every((entry) => {
    if (!isRecord(entry)) return false
    const nameserverClass = cleanText(entry.objectClassName)
    if (nameserverClass && nameserverClass.toLowerCase() !== 'nameserver') return false
    const ldh = canonicalDomainIdentity(entry.ldhName)
    const unicode = canonicalDomainIdentity(entry.unicodeName)
    if (!ldh && !unicode) return false
    return !(ldh && unicode && ldh.canonical !== unicode.canonical)
  }))
  const nameservers = nameserverShapeValid
    ? recordArray(root.nameservers).map((entry) => cleanText(entry.ldhName) ?? cleanText(entry.unicodeName)).filter((value): value is string => Boolean(value))
    : []

  const eventShapeValid = root.events === undefined || (Array.isArray(root.events) && root.events.every((event) => {
    if (!isRecord(event)) return false
    const action = cleanText(event.eventAction)
    const dateText = cleanText(event.eventDate)
    if (!action || !dateText) return false
    return !Number.isNaN(new Date(dateText).getTime())
  }))
  const events = eventShapeValid ? recordArray(root.events) : []

  const entityShapeValid = root.entities === undefined || Array.isArray(root.entities)
  const entities = entityShapeValid ? recordArray(root.entities) : []
  const registrar = entities.find((entity) => textArray(entity.roles).some((role) => role.toLowerCase() === 'registrar'))
  const vcard = registrar && Array.isArray(registrar.vcardArray) ? registrar.vcardArray : []
  const vcardProperties = Array.isArray(vcard[1]) ? vcard[1] : []
  const fullNameProperty = vcardProperties.find((property) => Array.isArray(property) && property[0] === 'fn')
  const registrarName = Array.isArray(fullNameProperty) ? cleanText(fullNameProperty[3]) : undefined

  const eventDate = (action: string) => {
    const value = events.find((event) => cleanText(event.eventAction)?.toLowerCase() === action)?.eventDate
    const text = cleanText(value)
    if (!text) return '—'
    const date = new Date(text)
    return Number.isNaN(date.getTime()) ? '—' : date.toISOString().slice(0, 10)
  }

  const contextShapeValid = statusShapeValid && nameserverShapeValid && eventShapeValid && entityShapeValid
  const state = requested && identityMatch && objectClassName?.toLowerCase() === 'domain' && contextShapeValid ? 'ready' : 'partial'
  const domain = providerLdhName ?? providerUnicodeName ?? providerIdentity.raw

  return <div
    className="rdap-domain-preview"
    data-domain-card="domain-registration"
    data-result-state={state}
    data-requested-domain={requested?.canonical ?? ''}
    data-provider-ldh-name={providerLdhName ?? ''}
    data-provider-unicode-name={providerUnicodeName ?? ''}
    data-provider-domain={providerIdentity.canonical}
    data-object-class-name={objectClassName ?? ''}
    data-identity-match={identityMatch === undefined ? 'unbound' : String(identityMatch)}
    data-status-count={statuses.length}
    data-nameserver-count={nameservers.length}
    data-event-count={events.length}
    data-context-shape-valid={String(contextShapeValid)}
  >
    {state === 'partial' && <p className="domain-note">The provider-owned domain identity is usable, but {requested ? 'one or more optional RDAP registration fields are malformed or the object class is not declared' : 'request identity is unavailable, so this response cannot be bound to a specific executed lookup'}. Only trustworthy fields are shown.</p>}
    <SemanticCards cards={[{
      title: domain,
      eyebrow: 'RDAP domain registration',
      badge: statuses[0],
      description: 'Registration data returned through RDAP.org, with the provider domain identity kept bound to the executed direct lookup before registrar, lifecycle, and nameserver details are shown.',
      metrics: [
        { label: 'Registrar', value: registrarName ?? cleanText(registrar?.handle) ?? '—' },
        { label: 'Registered', value: eventDate('registration') },
        { label: 'Expires', value: eventDate('expiration') },
        { label: 'Last changed', value: eventDate('last changed') },
        { label: 'Nameservers', value: nameservers.join(', ') || '—' },
        { label: 'Registry handle', value: previewValue(root.handle) },
        { label: 'Status', value: statuses.join(', ') || '—' },
      ],
    }]} emptyTitle="Domain registration unavailable"/>
  </div>
}

const formatRouteDistance = (value: unknown) => {
  const meters = numberValue(value)
  if (meters === undefined) return '—'
  return meters >= 1000 ? `${formatNumber(meters / 1000, 2)} km` : `${formatNumber(meters, 0)} m`
}

const formatRouteDuration = (value: unknown) => {
  const seconds = numberValue(value)
  if (seconds === undefined) return '—'
  const rounded = Math.max(0, Math.round(seconds))
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const remainingSeconds = rounded % 60
  if (hours) return `${hours} hr ${minutes} min`
  if (minutes) return `${minutes} min ${remainingSeconds} sec`
  return `${remainingSeconds} sec`
}

type OsrmRequestIdentity = {
  startLongitude: number
  startLatitude: number
  endLongitude: number
  endLatitude: number
  alternatives: number
}

type OsrmTrustedStep = { record: Record<string, unknown>; distance: number; duration: number }
type OsrmTrustedRoute = { record: Record<string, unknown>; distance: number; duration: number; geometryCoordinates: unknown[]; steps: OsrmTrustedStep[]; incomplete: boolean }

const osrmNonNegativeNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined

const osrmCoordinatePair = (value: unknown): [number, number] | undefined => {
  if (!Array.isArray(value) || value.length < 2) return undefined
  const longitude = value[0]
  const latitude = value[1]
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return undefined
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return undefined
  return [longitude, latitude]
}

const osrmRequestCoordinate = (value: string) => {
  const parts = value.split(',')
  if (parts.length !== 2) return undefined
  return osrmCoordinatePair([Number(parts[0]), Number(parts[1])])
}

const osrmRequestIdentity = (executedRequest?: ExecutedRequestContext): OsrmRequestIdentity | undefined => {
  if (!executedRequest) return undefined
  if (executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'router.project-osrm.org' || url.port || url.username || url.password || url.hash) return undefined
    const match = url.pathname.match(/^\/route\/v1\/driving\/([^/]+)$/)
    if (!match) return undefined
    const points = match[1].split(';')
    if (points.length !== 2) return undefined
    const start = osrmRequestCoordinate(points[0])
    const end = osrmRequestCoordinate(points[1])
    if (!start || !end) return undefined
    const allowedQueryKeys = new Set(['alternatives', 'geometries', 'overview', 'steps'])
    const queryKeys = [...url.searchParams.keys()]
    if (queryKeys.length !== 4 || queryKeys.some((key) => !allowedQueryKeys.has(key))) return undefined
    const alternatives = url.searchParams.getAll('alternatives')
    const geometries = url.searchParams.getAll('geometries')
    const overview = url.searchParams.getAll('overview')
    const steps = url.searchParams.getAll('steps')
    if (alternatives.length !== 1 || geometries.length !== 1 || overview.length !== 1 || steps.length !== 1) return undefined
    const alternativeCount = Number(alternatives[0])
    if (!Number.isSafeInteger(alternativeCount) || alternativeCount < 1 || alternativeCount > 3) return undefined
    if (geometries[0] !== 'geojson' || overview[0] !== 'full' || steps[0] !== 'true') return undefined
    return { startLongitude: start[0], startLatitude: start[1], endLongitude: end[0], endLatitude: end[1], alternatives: alternativeCount }
  } catch {
    return undefined
  }
}

const routeWaypointLabel = (waypoint: Record<string, unknown> | undefined) => {
  if (!waypoint) return '—'
  const name = cleanText(waypoint.name)
  const location = osrmCoordinatePair(waypoint.location)
  const coordinate = location ? `${formatNumber(location[1], 5)}, ${formatNumber(location[0], 5)}` : ''
  return [name, coordinate].filter(Boolean).join(' · ') || '—'
}

const osrmInvalid = (title: string, detail: string, request?: OsrmRequestIdentity, code?: string, providerRoutes = 0, invalidRoutes = 0) => <div
  className="route-summary-preview"
  data-result-state="invalid"
  data-route-code={code ?? ''}
  data-requested-start={request ? `${request.startLongitude},${request.startLatitude}` : ''}
  data-requested-end={request ? `${request.endLongitude},${request.endLatitude}` : ''}
  data-requested-alternatives={request?.alternatives ?? ''}
  data-provider-route-count={providerRoutes}
  data-valid-route-count="0"
  data-invalid-route-count={invalidRoutes}
  data-incomplete-route-count="0"
  data-result-count="0"
  data-waypoint-contract-valid="false"
  data-primary-distance-m=""
  data-primary-duration-s=""
  data-primary-step-count=""
  data-primary-geometry-point-count=""
><div className="weather-empty"><strong>{title}</strong><span>{detail}</span></div></div>

export function OsrmRoutePreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const request = osrmRequestIdentity(executedRequest)
  if (executedRequest && !request) return osrmInvalid('Invalid OSRM request identity', 'The executed request could not be bound to the supported bodyless GET two-point driving route contract.')
  if (!isRecord(data)) return osrmInvalid('Invalid OSRM response', 'OSRM returned HTTP-success data without the documented route response object.', request)

  const root = data
  const code = cleanText(root.code)
  if (code !== 'Ok') return osrmInvalid('Invalid OSRM route outcome', 'An HTTP-success route response must report the provider success code Ok before route facts can be trusted.', request, code)
  if (!Array.isArray(root.routes) || !Array.isArray(root.waypoints)) return osrmInvalid('Invalid OSRM route envelope', 'The HTTP-success response did not include the documented routes and waypoints arrays.', request, code)

  const providerRoutes = root.routes.length
  const waypointRecords = root.waypoints.filter((value): value is Record<string, unknown> => isRecord(value))
  const waypointContractValid = root.waypoints.length === 2 && waypointRecords.length === 2 && waypointRecords.every((waypoint) => Boolean(osrmCoordinatePair(waypoint.location)))
  const trusted: OsrmTrustedRoute[] = []
  let invalidRoutes = 0

  for (const value of root.routes) {
    if (!isRecord(value)) { invalidRoutes += 1; continue }
    const distance = osrmNonNegativeNumber(value.distance)
    const duration = osrmNonNegativeNumber(value.duration)
    const geometry = isRecord(value.geometry) ? value.geometry : undefined
    const rawCoordinates = geometry && Array.isArray(geometry.coordinates) ? geometry.coordinates : undefined
    const geometryValid = cleanText(geometry?.type) === 'LineString' && Boolean(rawCoordinates && rawCoordinates.length >= 2 && rawCoordinates.every((coordinate) => Boolean(osrmCoordinatePair(coordinate))))
    if (distance === undefined || duration === undefined || !geometryValid || !rawCoordinates) { invalidRoutes += 1; continue }

    let incomplete = false
    const steps: OsrmTrustedStep[] = []
    if (!Array.isArray(value.legs) || value.legs.length !== 1) {
      incomplete = true
    } else {
      for (const leg of value.legs) {
        if (!isRecord(leg) || !Array.isArray(leg.steps)) { incomplete = true; continue }
        for (const step of leg.steps) {
          if (!isRecord(step)) { incomplete = true; continue }
          const stepDistance = osrmNonNegativeNumber(step.distance)
          const stepDuration = osrmNonNegativeNumber(step.duration)
          const maneuver = isRecord(step.maneuver) ? step.maneuver : undefined
          if (stepDistance === undefined || stepDuration === undefined || !maneuver || !cleanText(maneuver.type)) { incomplete = true; continue }
          steps.push({ record: step, distance: stepDistance, duration: stepDuration })
        }
      }
    }
    if (!steps.length) incomplete = true
    trusted.push({ record: value, distance, duration, geometryCoordinates: rawCoordinates, steps, incomplete })
  }

  if (!trusted.length) return osrmInvalid('Invalid OSRM route identity', 'The HTTP-success response contained no route with trustworthy distance, duration, and GeoJSON LineString geometry.', request, code, providerRoutes, invalidRoutes)

  const incompleteRoutes = trusted.filter((route) => route.incomplete).length
  const resultState = invalidRoutes > 0 || incompleteRoutes > 0 || !request || !waypointContractValid ? 'partial' : 'ready'
  const visible = trusted.slice(0, 3)
  const start = waypointContractValid ? routeWaypointLabel(waypointRecords[0]) : '—'
  const destination = waypointContractValid ? routeWaypointLabel(waypointRecords[1]) : '—'
  const cards: SemanticCard[] = visible.map((route, index) => ({
    title: visible.length === 1 ? 'Calculated route' : `Route ${index + 1}`,
    eyebrow: 'OSRM route service',
    badge: cleanText(route.record.weight_name) ?? undefined,
    description: index === 0 ? `Snapped from ${start} to ${destination}.` : 'Alternative route returned by the provider.',
    metrics: [
      { label: 'Distance', value: formatRouteDistance(route.distance) },
      { label: 'Estimated travel time', value: formatRouteDuration(route.duration) },
      { label: 'Route legs', value: Array.isArray(route.record.legs) ? String(route.record.legs.length) : '—' },
      { label: 'Turn steps', value: route.incomplete ? `${route.steps.length} validated` : String(route.steps.length) },
      { label: 'Geometry points', value: String(route.geometryCoordinates.length) },
      { label: 'Weight', value: previewValue(route.record.weight) },
    ],
  }))

  const primary = visible[0]
  const shownSteps = primary.steps.slice(0, 40)
  return <div className="route-summary-preview" data-result-state={resultState} data-route-code={code}
    data-requested-start={request ? `${request.startLongitude},${request.startLatitude}` : ''}
    data-requested-end={request ? `${request.endLongitude},${request.endLatitude}` : ''}
    data-requested-alternatives={request?.alternatives ?? ''} data-provider-route-count={providerRoutes}
    data-valid-route-count={trusted.length} data-invalid-route-count={invalidRoutes} data-incomplete-route-count={incompleteRoutes}
    data-result-count={visible.length} data-waypoint-contract-valid={waypointContractValid ? 'true' : 'false'}
    data-primary-distance-m={primary.distance} data-primary-duration-s={primary.duration} data-primary-step-count={primary.steps.length}
    data-primary-geometry-point-count={primary.geometryCoordinates.length}>
    {resultState === 'partial' && <p className="domain-note">Some OSRM response context is unavailable or inconsistent. Only routes with trustworthy core route geometry and measurements are shown.</p>}
    <SemanticCards cards={cards} emptyTitle="Route unavailable"/>
    <section className="route-step-panel" aria-labelledby="route-step-heading">
      <header><div><small>Primary route</small><h3 id="route-step-heading">Turn-by-turn steps</h3></div><span>{primary.steps.length} validated provider steps</span></header>
      <ol>{shownSteps.map(({ record: step, distance, duration }, index) => {
        const maneuver = isRecord(step.maneuver) ? step.maneuver : {}
        const maneuverType = [cleanText(maneuver.type), cleanText(maneuver.modifier)].filter(Boolean).join(' · ')
        const road = cleanText(step.name) || 'Unnamed road'
        return <li key={`${index}-${road}-${distance}`}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{maneuverType}</b><strong>{road}</strong><small>{formatRouteDistance(distance)} · {formatRouteDuration(duration)}</small></div></li>
      })}</ol>
      {primary.steps.length > shownSteps.length && <p>Showing the first {shownSteps.length} of {primary.steps.length} validated provider steps. Raw JSON retains the complete response.</p>}
    </section>
  </div>
}
