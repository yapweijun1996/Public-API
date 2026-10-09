import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, text } from './cardPrimitives'
import { isRecord, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

const iconIds = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && /^[^:\s]+:[^:\s]+$/.test(item.trim())) : []
const stringValue = (value: unknown) => text(value) ?? 'Not supplied'

type IconifySearchRequest = { query: string; limit: number }
type BoundIconifySearchRequest = { request?: IconifySearchRequest; transportBound: boolean; invalidReason?: string }

const REQUEST_CONTRACT = 'exact-iconify-search-v2'

const parseRequest = (requestUrl?: string): IconifySearchRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const entries = [...url.searchParams.entries()]
    const exactKeys = entries.length === 2
      && entries.filter(([key]) => key === 'query').length === 1
      && entries.filter(([key]) => key === 'limit').length === 1
    const query = trimmedText(url.searchParams.get('query'))
    const limitRaw = url.searchParams.get('limit')
    const limit = limitRaw && /^(?:3[2-9]|[4-5]\d|60)$/.test(limitRaw) ? Number(limitRaw) : undefined
    const valid = url.protocol === 'https:'
      && url.hostname === 'api.iconify.design'
      && url.port === ''
      && url.username === ''
      && url.password === ''
      && url.pathname === '/search'
      && url.hash === ''
      && exactKeys
      && query !== undefined
      && limit !== undefined
    if (!valid || !query || limit === undefined) return undefined
    const canonical = `https://api.iconify.design/search?${new URLSearchParams({ query, limit: String(limit) }).toString()}`
    return requestUrl === canonical ? { query, limit } : undefined
  } catch {
    return undefined
  }
}

const providerRequestMatches = (value: unknown, request: IconifySearchRequest) => {
  if (!isRecord(value)) return false
  const keys = Object.keys(value)
  return keys.length === 2
    && keys.includes('query')
    && keys.includes('limit')
    && value.query === request.query
    && value.limit === String(request.limit)
}

const bindIconifySearchRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): BoundIconifySearchRequest => {
  if (!requestUrl) return { transportBound: false, invalidReason: 'The displayed Iconify request URL was unavailable, so search identity could not be verified.' }
  const request = parseRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported canonical Iconify /search request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET Iconify search request.' }
  }
  const executed = parseRequest(executedRequest.url)
  if (!executed || executed.query !== request.query || executed.limit !== request.limit) {
    return { request, transportBound: false, invalidReason: 'The displayed Iconify request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const requestAttrs = (request: IconifySearchRequest, transportBound: boolean) => ({
  'data-request-bound': transportBound ? 'true' : 'false',
  'data-request-contract': REQUEST_CONTRACT,
  'data-requested-query': request.query,
  'data-requested-limit': request.limit,
})

export function IconifySearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const binding = bindIconifySearchRequest(requestUrl, executedRequest)
  if (binding.invalidReason) return <div className="domain-card domain-empty" data-domain-card="icon-catalog" data-result-state="invalid" data-request-bound="false" data-request-contract={REQUEST_CONTRACT}><h3>Invalid Iconify search request context</h3><p>{binding.invalidReason}</p></div>
  const request = binding.request!
  if (!isRecord(data)) return <CardEmpty domain="icon-catalog" title="Invalid Iconify search response" detail="The Iconify search response was not the documented search-result object." state="invalid"/>
  const root = data
  if (!providerRequestMatches(root.request, request)) return <CardEmpty domain="icon-catalog" title="Invalid Iconify search response identity" detail="The provider request echo did not acknowledge the executed Iconify query and result limit." state="invalid"/>
  if (!Array.isArray(root.icons)) return <CardEmpty domain="icon-catalog" title="Invalid Iconify search response" detail="The Iconify search response did not contain the documented icons array." state="invalid"/>

  const providerLimit = positiveSafeInteger(root.limit)
  const providerStart = nonNegativeSafeInteger(root.start)
  const providerTotal = nonNegativeSafeInteger(root.total)
  const paginationValid = providerLimit === request.limit
    && providerStart === 0
    && providerTotal === root.icons.length
    && root.icons.length <= request.limit
  const collectionsValid = isRecord(root.collections)

  if (root.icons.length === 0) {
    const emptyValid = paginationValid && providerTotal === 0 && collectionsValid
    if (!emptyValid) return <CardEmpty domain="icon-catalog" title="Invalid Iconify search response" detail="The provider returned an empty icon list without coherent native-number pagination evidence." state="invalid"/>
    return binding.transportBound
      ? <div className="domain-card domain-empty iconify-search-preview" data-domain-card="icon-catalog" data-result-state="empty" {...requestAttrs(request, true)}><h3>No Iconify icons returned</h3><p>The provider returned an exact-request-bound zero-result icon search for “{request.query}”.</p></div>
      : <div className="domain-card domain-empty iconify-search-preview" data-domain-card="icon-catalog" data-result-state="partial" {...requestAttrs(request, false)}><h3>Iconify execution evidence unavailable</h3><p>The provider returned a coherent zero-result search for “{request.query}”, but semantic emptiness cannot be trusted until it is bound to the successful executed request.</p></div>
  }

  const icons = iconIds(root.icons)
  if (!icons.length) return <CardEmpty domain="icon-catalog" title="Invalid Iconify search response" detail="The Iconify response contained no usable prefixed icon identifiers." state="invalid"/>
  const invalidIconCount = root.icons.length - icons.length
  const collections = asRecord(root.collections)
  const prefixes = [...new Set(icons.map((icon) => icon.split(':', 1)[0]).filter(Boolean))]
  const missingCollectionMetadataCount = prefixes.filter((prefix) => !isRecord(collections[prefix])).length
  const malformedCollectionTotalCount = prefixes.reduce((count, prefix) => {
    const collection = asRecord(collections[prefix])
    return collection.total !== undefined && collection.total !== null && nonNegativeSafeInteger(collection.total) === undefined ? count + 1 : count
  }, 0)
  const partial = !binding.transportBound || invalidIconCount > 0 || !paginationValid || !collectionsValid || missingCollectionMetadataCount > 0 || malformedCollectionTotalCount > 0
  const visible = icons.slice(0, 12)
  const limitReached = providerLimit !== undefined && providerTotal === providerLimit
  const firstId = icons[0]

  return <div
    className="domain-card iconify-search-preview"
    data-domain-card="icon-catalog"
    data-result-state={partial ? 'partial' : 'ready'}
    data-request-contract-valid="true"
    {...requestAttrs(request, binding.transportBound)}
    data-provider-record-count={root.icons.length}
    data-valid-icon-count={icons.length}
    data-invalid-icon-count={invalidIconCount}
    data-row-count={icons.length}
    data-visible-count={visible.length}
    data-primary-icon-id={firstId}
    data-query={request.query}
    data-provider-limit={providerLimit ?? ''}
    data-provider-total={providerTotal ?? ''}
    data-start-index={providerStart ?? ''}
    data-pagination-contract-valid={String(paginationValid)}
    data-provider-request-echo-valid="true"
    data-missing-collection-metadata-count={missingCollectionMetadataCount}
    data-malformed-collection-total-count={malformedCollectionTotalCount}
    data-limit-reached={String(limitReached)}
  >
    <CardHeading
      eyebrow="Iconify · search catalogue"
      title={`${icons.length} icon identifier${icons.length === 1 ? '' : 's'} returned`}
      description="Icon IDs are paired with their icon-set author and licence metadata from the same request-bound search response."
    ><span className="domain-state">{partial ? 'Partial search response' : `${visible.length} shown`}</span></CardHeading>
    {partial && <p className="domain-note">{binding.transportBound ? 'Only provider-owned prefix:name identifiers are shown. Malformed identifiers, pagination/count drift, or incomplete collection metadata remain explicit instead of being coerced into trustworthy search evidence.' : 'The displayed Iconify search is canonical and the provider echo is coherent, but successful executed-request evidence is unavailable, so this result remains unbound and cannot be promoted to ready.'}</p>}
    <Facts items={[
      { label: 'Query', value: request.query },
      { label: 'Returned icons', value: icons.length.toLocaleString('en') },
      { label: 'Provider total', value: providerTotal?.toLocaleString('en') ?? 'Not supplied' },
      { label: 'Provider limit', value: providerLimit?.toLocaleString('en') ?? 'Not supplied' },
      { label: 'Start index', value: providerStart?.toLocaleString('en') ?? 'Not supplied' },
      { label: 'Icon sets represented', value: prefixes.length.toLocaleString('en') },
      { label: 'Pagination signal', value: paginationValid ? (limitReached ? 'Limit reached · more matches may exist' : 'Returned below limit') : 'Pagination evidence unavailable or malformed' },
    ]}/>
    <div className={`semantic-card-grid ${visible.length === 1 ? 'single' : ''}`} aria-label="Iconify search results" data-record-count={visible.length}>
      {visible.map((iconId, index) => {
        const separator = iconId.indexOf(':')
        const prefix = separator >= 0 ? iconId.slice(0, separator) : ''
        const iconName = separator >= 0 ? iconId.slice(separator + 1) : iconId
        const collection = asRecord(collections[prefix])
        const author = asRecord(collection.author)
        const license = asRecord(collection.license)
        const licenseSpdx = text(license.spdx)
        const licenseTitle = text(license.title)
        const licenseLabel = licenseSpdx ?? licenseTitle ?? 'Not supplied'
        return <article
          key={iconId}
          data-record-index={index + 1}
          data-icon-id={iconId}
          data-icon-prefix={prefix}
          data-icon-name={iconName}
          data-collection-name={text(collection.name) ?? ''}
          data-author={text(author.name) ?? ''}
          data-license-spdx={licenseSpdx ?? ''}
          data-license-title={licenseTitle ?? ''}
        >
          <header><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><small>{(text(collection.name) ?? prefix) || 'Icon set'}</small><h3>{iconId}</h3></div><em>{licenseLabel}</em></header>
          <dl>
            <div><dt>Icon name</dt><dd>{iconName}</dd></div>
            <div><dt>Set prefix</dt><dd>{prefix || 'Not supplied'}</dd></div>
            <div><dt>Set author</dt><dd>{stringValue(author.name)}</dd></div>
            <div><dt>Licence</dt><dd>{licenseTitle && licenseSpdx && licenseTitle !== licenseSpdx ? `${licenseTitle} · ${licenseSpdx}` : licenseLabel}</dd></div>
            <div><dt>Icons in set</dt><dd>{nonNegativeSafeInteger(collection.total)?.toLocaleString('en') ?? 'Not supplied'}</dd></div>
            <div><dt>Set version</dt><dd>{stringValue(collection.version)}</dd></div>
          </dl>
        </article>
      })}
    </div>
    {icons.length > visible.length && <p className="domain-note">Showing {visible.length} of {icons.length} identifiers returned by the provider. Raw JSON retains the complete search response.</p>}
    <p className="domain-note">Iconify search returns icon identifiers plus collection metadata; it does not return the SVG/icon body itself. Licence and attribution requirements belong to each icon set, so preserve the returned set metadata when selecting an icon.</p>
  </div>
}
