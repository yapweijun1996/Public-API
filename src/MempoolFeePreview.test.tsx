import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = apiCatalog.find((candidate) => candidate.id === 'mempool-space-btc')!
const requestUrl = api.buildUrl({})
const executedGet: ExecutedRequestContext = { url: requestUrl, method: 'GET' }
const complete = { fastestFee: 7, halfHourFee: 5, hourFee: 4, economyFee: 2, minimumFee: 1 }
const card = () => screen.getByRole('region', { name: 'mempool.space Bitcoin' }).querySelector('.transaction-fees-preview') as HTMLElement

describe('mempool.space recommended-fee semantic contract', () => {
  afterEach(cleanup)

  it('renders the five documented finite non-negative fee fields as request-bound ready data', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={complete}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-provider-fee-field-count', '5')
    expect(root).toHaveAttribute('data-valid-fee-field-count', '5')
    expect(root).toHaveAttribute('data-invalid-fee-field-count', '0')
    expect(root).toHaveAttribute('data-missing-fee-field-count', '0')
    expect(root).toHaveAttribute('data-primary-fee-sat-vb', '7')
    expect(root).toHaveAttribute('data-minimum-fee-sat-vb', '1')
  })

  it('preserves legitimate decimal and sub-sat fee values', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{ fastestFee: 1.25, halfHourFee: 0.9, hourFee: 0.5, economyFee: 0.2, minimumFee: 0.1 }}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-primary-fee-sat-vb', '1.25')
    expect(root).toHaveAttribute('data-minimum-fee-sat-vb', '0.1')
    expect(root).toHaveTextContent('0.1 sat/vB')
  })

  it('marks a mixed malformed HTTP-success payload partial and hides invalid fee values', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{ fastestFee: 7, halfHourFee: -99, hourFee: '4', economyFee: 2 }}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-provider-fee-field-count', '4')
    expect(root).toHaveAttribute('data-valid-fee-field-count', '2')
    expect(root).toHaveAttribute('data-invalid-fee-field-count', '2')
    expect(root).toHaveAttribute('data-missing-fee-field-count', '1')
    expect(root).toHaveAttribute('data-half-hour-fee-sat-vb', '')
    expect(root).toHaveAttribute('data-hour-fee-sat-vb', '')
    expect(root).not.toHaveTextContent('-99 sat/vB')
  })

  it('fails closed when no documented fee field contains a trustworthy number', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{ fastestFee: '7', halfHourFee: -5, hourFee: null, economyFee: Number.NaN }}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-valid-fee-field-count', '0')
    expect(root).toHaveTextContent('Invalid recommended-fees response')
    expect(root).not.toHaveTextContent('Recommended Bitcoin fee rates')
  })

  it('does not claim ready without exact executed request evidence', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={complete}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(card()).toHaveAttribute('data-request-contract', 'exact-mempool-recommended-fees-v2')

    rerender(<ResponseDemoPreview api={api} requestUrl="https://mempool.space/api/v1/fees/precise" data={complete}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveTextContent('Invalid mempool.space request identity')
  })

  it.each([
    { label: 'POST', request: { url: requestUrl, method: 'POST' } },
    { label: 'GET with body', request: { url: requestUrl, method: 'GET', body: { unexpected: true } } },
    { label: 'URL drift', request: { url: `${requestUrl}#drift`, method: 'GET' } },
  ])('fails closed when the displayed endpoint is paired with an executed $label transport', ({ request }) => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={request as ExecutedRequestContext} data={complete}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(card()).toHaveTextContent('Invalid mempool.space request identity')
    expect(card()).not.toHaveTextContent('Recommended Bitcoin fee rates')
  })
  it.each([
    'https://user:pass@mempool.space/api/v1/fees/recommended',
    'https://mempool.space:444/api/v1/fees/recommended',
  ])('rejects non-canonical endpoint identity %s', (invalidUrl) => {
    render(<ResponseDemoPreview api={api} requestUrl={invalidUrl} executedRequest={{ url: invalidUrl, method: 'GET' }} data={complete}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
  })

})
