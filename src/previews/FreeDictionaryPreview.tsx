import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, trimmedText } from './semanticValidation'

const API_ORIGIN = 'https://freedictionaryapi.com'
const REQUEST_CONTRACT = 'exact-free-dictionary-english-word-bodyless-get'

type DictionaryRequest = { word: string }
type RequestBinding = { request?: DictionaryRequest; valid: boolean; bound: boolean }
type Sense = { definition: string; example?: string; synonyms: string[]; antonyms: string[] }
type Entry = { partOfSpeech: string; phonetic?: string; senses: Sense[]; synonyms: string[]; antonyms: string[] }
type SourceEvidence = { url: string; licenseName: string; licenseUrl: string }
type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'

const textList = (value: unknown): string[] => Array.isArray(value)
  ? value.map(trimmedText).filter((item): item is string => item !== undefined)
  : []

const parseRequestUrl = (api: ApiDemo, value?: string): DictionaryRequest | undefined => {
  if (api.id !== 'free-dictionary' || !value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.origin !== API_ORIGIN || url.username || url.password || url.port || url.search || url.hash) return undefined
    const match = /^\/api\/v1\/entries\/en\/([^/]+)$/.exec(url.pathname)
    if (!match) return undefined
    const word = decodeURIComponent(match[1])
    if (!word.trim()) return undefined
    return api.buildUrl({ word }) === value ? { word } : undefined
  } catch {
    return undefined
  }
}

const bindRequest = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext): RequestBinding => {
  const displayed = parseRequestUrl(api, requestUrl)
  if (!displayed) return { valid: false, bound: false }
  if (!executedRequest) return { request: displayed, valid: true, bound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) return { request: displayed, valid: false, bound: false }
  const executed = parseRequestUrl(api, executedRequest.url)
  return executed?.word === displayed.word
    ? { request: executed, valid: true, bound: true }
    : { request: displayed, valid: false, bound: false }
}

const parseSource = (value: unknown): SourceEvidence | undefined => {
  if (!isRecord(value) || !isRecord(value.license)) return undefined
  const url = trimmedText(value.url)
  const licenseName = trimmedText(value.license.name)
  const licenseUrl = trimmedText(value.license.url)
  if (!url || !licenseName || !licenseUrl) return undefined
  try {
    const source = new URL(url)
    const license = new URL(licenseUrl)
    if (source.protocol !== 'https:' || source.hostname !== 'en.wiktionary.org' || license.protocol !== 'https:' || !license.hostname.endsWith('creativecommons.org')) return undefined
    return { url, licenseName, licenseUrl }
  } catch {
    return undefined
  }
}

const parseSense = (value: unknown): Sense | undefined => {
  if (!isRecord(value)) return undefined
  const definition = trimmedText(value.definition)
  if (!definition) return undefined
  return {
    definition,
    example: textList(value.examples)[0],
    synonyms: textList(value.synonyms),
    antonyms: textList(value.antonyms),
  }
}

const parseEntry = (value: unknown): Entry | undefined => {
  if (!isRecord(value) || !isRecord(value.language) || value.language.code !== 'en') return undefined
  const partOfSpeech = trimmedText(value.partOfSpeech)
  if (!partOfSpeech || !Array.isArray(value.senses)) return undefined
  const senses = value.senses.map(parseSense).filter((item): item is Sense => item !== undefined)
  if (!senses.length) return undefined
  const pronunciations = Array.isArray(value.pronunciations) ? value.pronunciations.filter(isRecord) : []
  const ipa = pronunciations.find((item) => item.type === 'ipa' && trimmedText(item.text))
  const anyPronunciation = pronunciations.find((item) => trimmedText(item.text))
  return {
    partOfSpeech,
    phonetic: trimmedText(ipa?.text) ?? trimmedText(anyPronunciation?.text),
    senses,
    synonyms: textList(value.synonyms),
    antonyms: textList(value.antonyms),
  }
}

const StateCard = ({ state, attrs, title, detail }: { state: Exclude<ResultState, 'ready'>; attrs: Record<string, string | undefined>; title: string; detail: string }) => (
  <section className="domain-card domain-empty" aria-label="Free Dictionary response evidence" data-domain-card="free-dictionary" data-result-state={state} {...attrs}>
    <h3>{title}</h3><p>{detail}</p>
  </section>
)

export function FreeDictionaryPreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const binding = bindRequest(api, requestUrl, executedRequest)
  const root = isRecord(data) ? data : undefined
  const providerWord = root ? trimmedText(root.word) : undefined
  const responseWordMatch = binding.request ? providerWord === binding.request.word : false
  const providerEntries = root && Array.isArray(root.entries) ? root.entries : undefined
  const entries = (providerEntries ?? []).map(parseEntry).filter((item): item is Entry => item !== undefined)
  const invalidCount = (providerEntries?.length ?? 0) - entries.length
  const source = root ? parseSource(root.source) : undefined
  const attrs = {
    'data-request-bound': String(binding.bound),
    'data-request-contract': REQUEST_CONTRACT,
    'data-requested-word': binding.request?.word,
    'data-provider-word': providerWord,
    'data-response-word-match': String(responseWordMatch),
    'data-provider-entry-count': String(providerEntries?.length ?? 0),
    'data-valid-entry-count': String(entries.length),
    'data-invalid-entry-count': String(invalidCount),
    'data-source-valid': String(Boolean(source)),
  }

  if (!binding.valid || !root || !providerEntries || !providerWord || !responseWordMatch) {
    return <StateCard state="invalid" attrs={attrs} title="Dictionary response not trusted" detail="The successful response was not bound to the exact supported English-word request, or the provider word identity contradicted that request."/>
  }
  if (!providerEntries.length) {
    return binding.bound && source
      ? <StateCard state="empty" attrs={attrs} title="No dictionary entries returned" detail={`FreeDictionaryAPI.com returned no English entries for “${providerWord}”.`}/>
      : <StateCard state="partial" attrs={attrs} title="Unbound empty dictionary response" detail="The provider returned an empty entry list, but executed-request or source evidence is incomplete."/>
  }
  if (!entries.length) {
    return <StateCard state="invalid" attrs={attrs} title="Dictionary entry evidence unavailable" detail="Entries were returned, but none contained the documented English language, part-of-speech, and definition evidence required for a semantic result."/>
  }

  const state: ResultState = binding.bound && source && invalidCount === 0 ? 'ready' : 'partial'
  const phonetic = entries.find((entry) => entry.phonetic)?.phonetic ?? 'Pronunciation unavailable'
  return <section className="dictionary-preview" aria-label="Free Dictionary response evidence" data-domain-card="free-dictionary" data-result-state={state} {...attrs}>
    {state === 'partial' && <p className="domain-note">Only valid English entries with documented definition fields are shown. The response remains partial while request, source, or row evidence is incomplete.</p>}
    <div className="dictionary-hero"><div><span>English dictionary</span><strong>{providerWord}</strong><b>{phonetic}</b></div><span aria-hidden="true">Aa</span></div>
    <div className="dictionary-meanings">{entries.slice(0, 8).map((entry, index) => {
      const synonyms = [...new Set([...entry.synonyms, ...entry.senses.flatMap((sense) => sense.synonyms)])].slice(0, 6)
      const antonyms = [...new Set([...entry.antonyms, ...entry.senses.flatMap((sense) => sense.antonyms)])].slice(0, 6)
      return <section key={`${entry.partOfSpeech}-${index}`}><header><span>{index + 1}</span><h3>{entry.partOfSpeech}</h3></header><ol>{entry.senses.slice(0, 3).map((sense, senseIndex) => <li key={`${sense.definition}-${senseIndex}`}><p>{sense.definition}</p>{sense.example && <blockquote>“{sense.example}”</blockquote>}</li>)}</ol>{synonyms.length ? <footer><b>Synonyms</b>{synonyms.map((synonym) => <span key={synonym}>{synonym}</span>)}</footer> : null}{antonyms.length ? <footer><b>Antonyms</b>{antonyms.map((antonym) => <span key={antonym}>{antonym}</span>)}</footer> : null}</section>
    })}</div>
    {source && <p className="domain-note">Source: <a href={source.url} target="_blank" rel="noreferrer">Wiktionary</a> · <a href={source.licenseUrl} target="_blank" rel="noreferrer">{source.licenseName}</a> · via FreeDictionaryAPI.com</p>}
  </section>
}
