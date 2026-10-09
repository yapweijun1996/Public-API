import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { DblpSearchPreview, parseDblpResponse, parseDblpRequest } from './previews/DblpSearchPreview'

const api = apiCatalog.find((candidate) => candidate.id === 'dblp-search')!
const requestUrl = api.buildUrl({ query: 'retrieval', limit: '2' })
const executedGet = { url: requestUrl, method: 'GET' }
const head = { vars: ['publ', 'title', 'year', 'venue', 'doi', 'authorName'] }
const cell = (value: string, type = 'literal') => ({ type, value })
const row = (overrides: Record<string, unknown> = {}) => ({
  publ: cell('https://dblp.org/rec/conf/demo/Rag26', 'uri'),
  title: cell('Retrieval-Augmented Generation for Enterprise Systems'),
  year: cell('2026'),
  venue: cell('DemoConf'),
  doi: cell('https://doi.org/10.1/demo', 'uri'),
  authorName: cell('Wei Developer'),
  ...overrides,
})
const response = (bindings: unknown[]) => ({ head, results: { bindings } })

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DBLP request-bound semantic preview', () => {
  it('groups valid author rows by publication and renders a ready ViewModel', () => {
    const secondPublication = row({
      publ: cell('https://dblp.org/rec/journals/demo/Systems26', 'uri'),
      title: cell('Retrieval Augmented Generation Systems'),
      authorName: cell('AI Researcher'),
    })
    const data = response([row(), row({ authorName: cell('AI Researcher') }), secondPublication])
    const viewModel = parseDblpResponse(data, requestUrl, executedGet)

    expect(viewModel).toMatchObject({ state: 'ready', queryContract: true, limitContract: true, bindingCount: 3, publicationCount: 2 })
    expect(viewModel.publications[0].authors).toEqual(['Wei Developer', 'AI Researcher'])
    expect(viewModel.publications[0].doi).toBe('https://doi.org/10.1/demo')

    render(<DblpSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedGet}/>)
    const card = screen.getByRole('heading', { name: '2 publications' }).closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-query', 'retrieval')
    expect(card).toHaveAttribute('data-request-limit', '2')
    expect(card).toHaveAttribute('data-publication-count', '2')
    expect(card).toHaveAttribute('data-invalid-row-count', '0')
    expect(card).toHaveTextContent('Wei Developer, AI Researcher')
    expect(card).toHaveTextContent('10.1/demo')
  })

  it('rejects extra and duplicate query keys before reading response data', () => {
    const extra = `${requestUrl}&format=json`
    const duplicate = `${requestUrl}&query=another`
    expect(parseDblpRequest(extra)).toBeUndefined()
    expect(parseDblpRequest(duplicate)).toBeUndefined()
    expect(parseDblpResponse(response([row()]), extra, { url: extra, method: 'GET' }).state).toBe('invalid')
    expect(parseDblpResponse(response([row()]), duplicate, { url: duplicate, method: 'GET' }).state).toBe('invalid')
  })

  it('rejects a modified SPARQL shape instead of matching query substrings', () => {
    const modified = new URL(requestUrl)
    modified.searchParams.set('query', modified.searchParams.get('query')!.replace('ORDER BY ?publ ?authorName', 'ORDER BY ?title'))
    expect(parseDblpRequest(modified.toString())).toBeUndefined()
    expect(parseDblpResponse(response([row()]), modified.toString(), { url: modified.toString(), method: 'GET' }).state).toBe('invalid')
  })

  it('recovers escaped title terms without silently normalizing invalid explicit parameters', () => {
    const escapedRequest = api.buildUrl({ query: 'agent "safety" \\ research', limit: '20' })
    expect(parseDblpRequest(escapedRequest)).toEqual({ query: 'agent "safety" \\ research', limit: 20 })

    expect(parseDblpRequest(api.buildUrl({ query: '   ', limit: '6' }))).toBeUndefined()
    expect(parseDblpRequest(api.buildUrl({ query: 'retrieval', limit: '2.5' }))).toBeUndefined()
    expect(parseDblpRequest(api.buildUrl({ query: 'retrieval', limit: '999' }))).toBeUndefined()
  })

  it('withholds wrong-title rows and distinguishes mixed from wholly unusable batches', () => {
    const wrongTitle = row({ title: cell('A completely unrelated publication') })
    const mixed = parseDblpResponse(response([row(), wrongTitle]), requestUrl, executedGet)
    expect(mixed).toMatchObject({ state: 'partial', publicationCount: 1, wrongTitleRowCount: 1, invalidRowCount: 1 })
    const onlyWrong = parseDblpResponse(response([wrongTitle]), requestUrl, executedGet)
    expect(onlyWrong).toMatchObject({ state: 'invalid', publicationCount: 0, wrongTitleRowCount: 1 })
  })

  it('keeps malformed typed optional cells unavailable while marking the batch partial', () => {
    const malformedYear = row({ year: { type: 'literal', value: 2026 } })
    const viewModel = parseDblpResponse(response([malformedYear]), requestUrl, executedGet)
    expect(viewModel).toMatchObject({ state: 'partial', publicationCount: 1, malformedRowCount: 1, invalidRowCount: 1 })
    expect(viewModel.publications[0].year).toBeUndefined()
  })

  it('accepts a coherent zero-binding SPARQL envelope as empty', () => {
    const viewModel = parseDblpResponse(response([]), requestUrl, executedGet)
    expect(viewModel).toMatchObject({ state: 'empty', queryContract: true, limitContract: true, bindingCount: 0, publicationCount: 0 })
  })

  it('rejects HTTP-success data when the executed transport is not the exact bodyless GET request', () => {
    const data = response([row()])

    const { rerender } = render(<DblpSearchPreview data={data} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }}/>)
    expect(screen.getByRole('heading', { name: 'Invalid DBLP search response' }).closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<DblpSearchPreview data={data} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: '' }}/>)
    expect(screen.getByRole('heading', { name: 'Invalid DBLP search response' }).closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<DblpSearchPreview data={data} requestUrl={requestUrl} executedRequest={{ url: api.buildUrl({ query: 'different title', limit: '2' }), method: 'GET' }}/>)
    expect(screen.getByRole('heading', { name: 'Invalid DBLP search response' }).closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('keeps internally coherent provider data partial when executed transport identity is unavailable', () => {
    const data = response([row()])
    const viewModel = parseDblpResponse(data, requestUrl)
    expect(viewModel).toMatchObject({ state: 'partial', requestBound: false, publicationCount: 1 })

    render(<DblpSearchPreview data={data} requestUrl={requestUrl}/>)
    const card = screen.getByRole('heading', { name: '1 publication' }).closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-request-contract', 'exact-dblp-sparql-title-search-get')
  })
})
