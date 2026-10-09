import './semanticCards.css'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading, Facts } from './cardPrimitives'
import { isRecord } from './semanticValidation'

const DBLP_ENDPOINT = 'https://sparql.dblp.org/sparql'
const DBLP_HEAD_VARS = ['publ', 'title', 'year', 'venue', 'doi', 'authorName'] as const
const DBLP_QUERY_PATTERN = new RegExp([
  '^PREFIX dblp: <https://dblp\\.org/rdf/schema#>',
  'PREFIX rdfs: <http://www\\.w3\\.org/2000/01/rdf-schema#>',
  'SELECT \\?publ \\?title \\?year \\?venue \\?doi \\?authorName WHERE \\{',
  '  \\{',
  '    SELECT \\?publ \\?title WHERE \\{',
  '      \\?publ a dblp:Publication ; dblp:title \\?title \\.',
  '      FILTER\\(CONTAINS\\(LCASE\\(STR\\(\\?title\\)\\), LCASE\\("((?:[^"\\\\]|\\\\(?:\\\\|"|r|n))*?)"\\)\\)\\)',
  '    \\}',
  '    LIMIT ([1-9]\\d*)',
  '  \\}',
  '  OPTIONAL \\{ \\?publ dblp:yearOfPublication \\?year \\. \\}',
  '  OPTIONAL \\{ \\?publ dblp:publishedIn \\?venue \\. \\}',
  '  OPTIONAL \\{ \\?publ dblp:doi \\?doi \\. \\}',
  '  OPTIONAL \\{ \\?publ dblp:authoredBy \\?author \\. \\?author rdfs:label \\?authorName \\. \\}',
  '\\}',
  'ORDER BY \\?publ \\?authorName$',
].join('\\n'))

type DblpRequest = { query: string; limit: number }
type DblpCell = { value: string; type: string }

export type DblpPublication = {
  uri: string
  title: string
  year?: string
  venue?: string
  doi?: string
  authors: string[]
}

export type DblpViewModel = {
  state: 'ready' | 'partial' | 'empty' | 'invalid'
  request?: DblpRequest
  requestBound: boolean
  queryContract: boolean
  limitContract: boolean
  bindingCount: number
  publicationCount: number
  invalidRowCount: number
  malformedRowCount: number
  duplicateRowCount: number
  conflictCount: number
  wrongTitleRowCount: number
  overflowPublicationCount: number
  publications: DblpPublication[]
  message: string
}

const invalidModel = (message: string, request?: DblpRequest, requestBound = false): DblpViewModel => ({
  state: 'invalid',
  request,
  requestBound,
  queryContract: Boolean(request),
  limitContract: Boolean(request),
  bindingCount: 0,
  publicationCount: 0,
  invalidRowCount: 0,
  malformedRowCount: 0,
  duplicateRowCount: 0,
  conflictCount: 0,
  wrongTitleRowCount: 0,
  overflowPublicationCount: 0,
  publications: [],
  message,
})

const decodeSparqlLiteral = (encoded: string): string | undefined => {
  let decoded = ''
  for (let index = 0; index < encoded.length; index += 1) {
    const character = encoded[index]
    if (character !== '\\') {
      decoded += character
      continue
    }
    const escaped = encoded[index + 1]
    if (escaped === undefined) return undefined
    if (escaped === '\\') decoded += '\\'
    else if (escaped === '"') decoded += '"'
    else if (escaped === 'r') decoded += '\r'
    else if (escaped === 'n') decoded += '\n'
    else return undefined
    index += 1
  }
  return decoded
}

const encodeSparqlLiteral = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`

export const parseDblpRequest = (requestUrl?: string): DblpRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    if (url.origin !== new URL(DBLP_ENDPOINT).origin || url.port || url.pathname !== '/sparql' || url.username || url.password
      || url.hash || keys.length !== 1 || keys[0] !== 'query'
      || url.searchParams.getAll('query').length !== 1) return undefined
    const query = url.searchParams.get('query')
    if (!query) return undefined
    const match = DBLP_QUERY_PATTERN.exec(query)
    if (!match) return undefined
    const decodedQuery = decodeSparqlLiteral(match[1])
    const rawLimit = match[2]
    const limit = Number(rawLimit)
    if (decodedQuery === undefined || decodedQuery !== decodedQuery.trim() || decodedQuery.length < 1 || decodedQuery.length > 120
      || encodeSparqlLiteral(decodedQuery) !== `"${match[1]}"` || !Number.isSafeInteger(limit) || limit < 1 || limit > 20 || String(limit) !== rawLimit) return undefined
    return { query: decodedQuery, limit }
  } catch {
    return undefined
  }
}

const executedRequestIdentity = (executedRequest?: ExecutedRequestContext, requestUrl?: string): { request?: DblpRequest; invalid: boolean } => {
  if (!executedRequest) return { invalid: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return { invalid: true }
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return { invalid: true }
  const request = parseDblpRequest(executedRequest.url)
  return request ? { request, invalid: false } : { invalid: true }
}

const readCell = (row: Record<string, unknown>, key: string, types: string[]): { cell?: DblpCell; present: boolean; malformed: boolean } => {
  if (!Object.prototype.hasOwnProperty.call(row, key)) return { present: false, malformed: false }
  const value = row[key]
  if (!isRecord(value) || typeof value.type !== 'string' || !types.includes(value.type) || typeof value.value !== 'string') return { present: true, malformed: true }
  const text = value.value.trim()
  return text ? { present: true, cell: { type: value.type, value: text }, malformed: false } : { present: true, malformed: true }
}

const isDblpPublicationUri = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'dblp.org' && !url.port && !url.username && !url.password
      && !url.search && !url.hash && url.pathname.startsWith('/rec/') && url.pathname.length > 5
  } catch {
    return false
  }
}

type MutablePublication = DblpPublication & {
  fingerprints: Set<string>
  conflictingFields: Set<string>
}

const cellValue = (cell: { cell?: DblpCell; malformed: boolean }) => cell.cell?.value

export const parseDblpResponse = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): DblpViewModel => {
  const displayedRequest = parseDblpRequest(requestUrl)
  if (requestUrl && !displayedRequest) return invalidModel('The displayed request was not the exact supported DBLP SPARQL title-search request.')
  const execution = executedRequestIdentity(executedRequest, requestUrl)
  if (execution.invalid) return invalidModel('The successful response is not bound to the exact supported bodyless GET DBLP SPARQL title-search request.')
  const request = execution.request ?? displayedRequest
  const requestBound = Boolean(execution.request)
  if (!request) return invalidModel('The successful response was not tied to the exact DBLP SPARQL title-search request.')
  if (!isRecord(data) || !isRecord(data.head) || !Array.isArray(data.head.vars)
    || data.head.vars.length !== DBLP_HEAD_VARS.length || data.head.vars.some((value, index) => value !== DBLP_HEAD_VARS[index])
    || !isRecord(data.results) || !Array.isArray(data.results.bindings)) {
    return invalidModel('DBLP returned HTTP-success data without the exact SPARQL JSON envelope projected by this search.', request, requestBound)
  }

  const bindings = data.results.bindings
  if (bindings.length === 0) {
    return requestBound
      ? { ...invalidModel(`DBLP returned no publications matching “${request.query}”.`, request, true), state: 'empty', queryContract: true, limitContract: true }
      : { ...invalidModel('DBLP returned a coherent zero-result page, but the executed request transport is unavailable, so the response is not trusted as a request-bound no-match result.', request), state: 'partial', queryContract: true, limitContract: true }
  }

  const publications = new Map<string, MutablePublication>()
  let invalidRowCount = 0
  let malformedRowCount = 0
  let duplicateRowCount = 0
  let wrongTitleRowCount = 0

  for (const binding of bindings) {
    if (!isRecord(binding)) {
      invalidRowCount += 1
      malformedRowCount += 1
      continue
    }
    const publicationCell = readCell(binding, 'publ', ['uri'])
    const titleCell = readCell(binding, 'title', ['literal'])
    const publicationUri = cellValue(publicationCell)
    const title = cellValue(titleCell)
    if (publicationCell.malformed || titleCell.malformed || !publicationUri || !isDblpPublicationUri(publicationUri) || !title) {
      invalidRowCount += 1
      malformedRowCount += 1
      continue
    }
    if (!title.toLocaleLowerCase().includes(request.query.toLocaleLowerCase())) {
      invalidRowCount += 1
      wrongTitleRowCount += 1
      continue
    }

    const yearCell = readCell(binding, 'year', ['literal'])
    const venueCell = readCell(binding, 'venue', ['literal', 'uri'])
    const doiCell = readCell(binding, 'doi', ['literal', 'uri'])
    const authorCell = readCell(binding, 'authorName', ['literal'])
    const optionalCells = [yearCell, venueCell, doiCell, authorCell]
    const malformedOptional = optionalCells.some((cell) => cell.malformed)
    if (malformedOptional) {
      invalidRowCount += 1
      malformedRowCount += 1
    }
    const year = cellValue(yearCell)
    const venue = cellValue(venueCell)
    const doi = cellValue(doiCell)
    const author = cellValue(authorCell)
    const current = publications.get(publicationUri) ?? {
      uri: publicationUri,
      title,
      authors: [],
      fingerprints: new Set<string>(),
      conflictingFields: new Set<string>(),
    }
    const fingerprint = JSON.stringify([title, year, venue, doi, author])
    if (!malformedOptional && current.fingerprints.has(fingerprint)) {
      duplicateRowCount += 1
      continue
    }
    if (!malformedOptional) current.fingerprints.add(fingerprint)
    const coreFields: Array<[keyof Pick<DblpPublication, 'title' | 'year' | 'venue' | 'doi'>, string | undefined]> = [
      ['title', title], ['year', year], ['venue', venue], ['doi', doi],
    ]
    for (const [field, value] of coreFields) {
      if (value === undefined) continue
      if (current[field] !== undefined && current[field] !== value) current.conflictingFields.add(field)
      else if (current[field] === undefined) current[field] = value
    }
    if (author && !current.authors.includes(author)) current.authors.push(author)
    publications.set(publicationUri, current)
  }

  const grouped = [...publications.values()]
  const conflictCount = grouped.filter((publication) => publication.conflictingFields.size > 0).length
  const overflowPublicationCount = Math.max(0, grouped.length - request.limit)
  const trusted = grouped.filter((publication) => publication.conflictingFields.size === 0).slice(0, request.limit)
  const limitContract = overflowPublicationCount === 0
  const resultIssues = invalidRowCount > 0 || duplicateRowCount > 0 || conflictCount > 0 || !limitContract
  if (trusted.length === 0) {
    return {
      state: 'invalid', request, requestBound, queryContract: true, limitContract, bindingCount: bindings.length,
      publicationCount: 0, invalidRowCount, malformedRowCount, duplicateRowCount, conflictCount,
      wrongTitleRowCount, overflowPublicationCount, publications: [],
      message: 'DBLP returned bindings, but no publication passed the request-bound URI, title, and consistency checks.',
    }
  }
  return {
    state: resultIssues || !requestBound ? 'partial' : 'ready', request, requestBound, queryContract: true, limitContract,
    bindingCount: bindings.length, publicationCount: trusted.length, invalidRowCount, malformedRowCount,
    duplicateRowCount, conflictCount, wrongTitleRowCount, overflowPublicationCount,
    publications: trusted.map(({ fingerprints: _fingerprints, conflictingFields: _conflictingFields, ...publication }) => publication),
    message: resultIssues
      ? 'Malformed, duplicate, conflicting, wrong-title, or over-limit DBLP rows were withheld from the visible records.'
      : requestBound ? '' : 'The provider response is internally coherent, but executed-request transport identity is unavailable, so the result is not marked ready.',
  }
}

const viewAttributes = (viewModel: DblpViewModel) => ({
  'data-domain-card': 'dblp-search',
  'data-result-state': viewModel.state,
  'data-request-bound': String(viewModel.requestBound),
  'data-request-contract': 'exact-dblp-sparql-title-search-get',
  'data-request-query': viewModel.request?.query,
  'data-request-limit': viewModel.request?.limit,
  'data-query-contract': String(viewModel.queryContract),
  'data-limit-contract': String(viewModel.limitContract),
  'data-binding-count': viewModel.bindingCount,
  'data-publication-count': viewModel.publicationCount,
  'data-invalid-row-count': viewModel.invalidRowCount,
  'data-malformed-row-count': viewModel.malformedRowCount,
  'data-duplicate-row-count': viewModel.duplicateRowCount,
  'data-conflict-count': viewModel.conflictCount,
  'data-wrong-title-row-count': viewModel.wrongTitleRowCount,
  'data-overflow-publication-count': viewModel.overflowPublicationCount,
})

const displayDoi = (doi?: string) => doi?.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')

export function DblpSearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const viewModel = parseDblpResponse(data, requestUrl, executedRequest)
  const attrs = viewAttributes(viewModel)
  if (viewModel.state === 'invalid' || viewModel.state === 'empty') return <div className="domain-card domain-empty" {...attrs}><h3>{viewModel.state === 'empty' ? 'No DBLP publications found' : 'Invalid DBLP search response'}</h3><p>{viewModel.message}</p></div>

  return <div className="domain-card dblp-search-preview" {...attrs}>
    <CardHeading eyebrow="DBLP public SPARQL · Publication title search" title={`${viewModel.publicationCount} publication${viewModel.publicationCount === 1 ? '' : 's'}`} description="Publication records reconstructed from the exact executed DBLP SPARQL query, with repeated author rows grouped by DBLP record identity."><span className="domain-state">{viewModel.state === 'partial' ? 'Partial SPARQL result' : 'Request-bound result'}</span></CardHeading>
    {viewModel.state === 'partial' && <p className="domain-note">{viewModel.message} Raw JSON retains the complete provider response.</p>}
    <Facts items={[
      { label: 'Requested title', value: viewModel.request?.query ?? 'Not supplied' },
      { label: 'Publication count', value: `${viewModel.publicationCount} / ${viewModel.request?.limit ?? '—'}` },
      { label: 'Returned bindings', value: String(viewModel.bindingCount) },
      { label: 'Invalid rows', value: String(viewModel.invalidRowCount) },
      { label: 'Duplicate rows', value: String(viewModel.duplicateRowCount) },
      { label: 'Conflicting records', value: String(viewModel.conflictCount) },
    ]}/>
    <div className={`semantic-card-grid ${viewModel.publications.length === 1 ? 'single' : ''}`} aria-label="DBLP publication records" data-record-count={viewModel.publications.length}>
      {viewModel.publications.map((publication, index) => <article key={publication.uri} data-record-index={index + 1} data-publication-uri={publication.uri}>
        <header><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><small>{publication.authors.join(', ') || 'DBLP bibliography'}</small><h3>{publication.title}</h3></div><em>{publication.year ?? '—'}</em></header>
        <dl><div><dt>Venue</dt><dd>{publication.venue ?? '—'}</dd></div><div><dt>DOI</dt><dd>{publication.doi ? <code>{displayDoi(publication.doi)}</code> : '—'}</dd></div><div><dt>DBLP record</dt><dd><a href={publication.uri} target="_blank" rel="noreferrer">{publication.uri}</a></dd></div></dl>
      </article>)}
    </div>
  </div>
}
