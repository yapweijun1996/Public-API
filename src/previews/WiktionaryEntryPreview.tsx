import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { cleanText, textArray } from './previewData'
import { isRecord, trimmedText } from './semanticValidation'

const API_ORIGIN = 'https://en.wiktionary.org'
const REQUEST_CONTRACT = 'exact-wiktionary-english-definition-bodyless-get'

type WiktionaryRequest = { word: string }
type RequestBinding = { request?: WiktionaryRequest; valid: boolean; bound: boolean }
type Definition = { definition: string; example?: string; synonyms: string[] }
type Entry = { partOfSpeech: string; definitions: Definition[]; synonyms: string[] }
type ResultState = 'ready' | 'partial' | 'invalid'

const parseRequestUrl = (api: ApiDemo, value?: string): WiktionaryRequest | undefined => {
  if (api.id !== 'wiktionary-entry' || !value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.origin !== API_ORIGIN || url.username || url.password || url.port || url.search || url.hash) return undefined
    const match = /^\/api\/rest_v1\/page\/definition\/([^/]+)$/.exec(url.pathname)
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
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request: displayed, valid: false, bound: false }
  }
  const executed = parseRequestUrl(api, executedRequest.url)
  return executed?.word === displayed.word
    ? { request: executed, valid: true, bound: true }
    : { request: displayed, valid: false, bound: false }
}

const parseDefinition = (value: unknown): Definition | undefined => {
  if (!isRecord(value)) return undefined
  const definition = cleanText(value.definition)
  if (!definition) return undefined
  return {
    definition,
    example: textArray(value.examples)[0],
    synonyms: textArray(value.synonyms),
  }
}

const parseEntry = (value: unknown): Entry | undefined => {
  if (!isRecord(value)) return undefined
  const language = trimmedText(value.language)
  const partOfSpeech = trimmedText(value.partOfSpeech)
  if (language !== 'English' || !partOfSpeech || !Array.isArray(value.definitions)) return undefined
  const definitions = value.definitions.map(parseDefinition).filter((item): item is Definition => item !== undefined)
  if (!definitions.length) return undefined
  return {
    partOfSpeech,
    definitions,
    synonyms: textArray(value.synonyms),
  }
}

const StateCard = ({ state, attrs, title, detail }: { state: ResultState; attrs: Record<string, string | undefined>; title: string; detail: string }) => (
  <section className="domain-card domain-empty" aria-label="Wiktionary response evidence" data-domain-card="wiktionary-entry" data-result-state={state} {...attrs}>
    <h3>{title}</h3><p>{detail}</p>
  </section>
)

export function WiktionaryEntryPreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const binding = bindRequest(api, requestUrl, executedRequest)
  const root = isRecord(data) ? data : undefined
  const providerLanguageEntries = root
    ? Object.entries(root).filter(([, value]) => Array.isArray(value))
    : []
  const englishProviderEntries = root && Array.isArray(root.en) ? root.en : undefined
  const entries = (englishProviderEntries ?? []).map(parseEntry).filter((entry): entry is Entry => entry !== undefined)
  const invalidEnglishEntryCount = (englishProviderEntries?.length ?? 0) - entries.length
  const ignoredNonEnglishEntryCount = providerLanguageEntries
    .filter(([languageCode]) => languageCode !== 'en')
    .reduce((total, [, value]) => total + (value as unknown[]).length, 0)
  const attrs = {
    'data-request-bound': String(binding.bound),
    'data-request-contract': REQUEST_CONTRACT,
    'data-requested-word': binding.request?.word,
    'data-provider-language-count': String(providerLanguageEntries.length),
    'data-english-entry-count': String(entries.length),
    'data-invalid-english-entry-count': String(invalidEnglishEntryCount),
    'data-ignored-non-english-entry-count': String(ignoredNonEnglishEntryCount),
  }

  if (!binding.valid || !root) {
    return <StateCard state="invalid" attrs={attrs} title="Wiktionary response not trusted" detail="The successful response was not bound to the exact supported English Wiktionary definition request."/>
  }
  if (!englishProviderEntries || !entries.length) {
    return <StateCard state="invalid" attrs={attrs} title="English definition evidence unavailable" detail="Wiktionary returned HTTP-success data without a usable English definition entry for this request."/>
  }

  const state: ResultState = binding.bound && invalidEnglishEntryCount === 0 ? 'ready' : 'partial'
  return <section className="dictionary-preview wiktionary-preview" aria-label="Wiktionary response evidence" data-domain-card="wiktionary-entry" data-result-state={state} {...attrs}>
    {state === 'partial' && <p className="domain-note">{!binding.bound ? 'English definitions are structurally usable, but executed-request identity is unavailable, so this result is not marked ready.' : 'Malformed English entries were withheld; only contract-valid definitions are shown.'}</p>}
    <div className="dictionary-hero"><div><span>English Wiktionary</span><strong>{binding.request?.word ?? 'Definition entry'}</strong><b>{entries.length} part{entries.length === 1 ? '' : 's'} of speech</b></div><span aria-hidden="true">W</span></div>
    <div className="dictionary-meanings">{entries.slice(0, 8).map((entry, index) => {
      const synonyms = [...new Set([...entry.synonyms, ...entry.definitions.flatMap((definition) => definition.synonyms)])].slice(0, 6)
      return <section key={`${entry.partOfSpeech}-${index}`}><header><span>{index + 1}</span><h3>{entry.partOfSpeech}</h3></header><ol>{entry.definitions.slice(0, 4).map((definition, definitionIndex) => <li key={`${definition.definition}-${definitionIndex}`}><p>{definition.definition}</p>{definition.example && <blockquote>“{definition.example}”</blockquote>}</li>)}</ol>{synonyms.length ? <footer><b>Related words</b>{synonyms.map((word) => <span key={word}>{word}</span>)}</footer> : null}</section>
    })}</div>
  </section>
}
