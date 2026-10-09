import { useId, useState } from 'react'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardHeading, DateValue, Facts, isoDate, text } from './cardPrimitives'

type LifecycleRequest = { product: string }
type BoundLifecycleRequest = { request?: LifecycleRequest; transportBound: boolean; invalidReason?: string }

export const parseLifecycleRequest = (requestUrl?: string): LifecycleRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const match = url.pathname.match(/^\/api\/v1\/products\/([^/]+)$/)
    if (url.protocol !== 'https:' || url.hostname !== 'endoflife.date' || url.port || url.search || url.hash || url.username || url.password || !match) return undefined
    const product = decodeURIComponent(match[1])
    if (!/^[a-z0-9][a-z0-9-]*$/.test(product)) return undefined
    const canonical = `https://endoflife.date/api/v1/products/${encodeURIComponent(product)}`
    return requestUrl === canonical ? { product } : undefined
  } catch {
    return undefined
  }
}

const bindLifecycleRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): BoundLifecycleRequest => {
  if (!requestUrl) return { transportBound: false }
  const request = parseLifecycleRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported endoflife.date v1 product request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET endoflife.date product request.' }
  }
  const executed = parseLifecycleRequest(executedRequest.url)
  if (!executed || executed.product !== request.product) {
    return { request, transportBound: false, invalidReason: 'The displayed endoflife.date request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const releaseFlag = (value: unknown) => typeof value === 'boolean' ? value : undefined

export function lifecycleModel(data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext) {
  const rootValid = data !== null && typeof data === 'object' && !Array.isArray(data)
  const root = asRecord(data)
  const resultValue = root.result
  const resultValid = resultValue !== null && typeof resultValue === 'object' && !Array.isArray(resultValue)
  const product = asRecord(resultValue)
  const providerProduct = text(product.name)
  const binding = bindLifecycleRequest(requestUrl, executedRequest)
  const request = binding.request
  const identityMatch = request && providerProduct ? request.product === providerProduct : undefined
  const releasesShapeValid = Array.isArray(product.releases)
  const providerRows: unknown[] = Array.isArray(product.releases) ? product.releases : []
  const releases = providerRows.flatMap((value) => {
    const release = asRecord(value)
    const name = text(release.name)
    if (!name) return []
    const latestValue = release.latest
    const latest = latestValue !== null && typeof latestValue === 'object' && !Array.isArray(latestValue) ? text(asRecord(latestValue).name) : undefined
    return [{
      name,
      label: text(release.label),
      eol: releaseFlag(release.isEol),
      maintained: releaseFlag(release.isMaintained),
      lts: releaseFlag(release.isLts),
      releaseDate: isoDate(release.releaseDate),
      endDate: isoDate(release.eolFrom),
      activeEnd: isoDate(release.eoasFrom),
      extendedEnd: isoDate(release.eoesFrom),
      latest,
    }]
  })
  const providerRecords = releasesShapeValid ? providerRows.length : 0
  const validRecords = releases.length
  const invalidRecords = providerRecords - validRecords
  const responseValid = rootValid && resultValid && Boolean(providerProduct) && releasesShapeValid
  const structurallyInvalid = !responseValid || Boolean(binding.invalidReason) || identityMatch === false || providerRecords > 0 && validRecords === 0
  const state = structurallyInvalid
    ? 'invalid' as const
    : providerRecords === 0
      ? binding.transportBound ? 'empty' as const : 'partial' as const
      : invalidRecords > 0 || !binding.transportBound
        ? 'partial' as const
        : 'ready' as const
  return {
    product: text(product.label) ?? providerProduct,
    providerProduct,
    requestedProduct: request?.product,
    requestBound: binding.transportBound,
    identityMatch,
    requestValid: !binding.invalidReason,
    invalidReason: binding.invalidReason,
    responseValid,
    releasesShapeValid,
    providerRecords,
    validRecords,
    invalidRecords,
    state,
    contractValid: state === 'ready',
    updated: text(root.last_modified),
    releases,
  }
}

type LifecycleModel = ReturnType<typeof lifecycleModel>

const lifecycleEvidence = (model: LifecycleModel) => ({
  'data-request-bound': String(model.requestBound),
  'data-request-contract': 'exact-endoflife-date-product-v2',
  'data-requested-product': model.requestedProduct,
  'data-provider-product': model.providerProduct,
  'data-identity-match': model.identityMatch === undefined ? undefined : String(model.identityMatch),
  'data-contract-valid': String(model.contractValid),
  'data-provider-records': String(model.providerRecords),
  'data-valid-records': String(model.validRecords),
  'data-invalid-records': String(model.invalidRecords),
})

function LifecycleBoard({ model }: { model: LifecycleModel }) {
  const id = useId()
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(8)
  const evidence = lifecycleEvidence(model)

  if (model.state === 'invalid') {
    const identityMismatch = model.identityMatch === false && model.providerProduct && model.requestedProduct
    return <div className="domain-card domain-empty" data-domain-card="release-lifecycle" data-result-state="invalid" {...evidence}>
      <h3>{identityMismatch ? 'Lifecycle response identity mismatch' : 'Invalid lifecycle response'}</h3>
      <p>{identityMismatch
        ? 'The HTTP-success response product does not match the product in the executed endoflife.date request, so release details are withheld.'
        : model.invalidReason
          ? model.invalidReason
          : !model.releasesShapeValid
            ? 'The provider did not return the documented product releases array.'
            : 'The provider response did not contain a trustworthy product identity and release-cycle record.'}</p>
    </div>
  }

  if (model.state === 'empty') return <div className="domain-card domain-empty" data-domain-card="release-lifecycle" data-result-state="empty" {...evidence}><h3>Release information unavailable</h3><p>No release cycles were returned by the exact request-bound product response. Support status has not been inferred.</p></div>

  if (model.state === 'partial' && model.providerRecords === 0) return <div className="domain-card domain-empty" data-domain-card="release-lifecycle" data-result-state="partial" {...evidence}><h3>Release information not request-bound</h3><p>A coherent empty product response was returned, but executed-request evidence is unavailable, so this result is not claimed as semantic empty.</p></div>

  const releases = model.releases.filter((release) => filter === 'all' || filter === 'maintained' && release.maintained === true || filter === 'eol' && release.eol === true || filter === 'lts' && release.lts === true)
  return <div className="domain-card lifecycle-workbench" data-domain-card="release-lifecycle" data-result-state={model.state} {...evidence}>
    <CardHeading eyebrow="Software lifecycle" title={model.product ?? model.providerProduct ?? 'Lifecycle'} description="Compare release cycles and support dates from the provider response."/>
    {model.state === 'partial' && <p className="domain-note">{model.invalidRecords > 0
      ? `${model.invalidRecords} malformed release ${model.invalidRecords === 1 ? 'record was' : 'records were'} withheld instead of being presented as valid lifecycle data.`
      : 'The provider release data is structurally usable, but executed-request identity is unavailable, so this result is not marked ready.'}</p>}
    <Facts items={[{ label: 'Release cycles', value: model.releases.length }, { label: 'Some support available', value: model.releases.filter((r) => r.maintained === true).length }, { label: 'Marked end of life', value: model.releases.filter((r) => r.eol === true).length }, { label: 'Provider last modified', value: model.updated ?? 'Not supplied' }]}/>
    <div className="domain-toolbar"><label htmlFor={id}>Filter releases</label><select id={id} value={filter} onChange={(event) => { setFilter(event.target.value); setLimit(8) }}><option value="all">All releases</option><option value="maintained">Some support available</option><option value="eol">Marked end of life</option><option value="lts">LTS releases</option></select><span role="status">{Math.min(limit, releases.length)} of {releases.length} release cycles shown</span></div>
    <ol className="lifecycle-list" role="list" aria-label="Software release cycles">{releases.slice(0, limit).map((release) => <li key={release.name} data-release={release.name}>
      <header><div><span className="domain-eyebrow">Release cycle</span><h4>{model.product ?? model.providerProduct} {release.name}</h4>{release.label && <p>{release.label}</p>}</div><span className={`domain-state ${release.eol === true ? 'warning' : 'neutral'}`}>{release.eol === true ? 'End of life' : release.eol === false ? 'Not end of life' : 'EOL not supplied'}</span></header>
      <Facts items={[{ label: 'Support', value: release.maintained === true ? 'Some support available' : release.maintained === false ? 'Not maintained' : 'Not supplied' }, { label: 'LTS', value: release.lts === undefined ? 'Not supplied' : release.lts ? 'Yes' : 'No' }, { label: 'Latest in cycle', value: release.latest ?? 'Not supplied' }]}/>
      <div className="lifecycle-dates"><div><span>Released</span><DateValue value={release.releaseDate}/></div><span aria-hidden="true">→</span><div><span>End-of-life date</span><DateValue value={release.endDate}/></div></div>
      {(release.activeEnd || release.extendedEnd) && <details className="domain-disclosure"><summary>Support milestones for {model.product ?? model.providerProduct} {release.name}</summary><Facts items={[{ label: 'Active support ends', value: <DateValue value={release.activeEnd}/> }, { label: 'Extended support ends', value: <DateValue value={release.extendedEnd}/> }]}/></details>}
    </li>)}</ol>
    {!releases.length && <p className="domain-notice">No releases match this filter.</p>}
    {releases.length > limit && <button className="domain-more" type="button" onClick={() => setLimit((count) => count + 16)}>Show more releases</button>}
    <p className="domain-note">End-of-life and maintenance are separate provider flags. Some support may be extended or paid; this view is not a guarantee of security updates. Missing dates stay unknown.</p>
  </div>
}

export function LifecyclePreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = lifecycleModel(data, requestUrl, executedRequest)
  return <LifecycleBoard key={`${model.providerProduct ?? 'unknown'}:${model.requestedProduct ?? 'unbound'}`} model={model}/>
}
