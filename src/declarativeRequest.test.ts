import { describe, expect, it } from 'vitest'
import { apiCatalog, getDefaultParameters, getApiById } from './apiCatalog'
import { buildRequestFromSpec, type DeclarativeRequestSpec } from './declarativeRequest'

describe('declarative request interpreter', () => {
  it('expands level-three path and query expressions with closed parameter transforms', () => {
    const spec: DeclarativeRequestSpec = {
      declarative: true,
      method: 'GET',
      urlTemplate: 'https://example.test/{country}{?from,to}',
      hosts: ['example.test'],
      transforms: { country: 'uppercase', from: 'date:YYYYMMDD', to: 'omitIfEmpty' },
      responseTransform: 'json',
    }
    expect(buildRequestFromSpec(spec, { country: 'sg', from: '2026-01-02', to: '' })).toEqual({
      method: 'GET', url: 'https://example.test/SG?from=20260102', headers: {},
    })
  })

  it('renders ampersand query continuation, maps, joins, headers, and JSON body slots', () => {
    const spec: DeclarativeRequestSpec = {
      declarative: true,
      method: 'POST',
      urlTemplate: 'https://example.test/search{?kind}{&tags}',
      hosts: ['example.test'],
      headers: { Accept: 'application/json' },
      transforms: { kind: { map: { short: 'S' } }, tags: { join: '|' } },
      body: { query: '{query}', count: '{count}' },
      responseTransform: 'json',
    }
    expect(buildRequestFromSpec(spec, { kind: 'short', tags: 'a,b', query: 'fox', count: '0' })).toEqual({
      method: 'POST', url: 'https://example.test/search?kind=S&tags=a%7Cb',
      headers: { Accept: 'application/json' }, body: { query: 'fox', count: '0' },
    })
  })

  it('preserves captured Nager request outputs for default, enum, and representative inputs', () => {
    const api = getApiById('holidays')
    if (!api || !api.request || api.request.declarative !== true) throw new Error('Holiday API must use a declarative request.')
    const defaultParams = getDefaultParameters(api)
    const cases = [
      { params: defaultParams, captured: `https://nagerholidays.com/api/v4/Holidays/SG/${defaultParams.year}` },
      { params: { year: '2030', country: 'us' }, captured: 'https://nagerholidays.com/api/v4/Holidays/US/2030' },
      { params: { year: '2026', country: 'GB' }, captured: 'https://nagerholidays.com/api/v4/Holidays/GB/2026' },
    ]
    for (const { params, captured } of cases) {
      expect(api.buildUrl(params)).toBe(captured)
      const request = buildRequestFromSpec(api.request, params)
      expect(request).toMatchObject({ method: 'GET', url: captured, headers: {} })
      const expanded = new URL(request.url)
      expect(expanded.protocol).toBe('https:')
      expect(api.request.hosts).toContain(expanded.host)
    }
  })
  it('keeps every declarative API URL HTTPS and within its declared host set', () => {
    const declarativeApis = apiCatalog.filter((api) => api.request?.declarative === true)
    expect(declarativeApis.length).toBeGreaterThan(1)
    for (const api of declarativeApis) {
      const spec = api.request
      if (!spec || spec.declarative !== true) continue
      const request = buildRequestFromSpec(spec, getDefaultParameters(api))
      expect(api.buildUrl(getDefaultParameters(api))).toBe(request.url)
      const expanded = new URL(request.url)
      expect(expanded.protocol).toBe('https:')
      expect(spec.hosts).toContain(expanded.host)
    }
  })

  it('leaves custom request builders out of declarative claims', () => {
    expect(apiCatalog.filter((api) => !api.request || api.request.declarative === false).length).toBeGreaterThan(0)
  })
})
