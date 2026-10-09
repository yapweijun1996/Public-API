import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, text } from './cardPrimitives'

const stringArray = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
const yesNo = (value: unknown) => value === true ? 'Yes' : value === false ? 'No' : 'Not supplied'
const valueText = (value: unknown) => text(value) ?? (typeof value === 'number' && Number.isFinite(value) ? String(value) : 'Not supplied')

type HomebrewPackageKind = 'formula' | 'cask'
type HomebrewRequestIdentity = { kind: HomebrewPackageKind; token: string }

const requestedPackage = (requestUrl?: string): HomebrewRequestIdentity | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.origin !== 'https://formulae.brew.sh' || url.search || url.hash || url.username || url.password) return undefined
    const match = url.pathname.match(/^\/api\/(formula|cask)\/([^/]+)\.json$/)
    if (!match) return undefined
    return { kind: match[1] as HomebrewPackageKind, token: decodeURIComponent(match[2]) }
  } catch { return undefined }
}

const macosRequirement = (dependsOn: Record<string, unknown>) => {
  const macos = asRecord(dependsOn.macos)
  const entry = Object.entries(macos)[0]
  if (!entry) return 'Not supplied'
  const [operator, raw] = entry
  const versions = stringArray(raw)
  return versions.length ? `${operator} ${versions.join(', ')}` : valueText(raw)
}

const artifactLabel = (artifact: Record<string, unknown>) => {
  for (const key of ['app', 'pkg', 'binary', 'installer', 'audio_unit_plugin', 'vst_plugin', 'vst3_plugin', 'qlplugin']) {
    const values = stringArray(artifact[key])
    if (values.length) return `${key.replaceAll('_', ' ')}: ${values.join(', ')}`
  }
  const keys = Object.keys(artifact).filter((key) => key !== 'target')
  return keys.length ? keys.join(', ') : 'Artifact metadata'
}

const invalid = (title: string, detail: string) => <CardEmpty domain="homebrew-package" title={title} detail={detail} state="invalid"/>

export function HomebrewPackagePreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return invalid('Invalid Homebrew package response', 'Homebrew returned HTTP-success data without the documented formula or cask metadata object.')
  }

  const root = asRecord(data)
  const displayedRequest = requestedPackage(requestUrl)
  if (requestUrl && !displayedRequest) {
    return invalid('Invalid Homebrew request identity', 'The displayed URL is not the supported Homebrew formula/cask JSON endpoint.')
  }
  let request = displayedRequest
  let requestBound = false
  if (executedRequest) {
    if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) {
      return invalid('Invalid Homebrew request identity', 'The executed request is not the documented bodyless GET for the Homebrew formula/cask JSON endpoint.')
    }
    const executedIdentity = requestedPackage(executedRequest.url)
    if (!executedIdentity) {
      return invalid('Invalid Homebrew request identity', 'The executed URL is not the supported Homebrew formula/cask JSON endpoint.')
    }
    request = executedIdentity
    requestBound = true
  }
  const caskToken = text(root.token)
  const formulaName = text(root.name)

  if (request?.kind === 'formula' && caskToken) {
    return invalid('Homebrew package kind mismatch', 'The direct formula lookup returned cask-shaped metadata, so no package details are presented as trustworthy.')
  }
  if (request?.kind === 'cask' && formulaName) {
    return invalid('Homebrew package kind mismatch', 'The direct cask lookup returned formula-shaped metadata, so no package details are presented as trustworthy.')
  }

  const kind: HomebrewPackageKind | undefined = request?.kind ?? (caskToken ? 'cask' : formulaName ? 'formula' : undefined)
  if (!kind) {
    return invalid('Invalid Homebrew package response', 'Homebrew returned a package object without the provider-owned formula name or cask token identity.')
  }

  if (kind === 'cask') {
    const token = caskToken
    const fullToken = text(root.full_token)
    const tap = text(root.tap)
    if (!token || !fullToken || !tap) {
      return invalid('Invalid Homebrew cask response', 'Homebrew returned cask-shaped data without the documented token, full_token, and tap identity fields.')
    }
    if (tap !== 'homebrew/cask') {
      return invalid('Invalid Homebrew cask identity', 'The returned cask does not identify the Homebrew/cask tap used by this direct JSON endpoint.')
    }
    const identityMatch = request ? request.kind === 'cask' && (request.token === token || request.token === fullToken) : undefined
    if (identityMatch === false) {
      return invalid('Homebrew package identity mismatch', 'The returned cask token does not match the requested direct-lookup token, so no package details are presented as trustworthy.')
    }

    const names = stringArray(root.name)
    const displayName = names[0] ?? token
    const version = valueText(root.version)
    const requirement = macosRequirement(asRecord(root.depends_on))
    const providerArtifacts = root.artifacts
    const artifactsShapeValid = Array.isArray(providerArtifacts)
    const artifacts = artifactsShapeValid ? providerArtifacts.map((entry: unknown) => asRecord(entry)).filter((entry) => Object.keys(entry).length > 0) : []
    const visibleArtifacts = artifacts.map(artifactLabel).filter((label) => !label.startsWith('uninstall') && !label.startsWith('zap')).slice(0, 8)
    const contextComplete = names.length > 0 && version !== 'Not supplied' && artifactsShapeValid
    const state = requestBound && request && identityMatch && contextComplete ? 'ready' : 'partial'

    return <div className="domain-card homebrew-package-preview" data-domain-card="homebrew-package" data-ssot-reference="exact-homebrew-package-json-v2" data-result-state={state} data-request-bound={String(requestBound)} data-requested-package-kind={request?.kind} data-requested-package-token={request?.token} data-identity-match={identityMatch === undefined ? undefined : String(identityMatch)} data-package-kind="cask" data-package-token={token} data-full-package-token={fullToken} data-provider-tap={tap} data-package-name={displayName} data-version={version} data-auto-updates={String(root.auto_updates === true)} data-macos-requirement={requirement} data-artifact-count={artifacts.length}>
      <CardHeading eyebrow="Homebrew · cask metadata" title={displayName} description={`${token} · Provider-owned Homebrew/cask identity and packaging metadata`}><span className="domain-state">{state === 'ready' ? 'Cask identity verified' : 'Partial provider response'}</span></CardHeading>
      {state === 'partial' && <p className="domain-note">The cask identity is provider-owned, but {requestBound ? 'one or more expected package fields are unavailable or malformed' : 'executed-request identity is unavailable, so this response cannot be bound to a specific executed lookup'}. Only trustworthy fields are shown.</p>}
      <Facts items={[
        { label: 'Token', value: token }, { label: 'Version', value: version }, { label: 'Tap', value: tap },
        { label: 'Auto-updates', value: yesNo(root.auto_updates) }, { label: 'macOS requirement', value: requirement },
        { label: 'Artifact entries', value: artifacts.length.toLocaleString('en') }, { label: 'Deprecated', value: yesNo(root.deprecated) }, { label: 'Disabled', value: yesNo(root.disabled) },
      ]}/>
      {text(root.homepage) && <p className="domain-note">Homepage: <code>{text(root.homepage)}</code></p>}
      {visibleArtifacts.length > 0 && <section aria-labelledby="homebrew-artifacts-heading"><h4 id="homebrew-artifacts-heading">Install artifacts</h4><ul>{visibleArtifacts.map((label) => <li key={label}><code>{label}</code></li>)}</ul></section>}
      <p className="domain-note">Cask metadata describes application packaging. Auto-update and OS requirements are provider fields; uninstall/zap details remain in Raw JSON and are not presented as install dependencies.</p>
    </div>
  }

  const name = formulaName
  const fullName = text(root.full_name)
  const tap = text(root.tap)
  if (!name || !fullName || !tap) {
    return invalid('Invalid Homebrew formula response', 'Homebrew returned formula-shaped data without the documented name, full_name, and tap identity fields.')
  }
  if (tap !== 'homebrew/core') {
    return invalid('Invalid Homebrew formula identity', 'The returned formula does not identify the Homebrew/core tap used by this direct JSON endpoint.')
  }
  const identityMatch = request ? request.kind === 'formula' && (request.token === name || request.token === fullName) : undefined
  if (identityMatch === false) {
    return invalid('Homebrew package identity mismatch', 'The returned formula name does not match the requested direct-lookup token, so no package details are presented as trustworthy.')
  }

  const versions = asRecord(root.versions)
  const stableVersion = valueText(versions.stable)
  const dependenciesShapeValid = Array.isArray(root.dependencies)
  const buildDependenciesShapeValid = Array.isArray(root.build_dependencies)
  const dependencies = stringArray(root.dependencies)
  const buildDependencies = stringArray(root.build_dependencies)
  const macosDependencies = stringArray(root.uses_from_macos)
  const bottleFiles = Object.keys(asRecord(asRecord(asRecord(root.bottle).stable).files))
  const contextComplete = stableVersion !== 'Not supplied' && dependenciesShapeValid && buildDependenciesShapeValid
  const state = requestBound && request && identityMatch && contextComplete ? 'ready' : 'partial'

  return <div className="domain-card homebrew-package-preview" data-domain-card="homebrew-package" data-ssot-reference="exact-homebrew-package-json-v2" data-result-state={state} data-request-bound={String(requestBound)} data-requested-package-kind={request?.kind} data-requested-package-token={request?.token} data-identity-match={identityMatch === undefined ? undefined : String(identityMatch)} data-package-kind="formula" data-package-token={name} data-full-package-token={fullName} data-provider-tap={tap} data-package-name={fullName} data-version={stableVersion} data-license={text(root.license) ?? ''} data-dependency-count={dependencies.length} data-build-dependency-count={buildDependencies.length} data-bottle-platform-count={bottleFiles.length}>
    <CardHeading eyebrow="Homebrew · formula metadata" title={fullName} description={`${name} · Provider-owned Homebrew/core identity and package metadata`}><span className="domain-state">{state === 'ready' ? 'Formula identity verified' : 'Partial provider response'}</span></CardHeading>
    {state === 'partial' && <p className="domain-note">The formula identity is provider-owned, but {requestBound ? 'one or more expected package fields are unavailable or malformed' : 'executed-request identity is unavailable, so this response cannot be bound to a specific executed lookup'}. Only trustworthy fields are shown.</p>}
    <Facts items={[
      { label: 'Stable version', value: stableVersion }, { label: 'Tap', value: tap }, { label: 'Licence', value: valueText(root.license) },
      { label: 'Bottled', value: yesNo(versions.bottle) }, { label: 'Bottle platforms', value: bottleFiles.length.toLocaleString('en') }, { label: 'Keg-only', value: yesNo(root.keg_only) },
      { label: 'Runtime dependencies', value: dependencies.length.toLocaleString('en') }, { label: 'Build dependencies', value: buildDependencies.length.toLocaleString('en') },
    ]}/>
    {text(root.homepage) && <p className="domain-note">Homepage: <code>{text(root.homepage)}</code></p>}
    {dependencies.length > 0 && <section aria-labelledby="homebrew-dependencies-heading"><h4 id="homebrew-dependencies-heading">Runtime dependencies</h4><p>{dependencies.slice(0, 16).map((dependency) => <code key={dependency}>{dependency} </code>)}</p>{dependencies.length > 16 && <p className="domain-note">Showing 16 of {dependencies.length} runtime dependencies; Raw JSON retains the complete list.</p>}</section>}
    {macosDependencies.length > 0 && <p className="domain-note">Uses from macOS: {macosDependencies.join(', ')}.</p>}
    <p className="domain-note">Formula and cask JSON are different provider shapes. Formula dependencies, bottle availability, licence, and version are kept distinct from cask app artifacts and macOS requirements.</p>
  </div>
}
