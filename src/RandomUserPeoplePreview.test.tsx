import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById, validateParameters } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import { parseRandomUserRequest, parseRandomUserResponse } from './previews/RandomUserPeoplePreview'

const api = getApiById('people')!
const requestUrl = api.buildUrl({ count: '3', nationality: 'au' })
const executedRequest = { url: requestUrl, method: 'GET' }
const profile = (uuid: string, overrides: Record<string, unknown> = {}) => ({
  gender: 'female',
  name: { title: 'Ms', first: 'Alex', last: 'Example' },
  location: { city: 'Sydney', state: 'New South Wales', country: 'Australia' },
  email: 'alex.example@example.com',
  login: { uuid, username: 'fixture-user', password: 'not-for-ui', md5: 'fixture-hash' },
  dob: { date: '1990-01-01T00:00:00.000Z', age: 36 },
  phone: '0000 000 000',
  id: { name: 'TFN', value: '123456789' },
  picture: { large: 'https://randomuser.me/api/portraits/women/1.jpg' },
  nat: 'AU',
  ...overrides,
})
const response = (rows: unknown[]) => ({ results: rows, info: { seed: 'fixture-seed', results: 3, page: 1, version: '1.4' } })
const card = async () => {
  await screen.findByText(/generated placeholder profile/i)
  return document.querySelector('[data-domain-card="random-user-people"]') as HTMLElement
}

describe('Random User synthetic people semantic preview', () => {
  it('pins v1.4 and binds generated UUID identities to the exact admitted request', async () => {
    const rows = [
      profile('11111111-1111-4111-8111-111111111111'),
      profile('22222222-2222-4222-8222-222222222222', { name: { first: 'Taylor', last: 'Fixture' }, picture: { large: 'https://randomuser.me/api/portraits/men/2.jpg' }, gender: 'male' }),
      profile('33333333-3333-4333-8333-333333333333', { name: { first: 'Jordan', last: 'Sample' }, picture: { large: 'https://randomuser.me/api/portraits/women/3.jpg' } }),
    ]
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={response(rows)}/>)
    const root = await card()
    expect(requestUrl).toBe('https://randomuser.me/api/1.4/?results=3&nat=au')
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-count', '3')
    expect(root).toHaveAttribute('data-request-nationality', 'au')
    expect(root).toHaveAttribute('data-request-contract', 'exact-randomuser-1.4-v2')
    expect(root).toHaveAttribute('data-valid-profile-count', '3')
    expect(root).toHaveAttribute('data-primary-profile-uuid', '11111111-1111-4111-8111-111111111111')
    expect(root).toHaveTextContent('synthetic test profiles')
    expect(root).toHaveTextContent('Do not treat the names or profile details as real-person records')
    expect(root).not.toHaveTextContent('alex.example@example.com')
    expect(root).not.toHaveTextContent('0000 000 000')
    expect(root).not.toHaveTextContent('not-for-ui')
    expect(root).not.toHaveTextContent('123456789')
  })

  it('requires exact bodyless GET execution evidence before reporting a ready request-bound result', async () => {
    const rows = [
      profile('11111111-1111-4111-8111-111111111111'),
      profile('22222222-2222-4222-8222-222222222222'),
      profile('33333333-3333-4333-8333-333333333333'),
    ]

    const missing = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response(rows)}/>)
    let root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-request-bound', 'false')
    missing.unmount()

    const conflictCases = [
      { url: requestUrl, method: 'POST' },
      { url: requestUrl, method: 'GET', body: { unexpected: true } },
      { url: api.buildUrl({ count: '2', nationality: 'au' }), method: 'GET' },
    ]
    for (const conflict of conflictCases) {
      const view = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={conflict} data={response(rows)}/>)
      await waitFor(() => expect(document.querySelector('[data-domain-card=\"random-user-people\"]')).toHaveAttribute('data-result-state', 'invalid'))
      root = document.querySelector('[data-domain-card=\"random-user-people\"]') as HTMLElement
      expect(root).toHaveAttribute('data-request-bound', 'false')
      view.unmount()
    }
  })

  it('rejects extra or duplicate request semantics and non-admitted nationality/count forms', () => {
    expect(parseRandomUserRequest(requestUrl, api)).toEqual({ count: 3, nationality: 'au' })
    expect(parseRandomUserRequest(`${requestUrl}&foo=bar`, api)).toBeUndefined()
    expect(parseRandomUserRequest(`${requestUrl}&results=1`, api)).toBeUndefined()
    expect(parseRandomUserRequest(`${requestUrl}&nat=us`, api)).toBeUndefined()
    expect(parseRandomUserRequest('https://randomuser.me/api/?results=3&nat=au', api)).toBeUndefined()
    expect(parseRandomUserRequest('https://randomuser.me/api/1.4/?results=2.5&nat=au', api)).toBeUndefined()
    expect(parseRandomUserRequest('https://randomuser.me/api/1.4/?results=3&nat=sg', api)).toBeUndefined()
    expect(validateParameters(api, { count: '2.5', nationality: 'au' })).toHaveProperty('count')
    expect(validateParameters(api, { count: '', nationality: 'au' })).toHaveProperty('count')
    expect(validateParameters(api, { count: '3', nationality: '' })).toHaveProperty('nationality')
    expect(api.buildUrl({ count: '2.5', nationality: 'au' })).toContain('results=2.5')
    expect(api.buildUrl({ count: '', nationality: 'au' })).toContain('results=&nat=au')
  })

  it('withholds duplicate UUID, wrong-nationality, and malformed native evidence as partial', async () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const rows = [
      profile(id),
      profile(id, { name: { first: 'Duplicate', last: 'Fixture' }, picture: { large: 'https://randomuser.me/api/portraits/women/4.jpg' } }),
      profile('33333333-3333-4333-8333-333333333333', { nat: 'US', name: { first: 'Wrong', last: 'Nationality' }, picture: { large: 'https://randomuser.me/api/portraits/men/5.jpg' } }),
    ]
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={response(rows)}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-valid-profile-count', '1')
    expect(root).toHaveAttribute('data-duplicate-profile-count', '1')
    expect(root).toHaveAttribute('data-wrong-nationality-count', '1')
    expect(root).not.toHaveTextContent('Duplicate Fixture')
    expect(root).not.toHaveTextContent('Wrong Nationality')
  })

  it('fails closed when the provider count/version or generated UUID identity contradicts the request', async () => {
    const validRows = [
      profile('11111111-1111-4111-8111-111111111111'),
      profile('22222222-2222-4222-8222-222222222222'),
      profile('33333333-3333-4333-8333-333333333333'),
    ]
    expect(parseRandomUserResponse({ results: validRows, info: { seed: 'fixture', results: 1, page: 1, version: '1.4' } }, api, requestUrl, executedRequest).result).toBeUndefined()
    expect(parseRandomUserResponse({ results: validRows, info: { seed: 'fixture', results: 3, page: 1, version: '1.3' } }, api, requestUrl, executedRequest).result).toBeUndefined()
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={response(validRows.map((row) => ({ ...row, login: { uuid: 123 } })))} />)
    await waitFor(() => expect(document.querySelector('[data-domain-card="random-user-people"]')).toHaveAttribute('data-result-state', 'invalid'))
  })
})
