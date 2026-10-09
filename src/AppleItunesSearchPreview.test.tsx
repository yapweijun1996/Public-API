import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = getApiById('apple-itunes-search')!
const requestUrl = api.buildUrl({ query: 'Beatles', entity: 'song', country: 'sg', limit: '2' })
const executedRequest = { url: requestUrl, method: 'GET' }
const song = (trackId: number, overrides: Record<string, unknown> = {}) => ({
  wrapperType: 'track',
  kind: 'song',
  artistId: 136975,
  collectionId: 1441164495,
  trackId,
  artistName: 'The Beatles',
  collectionName: 'Let It Be',
  trackName: trackId === 1 ? 'Let It Be' : 'Hey Jude',
  trackViewUrl: `https://music.apple.com/sg/album/example/1441164495?i=${trackId}`,
  artistViewUrl: 'https://music.apple.com/sg/artist/the-beatles/136975',
  collectionViewUrl: 'https://music.apple.com/sg/album/example/1441164495',
  artworkUrl100: `https://is1-ssl.mzstatic.com/image/thumb/example/${trackId}.jpg`,
  previewUrl: `https://audio-ssl.itunes.apple.com/example/${trackId}.m4a`,
  primaryGenreName: 'Rock',
  releaseDate: '1970-03-06T12:00:00Z',
  trackTimeMillis: 243000,
  trackExplicitness: 'notExplicit',
  country: 'SGP',
  currency: 'SGD',
  trackPrice: 1.48,
  ...overrides,
})

const card = async () => (await screen.findByRole('region', { name: 'Apple iTunes Search' })).querySelector('[data-domain-card="apple-itunes-search"]')

describe('Apple iTunes Search semantic preview', () => {
  it('binds native song identities to the exact supported storefront request without embedding promotional media', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={{ resultCount: 2, results: [song(1), song(2)] }}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-entity', 'song')
    expect(root).toHaveAttribute('data-request-media', 'music')
    expect(root).toHaveAttribute('data-request-country', 'sg')
    expect(root).toHaveAttribute('data-valid-record-count', '2')
    expect(root).toHaveAttribute('data-primary-media-identity', 'track:1')
    expect(root).toHaveTextContent('Let It Be')
    expect(root).toHaveTextContent('The Beatles')
    expect(root).toHaveTextContent('promotional-content terms')
    expect(within(root as HTMLElement).getAllByRole('link', { name: /View on Apple/i })).toHaveLength(2)
    expect(root?.querySelector('img')).toBeNull()
    expect(root?.querySelector('audio')).toBeNull()
  })

  it('fails closed when unknown or duplicate query parameters can still produce HTTP 200', async () => {
    const payload = { resultCount: 1, results: [song(1)] }
    const unknown = render(<ResponseDemoPreview api={api} executedRequest={{ method: 'GET', url: `${requestUrl}&foo=bar` }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    unknown.unmount()
    render(<ResponseDemoPreview api={api} executedRequest={{ method: 'GET', url: `${requestUrl}&limit=1` }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds duplicate and wrong-entity identities while preserving trustworthy rows as partial', async () => {
    const threeResultUrl = api.buildUrl({ query: 'Beatles', entity: 'song', country: 'sg', limit: '3' })
    render(<ResponseDemoPreview api={api} executedRequest={{ method: 'GET', url: threeResultUrl }} data={{ resultCount: 3, results: [
      song(1),
      song(1, { trackName: 'Duplicate fabricated title' }),
      song(3, { kind: 'podcast', trackName: 'Wrong entity fabricated title', trackViewUrl: 'https://podcasts.apple.com/sg/podcast/example/id3' }),
    ] }}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-valid-record-count', '1')
    expect(root).toHaveAttribute('data-duplicate-record-count', '1')
    expect(root).toHaveAttribute('data-malformed-record-count', '1')
    expect(root).not.toHaveTextContent('Duplicate fabricated title')
    expect(root).not.toHaveTextContent('Wrong entity fabricated title')
  })

  it('rejects non-native counts and non-empty batches with no trustworthy entity identity', async () => {
    const nonNative = render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={{ resultCount: '1', results: [song(1)] }}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    nonNative.unmount()
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={{ resultCount: 1, results: [song(1, { trackId: '1' })] }}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('maps a coherent exact-request zero-result response to empty', async () => {
    const url = api.buildUrl({ query: 'unlikely mix', entity: 'mix', country: 'sg', limit: '2' })
    render(<ResponseDemoPreview api={api} executedRequest={{ method: 'GET', url }} data={{ resultCount: 0, results: [] }}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'empty')
    expect(root).toHaveAttribute('data-request-entity', 'mix')
  })
})
