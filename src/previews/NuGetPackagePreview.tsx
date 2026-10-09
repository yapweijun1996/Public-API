import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty, asRecord, text } from './cardPrimitives'
import { nonNegativeInteger } from './semanticValidation'

const canonicalPackage = (value: string) => value.trim().toLowerCase()
const registrationPrefix = '/v3/registration5-gz-semver2/'
const registrationSuffix = '/index.json'
type RegistrationIdentity = { packageId: string }

const registrationIdentity = (value?: string): RegistrationIdentity | undefined => {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'api.nuget.org' || url.search || url.hash) return undefined
    if (!url.pathname.startsWith(registrationPrefix) || !url.pathname.endsWith(registrationSuffix)) return undefined
    const encoded = url.pathname.slice(registrationPrefix.length, -registrationSuffix.length)
    if (!encoded || encoded.includes('/')) return undefined
    const packageId = decodeURIComponent(encoded)
    if (!packageId.trim() || canonicalPackage(packageId) !== packageId) return undefined
    return { packageId }
  } catch { return undefined }
}

const absoluteNugetUrl = (value: unknown): string | undefined => {
  const candidate = text(value)
  if (!candidate) return undefined
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' && url.hostname === 'api.nuget.org' ? candidate : undefined
  } catch { return undefined }
}

type NuGetVersion = { raw: string; core: [number, number, number, number]; prerelease: string[] }
const parseNuGetVersion = (value: unknown): NuGetVersion | undefined => {
  const raw = text(value)
  if (!raw) return undefined
  const match = /^(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?(?:\.(0|[1-9]\d*))?(?:\.(0|[1-9]\d*))?(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(raw)
  if (!match) return undefined
  const core = [match[1], match[2], match[3], match[4]].map((part) => Number(part ?? 0)) as [number, number, number, number]
  return { raw, core, prerelease: match[5] ? match[5].split('.') : [] }
}
const compareNuGetVersions = (left: NuGetVersion, right: NuGetVersion) => {
  for (let index = 0; index < 4; index += 1) if (left.core[index] !== right.core[index]) return left.core[index] - right.core[index]
  if (left.prerelease.length === 0 && right.prerelease.length > 0) return 1
  if (right.prerelease.length === 0 && left.prerelease.length > 0) return -1
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index += 1) {
    const leftPart = left.prerelease[index], rightPart = right.prerelease[index]
    if (leftPart === undefined) return -1
    if (rightPart === undefined) return 1
    const leftNumeric = /^\d+$/.test(leftPart), rightNumeric = /^\d+$/.test(rightPart)
    if (leftNumeric && rightNumeric) { const difference = Number(leftPart) - Number(rightPart); if (difference) return difference; continue }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1
    const difference = leftPart.toLowerCase().localeCompare(rightPart.toLowerCase(), 'en')
    if (difference) return difference
  }
  return 0
}

type TrustedLeaf = { packageId: string; version: NuGetVersion; authors?: string; description?: string; license?: string; published?: string }
type TrustedPage = { count: number; lower: NuGetVersion; upper: NuGetVersion; hasInlineItems: boolean; trustedLeaves: TrustedLeaf[] }
const invalid = (title: string, detail: string) => <CardEmpty domain="nuget-package" title={title} detail={detail} state="invalid"/>

export function NuGetPackagePreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return invalid('Invalid NuGet registration response', 'NuGet returned HTTP-success data without the documented registration-index object.')
  const root = asRecord(data)
  if (!Array.isArray(root.items)) return invalid('Invalid NuGet registration response', 'The registration index does not contain the documented registration-pages array.')
  const rootCount = nonNegativeInteger(root.count)
  if (rootCount === undefined) return invalid('Invalid NuGet registration response', 'The registration index does not contain a valid registration-page count.')

  const displayedRequest = registrationIdentity(requestUrl)
  if (requestUrl && !displayedRequest) return invalid('Invalid NuGet request identity', 'The displayed URL is not the supported NuGet SemVer 2 registration-index endpoint.')

  let request = displayedRequest
  let requestBound = false
  if (executedRequest) {
    if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) {
      return invalid('Invalid NuGet request identity', 'The executed request is not the documented bodyless GET for the NuGet SemVer 2 registration-index endpoint.')
    }
    const executedIdentity = registrationIdentity(executedRequest.url)
    if (!executedIdentity) return invalid('Invalid NuGet request identity', 'The executed URL is not the supported NuGet SemVer 2 registration-index endpoint.')
    request = executedIdentity
    requestBound = true
  }
  const rootIdValue = text(root['@id'])
  const rootIdentity = rootIdValue ? registrationIdentity(rootIdValue) : undefined
  if (rootIdValue && !rootIdentity) return invalid('Invalid NuGet registration identity', 'The provider returned a registration-index identity outside the supported NuGet SemVer 2 registration hive.')
  if (request && rootIdentity && canonicalPackage(request.packageId) !== canonicalPackage(rootIdentity.packageId)) return invalid('NuGet package identity mismatch', 'The provider registration index identifies a different package than the executed direct package lookup, so package facts are withheld.')

  if (rootCount === 0 && root.items.length === 0) {
    const state = requestBound ? 'empty' : 'partial'
    return <div className="domain-card domain-empty" data-domain-card="nuget-package" data-result-state={state} data-request-bound={String(requestBound)} data-requested-package={request?.packageId} data-provider-package={rootIdentity?.packageId} data-provider-page-count="0" data-provider-version-count="0" data-inline-version-count="0" data-valid-inline-version-count="0" data-invalid-inline-version-count="0" data-omitted-page-count="0"><h3>No NuGet package versions registered</h3><p>{requestBound && request ? `The SemVer 2 registration index returned a coherent empty result for ${request.packageId}.` : 'The registration index is empty, but executed-request identity is unavailable.'}</p></div>
  }

  const expectedPackage = request?.packageId ?? rootIdentity?.packageId
  const trustedPages: TrustedPage[] = []
  let invalidPageCount = 0, providerInlineCount = 0, invalidInlineCount = 0, incompletePageCount = 0
  let observedPackage: string | undefined
  const seenVersions = new Set<string>()
  for (const candidate of root.items) {
    const page = asRecord(candidate)
    const pageUrl = absoluteNugetUrl(page['@id'])
    const count = nonNegativeInteger(page.count)
    const lower = parseNuGetVersion(page.lower), upper = parseNuGetVersion(page.upper)
    if (!pageUrl || count === undefined || count <= 0 || !lower || !upper || compareNuGetVersions(lower, upper) > 0) { invalidPageCount += 1; continue }
    const hasInlineItems = page.items !== undefined
    if (hasInlineItems && !Array.isArray(page.items)) { invalidPageCount += 1; continue }
    const inline = Array.isArray(page.items) ? page.items : []
    providerInlineCount += inline.length
    const trustedLeaves: TrustedLeaf[] = []
    let pageInvalidInlineCount = 0
    for (const item of inline) {
      const leaf = asRecord(item), catalogEntry = asRecord(leaf.catalogEntry)
      const packageId = text(catalogEntry.id), version = parseNuGetVersion(catalogEntry.version)
      const leafUrl = absoluteNugetUrl(leaf['@id']), packageContent = absoluteNugetUrl(leaf.packageContent)
      const identityTarget = expectedPackage ?? observedPackage ?? packageId
      const identityMatches = Boolean(packageId && identityTarget && canonicalPackage(packageId) === canonicalPackage(identityTarget))
      const inRange = Boolean(version && compareNuGetVersions(version, lower) >= 0 && compareNuGetVersions(version, upper) <= 0)
      const versionKey = version?.raw.toLowerCase()
      if (!packageId || !version || !leafUrl || !packageContent || !identityMatches || !inRange || !versionKey || seenVersions.has(versionKey)) { pageInvalidInlineCount += 1; continue }
      observedPackage ??= packageId
      seenVersions.add(versionKey)
      trustedLeaves.push({ packageId, version, authors: Array.isArray(catalogEntry.authors) ? catalogEntry.authors.map(text).filter((value): value is string => Boolean(value)).join(', ') || undefined : text(catalogEntry.authors), description: text(catalogEntry.description), license: text(catalogEntry.licenseExpression), published: text(catalogEntry.published) })
    }
    if (hasInlineItems && inline.length !== count) incompletePageCount += 1
    invalidInlineCount += pageInvalidInlineCount
    trustedPages.push({ count, lower, upper, hasInlineItems, trustedLeaves })
  }
  if (!trustedPages.length) return invalid('Invalid NuGet registration pages', 'None of the returned registration pages satisfy the NuGet page identity, count, and version-range contract.')

  const providerPackage = observedPackage ?? rootIdentity?.packageId
  const identityMatch = request && providerPackage ? canonicalPackage(request.packageId) === canonicalPackage(providerPackage) : undefined
  if (identityMatch === false) return invalid('NuGet package identity mismatch', 'The returned inline package identity does not match the executed direct package lookup, so package facts are withheld.')
  const providerPageCount = root.items.length
  const registeredVersionCount = trustedPages.reduce((total, page) => total + page.count, 0)
  const omittedPageCount = trustedPages.filter((page) => !page.hasInlineItems).length
  const trustedLeaves = trustedPages.flatMap((page) => page.trustedLeaves)
  const highest = trustedPages.map((page) => page.upper).sort((left, right) => compareNuGetVersions(right, left))[0]
  const lowest = trustedPages.map((page) => page.lower).sort(compareNuGetVersions)[0]
  const latestInline = highest ? trustedLeaves.find((leaf) => compareNuGetVersions(leaf.version, highest) === 0) : undefined
  const structuralIssue = rootCount !== providerPageCount || invalidPageCount > 0 || invalidInlineCount > 0 || incompletePageCount > 0 || omittedPageCount > 0
  const state = requestBound && request && identityMatch === true && !structuralIssue ? 'ready' : 'partial'
  const displayPackage = providerPackage ?? request?.packageId ?? 'NuGet package'
  const sortedInline = [...trustedLeaves].sort((left, right) => compareNuGetVersions(right.version, left.version))

  return <div className="package-release-preview" data-domain-card="nuget-package" data-ssot-reference="exact-nuget-package-registration-v2" data-result-state={state} data-request-bound={String(requestBound)} data-requested-package={request?.packageId} data-provider-package={providerPackage} data-identity-match={identityMatch === undefined ? undefined : String(identityMatch)} data-provider-page-count={providerPageCount} data-valid-page-count={trustedPages.length} data-invalid-page-count={invalidPageCount} data-provider-version-count={registeredVersionCount} data-inline-version-count={providerInlineCount} data-valid-inline-version-count={trustedLeaves.length} data-invalid-inline-version-count={invalidInlineCount} data-omitted-page-count={omittedPageCount} data-highest-registered-version={highest?.raw} data-lowest-registered-version={lowest?.raw}>
    <header><div><small>.NET package · NuGet SemVer 2 registration</small><h3>{displayPackage}</h3><p>Provider registration-page ranges and validated inline package metadata from NuGet&apos;s SemVer 2 registration hive.</p></div><div className="package-release-hero"><span>Highest registered</span><strong>{highest?.raw ?? '—'}</strong><small>{registeredVersionCount.toLocaleString('en')} registered versions · {providerPageCount.toLocaleString('en')} page{providerPageCount === 1 ? '' : 's'}</small></div></header>
    {state === 'partial' && <p className="domain-note">{!requestBound ? 'The registration structure is usable, but executed-request identity is unavailable, so it cannot be fully bound to a requested package.' : omittedPageCount > 0 ? `${omittedPageCount} registration page${omittedPageCount === 1 ? '' : 's'} intentionally omit leaf items; page metadata is not inlined, so only provider version ranges and already-inlined package facts are trusted.` : 'One or more registration pages or inline package records are malformed or incomplete, so only validated facts are shown.'}</p>}
    <div className="package-channel-grid"><article><small>Registered versions</small><strong>{registeredVersionCount.toLocaleString('en')}</strong></article><article><small>Inline metadata</small><strong>{trustedLeaves.length.toLocaleString('en')}</strong></article><article><small>Version range</small><strong>{lowest?.raw ?? '—'} → {highest?.raw ?? '—'}</strong></article><article><small>External pages</small><strong>{omittedPageCount.toLocaleString('en')}</strong></article></div>
    {latestInline ? <div className="package-version-list"><div><strong>Highest-version metadata</strong><span>{latestInline.version.raw}</span></div><div><span>{latestInline.authors ?? 'Authors unavailable'}</span><span>{latestInline.license ?? 'License unavailable'}</span><span>{latestInline.published ?? 'Published date unavailable'}</span></div>{latestInline.description && <p>{latestInline.description}</p>}</div> : omittedPageCount > 0 ? <p className="domain-note">Detailed leaf metadata requires a provider page request that is outside this one-request demo. The card does not invent author, licence, or publication facts from page bounds.</p> : null}
    {sortedInline.length > 0 && <div className="package-version-list"><div><strong>Trusted inline versions</strong><span>{Math.min(sortedInline.length, 12)} shown · {invalidInlineCount} invalid hidden</span></div><div>{sortedInline.slice(0, 12).map((leaf) => <code key={leaf.version.raw}>{leaf.version.raw}</code>)}</div></div>}
  </div>
}
