import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, nonNegativeSafeInteger, trimmedText } from './semanticValidation'

const ROR_REQUEST_CONTRACT = 'exact-ror-v2-organizations-search'
const ROR_PAGE_LIMIT = 20

type RorRequest = { query: string }
type RorOrganization = { id: string; name: string }
type RorViewModel = {
  state: 'ready' | 'partial' | 'empty' | 'invalid'
  request?: RorRequest
  organizations: RorOrganization[]
  providerItemCount?: number
  providerTotal?: number
  malformedOrganizationCount: number
  duplicateOrganizationCount: number
  countContract?: boolean
  responseEnvelopeContract?: boolean
  message: string
}

const exactQueryRequest = (executedRequest?: ExecutedRequestContext): RorRequest | undefined => {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'api.ror.org' || url.port || url.username || url.password
      || url.pathname !== '/v2/organizations' || url.hash || keys.length !== 1 || keys[0] !== 'query'
      || url.searchParams.getAll('query').length !== 1) return undefined
    const query = trimmedText(url.searchParams.get('query'))
    return query ? { query } : undefined
  } catch {
    return undefined
  }
}

const parseRorId = (value: unknown): string | undefined => {
  const text = trimmedText(value)
  if (!text) return undefined
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.hostname !== 'ror.org' || url.port || url.username || url.password || url.search || url.hash
      || !/^\/[0-9a-z]{9}$/.test(url.pathname)) return undefined
    return `https://ror.org${url.pathname}`
  } catch {
    return undefined
  }
}

const parseOrganization = (value: unknown): RorOrganization | undefined => {
  if (!isRecord(value) || !Array.isArray(value.names)) return undefined
  const displayName = value.names.find((entry) => isRecord(entry) && Array.isArray(entry.types) && entry.types.includes('ror_display'))
  const id = parseRorId(value.id)
  const name = isRecord(displayName) ? trimmedText(displayName.value) : undefined
  return id && name ? { id, name } : undefined
}

const parseViewModel = (data: unknown, request: RorRequest | undefined): RorViewModel => {
  const invalidRequest = !request
  if (invalidRequest) return {
    state: 'invalid', organizations: [], malformedOrganizationCount: 0, duplicateOrganizationCount: 0,
    message: 'The successful response was not tied to the supported exact ROR v2 organization-search request.',
  }

  if (!isRecord(data) || !Array.isArray(data.items) || !isRecord(data.meta) || typeof data.time_taken !== 'number' || !Number.isFinite(data.time_taken)) {
    return {
      state: 'invalid', request, organizations: [], malformedOrganizationCount: 0, duplicateOrganizationCount: 0,
      responseEnvelopeContract: false,
      message: 'ROR did not return the expected organization-search envelope with native response metadata.',
    }
  }

  const providerTotal = nonNegativeSafeInteger(data.number_of_results)
  const providerItemCount = data.items.length
  const countContract = providerTotal !== undefined && providerItemCount <= ROR_PAGE_LIMIT && providerItemCount <= providerTotal
  if (!countContract) return {
    state: 'invalid', request, organizations: [], providerItemCount, providerTotal,
    malformedOrganizationCount: 0, duplicateOrganizationCount: 0, countContract: false, responseEnvelopeContract: true,
    message: 'ROR returned a result count or first page that is not coherent with its native v2 contract.',
  }

  if (providerItemCount === 0) return {
    state: providerTotal === 0 ? 'empty' : 'invalid', request, organizations: [], providerItemCount, providerTotal,
    malformedOrganizationCount: 0, duplicateOrganizationCount: 0, countContract: true, responseEnvelopeContract: true,
    message: providerTotal === 0 ? `ROR returned no organizations for “${request.query}”.` : 'ROR reported matches but returned no first-page items.',
  }

  const organizations: RorOrganization[] = []
  const seen = new Set<string>()
  let malformedOrganizationCount = 0
  let duplicateOrganizationCount = 0
  for (const item of data.items) {
    const organization = parseOrganization(item)
    if (!organization) {
      malformedOrganizationCount += 1
      continue
    }
    if (seen.has(organization.id)) {
      duplicateOrganizationCount += 1
      continue
    }
    seen.add(organization.id)
    organizations.push(organization)
  }

  if (!organizations.length) return {
    state: 'invalid', request, organizations, providerItemCount, providerTotal,
    malformedOrganizationCount, duplicateOrganizationCount, countContract: true, responseEnvelopeContract: true,
    message: 'ROR returned organization items, but none had a valid provider-owned ROR ID and ROR display name.',
  }

  const partial = malformedOrganizationCount > 0 || duplicateOrganizationCount > 0
  return {
    state: partial ? 'partial' : 'ready', request, organizations, providerItemCount, providerTotal,
    malformedOrganizationCount, duplicateOrganizationCount, countContract: true, responseEnvelopeContract: true,
    message: partial ? 'Malformed or duplicate organization identities are withheld; raw JSON retains the provider response.' : '',
  }
}

const evidence = (view: RorViewModel) => ({
  'data-domain-card': 'ror-search',
  'data-result-state': view.state,
  'data-request-bound': String(Boolean(view.request)),
  'data-request-contract': ROR_REQUEST_CONTRACT,
  'data-request-query': view.request?.query,
  'data-provider-item-count': view.providerItemCount,
  'data-provider-total': view.providerTotal,
  'data-valid-organization-count': view.organizations.length,
  'data-malformed-organization-count': view.malformedOrganizationCount,
  'data-duplicate-organization-count': view.duplicateOrganizationCount,
  'data-count-contract': view.countContract === undefined ? undefined : String(view.countContract),
  'data-response-envelope-contract': view.responseEnvelopeContract === undefined ? undefined : String(view.responseEnvelopeContract),
  'data-item-limit-contract': view.providerItemCount === undefined ? undefined : String(view.providerItemCount <= ROR_PAGE_LIMIT),
  'data-primary-ror-id': view.organizations[0]?.id,
})

export function RorSearchPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const view = parseViewModel(data, exactQueryRequest(executedRequest))
  if (view.state === 'invalid' || view.state === 'empty') return <div className="domain-card domain-empty ror-preview" {...evidence(view)}>
    <h3>{view.state === 'empty' ? 'No ROR organizations found' : 'Invalid ROR organization response'}</h3>
    <p>{view.message}</p>
  </div>

  return <div className="domain-card ror-preview" {...evidence(view)}>
    <header className="domain-heading">
      <div>
        <small className="domain-eyebrow">ROR v2 organization search</small>
        <h3>{view.request?.query}</h3>
        <p>Provider organization candidates returned by the exact executed ROR quick-search request.</p>
      </div>
      <span className={`domain-state${view.state === 'partial' ? ' warning' : ''}`}>{view.organizations.length} trusted candidates</span>
    </header>

    {view.state === 'partial' && <p className="domain-note">{view.message}</p>}
    <dl className="domain-facts">
      <div><dt>Search query</dt><dd>{view.request?.query}</dd></div>
      <div><dt>Provider matches</dt><dd>{view.providerTotal}</dd></div>
      <div><dt>Trusted candidates</dt><dd>{view.organizations.length}</dd></div>
      <div><dt>First ROR ID</dt><dd><code>{view.organizations[0]?.id}</code></dd></div>
    </dl>

    <p className="ror-selection-note">ROR quick search is for interactive human choice. The first result is not auto-selected.</p>
    <ol className="ror-organization-list" aria-label="ROR organization results">
      {view.organizations.map((organization) => <li key={organization.id} data-ror-id={organization.id}>
        <h4>{organization.name}</h4>
        <a href={organization.id} target="_blank" rel="noreferrer">{organization.id}</a>
      </li>)}
    </ol>
  </div>
}
