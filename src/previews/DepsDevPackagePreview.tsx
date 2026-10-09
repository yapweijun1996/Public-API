import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { isRecord, trimmedText as requiredText } from './semanticValidation'

type ProviderSystem = 'GO' | 'RUBYGEMS' | 'NPM' | 'CARGO' | 'MAVEN' | 'PYPI' | 'NUGET'
type DepsDevRequest = { requestedSystem: string; providerSystem: ProviderSystem; packageName: string }
type TrustedVersion = { version: string; publishedAt?: string; isDefault: boolean; isDeprecated: boolean; incomplete: boolean }

const SYSTEMS: Record<string, ProviderSystem> = { go: 'GO', rubygems: 'RUBYGEMS', npm: 'NPM', cargo: 'CARGO', maven: 'MAVEN', pypi: 'PYPI', nuget: 'NUGET' }
const normalizePyPiName = (value: string) => value.toLowerCase().replace(/[-_.]+/g, '-')
const packageIdentityMatches = (requested: string, provider: string, system: ProviderSystem) => system === 'PYPI' ? normalizePyPiName(requested) === normalizePyPiName(provider) : system === 'NUGET' ? requested.toLowerCase() === provider.toLowerCase() : requested === provider

const requestedPackage = (requestUrl?: string): DepsDevRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.origin !== 'https://api.deps.dev' || url.search || url.hash || url.username || url.password) return undefined
    const match = /^\/v3\/systems\/([a-z0-9-]+)\/packages\/([^/]+)$/.exec(url.pathname)
    if (!match) return undefined
    const requestedSystem = decodeURIComponent(match[1]).toLowerCase()
    const providerSystem = SYSTEMS[requestedSystem]
    if (!providerSystem) return undefined
    const packageName = decodeURIComponent(match[2])
    if (!packageName || packageName !== packageName.trim()) return undefined
    return { requestedSystem, providerSystem, packageName }
  } catch { return undefined }
}

const parseVersion = (value: unknown, providerSystem: ProviderSystem, providerPackage: string): TrustedVersion | undefined => {
  if (!isRecord(value) || !isRecord(value.versionKey)) return undefined
  const system = requiredText(value.versionKey.system)
  const packageName = requiredText(value.versionKey.name)
  const version = requiredText(value.versionKey.version)
  if (system !== providerSystem || packageName !== providerPackage || !version) return undefined
  if (typeof value.isDefault !== 'boolean' || typeof value.isDeprecated !== 'boolean') return undefined
  let publishedAt: string | undefined
  let incomplete = false
  if (value.publishedAt !== undefined && value.publishedAt !== null) {
    if (typeof value.publishedAt === 'string' && value.publishedAt.trim() && Number.isFinite(Date.parse(value.publishedAt.trim()))) publishedAt = value.publishedAt.trim()
    else incomplete = true
  }
  if (value.deprecatedReason !== undefined && value.deprecatedReason !== null && typeof value.deprecatedReason !== 'string') incomplete = true
  return { version, publishedAt, isDefault: value.isDefault, isDeprecated: value.isDeprecated, incomplete }
}

const invalid = (title: string, detail: string) => <CardEmpty domain="deps-dev-package" title={title} detail={detail} state="invalid"/>

export function DepsDevPackagePreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!isRecord(data) || !isRecord(data.packageKey) || !Array.isArray(data.versions)) return invalid('Invalid deps.dev package response', 'deps.dev returned HTTP-success data without the documented packageKey and versions array.')
  const providerSystemText = requiredText(data.packageKey.system)
  const providerPackage = requiredText(data.packageKey.name)
  const providerSystem = providerSystemText && Object.values(SYSTEMS).includes(providerSystemText as ProviderSystem) ? providerSystemText as ProviderSystem : undefined
  if (!providerSystem || !providerPackage) return invalid('Invalid deps.dev package identity', 'The response is missing a trustworthy provider-owned package system or canonical package name.')

  const displayedRequest = requestedPackage(requestUrl)
  if (requestUrl && !displayedRequest) return invalid('Invalid deps.dev request identity', 'The displayed URL is not the supported deps.dev v3 direct package endpoint.')

  let request = displayedRequest
  let requestBound = false
  if (executedRequest) {
    if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) {
      return invalid('Invalid deps.dev request identity', 'The executed request is not the documented bodyless GET for the deps.dev v3 GetPackage endpoint.')
    }
    const executedIdentity = requestedPackage(executedRequest.url)
    if (!executedIdentity) return invalid('Invalid deps.dev request identity', 'The executed URL is not the supported deps.dev v3 direct package endpoint.')
    request = executedIdentity
    requestBound = true
  }
  const systemMatch = request ? request.providerSystem === providerSystem : undefined
  const packageMatch = request ? systemMatch === true && packageIdentityMatches(request.packageName, providerPackage, providerSystem) : undefined
  if (systemMatch === false || packageMatch === false) return invalid('deps.dev package identity mismatch', 'The provider package identity does not match the executed package lookup under the documented ecosystem canonicalization rules, so package facts are withheld.')

  const providerVersionCount = data.versions.length
  const trustedVersions: TrustedVersion[] = []
  const seen = new Set<string>()
  let invalidVersionCount = 0
  let incompleteVersionCount = 0
  for (const candidate of data.versions) {
    const parsed = parseVersion(candidate, providerSystem, providerPackage)
    if (!parsed || seen.has(parsed.version)) { invalidVersionCount += 1; continue }
    seen.add(parsed.version)
    trustedVersions.push(parsed)
    if (parsed.incomplete) incompleteVersionCount += 1
  }

  if (providerVersionCount === 0) {
    const state = requestBound && request && systemMatch === true && packageMatch === true ? 'empty' : 'partial'
    return <div className="domain-card domain-empty" data-domain-card="deps-dev-package" data-ssot-reference="deps-dev-get-package" data-result-state={state} data-request-bound={String(requestBound)} data-request-contract="exact-deps-dev-get-package-v2" data-requested-system={request?.requestedSystem} data-provider-system={providerSystem} data-requested-package={request?.packageName} data-provider-package={providerPackage} data-system-match={systemMatch === undefined ? undefined : String(systemMatch)} data-package-match={packageMatch === undefined ? undefined : String(packageMatch)} data-provider-version-count="0" data-valid-version-count="0" data-invalid-version-count="0"><h3>No published package versions</h3><p>{request ? `deps.dev returned a valid package identity for ${providerPackage}, but no published versions are currently listed.` : 'The package identity is valid, but executed-request identity is unavailable and no versions are listed.'}</p></div>
  }
  if (!trustedVersions.length) return invalid('Invalid deps.dev package versions', 'None of the returned version records match the provider-owned package identity and documented version schema.')

  const defaultVersions = trustedVersions.filter((entry) => entry.isDefault)
  const defaultContractValid = defaultVersions.length <= 1
  const defaultVersion = defaultContractValid ? defaultVersions[0] : undefined
  const deprecatedCount = trustedVersions.filter((entry) => entry.isDeprecated).length
  const mostRecentlyPublished = trustedVersions.filter((entry): entry is TrustedVersion & { publishedAt: string } => Boolean(entry.publishedAt)).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0]
  const state = requestBound && request && systemMatch === true && packageMatch === true && invalidVersionCount === 0 && incompleteVersionCount === 0 && defaultContractValid ? 'ready' : 'partial'
  const canonicalized = request ? request.packageName !== providerPackage : undefined
  const sample = [defaultVersion, mostRecentlyPublished, ...trustedVersions].filter((entry): entry is TrustedVersion => Boolean(entry)).filter((entry, index, all) => all.findIndex((candidate) => candidate.version === entry.version) === index).slice(0, 18)
  const partialReason = !requestBound ? 'The provider package identity is internally coherent, but exact execution evidence is unavailable, so the result cannot be fully bound to a package lookup.' : !defaultContractValid ? 'deps.dev marked more than one returned version as the default version. Version identities remain visible, but the conflicting default claim is withheld.' : invalidVersionCount > 0 ? `${invalidVersionCount.toLocaleString('en')} malformed, duplicate, or identity-mismatched version record${invalidVersionCount === 1 ? ' was' : 's were'} hidden.` : 'One or more optional publication/deprecation fields are malformed. Package and version identities remain trustworthy, but untrusted optional values are withheld.'

  return <div className="package-release-preview" data-domain-card="deps-dev-package" data-ssot-reference="deps-dev-get-package" data-result-state={state} data-request-bound={String(requestBound)} data-request-contract="exact-deps-dev-get-package-v2" data-requested-system={request?.requestedSystem} data-provider-system={providerSystem} data-system-match={systemMatch === undefined ? undefined : String(systemMatch)} data-requested-package={request?.packageName} data-provider-package={providerPackage} data-package-match={packageMatch === undefined ? undefined : String(packageMatch)} data-package-canonicalized={canonicalized === undefined ? undefined : String(canonicalized)} data-provider-version-count={providerVersionCount} data-valid-version-count={trustedVersions.length} data-invalid-version-count={invalidVersionCount} data-incomplete-version-count={incompleteVersionCount} data-default-version-count={defaultVersions.length} data-default-contract={String(defaultContractValid)} data-default-version={defaultVersion?.version} data-deprecated-version-count={deprecatedCount} data-most-recently-published-version={mostRecentlyPublished?.version} data-most-recently-published-at={mostRecentlyPublished?.publishedAt}>
    <header><div><small>{providerSystem} package · deps.dev</small><h3>{providerPackage}</h3><p>{request && canonicalized ? `Requested ${request.packageName}; deps.dev returned the documented canonical package identity.` : 'Provider-owned package identity and published-version metadata from deps.dev GetPackage.'}</p></div><div className="package-release-hero"><span>Default version</span><strong>{defaultVersion?.version ?? 'Not identified'}</strong><small>{defaultVersion?.publishedAt ? `Published ${new Date(defaultVersion.publishedAt).toISOString().slice(0, 10)}` : defaultVersion ? 'Publish date unavailable' : 'Provider does not identify one default version'}</small></div></header>
    {state === 'partial' && <p className="domain-note">{partialReason}</p>}
    <div className="package-channel-grid"><article><small>Published versions</small><strong>{trustedVersions.length.toLocaleString('en')}</strong></article><article><small>Deprecated versions</small><strong>{deprecatedCount.toLocaleString('en')}</strong></article><article><small>Most recently published</small><strong>{mostRecentlyPublished?.version ?? 'Unavailable'}</strong></article><article><small>Request identity</small><strong>{requestBound && request ? canonicalized ? 'Canonicalized match' : 'Exact match' : 'Unbound'}</strong></article></div>
    <div className="package-version-list"><div><strong>Validated version sample</strong><span>{sample.length.toLocaleString('en')} shown · {invalidVersionCount.toLocaleString('en')} invalid hidden · {incompleteVersionCount.toLocaleString('en')} incomplete</span></div><div>{sample.map((entry) => <code key={entry.version}>{entry.version}{entry.isDeprecated ? ' · deprecated' : ''}</code>)}</div></div>
  </div>
}
