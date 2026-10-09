import './drugLabel.css'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { isRecord, nonNegativeSafeInteger, trimmedText } from './semanticValidation'

type UnknownRecord = Record<string, unknown>
type RequestContract = { brand: string; limit: number; transportBound: boolean }
type RequestUrlContract = Omit<RequestContract, 'transportBound'>

const parseRequestUrl = (requestUrl?: string): RequestUrlContract | null | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    const exactKeys = keys.length === 2
      && keys.filter((key) => key === 'search').length === 1
      && keys.filter((key) => key === 'limit').length === 1
    const search = url.searchParams.get('search') ?? ''
    const match = /^openfda\.brand_name:"([^"\\]+)"$/.exec(search)
    const brand = match?.[1].trim() ?? ''
    if (url.protocol !== 'https:' || url.hostname !== 'api.fda.gov' || url.port || url.username || url.password
      || url.pathname !== '/drug/label.json' || url.hash || !exactKeys || !brand
      || url.searchParams.get('limit') !== '8') return null
    return { brand, limit: 8 }
  } catch {
    return null
  }
}

const parseRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): RequestContract | null | undefined => {
  const displayedRequest = parseRequestUrl(requestUrl)
  if (requestUrl && !displayedRequest) return null
  if (!executedRequest) return displayedRequest ? { ...displayedRequest, transportBound: false } : undefined
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return null
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return null
  const executed = parseRequestUrl(executedRequest.url)
  return executed ? { ...executed, transportBound: true } : null
}

const cleanText = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const text = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text || undefined
}

const textArray = (value: unknown) => Array.isArray(value)
  ? value.map(cleanText).filter((item): item is string => Boolean(item))
  : []

const firstText = (value: unknown) => textArray(value)[0]

const clip = (value: string | undefined, limit = 620) => {
  if (!value) return 'Not returned in this label record.'
  return value.length <= limit ? value : `${value.slice(0, limit - 1).trimEnd()}…`
}

const joinText = (value: unknown) => textArray(value).join(', ') || '—'
const normalized = (value: string) => value.toLocaleLowerCase('en')
const matchesBrand = (candidate: string, requestedBrand: string) => normalized(candidate).includes(normalized(requestedBrand))

export function DrugLabelPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const request = parseRequest(requestUrl, executedRequest)
  if (request === null || request === undefined) {
    return <CardEmpty domain="drug-label" title="Invalid openFDA drug-label request" detail="The successful response was not tied to the supported keyless brand-name search request contract." state="invalid"/>
  }
  if (!isRecord(data)) {
    return <CardEmpty domain="drug-label" title="Invalid openFDA drug-label response" detail="The provider response was not the documented drug-label object." state="invalid"/>
  }

  const rawResults = Array.isArray(data.results) ? data.results : null
  if (!rawResults) {
    return <CardEmpty domain="drug-label" title="Invalid openFDA drug-label response" detail="The provider response did not include the documented results array." state="invalid"/>
  }

  const meta = isRecord(data.meta) ? data.meta : undefined
  const metaResults = meta && isRecord(meta.results) ? meta.results : undefined
  const skip = metaResults ? nonNegativeSafeInteger(metaResults.skip) : undefined
  const providerLimit = metaResults ? nonNegativeSafeInteger(metaResults.limit) : undefined
  const total = metaResults ? nonNegativeSafeInteger(metaResults.total) : undefined
  const paginationCoherent = skip === 0
    && providerLimit === request.limit
    && total !== undefined
    && total >= rawResults.length
    && rawResults.length <= request.limit

  if (!rawResults.length) {
    if (paginationCoherent && total === 0) {
      if (request.transportBound) return <CardEmpty domain="drug-label" title="No openFDA drug labels returned" detail={`The provider returned no label records for the request-bound brand-name phrase “${request.brand}”.`} state="empty"/>
      return <div className="domain-card domain-empty" data-domain-card="drug-label" data-result-state="partial" data-request-bound="false" data-requested-brand={request.brand} data-requested-limit={request.limit}><h3>openFDA drug-label request identity unavailable</h3><p>openFDA returned a coherent zero-result response, but the executed request transport is unavailable, so it is not trusted as a request-bound no-match result.</p></div>
    }
    return <CardEmpty domain="drug-label" title="Invalid openFDA drug-label response" detail="The empty response did not include coherent openFDA pagination evidence." state="invalid"/>
  }

  const trusted: UnknownRecord[] = []
  const seenIds = new Set<string>()
  let queryMismatchCount = 0
  let malformedIdentityCount = 0
  let duplicateIdentityCount = 0
  for (const value of rawResults) {
    if (!isRecord(value)) {
      malformedIdentityCount += 1
      continue
    }
    const id = trimmedText(value.id)
    const openfda = isRecord(value.openfda) ? value.openfda : undefined
    const brandNames = openfda ? textArray(openfda.brand_name) : []
    if (!id || !brandNames.length) {
      malformedIdentityCount += 1
      continue
    }
    if (!brandNames.some((brandName) => matchesBrand(brandName, request.brand))) {
      queryMismatchCount += 1
      continue
    }
    if (seenIds.has(id)) {
      duplicateIdentityCount += 1
      continue
    }
    seenIds.add(id)
    trusted.push(value)
  }

  if (!trusted.length) {
    return <CardEmpty domain="drug-label" title="Invalid openFDA drug-label response" detail="The provider returned label rows, but none could be trusted for the executed brand-name search." state="invalid"/>
  }

  const primary = trusted[0]
  const openfda = isRecord(primary.openfda) ? primary.openfda : {}
  const brandNames = textArray(openfda.brand_name)
  const brand = brandNames.find((brandName) => matchesBrand(brandName, request.brand)) ?? brandNames[0]
  const genericName = firstText(openfda.generic_name) ?? '—'
  const manufacturer = firstText(openfda.manufacturer_name) ?? '—'
  const productType = firstText(openfda.product_type) ?? '—'
  const route = joinText(openfda.route)
  const substances = joinText(openfda.substance_name)
  const activeIngredients = firstText(primary.active_ingredient)
  const indications = firstText(primary.indications_and_usage) ?? firstText(primary.purpose)
  const warnings = firstText(primary.boxed_warning) ?? firstText(primary.warnings)
  const directions = firstText(primary.dosage_and_administration)
  const updated = cleanText(meta?.last_updated) ?? '—'
  const invalidRecordCount = rawResults.length - trusted.length
  const partial = !request.transportBound || !paginationCoherent || invalidRecordCount > 0 || duplicateIdentityCount > 0
  const totalDisplay = total === undefined ? 'Unavailable' : total.toLocaleString('en')

  return <div
    className="drug-label-preview"
    data-result-state={partial ? 'partial' : 'ready'}
    data-request-bound={request.transportBound ? 'true' : 'false'}
    data-requested-brand={request.brand}
    data-requested-limit={request.limit}
    data-provider-record-count={rawResults.length}
    data-valid-record-count={trusted.length}
    data-invalid-record-count={invalidRecordCount}
    data-query-mismatch-count={queryMismatchCount}
    data-malformed-identity-count={malformedIdentityCount}
    data-duplicate-identity-count={duplicateIdentityCount}
    data-pagination-coherent={paginationCoherent ? 'true' : 'false'}
    data-primary-brand-name={brand}
    data-primary-generic-name={genericName === '—' ? '' : genericName}
    data-primary-manufacturer={manufacturer === '—' ? '' : manufacturer}
    data-primary-substances={substances === '—' ? '' : substances}
    data-provider-match-count={total ?? ''}
    data-provider-last-updated={updated === '—' ? '' : updated}
  >
    <header className="drug-label-heading">
      <div>
        <small>openFDA product labeling</small>
        <h3>{brand}</h3>
        <p>{genericName}</p>
      </div>
      <span>{trusted.length} trusted · {totalDisplay} matches</span>
    </header>

    {partial && <p className="drug-label-note">{request.transportBound ? 'Only records tied to the executed brand-name search are trusted. Query mismatches, malformed or duplicate label identities, and incoherent pagination evidence are withheld or marked unavailable.' : 'The returned records are structurally consistent with the displayed brand-name search, but executed transport identity is unavailable, so the result cannot be marked ready.'}</p>}

    <dl className="drug-label-facts">
      <div><dt>Manufacturer / labeler</dt><dd>{manufacturer}</dd></div>
      <div><dt>Product type</dt><dd>{productType}</dd></div>
      <div><dt>Route</dt><dd>{route}</dd></div>
      <div><dt>Active substances</dt><dd>{substances}</dd></div>
      <div><dt>Dataset updated</dt><dd>{updated}</dd></div>
    </dl>

    <section className="drug-label-sections" aria-label="Primary drug label sections">
      <article>
        <small>Label section</small>
        <h4>Active ingredients</h4>
        <p>{clip(activeIngredients, 420)}</p>
      </article>
      <article>
        <small>Label section</small>
        <h4>Indications and uses</h4>
        <p>{clip(indications)}</p>
      </article>
      <article>
        <small>Label section</small>
        <h4>Warnings</h4>
        <p>{clip(warnings, 760)}</p>
      </article>
      <article>
        <small>Label section</small>
        <h4>Directions</h4>
        <p>{clip(directions)}</p>
      </article>
    </section>

    <p className="drug-label-note">Informational public label data only. Text shown here is a bounded semantic preview; Raw JSON retains the complete provider response. Do not use openFDA results for medical decisions.</p>
  </div>
}
