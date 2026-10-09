import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { isRecord, optionalTrimmedText as optionalText, trimmedText as requiredText } from './semanticValidation'

const REQUEST_PREFIX = '/api/packages/'

type PubRequest = { packageName: string }
type ParsedVersion = {
  version: string
  archiveUrl: string
  published?: string
  retracted?: boolean
  incomplete: boolean
}

const validHttpsUrl = (value: string): boolean => {
  try { return new URL(value).protocol === 'https:' } catch { return false }
}
const validPublishedAt = (value: string): boolean => Number.isFinite(Date.parse(value))

const requestedPackage = (requestUrl?: string): PubRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'pub.dev' || url.search || url.hash) return undefined
    if (!url.pathname.startsWith(REQUEST_PREFIX)) return undefined
    const encoded = url.pathname.slice(REQUEST_PREFIX.length)
    if (!encoded || encoded.includes('/')) return undefined
    const packageName = decodeURIComponent(encoded)
    if (!packageName.trim() || packageName.includes('/')) return undefined
    return { packageName }
  } catch { return undefined }
}

const parseVersion = (value: unknown, providerPackage: string): ParsedVersion | undefined => {
  if (!isRecord(value) || !isRecord(value.pubspec)) return undefined
  const version = requiredText(value.version)
  const pubspecName = requiredText(value.pubspec.name)
  const pubspecVersion = requiredText(value.pubspec.version)
  const archiveUrl = requiredText(value.archive_url)
  if (!version || pubspecName !== providerPackage || pubspecVersion !== version || !archiveUrl || !validHttpsUrl(archiveUrl)) return undefined

  let incomplete = false
  if (value.archive_sha256 !== undefined && value.archive_sha256 !== null) {
    if (typeof value.archive_sha256 !== 'string' || !/^[0-9a-fA-F]{64}$/.test(value.archive_sha256)) incomplete = true
  }
  let published: string | undefined
  if (value.published !== undefined && value.published !== null) {
    published = requiredText(value.published)
    if (!published || !validPublishedAt(published)) { published = undefined; incomplete = true }
  }
  let retracted: boolean | undefined
  if (value.retracted !== undefined && value.retracted !== null) {
    if (typeof value.retracted === 'boolean') retracted = value.retracted
    else incomplete = true
  }
  return { version, archiveUrl, published, retracted, incomplete }
}

const parseStringArray = (value: unknown): { values: string[]; malformed: boolean } => {
  if (value === undefined || value === null) return { values: [], malformed: false }
  if (!Array.isArray(value)) return { values: [], malformed: true }
  const values = value.map(requiredText).filter((item): item is string => Boolean(item))
  return { values, malformed: values.length !== value.length }
}

const invalid = (title: string, detail: string) => <CardEmpty domain="pubdev-package" title={title} detail={detail} state="invalid"/>

export function PubDevPackagePreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!isRecord(data) || !isRecord(data.latest) || !Array.isArray(data.versions)) {
    return invalid('Invalid pub.dev package response', 'pub.dev returned HTTP-success data without the documented Hosted Pub package, latest-release, and versions envelope.')
  }

  const latestRoot = data.latest as Record<string, unknown>
  const providerPackage = requiredText(data.name)
  if (!providerPackage) {
    return invalid('Invalid pub.dev package identity', 'The package response is missing a trustworthy provider-owned package name.')
  }

  const displayedRequest = requestedPackage(requestUrl)
  if (requestUrl && !displayedRequest) {
    return invalid('Invalid pub.dev request identity', 'The displayed URL is not the supported direct pub.dev package endpoint.')
  }
  let request = displayedRequest
  let requestBound = false
  if (executedRequest) {
    if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) {
      return invalid('Invalid pub.dev request identity', 'The executed request is not the documented bodyless GET for the direct pub.dev package endpoint.')
    }
    const executedIdentity = requestedPackage(executedRequest.url)
    if (!executedIdentity) return invalid('Invalid pub.dev request identity', 'The executed URL is not the supported direct pub.dev package endpoint.')
    request = executedIdentity
    requestBound = true
  }
  const identityMatch = request ? request.packageName === providerPackage : undefined
  if (identityMatch === false) {
    return invalid('pub.dev package identity mismatch', 'The provider returned a different package identity than the executed direct package lookup, so package facts are withheld.')
  }

  const latest = parseVersion(latestRoot, providerPackage)
  if (!latest) {
    return invalid('Invalid pub.dev latest release', 'The provider latest release does not contain a coherent package name, version, pubspec identity, and secure archive URL.')
  }

  const trustedVersions: ParsedVersion[] = []
  const seenVersions = new Set<string>()
  let invalidVersionCount = 0
  let incompleteVersionCount = 0
  for (const candidate of data.versions) {
    const parsed = parseVersion(candidate, providerPackage)
    if (!parsed || seenVersions.has(parsed.version)) { invalidVersionCount += 1; continue }
    seenVersions.add(parsed.version)
    trustedVersions.push(parsed)
    if (parsed.incomplete) incompleteVersionCount += 1
  }
  if (!trustedVersions.length) {
    return invalid('Invalid pub.dev version history', 'The package response contains no trustworthy Hosted Pub version records.')
  }

  const latestPresent = seenVersions.has(latest.version)
  if (!latestPresent) {
    return invalid('pub.dev latest-version relationship mismatch', 'The provider latest release is not represented in the trustworthy package version history, so release facts are withheld.')
  }

  const latestPubspec = latestRoot.pubspec as Record<string, unknown>
  const description = optionalText(latestPubspec.description)
  const repository = optionalText(latestPubspec.repository)
  const homepage = optionalText(latestPubspec.homepage)
  const topics = parseStringArray(latestPubspec.topics)
  const environment = latestPubspec.environment
  let sdkConstraint: string | undefined
  let environmentMalformed = false
  if (environment !== undefined && environment !== null) {
    if (!isRecord(environment)) environmentMalformed = true
    else {
      const sdk = optionalText(environment.sdk)
      sdkConstraint = sdk.value
      environmentMalformed = sdk.malformed
    }
  }

  let discontinued = false
  let discontinuationMalformed = false
  if (data.isDiscontinued !== undefined && data.isDiscontinued !== null) {
    if (typeof data.isDiscontinued === 'boolean') discontinued = data.isDiscontinued
    else discontinuationMalformed = true
  }
  const replacedBy = optionalText(data.replacedBy)
  if (replacedBy.value && !discontinued) discontinuationMalformed = true

  const optionalMalformed = description.malformed || repository.malformed || homepage.malformed || topics.malformed || environmentMalformed || replacedBy.malformed || discontinuationMalformed
  const state = requestBound && request && identityMatch === true && invalidVersionCount === 0 && incompleteVersionCount === 0 && !latest.incomplete && !optionalMalformed ? 'ready' : 'partial'
  const providerVersionCount = data.versions.length
  const statusText = discontinued ? replacedBy.value ? `Discontinued · replaced by ${replacedBy.value}` : 'Discontinued' : 'Active package'
  const partialReason = !requestBound
    ? 'The provider package identity is usable, but executed-request identity is unavailable, so this response cannot be fully bound to a requested package.'
    : invalidVersionCount > 0 || incompleteVersionCount > 0
      ? 'Package identity and latest release are trustworthy, but some version-history rows are malformed or incomplete. Only validated version facts are shown.'
      : latest.incomplete || optionalMalformed
        ? 'Package identity is trustworthy, but one or more optional package metadata fields are malformed. Only validated package facts are shown.'
        : 'Package metadata is usable, but the response is not fully verified.'

  return <div className="package-release-preview" data-domain-card="pubdev-package" data-ssot-reference="exact-pub-dev-hosted-package-v2" data-result-state={state} data-request-bound={String(requestBound)} data-requested-package={request?.packageName} data-provider-package={providerPackage} data-identity-match={identityMatch === undefined ? undefined : String(identityMatch)} data-provider-version-count={providerVersionCount} data-valid-version-count={trustedVersions.length} data-invalid-version-count={invalidVersionCount} data-incomplete-version-count={incompleteVersionCount} data-latest-version={latest.version} data-latest-present-in-versions={String(latestPresent)} data-latest-published={latest.published} data-latest-retracted={latest.retracted === undefined ? undefined : String(latest.retracted)} data-sdk-constraint={sdkConstraint} data-discontinued={String(discontinued)} data-replaced-by={replacedBy.value}>
    <header>
      <div><small>Dart / Flutter package · pub.dev</small><h3>{providerPackage}</h3><p>{description.value ?? 'Provider-owned package identity, latest release, SDK context, and validated version history from pub.dev.'}</p></div>
      <div className="package-release-hero"><span>Latest version</span><strong>{latest.version}</strong><small>{latest.published ? `Published ${latest.published}` : statusText}</small></div>
    </header>
    {state === 'partial' && <p className="domain-note">{partialReason}</p>}
    <div className="package-channel-grid">
      <article><small>Status</small><strong>{statusText}</strong></article>
      <article><small>Dart SDK</small><strong>{sdkConstraint ?? 'SDK constraint unavailable'}</strong></article>
      <article><small>Repository</small><strong>{repository.value ?? homepage.value ?? 'Repository unavailable'}</strong></article>
      <article><small>Trusted versions</small><strong>{trustedVersions.length.toLocaleString('en')} / {providerVersionCount.toLocaleString('en')}</strong></article>
    </div>
    {topics.values.length > 0 && <div className="package-version-list"><div><strong>Topics</strong><span>{topics.values.length.toLocaleString('en')} provider topics</span></div><div>{topics.values.map((topic) => <code key={topic}>{topic}</code>)}</div></div>}
    <div className="package-version-list"><div><strong>Validated version sample</strong><span>Provider order · {invalidVersionCount.toLocaleString('en')} invalid hidden · {incompleteVersionCount.toLocaleString('en')} incomplete</span></div><div>{trustedVersions.slice(0, 18).map((entry) => <code key={entry.version}>{entry.version}</code>)}</div></div>
  </div>
}
