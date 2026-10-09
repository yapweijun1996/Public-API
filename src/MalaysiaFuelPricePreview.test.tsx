import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'malaysia-fuel-price')
if (!api) throw new Error('Missing malaysia-fuel-price fixture')
const requestUrl = 'https://api.data.gov.my/data-catalogue/?id=fuelprice&limit=12&sort=-date'
const executedGet = { url: requestUrl, method: 'GET' }
const validRows = [
  { date: '2026-09-17', series_type: 'level', ron95: 2.6, ron97: 3.4, diesel: 2.95, diesel_eastmsia: 2.15, ron95_budi95: 1.99, ron95_skps: 2.05 },
  { date: '2026-09-17', series_type: 'change_weekly', ron95: 0, ron97: -0.05, diesel: -0.02, diesel_eastmsia: 0, ron95_budi95: 0, ron95_skps: 0 },
  { date: '2026-09-10', series_type: 'level', ron95: 2.6, ron97: 3.45, diesel: 2.97, diesel_eastmsia: 2.15, ron95_budi95: 1.99, ron95_skps: 2.05 },
] as const

describe('Malaysia fuel price semantic preview', () => {
  afterEach(cleanup)

  it('binds the official data.gov.my fuel rows to the exact executed request', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={validRows}/>)
    const preview = screen.getByRole('region', { name: 'Malaysia Fuel Price' })
    expect(preview).toHaveAttribute('data-preview-layout', 'fuel-dashboard')
    const card = preview.querySelector('.fuel-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-limit', '12')
    expect(card).toHaveAttribute('data-provider-record-count', '3')
    expect(card).toHaveAttribute('data-level-record-count', '2')
    expect(card).toHaveAttribute('data-change-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '0')
    expect(card).toHaveAttribute('data-latest-date', '2026-09-17')
    expect(within(preview).getByText('RM 2.6')).toBeInTheDocument()
    expect(within(preview).getByText('East Malaysia diesel')).toBeInTheDocument()
    expect(within(preview).getByText('SKPS')).toBeInTheDocument()
    expect(within(preview).getByText('↓ RM 0.05')).toBeInTheDocument()
    expect(within(preview).getByRole('img', { name: 'RON95 price history sparkline' })).toBeInTheDocument()
  })

  it('fails closed when a canonical displayed request was actually executed as POST', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={validRows}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Fuel Price' }).querySelector('[data-domain-card="fuel-market"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('fails closed on extra request parameters instead of trusting an HTTP-success payload', () => {
    const drifted = `${requestUrl}&foo=bar`
    render(<ResponseDemoPreview api={api} requestUrl={drifted} executedRequest={{ url: drifted, method: 'GET' }} data={validRows}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Fuel Price' }).querySelector('[data-domain-card="fuel-market"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds malformed provider rows while preserving trustworthy level rows as partial', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={[
      validRows[0],
      { ...validRows[1], ron97: '999.99' },
      validRows[2],
    ]}/>)
    const preview = screen.getByRole('region', { name: 'Malaysia Fuel Price' })
    const card = preview.querySelector('.fuel-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-record-count', '2')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(preview).not.toHaveTextContent('999.99')
  })

  it('marks a valid empty exact response as semantic empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={[]}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Fuel Price' }).querySelector('[data-domain-card="fuel-market"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-request-bound', 'true')
  })

  it('keeps coherent fuel data partial when executed transport identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={validRows}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Fuel Price' }).querySelector('.fuel-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('fails closed when the exact GET request carried a body', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={validRows}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Fuel Price' }).querySelector('[data-domain-card="fuel-market"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('does not silently clamp an out-of-contract limit inside buildUrl', () => {
    expect(new URL(api.buildUrl({ limit: '105' })).searchParams.get('limit')).toBe('105')
  })
})
