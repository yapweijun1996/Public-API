import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'nvd-recent-cves')
if (!api) throw new Error('Missing NVD recently modified CVEs API fixture')

const requestUrl = 'https://services.nvd.nist.gov/rest/json/cves/2.0?lastModStartDate=2026-09-01T00%3A00%3A00.000Z&lastModEndDate=2026-09-08T00%3A00%3A00.000Z&resultsPerPage=8'
const executed = (method = 'GET', body?: unknown) => ({ url: requestUrl, method, ...(body === undefined ? {} : { body }) })
const row = (id: string, lastModified = '2026-09-04T12:00:00.000') => ({
  cve: {
    id,
    sourceIdentifier: 'security@example.org',
    published: '2025-05-01T10:00:00.000',
    lastModified,
    vulnStatus: 'Modified',
    descriptions: [{ lang: 'en', value: `${id} representative vulnerability description.` }],
    references: [{ url: `https://example.org/${id}` }],
  },
})
const response = (vulnerabilities: unknown[], overrides: Record<string, unknown> = {}) => ({
  resultsPerPage: vulnerabilities.length,
  startIndex: 0,
  totalResults: vulnerabilities.length,
  format: 'NVD_CVE',
  version: '2.0',
  timestamp: '2026-09-08T00:00:01.000',
  vulnerabilities,
  ...overrides,
})

describe('NVD recently modified CVEs semantic card', () => {
  afterEach(cleanup)

  it('binds a valid NVD page to the exact executed last-modified window', () => {
    render(<ResponseDemoPreview api={api} executedRequest={executed()} data={response([row('CVE-2026-12345')])}/>)

    const card = screen.getByText('CVE-2026-12345').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-domain-card', 'nvd-recent-cves')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-lookback-days', '7')
    expect(card).toHaveAttribute('data-request-window-start', '2026-09-01T00:00:00.000Z')
    expect(card).toHaveAttribute('data-request-window-end', '2026-09-08T00:00:00.000Z')
    expect(card).toHaveAttribute('data-filter-contract', 'true')
    expect(card).toHaveAttribute('data-envelope-contract', 'true')
    expect(screen.getByText('2026-09-04')).toBeInTheDocument()
  })

  it('fails closed when every HTTP-success record falls outside the executed modified window', () => {
    render(<ResponseDemoPreview api={api} executedRequest={executed()} data={response([row('CVE-2026-99999', '2026-08-15T12:00:00.000')])}/>)

    const card = screen.getByText('Invalid NVD recently modified records').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-filter-contract', 'false')
    expect(screen.queryByText('CVE-2026-99999')).not.toBeInTheDocument()
  })

  it('marks a mixed page partial and withholds out-of-window rows', () => {
    render(<ResponseDemoPreview api={api} executedRequest={executed()} data={response([
      row('CVE-2026-12345'),
      row('CVE-2026-99999', '2026-08-15T12:00:00.000'),
    ], { totalResults: 2 })}/>)

    const card = screen.getByText('CVE-2026-12345').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(card).toHaveAttribute('data-filter-contract', 'false')
    expect(screen.queryByText('CVE-2026-99999')).not.toBeInTheDocument()
  })

  it('accepts a provider short page when resultsPerPage reports the actual returned row count', () => {
    render(<ResponseDemoPreview api={api} executedRequest={executed()} data={response([row('CVE-2026-12345')], { resultsPerPage: 1, totalResults: 1 })}/>)

    const card = screen.getByText('CVE-2026-12345').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-provider-results-per-page', '1')
    expect(card).toHaveAttribute('data-provider-record-count', '1')
    expect(card).toHaveAttribute('data-count-contract', 'true')
  })

  it('keeps an internally coherent but incomplete first page partial', () => {
    render(<ResponseDemoPreview api={api} executedRequest={executed()} data={response([row('CVE-2026-12345')], { resultsPerPage: 1, totalResults: 42 })}/>)

    const card = screen.getByText('CVE-2026-12345').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-count-contract', 'false')
    expect(card).toHaveAttribute('data-provider-total-results', '42')
  })

  it('treats the provider zero-result resultsPerPage=0 envelope as semantic empty', () => {
    render(<ResponseDemoPreview api={api} executedRequest={executed()} data={response([], { resultsPerPage: 0, totalResults: 0 })}/>)

    const card = screen.getByText('No CVEs modified in this window').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-provider-record-count', '0')
    expect(card).toHaveAttribute('data-provider-total-results', '0')
    expect(card).toHaveAttribute('data-count-contract', 'true')
  })

  it('fails closed on malformed NVD envelope counters instead of coercing numeric strings', () => {
    render(<ResponseDemoPreview api={api} executedRequest={executed()} data={response([row('CVE-2026-12345')], { totalResults: '1' })}/>)

    const card = screen.getByText('Invalid NVD recently modified response').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-envelope-contract', 'false')
    expect(screen.queryByText('CVE-2026-12345')).not.toBeInTheDocument()
  })

  it('keeps a structurally valid page partial when executed-request identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={response([row('CVE-2026-12345')])}/>)

    const card = screen.getByText('CVE-2026-12345').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-filter-contract', 'false')
  })


  it('fails closed when the canonical URL was executed with the wrong transport', () => {
    const payload = response([row('CVE-2026-12345')])
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed('POST')} data={payload}/>)

    expect(screen.getByText('Invalid NVD recently modified request')).toBeInTheDocument()
    expect(screen.queryByText('CVE-2026-12345')).not.toBeInTheDocument()

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed('GET', { unexpected: true })} data={payload}/>)
    expect(screen.getByText('Invalid NVD recently modified request')).toBeInTheDocument()
    expect(screen.queryByText('CVE-2026-12345')).not.toBeInTheDocument()
  })

  it('rejects a contradictory zero-result page whose resultsPerPage does not equal the returned row count', () => {
    render(<ResponseDemoPreview api={api} executedRequest={executed()} data={response([], { resultsPerPage: 8, totalResults: 0 })}/>)

    const card = screen.getByText('Invalid NVD recently modified empty response').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-count-contract', 'false')
  })
})
