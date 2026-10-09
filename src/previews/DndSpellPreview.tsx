import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, nonNegativeSafeInteger, trimmedText } from './semanticValidation'

const API_ORIGIN = 'https://www.dnd5eapi.co'
const REQUEST_CONTRACT = 'exact-dnd5e-2014-spell-bodyless-get'
const SPELL_INDEX_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const COMPONENTS = new Set(['V', 'S', 'M'])

type ResultState = 'ready' | 'partial' | 'invalid'
type SpellRequest = { spellIndex: string }
type SpellReference = { index: string; name: string; url: string }
type SpellViewModel = {
  state: ResultState
  reason?: string
  requestBound: boolean
  requestedSpellIndex?: string
  providerSpellIndex?: string
  providerUrl?: string
  name?: string
  level?: number
  school?: SpellReference
  range?: string
  castingTime?: string
  duration?: string
  concentration?: boolean
  ritual?: boolean
  components: string[]
  material?: string
  descriptions: string[]
  higherLevel: string[]
  classes: SpellReference[]
}

const parseRequestUrl = (api: ApiDemo, value?: string): SpellRequest | undefined => {
  if (api.id !== 'dnd5e-spell-lookup' || !value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.origin !== API_ORIGIN || url.username || url.password || url.port || url.search || url.hash) return undefined
    const match = /^\/api\/2014\/spells\/([^/]+)$/.exec(url.pathname)
    if (!match) return undefined
    const spellIndex = decodeURIComponent(match[1])
    if (!SPELL_INDEX_PATTERN.test(spellIndex)) return undefined
    return api.buildUrl({ spellIndex }) === value ? { spellIndex } : undefined
  } catch {
    return undefined
  }
}

const bindRequest = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext) => {
  const displayed = parseRequestUrl(api, requestUrl)
  if (!displayed) return { request: undefined, valid: false, bound: false } as const
  if (!executedRequest) return { request: displayed, valid: true, bound: false } as const
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request: displayed, valid: false, bound: false } as const
  }
  const executed = parseRequestUrl(api, executedRequest.url)
  return executed?.spellIndex === displayed.spellIndex
    ? { request: executed, valid: true, bound: true } as const
    : { request: displayed, valid: false, bound: false } as const
}

const textList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const values = value.map(trimmedText)
  return values.every((item): item is string => item !== undefined) ? values : undefined
}

const parseReference = (value: unknown, expectedPrefix: string): SpellReference | undefined => {
  if (!isRecord(value)) return undefined
  const index = trimmedText(value.index)
  const name = trimmedText(value.name)
  const url = trimmedText(value.url)
  if (!index || !SPELL_INDEX_PATTERN.test(index) || !name || !url || url !== `${expectedPrefix}${index}`) return undefined
  return { index, name, url }
}

const parseReferenceList = (value: unknown, expectedPrefix: string): SpellReference[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const parsed = value.map((item) => parseReference(item, expectedPrefix))
  return parsed.every((item): item is SpellReference => item !== undefined) ? parsed : undefined
}

export const buildDndSpellViewModel = (api: ApiDemo, data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): SpellViewModel => {
  const binding = bindRequest(api, requestUrl, executedRequest)
  const requestedSpellIndex = binding.request?.spellIndex
  const base = { requestBound: binding.bound, requestedSpellIndex, components: [], descriptions: [], higherLevel: [], classes: [] }
  if (!binding.valid || !requestedSpellIndex) {
    return { ...base, state: 'invalid', reason: 'The successful response was not bound to the exact supported D&D 5e 2014 spell GET request.' }
  }
  if (!isRecord(data)) return { ...base, state: 'invalid', reason: 'D&D 5e API returned an HTTP-success response that was not a spell object.' }

  const providerSpellIndex = trimmedText(data.index)
  const providerUrl = trimmedText(data.url)
  const name = trimmedText(data.name)
  const level = nonNegativeSafeInteger(data.level)
  const school = parseReference(data.school, '/api/2014/magic-schools/')
  const range = trimmedText(data.range)
  const castingTime = trimmedText(data.casting_time)
  const duration = trimmedText(data.duration)
  const descriptions = textList(data.desc)
  const higherLevel = textList(data.higher_level)
  const components = textList(data.components)
  const classes = parseReferenceList(data.classes, '/api/2014/classes/')
  const concentration = typeof data.concentration === 'boolean' ? data.concentration : undefined
  const ritual = typeof data.ritual === 'boolean' ? data.ritual : undefined
  const material = data.material === undefined || data.material === null ? undefined : trimmedText(data.material)
  const identityMatches = providerSpellIndex === requestedSpellIndex && providerUrl === `/api/2014/spells/${requestedSpellIndex}`
  const componentsValid = Boolean(components && components.length > 0 && new Set(components).size === components.length && components.every((component) => COMPONENTS.has(component)))
  const requiredValid = identityMatches && Boolean(
    name
    && level !== undefined && level <= 9
    && school
    && range
    && castingTime
    && duration
    && descriptions?.length
    && componentsValid
    && classes
    && concentration !== undefined
    && ritual !== undefined,
  )

  if (!requiredValid) {
    return {
      ...base,
      providerSpellIndex,
      providerUrl,
      state: 'invalid',
      reason: 'The provider spell identity or required 2014 spell fields contradicted the executed request or documented resource shape.',
    }
  }

  return {
    ...base,
    providerSpellIndex,
    providerUrl,
    name,
    level,
    school,
    range,
    castingTime,
    duration,
    concentration,
    ritual,
    components: components ?? [],
    material,
    descriptions: descriptions ?? [],
    higherLevel: higherLevel ?? [],
    classes: classes ?? [],
    state: binding.bound ? 'ready' : 'partial',
    reason: binding.bound ? undefined : 'The spell payload is structurally coherent and matches the displayed slug, but successful executed-request evidence is unavailable.',
  }
}

export function DndSpellPreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = buildDndSpellViewModel(api, data, requestUrl, executedRequest)
  const attrs = {
    'data-domain-card': 'dnd5e-spell',
    'data-result-state': model.state,
    'data-request-bound': String(model.requestBound),
    'data-request-contract': REQUEST_CONTRACT,
    'data-requested-spell-index': model.requestedSpellIndex,
    'data-provider-spell-index': model.providerSpellIndex,
    'data-provider-resource-url': model.providerUrl,
    'data-spell-index-match': String(Boolean(model.requestedSpellIndex && model.providerSpellIndex === model.requestedSpellIndex)),
  }

  if (model.state === 'invalid') {
    return <section className="domain-card domain-empty" aria-label="D&D 5e spell response evidence" {...attrs}><h3>D&amp;D spell response not trusted</h3><p>{model.reason}</p></section>
  }

  return <section className="dictionary-preview dnd-spell-preview" aria-label="D&D 5e spell response evidence" {...attrs}>
    {model.state === 'partial' && <p className="domain-note">{model.reason}</p>}
    <div className="dictionary-hero"><div><span>{model.school?.name} spell · Level {model.level}</span><strong>{model.name}</strong><b>{model.range} · {model.concentration ? 'Concentration' : 'No concentration'}</b></div><span aria-hidden="true">✦</span></div>
    <div className="dictionary-meanings"><section><header><span>1</span><h3>Effect</h3></header><ol>{model.descriptions.map((paragraph, index) => <li key={`${index}-${paragraph}`}><p>{paragraph}</p></li>)}</ol>{model.higherLevel.length ? <footer><b>At higher levels</b><span>{model.higherLevel.join(' ')}</span></footer> : null}</section></div>
    <dl className="country-facts"><div><dt>Casting time</dt><dd>{model.castingTime}</dd></div><div><dt>Components</dt><dd>{model.components.join(', ')}</dd></div><div><dt>Duration</dt><dd>{model.duration}</dd></div><div><dt>Classes</dt><dd>{model.classes.map((item) => item.name).join(', ') || 'None listed'}</dd></div></dl>
    {model.material && <p className="domain-note">Material: {model.material}</p>}
  </section>
}
