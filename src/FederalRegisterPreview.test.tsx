import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById, validateParameters } from './apiCatalog'
import { FederalRegisterPreview, parseFederalRegisterRequest, parseFederalRegisterResponse } from './previews/FederalRegisterPreview'
import { ResponseDemoPreview } from './responsePreview'

const api = getApiById('federal-register-documents')!
const requestUrl = api.buildUrl({ query: 'artificial intelligence', limit: '2' })

const document = (documentNumber: string, publicationDate: string, overrides: Record<string, unknown> = {}) => ({
  document_number: documentNumber,
  publication_date: publicationDate,
  type: 'Proposed Rule',
  title: `Federal document ${documentNumber}`,
  abstract: 'A provider abstract.',
  agencies: [{ name: 'Environmental Protection Agency' }],
  html_url: `https://www.federalregister.gov/documents/${publicationDate.replaceAll('-', '/')}/${documentNumber}/federal-document-${documentNumber}`,
  ...overrides,
})

const response = (results: unknown[], overrides: Record<string, unknown> = {}) => ({
  description: "Documents matching 'artificial intelligence'",
  count: 3,
  total_pages: 2,
  next_page_url: 'https://www.federalregister.gov/api/v1/documents?conditions%5Bterm%5D=artificial+intelligence&format=json&order=newest&page=2&per_page=2',
  results,
  ...overrides,
})

describe('Federal Register exact-request-bound document semantics', () => {
  it('accepts only the exact admitted first-page document search', () => {
    expect(parseFederalRegisterRequest(requestUrl)).toEqual({ query: 'artificial intelligence', limit: 2 })
    expect(parseFederalRegisterRequest(`${requestUrl}&foo=bar`)).toBeUndefined()
    expect(parseFederalRegisterRequest(`${requestUrl}&conditions%5Bterm%5D=climate`)).toBeUndefined()
    expect(parseFederalRegisterRequest(`${requestUrl}&per_page=1`)).toBeUndefined()
    expect(parseFederalRegisterRequest(requestUrl.replace('/documents.json?', '/documents.json/?'))).toBeUndefined()
    expect(parseFederalRegisterRequest(requestUrl.replace('https://', 'http://'))).toBeUndefined()
    expect(parseFederalRegisterRequest(requestUrl.replace('www.federalregister.gov', 'user:pass@www.federalregister.gov'))).toBeUndefined()
    expect(parseFederalRegisterRequest(requestUrl.replace('www.federalregister.gov', 'www.federalregister.gov:8443'))).toBeUndefined()
    expect(parseFederalRegisterRequest(requestUrl.replace('per_page=2', 'per_page=02'))).toBeUndefined()
  })

  it('renders trustworthy provider identity and request evidence only when the successful transport is exact', () => {
    const first = document('2026-19072', '2026-09-17')
    const second = document('2026-19071', '2026-09-17', { type: 'Rule', title: 'Second trusted document' })
    const executedRequest = { url: requestUrl, method: 'GET' }
    const parsed = parseFederalRegisterResponse(response([first, second]), requestUrl, executedRequest)
    expect(parsed.result).toMatchObject({
      providerCount: 3,
      providerTotalPages: 2,
      providerRecordCount: 2,
      trustedRecordCount: 2,
      malformedEvidenceCount: 0,
      duplicateEvidenceCount: 0,
    })
    render(<FederalRegisterPreview data={response([first, second])} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const card = screen.getByText('Federal documents matching “artificial intelligence”').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-contract', 'exact-federal-register-document-search-v2')
    expect(card).toHaveAttribute('data-provider-count', '3')
    expect(card).toHaveAttribute('data-trusted-record-count', '2')
    expect(card).toHaveAttribute('data-primary-document-number', '2026-19072')
    expect(card).toHaveTextContent('Environmental Protection Agency')
    expect(card).toHaveTextContent('unofficial informational resource')
    expect(screen.getByRole('link', { name: 'Federal document 2026-19072' })).toHaveAttribute('href', expect.stringContaining('/2026-19072/'))
  })

  it('does not treat a displayed request URL as executed transport evidence', () => {
    const data = response([document('2026-19072', '2026-09-17')], { count: 1, total_pages: 1, next_page_url: null })
    render(<FederalRegisterPreview data={data} requestUrl={requestUrl}/>)
    const card = screen.getByText('Federal documents matching “artificial intelligence”').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveTextContent('executed transport identity is unavailable')
  })

  it('fails closed when the canonical URL was executed with a non-GET method or request body', () => {
    const data = response([document('2026-19072', '2026-09-17')], { count: 1, total_pages: 1, next_page_url: null })
    const { rerender } = render(<ResponseDemoPreview api={api} data={data} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }}/>)
    let card = screen.getByText('Invalid Federal Register response').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).not.toHaveTextContent('Federal document 2026-19072')

    rerender(<ResponseDemoPreview api={api} data={data} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }}/>)
    card = screen.getByText('Invalid Federal Register response').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).not.toHaveTextContent('Federal document 2026-19072')
  })

  it('fails closed when provider acknowledgement or first-page pagination contradicts the request', () => {
    const rows = [document('2026-19072', '2026-09-17'), document('2026-19071', '2026-09-17')]
    expect(parseFederalRegisterResponse(response(rows, { description: "Documents matching 'climate'" }), requestUrl).result).toBeUndefined()
    expect(parseFederalRegisterResponse(response(rows, { next_page_url: 'https://www.federalregister.gov/api/v1/documents?conditions%5Bterm%5D=climate&format=json&order=newest&page=2&per_page=2' }), requestUrl).result).toBeUndefined()
    expect(parseFederalRegisterResponse(response(rows.slice(0, 1)), requestUrl).result).toBeUndefined()
    expect(parseFederalRegisterResponse(response(rows, { count: '3' }), requestUrl).result).toBeUndefined()
  })

  it('withholds malformed and duplicate document evidence while preserving trustworthy rows as partial', () => {
    const first = document('2026-19072', '2026-09-17')
    const duplicate = document('2026-19072', '2026-09-17', { title: 'Fabricated duplicate title' })
    const malformed = document('2026-19070', '2026-09-16', { title: 'Fabricated malformed identity', html_url: 'https://example.com/not-federal-register' })
    const data = response([first, duplicate], { count: 2, total_pages: 1, next_page_url: null })
    const parsed = parseFederalRegisterResponse(data, requestUrl)
    expect(parsed.result).toMatchObject({ trustedRecordCount: 1, duplicateEvidenceCount: 1 })
    render(<FederalRegisterPreview data={data} requestUrl={requestUrl}/>)
    let card = screen.getByText('Federal documents matching “artificial intelligence”').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).not.toHaveTextContent('Fabricated duplicate title')

    const malformedData = response([first, malformed], { count: 2, total_pages: 1, next_page_url: null })
    const { rerender } = render(<FederalRegisterPreview data={malformedData} requestUrl={requestUrl}/>)
    rerender(<FederalRegisterPreview data={malformedData} requestUrl={requestUrl}/>)
    card = screen.getAllByText('Federal documents matching “artificial intelligence”').at(-1)!.closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).not.toHaveTextContent('Fabricated malformed identity')
  })

  it('trusts semantic emptiness only for the exact executed request', () => {
    const data = { description: "Documents matching 'artificial intelligence'", count: 0, total_pages: null, next_page_url: null, results: [] }
    const { rerender } = render(<FederalRegisterPreview data={data} requestUrl={requestUrl}/>)
    let card = screen.getByText('Unbound Federal Register search result').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    rerender(<FederalRegisterPreview data={data} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)
    card = screen.getByText('No Federal Register documents matched').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-request-bound', 'true')
  })

  it('keeps non-empty/integer validation in the catalog SSOT without silently correcting explicit invalid values', () => {
    expect(api.fields.find((field) => field.id === 'query')).toMatchObject({ minLength: 1 })
    expect(api.fields.find((field) => field.id === 'limit')).toMatchObject({ min: 1, max: 20, step: 1 })
    expect(validateParameters(api, { query: '   ', limit: '2' })).toHaveProperty('query')
    expect(validateParameters(api, { query: 'AI', limit: '2.5' })).toHaveProperty('limit')
    const blank = new URL(api.buildUrl({ query: '   ', limit: '2' }))
    expect(blank.searchParams.get('conditions[term]')).toBe('')
    const fractional = new URL(api.buildUrl({ query: 'AI', limit: '2.5' }))
    expect(fractional.searchParams.get('per_page')).toBe('2.5')
  })
})
