import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { isRecord, nonNegativeInteger, trimmedText as text } from './semanticValidation'

const SEARCH_PATH = '/v1/module/_search'

type MetaCpanRequest = { moduleName: string; size: number }
type MetaCpanHit = {
  id: string
  moduleName: string
  distribution: string
  release: string
  version: string
  author?: string
  date?: string
  incomplete: boolean
}

const canonicalQuery = (moduleName: string) => `module.name:"${moduleName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" AND status:latest`

const decodeModuleQuery = (query: string): string | undefined => {
  const prefix = 'module.name:"'
  const suffix = '" AND status:latest'
  if (!query.startsWith(prefix) || !query.endsWith(suffix)) return undefined
  const encoded = query.slice(prefix.length, -suffix.length)
  let decoded = ''
  for (let index = 0; index < encoded.length; index += 1) {
    const character = encoded[index]
    if (character !== '\\') { decoded += character; continue }
    const next = encoded[index + 1]
    if (next !== '\\' && next !== '"') return undefined
    decoded += next
    index += 1
  }
  if (!decoded || decoded !== decoded.trim()) return undefined
  return canonicalQuery(decoded) === query ? decoded : undefined
}

const requestedSearch = (executedRequest?: ExecutedRequestContext): MetaCpanRequest | undefined => {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  const requestUrl = executedRequest.url
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'fastapi.metacpan.org' || url.pathname !== SEARCH_PATH || url.hash) return undefined
    const keys = [...url.searchParams.keys()]
    if (keys.length !== 2 || url.searchParams.getAll('q').length !== 1 || url.searchParams.getAll('size').length !== 1 || keys.some((key) => key !== 'q' && key !== 'size')) return undefined
    const moduleName = decodeModuleQuery(url.searchParams.get('q') ?? '')
    const sizeText = url.searchParams.get('size') ?? ''
    if (!moduleName || !/^\d+$/.test(sizeText)) return undefined
    const size = Number(sizeText)
    if (!Number.isInteger(size) || size < 1 || size > 20) return undefined
    return { moduleName, size }
  } catch { return undefined }
}

const trustedHit = (value: unknown, requestedModule?: string): MetaCpanHit | undefined => {
  if (!isRecord(value) || !isRecord(value._source)) return undefined
  const source = value._source
  const id = text(value._id) ?? text(source.id)
  const distribution = text(source.distribution)
  const release = text(source.release)
  const version = text(source.version)
  if (!id || source.status !== 'latest' || !distribution || !release || !version || !Array.isArray(source.module)) return undefined

  const moduleEntries = source.module.filter(isRecord)
  const moduleNames = [...new Set(moduleEntries.map((entry) => text(entry.name)).filter((name): name is string => Boolean(name)))]
  const documentation = text(source.documentation)
  const moduleName = requestedModule
    ? moduleNames.find((name) => name === requestedModule)
    : documentation && moduleNames.includes(documentation)
      ? documentation
      : moduleNames.length === 1 ? moduleNames[0] : undefined
  if (!moduleName) return undefined

  const authorRaw = source.author
  const dateRaw = source.date
  const author = text(authorRaw)
  const date = text(dateRaw)
  const incomplete = moduleEntries.length !== source.module.length
    || moduleNames.length !== 1
    || (authorRaw !== undefined && authorRaw !== null && !author)
    || (dateRaw !== undefined && dateRaw !== null && !date)
  return { id, moduleName, distribution, release, version, author, date, incomplete }
}

const invalid = (title: string, detail: string) => <CardEmpty domain="metacpan-module-search" title={title} detail={detail} state="invalid"/>

export function MetaCpanModulePreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  if (!isRecord(data) || !isRecord(data.hits) || !Array.isArray(data.hits.hits)) {
    return invalid('Invalid MetaCPAN search response', 'MetaCPAN returned HTTP-success data without the documented search hits envelope.')
  }

  const request = requestedSearch(executedRequest)
  if (executedRequest && !request) {
    return invalid('Invalid MetaCPAN request identity', 'The executed URL is not the supported exact module-name search against the latest indexed release.')
  }

  const providerHits = data.hits.hits
  const providerTotal = nonNegativeInteger(data.hits.total)
  const timedOut = typeof data.timed_out === 'boolean' ? data.timed_out : undefined
  const countContractValid = providerTotal !== undefined && providerTotal >= providerHits.length && (!request || providerHits.length <= request.size)

  if (providerHits.length === 0) {
    if (request && providerTotal === 0 && timedOut === false) {
      return <div className="domain-card domain-empty" data-domain-card="metacpan-module-search" data-ssot-reference="metacpan-module-search" data-result-state="empty" data-requested-module={request.moduleName} data-request-size={request.size} data-provider-total="0" data-provider-hit-count="0" data-valid-hit-count="0" data-invalid-hit-count="0" data-incomplete-hit-count="0" data-query-bound="true" data-provider-timed-out="false" data-count-contract="true"><h3>No current CPAN module match</h3><p>MetaCPAN returned a valid zero-result latest-release search for {request.moduleName}.</p></div>
    }
    return invalid('Invalid MetaCPAN empty search response', 'The provider returned no hits without a trustworthy request-bound zero-result search contract.')
  }

  const trusted = providerHits.map((hit) => trustedHit(hit, request?.moduleName)).filter((hit): hit is MetaCpanHit => Boolean(hit))
  const invalidHitCount = providerHits.length - trusted.length
  if (!trusted.length) return invalid('MetaCPAN module identity mismatch', 'None of the returned search hits can be bound to the requested latest CPAN module identity, so release facts are withheld.')

  const seenIds = new Set<string>()
  let duplicateIdCount = 0
  const uniqueTrusted = trusted.filter((hit) => {
    if (seenIds.has(hit.id)) { duplicateIdCount += 1; return false }
    seenIds.add(hit.id)
    return true
  })
  if (!uniqueTrusted.length) return invalid('Invalid MetaCPAN module results', 'The provider returned no unique trustworthy module records.')

  const incompleteHitCount = uniqueTrusted.filter((hit) => hit.incomplete).length
  const hiddenHitCount = invalidHitCount + duplicateIdCount
  const state = request && timedOut === false && countContractValid && hiddenHitCount === 0 && incompleteHitCount === 0 ? 'ready' : 'partial'
  const primary = uniqueTrusted[0]
  const partialReason = !request
    ? 'The provider records are internally identifiable, but executed-request identity is unavailable, so they cannot be fully bound to a module lookup.'
    : timedOut !== false
      ? 'MetaCPAN did not confirm a complete non-timeout search. Only validated provider records are shown.'
      : !countContractValid
        ? 'Provider result-count metadata is missing or inconsistent. Only validated module records are shown.'
        : hiddenHitCount > 0
          ? `${hiddenHitCount} malformed, mismatched, or duplicate provider hit${hiddenHitCount === 1 ? ' was' : 's were'} hidden.`
          : 'One or more optional provider fields are malformed. Only validated module identity and release facts are shown.'

  return <div className="package-release-preview" data-domain-card="metacpan-module-search" data-ssot-reference="metacpan-module-search" data-result-state={state} data-requested-module={request?.moduleName} data-request-size={request?.size} data-provider-total={providerTotal} data-provider-hit-count={providerHits.length} data-valid-hit-count={uniqueTrusted.length} data-invalid-hit-count={hiddenHitCount} data-incomplete-hit-count={incompleteHitCount} data-query-bound={request ? 'true' : 'false'} data-provider-timed-out={timedOut === undefined ? undefined : String(timedOut)} data-count-contract={String(countContractValid)} data-primary-module={primary.moduleName} data-primary-distribution={primary.distribution} data-primary-release={primary.release} data-primary-version={primary.version}>
    <header>
      <div><small>Perl module · MetaCPAN</small><h3>{request?.moduleName ?? primary.moduleName}</h3><p>Exact module-name results restricted to MetaCPAN's latest indexed CPAN release records.</p></div>
      <div className="package-release-hero"><span>Trusted latest records</span><strong>{uniqueTrusted.length.toLocaleString('en')}</strong><small>{providerTotal === undefined ? 'Provider total unavailable' : `${providerTotal.toLocaleString('en')} provider match${providerTotal === 1 ? '' : 'es'}`}</small></div>
    </header>
    {state === 'partial' && <p className="domain-note">{partialReason}</p>}
    <div className="package-channel-grid">
      <article><small>Module</small><strong>{primary.moduleName}</strong></article>
      <article><small>Distribution</small><strong>{primary.distribution}</strong></article>
      <article><small>Version</small><strong>{primary.version}</strong></article>
      <article><small>Release</small><strong>{primary.release}</strong></article>
      <article><small>Author</small><strong>{primary.author ?? 'Author unavailable'}</strong></article>
      <article><small>Indexed date</small><strong>{primary.date ?? 'Date unavailable'}</strong></article>
    </div>
    <div className="package-version-list"><div><strong>Validated latest-release hits</strong><span>{uniqueTrusted.length.toLocaleString('en')} shown · {hiddenHitCount.toLocaleString('en')} invalid hidden</span></div><div>{uniqueTrusted.slice(0, 20).map((hit) => <code key={hit.id}>{hit.moduleName} · {hit.release} · {hit.version}</code>)}</div></div>
  </div>
}
