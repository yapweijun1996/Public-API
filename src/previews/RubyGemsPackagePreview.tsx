import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, text } from './cardPrimitives'

const requestPrefix = '/api/v1/gems/'
const requestSuffix = '.json'

type RubyGemsRequestIdentity = { gemName: string }

const requestedGem = (requestUrl?: string): RubyGemsRequestIdentity | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'rubygems.org' || url.search || url.hash) return undefined
    if (!url.pathname.startsWith(requestPrefix) || !url.pathname.endsWith(requestSuffix)) return undefined
    const encoded = url.pathname.slice(requestPrefix.length, -requestSuffix.length)
    if (!encoded || encoded.includes('/')) return undefined
    const gemName = decodeURIComponent(encoded)
    if (!gemName.trim() || gemName.includes('/')) return undefined
    return { gemName }
  } catch { return undefined }
}

const nonNegativeNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
const optionalTextMalformed = (root: Record<string, unknown>, key: string) => root[key] !== undefined && root[key] !== null && text(root[key]) === undefined
const optionalBooleanMalformed = (root: Record<string, unknown>, key: string) => root[key] !== undefined && root[key] !== null && typeof root[key] !== 'boolean'
const formatCount = (value?: number) => value === undefined ? 'Downloads unavailable' : value.toLocaleString('en')

const trustedLicenses = (value: unknown): { values: string[]; malformed: boolean } => {
  if (value === undefined || value === null) return { values: [], malformed: false }
  if (!Array.isArray(value)) return { values: [], malformed: true }
  const values = value.map(text).filter((item): item is string => Boolean(item))
  return { values, malformed: values.length !== value.length }
}

const invalid = (title: string, detail: string) => <CardEmpty domain="rubygems-package" title={title} detail={detail} state="invalid"/>

export function RubyGemsPackagePreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return invalid('Invalid RubyGems package response', 'RubyGems returned HTTP-success data without the documented gem metadata object.')
  }

  const root = asRecord(data)
  const providerGem = text(root.name)
  const providerVersion = text(root.version)
  if (!providerGem || !providerVersion) {
    return invalid('Invalid RubyGems package identity', 'The gem response is missing the provider-owned name or version identity required for a trustworthy package result.')
  }

  if (executedRequest && (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl))) {
    return invalid('Invalid RubyGems request identity', 'The executed request is not the documented bodyless GET for the direct RubyGems gem endpoint.')
  }
  const request = requestedGem(executedRequest?.url ?? requestUrl)
  if ((executedRequest || requestUrl) && !request) {
    return invalid('Invalid RubyGems request identity', 'The executed URL is not the supported direct RubyGems package lookup endpoint.')
  }

  const identityMatch = request ? request.gemName === providerGem : undefined
  if (identityMatch === false) {
    return invalid('RubyGems package identity mismatch', 'The provider returned a different gem identity than the executed direct package lookup, so gem facts are withheld.')
  }

  const downloads = nonNegativeNumber(root.downloads)
  const versionDownloads = nonNegativeNumber(root.version_downloads)
  const licenses = trustedLicenses(root.licenses)
  const platform = text(root.platform)
  const authors = text(root.authors)
  const info = text(root.info)
  const versionCreatedAt = text(root.version_created_at)
  const yanked = typeof root.yanked === 'boolean' ? root.yanked : undefined

  const malformedOptional = [
    'platform', 'authors', 'info', 'version_created_at', 'project_uri', 'gem_uri', 'homepage_uri',
  ].some((key) => optionalTextMalformed(root, key)) || optionalBooleanMalformed(root, 'yanked') || licenses.malformed
  const downloadContractValid = downloads !== undefined && versionDownloads !== undefined
  const state = request && identityMatch === true && downloadContractValid && !malformedOptional ? 'ready' : 'partial'

  return <div className="package-release-preview" data-domain-card="rubygems-package" data-ssot-reference="rubygems-package" data-result-state={state} data-requested-gem={request?.gemName} data-provider-gem={providerGem} data-identity-match={identityMatch === undefined ? undefined : String(identityMatch)} data-provider-version={providerVersion} data-total-downloads={downloads} data-version-downloads={versionDownloads} data-platform={platform} data-license-count={licenses.values.length} data-download-contract={String(downloadContractValid)}>
    <header>
      <div><small>Ruby package · RubyGems.org</small><h3>{providerGem}</h3><p>{info ?? 'Provider-owned package identity and release metadata from the RubyGems package endpoint.'}</p></div>
      <div className="package-release-hero"><span>Latest version</span><strong>{providerVersion}</strong><small>{platform ?? 'Platform unavailable'}{versionCreatedAt ? ` · released ${versionCreatedAt}` : ''}</small></div>
    </header>
    {state === 'partial' && <p className="domain-note">{!request ? 'The provider package identity is usable, but executed-request identity is unavailable, so this response cannot be fully bound to a requested gem.' : !downloadContractValid ? 'Package identity is trustworthy, but one or more download counters are missing or malformed. Only validated package facts are shown.' : 'Package identity is trustworthy, but one or more optional metadata fields are malformed. Only validated package facts are shown.'}</p>}
    <div className="package-channel-grid">
      <article><small>Total downloads</small><strong>{formatCount(downloads)}</strong></article>
      <article><small>Version downloads</small><strong>{formatCount(versionDownloads)}</strong></article>
      <article><small>License</small><strong>{licenses.values.join(', ') || 'License unavailable'}</strong></article>
      <article><small>Authors</small><strong>{authors ?? 'Authors unavailable'}</strong></article>
    </div>
    <div className="package-version-list"><div><strong>Trusted release facts</strong><span>{yanked === undefined ? 'Yank status unavailable' : yanked ? 'Yanked release' : 'Published release'}</span></div><div><span>{platform ?? 'Platform unavailable'}</span><span>{versionCreatedAt ?? 'Release date unavailable'}</span></div></div>
  </div>
}
