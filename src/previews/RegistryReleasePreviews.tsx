import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { isRecord, optionalTrimmedText, trimmedText } from './semanticValidation'

type PreviewProps = {
  data: unknown
  requestUrl?: string
  executedRequest?: ExecutedRequestContext
}

const requestParts = (
  { requestUrl, executedRequest }: Omit<PreviewProps, 'data'>,
  hostname: string,
  pathname: RegExp,
) => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return undefined
  try {
    const url = new URL(executedRequest.url)
    if (url.origin !== `https://${hostname}` || url.search || url.hash || url.username || url.password) return undefined
    return pathname.exec(url.pathname)?.slice(1).map(decodeURIComponent)
  } catch {
    return undefined
  }
}

const normalizePyPiName = (name: string) => name.toLowerCase().replace(/[-_.]+/g, '-')
const unavailable = 'Unavailable'
const displayLimit = 6
const optionalRecordText = (value: unknown, key: string) => {
  if (value === undefined || value === null) return { malformed: false }
  return isRecord(value) ? optionalTrimmedText(value[key]) : { malformed: true }
}

export function NpmVersionPreview({ data, ...request }: PreviewProps) {
  const [name, version] = requestParts(request, 'registry.npmjs.org', /^\/([^/]+)\/([^/]+)$/) ?? []
  if (!name || !version || !isRecord(data) || data.name !== name || data.version !== version) {
    return <CardEmpty domain="npm-version" title="Invalid npm release response" detail="The response must identify the exact requested package and release." state="invalid"/>
  }

  const license = optionalTrimmedText(data.license)
  const node = optionalRecordText(data.engines, 'node')
  const integrity = optionalRecordText(data.dist, 'integrity')
  const dependencies = isRecord(data.dependencies) ? Object.entries(data.dependencies) : []
  const validDependencies = dependencies.flatMap(([dependency, value]) => {
    const range = trimmedText(value)
    return range ? [{ dependency, range }] : []
  })
  const dependenciesMalformed = (data.dependencies !== undefined && !isRecord(data.dependencies)) || validDependencies.length !== dependencies.length
  const state = license.malformed || node.malformed || integrity.malformed || dependenciesMalformed ? 'partial' : 'ready'

  return <div className="package-release-preview" data-domain-card="npm-version" data-result-state={state}>
    <header><div><small>Exact npm release</small><h3>{name}</h3></div><div className="package-release-hero"><span>Published version</span><strong>{version}</strong></div></header>
    <div className="package-channel-grid">
      <article><small>License</small><strong>{license.value ?? unavailable}</strong></article>
      <article><small>Node.js requirement</small><strong>{node.value ?? unavailable}</strong></article>
      <article><small>Runtime dependencies</small><strong>{dependenciesMalformed ? unavailable : dependencies.length}</strong></article>
    </div>
    <div className="package-version-list registry-release-rows">
      <div><strong>Distribution integrity</strong><span>{integrity.value ?? unavailable}</span></div>
      {validDependencies.slice(0, displayLimit).map(({ dependency, range }) => <div key={dependency}><strong>{dependency}</strong><span>{range}</span></div>)}
    </div>
  </div>
}

type PublishedRelease = { version: string; timestamp: string }

export function NpmReleaseHistoryPreview({ data, ...request }: PreviewProps) {
  const [name] = requestParts(request, 'registry.npmjs.org', /^\/([^/]+)$/) ?? []
  if (!name || !isRecord(data) || data.name !== name || !isRecord(data.versions) || !isRecord(data.time) || !isRecord(data['dist-tags'])) {
    return <CardEmpty domain="npm-release-history" title="Invalid npm release history" detail="The response must identify the requested package and include version, timestamp, and distribution-tag records." state="invalid"/>
  }

  const times = data.time
  const versions = Object.keys(data.versions)
  const publishedVersions = new Set(versions)
  const releases = versions.flatMap<PublishedRelease>((version) => {
    const timestamp = trimmedText(times[version])
    return timestamp && /^\d{4}-\d{2}-\d{2}T/.test(timestamp) && Number.isFinite(Date.parse(timestamp)) ? [{ version, timestamp }] : []
  }).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
  const tags = Object.entries(data['dist-tags'])
  const validTags = tags.flatMap(([tag, value]) => {
    const version = trimmedText(value)
    return version && publishedVersions.has(version) ? [{ tag, version }] : []
  })
  const state = releases.length === versions.length && validTags.length === tags.length ? 'ready' : 'partial'

  return <div className="package-release-preview" data-domain-card="npm-release-history" data-result-state={state}>
    <header><div><small>npm registry document</small><h3>{name}</h3></div><div className="package-release-hero"><span>Recorded versions</span><strong>{versions.length}</strong></div></header>
    <div className="package-channel-grid">
      {validTags.slice(0, displayLimit).map(({ tag, version }) => <article key={tag}><small>{tag}</small><strong>{version}</strong></article>)}
    </div>
    <div className="package-version-list registry-release-rows">
      <div><strong>Recent publication dates</strong><span>Showing {Math.min(releases.length, displayLimit)} of {releases.length} dated releases</span></div>
      {releases.slice(0, displayLimit).map(({ version, timestamp }) => <div key={version}><strong>{version}</strong><time dateTime={timestamp}>{timestamp.slice(0, 10)}</time></div>)}
    </div>
  </div>
}

type Distribution = { filename: string; sha256?: string; requiresPython?: string; yanked: boolean }

const readDistribution = (entry: unknown, indexResponse: boolean): Distribution | undefined => {
  if (!isRecord(entry)) return undefined
  const filename = trimmedText(entry.filename)
  const checksums = entry[indexResponse ? 'hashes' : 'digests']
  const digest = isRecord(checksums) ? trimmedText(checksums.sha256) : undefined
  const requirement = optionalTrimmedText(entry[indexResponse ? 'requires-python' : 'requires_python'])
  const yanked = entry.yanked
  if (!filename || !isRecord(checksums) || (checksums.sha256 !== undefined && (!digest || !/^[a-f\d]{64}$/i.test(digest))) || requirement.malformed) return undefined
  if (typeof yanked !== 'boolean' && !(indexResponse && typeof yanked === 'string')) return undefined
  return { filename, sha256: digest, requiresPython: requirement.value, yanked: yanked !== false }
}

function PyPiDistributions({ files }: { files: Distribution[] }) {
  return <div className="package-version-list registry-release-rows">
    <div><strong>Distribution files</strong><span>Showing {Math.min(files.length, displayLimit)} of {files.length} readable files</span></div>
    {files.slice(0, displayLimit).map((file) => <div key={file.filename}>
      <div><strong>{file.filename}</strong>{file.yanked && <div><small>Yanked</small></div>}</div>
      <div><div>Requires Python: {file.requiresPython ?? unavailable}</div><div>SHA-256: {file.sha256 ?? unavailable}</div></div>
    </div>)}
  </div>
}

export function PyPiExactReleasePreview({ data, ...request }: PreviewProps) {
  const [name, version] = requestParts(request, 'pypi.org', /^\/pypi\/([^/]+)\/([^/]+)\/json$/) ?? []
  const providerName = isRecord(data) && isRecord(data.info) ? trimmedText(data.info.name) : undefined
  if (!name || !version || !isRecord(data) || !isRecord(data.info) || !providerName || normalizePyPiName(providerName) !== name || data.info.version !== version || !Array.isArray(data.urls)) {
    return <CardEmpty domain="pypi-release" title="Invalid PyPI release response" detail="The response must identify the exact requested project and release and provide its file list." state="invalid"/>
  }
  const files = data.urls.flatMap((entry) => readDistribution(entry, false) ?? [])
  const state = files.length !== data.urls.length ? 'partial' : 'ready'

  return <div className="package-release-preview" data-domain-card="pypi-release" data-result-state={state}>
    <header><div><small>Exact PyPI release</small><h3>{providerName}</h3></div><div className="package-release-hero"><span>Published version</span><strong>{version}</strong></div></header>
    <PyPiDistributions files={files}/>
  </div>
}

export function PyPiSimpleIndexPreview({ data, ...request }: PreviewProps) {
  const [name] = requestParts(request, 'pypi.org', /^\/simple\/([^/]+)\/$/) ?? []
  const providerName = isRecord(data) ? trimmedText(data.name) : undefined
  const apiVersion = isRecord(data) && isRecord(data.meta) ? trimmedText(data.meta['api-version']) : undefined
  if (!name || !isRecord(data) || !providerName || normalizePyPiName(providerName) !== name || !apiVersion || !/^1\.\d+$/.test(apiVersion) || !Array.isArray(data.files)) {
    return <CardEmpty domain="pypi-simple-index" title="Invalid PyPI Simple index" detail="The response must identify the requested project and provide a Simple API v1 file list." state="invalid"/>
  }
  const files = data.files.flatMap((entry) => readDistribution(entry, true) ?? [])
  const state = files.length !== data.files.length ? 'partial' : files.length ? 'ready' : 'empty'

  return <div className="package-release-preview" data-domain-card="pypi-simple-index" data-result-state={state}>
    <header><div><small>PyPI Simple index · API {apiVersion}</small><h3>{providerName}</h3></div><div className="package-release-hero"><span>Indexed files</span><strong>{data.files.length}</strong></div></header>
    <PyPiDistributions files={files}/>
  </div>
}
