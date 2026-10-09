import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('usgs')!
const endpoint = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson'

const executedRequest = (overrides: Partial<ExecutedRequestContext> = {}): ExecutedRequestContext => ({
  method: 'GET',
  url: endpoint,
  ...overrides,
})

const earthquake = (overrides: Record<string, unknown> = {}) => ({
  type: 'Feature',
  id: 'us7000test1',
  properties: {
    mag: 3.7,
    place: 'Off the coast of Oregon',
    time: 1_789_426_800_000,
    updated: 1_789_427_100_000,
    status: 'reviewed',
    title: 'M 3.7 - Off the coast of Oregon',
  },
  geometry: { type: 'Point', coordinates: [-129.0824, 43.6383, 10] },
  ...overrides,
})

const feed = (features: unknown[], metadata: Record<string, unknown> = {}) => ({
  type: 'FeatureCollection',
  metadata: {
    generated: 1_789_430_400_000,
    url: endpoint,
    title: 'USGS Magnitude 2.5+ Earthquakes, Past Day',
    api: '1.14.1',
    count: features.length,
    status: 200,
    ...metadata,
  },
  features,
})

const card = () => screen.getByRole('region', { name: api.name }).querySelector('[data-domain-card="usgs-earthquake-feed"]')

const renderPreview = async (data: unknown, request?: ExecutedRequestContext) => {
  render(<ResponseDemoPreview api={api} data={data} requestUrl={request?.url} executedRequest={request}/>)
  await waitFor(() => expect(card()).toBeInTheDocument())
  return card() as HTMLElement
}

afterEach(cleanup)

describe('USGS earthquake request-bound GeoJSON semantics', () => {
  it('renders a ready feed only from exact request, metadata, and native provider rows', async () => {
    const zeroLocation = earthquake({
      id: 'us7000zero',
      properties: {
        mag: 2.5,
        place: 'Equatorial reference event',
        time: 1_789_426_700_000,
        updated: 1_789_426_700_000,
        status: 'automatic',
      },
      geometry: { type: 'Point', coordinates: [0, 0, 0] },
    })
    const result = await renderPreview(feed([zeroLocation, earthquake()]), executedRequest())

    expect(result).toHaveAttribute('data-result-state', 'ready')
    expect(result).toHaveAttribute('data-request-bound', 'true')
    expect(result).toHaveAttribute('data-request-method', 'GET')
    expect(result).toHaveAttribute('data-request-url', endpoint)
    expect(result).toHaveAttribute('data-provider-count', '2')
    expect(result).toHaveAttribute('data-valid-record-count', '2')
    expect(result).toHaveAttribute('data-invalid-record-count', '0')
    expect(result).toHaveAttribute('data-count-contract', 'true')
    expect(result).toHaveAttribute('data-primary-event-id', 'us7000zero')
    expect(result).toHaveAttribute('data-primary-longitude', '0')
    expect(result).toHaveAttribute('data-primary-latitude', '0')
    expect(result).toHaveAttribute('data-primary-depth-km', '0')
    expect(within(result).getByRole('img', { name: /Map with 2 validated USGS earthquake locations/ })).toBeInTheDocument()
    expect(within(result).getByRole('list', { name: 'Validated USGS earthquake evidence' })).toHaveTextContent('M 2.5')
  })

  it('withholds numeric-string magnitudes and coordinates without manufacturing zero', async () => {
    const result = await renderPreview(feed([
      earthquake(),
      earthquake({ id: 'us7000badmag', properties: { ...(earthquake().properties as object), mag: '4.9', place: 'Untrusted magnitude' } }),
      earthquake({ id: 'us7000badcoord', properties: { ...(earthquake().properties as object), place: 'Untrusted coordinate' }, geometry: { type: 'Point', coordinates: ['0', 10, 2] } }),
    ]), executedRequest())

    expect(result).toHaveAttribute('data-result-state', 'partial')
    expect(result).toHaveAttribute('data-valid-record-count', '1')
    expect(result).toHaveAttribute('data-invalid-record-count', '2')
    expect(result).toHaveAttribute('data-native-number-contract', 'false')
    expect(result).not.toHaveTextContent('Untrusted magnitude')
    expect(result).not.toHaveTextContent('Untrusted coordinate')
    expect(result).not.toHaveTextContent('M 4.9')
  })

  it('withholds malformed geometry and event identity while retaining trustworthy rows', async () => {
    const result = await renderPreview(feed([
      earthquake(),
      earthquake({ id: '', properties: { ...(earthquake().properties as object), place: 'Missing identity' } }),
      earthquake({ id: 'us7000line', properties: { ...(earthquake().properties as object), place: 'Wrong geometry' }, geometry: { type: 'LineString', coordinates: [-122, 40, 5] } }),
    ]), executedRequest())

    expect(result).toHaveAttribute('data-result-state', 'partial')
    expect(result).toHaveAttribute('data-valid-record-count', '1')
    expect(result).toHaveAttribute('data-invalid-record-count', '2')
    expect(result).not.toHaveTextContent('Missing identity')
    expect(result).not.toHaveTextContent('Wrong geometry')
  })

  it('fails closed when a non-empty feed has zero trustworthy rows', async () => {
    const result = await renderPreview(feed([
      earthquake({ properties: { ...(earthquake().properties as object), mag: '3.7' } }),
    ]), executedRequest())

    expect(result).toHaveAttribute('data-result-state', 'invalid')
    expect(result).toHaveAttribute('data-provider-count', '1')
    expect(result).toHaveAttribute('data-valid-record-count', '0')
    expect(result).toHaveAttribute('data-invalid-record-count', '1')
    expect(result).not.toHaveTextContent('Off the coast of Oregon')
  })

  it('keeps a trustworthy row partial when a non-critical optional title is malformed', async () => {
    const result = await renderPreview(feed([
      earthquake({ properties: { ...(earthquake().properties as object), title: 37 } }),
    ]), executedRequest())

    expect(result).toHaveAttribute('data-result-state', 'partial')
    expect(result).toHaveAttribute('data-valid-record-count', '1')
    expect(result).toHaveAttribute('data-invalid-record-count', '0')
    expect(result).toHaveAttribute('data-optional-issue-count', '1')
    expect(result).toHaveTextContent('M 3.7 · Off the coast of Oregon')
  })

  it('fails closed when metadata count does not match the provider feature array', async () => {
    const result = await renderPreview(feed([earthquake()], { count: 2 }), executedRequest())

    expect(result).toHaveAttribute('data-result-state', 'invalid')
    expect(result).toHaveAttribute('data-count-contract', 'false')
    expect(result).toHaveAttribute('data-valid-record-count', '0')
    expect(result).not.toHaveTextContent('Off the coast of Oregon')
  })

  it('renders a coherent zero-count FeatureCollection as empty', async () => {
    const result = await renderPreview(feed([]), executedRequest())

    expect(result).toHaveAttribute('data-result-state', 'empty')
    expect(result).toHaveAttribute('data-provider-count', '0')
    expect(result).toHaveAttribute('data-valid-record-count', '0')
    expect(result).toHaveTextContent('No M2.5+ earthquakes returned')
    expect(result).not.toHaveTextContent('Magnitude 0')
  })

  it('fails closed for a malformed GeoJSON envelope or metadata', async () => {
    const result = await renderPreview({ type: 'Feature', metadata: { count: 0 }, features: [] }, executedRequest())

    expect(result).toHaveAttribute('data-result-state', 'invalid')
    expect(result).toHaveAttribute('data-envelope-contract', 'false')
    expect(result).toHaveAttribute('data-valid-record-count', '0')
    expect(result).toHaveTextContent('USGS earthquake evidence unavailable')
  })

  it.each([
    ['missing executed request', undefined],
    ['wrong method', executedRequest({ method: 'POST' })],
    ['expanded query', executedRequest({ url: `${endpoint}?format=geojson` })],
    ['unexpected body', executedRequest({ body: {} })],
  ])('fails closed for %s', async (_name, request) => {
    const result = await renderPreview(feed([earthquake()]), request)

    expect(result).toHaveAttribute('data-result-state', 'invalid')
    expect(result).toHaveAttribute('data-request-bound', 'false')
    expect(result).toHaveAttribute('data-valid-record-count', '0')
    expect(result).not.toHaveTextContent('Off the coast of Oregon')
  })
})
