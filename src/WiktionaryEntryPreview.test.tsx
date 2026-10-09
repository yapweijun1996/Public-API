import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('wiktionary-entry')
if (!api) throw new Error('Missing wiktionary-entry fixture')
const requestUrl = api.buildUrl({ word: 'hello' })
const executedGet: ExecutedRequestContext = { method: 'GET', url: requestUrl }
const response = {
  en: [{
    partOfSpeech: 'Interjection',
    language: 'English',
    definitions: [{ definition: '<span>A greeting used when meeting someone.</span>', examples: ['Hello, everyone.'], synonyms: ['hi'] }],
    synonyms: ['greetings'],
  }],
  fr: [{
    partOfSpeech: 'Interjection',
    language: 'French',
    definitions: [{ definition: 'Injected French definition.' }],
  }],
  ff: [{
    partOfSpeech: 'Noun',
    language: 'Fula',
    definitions: [{ definition: 'Injected Fula definition.' }],
  }],
}

afterEach(cleanup)

describe('Wiktionary exact-request English definition preview', () => {
  it('renders only English definitions from a request-bound Wiktionary response', async () => {
    const { container, findByText } = render(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={executedGet}/>)
    await findByText('A greeting used when meeting someone.')
    const card = container.querySelector('[data-domain-card="wiktionary-entry"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-word', 'hello')
    expect(card).toHaveAttribute('data-provider-language-count', '3')
    expect(card).toHaveAttribute('data-english-entry-count', '1')
    expect(card).toHaveAttribute('data-ignored-non-english-entry-count', '2')
    expect(card).not.toHaveTextContent('Injected French definition.')
    expect(card).not.toHaveTextContent('Injected Fula definition.')
  })

  it('fails closed for wrong method, body, or executed URL drift', async () => {
    const { container, rerender, findByText } = render(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={{ method: 'POST', url: requestUrl }}/>)
    await findByText('Wiktionary response not trusted')
    let card = container.querySelector('[data-domain-card="wiktionary-entry"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('A greeting used when meeting someone.')

    rerender(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={{ method: 'GET', url: requestUrl, body: { unexpected: true } }}/>)
    await findByText('Wiktionary response not trusted')
    card = container.querySelector('[data-domain-card="wiktionary-entry"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={{ method: 'GET', url: api.buildUrl({ word: 'world' }) }}/>)
    await findByText('Wiktionary response not trusted')
    card = container.querySelector('[data-domain-card="wiktionary-entry"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('keeps structurally usable definitions partial when executed-request evidence is unavailable', async () => {
    const { container, findByText } = render(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl}/>)
    await findByText('A greeting used when meeting someone.')
    const card = container.querySelector('[data-domain-card="wiktionary-entry"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('withholds malformed English entries and rejects HTTP-200 responses with no valid English definition evidence', async () => {
    const mixed = {
      ...response,
      en: [
        response.en[0],
        { partOfSpeech: '', language: 'English', definitions: [{ definition: 'Malformed English entry.' }] },
      ],
    }
    const { container, rerender, findByText } = render(<ResponseDemoPreview api={api} data={mixed} requestUrl={requestUrl} executedRequest={executedGet}/>)
    await findByText('A greeting used when meeting someone.')
    let card = container.querySelector('[data-domain-card="wiktionary-entry"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-invalid-english-entry-count', '1')
    expect(card).not.toHaveTextContent('Malformed English entry.')

    rerender(<ResponseDemoPreview api={api} data={{ fr: response.fr }} requestUrl={requestUrl} executedRequest={executedGet}/>)
    await findByText('English definition evidence unavailable')
    card = container.querySelector('[data-domain-card="wiktionary-entry"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('Injected French definition.')
  })
})
