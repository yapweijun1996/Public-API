import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'sunrise-sunset')
if (!api) throw new Error('Missing sunrise-sunset fixture')

const data = {
  date: '2026-07-15',
  tzid: 'Asia/Singapore',
  lat: 1.3521,
  lng: 103.8197,
  sunrise: '2026-07-15T07:03:51+08:00',
  sunset: '2026-07-15T19:17:33+08:00',
  solar_noon: '2026-07-15T13:10:42+08:00',
  first_light: '2026-07-15T05:50:49+08:00',
  last_light: '2026-07-15T20:30:35+08:00',
  day_length: 44022,
  moon_phase: 'New Moon',
}

const request = (overrides: Partial<{ url: string; method: string; body: unknown }> = {}) => ({
  url: api.buildUrl({ latitude: '1.3521', longitude: '103.8197', date: '2026-07-15' }),
  method: 'GET',
  ...overrides,
})

describe('SolarCyclePreview execution-context contract', () => {
  afterEach(cleanup)

  it('fails closed when solar data is not bound to an exact successful request', () => {
    const { container } = render(<ResponseDemoPreview api={api} data={data} />)

    const card = container.querySelector('[data-domain-card="solar-cycle"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(screen.getByText('Solar response unavailable')).toBeInTheDocument()
  })

  it('rejects a response when the executed request does not match the displayed request', () => {
    const { container } = render(<ResponseDemoPreview api={api} data={data} requestUrl={request().url} executedRequest={request({ url: api.buildUrl({ latitude: '35.6762', longitude: '139.6503', date: '2026-07-15' }) })} />)

    expect(container.querySelector('[data-domain-card="solar-cycle"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.queryByText('12h 14m of daylight')).not.toBeInTheDocument()
  })

  it.each([
    ['POST', request({ method: 'POST' })],
    ['GET with a body', request({ body: { unexpected: true } })],
  ])('rejects %s transport drift even when the payload looks valid', (_label, executedRequest) => {
    const { container } = render(<ResponseDemoPreview api={api} data={data} requestUrl={request().url} executedRequest={executedRequest} />)

    const card = container.querySelector('[data-domain-card="solar-cycle"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(screen.queryByText('12h 14m of daylight')).not.toBeInTheDocument()
  })

  it('marks a provider response ready only when request and provider identities agree', () => {
    const exactRequest = request()
    const { container } = render(<ResponseDemoPreview api={api} data={data} requestUrl={exactRequest.url} executedRequest={exactRequest} />)

    const card = container.querySelector('[data-domain-card="solar-cycle"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-contract', 'exact-sunrise-sunset-v2')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(screen.getByText('12h 14m of daylight')).toBeInTheDocument()
  })
})
