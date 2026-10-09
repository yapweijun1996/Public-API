import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, text } from './cardPrimitives'

const requestPrefix = '/api/packages/'
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

type HexRelease = { version: string }

type HexRequestIdentity = { packageName: string }

const requestedPackage = (requestUrl?: string): HexRequestIdentity | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'hex.pm' || url.search || url.hash) return undefined
    if (!url.pathname.startsWith(requestPrefix)) return undefined
    const encoded = url.pathname.slice(requestPrefix.length)
    if (!encoded || encoded.includes('/')) return undefined
    const packageName = decodeURIComponent(encoded)
    if (!packageName.trim() || packageName.includes('/')) return undefined
    return { packageName }
  } catch { return undefined }
}

const nonNegativeNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
const formatCount = (value?: number) => value === undefined ? 'Downloads unavailable' : value.toLocaleString('en')
const isRecordValue = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const optionalTextMalformed = (root: Record<string, unknown>, key: string) => root[key] !== undefined && root[key] !== null && text(root[key]) === undefined

const stringArray = (value: unknown): { values: string[]; malformed: boolean } => {
  if (value === undefined || value === null) return { values: [], malformed: false }
  if (!Array.isArray(value)) return { values: [], malformed: true }
  const values = value.map(text).filter((item): item is string => Boolean(item))
  return { values, malformed: values.length !== value.length }
}

const trustedOwners = (value: unknown): { values: string[]; malformed: boolean; providerCount?: number } => {
  if (value === undefined || value === null) return { values: [], malformed: false }
  if (!Array.isArray(value)) return { values: [], malformed: true }
  const values: string[] = []
  let malformed = false
  for (const item of value) {
    if (!isRecordValue(item)) { malformed = true; continue }
    const username = text(item.username)
    const url = text(item.url)
    if (!username || !url) { malformed = true; continue }
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'hex.pm' || !parsed.pathname.startsWith('/api/users/')) { malformed = true; continue }
    } catch { malformed = true; continue }
    values.push(username)
  }
  return { values, malformed, providerCount: value.length }
}

const trustedRelease = (value: unknown, packageName: string): HexRelease | undefined => {
  if (!isRecordValue(value)) return undefined
  const version = text(value.version)
  const releaseUrl = text(value.url)
  const insertedAt = text(value.inserted_at)
  if (!version || !semverPattern.test(version) || !releaseUrl || !insertedAt || typeof value.has_docs !== 'boolean') return undefined
  try {
    const url = new URL(releaseUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'hex.pm' || url.search || url.hash) return undefined
    const expectedPath = `/api/packages/${packageName}/releases/${version}`
    if (decodeURIComponent(url.pathname) !== expectedPath) return undefined
  } catch { return undefined }
  return { version }
}

const invalid = (title: string, detail: string) => <CardEmpty domain="hexpm-package" title={title} detail={detail} state="invalid"/>

export function HexPmPackagePreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!isRecordValue(data)) {
    return invalid('Invalid Hex.pm package response', 'Hex.pm returned HTTP-success data without the documented package metadata object.')
  }

  const root = asRecord(data)
  const providerPackage = text(root.name)
  const repository = text(root.repository)
  const latestVersion = text(root.latest_version)
  const providerUrl = text(root.url)
  if (!providerPackage || repository !== 'hexpm' || !latestVersion || !semverPattern.test(latestVersion) || !providerUrl) {
    return invalid('Invalid Hex.pm package identity', 'The package response is missing a trustworthy public-repository name, package URL, or latest-version identity.')
  }

  const providerUrlIdentity = requestedPackage(providerUrl)
  if (!providerUrlIdentity || providerUrlIdentity.packageName !== providerPackage) {
    return invalid('Hex.pm provider identity mismatch', 'The provider-owned package name contradicts its own package URL, so package facts are withheld.')
  }

  const displayedRequest = requestedPackage(requestUrl)
  if (requestUrl && !displayedRequest) {
    return invalid('Invalid Hex.pm request identity', 'The displayed URL is not the supported direct Hex.pm package lookup endpoint.')
  }
  let request = displayedRequest
  let requestBound = false
  if (executedRequest) {
    if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) {
      return invalid('Invalid Hex.pm request identity', 'The executed request is not the documented bodyless GET for the direct Hex.pm package endpoint.')
    }
    const executedIdentity = requestedPackage(executedRequest.url)
    if (!executedIdentity) return invalid('Invalid Hex.pm request identity', 'The executed URL is not the supported direct Hex.pm package lookup endpoint.')
    request = executedIdentity
    requestBound = true
  }
  const identityMatch = request ? request.packageName === providerPackage : undefined
  if (identityMatch === false) {
    return invalid('Hex.pm package identity mismatch', 'The provider returned a different package identity than the executed direct package lookup, so package facts are withheld.')
  }

  const metaPresent = isRecordValue(root.meta)
  const meta = metaPresent ? asRecord(root.meta) : {}
  const description = text(meta.description)
  const licenses = stringArray(meta.licenses)
  const metaMalformed = !metaPresent || optionalTextMalformed(meta, 'description') || licenses.malformed

  const downloadsPresent = isRecordValue(root.downloads)
  const downloads = downloadsPresent ? asRecord(root.downloads) : {}
  const totalDownloads = nonNegativeNumber(downloads.all)
  const recentDownloads = nonNegativeNumber(downloads.recent)
  const weekDownloads = nonNegativeNumber(downloads.week)
  const dayDownloads = nonNegativeNumber(downloads.day)
  const downloadContractValid = downloadsPresent && [totalDownloads, recentDownloads, weekDownloads, dayDownloads].every((value) => value !== undefined)

  const releaseValues = Array.isArray(root.releases) ? root.releases : undefined
  const releasesPresent = releaseValues !== undefined
  const providerReleaseCount = releaseValues?.length
  const trustedReleases = releaseValues ? releaseValues.map((candidate: unknown) => trustedRelease(candidate, providerPackage)).filter((release): release is HexRelease => Boolean(release)) : []
  const invalidReleaseCount = releaseValues ? releaseValues.length - trustedReleases.length : 0
  const trustedReleaseVersions = new Set(trustedReleases.map((release) => release.version))

  const latestStableRaw = root.latest_stable_version
  const latestStableVersion = text(latestStableRaw)
  const latestStableMalformed = latestStableRaw !== undefined && latestStableRaw !== null && !latestStableVersion
  const latestVersionCoherent = !releasesPresent || trustedReleaseVersions.has(latestVersion)
  const latestStableCoherent = !latestStableVersion || !releasesPresent || trustedReleaseVersions.has(latestStableVersion)
  const trustedLatestVersion = latestVersionCoherent ? latestVersion : undefined
  const trustedLatestStableVersion = latestStableVersion && latestStableCoherent ? latestStableVersion : undefined
  const releaseContractValid = releasesPresent && invalidReleaseCount === 0 && latestVersionCoherent && latestStableCoherent

  const owners = trustedOwners(root.owners)
  const optionalShapeMalformed = owners.malformed || optionalTextMalformed(root, 'inserted_at') || optionalTextMalformed(root, 'updated_at') || optionalTextMalformed(root, 'html_url') || optionalTextMalformed(root, 'docs_html_url')
  const state = requestBound && request && identityMatch === true && metaPresent && !metaMalformed && downloadContractValid && releaseContractValid && !latestStableMalformed && !optionalShapeMalformed ? 'ready' : 'partial'

  const heroVersion = trustedLatestStableVersion ?? trustedLatestVersion ?? 'Version unavailable'
  const partialReason = !requestBound
    ? 'The provider package identity is usable, but executed-request identity is unavailable, so this response cannot be fully bound to a requested package.'
    : !releasesPresent
      ? 'Package identity is trustworthy, but the optional release list is unavailable. Release list unavailable; provider-owned latest-version metadata remains visible.'
      : invalidReleaseCount > 0 || !latestVersionCoherent || !latestStableCoherent
        ? 'Package identity is trustworthy, but one or more release records or latest-version relationships are malformed. Only validated release facts are shown.'
        : !downloadContractValid
          ? 'Package identity is trustworthy, but one or more download counters are missing or malformed. Only validated counters are shown.'
          : 'Package identity is trustworthy, but one or more optional metadata fields are malformed. Only validated package facts are shown.'

  return <div className="package-release-preview" data-domain-card="hexpm-package" data-ssot-reference="exact-hexpm-package-v2" data-result-state={state} data-request-bound={String(requestBound)} data-requested-package={request?.packageName} data-provider-package={providerPackage} data-identity-match={identityMatch === undefined ? undefined : String(identityMatch)} data-provider-release-count={providerReleaseCount} data-valid-release-count={releasesPresent ? trustedReleases.length : undefined} data-invalid-release-count={releasesPresent ? invalidReleaseCount : undefined} data-latest-version={trustedLatestVersion} data-latest-stable-version={trustedLatestStableVersion} data-total-downloads={totalDownloads} data-recent-downloads={recentDownloads} data-week-downloads={weekDownloads} data-day-downloads={dayDownloads} data-owner-count={owners.providerCount === undefined ? undefined : owners.values.length} data-provider-owner-count={owners.providerCount} data-license-count={Array.isArray(meta.licenses) ? licenses.values.length : undefined} data-download-contract={String(downloadContractValid)}>
    <header>
      <div><small>BEAM package · Hex.pm</small><h3>{providerPackage}</h3><p>{description ?? 'Provider-owned package identity, release metadata, downloads, licensing, and ownership from Hex.pm.'}</p></div>
      <div className="package-release-hero"><span>{trustedLatestStableVersion ? 'Latest stable' : 'Latest version'}</span><strong>{heroVersion}</strong><small>{releasesPresent ? `${trustedReleases.length.toLocaleString('en')} trusted of ${providerReleaseCount?.toLocaleString('en')} published releases` : 'Release list unavailable'}</small></div>
    </header>
    {state === 'partial' && <p className="domain-note">{partialReason}</p>}
    <div className="package-channel-grid">
      <article><small>Total downloads</small><strong>{formatCount(totalDownloads)}</strong></article>
      <article><small>Recent · 90 days</small><strong>{formatCount(recentDownloads)}</strong></article>
      <article><small>Last 7 days</small><strong>{formatCount(weekDownloads)}</strong></article>
      <article><small>Yesterday</small><strong>{formatCount(dayDownloads)}</strong></article>
      <article><small>Licenses</small><strong>{licenses.values.join(', ') || 'License unavailable'}</strong></article>
      <article><small>Owners</small><strong>{owners.values.join(', ') || 'Owners unavailable'}</strong></article>
    </div>
    <div className="package-version-list"><div><strong>Trusted releases</strong><span>{releasesPresent ? `${trustedReleases.length.toLocaleString('en')} validated · ${invalidReleaseCount.toLocaleString('en')} invalid hidden` : 'Release list unavailable'}</span></div><div>{trustedReleases.slice(0, 18).map((release) => <code key={release.version}>{release.version}</code>)}</div></div>
  </div>
}
