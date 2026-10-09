import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('wikimedia-pageviews')!

const executedRequest = (overrides: Partial<{ article: string; access: string; agent: string; start: string; end: string }> = {}): ExecutedRequestContext => {
  const article = overrides.article ?? 'Singapore'
  const access = overrides.access ?? 'all-access'
  const agent = overrides.agent ?? 'user'
  const start = overrides.start ?? '20260701'
  const end = overrides.end ?? '20260707'
  return {
    method: 'GET',
    url: `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/${access}/${agent}/${encodeURIComponent(article)}/daily/${start}/${end}`,
  }
}

const item = (day: number, views: unknown, overrides: Record<string, unknown> = {}) => ({
  project: 'en.wikipedia',
  article: 'Singapore',
  granularity: 'daily',
  timestamp: `202607${String(day).padStart(2, '0')}00`,
  access: 'all-access',
  agent: 'user',
  views,
  ...overrides,
})

const renderPreview = (data: unknown, request = executedRequest()) => {
  render(<ResponseDemoPreview api={api} data={data} requestUrl={request.url} executedRequest={request}/>)
  const region = screen.getByRole('region', { name: 'Wikimedia Pageviews' })
  const card = region.querySelector('[data-domain-card="wikimedia-pageviews"]')
  expect(card).not.toBeNull()
  return { region, card: card as HTMLElement }
}

afterEach(cleanup)

describe('Wikimedia Pageviews semantic preview', () => {
  it('binds a complete daily series to the exact executed request', () => {
    const { region, card } = renderPreview({ items: Array.from({ length: 7 }, (_, index) => item(index + 1, 12000 + index * 100)) })

    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-article', 'Singapore')
    expect(card).toHaveAttribute('data-request-start-date', '2026-07-01')
    expect(card).toHaveAttribute('data-request-end-date', '2026-07-07')
    expect(card).toHaveAttribute('data-request-day-count', '7')
    expect(card).toHaveAttribute('data-provider-record-count', '7')
    expect(card).toHaveAttribute('data-valid-record-count', '7')
    expect(card).toHaveAttribute('data-invalid-record-count', '0')
    expect(card).toHaveAttribute('data-missing-day-count', '0')
    expect(card).toHaveAttribute('data-malformed-view-count', '0')
    expect(card).toHaveAttribute('data-row-identity-contract', 'true')
    expect(card).toHaveAttribute('data-date-range-contract', 'true')
    expect(region).toHaveTextContent('Total views')
    expect(region).toHaveTextContent('Daily average')
  })

  it('withholds numeric-string views and wrong-identity rows instead of trusting or coercing them', () => {
    const { region, card } = renderPreview({
      items: [
        item(1, 12000),
        item(2, '99999'),
        item(3, 88000, { article: 'Wrong_Article' }),
        item(4, 14000),
        item(5, 15000),
        item(6, 16000),
        item(7, 17000),
      ],
    })

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-record-count', '5')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(card).toHaveAttribute('data-malformed-view-count', '1')
    expect(card).toHaveAttribute('data-missing-day-count', '2')
    expect(region).not.toHaveTextContent('99,999')
    expect(region).not.toHaveTextContent('88,000')
  })

  it('treats omitted request days as partial evidence without inventing zero-valued observations', () => {
    const { region, card } = renderPreview({ items: [item(1, 12000), item(2, 13000), item(4, 15000), item(5, 16000), item(6, 17000), item(7, 18000)] })

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-missing-day-count', '1')
    expect(card).toHaveAttribute('data-valid-record-count', '6')
    expect(region).toHaveTextContent('6 / 7')
  })

  it('keeps a structurally valid empty provider series empty instead of fabricating a zero', () => {
    const { region, card } = renderPreview({ items: [] })

    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-provider-record-count', '0')
    expect(region).toHaveTextContent('No pageview observations returned')
    expect(region).not.toHaveTextContent('0 views')
  })

  it('fails closed when the executed request contract is not the catalog-supported request', () => {
    const { region, card } = renderPreview({ items: [item(1, 12000)] }, executedRequest({ access: 'desktop' }))

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(region).toHaveTextContent('Pageview evidence unavailable')
  })

  it('fails closed when an HTTP-success payload has no trustworthy request-matching rows', () => {
    const { region, card } = renderPreview({ items: [item(1, 12000, { project: 'de.wikipedia', article: 'Wrong_Article' })] })

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-valid-record-count', '0')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(region).not.toHaveTextContent('12,000')
  })
})
