import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'datamuse-rhymes')
if (!api) throw new Error('Missing Datamuse fixture')

const requestUrl = api.buildUrl({ word: 'orange' })
const executedRequest = { url: requestUrl, method: 'GET' }

describe('Datamuse documented sounds-like semantic preview', () => {
  afterEach(cleanup)

  it('uses the documented sounds-like request contract with bounded lexical metadata', () => {
    const url = new URL(api.buildUrl({ word: 'orange' }))
    expect(url.pathname).toBe('/words')
    expect(url.searchParams.get('sl')).toBe('orange')
    expect(url.searchParams.get('rel_rhy')).toBeNull()
    expect(url.searchParams.get('max')).toBe('8')
    expect(url.searchParams.get('md')).toBe('psr')
    expect(url.searchParams.get('ipa')).toBe('1')
    expect(api.name).toBe('Datamuse Sounds-Like Finder')
    expect(api.usageNote).toContain('2027-01-01')
    expect(api.usageNote).toContain('ordering')
    expect(api.usageNote).toContain('acknowledge Datamuse')
  })

  it('distinguishes documented empty results from malformed HTTP-success records', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={[]}/>)
    let card = screen.getByRole('region', { name: 'Datamuse Sounds-Like Finder' }).querySelector('[data-domain-card="lexical-matches"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveTextContent('empty list')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={[{ score: 100, tags: ['n'] }]}/>)
    card = screen.getByRole('region', { name: 'Datamuse Sounds-Like Finder' }).querySelector('[data-domain-card="lexical-matches"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveTextContent('required word identity')
    expect(card).not.toHaveTextContent('Match 1')
  })

  it('requires exact bodyless GET execution evidence before reporting request-bound lexical results', () => {
    const response = [{ word: 'orange', score: 100, numSyllables: 2, tags: ['n', 'ipa_pron:ˈɔrʌndʒ'] }]

    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response}/>)
    let card = screen.getByRole('region', { name: 'Datamuse Sounds-Like Finder' }).querySelector('.datamuse-word-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={response}/>)
    card = screen.getByRole('region', { name: 'Datamuse Sounds-Like Finder' }).querySelector('[data-domain-card="lexical-matches"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={response}/>)
    card = screen.getByRole('region', { name: 'Datamuse Sounds-Like Finder' }).querySelector('.datamuse-word-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
  })

  it('keeps usable word records but marks a mixed provider payload partial', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={[
      { word: 'orange', score: 100, tags: ['n'] },
      { score: 99, tags: ['adj'] },
    ]}/>)

    const card = screen.getByRole('region', { name: 'Datamuse Sounds-Like Finder' }).querySelector('.datamuse-word-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(card).toHaveTextContent('orange')
    expect(card).toHaveTextContent('1 provider record omitted')
    expect(card).not.toHaveTextContent('Match 2')
  })

  it('maps pronunciation, part of speech, syllables and provider ordering into dedicated semantic DOM', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={[
      { word: 'orange', score: 100, numSyllables: 2, tags: ['n', 'adj', 'v', 'pron:AO1 R AH0 N JH', 'ipa_pron:ˈɔrʌndʒ'] },
      { word: 'oranje', score: 97, numSyllables: 2, tags: ['n', 'pron:AO1 R IH0 N JH', 'ipa_pron:ˈɔrɪndʒ'] },
    ]}/>)

    const preview = screen.getByRole('region', { name: 'Datamuse Sounds-Like Finder' })
    expect(preview).toHaveAttribute('data-preview-layout', 'lexical-matches')
    expect(preview).toHaveAttribute('data-ssot-fallback', 'false')
    const card = preview.querySelector('.datamuse-word-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-invalid-record-count', '0')
    expect(card).toHaveAttribute('data-query-constraint', 'sl')
    expect(card).toHaveAttribute('data-query-term', 'orange')
    expect(card).toHaveAttribute('data-primary-word', 'orange')
    expect(card).toHaveAttribute('data-primary-ipa', 'ˈɔrʌndʒ')
    expect(preview).toHaveTextContent('Pronunciation (IPA)')
    expect(preview).toHaveTextContent('ˈɔrʌndʒ')
    expect(preview).toHaveTextContent('Noun, Adjective, Verb')
    expect(preview).toHaveTextContent('100 · ordering only')
    expect(preview).toHaveTextContent('2027-01-01')
    expect(preview).not.toHaveTextContent('Datamuse Sounds-Like Finder record 1')
  })
})
