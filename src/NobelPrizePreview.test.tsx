import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { NobelPrizePreview } from './previews/NobelPrizePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('nobel-prizes')
if (!api) throw new Error('Missing nobel-prizes fixture')
const requestUrl = api.buildUrl({ category: 'phy', limit: '2' })
const executedGet: ExecutedRequestContext = { method: 'GET', url: requestUrl }
const prize = (overrides: Record<string, unknown> = {}) => ({ awardYear: '2025', category: { en: 'Physics' }, prizeAmount: 11000000, laureates: [{ knownName: { en: 'Ada Example' }, motivation: { en: 'for bounded evidence' } }], ...overrides })
const response = (rows: unknown[], meta: Record<string, unknown> = {}) => ({ nobelPrizes: rows, meta: { offset: 0, limit: 2, nobelPrizeCategory: 'phy', count: 125, ...meta } })

afterEach(cleanup)

describe('Nobel Prize request-bound semantic preview', () => {
  it('renders only a provider-echoed exact category/limit response as ready', () => {
    const { container } = render(<NobelPrizePreview api={api} data={response([prize(), prize({ awardYear: '2024', laureates: [{ knownName: { en: 'Grace Example' }, motivation: { en: 'for another bounded result' } }] })])} requestUrl={requestUrl} executedRequest={executedGet}/>)
    const card = container.querySelector('[data-domain-card="nobel-prizes"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-provider-request-match', 'true')
    expect(card).toHaveAttribute('data-requested-category', 'phy')
    expect(card).toHaveAttribute('data-requested-limit', '2')
    expect(card).toHaveTextContent('Ada Example')
    expect(card).toHaveTextContent('11M SEK')
  })

  it('fails closed for duplicate or drifted request identity and provider-echo mismatch', () => {
    const duplicate = `${requestUrl}&nobelPrizeCategory=che`
    const { container, rerender } = render(<NobelPrizePreview api={api} data={response([prize()])} requestUrl={duplicate} executedRequest={{ method: 'GET', url: duplicate }}/>)
    let card = container.querySelector('[data-domain-card="nobel-prizes"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('Ada Example')

    rerender(<NobelPrizePreview api={api} data={response([prize()], { nobelPrizeCategory: 'che' })} requestUrl={requestUrl} executedRequest={executedGet}/>)
    card = container.querySelector('[data-domain-card="nobel-prizes"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-provider-request-match', 'false')
  })

  it('withholds wrong-category or malformed rows and never fabricates a zero prize amount', () => {
    const limitThreeUrl = api.buildUrl({ category: 'phy', limit: '3' })
    const { container } = render(<NobelPrizePreview api={api} data={response([prize(), prize({ category: { en: 'Chemistry' } }), prize({ prizeAmount: '11000000' })], { limit: 3 })} requestUrl={limitThreeUrl} executedRequest={{ method: 'GET', url: limitThreeUrl }}/>)
    const card = container.querySelector('[data-domain-card="nobel-prizes"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-prize-count', '1')
    expect(card).toHaveAttribute('data-invalid-prize-count', '2')
    expect(card).not.toHaveTextContent('0 SEK')
  })

  it('trusts an empty result only when exact request and provider metadata agree', () => {
    const { container, rerender } = render(<NobelPrizePreview api={api} data={response([])} requestUrl={requestUrl} executedRequest={executedGet}/>)
    let card = container.querySelector('[data-domain-card="nobel-prizes"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')

    rerender(<NobelPrizePreview api={api} data={response([], { limit: 6 })} requestUrl={requestUrl} executedRequest={executedGet}/>)
    card = container.querySelector('[data-domain-card="nobel-prizes"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })
})
