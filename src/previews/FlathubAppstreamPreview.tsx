import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, trimmedText } from './semanticValidation'

type FlathubAppstreamRequest = { appId: string }
type FlathubBundle = { value: string; runtime: string; architecture: string; branch: string }
type FlathubRelease = { version: string; timestamp: number; date: string }
type FlathubScreenshot = { caption: string; src: string; width: number; height: number; isDefault: boolean }
type FlathubLinks = { homepage?: string; source?: string }
type FlathubAppstreamResult = {
  id: string
  name: string
  summary: string
  developer: string
  projectLicense: string
  isFreeLicense: boolean
  bundle?: FlathubBundle
  launchable?: string
  stableRelease?: FlathubRelease
  screenshots: FlathubScreenshot[]
  links: FlathubLinks
  malformed: number
  duplicates: number
}

const exactText = (value: unknown): string | undefined => {
  const text = trimmedText(value)
  return text && value === text ? text : undefined
}

const decimalStringInteger = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

const strictHttpsUrl = (value: unknown, host?: string, allowLocation = true): string | undefined => {
  const text = exactText(value)
  if (!text) return undefined
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.port || url.username || url.password || (host && url.hostname !== host)) return undefined
    if (!allowLocation && (url.search || url.hash)) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

export const parseFlathubAppstreamRequest = (executedRequest?: ExecutedRequestContext): FlathubAppstreamRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    if (url.protocol !== 'https:' || url.hostname !== 'flathub.org' || url.port || url.username || url.password || url.search || url.hash) return undefined
    const match = url.pathname.match(/^\/api\/v2\/appstream\/([^/]+)$/)
    if (!match) return undefined
    const appId = decodeURIComponent(match[1])
    if (!appId || appId !== appId.trim() || match[1] !== encodeURIComponent(appId)) return undefined
    return { appId }
  } catch {
    return undefined
  }
}

const parseBundle = (value: unknown, appId: string): FlathubBundle | undefined => {
  if (!isRecord(value) || value.type !== 'flatpak') return undefined
  const bundleValue = exactText(value.value)
  const runtime = exactText(value.runtime)
  if (!bundleValue || !runtime) return undefined
  const bundleParts = bundleValue.split('/')
  const runtimeParts = runtime.split('/')
  if (bundleParts.length !== 4 || bundleParts[0] !== 'app' || bundleParts[1] !== appId || bundleParts.slice(2).some((part) => !part)) return undefined
  if (runtimeParts.length !== 3 || runtimeParts.some((part) => !part)) return undefined
  return { value: bundleValue, runtime, architecture: bundleParts[2], branch: bundleParts[3] }
}

const parseLaunchable = (value: unknown): string | undefined => {
  if (!isRecord(value) || value.type !== 'desktop-id') return undefined
  return exactText(value.value)
}

const parseReleases = (value: unknown): { stableRelease?: FlathubRelease; malformed: number } => {
  if (!Array.isArray(value)) return { malformed: 1 }
  let malformed = 0
  let stableRelease: FlathubRelease | undefined
  for (const entry of value) {
    if (!isRecord(entry)) { malformed += 1; continue }
    const type = exactText(entry.type)
    const version = exactText(entry.version)
    const timestamp = decimalStringInteger(entry.timestamp)
    if (!type || !version || timestamp === undefined) { malformed += 1; continue }
    const date = new Date(timestamp * 1000)
    if (Number.isNaN(date.getTime()) || timestamp > Math.floor(Date.now() / 1000) + 86_400) { malformed += 1; continue }
    if (type === 'stable' && !stableRelease) stableRelease = { version, timestamp, date: date.toISOString().slice(0, 10) }
  }
  return { stableRelease, malformed }
}

const parseScreenshots = (value: unknown, appId: string): { screenshots: FlathubScreenshot[]; malformed: number; duplicates: number } => {
  if (!Array.isArray(value)) return { screenshots: [], malformed: 1, duplicates: 0 }
  const screenshots: FlathubScreenshot[] = []
  const seen = new Set<string>()
  let malformed = 0
  let duplicates = 0
  const appMediaPrefix = `/media/${appId.replaceAll('.', '/')}/`
  for (const entry of value) {
    if (!isRecord(entry)) { malformed += 1; continue }
    const caption = exactText(entry.caption)
    const isDefault = entry.default === true
    if (!caption || (entry.default !== undefined && entry.default !== null && typeof entry.default !== 'boolean') || !Array.isArray(entry.sizes)) {
      malformed += 1
      continue
    }
    const sizes: Array<{ src: string; width: number; height: number }> = []
    for (const size of entry.sizes) {
      if (!isRecord(size)) { malformed += 1; continue }
      const src = strictHttpsUrl(size.src, 'dl.flathub.org', false)
      const width = decimalStringInteger(size.width)
      const height = decimalStringInteger(size.height)
      let providerPath = false
      if (src) providerPath = new URL(src).pathname.startsWith(appMediaPrefix)
      if (!src || !providerPath || width === undefined || height === undefined) { malformed += 1; continue }
      sizes.push({ src, width, height })
    }
    const preferred = sizes.sort((left, right) => (right.width * right.height) - (left.width * left.height))[0]
    if (!preferred) continue
    if (seen.has(preferred.src)) { duplicates += 1; continue }
    seen.add(preferred.src)
    screenshots.push({ caption, isDefault, ...preferred })
  }
  return { screenshots, malformed, duplicates }
}

const parseLinks = (value: unknown): { links: FlathubLinks; malformed: number } => {
  if (!isRecord(value)) return { links: {}, malformed: 1 }
  const links: FlathubLinks = {}
  let malformed = 0
  for (const [key, label] of [['homepage', 'homepage'], ['vcs_browser', 'source']] as const) {
    const candidate = value[key]
    if (candidate === undefined || candidate === null) continue
    const url = strictHttpsUrl(candidate)
    if (!url) malformed += 1
    else links[label] = url
  }
  return { links, malformed }
}

export const parseFlathubAppstreamResponse = (data: unknown, executedRequest?: ExecutedRequestContext): { request?: FlathubAppstreamRequest; result?: FlathubAppstreamResult; invalidReason?: string } => {
  const request = parseFlathubAppstreamRequest(executedRequest)
  if (!request) return { invalidReason: 'The successful response was not tied to the exact supported Flathub AppStream GET request.' }
  if (!isRecord(data)) return { request, invalidReason: 'Flathub did not return an AppStream application object.' }
  const id = exactText(data.id)
  const name = exactText(data.name)
  const summary = exactText(data.summary)
  const developer = exactText(data.developer_name)
  const projectLicense = exactText(data.project_license)
  if (!id || id !== request.appId || !name || !summary || !developer || !projectLicense || typeof data.is_free_license !== 'boolean') {
    return { request, invalidReason: 'Flathub core application identity, summary, developer, or license evidence was missing, malformed, or did not match the executed app ID.' }
  }

  const bundle = parseBundle(data.bundle, id)
  const launchable = parseLaunchable(data.launchable)
  const releases = parseReleases(data.releases)
  const screenshots = parseScreenshots(data.screenshots, id)
  const urls = parseLinks(data.urls)
  let malformed = releases.malformed + screenshots.malformed + urls.malformed
  if (!bundle) malformed += 1
  if (!launchable) malformed += 1
  return { request, result: {
    id,
    name,
    summary,
    developer,
    projectLicense,
    isFreeLicense: data.is_free_license,
    bundle,
    launchable,
    stableRelease: releases.stableRelease,
    screenshots: screenshots.screenshots,
    links: urls.links,
    malformed,
    duplicates: screenshots.duplicates,
  } }
}

const attributes = (request?: FlathubAppstreamRequest, result?: FlathubAppstreamResult) => ({
  'data-domain-card': 'flathub-appstream',
  'data-request-bound': request ? 'true' : 'false',
  'data-request-contract': 'exact-flathub-appstream-v1',
  'data-request-app-id': request?.appId,
  'data-provider-app-id': result?.id,
  'data-stable-release-version': result?.stableRelease?.version,
  'data-bundle-identity': result?.bundle?.value,
  'data-runtime-identity': result?.bundle?.runtime,
  'data-screenshot-count': result?.screenshots.length,
  'data-malformed-evidence-count': result?.malformed,
  'data-duplicate-evidence-count': result?.duplicates,
})

export function FlathubAppstreamPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseFlathubAppstreamResponse(data, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attributes(parsed.request)} data-result-state="invalid"><h3>Invalid Flathub AppStream response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result } = parsed
  const partial = result.malformed > 0 || result.duplicates > 0 || !result.bundle || !result.launchable || !result.stableRelease || !result.screenshots.length
  return <div className="domain-card flathub-appstream-preview bounded-media-preview" {...attributes(request, result)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">Flathub · AppStream profile</small><h3>{result.name}</h3><p>{result.summary}</p></div><span className={`domain-state${partial ? ' warning' : ''}`}>{partial ? 'Partial metadata' : 'Verified profile'}</span></header>
    {partial ? <p className="domain-note">Only exact-request-bound AppStream fields that passed strict identity, wire-type, and URL checks are shown. Missing or malformed optional evidence is not fabricated.</p> : null}
    <dl className="domain-facts"><div><dt>Application ID</dt><dd><code>{result.id}</code></dd></div><div><dt>Developer</dt><dd>{result.developer}</dd></div><div><dt>Project license</dt><dd>{result.projectLicense}</dd></div><div><dt>Stable release</dt><dd>{result.stableRelease ? <><b>{result.stableRelease.version}</b> · <time dateTime={result.stableRelease.date}>{result.stableRelease.date}</time></> : 'Unavailable'}</dd></div></dl>
    <p className="domain-note">Free-license signal: {result.isFreeLicense ? 'yes' : 'no'} (provider-supplied). AppStream license text remains the source of truth.</p>
    <section aria-label="Flatpak identity"><h4>Flatpak identity</h4>{result.bundle ? <dl className="domain-facts"><div><dt>Bundle</dt><dd><code>{result.bundle.value}</code></dd></div><div><dt>Runtime</dt><dd><code>{result.bundle.runtime}</code></dd></div><div><dt>Architecture</dt><dd>{result.bundle.architecture}</dd></div><div><dt>Branch</dt><dd>{result.bundle.branch}</dd></div></dl> : <p>Flatpak bundle and runtime identity unavailable.</p>}{result.launchable ? <p>Desktop launchable: <code>{result.launchable}</code></p> : null}</section>
    <section aria-label="Current stable release"><h4>Current stable release</h4>{result.stableRelease ? <p><b>{result.stableRelease.version}</b> · released <time dateTime={result.stableRelease.date}>{result.stableRelease.date}</time>. Provider release-note HTML is intentionally not rendered.</p> : <p>Stable release unavailable.</p>}</section>
    {(result.links.homepage || result.links.source) ? <nav aria-label="AppStream project links">{result.links.homepage ? <a href={result.links.homepage} target="_blank" rel="noreferrer">Project website</a> : null}{result.links.source ? <a href={result.links.source} target="_blank" rel="noreferrer">Source repository</a> : null}</nav> : null}
    {result.screenshots.length ? <div className="media-preview">{result.screenshots.slice(0, 6).map((screenshot) => <article key={screenshot.src} data-screenshot-url={screenshot.src} data-screenshot-width={screenshot.width} data-screenshot-height={screenshot.height} data-screenshot-default={screenshot.isDefault ? 'true' : 'false'}><img src={screenshot.src} alt={screenshot.caption} width={screenshot.width} height={screenshot.height} loading="lazy"/><div><small>{screenshot.isDefault ? 'Default screenshot' : 'AppStream screenshot'}</small><h3>{screenshot.caption}</h3><p>{screenshot.width} × {screenshot.height} provider pixels</p></div></article>)}</div> : <p className="domain-note">No trustworthy screenshot metadata was available; no image placeholder was fabricated.</p>}
  </div>
}
