import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { isRecord, optionalTrimmedText as optionalText, trimmedText as requiredText } from './semanticValidation'

const REQUEST_PREFIX = '/pypi/'
const REQUEST_SUFFIX = '/json'
const PROJECT_NAME = /^(?:[A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9])$/

type PyPiRequest = { projectName: string; normalizedName: string }
const validProjectName = (value: string) => PROJECT_NAME.test(value)
const normalizeProjectName = (value: string) => value.toLowerCase().replace(/[-_.]+/g, '-')

const requestedProject = (requestUrl?: string): PyPiRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'pypi.org' || url.search || url.hash) return undefined
    if (!url.pathname.startsWith(REQUEST_PREFIX) || !url.pathname.endsWith(REQUEST_SUFFIX)) return undefined
    const encoded = url.pathname.slice(REQUEST_PREFIX.length, -REQUEST_SUFFIX.length)
    if (!encoded || encoded.includes('/')) return undefined
    const projectName = decodeURIComponent(encoded)
    if (!validProjectName(projectName)) return undefined
    return { projectName, normalizedName: normalizeProjectName(projectName) }
  } catch { return undefined }
}

const vulnerabilityCount = (value: unknown): { count?: number; malformed: boolean } => {
  if (value === undefined) return { malformed: false }
  if (!Array.isArray(value)) return { malformed: true }
  if (!value.every(isRecord)) return { malformed: true }
  return { count: value.length, malformed: false }
}

const invalid = (title: string, detail: string) => <CardEmpty domain="pypi-package" title={title} detail={detail} state="invalid"/>

export function PyPiPackagePreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!isRecord(data) || !isRecord(data.info)) {
    return invalid('Invalid PyPI package response', 'PyPI returned HTTP-success data without the documented project info object.')
  }

  const info = data.info
  const providerPackage = requiredText(info.name)
  const providerVersion = requiredText(info.version)
  if (!providerPackage || !validProjectName(providerPackage) || !providerVersion) {
    return invalid('Invalid PyPI package identity', 'The project response is missing a valid provider-owned project name or latest-version identity.')
  }

  const normalizedProviderPackage = normalizeProjectName(providerPackage)
  const displayedRequest = requestedProject(requestUrl)
  if (requestUrl && !displayedRequest) {
    return invalid('Invalid PyPI request identity', 'The displayed URL is not the supported direct PyPI project JSON endpoint.')
  }
  let request = displayedRequest
  let requestBound = false
  if (executedRequest) {
    if (
      executedRequest.method.toUpperCase() !== 'GET'
      || executedRequest.body !== undefined
      || (requestUrl !== undefined && executedRequest.url !== requestUrl)
    ) {
      return invalid('Invalid PyPI request identity', 'The executed request is not the documented bodyless GET for the direct PyPI project JSON endpoint.')
    }
    const executedIdentity = requestedProject(executedRequest.url)
    if (!executedIdentity) return invalid('Invalid PyPI request identity', 'The executed URL is not the supported direct PyPI project JSON endpoint.')
    request = executedIdentity
    requestBound = true
  }

  const identityMatch = request ? request.normalizedName === normalizedProviderPackage : undefined
  if (identityMatch === false) {
    return invalid('PyPI package identity mismatch', 'The provider returned a different normalized project identity than the executed direct project lookup, so package facts are withheld.')
  }

  const summary = optionalText(info.summary)
  const requiresPython = optionalText(info.requires_python)
  const licenseExpression = optionalText(info.license_expression)
  const legacyLicense = optionalText(info.license)
  const maintainer = optionalText(info.maintainer)
  const author = optionalText(info.author)
  const yankedReason = optionalText(info.yanked_reason)
  const yanked = info.yanked === undefined || info.yanked === null ? undefined : typeof info.yanked === 'boolean' ? info.yanked : undefined
  const yankedMalformed = info.yanked !== undefined && info.yanked !== null && typeof info.yanked !== 'boolean'
  const vulnerabilities = vulnerabilityCount(data.vulnerabilities)
  const malformedOptional = summary.malformed || requiresPython.malformed || licenseExpression.malformed || legacyLicense.malformed || maintainer.malformed || author.malformed || yankedReason.malformed || yankedMalformed || vulnerabilities.malformed
  const state = requestBound && request && identityMatch === true && !malformedOptional ? 'ready' : 'partial'
  const license = licenseExpression.value ?? legacyLicense.value
  const contact = maintainer.value ?? author.value
  const partialReason = !requestBound
    ? 'The provider package identity is usable, but executed-request identity is unavailable, so this response cannot be fully bound to a requested project.'
    : 'Package identity is trustworthy, but one or more optional package metadata fields are malformed. Only validated current project facts are shown.'

  return <div className="package-release-preview" data-domain-card="pypi-package" data-ssot-reference="exact-pypi-project-json-v2" data-result-state={state} data-request-bound={String(requestBound)} data-requested-package={request?.projectName} data-provider-package={providerPackage} data-normalized-requested-package={request?.normalizedName} data-normalized-provider-package={normalizedProviderPackage} data-identity-match={identityMatch === undefined ? undefined : String(identityMatch)} data-provider-version={providerVersion} data-yanked={yanked === undefined ? undefined : String(yanked)} data-vulnerability-count={vulnerabilities.count}>
    <header>
      <div><small>Python package · PyPI</small><h3>{providerPackage}</h3><p>{summary.value ?? 'Provider-owned project identity and current metadata from PyPI’s project JSON endpoint.'}</p></div>
      <div className="package-release-hero"><span>Latest version</span><strong>{providerVersion}</strong><small>{yanked === undefined ? 'Yank status unavailable' : yanked ? 'Latest release is yanked' : 'Current release'}</small></div>
    </header>
    {state === 'partial' && <p className="domain-note">{partialReason}</p>}
    <div className="package-channel-grid">
      <article><small>Requires Python</small><strong>{requiresPython.value ?? 'Requirement unavailable'}</strong></article>
      <article><small>License</small><strong>{license ?? 'License unavailable'}</strong></article>
      <article><small>Maintainer / author</small><strong>{contact ?? 'Contact unavailable'}</strong></article>
      <article><small>Known vulnerabilities</small><strong>{vulnerabilities.count === undefined ? 'Vulnerability data unavailable' : vulnerabilities.count.toLocaleString('en')}</strong></article>
    </div>
    <div className="package-version-list"><div><strong>Trusted current project facts</strong><span>Project-name identity uses PyPA normalization</span></div><div><span>{request ? `Requested ${request.projectName}` : 'Request identity unavailable'}</span><span>{yanked && yankedReason.value ? `Yanked: ${yankedReason.value}` : yanked ? 'Yanked release' : 'Latest release metadata'}</span></div></div>
  </div>
}
