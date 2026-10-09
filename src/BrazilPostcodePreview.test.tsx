import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { BrazilPostcodePreview, buildBrazilPostcodeViewModel } from './previews/BrazilPostcodePreview'

const api = getApiById('brasilapi-postcode')!
const request = api.buildUrl({ postcode: '01310-930' })
const response = {
  cep: '01310930',
  state: 'SP',
  city: 'São Paulo',
  neighborhood: 'Bela Vista',
  street: 'Avenida Paulista',
  service: 'open-cep',
  timezoneName: 'America/Sao_Paulo',
  location: { type: 'Point', coordinates: { longitude: '-46.63611', latitude: '-23.5475' } },
}

afterEach(cleanup)

describe('BrazilPostcodePreview', () => {
  it('marks a matching exact bodyless GET response ready and request-bound', () => {
    const model = buildBrazilPostcodeViewModel(api, response, request, { method: 'GET', url: request })
    expect(model).toMatchObject({ state: 'ready', requestBound: true, requestedPostcode: '01310930', providerPostcode: '01310930', coordinatesValid: true })
    render(<BrazilPostcodePreview api={api} data={response} requestUrl={request} executedRequest={{ method: 'GET', url: request }}/>)
    const card = screen.getByRole('region', { name: 'BrasilAPI CEP response evidence' })
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-postcode-match', 'true')
    expect(card).toHaveTextContent('Avenida Paulista')
    expect(card).toHaveTextContent('-23.5475, -46.63611')
  })

  it('fails a wrong-CEP HTTP-success payload closed and hides plausible address facts', () => {
    render(<BrazilPostcodePreview api={api} data={response} requestUrl={api.buildUrl({ postcode: '01001000' })} executedRequest={{ method: 'GET', url: api.buildUrl({ postcode: '01001000' }) }}/>)
    const card = screen.getByRole('region', { name: 'BrasilAPI CEP response evidence' })
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-postcode-match', 'false')
    expect(card).not.toHaveTextContent('Avenida Paulista')
  })

  it('rejects noncanonical or non-GET executed requests even when the payload looks valid', () => {
    const extraQuery = `${request}?foo=bar`
    expect(buildBrazilPostcodeViewModel(api, response, extraQuery, { method: 'GET', url: extraQuery }).state).toBe('invalid')
    expect(buildBrazilPostcodeViewModel(api, response, request, { method: 'POST', url: request }).state).toBe('invalid')
    expect(buildBrazilPostcodeViewModel(api, response, request, { method: 'GET', url: request, body: '{}' }).state).toBe('invalid')
  })

  it('keeps a coherent CEP usable when geolocation is unavailable, but withholds malformed partial coordinates', () => {
    const noCoordinates = { ...response, location: { type: 'Point', coordinates: {} } }
    expect(buildBrazilPostcodeViewModel(api, noCoordinates, request, { method: 'GET', url: request })).toMatchObject({ state: 'ready', coordinatesValid: false, optionalMalformedCount: 0 })

    const malformedCoordinates = { ...response, location: { type: 'Point', coordinates: { latitude: '-23.5', longitude: 'not-a-number' } } }
    const malformed = buildBrazilPostcodeViewModel(api, malformedCoordinates, request, { method: 'GET', url: request })
    expect(malformed).toMatchObject({ state: 'partial', coordinatesValid: false })
    expect(malformed.optionalMalformedCount).toBeGreaterThan(0)
  })

  it('does not claim ready without the successful executed-request context', () => {
    expect(buildBrazilPostcodeViewModel(api, response, request)).toMatchObject({ state: 'partial', requestBound: false })
  })
})
