import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const byId = (id: string) => {
  const api = apiCatalog.find((candidate) => candidate.id === id)
  if (!api) throw new Error(`Missing ${id} fixture`)
  return api
}

describe('network and administrative-boundary semantic previews', () => {
  afterEach(cleanup)

  it('keeps IP geolocation explicitly approximate while preserving network identity', () => {
    render(<ResponseDemoPreview api={byId('ipwhois-lookup')} requestUrl="https://ipwho.is/8.8.8.8" executedRequest={{ url: "https://ipwho.is/8.8.8.8", method: 'GET' }} data={{
      ip: '8.8.8.8', success: true, type: 'IPv4', continent: 'North America', country: 'United States', country_code: 'US', region: 'California', region_code: 'CA', city: 'San Jose', latitude: 37.3393939, longitude: -121.8949553, is_eu: false, postal: '95025',
      connection: { asn: 15169, org: 'Google LLC', isp: 'Google LLC', domain: 'google.com' }, timezone: { id: 'America/Los_Angeles', is_dst: true, utc: '-07:00' },
    }}/>)
    const preview = screen.getByRole('region', { name: 'IPWhoIs Geolocation' })
    expect(preview).toHaveAttribute('data-preview-layout', 'ip-geolocation')
    const card = preview.querySelector('.ipwhois-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-ip', '8.8.8.8')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-primary-ip', '8.8.8.8')
    expect(card).toHaveAttribute('data-country-code', 'US')
    expect(card).toHaveAttribute('data-asn', '15169')
    expect(card).toHaveAttribute('data-geolocation-basis', 'approximate-network-derived')
    expect(preview).toHaveTextContent('Coordinates · WGS84 approximate37.3393939, -121.8949553')
    expect(preview).toHaveTextContent('ASNAS15,169')
    expect(preview).toHaveTextContent('not device GPS or a precise personal address')
    expect(preview).toHaveTextContent('1,000 requests per day')
    expect(preview).not.toHaveTextContent('IPWhoIs Geolocation record 1')
  })

  it('fails closed when a successful ipwho.is response belongs to a different requested IP', () => {
    render(<ResponseDemoPreview api={byId('ipwhois-lookup')} requestUrl="https://ipwho.is/8.8.8.8" executedRequest={{ url: "https://ipwho.is/8.8.8.8", method: 'GET' }} data={{
      ip: '1.1.1.1', success: true, type: 'IPv4', country: 'Australia', country_code: 'AU', region: 'Queensland', city: 'Brisbane', latitude: -27.46794, longitude: 153.02809,
      connection: { asn: 13335, org: 'Cloudflare, Inc.', isp: 'Cloudflare, Inc.' }, timezone: { id: 'Australia/Brisbane', utc: '+10:00' },
    }}/>)
    const preview = screen.getByRole('region', { name: 'IPWhoIs Geolocation' })
    const card = preview.querySelector('[data-domain-card="ip-geolocation"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('identity mismatch')
    expect(preview).not.toHaveTextContent('Cloudflare, Inc.')
    expect(preview).not.toHaveTextContent('Brisbane')
  })

  it('fails closed when a valid ipwho.is payload is attached to a different executed transport', () => {
    const api = byId('ipwhois-lookup')
    const requestUrl = api.buildUrl({ ip: '8.8.8.8' })
    const response = {
      ip: '8.8.8.8', success: true, type: 'IPv4', continent: 'North America', country: 'United States', country_code: 'US', region: 'California', region_code: 'CA', city: 'San Jose', latitude: 37.3393939, longitude: -121.8949553,
      connection: { asn: 15169, org: 'Google LLC', isp: 'Google LLC', domain: 'google.com' }, timezone: { id: 'America/Los_Angeles', is_dst: true, utc: '-07:00' },
    }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={response}/>)
    expect(screen.getByRole('region', { name: 'IPWhoIs Geolocation' }).querySelector('[data-domain-card="ip-geolocation"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={response}/>)
    expect(screen.getByRole('region', { name: 'IPWhoIs Geolocation' }).querySelector('[data-domain-card="ip-geolocation"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: api.buildUrl({ ip: '1.1.1.1' }), method: 'GET' }} data={response}/>)
    expect(screen.getByRole('region', { name: 'IPWhoIs Geolocation' }).querySelector('[data-domain-card="ip-geolocation"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed when the provider IP type contradicts the returned IP address', () => {
    render(<ResponseDemoPreview api={byId('ipwhois-lookup')} requestUrl="https://ipwho.is/8.8.8.8" executedRequest={{ url: "https://ipwho.is/8.8.8.8", method: 'GET' }} data={{
      ip: '8.8.8.8', success: true, type: 'IPv6', country: 'United States', country_code: 'US', latitude: 37.3393939, longitude: -121.8949553,
    }}/>)
    const preview = screen.getByRole('region', { name: 'IPWhoIs Geolocation' })
    expect(preview.querySelector('[data-domain-card="ip-geolocation"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('IP address type')
  })

  it('normalizes equivalent IPv6 identities and marks malformed location context partial', () => {
    render(<ResponseDemoPreview api={byId('ipwhois-lookup')} requestUrl="https://ipwho.is/2001%3A0db8%3A0%3A0%3A0%3A0%3A0%3A1" executedRequest={{ url: "https://ipwho.is/2001%3A0db8%3A0%3A0%3A0%3A0%3A0%3A1", method: 'GET' }} data={{
      ip: '2001:db8::1', success: true, type: 'IPv6', country: 'Documentation network', country_code: 'ZZ', latitude: 999, longitude: -181,
      connection: { asn: 'not-a-number', org: 'Example network' }, timezone: { id: 'Etc/UTC', utc: '+00:00' },
    }}/>)
    const preview = screen.getByRole('region', { name: 'IPWhoIs Geolocation' })
    const card = preview.querySelector('.ipwhois-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-requested-ip', '2001:db8::1')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).not.toHaveAttribute('data-latitude')
    expect(card).not.toHaveAttribute('data-longitude')
    expect(card).not.toHaveAttribute('data-asn')
    expect(preview).toHaveTextContent('Coordinates · WGS84 approximateNot supplied')
    expect(preview).toHaveTextContent('ASNNot supplied')
  })

  it('keeps a valid provider identity partial when request identity is unavailable', () => {
    render(<ResponseDemoPreview api={byId('ipwhois-lookup')} data={{
      ip: '8.8.8.8', success: true, type: 'IPv4', country: 'United States', country_code: 'US', region: 'California', city: 'San Jose', latitude: 37.3393939, longitude: -121.8949553,
      connection: { asn: 15169, org: 'Google LLC', isp: 'Google LLC' }, timezone: { id: 'America/Los_Angeles', utc: '-07:00' },
    }}/>)
    const preview = screen.getByRole('region', { name: 'IPWhoIs Geolocation' })
    const card = preview.querySelector('.ipwhois-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).not.toHaveAttribute('data-requested-ip')
    expect(preview).toHaveTextContent('request identity is unavailable')
  })

  it('turns HTTP-success application errors into an invalid semantic result', () => {
    render(<ResponseDemoPreview api={byId('ipwhois-lookup')} data={{ ip: '127.0.0.1', success: false, message: 'Reserved range' }}/>)
    const preview = screen.getByRole('region', { name: 'IPWhoIs Geolocation' })
    expect(preview.querySelector('[data-domain-card="ip-geolocation"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Reserved range')
    expect(screen.getByRole('status')).toHaveTextContent('Live response received for IPWhoIs Geolocation.')
    expect(screen.getByRole('status')).not.toHaveTextContent(/result ready/i)
  })

  it('labels geoBoundaries statistics as per-unit means and exposes actual geometry download links', () => {
    render(<ResponseDemoPreview api={byId('geoboundaries-admin-boundaries')} requestUrl="https://www.geoboundaries.org/api/current/gbOpen/SGP/ADM1/" data={{
      boundaryID: 'SGP-ADM1-49756563', boundaryName: 'Singapore', boundaryISO: 'SGP', boundaryYearRepresented: '2016', boundaryType: 'ADM1', boundarySource: 'Urban Redevelopment Authority, derived from ADM 3', boundaryLicense: 'Open Data Commons Open Database License 1.0', licenseDetail: 'Source terms apply', sourceDataUpdateDate: 'Thu Jan 19 07:31:04 2023', buildDate: 'Dec 12, 2023', 'UNSDG-region': 'Eastern and South-Eastern Asia', worldBankIncomeGroup: 'High-income Countries', admUnitCount: '5', meanPerimeterLengthKM: '129.07720449026624', meanAreaSqKM: '156.38829290818552', gjDownloadURL: 'https://example.test/full.geojson', simplifiedGeometryGeoJSON: 'https://example.test/simple.geojson', tjDownloadURL: 'https://example.test/full.topojson', staticDownloadLink: 'https://example.test/archive.zip',
    }}/>)
    const preview = screen.getByRole('region', { name: 'geoBoundaries Admin Boundaries' })
    expect(preview).toHaveAttribute('data-preview-layout', 'boundary-layer')
    const card = preview.querySelector('.geoboundaries-preview')
    expect(card).toHaveAttribute('data-boundary-id', 'SGP-ADM1-49756563')
    expect(card).toHaveAttribute('data-admin-unit-count', '5')
    expect(card).toHaveAttribute('data-mean-unit-area-sq-km', '156.38829290818552')
    expect(preview).toHaveTextContent('Mean administrative-unit area156.388292908 km²')
    expect(preview).toHaveTextContent('not total country area or perimeter')
    expect(screen.getByRole('link', { name: 'Full GeoJSON for Singapore ADM1' })).toHaveAttribute('href', 'https://example.test/full.geojson')
    expect(preview).not.toHaveTextContent('geoBoundaries Admin Boundaries record 1')
  })

  it('does not mark geoBoundaries data ready without executed request evidence', () => {
    const requestUrl = 'https://www.geoboundaries.org/api/current/gbOpen/SGP/ADM1/'
    render(<ResponseDemoPreview api={byId('geoboundaries-admin-boundaries')} requestUrl={requestUrl} data={{
      boundaryID: 'SGP-ADM1-49756563', boundaryName: 'Singapore', boundaryISO: 'SGP', boundaryYearRepresented: '2016', boundaryType: 'ADM1', boundarySource: 'Urban Redevelopment Authority', boundaryLicense: 'Open Data Commons Open Database License 1.0', sourceDataUpdateDate: '2023', buildDate: '2023', admUnitCount: '5', meanAreaSqKM: '156.3', meanPerimeterLengthKM: '129.0', gjDownloadURL: 'https://example.test/full.geojson',
    }}/>)
    const card = screen.getByRole('region', { name: 'geoBoundaries Admin Boundaries' }).querySelector('.geoboundaries-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('fails geoBoundaries semantic identity closed for contradictory executed transport', () => {
    const api = byId('geoboundaries-admin-boundaries')
    const requestUrl = 'https://www.geoboundaries.org/api/current/gbOpen/SGP/ADM1/'
    const data = {
      boundaryID: 'SGP-ADM1-49756563', boundaryName: 'Singapore', boundaryISO: 'SGP', boundaryYearRepresented: '2016', boundaryType: 'ADM1', boundarySource: 'Urban Redevelopment Authority', boundaryLicense: 'Open Data Commons Open Database License 1.0', sourceDataUpdateDate: '2023', buildDate: '2023', admUnitCount: '5', meanAreaSqKM: '156.3', meanPerimeterLengthKM: '129.0', gjDownloadURL: 'https://example.test/full.geojson',
    }
    const invalidCases = [
      { url: requestUrl, method: 'POST' },
      { url: requestUrl, method: 'GET', body: { unexpected: true } },
      { url: 'https://www.geoboundaries.org/api/current/gbOpen/MYS/ADM1/', method: 'GET' },
    ]
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={invalidCases[0]} data={data}/>)
    const assertInvalid = () => {
      const card = screen.getByRole('region', { name: 'geoBoundaries Admin Boundaries' }).querySelector('.geoboundaries-preview')
      expect(card).toHaveAttribute('data-result-state', 'invalid')
      expect(card).toHaveAttribute('data-request-bound', 'false')
    }
    assertInvalid()
    invalidCases.slice(1).forEach((executedRequest) => {
      rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={data}/>)
      assertInvalid()
    })
  })

  it('fails closed when geoBoundaries HTTP-success identity does not match the request', () => {
    render(<ResponseDemoPreview api={byId('geoboundaries-admin-boundaries')} requestUrl="https://www.geoboundaries.org/api/current/gbOpen/SGP/ADM1/" data={{
      boundaryID: 'MYS-ADM1-00000001', boundaryName: 'Malaysia', boundaryISO: 'MYS', boundaryType: 'ADM1', boundaryYearRepresented: '2023', boundarySource: 'Example', boundaryLicense: 'CC BY 4.0', sourceDataUpdateDate: '2023', buildDate: '2023', admUnitCount: '16', meanAreaSqKM: '1', meanPerimeterLengthKM: '1', gjDownloadURL: 'https://example.test/mys.geojson',
    }}/>)
    const preview = screen.getByRole('region', { name: 'geoBoundaries Admin Boundaries' })
    const card = preview.querySelector('.geoboundaries-preview')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-requested-country', 'SGP')
    expect(card).toHaveAttribute('data-requested-admin-level', 'ADM1')
    expect(card).toHaveAttribute('data-identity-match', 'false')
    expect(preview).not.toHaveTextContent('Malaysia · ADM1')
  })

  it('preserves the documented ALL-country collection instead of treating its array as empty', () => {
    const layer = (iso: string, name: string, id: string, units: string) => ({
      boundaryID: `${iso}-ADM1-${id}`, boundaryName: name, boundaryISO: iso, boundaryType: 'ADM1', boundaryYearRepresented: '2023', boundarySource: 'Example source', boundaryLicense: 'CC BY 4.0', sourceDataUpdateDate: '2023', buildDate: '2023', admUnitCount: units, meanAreaSqKM: '12.5', meanPerimeterLengthKM: '8.5', gjDownloadURL: `https://example.test/${iso}.geojson`,
    })
    render(<ResponseDemoPreview api={byId('geoboundaries-admin-boundaries')} requestUrl="https://www.geoboundaries.org/api/current/gbOpen/ALL/ADM1/" executedRequest={{ url: 'https://www.geoboundaries.org/api/current/gbOpen/ALL/ADM1/', method: 'GET' }} data={[
      layer('SGP', 'Singapore', '11111111', '5'),
      layer('MYS', 'Malaysia', '22222222', '16'),
    ]}/>)
    const preview = screen.getByRole('region', { name: 'geoBoundaries Admin Boundaries' })
    const card = preview.querySelector('.geoboundaries-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '2')
    expect(card).toHaveAttribute('data-requested-country', 'ALL')
    expect(card).toHaveAttribute('data-requested-admin-level', 'ADM1')
    expect(preview).toHaveTextContent('Global ADM1 boundary layers')
    expect(preview).toHaveTextContent('Singapore')
    expect(preview).toHaveTextContent('Malaysia')
    expect(screen.getByRole('link', { name: 'Full GeoJSON for Singapore ADM1' })).toHaveAttribute('href', 'https://example.test/SGP.geojson')
  })

  it('marks mixed ALL-country results partial and hides malformed rows', () => {
    render(<ResponseDemoPreview api={byId('geoboundaries-admin-boundaries')} requestUrl="https://www.geoboundaries.org/api/current/gbOpen/ALL/ADM1/" data={[
      { boundaryID: 'SGP-ADM1-11111111', boundaryName: 'Singapore', boundaryISO: 'SGP', boundaryType: 'ADM1', boundaryYearRepresented: '2023', boundarySource: 'Example', boundaryLicense: 'CC BY 4.0', sourceDataUpdateDate: '2023', buildDate: '2023', admUnitCount: '5', meanAreaSqKM: '12.5', meanPerimeterLengthKM: '8.5', gjDownloadURL: 'https://example.test/SGP.geojson' },
      { boundaryID: 'BROKEN', boundaryName: 'Fabricated', boundaryISO: 'SGP', boundaryType: 'ADM1' },
    ]}/>)
    const preview = screen.getByRole('region', { name: 'geoBoundaries Admin Boundaries' })
    const card = preview.querySelector('.geoboundaries-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(preview).toHaveTextContent('Singapore')
    expect(preview).not.toHaveTextContent('Fabricated')
  })

})
