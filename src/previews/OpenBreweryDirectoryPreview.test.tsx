import { describe, expect, it } from 'vitest'
import { apiCatalog } from '../apiCatalog'
import { buildOpenBreweryDirectoryViewModel, parseOpenBreweryDirectoryRequest } from './OpenBreweryDirectoryPreview'

const api = apiCatalog.find((entry) => entry.id === 'open-brewery-directory')!
const requestUrl = 'https://api.openbrewerydb.org/v1/breweries?by_country=united_states&per_page=8'
const executedRequest = { url: requestUrl, method: 'GET' }
const brewery = {
  id: '5128df48-79fc-4f0f-8b52-d06be54d0cec',
  name: '(405) Brewing Co',
  brewery_type: 'micro',
  address_1: '1716 Topeka St',
  address_2: null,
  address_3: null,
  city: 'Norman',
  state_province: 'Oklahoma',
  postal_code: '73069-8224',
  country: 'United States',
  longitude: -97.46818222,
  latitude: 35.25738891,
  phone: '4058160490',
  website_url: 'http://www.405brewing.com',
}

describe('OpenBreweryDirectoryPreview semantic contract', () => {
  it('accepts only the exact declared list request', () => {
    expect(parseOpenBreweryDirectoryRequest(api, requestUrl)).toEqual({ country: 'united_states', type: 'all', limit: 8 })
    expect(parseOpenBreweryDirectoryRequest(api, `${requestUrl}&foo=bar`)).toBeUndefined()
    expect(parseOpenBreweryDirectoryRequest(api, `${requestUrl}&per_page=2`)).toBeUndefined()
    expect(parseOpenBreweryDirectoryRequest(api, 'https://api.openbrewerydb.org/v1/breweries?by_country=united_states&per_page=8&by_type=all')).toBeUndefined()
  })

  it('keeps a complete matching provider row ready and request-bound', () => {
    const model = buildOpenBreweryDirectoryViewModel(api, [brewery], requestUrl, executedRequest)
    expect(model.state).toBe('ready')
    expect(model.requestBound).toBe(true)
    expect(model.validCount).toBe(1)
    expect(model.coordinateCount).toBe(1)
    expect(model.breweries[0]).toMatchObject({ id: brewery.id, name: brewery.name, country: 'United States', latitude: brewery.latitude, longitude: brewery.longitude })
  })

  it('requires exact bodyless GET execution evidence before reporting request-bound results', () => {
    const withoutExecution = buildOpenBreweryDirectoryViewModel(api, [brewery], requestUrl)
    expect(withoutExecution.state).toBe('partial')
    expect(withoutExecution.requestBound).toBe(false)

    const exactGet = buildOpenBreweryDirectoryViewModel(api, [brewery], requestUrl, executedRequest)
    expect(exactGet.state).toBe('ready')
    expect(exactGet.requestBound).toBe(true)

    for (const conflict of [
      { url: requestUrl, method: 'POST' },
      { url: requestUrl, method: 'GET', body: { unexpected: true } },
      { url: `${requestUrl}&by_type=micro`, method: 'GET' },
    ]) {
      const model = buildOpenBreweryDirectoryViewModel(api, [brewery], requestUrl, conflict)
      expect(model.state).toBe('invalid')
      expect(model.requestBound).toBe(false)
    }
  })

  it('treats documented null coordinates as valid absence', () => {
    const model = buildOpenBreweryDirectoryViewModel(api, [{ ...brewery, latitude: null, longitude: null }], requestUrl, executedRequest)
    expect(model.state).toBe('ready')
    expect(model.coordinateCount).toBe(0)
    expect(model.optionalMalformedCount).toBe(0)
  })

  it('withholds duplicates and malformed optional coordinates as partial evidence', () => {
    const model = buildOpenBreweryDirectoryViewModel(api, [
      { ...brewery, latitude: '35.25738891', longitude: '-97.46818222' },
      brewery,
    ], requestUrl, executedRequest)
    expect(model.state).toBe('partial')
    expect(model.validCount).toBe(1)
    expect(model.invalidCount).toBe(1)
    expect(model.duplicateCount).toBe(1)
    expect(model.optionalMalformedCount).toBe(1)
    expect(model.coordinateCount).toBe(0)
  })

  it('fails closed when provider rows contradict the executed country filter', () => {
    const model = buildOpenBreweryDirectoryViewModel(api, [{ ...brewery, country: 'France' }], requestUrl, executedRequest)
    expect(model.state).toBe('invalid')
    expect(model.validCount).toBe(0)
  })

  it('maps a coherent empty provider array to empty', () => {
    const model = buildOpenBreweryDirectoryViewModel(api, [], requestUrl, executedRequest)
    expect(model.state).toBe('empty')
    expect(model.requestBound).toBe(true)
  })
})
