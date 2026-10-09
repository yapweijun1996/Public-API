import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, trimmedText } from './semanticValidation'

const REQUEST_CONTRACT = 'exact-poetrydb-author-random-bodyless-get'
const POETRYDB_ORIGIN = 'https://poetrydb.org'

type PoetryRequest = { author: string; count: number }
type PoetryTransport = { request?: PoetryRequest; valid: boolean; bound: boolean }
type Poem = { title: string; author: string; lines: string[]; linecount: number }
type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'

const apiOptionValues = (api: ApiDemo, fieldId: string) => api.fields.find((field) => field.id === fieldId)?.options?.map((option) => option.value) ?? []

const parseLineCount = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : undefined
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : undefined
  }
  return undefined
}

const parseRequestUrl = (api: ApiDemo, value?: string): PoetryRequest | undefined => {
  if (api.id !== 'poetrydb-poems' || !value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.origin !== POETRYDB_ORIGIN || url.username || url.password || url.port || url.search || url.hash) return undefined
    const match = /^\/author,random\/([^/]+);([1-4])\/title,author,lines,linecount$/.exec(url.pathname)
    if (!match) return undefined
    const author = decodeURIComponent(match[1]).trim()
    const count = Number(match[2])
    if (!apiOptionValues(api, 'author').includes(author) || !Number.isSafeInteger(count) || count < 1 || count > 4) return undefined
    const request = { author, count }
    return api.buildUrl({ author, count: String(count) }) === value ? request : undefined
  } catch {
    return undefined
  }
}

const bindRequest = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext): PoetryTransport => {
  const displayed = parseRequestUrl(api, requestUrl)
  if (!displayed) return { valid: false, bound: false }
  if (!executedRequest) return { request: displayed, valid: true, bound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) return { request: displayed, valid: false, bound: false }
  const executed = parseRequestUrl(api, executedRequest.url)
  return executed && executed.author === displayed.author && executed.count === displayed.count
    ? { request: executed, valid: true, bound: true }
    : { request: displayed, valid: false, bound: false }
}

const parsePoem = (value: unknown, request: PoetryRequest): Poem | undefined => {
  if (!isRecord(value)) return undefined
  const title = trimmedText(value.title)
  const author = trimmedText(value.author)
  const lines = Array.isArray(value.lines) && value.lines.every((line) => typeof line === 'string') ? value.lines as string[] : undefined
  const linecount = parseLineCount(value.linecount)
  if (!title || author !== request.author || !lines?.some((line) => line.trim()) || linecount === undefined) return undefined
  return { title, author, lines, linecount }
}

const evidence = (transport: PoetryTransport, providerCount: number, validCount: number, invalidCount: number, countMatch: boolean | undefined, providerAuthor?: string) => ({
  'data-request-bound': String(transport.bound),
  'data-request-contract': REQUEST_CONTRACT,
  'data-requested-author': transport.request?.author,
  'data-requested-count': transport.request ? String(transport.request.count) : undefined,
  'data-provider-author': providerAuthor,
  'data-provider-count': String(providerCount),
  'data-valid-poem-count': String(validCount),
  'data-invalid-poem-count': String(invalidCount),
  'data-count-match': countMatch === undefined ? 'unbound' : String(countMatch),
})

const StateCard = ({ state, attrs, title, detail }: { state: Exclude<ResultState, 'ready'>; attrs: Record<string, string | undefined>; title: string; detail: string }) => (
  <section className="domain-card domain-empty" aria-label="PoetryDB poem evidence" data-domain-card="poetrydb-poems" data-result-state={state} {...attrs}>
    <h3>{title}</h3>
    <p>{detail}</p>
  </section>
)

export function PoetryDbPreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const transport = bindRequest(api, requestUrl, executedRequest)
  const providerRows = Array.isArray(data) ? data : undefined
  const poems: Poem[] = []
  let invalidCount = 0
  const seen = new Set<string>()
  for (const row of providerRows ?? []) {
    const parsed = transport.request ? parsePoem(row, transport.request) : undefined
    const identity = parsed ? `${parsed.author}\u0000${parsed.title}` : undefined
    if (!parsed || (identity && seen.has(identity))) {
      invalidCount += 1
      continue
    }
    seen.add(identity as string)
    poems.push(parsed)
  }

  const providerCount = providerRows?.length ?? 0
  const countMatch = transport.request ? providerCount === transport.request.count : undefined
  const attrs = evidence(transport, providerCount, poems.length, invalidCount, countMatch, poems[0]?.author)
  if (!transport.valid || !providerRows) {
    return <StateCard state="invalid" attrs={attrs} title="Invalid PoetryDB response" detail="The successful response was not bound to the exact supported PoetryDB author/count request or was not a JSON poem list."/>
  }
  if (providerCount === 0) {
    return transport.bound
      ? <StateCard state="empty" attrs={attrs} title="No poems returned" detail={`PoetryDB returned a coherent empty response for ${transport.request?.author}.`}/>
      : <StateCard state="partial" attrs={attrs} title="Unbound empty poetry response" detail="PoetryDB returned an empty list, but executed request evidence is unavailable, so semantic emptiness is not trusted."/>
  }
  if (!poems.length) {
    return <StateCard state="invalid" attrs={attrs} title="Poem evidence unavailable" detail="PoetryDB returned rows, but none carried the selected author, title, lines, and line-count evidence required by the documented response shape."/>
  }

  const state: ResultState = transport.bound && invalidCount === 0 && countMatch === true ? 'ready' : 'partial'
  return <section className="dictionary-preview poetry-preview" aria-label="PoetryDB poem evidence" data-domain-card="poetrydb-poems" data-result-state={state} {...attrs}>
    {state === 'partial' && <p className="domain-note">Only poems with the selected provider author and complete documented fields are shown. The response is partial when count, row, or executed-request evidence is incomplete.</p>}
    <div className="dictionary-hero"><div><span>Public-domain reading room</span><strong>{transport.request?.author ?? poems[0]?.author}</strong><b>{poems.length} of {transport.request?.count ?? poems.length} requested poem{poems.length === 1 ? '' : 's'}</b></div><span aria-hidden="true">¶</span></div>
    <div className="dictionary-meanings">{poems.slice(0, 4).map((poem, index) => <section key={`${poem.author}-${poem.title}`}><header><span>{index + 1}</span><h3>{poem.title}</h3></header><ol><li><p>{poem.lines.filter((line) => line.trim()).slice(0, 6).join(' / ')}</p><blockquote>{poem.linecount} lines · {poem.author}</blockquote></li></ol></section>)}</div>
  </section>
}
