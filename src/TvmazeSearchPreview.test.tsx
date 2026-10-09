import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { TvmazeSearchPreview, parseTvmazeSearchRequest, parseTvmazeSearchResponse } from './previews/TvmazeSearchPreview'

const api = getApiById('tvmaze-search')!
const requestUrl = api.buildUrl({ show: 'severance' })
const executedRequest = { url: requestUrl, method: 'GET' }
const show = (overrides: Record<string, unknown> = {}) => ({
  id: 44933,
  url: 'https://www.tvmaze.com/shows/44933/severance',
  name: 'Severance',
  type: 'Scripted',
  language: 'English',
  genres: ['Drama', 'Science-Fiction', 'Thriller'],
  status: 'Running',
  runtime: 50,
  premiered: '2022-02-18',
  ended: null,
  officialSite: 'https://tv.apple.com/show/severance',
  schedule: { time: '09:00', days: ['Friday'] },
  rating: { average: 8.1 },
  network: null,
  webChannel: { id: 310, name: 'Apple TV+', country: null, officialSite: 'https://tv.apple.com/' },
  image: {
    medium: 'https://static.tvmaze.com/uploads/images/medium_portrait/450/1126221.jpg',
    original: 'https://static.tvmaze.com/uploads/images/original_untouched/450/1126221.jpg',
  },
  ...overrides,
})
const row = (showOverrides: Record<string, unknown> = {}, score: unknown = 0.8937832) => ({ score, show: show(showOverrides) })

afterEach(() => { document.body.innerHTML = '' })

describe('TVmaze exact-request-bound semantic preview', () => {
  it('renders a complete trusted batch with provider identity, relevance, schedule, channel, and attribution', () => {
    const parsed = parseTvmazeSearchResponse([row()], requestUrl, executedRequest)
    expect(parsed.result).toMatchObject({ providerRecordCount: 1, trustedRecordCount: 1, malformedEvidenceCount: 0, duplicateEvidenceCount: 0 })
    render(<TvmazeSearchPreview data={[row()]} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const card = screen.getByText('Shows for “severance”').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-query', 'severance')
    expect(card).toHaveAttribute('data-provider-record-count', '1')
    expect(card).toHaveAttribute('data-trusted-record-count', '1')
    expect(card).toHaveAttribute('data-primary-show-id', '44933')
    expect(card).toHaveAttribute('data-primary-relevance', '0.8937832')
    expect(card).toHaveTextContent('Apple TV+')
    expect(card).toHaveTextContent('Friday at 09:00')
    expect(card).toHaveTextContent('CC BY-SA')
    expect(screen.getByRole('link', { name: 'View Severance on TVmaze' })).toHaveAttribute('href', 'https://www.tvmaze.com/shows/44933/severance')
  })

  it('accepts only the canonical single-query TVmaze request', () => {
    expect(parseTvmazeSearchRequest(requestUrl)).toEqual({ query: 'severance' })
    expect(parseTvmazeSearchRequest(`${requestUrl}&foo=bar`)).toBeUndefined()
    expect(parseTvmazeSearchRequest(`${requestUrl}&q=friends`)).toBeUndefined()
    expect(parseTvmazeSearchRequest('https://api.tvmaze.com/search/shows/?q=severance')).toBeUndefined()
    expect(parseTvmazeSearchRequest('https://user:pass@api.tvmaze.com/search/shows?q=severance')).toBeUndefined()
    expect(parseTvmazeSearchRequest('https://api.tvmaze.com:8443/search/shows?q=severance')).toBeUndefined()
    expect(parseTvmazeSearchRequest('https://api.tvmaze.com/search/shows?q=%20severance%20')).toBeUndefined()
  })

  it('maps an exact request with an empty result array to empty', () => {
    render(<TvmazeSearchPreview data={[]} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    expect(screen.getByText('No TVmaze shows matched').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'empty')
  })

  it('requires exact bodyless GET execution evidence before reporting request-bound results', () => {
    const withoutExecution = parseTvmazeSearchResponse([row()], requestUrl)
    expect(withoutExecution.transportBound).toBe(false)
    render(<TvmazeSearchPreview data={[row()]} requestUrl={requestUrl}/>)
    const partial = screen.getByText('Shows for “severance”').closest('[data-domain-card]')
    expect(partial).toHaveAttribute('data-result-state', 'partial')
    expect(partial).toHaveAttribute('data-request-bound', 'false')

    for (const conflict of [
      { url: requestUrl, method: 'POST' },
      { url: requestUrl, method: 'GET', body: { unexpected: true } },
      { url: api.buildUrl({ show: 'friends' }), method: 'GET' },
    ]) {
      document.body.innerHTML = ''
      render(<TvmazeSearchPreview data={[row()]} requestUrl={requestUrl} executedRequest={conflict}/>)
      const invalid = screen.getByText('Invalid TVmaze search response').closest('[data-domain-card]')
      expect(invalid).toHaveAttribute('data-result-state', 'invalid')
      expect(invalid).toHaveAttribute('data-request-bound', 'false')
    }
  })

  it('fails closed for malformed envelopes and batches without trusted core identity', () => {
    expect(parseTvmazeSearchResponse({ results: [] }, requestUrl, executedRequest).result).toBeUndefined()
    expect(parseTvmazeSearchResponse([row({ id: '44933' })], requestUrl, executedRequest).result?.shows).toHaveLength(0)
    expect(parseTvmazeSearchResponse([row({ url: 'https://www.tvmaze.com/shows/123/wrong-id' })], requestUrl, executedRequest).result?.shows).toHaveLength(0)
    expect(parseTvmazeSearchResponse([row({}, '0.8937832')], requestUrl, executedRequest).result?.shows).toHaveLength(0)
    render(<TvmazeSearchPreview data={[row({ name: '' })]} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    expect(screen.getByText('Invalid TVmaze show identities').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds malformed and duplicate identities and marks native-number and duplicate optional evidence partial', () => {
    const secondId = 50000
    const data = [
      row(),
      row({ id: '99999', name: 'Fabricated malformed identity' }, 0.7),
      row({ name: 'Fabricated duplicate identity' }, 0.6),
      row({
        id: secondId,
        url: `https://www.tvmaze.com/shows/${secondId}/strict-wire-types`,
        name: 'Strict Wire Types',
        genres: ['Drama', 'Drama'],
        rating: { average: '7.5' },
        runtime: '42',
        image: null,
      }, 0.5),
    ]
    const parsed = parseTvmazeSearchResponse(data, requestUrl, executedRequest).result
    expect(parsed).toMatchObject({ providerRecordCount: 4, trustedRecordCount: 2, malformedEvidenceCount: 3, duplicateEvidenceCount: 2 })
    render(<TvmazeSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const card = screen.getByText('Shows for “severance”').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-malformed-evidence-count', '3')
    expect(card).toHaveAttribute('data-duplicate-evidence-count', '2')
    expect(card).not.toHaveTextContent('Fabricated malformed identity')
    expect(card).not.toHaveTextContent('Fabricated duplicate identity')
    expect(screen.getByText('Strict Wire Types').closest('article')).toHaveTextContent('RatingUnavailable')
    expect(screen.getByText('Strict Wire Types').closest('article')).toHaveTextContent('RuntimeUnavailable')
  })

  it('keeps documented nullable image evidence ready and accessible without an image', () => {
    render(<TvmazeSearchPreview data={[row({ image: null })]} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const card = screen.getByText('Shows for “severance”').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card?.querySelector('img')).toBeNull()
    expect(card).toHaveTextContent('TVmaze returned no show image')
    expect(card).toHaveTextContent('identity and schedule evidence remain available')
  })
})
