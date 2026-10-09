import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'unhcr-refugees')
if (!api) throw new Error('Missing unhcr-refugees fixture')

const requestUrl = 'https://api.unhcr.org/population/v1/population/?yearFrom=2025&yearTo=2025&coo=SYR&cf_type=ISO&limit=1'
const executedGet = { url: requestUrl, method: 'GET' } as const

const trustedRow = {
  year: 2025,
  coo_name: 'Syrian Arab Rep.',
  coo_id: 185,
  coo: 'SYR',
  coo_iso: 'SYR',
  refugees: 4865764,
  asylum_seekers: 154355,
  returned_refugees: 1341148,
  idps: 5542227,
  returned_idps: 1964201,
  stateless: 0,
}

describe('UNHCR refugee population semantic preview', () => {
  afterEach(cleanup)

  it('preserves year-end displacement and return figures with provider origin identity', () => {
    render(<ResponseDemoPreview api={api} data={{ items: [trustedRow] }} requestUrl={requestUrl} executedRequest={executedGet}/>)

    const preview = screen.getByRole('region', { name: 'UNHCR Refugee Statistics' })
    expect(preview).toHaveAttribute('data-preview-layout', 'refugee-population')
    const card = preview.querySelector('.refugee-population-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-provider-item-count', '1')
    expect(card).toHaveAttribute('data-valid-item-count', '1')
    expect(card).toHaveAttribute('data-invalid-item-count', '0')
    expect(card).toHaveAttribute('data-primary-origin-id', '185')
    expect(card).toHaveAttribute('data-primary-origin-iso', 'SYR')
    expect(card).toHaveAttribute('data-reporting-year', '2025')
    expect(card).toHaveAttribute('data-requested-origin-iso', 'SYR')
    expect(card).toHaveAttribute('data-requested-year', '2025')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-refugees', '4865764')
    expect(card).toHaveAttribute('data-returned-refugees', '1341148')
    expect(card).toHaveAttribute('data-returned-idps', '1964201')
    expect(preview).toHaveTextContent('Syrian Arab Rep. · 2025')
    expect(preview).toHaveTextContent('4,865,764')
    expect(preview).toHaveTextContent('1,341,148')
    expect(preview).toHaveTextContent('1,964,201')
    expect(preview).toHaveTextContent('UNHCR origin ID')
    expect(preview).toHaveTextContent('cf_type=ISO')
  })

  it('fails closed when the displayed canonical URL was not executed as the same bodyless GET', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} data={{ items: [trustedRow] }} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }}/>)
    let preview = screen.getByRole('region', { name: 'UNHCR Refugee Statistics' })
    expect(preview.querySelector('[data-domain-card="refugee-population"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} data={{ items: [trustedRow] }} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: {} }}/>)
    preview = screen.getByRole('region', { name: 'UNHCR Refugee Statistics' })
    expect(preview.querySelector('[data-domain-card="refugee-population"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} data={{ items: [trustedRow] }} requestUrl={requestUrl} executedRequest={{ url: `${requestUrl}&coa=USA`, method: 'GET' }}/>)
    preview = screen.getByRole('region', { name: 'UNHCR Refugee Statistics' })
    expect(preview.querySelector('[data-domain-card="refugee-population"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('keeps a documented empty items array distinct from malformed response shape', () => {
    render(<ResponseDemoPreview api={api} data={{ items: [] }} requestUrl={requestUrl} executedRequest={executedGet}/>)
    const preview = screen.getByRole('region', { name: 'UNHCR Refugee Statistics' })
    expect(preview).toHaveTextContent('No UNHCR population row returned')
    expect(preview.querySelector('[data-domain-card="refugee-population"]')).toHaveAttribute('data-result-state', 'empty')
  })

  it('treats missing or non-array items as invalid instead of empty', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} data={{ page: 1, maxPages: 0 }} requestUrl={requestUrl}/>)
    let preview = screen.getByRole('region', { name: 'UNHCR Refugee Statistics' })
    expect(preview).toHaveTextContent('Invalid UNHCR population response')
    expect(preview.querySelector('[data-result-state="invalid"]')).toBeInTheDocument()

    rerender(<ResponseDemoPreview api={api} data={{ items: { ...trustedRow } }} requestUrl={requestUrl}/>)
    preview = screen.getByRole('region', { name: 'UNHCR Refugee Statistics' })
    expect(preview).toHaveTextContent('Invalid UNHCR population response')
    expect(preview.querySelector('[data-result-state="invalid"]')).toBeInTheDocument()
  })

  it('omits identity-less rows and marks a mixed HTTP-success response partial', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ items: [
      trustedRow,
      { year: 2025, coo_name: 'Fabricated Origin', refugees: 999999999 },
    ] }}/>)

    const preview = screen.getByRole('region', { name: 'UNHCR Refugee Statistics' })
    const card = preview.querySelector('.refugee-population-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-item-count', '2')
    expect(card).toHaveAttribute('data-valid-item-count', '1')
    expect(card).toHaveAttribute('data-invalid-item-count', '1')
    expect(preview).toHaveTextContent('Syrian Arab Rep. · 2025')
    expect(preview).not.toHaveTextContent('Fabricated Origin')
    expect(preview).not.toHaveTextContent('999,999,999')
  })

  it('fails invalid when no returned row has reporting-year plus provider origin identity', () => {
    render(<ResponseDemoPreview api={api} data={{ items: [{ year: 2025, coo_name: 'Fabricated Origin', refugees: 123 }] }} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'UNHCR Refugee Statistics' })
    expect(preview).toHaveTextContent('Invalid UNHCR population response')
    expect(preview.querySelector('[data-result-state="invalid"]')).toBeInTheDocument()
    expect(preview).not.toHaveTextContent('Fabricated Origin')
  })

  it('fails closed when HTTP-success origin or year identity does not match the executed request', () => {
    const { rerender } = render(<ResponseDemoPreview
      api={api}
      data={{ items: [{ ...trustedRow, coo_id: 2, coo_name: 'Afghanistan', coo: 'AFG', coo_iso: 'AFG' }] }}
      requestUrl={requestUrl}
    />)
    let preview = screen.getByRole('region', { name: 'UNHCR Refugee Statistics' })
    expect(preview.querySelector('[data-domain-card="refugee-population"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('do not match the executed origin and year')
    expect(preview).not.toHaveTextContent('Afghanistan')
    expect(preview).not.toHaveTextContent('4,865,764')

    rerender(<ResponseDemoPreview api={api} data={{ items: [{ ...trustedRow, year: 2024 }] }} requestUrl={requestUrl}/>)
    preview = screen.getByRole('region', { name: 'UNHCR Refugee Statistics' })
    expect(preview.querySelector('[data-domain-card="refugee-population"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('do not match the executed origin and year')
  })

  it('does not coerce OpenAPI integer fields from numeric strings', () => {
    const { rerender } = render(<ResponseDemoPreview
      api={api}
      data={{ items: [{ ...trustedRow, coo_id: '185', refugees: '4865764', stateless: '0' }] }}
      requestUrl={requestUrl}
    />)

    const preview = screen.getByRole('region', { name: 'UNHCR Refugee Statistics' })
    const card = preview.querySelector('.refugee-population-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-malformed-integer-count', '3')
    expect(card).not.toHaveAttribute('data-primary-origin-id')
    expect(card).not.toHaveAttribute('data-refugees')
    expect(card).not.toHaveAttribute('data-stateless')
    expect(preview).not.toHaveTextContent('4,865,764')
    expect(preview).toHaveTextContent('Unavailable')
    expect(preview).toHaveTextContent('3 OpenAPI integer fields were malformed')

    rerender(<ResponseDemoPreview api={api} data={{ items: [{ ...trustedRow, year: '2025' }] }} requestUrl={requestUrl}/>)
    expect(screen.getByRole('region', { name: 'UNHCR Refugee Statistics' }).querySelector('[data-domain-card="refugee-population"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('marks a coherent response partial when executed request identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={{ items: [trustedRow] }} requestUrl={requestUrl}/>)
    const card = screen.getByRole('region', { name: 'UNHCR Refugee Statistics' }).querySelector('.refugee-population-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-identity-match', 'unbound')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('rejects request URLs that add a second aggregation dimension', () => {
    render(<ResponseDemoPreview api={api} data={{ items: [trustedRow] }} requestUrl={`${requestUrl}&coa=USA`}/>)
    const preview = screen.getByRole('region', { name: 'UNHCR Refugee Statistics' })
    expect(preview.querySelector('[data-domain-card="refugee-population"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Invalid UNHCR request context')
    expect(preview).not.toHaveTextContent('4,865,764')
  })
})
