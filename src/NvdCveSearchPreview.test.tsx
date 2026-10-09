import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { NvdCveSearchPreview } from './previews/NvdCveSearchPreview'

const requestUrl = 'https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=postgresql&resultsPerPage=8'
const executed = (url = requestUrl, method = 'GET', body?: unknown) => ({ url, method, ...(body === undefined ? {} : { body }) })
const row = (id: string, description = `${id} affects PostgreSQL database servers.`) => ({
  cve: {
    id,
    sourceIdentifier: 'security@example.org',
    published: '2025-05-01T10:00:00.000',
    lastModified: '2026-09-04T12:00:00.000',
    vulnStatus: 'Analyzed',
    descriptions: [{ lang: 'en', value: description }],
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

describe('NVD CVE keyword search semantic card', () => {
  afterEach(cleanup)

  it('binds a valid NVD page to the exact executed keyword search', () => {
    render(<NvdCveSearchPreview data={response([row('CVE-2026-12345')])} executedRequest={executed()}/>)

    const card = screen.getByText('CVE-2026-12345').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-domain-card', 'nvd-cve-search')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-keyword', 'postgresql')
    expect(card).toHaveAttribute('data-filter-contract', 'true')
    expect(card).toHaveAttribute('data-envelope-contract', 'true')
    expect(card).toHaveAttribute('data-count-contract', 'true')
  })

  it('keeps an internally short non-final first page partial', () => {
    render(<NvdCveSearchPreview
      data={response([row('CVE-2026-12345')], { totalResults: 42 })}
      executedRequest={executed()}
    />)

    const card = screen.getByText('CVE-2026-12345').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-results-per-page', '1')
    expect(card).toHaveAttribute('data-provider-record-count', '1')
    expect(card).toHaveAttribute('data-provider-total-results', '42')
    expect(card).toHaveAttribute('data-count-contract', 'false')
  })

  it('fails closed when every HTTP-success row contradicts the keyword filter', () => {
    render(<NvdCveSearchPreview data={response([row('CVE-2026-99999', 'A Linux kernel memory issue.')])} executedRequest={executed()}/>)

    const card = screen.getByText('Invalid NVD CVE search records').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-filter-contract', 'false')
    expect(screen.queryByText('CVE-2026-99999')).not.toBeInTheDocument()
  })

  it('marks a mixed page partial and withholds contradictory rows', () => {
    render(<NvdCveSearchPreview data={response([
      row('CVE-2026-12345'),
      row('CVE-2026-99999', 'A Linux kernel memory issue.'),
    ], { totalResults: 2 })} executedRequest={executed()}/>)

    const card = screen.getByText('CVE-2026-12345').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(card).toHaveAttribute('data-filter-contract', 'false')
    expect(screen.queryByText('CVE-2026-99999')).not.toBeInTheDocument()
  })

  it('honors NVD multi-term AND plus trailing-wildcard keyword semantics', () => {
    const multiTermUrl = 'https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=postgre+database&resultsPerPage=8'
    render(<NvdCveSearchPreview data={response([row('CVE-2026-12345')])} executedRequest={executed(multiTermUrl)}/>)

    const card = screen.getByText('CVE-2026-12345').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-keyword', 'postgre database')
    expect(card).toHaveAttribute('data-filter-contract', 'true')
  })

  it('keeps malformed optional CVSS partial and withholds numeric-string scores', () => {
    const baseRow = row('CVE-2026-12345')
    const malformedMetric = {
      ...baseRow,
      cve: {
        ...baseRow.cve,
        metrics: { cvssMetricV31: [{ source: 'security@example.org', type: 'Primary', cvssData: { baseScore: '9.8', baseSeverity: 'CRITICAL' } }] },
      },
    }
    render(<NvdCveSearchPreview data={response([malformedMetric])} executedRequest={executed()}/>)

    const card = screen.getByText('CVE-2026-12345').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-incomplete-record-count', '1')
    expect(screen.queryByText(/9\.8/)).not.toBeInTheDocument()
    expect(screen.getByText('Not supplied')).toBeInTheDocument()
  })

  it('rejects malformed envelope counters instead of coercing numeric strings', () => {
    render(<NvdCveSearchPreview data={response([row('CVE-2026-12345')], { totalResults: '1' })} executedRequest={executed()}/>)

    const card = screen.getByText('Invalid NVD CVE search response').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-envelope-contract', 'false')
    expect(screen.queryByText('CVE-2026-12345')).not.toBeInTheDocument()
  })

  it('keeps valid provider rows partial when executed-request identity is unavailable', () => {
    render(<NvdCveSearchPreview data={response([row('CVE-2026-12345')])}/>)

    const card = screen.getByText('CVE-2026-12345').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-filter-contract', 'false')
  })

  it('treats only a coherent request-bound zero-result page as semantic empty', () => {
    render(<NvdCveSearchPreview data={response([], { resultsPerPage: 0, totalResults: 0 })} executedRequest={executed()}/>)

    const card = screen.getByText('No matching NVD CVEs').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-filter-contract', 'true')
  })


  it('fails closed when the canonical URL was executed with the wrong transport', () => {
    const payload = response([row('CVE-2026-12345')])
    const { rerender } = render(<NvdCveSearchPreview data={payload} executedRequest={executed(requestUrl, 'POST')}/>)

    expect(screen.getByText('Invalid NVD CVE search request')).toBeInTheDocument()
    expect(screen.queryByText('CVE-2026-12345')).not.toBeInTheDocument()

    rerender(<NvdCveSearchPreview data={payload} executedRequest={executed(requestUrl, 'GET', { unexpected: true })}/>)
    expect(screen.getByText('Invalid NVD CVE search request')).toBeInTheDocument()
    expect(screen.queryByText('CVE-2026-12345')).not.toBeInTheDocument()
  })

  it('rejects a non-canonical executed request URL', () => {
    render(<NvdCveSearchPreview data={response([row('CVE-2026-12345')])} executedRequest={executed(`${requestUrl}&startIndex=0`)}/>)

    expect(screen.getByText('Invalid NVD CVE search request')).toBeInTheDocument()
    expect(screen.queryByText('CVE-2026-12345')).not.toBeInTheDocument()
  })
})
