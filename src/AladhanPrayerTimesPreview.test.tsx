import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = apiCatalog.find((candidate) => candidate.id === 'aladhan-prayer-times')
if (!api) throw new Error('Missing AlAdhan fixture')

const requestUrl = api.buildUrl({ latitude: '1.3521', longitude: '103.8198', method: '11', date: '2026-08-02' })
const response = {
  code: 200,
  status: 'OK',
  data: {
    timings: { Fajr: '05:12', Sunrise: '06:58', Dhuhr: '13:05', Asr: '16:25', Maghrib: '19:12', Isha: '20:34', Imsak: '05:02', Midnight: '01:05' },
    date: { readable: '02 Aug 2026', hijri: { date: '17-02-1448', year: '1448', month: { en: 'Safar' }, designation: { abbreviated: 'AH' } }, gregorian: { date: '02-08-2026' } },
    meta: { latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore', school: 'STANDARD', method: { id: 11, name: 'Majlis Ugama Islam Singapura, Singapore' } },
  },
}
const executed = (url = requestUrl, method = 'GET', body?: unknown): ExecutedRequestContext => ({ url, method, ...(body === undefined ? {} : { body }) })

const card = () => screen.getByRole('region', { name: 'AlAdhan Prayer Times' }).querySelector('[data-domain-card="prayer-schedule"]')

describe('AlAdhan exact executed-request semantic binding', () => {
  afterEach(cleanup)

  it('requires exact bodyless GET execution evidence before reporting a ready prayer schedule', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={response}/>)
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-request-bound', 'true')
    expect(card()).toHaveAttribute('data-request-contract', 'exact-aladhan-daily-timings-v2')
  })

  it('fails closed for POST, GET-with-body, and executed URL drift', () => {
    const cases = [
      executed(requestUrl, 'POST'),
      executed(requestUrl, 'GET', { unexpected: true }),
      executed(requestUrl.replace('method=11', 'method=3')),
    ]
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={cases[0]} data={response}/>)
    for (const request of cases) {
      rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={request} data={response}/>)
      expect(card()).toHaveAttribute('data-result-state', 'invalid')
      expect(card()).toHaveAttribute('data-request-bound', 'false')
    }
  })
})
