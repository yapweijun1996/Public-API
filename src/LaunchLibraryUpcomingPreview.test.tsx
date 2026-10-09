import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById, validateParameters } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import { parseLaunchLibraryRequest, parseLaunchLibraryResponse } from './previews/LaunchLibraryUpcomingPreview'

const api = getApiById('launch-library-upcoming')!
const requestUrl = api.buildUrl({ query: 'SpaceX', limit: '4' })
const executedRequest = { url: requestUrl, method: 'GET' as const }

const launch = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  url: `https://ll.thespacedevs.com/2.3.0/launches/${id}/`,
  name: `Falcon 9 | Fixture mission ${id.slice(0, 4)}`,
  net: '2026-09-20T12:30:00Z',
  status: { id: 1, name: 'Go for Launch', abbrev: 'Go' },
  launch_service_provider: { id: 121, name: 'SpaceX', abbrev: 'SpX', type: { id: 3, name: 'Commercial' } },
  pad: { id: 87, name: 'Launch Complex 39A', location: { id: 27, name: 'Kennedy Space Center, FL, USA' } },
  mission: { id: 9001, name: 'Fixture mission' },
  rocket: { configuration: { id: 164, name: 'Falcon 9 Block 5', manufacturer: { id: 121, name: 'SpaceX', abbrev: 'SpX' } } },
  ...overrides,
})

const ids = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
]

const nextPage = (search = 'SpaceX', limit = 4) => `https://ll.thespacedevs.com/2.3.0/launches/upcoming/?${new URLSearchParams({
  search,
  limit: String(limit),
  ordering: 'net',
  offset: String(limit),
}).toString()}`

const response = (results: unknown[], count = results.length, next: unknown = count > 4 ? nextPage() : null) => ({
  count,
  next,
  previous: null,
  results,
})

const card = async () => {
  const region = await screen.findByRole('region', { name: 'Upcoming Space Launches' })
  return region.querySelector('[data-domain-card="launch-library-upcoming"]') as HTMLElement
}

describe('Launch Library upcoming exact-request semantic preview', () => {
  it('accepts only the exact supported production request', () => {
    expect(parseLaunchLibraryRequest(executedRequest)).toEqual({ search: 'SpaceX', limit: 4, order: 'net' })
    expect(parseLaunchLibraryRequest({ method: 'POST', url: requestUrl })).toBeUndefined()
    expect(parseLaunchLibraryRequest({ method: 'GET', url: requestUrl, body: '{}' })).toBeUndefined()
    expect(parseLaunchLibraryRequest({ method: 'GET', url: `${requestUrl}&foo=bar` })).toBeUndefined()
    expect(parseLaunchLibraryRequest({ method: 'GET', url: `${requestUrl}&search=Starlink` })).toBeUndefined()
    expect(parseLaunchLibraryRequest({ method: 'GET', url: `${requestUrl}&limit=4` })).toBeUndefined()
    expect(parseLaunchLibraryRequest({ method: 'GET', url: requestUrl.replace('/upcoming/?', '/upcoming?') })).toBeUndefined()
    expect(parseLaunchLibraryRequest({ method: 'GET', url: requestUrl.replace('https://', 'http://') })).toBeUndefined()
    expect(parseLaunchLibraryRequest({ method: 'GET', url: requestUrl.replace('ll.thespacedevs.com', 'user:pass@ll.thespacedevs.com') })).toBeUndefined()
    expect(parseLaunchLibraryRequest({ method: 'GET', url: requestUrl.replace('ll.thespacedevs.com', 'll.thespacedevs.com:8443') })).toBeUndefined()
    expect(parseLaunchLibraryRequest({ method: 'GET', url: requestUrl.replace('limit=4', 'limit=04') })).toBeUndefined()
  })

  it('binds native launch identities, pagination, and documented search evidence to the executed request', async () => {
    const payload = response(ids.map((id) => launch(id)), 8, nextPage())
    const parsed = parseLaunchLibraryResponse(payload, executedRequest)
    expect(parsed.result).toMatchObject({ providerCount: 8, providerRecordCount: 4, trustedRecordCount: 4, malformedEvidenceCount: 0, duplicateEvidenceCount: 0, searchMismatchCount: 0 })

    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={payload}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-contract', 'exact-launch-library-upcoming-v1')
    expect(root).toHaveAttribute('data-search-term', 'SpaceX')
    expect(root).toHaveAttribute('data-requested-limit', '4')
    expect(root).toHaveAttribute('data-provider-count', '8')
    expect(root).toHaveAttribute('data-provider-record-count', '4')
    expect(root).toHaveAttribute('data-trusted-record-count', '4')
    expect(root).toHaveAttribute('data-primary-launch-id', ids[0])
    expect(root).toHaveAttribute('data-primary-status', 'Go for Launch')
    expect(root).toHaveAttribute('data-primary-provider', 'SpaceX')
    expect(root).toHaveTextContent('Kennedy Space Center, FL, USA')
    expect(root).toHaveTextContent('Falcon 9 Block 5')
  })

  it('fails closed when pagination contradicts the exact request', () => {
    const rows = ids.map((id) => launch(id))
    expect(parseLaunchLibraryResponse(response(rows, 8, nextPage('Starlink')), executedRequest).result).toBeUndefined()
    expect(parseLaunchLibraryResponse(response(rows.slice(0, 3), 8, nextPage()), executedRequest).result).toBeUndefined()
    expect(parseLaunchLibraryResponse({ ...response(rows), count: '4' }, executedRequest).result).toBeUndefined()
    expect(parseLaunchLibraryResponse({ ...response(rows), previous: nextPage() }, executedRequest).result).toBeUndefined()
  })

  it('withholds malformed, duplicate, and search-mismatched launch evidence as partial', async () => {
    const trusted = launch(ids[0])
    const duplicate = launch(ids[0], { name: 'Fabricated duplicate launch' })
    const malformed = launch(ids[2], { id: 'not-a-uuid', name: 'Fabricated malformed launch' })
    const mismatch = launch(ids[3], {
      name: 'Ariane 6 | Unrelated mission',
      launch_service_provider: { id: 115, name: 'Arianespace' },
      mission: { id: 7000, name: 'Unrelated payload' },
      rocket: { configuration: { id: 999, name: 'Ariane 6', manufacturer: { id: 115, name: 'ArianeGroup', abbrev: 'AG' } } },
      pad: { id: 1, name: 'ELA-4', location: { id: 1, name: 'Kourou, French Guiana' } },
    })
    const payload = response([trusted, duplicate, malformed, mismatch], 4, null)
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={payload}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-trusted-record-count', '1')
    expect(root).toHaveAttribute('data-malformed-evidence-count', '1')
    expect(root).toHaveAttribute('data-duplicate-evidence-count', '1')
    expect(root).toHaveAttribute('data-search-mismatch-count', '1')
    expect(root).not.toHaveTextContent('Fabricated duplicate launch')
    expect(root).not.toHaveTextContent('Fabricated malformed launch')
    expect(root).not.toHaveTextContent('Ariane 6 | Unrelated mission')
  })

  it('maps a coherent request-bound zero-result envelope to empty', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={response([], 0, null)}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'empty')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-provider-count', '0')
  })

  it('keeps launch search and integer validation in the shared catalog SSOT without silent correction', () => {
    expect(api.fields.find((field) => field.id === 'query')).toMatchObject({ type: 'text', minLength: 1, maxLength: 120 })
    expect(api.fields.find((field) => field.id === 'limit')).toMatchObject({ type: 'number', min: 1, max: 6, step: 1 })
    expect(validateParameters(api, { query: '   ', limit: '4' })).toHaveProperty('query')
    expect(validateParameters(api, { query: 'SpaceX', limit: '2.5' })).toHaveProperty('limit')
    const blank = new URL(api.buildUrl({ query: '   ', limit: '4' }))
    expect(blank.searchParams.get('search')).toBe('')
    const fractional = new URL(api.buildUrl({ query: 'SpaceX', limit: '2.5' }))
    expect(fractional.searchParams.get('limit')).toBe('2.5')
  })
})
