import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'malaysia-core-cpi')
if (!api) throw new Error('Missing malaysia-core-cpi fixture')
const requestUrl = 'https://api.data.gov.my/data-catalogue/?id=cpi_core&filter=overall%40division&limit=12&sort=-date'
const validRows = [
  { date: '2026-07-01', division: 'overall', index: 136.2 },
  { date: '2026-06-01', division: 'overall', index: 136.2 },
  { date: '2026-05-01', division: 'overall', index: 136.0 },
]
const executedGet = { url: requestUrl, method: 'GET' }

describe('Malaysia core CPI semantic preview', () => {
  afterEach(cleanup)

  it('renders the documented overall monthly index series without calling it inflation percentage', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={validRows}/>)
    const preview = screen.getByRole('region', { name: 'Malaysia Core CPI' })
    expect(preview).toHaveAttribute('data-preview-layout', 'core-cpi-index')
    const card = preview.querySelector('.malaysia-core-cpi-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-provider-record-count', '3')
    expect(card).toHaveAttribute('data-valid-record-count', '3')
    expect(card).toHaveAttribute('data-invalid-record-count', '0')
    expect(card).toHaveAttribute('data-primary-index', '136.2')
    expect(card).toHaveAttribute('data-latest-date', '2026-07-01')
    expect(card).toHaveAttribute('data-series-count', '3')
    expect(card).toHaveAttribute('data-division', 'overall')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-limit', '12')
    expect(card).toHaveAttribute('data-row-limit-contract', 'valid')
    expect(card).toHaveAttribute('data-sort-contract', 'valid')
    expect(preview).toHaveTextContent('Index, not inflation %')
    expect(screen.getByRole('img', { name: 'Malaysia overall core CPI index trend' })).toBeInTheDocument()
  })

  it('treats the documented empty array as semantic empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={[]}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Core CPI' }).querySelector('[data-domain-card="core-cpi-index"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
  })

  it('fails closed when HTTP-success data is not the documented array', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ data: validRows }}/>)
    const preview = screen.getByRole('region', { name: 'Malaysia Core CPI' })
    expect(preview.querySelector('[data-domain-card="core-cpi-index"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('without the documented core-CPI observation array')
  })

  it('fails closed when all rows violate the monthly overall-index contract', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={[
      { date: '2026-07-02', division: 'overall', index: 136.2 },
      { date: '2026-06-01', division: '02', index: 136.2 },
    ]}/>)
    const preview = screen.getByRole('region', { name: 'Malaysia Core CPI' })
    expect(preview.querySelector('[data-domain-card="core-cpi-index"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('overall division, monthly YYYY-MM-01 date, and native numeric core CPI index')
  })

  it('marks mixed valid and malformed provider rows partial without including the mismatched index', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={[validRows[0], { date: '2026-07-02', division: 'overall', index: 999.9 }]}/>)
    const preview = screen.getByRole('region', { name: 'Malaysia Core CPI' })
    const card = preview.querySelector('.malaysia-core-cpi-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(preview).toHaveTextContent('incomplete or inconsistent with the executed request')
    expect(preview).not.toHaveTextContent('999.9')
  })

  it('fails closed when the executed data.gov.my request has an undeclared query parameter', () => {
    render(<ResponseDemoPreview api={api} requestUrl="https://api.data.gov.my/data-catalogue/?id=cpi_core&filter=overall%40division&limit=12&sort=-date&start=0" data={validRows}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Core CPI' }).querySelector('[data-domain-card="core-cpi-index"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('does not trust a numeric-string CPI index as provider numeric evidence', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={[{ date: '2026-07-01', division: 'overall', index: '136.2' }]}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Core CPI' }).querySelector('[data-domain-card="core-cpi-index"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed when the displayed canonical URL was actually executed as POST', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={validRows}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Core CPI' }).querySelector('[data-domain-card="core-cpi-index"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('keeps coherent data partial when executed transport identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={validRows}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Core CPI' }).querySelector('[data-domain-card="core-cpi-index"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

})
