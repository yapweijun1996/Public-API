import { describe, expect, it } from 'vitest'
import { apiCatalog, getApiById, getDefaultParameters, validateParameters, yahooSgxSymbols } from './apiCatalog'
import { previewProfileIds, previewProfiles } from './previewProfiles'

describe('API catalog', () => {
  it('has unique IDs and builds valid HTTPS URLs from defaults', () => {
    expect(new Set(apiCatalog.map((api) => api.id)).size).toBe(apiCatalog.length)

    for (const api of apiCatalog) {
      const url = new URL(api.buildUrl(getDefaultParameters(api)))
      expect(url.protocol).toBe('https:')
    }
  })

  it('assigns one intentional demo preview profile to every catalog API', () => {
    const catalogIds = apiCatalog.map((api) => api.id).sort()
    const profileIds = [...previewProfileIds].sort()

    expect(new Set(previewProfileIds).size).toBe(previewProfileIds.length)
    expect(profileIds).toEqual(catalogIds)
    expect(Object.keys(previewProfiles).sort()).toEqual(catalogIds)
    expect(Object.values(previewProfiles).every((profile) => profile.layout !== 'result-list')).toBe(true)
    expect(new Set(Object.values(previewProfiles).map((profile) => profile.label)).size).toBe(apiCatalog.length)
  })

  it('includes the expanded recommendations without duplicating the five original providers', () => {
    expect(apiCatalog).toHaveLength(64)
    expect(apiCatalog.filter((api) => api.id.startsWith('data-gov-'))).toHaveLength(14)
    expect(getApiById('ipify-public-ip')?.provider).toBe('ipify')
    expect(getApiById('usaspending')?.method).toBe('POST')
    for (const provider of ['Random User', 'Dog CEO', 'JSONPlaceholder', 'Nager.Date']) {
      expect(apiCatalog.filter((api) => api.provider === provider), provider).toHaveLength(1)
    }
  })

  it('builds the six new keyless interactive API requests', () => {
    const urls = Object.fromEntries(['geocoding-search', 'open-meteo-air-quality', 'sunrise-sunset', 'nasa-eonet-events', 'mbta-transit-routes', 'open-trivia'].map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['geocoding-search'].searchParams.get('name')).toBe('Singapore')
    expect(urls['open-meteo-air-quality'].searchParams.get('current')).toContain('us_aqi')
    expect(urls['sunrise-sunset'].pathname).toBe('/v2')
    expect(urls['nasa-eonet-events'].searchParams.get('status')).toBe('open')
    expect(urls['mbta-transit-routes'].searchParams.get('filter[type]')).toBe('0,1')
    expect(urls['open-trivia'].searchParams.get('type')).toBe('multiple')
  })

  it('builds the requested long-history market demos', () => {
    const yahoo = getApiById('yahoo-finance-sgx-history')
    const frankfurter = getApiById('frankfurter-sgd-myr-history')

    expect(yahooSgxSymbols).toHaveLength(22)
    expect(yahoo).toBeDefined()
    expect(frankfurter).toBeDefined()
    if (!yahoo || !frankfurter) return

    expect(yahoo.buildUrl(getDefaultParameters(yahoo))).toContain('/D05.SI?range=max&interval=1mo')
    expect(yahoo?.parseResponse?.('Header\nMarkdown Content:\n{"chart":{"result":[]}}')).toEqual({ chart: { result: [] } })
    expect(yahoo.parseResponse?.('{"data":{"content":"{\\"chart\\":{\\"result\\":[]}}"}}')).toEqual({ chart: { result: [] } })
    expect(frankfurter.buildUrl(getDefaultParameters(frankfurter))).toContain('from=1999-01-04')
    expect(frankfurter.buildUrl(getDefaultParameters(frankfurter))).toContain('base=SGD&quotes=MYR&providers=ECB')
  })

  it('finds API demos by ID', () => {
    expect(getApiById('weather')?.provider).toBe('Open-Meteo')
    expect(getApiById('missing')).toBeUndefined()
  })

  it('validates required and bounded numeric parameters', () => {
    const weather = getApiById('weather')
    expect(weather).toBeDefined()
    if (!weather) return

    expect(validateParameters(weather, { latitude: '', longitude: '200' })).toEqual({
      latitude: 'Latitude is required.',
      longitude: 'Longitude must be at most 180.',
    })
  })
})
