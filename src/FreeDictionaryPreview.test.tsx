import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('free-dictionary')
if (!api) throw new Error('Missing free-dictionary fixture')
const requestUrl = api.buildUrl({ word: 'hello' })
const executedGet: ExecutedRequestContext = { method: 'GET', url: requestUrl }
const response = {
  word: 'hello',
  entries: [{
    language: { code: 'en', name: 'English' },
    partOfSpeech: 'interjection',
    pronunciations: [{ type: 'ipa', text: '/hɛˈloʊ/', tags: ['General American'] }],
    senses: [{ definition: 'Used as a greeting.', examples: ['Hello, everyone.'], synonyms: ['hi'] }],
    synonyms: ['greetings'],
    antonyms: [],
  }],
  source: {
    url: 'https://en.wiktionary.org/wiki/hello',
    license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  },
}

afterEach(cleanup)

describe('Free Dictionary request-bound semantic preview', () => {
  it('renders an exact English word response as ready with source attribution evidence', async () => {
    const { container, findByText } = render(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={executedGet}/>)
    await findByText('Used as a greeting.')
    const card = container.querySelector('[data-domain-card="free-dictionary"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-word', 'hello')
    expect(card).toHaveAttribute('data-provider-word', 'hello')
    expect(card).toHaveAttribute('data-valid-entry-count', '1')
    expect(card).toHaveAttribute('data-source-valid', 'true')
    expect(card).toHaveTextContent('CC BY-SA 4.0')
  })

  it('fails closed when HTTP-200 response identity contradicts the requested word', async () => {
    const wrong = { ...response, word: 'world', entries: [{ ...response.entries[0], senses: [{ definition: 'Injected wrong-word definition.' }] }] }
    const { container, findByText } = render(<ResponseDemoPreview api={api} data={wrong} requestUrl={requestUrl} executedRequest={executedGet}/>)
    await findByText('Dictionary response not trusted')
    const card = container.querySelector('[data-domain-card="free-dictionary"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-response-word-match', 'false')
    expect(card).not.toHaveTextContent('Injected wrong-word definition.')
  })

  it('fails closed for method/body/URL drift and only trusts coherent empty results when request-bound', async () => {
    const { container, rerender, findByText } = render(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={{ method: 'POST', url: requestUrl }}/>)
    await findByText('Dictionary response not trusted')
    let card = container.querySelector('[data-domain-card="free-dictionary"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={{ method: 'GET', url: requestUrl, body: { unexpected: true } }}/>)
    await findByText('Dictionary response not trusted')
    card = container.querySelector('[data-domain-card="free-dictionary"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={{ method: 'GET', url: api.buildUrl({ word: 'world' }) }}/>)
    await findByText('Dictionary response not trusted')
    card = container.querySelector('[data-domain-card="free-dictionary"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} data={{ ...response, entries: [] }} requestUrl={requestUrl} executedRequest={executedGet}/>)
    await findByText('No dictionary entries returned')
    card = container.querySelector('[data-domain-card="free-dictionary"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
  })

  it('withholds malformed or non-English entries instead of presenting them as trusted definitions', async () => {
    const mixed = {
      ...response,
      entries: [
        response.entries[0],
        { language: { code: 'fr', name: 'French' }, partOfSpeech: 'noun', senses: [{ definition: 'Bonjour mismatch.' }] },
        { language: { code: 'en', name: 'English' }, partOfSpeech: '', senses: [{ definition: 'Malformed entry.' }] },
      ],
    }
    const { container, findByText } = render(<ResponseDemoPreview api={api} data={mixed} requestUrl={requestUrl} executedRequest={executedGet}/>)
    await findByText('Used as a greeting.')
    const card = container.querySelector('[data-domain-card="free-dictionary"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-entry-count', '1')
    expect(card).toHaveAttribute('data-invalid-entry-count', '2')
    expect(card).not.toHaveTextContent('Bonjour mismatch.')
    expect(card).not.toHaveTextContent('Malformed entry.')
  })
})
