import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardHeading, finite, text } from './cardPrimitives'
import { SemanticCards } from './SemanticCards'

const partOfSpeechLabels: Record<string, string> = {
  n: 'Noun',
  v: 'Verb',
  adj: 'Adjective',
  adv: 'Adverb',
  u: 'Unclassified',
}

const DATAMUSE_QUERY_KEYS = ['sl', 'max', 'md', 'ipa'] as const

type DatamuseRequest = { query: string }
type DatamuseRequestIdentity = { request?: DatamuseRequest; transportBound: boolean; invalidReason?: string }

const stringTags = (value: unknown) => Array.isArray(value)
  ? value.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim()))
  : []

const pronunciation = (tags: string[]) => {
  const ipa = tags.find((tag) => tag.startsWith('ipa_pron:'))?.slice('ipa_pron:'.length).trim()
  if (ipa) return ipa
  return tags.find((tag) => tag.startsWith('pron:'))?.slice('pron:'.length).trim()
}

const partsOfSpeech = (tags: string[]) => tags
  .map((tag) => partOfSpeechLabels[tag])
  .filter((label): label is string => Boolean(label))
  .filter((label, index, all) => all.indexOf(label) === index)

export const parseDatamuseRequest = (requestUrl?: string): DatamuseRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'api.datamuse.com' || url.port || url.username || url.password
      || url.pathname !== '/words' || url.hash || keys.length !== DATAMUSE_QUERY_KEYS.length
      || DATAMUSE_QUERY_KEYS.some((key) => url.searchParams.getAll(key).length !== 1)
      || keys.some((key) => !DATAMUSE_QUERY_KEYS.includes(key as typeof DATAMUSE_QUERY_KEYS[number]))) return undefined
    const rawQuery = url.searchParams.get('sl') ?? ''
    const query = rawQuery.trim()
    if (!query || query !== rawQuery || url.searchParams.get('max') !== '8' || url.searchParams.get('md') !== 'psr' || url.searchParams.get('ipa') !== '1') return undefined
    return { query }
  } catch {
    return undefined
  }
}

const bindDatamuseRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): DatamuseRequestIdentity => {
  const request = parseDatamuseRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported Datamuse sounds-like request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET Datamuse sounds-like request.' }
  }
  const executed = parseDatamuseRequest(executedRequest.url)
  if (!executed || executed.query !== request.query) {
    return { request, transportBound: false, invalidReason: 'The displayed Datamuse request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const requestAttrs = (request?: DatamuseRequest, transportBound = false) => ({
  'data-domain-card': 'lexical-matches',
  'data-request-bound': request && transportBound ? 'true' : 'false',
  'data-request-contract': 'exact-datamuse-sounds-like-v2',
  'data-query-constraint': 'sl',
  'data-query-term': request?.query ?? '',
})

export function DatamuseWordPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const identity = bindDatamuseRequest(requestUrl, executedRequest)
  if (!identity.request || identity.invalidReason) {
    return <div className="domain-card domain-empty" {...requestAttrs(identity.request, false)} data-result-state="invalid"><h3>Invalid Datamuse request identity</h3><p>{identity.invalidReason}</p></div>
  }
  const { request, transportBound } = identity
  if (!Array.isArray(data)) return <div className="domain-card domain-empty" {...requestAttrs(request, transportBound)} data-result-state="invalid"><h3>Datamuse response is invalid</h3><p>The provider response was not the documented JSON list of word objects.</p></div>
  if (!data.length) return <div className="domain-card domain-empty" {...requestAttrs(request, transportBound)} data-result-state={transportBound ? 'empty' : 'partial'}><h3>{transportBound ? 'No pronunciation matches returned' : 'Datamuse result not request-bound'}</h3><p>{transportBound ? 'Datamuse returned an empty list, meaning no words or phrases matched this sounds-like query.' : `Datamuse returned a coherent empty list for “${request.query}”, but executed request evidence was unavailable.`}</p></div>

  const matches = data.map(asRecord).filter((match) => Boolean(text(match.word)))
  const invalidRecordCount = data.length - matches.length
  if (!matches.length) return <div className="domain-card domain-empty" {...requestAttrs(request, transportBound)} data-result-state="invalid"><h3>Datamuse response is invalid</h3><p>The provider returned records, but none included the required word identity documented for /words results.</p></div>

  const visible = matches.slice(0, 8)
  const firstTags = stringTags(visible[0].tags)
  const firstIpa = pronunciation(firstTags) ?? ''
  const cards = visible.map((match, index) => {
    const tags = stringTags(match.tags)
    const ipa = pronunciation(tags)
    const pos = partsOfSpeech(tags)
    const score = finite(match.score)
    const syllables = finite(match.numSyllables)
    return {
      title: text(match.word)!,
      eyebrow: `Sounds-like match · rank ${index + 1}`,
      badge: syllables === undefined ? undefined : `${syllables} syllable${syllables === 1 ? '' : 's'}`,
      metrics: [
        { label: 'Rank', value: `#${index + 1}` },
        { label: 'Pronunciation (IPA)', value: ipa ?? 'Not supplied' },
        { label: 'Part of speech', value: pos.join(', ') || 'Not supplied' },
        { label: 'Provider score', value: score === undefined ? 'Not supplied' : `${score} · ordering only` },
      ],
    }
  })
  const partial = !transportBound || invalidRecordCount > 0

  return <div className="domain-card datamuse-word-preview" {...requestAttrs(request, transportBound)} data-result-state={partial ? 'partial' : 'ready'} data-provider-record-count={data.length} data-valid-record-count={matches.length} data-invalid-record-count={invalidRecordCount} data-visible-count={visible.length} data-primary-word={text(visible[0].word) ?? ''} data-primary-ipa={firstIpa}>
    <CardHeading eyebrow="Datamuse · /words" title={`Sounds-like matches for “${request.query}”`} description="Matches use Datamuse's documented pronunciation-similarity constraint. Result order is meaningful; the numeric provider score has no interpretable magnitude beyond ranking."><span className={`domain-state${partial ? ' warning' : ''}`}>{visible.length} returned</span></CardHeading>
    <SemanticCards cards={cards} emptyTitle="No lexical matches available"/>
    {partial && <p className="domain-note" role="status">{transportBound ? `${invalidRecordCount} provider record${invalidRecordCount === 1 ? '' : 's'} omitted because the required word identity was missing.` : 'The Datamuse response is structurally coherent, but executed request evidence was unavailable, so it is not marked ready.'}</p>}
    <p className="domain-note">Datamuse attribution: lexical results are provided by the Datamuse API. Current keyless access ends after 2026-12-31; Datamuse says every request will require an API key starting 2027-01-01, so this browser-native demo must be re-evaluated before that date.</p>
  </div>
}
