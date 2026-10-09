import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardHeading, finite, text } from './cardPrimitives'
import { SemanticCards } from './SemanticCards'
import { nonNegativeInteger } from './semanticValidation'

const OPEN5E_HOST = 'api.open5e.com'
const OPEN5E_PATH = '/v2/creatures/'
const OPEN5E_LIMIT = 8
const OPEN5E_FIELDS = 'name,key,document,type,size,challenge_rating,armor_class,hit_points,hit_dice,speed,alignment,passive_perception'
const OPEN5E_DOCUMENT_FIELDS = 'name,key,gamesystem'
const OPEN5E_QUERY_KEYS = ['name__icontains', 'limit', 'fields', 'document__fields'] as const

type Open5eRequest = { query: string; limit: number }
type Open5eRequestIdentity = { request?: Open5eRequest; transportBound: boolean; invalidReason?: string }

const parseOpen5eRequest = (requestUrl?: string): Open5eRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== OPEN5E_HOST || url.port || url.username || url.password || url.pathname !== OPEN5E_PATH || url.hash) return undefined
    const keys = [...url.searchParams.keys()]
    if (keys.length !== OPEN5E_QUERY_KEYS.length || OPEN5E_QUERY_KEYS.some((key) => url.searchParams.getAll(key).length !== 1) || keys.some((key) => !OPEN5E_QUERY_KEYS.includes(key as typeof OPEN5E_QUERY_KEYS[number]))) return undefined
    const query = url.searchParams.get('name__icontains')?.trim()
    if (!query || url.searchParams.get('limit') !== String(OPEN5E_LIMIT) || url.searchParams.get('fields') !== OPEN5E_FIELDS || url.searchParams.get('document__fields') !== OPEN5E_DOCUMENT_FIELDS) return undefined
    return { query, limit: OPEN5E_LIMIT }
  } catch {
    return undefined
  }
}

const bindOpen5eRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): Open5eRequestIdentity => {
  const request = parseOpen5eRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported Open5e V2 creature-name request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET Open5e V2 creature-name request.' }
  }
  const executed = parseOpen5eRequest(executedRequest.url)
  if (!executed || executed.query !== request.query || executed.limit !== request.limit) {
    return { request, transportBound: false, invalidReason: 'The displayed Open5e request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const requestAttrs = (request?: Open5eRequest, transportBound = false) => ({
  'data-domain-card': 'monster-statblock',
  'data-api-version': 'v2',
  'data-request-contract': 'exact-open5e-monster-search-v2',
  'data-request-bound': request && transportBound ? 'true' : 'false',
  ...(request ? { 'data-request-query': request.query, 'data-request-limit': request.limit } : {}),
})

function Open5eEmpty({ request, transportBound, state, title, detail }: { request?: Open5eRequest; transportBound?: boolean; state: 'invalid' | 'empty' | 'partial'; title: string; detail: string }) {
  return <div className="domain-card domain-empty" {...requestAttrs(request, transportBound)} data-result-state={state}><h3>{title}</h3><p>{detail}</p></div>
}

const display = (value: unknown) => text(value) ?? (finite(value) !== undefined ? String(finite(value)) : 'Not supplied')
const nestedName = (value: unknown) => text(asRecord(value).name) ?? 'Not supplied'

const speedSummary = (value: unknown) => {
  const speed = asRecord(value)
  const unit = text(speed.unit) ?? 'feet'
  const modes = ['walk', 'fly', 'burrow', 'climb', 'swim']
    .flatMap((mode) => finite(speed[mode]) === undefined ? [] : [`${mode} ${finite(speed[mode])} ${unit}`])
  return modes.length ? modes.join(' · ') : 'Not supplied'
}

export function Open5eMonsterPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const identity = bindOpen5eRequest(requestUrl, executedRequest)
  const request = identity.request
  if (!request || identity.invalidReason) {
    return <Open5eEmpty request={request} transportBound={identity.transportBound} state="invalid" title="Invalid Open5e request evidence" detail={identity.invalidReason ?? 'The successful response could not be bound to the exact Open5e V2 creature-name request used by this demo.'}/>
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return <Open5eEmpty request={request} transportBound={identity.transportBound} state="invalid" title="Invalid Open5e creature response" detail="The Open5e V2 response was not the documented paginated result object."/>
  }

  const root = asRecord(data)
  if (!Array.isArray(root.results)) {
    return <Open5eEmpty request={request} transportBound={identity.transportBound} state="invalid" title="Invalid Open5e creature response" detail="The Open5e V2 response did not include the documented results array."/>
  }

  const providerRecords = root.results
  const providerTotal = nonNegativeInteger(root.count)
  const paginationMalformed = providerTotal === undefined
  if (!providerRecords.length) {
    if (providerTotal === 0) return <Open5eEmpty request={request} transportBound={identity.transportBound} state={identity.transportBound ? 'empty' : 'partial'} title={identity.transportBound ? 'No Open5e creatures returned' : 'Open5e result not request-bound'} detail={identity.transportBound ? `The V2 creature search returned zero source records whose name contains “${request.query}”.` : `Open5e returned a coherent zero-result search for “${request.query}”, but executed request evidence was unavailable.`}/>
    return <Open5eEmpty request={request} transportBound={identity.transportBound} state="invalid" title="Invalid Open5e creature response" detail="The Open5e result list was empty but its provider count did not describe a trustworthy zero-result search."/>
  }

  const query = request.query.toLowerCase()
  const identityRows = providerRecords.map(asRecord).filter((entry) => Boolean(text(entry.key) && text(entry.name)))
  const invalidRecordCount = providerRecords.length - identityRows.length
  const results = identityRows.filter((entry) => text(entry.name)!.toLowerCase().includes(query))
  const queryMismatchCount = identityRows.length - results.length
  if (!results.length) {
    return <Open5eEmpty request={request} transportBound={identity.transportBound} state="invalid" title="Invalid Open5e creature response" detail="The provider returned creature rows, but none could be trusted as matches for the displayed creature-name search."/>
  }

  const countConsistent = providerTotal !== undefined && providerTotal >= providerRecords.length
  const limitConsistent = providerRecords.length <= request.limit
  const resultState = !identity.transportBound || invalidRecordCount || queryMismatchCount || paginationMalformed || !countConsistent || !limitConsistent ? 'partial' : 'ready'
  const visible = results.slice(0, request.limit)
  const first = visible[0]
  const firstDocument = asRecord(first.document)
  const firstSystem = asRecord(firstDocument.gamesystem)
  const cards = visible.map((monster) => {
    const document = asRecord(monster.document)
    const gameSystem = asRecord(document.gamesystem)
    const name = text(monster.name)!
    const type = nestedName(monster.type)
    const size = nestedName(monster.size)
    return {
      title: name,
      eyebrow: `${size} ${type}`,
      badge: `CR ${display(monster.challenge_rating)}`,
      metrics: [
        { label: 'Armor class', value: display(monster.armor_class) },
        { label: 'Hit points', value: display(monster.hit_points) },
        { label: 'Hit dice', value: display(monster.hit_dice) },
        { label: 'Movement', value: speedSummary(monster.speed) },
        { label: 'Alignment', value: display(monster.alignment) },
        { label: 'Passive perception', value: display(monster.passive_perception) },
        { label: 'Source', value: display(document.name) },
        { label: 'Game system', value: display(gameSystem.name) },
      ],
      tags: [text(monster.key), text(document.key), text(gameSystem.key)].filter((value): value is string => Boolean(value)),
    }
  })

  const totalLabel = providerTotal === undefined ? `${results.length} trusted creature source record${results.length === 1 ? '' : 's'}` : `${providerTotal.toLocaleString('en')} matching creature source record${providerTotal === 1 ? '' : 's'}`
  return <div className="domain-card open5e-monster-preview" {...requestAttrs(request, identity.transportBound)} data-result-state={resultState} data-provider-total={providerTotal ?? ''} data-provider-record-count={providerRecords.length} data-valid-record-count={results.length} data-invalid-record-count={invalidRecordCount} data-query-mismatch-count={queryMismatchCount} data-count-contract={countConsistent ? 'valid' : 'invalid'} data-limit-contract={limitConsistent ? 'valid' : 'invalid'} data-visible-count={visible.length} data-primary-monster-key={text(first.key) ?? ''} data-primary-monster-name={text(first.name) ?? ''} data-primary-source={text(firstDocument.name) ?? ''} data-primary-game-system={text(firstSystem.name) ?? ''}>
    <CardHeading eyebrow="Open5e V2 · creatures" title={totalLabel} description={`${identity.transportBound ? 'Exact-request-bound' : 'Structurally coherent but not request-bound'}, case-insensitive creature-name matches for “${request.query}”, with source-aware combat statistics. Different published versions remain distinct across source documents or game systems.`}><span className="domain-state">{resultState === 'ready' ? `${visible.length} shown` : 'Partial provider response'}</span></CardHeading>
    {resultState === 'partial' && <p className="domain-note">{identity.transportBound ? 'This Open5e response is incomplete, structurally inconsistent, or contains rows outside the executed name search. The card shows only trustworthy matching rows and does not invent missing creatures.' : 'The Open5e response is structurally coherent, but executed request evidence was unavailable, so it is not marked ready.'}</p>}
    <SemanticCards cards={cards} emptyTitle="No creature records available"/>
    <p className="domain-note">Open5e V2 is the provider's current API. Exact request evidence binds ready results to the bodyless GET used by this demo; projected source/game-system labels explain why the same monster name can legitimately appear in multiple records.</p>
  </div>
}
