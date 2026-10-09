import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('jokeapi-safe')
if (!api) throw new Error('Missing jokeapi-safe fixture')

const requestUrl = api.buildUrl({ category: 'Programming', type: 'twopart' })
const executedGet: ExecutedRequestContext = { method: 'GET', url: requestUrl }
const safeFlags = { nsfw: false, religious: false, political: false, racist: false, sexist: false, explicit: false }
const twoPart = (overrides: Record<string, unknown> = {}) => ({
  error: false,
  category: 'Programming',
  type: 'twopart',
  setup: 'Why did the developer cross the road?',
  delivery: 'To reach the other branch.',
  flags: safeFlags,
  id: 42,
  safe: true,
  lang: 'en',
  ...overrides,
})
const single = (overrides: Record<string, unknown> = {}) => ({
  error: false,
  category: 'Pun',
  type: 'single',
  joke: 'A bounded joke.',
  flags: safeFlags,
  id: 43,
  safe: true,
  lang: 'en',
  ...overrides,
})
const preview = (data: unknown, url = requestUrl, executedRequest: ExecutedRequestContext | undefined = executedGet) => (
  <ResponseDemoPreview api={api} data={data} requestUrl={url} executedRequest={executedRequest}/>
)

afterEach(cleanup)

describe('JokeAPI safe semantic preview', () => {
  it('renders a safe two-part joke only when it matches the exact executed request', () => {
    const { container } = render(preview(twoPart()))
    const card = container.querySelector('[data-domain-card="jokeapi-safe"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-category', 'Programming')
    expect(card).toHaveAttribute('data-requested-type', 'twopart')
    expect(card).toHaveAttribute('data-safe-flags', 'true')
    expect(card).toHaveTextContent('Why did the developer cross the road?')
    expect(card).toHaveTextContent('To reach the other branch.')
  })

  it('fails closed when executed transport evidence is missing, non-GET, or query identity drifts', () => {
    const data = twoPart()
    const { container, rerender } = render(<ResponseDemoPreview api={api} data={data} requestUrl={requestUrl}/>)
    let card = container.querySelector('[data-domain-card="jokeapi-safe"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('To reach the other branch.')

    rerender(preview(data, requestUrl, { method: 'POST', url: requestUrl }))
    card = container.querySelector('[data-domain-card="jokeapi-safe"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')

    const duplicateType = `${requestUrl}&type=single`
    rerender(preview(data, duplicateType, { method: 'GET', url: duplicateType }))
    card = container.querySelector('[data-domain-card="jokeapi-safe"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')

    const missingSafeMode = requestUrl.replace('safe-mode&', '')
    rerender(preview(data, missingSafeMode, { method: 'GET', url: missingSafeMode }))
    card = container.querySelector('[data-domain-card="jokeapi-safe"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('rejects category or type contradictions in an HTTP-success-shaped payload', () => {
    const { container, rerender } = render(preview(twoPart({ category: 'Pun' })))
    let card = container.querySelector('[data-domain-card="jokeapi-safe"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('To reach the other branch.')

    rerender(preview(twoPart({ type: 'single', joke: 'Wrong type.' })))
    card = container.querySelector('[data-domain-card="jokeapi-safe"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('Wrong type.')
  })

  it('rejects any response with unsafe moderation flags even when error=false', () => {
    const { container } = render(preview(twoPart({ flags: { ...safeFlags, explicit: true } })))
    const card = container.querySelector('[data-domain-card="jokeapi-safe"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-safe-flags', 'false')
    expect(card).not.toHaveTextContent('To reach the other branch.')
  })

  it('supports the documented single-line response shape and rejects provider errors', () => {
    const singleUrl = api.buildUrl({ category: 'Pun', type: 'single' })
    const singleGet: ExecutedRequestContext = { method: 'GET', url: singleUrl }
    const { container, rerender } = render(preview(single(), singleUrl, singleGet))
    let card = container.querySelector('[data-domain-card="jokeapi-safe"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-type', 'single')
    expect(card).toHaveTextContent('A bounded joke.')

    rerender(preview({ error: true, internalError: false, message: 'No matching joke found' }))
    card = container.querySelector('[data-domain-card="jokeapi-safe"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-result-reason', 'provider-error')
  })
})
