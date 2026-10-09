import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { isRecord, nonNegativeSafeInteger, optionalTrimmedText, positiveSafeInteger, trimmedText } from './semanticValidation'

const GBIF_ORIGIN = 'https://api.gbif.org'
const REQUEST_CONTRACT = 'exact-gbif-species-search-v2-bodyless-get'
const PAGE_LIMIT = 8

type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'
type GbifRequest = { query: string }
type GbifTaxon = {
  key: number
  nubKey?: number
  scientificName: string
  canonicalName?: string
  authorship?: string
  kingdom?: string
  phylum?: string
  className?: string
  order?: string
  family?: string
  genus?: string
  rank?: string
  taxonomicStatus?: string
  nameType?: string
  synonym?: boolean
}

type GbifTaxonomyViewModel = {
  state: ResultState
  reason?: string
  requestBound: boolean
  query?: string
  providerCount?: number
  providerRecordCount: number
  validRecordCount: number
  invalidRecordCount: number
  taxa: GbifTaxon[]
}

const parseRequestUrl = (api: ApiDemo, value?: string): GbifRequest | undefined => {
  if (api.id !== 'gbif-species-search' || !value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.origin !== GBIF_ORIGIN || url.username || url.password || url.port || url.pathname !== '/v1/species/search' || url.hash) return undefined
    const keys = [...url.searchParams.keys()]
    if (keys.length !== 2 || url.searchParams.getAll('q').length !== 1 || url.searchParams.getAll('limit').length !== 1) return undefined
    if (!keys.every((key) => key === 'q' || key === 'limit') || url.searchParams.get('limit') !== String(PAGE_LIMIT)) return undefined
    const query = url.searchParams.get('q')
    if (!query || !query.trim()) return undefined
    return api.buildUrl({ query }) === value ? { query } : undefined
  } catch {
    return undefined
  }
}

const bindRequest = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext) => {
  const displayed = parseRequestUrl(api, requestUrl)
  if (!displayed) return { request: undefined, valid: false, bound: false } as const
  if (!executedRequest) return { request: displayed, valid: true, bound: false } as const
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request: displayed, valid: false, bound: false } as const
  }
  const executed = parseRequestUrl(api, executedRequest.url)
  if (!executed || executed.query !== displayed.query) return { request: displayed, valid: false, bound: false } as const
  return { request: executed, valid: true, bound: true } as const
}

const parseTaxon = (value: unknown, seenKeys: Set<number>): GbifTaxon | undefined => {
  if (!isRecord(value)) return undefined
  const key = positiveSafeInteger(value.key)
  if (!key || seenKeys.has(key)) return undefined
  const scientificName = trimmedText(value.scientificName) ?? trimmedText(value.canonicalName)
  if (!scientificName) return undefined

  const optionalFields = {
    canonicalName: optionalTrimmedText(value.canonicalName),
    authorship: optionalTrimmedText(value.authorship),
    kingdom: optionalTrimmedText(value.kingdom),
    phylum: optionalTrimmedText(value.phylum),
    className: optionalTrimmedText(value.class),
    order: optionalTrimmedText(value.order),
    family: optionalTrimmedText(value.family),
    genus: optionalTrimmedText(value.genus),
    rank: optionalTrimmedText(value.rank),
    taxonomicStatus: optionalTrimmedText(value.taxonomicStatus),
    nameType: optionalTrimmedText(value.nameType),
  }
  if (Object.values(optionalFields).some((field) => field.malformed)) return undefined

  const nubKey = value.nubKey === undefined || value.nubKey === null ? undefined : positiveSafeInteger(value.nubKey)
  if (value.nubKey !== undefined && value.nubKey !== null && nubKey === undefined) return undefined
  if (value.synonym !== undefined && typeof value.synonym !== 'boolean') return undefined

  seenKeys.add(key)
  return {
    key,
    nubKey,
    scientificName,
    canonicalName: optionalFields.canonicalName.value,
    authorship: optionalFields.authorship.value,
    kingdom: optionalFields.kingdom.value,
    phylum: optionalFields.phylum.value,
    className: optionalFields.className.value,
    order: optionalFields.order.value,
    family: optionalFields.family.value,
    genus: optionalFields.genus.value,
    rank: optionalFields.rank.value,
    taxonomicStatus: optionalFields.taxonomicStatus.value,
    nameType: optionalFields.nameType.value,
    synonym: value.synonym as boolean | undefined,
  }
}

export const buildGbifTaxonomyViewModel = (api: ApiDemo, data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): GbifTaxonomyViewModel => {
  const binding = bindRequest(api, requestUrl, executedRequest)
  const base = { requestBound: binding.bound, query: binding.request?.query, providerRecordCount: 0, validRecordCount: 0, invalidRecordCount: 0, taxa: [] as GbifTaxon[] }
  if (!binding.valid || !binding.request) return { ...base, state: 'invalid', reason: 'The successful response was not tied to the exact supported bodyless GET GBIF species-search request.' }
  if (!isRecord(data) || !Array.isArray(data.results)) return { ...base, state: 'invalid', reason: 'GBIF did not return the expected species-search paging envelope.' }

  const offset = nonNegativeSafeInteger(data.offset)
  const limit = positiveSafeInteger(data.limit)
  const providerCount = nonNegativeSafeInteger(data.count)
  const endOfRecords = typeof data.endOfRecords === 'boolean' ? data.endOfRecords : undefined
  const providerRecordCount = data.results.length
  const pagingValid = offset === 0
    && limit === PAGE_LIMIT
    && providerCount !== undefined
    && providerCount >= providerRecordCount
    && providerRecordCount <= PAGE_LIMIT
    && endOfRecords !== undefined
    && endOfRecords === (providerCount <= PAGE_LIMIT)

  if (!pagingValid) {
    return { ...base, providerCount, providerRecordCount, invalidRecordCount: providerRecordCount, state: 'invalid', reason: 'GBIF paging metadata contradicted the supported first-page limit=8 search contract.' }
  }

  if (providerRecordCount === 0) {
    if (providerCount !== 0) return { ...base, providerCount, state: 'invalid', reason: 'GBIF reported matching taxa but returned no first-page records.' }
    return {
      ...base,
      providerCount,
      state: binding.bound ? 'empty' : 'partial',
      reason: binding.bound ? `GBIF returned no taxonomy matches for “${binding.request.query}”.` : 'GBIF returned an empty search page, but executed-request evidence is unavailable, so emptiness is not trusted as request-bound.',
    }
  }

  const seenKeys = new Set<number>()
  const taxa = data.results.map((row) => parseTaxon(row, seenKeys)).filter((row): row is GbifTaxon => row !== undefined)
  const invalidRecordCount = providerRecordCount - taxa.length
  if (!taxa.length) {
    return { ...base, providerCount, providerRecordCount, invalidRecordCount, state: 'invalid', reason: 'GBIF returned records, but none had a trustworthy unique taxon key and scientific-name identity.' }
  }

  const state: ResultState = binding.bound && invalidRecordCount === 0 ? 'ready' : 'partial'
  return {
    requestBound: binding.bound,
    query: binding.request.query,
    providerCount,
    providerRecordCount,
    validRecordCount: taxa.length,
    invalidRecordCount,
    taxa,
    state,
    reason: !binding.bound
      ? 'Taxonomy rows are structurally usable, but executed-request evidence is unavailable, so they cannot be marked request-bound.'
      : invalidRecordCount > 0
        ? `${invalidRecordCount} malformed or duplicate taxonomy ${invalidRecordCount === 1 ? 'record was' : 'records were'} withheld.`
        : undefined,
  }
}

export function GbifTaxonomyPreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = buildGbifTaxonomyViewModel(api, data, requestUrl, executedRequest)
  const primary = model.taxa[0]
  const attrs = {
    'data-domain-card': 'gbif-taxonomy-search',
    'data-result-state': model.state,
    'data-request-bound': String(model.requestBound),
    'data-request-contract': REQUEST_CONTRACT,
    'data-requested-query': model.query,
    'data-provider-count': model.providerCount === undefined ? undefined : String(model.providerCount),
    'data-provider-record-count': String(model.providerRecordCount),
    'data-valid-record-count': String(model.validRecordCount),
    'data-invalid-record-count': String(model.invalidRecordCount),
    'data-primary-taxon-key': primary ? String(primary.key) : undefined,
    'data-primary-nub-key': primary?.nubKey === undefined ? undefined : String(primary.nubKey),
  }

  if (model.state === 'invalid') {
    return <section className="domain-card domain-empty" aria-label="GBIF species search evidence" {...attrs}><h3>GBIF taxonomy response not trusted</h3><p>{model.reason}</p></section>
  }
  if (model.state === 'empty') {
    return <section className="domain-card domain-empty" aria-label="GBIF species search evidence" {...attrs}><h3>No taxonomy matches</h3><p>{model.reason}</p></section>
  }
  if (!model.taxa.length) {
    return <section className="domain-card domain-empty" aria-label="GBIF species search evidence" {...attrs}><h3>Unbound empty taxonomy response</h3><p>{model.reason}</p></section>
  }

  const cards: SemanticCard[] = model.taxa.map((taxon) => ({
    title: taxon.scientificName,
    eyebrow: [taxon.kingdom, taxon.phylum, taxon.className].filter(Boolean).join(' › ') || 'GBIF taxonomy',
    badge: taxon.rank ?? 'Taxon',
    description: taxon.authorship,
    metrics: [
      { label: 'GBIF taxon key', value: String(taxon.key) },
      { label: 'Status', value: taxon.taxonomicStatus ?? 'Not supplied' },
      { label: 'Family', value: taxon.family ?? 'Not supplied' },
      { label: 'Genus', value: taxon.genus ?? 'Not supplied' },
    ],
    tags: [taxon.order, taxon.nameType, taxon.synonym === true ? 'Synonym' : taxon.synonym === false ? 'Accepted name' : undefined].filter((value): value is string => Boolean(value)),
  }))

  return <section className="ssot-stack" aria-label="GBIF species search evidence" {...attrs}>
    {model.state === 'partial' && <p className="domain-note">{model.reason}</p>}
    <header className="domain-heading"><div><small className="domain-eyebrow">Global Biodiversity Information Facility · Species search</small><h3>Taxonomy matches for “{model.query}”</h3><p>{model.providerCount?.toLocaleString('en') ?? 'Unknown'} provider matches · {model.validRecordCount} validated first-page records · {model.invalidRecordCount} withheld</p></div><span className={`domain-state${model.state === 'partial' ? ' warning' : ''}`}>{model.validRecordCount} trusted</span></header>
    <SemanticCards cards={cards} emptyTitle="Taxonomy records unavailable"/>
  </section>
}
