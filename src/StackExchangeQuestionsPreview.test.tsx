import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = apiCatalog.find((candidate) => candidate.id === 'stack-exchange')
if (!api) throw new Error('Missing Stack Exchange Questions fixture')
const requestUrl = 'https://api.stackexchange.com/2.3/questions?order=desc&sort=activity&tagged=javascript&site=stackoverflow&pagesize=8'
const executed = (url = requestUrl, method = 'GET', body?: unknown): ExecutedRequestContext => ({
  url,
  method,
  ...(body === undefined ? {} : { body }),
})

const question = (id = 123456, overrides: Record<string, unknown> = {}) => ({
  tags: ['javascript', 'reactjs'],
  owner: { display_name: 'Example user' },
  is_answered: true,
  view_count: 1234,
  answer_count: 3,
  score: 12,
  last_activity_date: 1789230000,
  creation_date: 1789200000,
  question_id: id,
  link: `https://stackoverflow.com/questions/${id}/example-question`,
  title: 'Example JavaScript question',
  ...overrides,
})

const fixture = (items: unknown[] = [question()], overrides: Record<string, unknown> = {}) => ({
  items,
  has_more: false,
  quota_max: 300,
  quota_remaining: 299,
  ...overrides,
})

const card = () => screen.getByRole('region', { name: 'Stack Exchange Questions' }).querySelector('[data-domain-card="stack-exchange-questions"]')

describe('Stack Exchange Questions semantic preview', () => {
  afterEach(cleanup)

  it('renders request-bound question results as ready with wrapper and tag evidence', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={fixture()}/>)
    const preview = screen.getByRole('region', { name: 'Stack Exchange Questions' })
    expect(preview).toHaveAttribute('data-preview-layout', 'community-questions')
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-site', 'stackoverflow')
    expect(card()).toHaveAttribute('data-request-tags', 'javascript')
    expect(card()).toHaveAttribute('data-request-sort', 'activity')
    expect(card()).toHaveAttribute('data-request-page-size', '8')
    expect(card()).toHaveAttribute('data-query-bound', 'true')
    expect(card()).toHaveAttribute('data-provider-result-count', '1')
    expect(card()).toHaveAttribute('data-valid-result-count', '1')
    expect(card()).toHaveAttribute('data-invalid-result-count', '0')
    expect(card()).toHaveAttribute('data-incomplete-result-count', '0')
    expect(card()).toHaveAttribute('data-wrapper-contract', 'true')
    expect(card()).toHaveAttribute('data-tag-contract', 'true')
    expect(preview).toHaveTextContent('1,234')
    expect(preview).toHaveTextContent('API quota 299 / 300')
  })

  it('renders a request-bound zero-result wrapper as empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={fixture([])}/>)
    expect(card()).toHaveAttribute('data-result-state', 'empty')
    expect(card()).toHaveAttribute('data-has-more', 'false')
    expect(screen.getByRole('region', { name: 'Stack Exchange Questions' })).toHaveTextContent('No Stack Overflow questions matched')
  })

  it('fails closed on a malformed HTTP-success wrapper', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={{ items: {} }}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'Stack Exchange Questions' })).toHaveTextContent('Invalid Stack Exchange response')
  })

  it('hides a question that contradicts the requested AND-tag constraint', () => {
    const contradictory = question(999999, { tags: ['typescript'], title: 'Fabricated unrelated question', view_count: 999999999 })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={fixture([question(), contradictory])}/>)
    const preview = screen.getByRole('region', { name: 'Stack Exchange Questions' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-provider-result-count', '2')
    expect(card()).toHaveAttribute('data-valid-result-count', '1')
    expect(card()).toHaveAttribute('data-invalid-result-count', '1')
    expect(preview).not.toHaveTextContent('Fabricated unrelated question')
    expect(preview).not.toHaveTextContent('999,999,999')
  })

  it('does not coerce malformed counters into plausible zero facts', () => {
    const malformed = question(234567, { view_count: '0', answer_count: -1, score: '0' })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={fixture([malformed])}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-incomplete-result-count', '1')
    expect(screen.getByText('Score').nextElementSibling).toHaveTextContent('Unavailable')
    expect(screen.getByText('Answers').nextElementSibling).toHaveTextContent('Unavailable')
    expect(screen.getByText('Views').nextElementSibling).toHaveTextContent('Unavailable')
  })

  it('surfaces a valid provider backoff without treating the response as malformed', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={fixture([question()], { backoff: 60 })}/>)
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-backoff-seconds', '60')
    expect(screen.getByRole('region', { name: 'Stack Exchange Questions' })).toHaveTextContent('wait 60 seconds')
  })

  it('fails closed when the executed transport is not the supported bodyless GET', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed(requestUrl, 'POST')} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed(requestUrl, 'GET', { unexpected: true })} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed on unsupported executed request identity and stays partial without request identity', () => {
    const unsupportedUrl = 'https://api.stackexchange.com/2.3/questions?order=asc&sort=activity&tagged=javascript&site=stackoverflow&pagesize=8'
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={unsupportedUrl} executedRequest={executed(unsupportedUrl)} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')

    const oversizedUrl = requestUrl.replace('pagesize=8', 'pagesize=100')
    rerender(<ResponseDemoPreview api={api} requestUrl={oversizedUrl} executedRequest={executed(oversizedUrl)} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed(`${requestUrl}&extra=1`)} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-query-bound', 'false')
    expect(screen.getByRole('region', { name: 'Stack Exchange Questions' })).toHaveTextContent('executed-request identity is unavailable')
  })
})
