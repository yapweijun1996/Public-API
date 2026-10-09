import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, text } from './cardPrimitives'

const absoluteHttpUrl = (value: unknown) => {
  const candidate = text(value)
  if (!candidate) return undefined
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' || url.protocol === 'http:' ? candidate : undefined
  } catch { return undefined }
}

const canonicalPackage = (value: string) => value.trim().toLowerCase()

type JsDelivrRequestIdentity = { packageName: string }

const requestedPackage = (requestUrl?: string): JsDelivrRequestIdentity | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.origin !== 'https://data.jsdelivr.com' || url.search || url.hash || url.username || url.password) return undefined
    const prefix = '/v1/packages/npm/'
    if (!url.pathname.startsWith(prefix)) return undefined
    const encoded = url.pathname.slice(prefix.length)
    if (!encoded) return undefined
    const packageName = decodeURIComponent(encoded)
    const scoped = /^@[^/]+\/[^/]+$/.test(packageName)
    const unscoped = /^[^/@]+$/.test(packageName)
    if (!scoped && !unscoped) return undefined
    return { packageName }
  } catch { return undefined }
}

type TrustedVersion = {
  version: string
  self: string
  stats: string
  entrypoints?: string
}

type TrustedTag = { name: string; version: string }

const invalid = (title: string, detail: string) => <CardEmpty domain="jsdelivr-package" title={title} detail={detail} state="invalid"/>

const tagLabel = (name: string) => ({ latest: 'Latest stable', rc: 'Release candidate', next: 'Next', canary: 'Canary', backport: 'Backport', experimental: 'Experimental', beta: 'Beta' }[name] ?? name.replaceAll('-', ' '))

export function JsDelivrPackagePreview({ data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return invalid('Invalid jsDelivr package response', 'jsDelivr returned HTTP-success data without the documented package metadata object.')
  }

  const root = asRecord(data)
  const providerType = text(root.type)
  const providerName = text(root.name)
  if (providerType !== 'npm' || !providerName) {
    return invalid('Invalid jsDelivr package identity', 'The current package metadata API requires provider-owned type and name identity fields.')
  }

  const displayedRequest = requestedPackage(requestUrl)
  if (requestUrl && !displayedRequest) {
    return invalid('Invalid jsDelivr request identity', 'The displayed URL is not the supported current jsDelivr npm package-metadata endpoint.')
  }
  let request = displayedRequest
  let requestBound = false
  if (executedRequest) {
    if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) {
      return invalid('Invalid jsDelivr request identity', 'The executed request is not the documented bodyless GET for the jsDelivr npm package-metadata endpoint.')
    }
    const executedIdentity = requestedPackage(executedRequest.url)
    if (!executedIdentity) return invalid('Invalid jsDelivr request identity', 'The executed URL is not the supported current jsDelivr npm package-metadata endpoint.')
    request = executedIdentity
    requestBound = true
  }
  const identityMatch = request ? canonicalPackage(request.packageName) === canonicalPackage(providerName) : undefined
  if (identityMatch === false) {
    return invalid('jsDelivr package identity mismatch', 'The returned npm package name does not match the executed direct package lookup, so package facts are withheld.')
  }

  if (!Array.isArray(root.versions)) {
    return invalid('Invalid jsDelivr version envelope', 'The package metadata response does not contain the documented versions array.')
  }

  const trustedVersions: TrustedVersion[] = []
  let invalidVersionCount = 0
  const seenVersions = new Set<string>()
  for (const candidate of root.versions) {
    const versionRoot = asRecord(candidate)
    const version = text(versionRoot.version)
    const links = asRecord(versionRoot.links)
    const self = absoluteHttpUrl(links.self)
    const stats = absoluteHttpUrl(links.stats)
    const entrypoints = links.entrypoints === undefined ? undefined : absoluteHttpUrl(links.entrypoints)
    if (!version || !self || !stats || (links.entrypoints !== undefined && !entrypoints) || seenVersions.has(version)) {
      invalidVersionCount += 1
      continue
    }
    seenVersions.add(version)
    trustedVersions.push({ version, self, stats, entrypoints })
  }

  const tagsShapeValid = root.tags !== null && typeof root.tags === 'object' && !Array.isArray(root.tags)
  const tagRoot = tagsShapeValid ? asRecord(root.tags) : {}
  const versionSet = new Set(trustedVersions.map((entry) => entry.version))
  const trustedTags: TrustedTag[] = []
  let invalidTagCount = tagsShapeValid ? 0 : 1
  for (const [name, candidate] of Object.entries(tagRoot)) {
    const version = text(candidate)
    if (!version || !versionSet.has(version)) {
      invalidTagCount += 1
      continue
    }
    trustedTags.push({ name, version })
  }

  const packageLinks = asRecord(root.links)
  const packageStatsUrl = absoluteHttpUrl(packageLinks.stats)
  const providerVersionCount = root.versions.length
  const providerTagCount = tagsShapeValid ? Object.keys(tagRoot).length : 0

  if (providerVersionCount === 0) {
    if (tagsShapeValid && providerTagCount === 0 && packageStatsUrl) {
      const state = requestBound ? 'empty' : 'partial'
      return <div className="domain-card domain-empty" data-domain-card="jsdelivr-package" data-ssot-reference="exact-jsdelivr-npm-package-v2" data-result-state={state} data-request-bound={String(requestBound)} data-requested-package={request?.packageName} data-provider-package={providerName} data-provider-type={providerType} data-identity-match={identityMatch === undefined ? undefined : String(identityMatch)} data-provider-version-count="0" data-valid-version-count="0" data-invalid-version-count="0" data-provider-tag-count="0" data-valid-tag-count="0" data-invalid-tag-count="0"><h3>No published jsDelivr versions</h3><p>{requestBound ? 'The provider returned a coherent npm package identity with no published versions or dist-tags.' : 'The package response is coherently empty, but executed-request identity is unavailable.'}</p></div>
    }
    return invalid('Invalid jsDelivr package metadata', 'The package response contains no trustworthy published-version records.')
  }
  if (trustedVersions.length === 0) {
    return invalid('Invalid jsDelivr version metadata', 'None of the returned version entries satisfy the current jsDelivr package-metadata contract.')
  }

  const contextComplete = tagsShapeValid && Boolean(packageStatsUrl) && invalidVersionCount === 0 && invalidTagCount === 0
  const state = requestBound && request && identityMatch && contextComplete ? 'ready' : 'partial'
  const latest = trustedTags.find((tag) => tag.name === 'latest')?.version
  const heroVersion = latest ?? trustedVersions[0]?.version ?? '—'
  const channels = trustedTags.slice(0, 8)

  return <div className="package-release-preview" data-domain-card="jsdelivr-package" data-ssot-reference="exact-jsdelivr-npm-package-v2" data-result-state={state} data-request-bound={String(requestBound)} data-requested-package={request?.packageName} data-provider-package={providerName} data-provider-type={providerType} data-identity-match={identityMatch === undefined ? undefined : String(identityMatch)} data-provider-version-count={providerVersionCount} data-valid-version-count={trustedVersions.length} data-invalid-version-count={invalidVersionCount} data-provider-tag-count={providerTagCount} data-valid-tag-count={trustedTags.length} data-invalid-tag-count={invalidTagCount} data-trusted-latest={latest}>
    <header>
      <div><small>npm package · jsDelivr data API</small><h3>{providerName}</h3><p>Provider-owned package identity, release channels, and published versions from the current jsDelivr package metadata API.</p></div>
      <div className="package-release-hero"><span>{latest ? 'Latest stable' : 'Newest trusted version'}</span><strong>{heroVersion}</strong><small>{trustedVersions.length.toLocaleString('en')} trusted of {providerVersionCount.toLocaleString('en')} published versions</small></div>
    </header>
    {state === 'partial' && <p className="domain-note">Package identity is trustworthy, but {requestBound ? 'one or more package metadata fields are missing or malformed' : 'executed-request identity is unavailable, so this response cannot be bound to a specific executed lookup'}. Only validated versions and tags are shown.</p>}
    <div className="package-channel-grid">{channels.map(({ name, version }) => <article key={name}><small>{tagLabel(name)}</small><strong>{version}</strong></article>)}</div>
    <div className="package-version-list"><div><strong>Recent trusted versions</strong><span>{Math.min(trustedVersions.length, 12)} shown · {invalidVersionCount} invalid hidden</span></div><div>{trustedVersions.slice(0, 12).map(({ version }) => <code key={version}>{version}</code>)}</div></div>
  </div>
}
