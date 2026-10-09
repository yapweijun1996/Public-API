import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('open-trivia')
if (!api) throw new Error('Missing open-trivia fixture')

const requestUrl = api.buildUrl({ amount: '6', category: '9', difficulty: 'medium' })
const executedGet: ExecutedRequestContext = { method: 'GET', url: requestUrl }
const question = (overrides: Record<string, unknown> = {}) => ({
  type: 'multiple',
  difficulty: 'medium',
  category: 'General Knowledge',
  question: 'When did Halley&#039;s Comet appear?',
  correct_answer: '1986',
  incorrect_answers: ['1976', '1942', '1909'],
  ...overrides,
})
const payload = (results: unknown[]) => ({ response_code: 0, results })
const preview = (data: unknown, url = requestUrl, executedRequest: ExecutedRequestContext | undefined = executedGet) => (
  <ResponseDemoPreview api={api} data={data} requestUrl={url} executedRequest={executedRequest}/>
)

afterEach(cleanup)

describe('Open Trivia semantic preview', () => {
  it('renders decoded multiple-choice evidence only for the exact executed request', () => {
    const { container } = render(preview(payload([question()])))
    const card = container.querySelector('[data-domain-card="open-trivia"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-amount', '6')
    expect(card).toHaveAttribute('data-requested-category', '9')
    expect(card).toHaveAttribute('data-requested-difficulty', 'medium')
    expect(card).toHaveAttribute('data-requested-type', 'multiple')
    expect(card).toHaveAttribute('data-valid-question-count', '1')
    expect(card).toHaveTextContent("When did Halley's Comet appear?")
    expect(card).toHaveTextContent('1986')
  })

  it('fails closed when executed transport evidence is missing, uses POST, or the query is duplicated', () => {
    const data = payload([question()])
    const { container, rerender } = render(<ResponseDemoPreview api={api} data={data} requestUrl={requestUrl}/>)
    let card = container.querySelector('[data-domain-card="open-trivia"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent("When did Halley's Comet appear?")

    rerender(preview(data, requestUrl, { method: 'POST', url: requestUrl }))
    card = container.querySelector('[data-domain-card="open-trivia"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')

    const duplicate = `${requestUrl}&difficulty=hard`
    rerender(preview(data, duplicate, { method: 'GET', url: duplicate }))
    card = container.querySelector('[data-domain-card="open-trivia"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds malformed or request-contradicting rows and marks remaining evidence partial', () => {
    const { container } = render(preview(payload([
      question(),
      question({ question: 'Wrong difficulty', difficulty: 'hard' }),
      question({ question: 'Duplicate answer', incorrect_answers: ['1986', '1942', '1909'] }),
    ])))
    const card = container.querySelector('[data-domain-card="open-trivia"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-question-count', '3')
    expect(card).toHaveAttribute('data-valid-question-count', '1')
    expect(card).toHaveAttribute('data-invalid-question-count', '2')
    expect(card).toHaveTextContent("When did Halley's Comet appear?")
    expect(card).not.toHaveTextContent('Wrong difficulty')
    expect(card).not.toHaveTextContent('Duplicate answer')
  })

  it('fails closed when a successful response exceeds the exact requested amount or has no trustworthy rows', () => {
    const oneQuestionUrl = api.buildUrl({ amount: '1', category: '9', difficulty: 'medium' })
    const oneGet: ExecutedRequestContext = { method: 'GET', url: oneQuestionUrl }
    const { container, rerender } = render(preview(payload([question(), question({ question: 'Second question', correct_answer: 'A', incorrect_answers: ['B', 'C', 'D'] })]), oneQuestionUrl, oneGet))
    let card = container.querySelector('[data-domain-card="open-trivia"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-result-reason', 'provider-count-exceeds-request')

    rerender(preview(payload([question({ type: 'boolean' })])))
    card = container.querySelector('[data-domain-card="open-trivia"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-result-reason', 'no-trustworthy-questions')
  })

  it('distinguishes provider no-results and rate-limit response codes', () => {
    const { container, rerender } = render(preview({ response_code: 1, results: [] }))
    let card = container.querySelector('[data-domain-card="open-trivia"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-result-reason', 'provider-no-results')
    expect(card).toHaveTextContent('reported no results')

    rerender(preview({ response_code: 5, results: [] }))
    card = container.querySelector('[data-domain-card="open-trivia"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-result-reason', 'provider-rate-limit')
    expect(card).toHaveTextContent('rate-limited')
  })

  it('maps only exact request-bound response_code=0 empty results to semantic empty', () => {
    const { container, rerender } = render(preview(payload([])))
    let card = container.querySelector('[data-domain-card="open-trivia"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-result-reason', 'request-bound-empty-success')

    rerender(<ResponseDemoPreview api={api} data={payload([])} requestUrl={requestUrl}/>)
    card = container.querySelector('[data-domain-card="open-trivia"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })
})
