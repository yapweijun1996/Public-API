import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'noaa-tides')
if (!api) throw new Error('Missing noaa-tides fixture')
const requestUrl = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=8518750&product=water_level&date=latest&datum=MLLW&units=metric&time_zone=gmt&application=Public_API_Workbench&format=json'
const executedGet = { url: requestUrl, method: 'GET' }
const validReading = { t: '2026-09-07 03:30', v: '0.325', s: '0.035', f: '1,0,0,0', q: 'p' }
const validMetadata = { id: '8518750', name: 'The Battery', lat: '40.7006', lon: '-74.0142' }

describe('NOAA coastal water-level semantic preview', () => {
  afterEach(cleanup)

  it('preserves NOAA station, measurement, datum, timing, and QA/QC semantics', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{ metadata: validMetadata, data: [validReading] }}/>)
    const preview = screen.getByRole('region', { name: 'NOAA Tides & Currents' })
    expect(preview).toHaveAttribute('data-preview-layout', 'coastal-water-level')
    const card = preview.querySelector('.tide-water-level-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-contract', 'exact-water-level-latest-mllw-metric-gmt-json')
    expect(card).toHaveAttribute('data-requested-station-id', '8518750')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-provider-record-count', '1')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '0')
    expect(card).toHaveAttribute('data-count-contract-valid', 'true')
    expect(card).toHaveAttribute('data-station-id', '8518750')
    expect(card).toHaveAttribute('data-station-name', 'The Battery')
    expect(card).toHaveAttribute('data-primary-water-level', '0.325')
    expect(card).toHaveAttribute('data-water-level-unit', 'm')
    expect(card).toHaveAttribute('data-observed-at', '2026-09-07 03:30')
    expect(card).toHaveAttribute('data-quality-level', 'p')
    expect(card).toHaveAttribute('data-datum', 'MLLW')
    expect(card).toHaveAttribute('data-time-zone', 'gmt')
    expect(card).toHaveAttribute('data-sigma', '0.035')
    expect(card).toHaveAttribute('data-flags', '1,0,0,0')
    expect(within(preview).getByRole('heading', { name: 'The Battery' })).toBeInTheDocument()
    expect(preview).toHaveTextContent('0.325 m')
    expect(preview).toHaveTextContent('Mean Lower Low Water (MLLW)')
    expect(preview).toHaveTextContent('2026-09-07 03:30 GMT')
    expect(preview).toHaveTextContent('Preliminary')
    expect(preview).toHaveTextContent('0.035 m')
    expect(preview).toHaveTextContent('Samples outside 3σ band')
    expect(preview).toHaveTextContent('Latest point available within 18 minutes')
    expect(preview).not.toHaveTextContent('NOAA Tides & Currents record 1')
  })

  it('fails closed when the HTTP-success envelope lacks the documented data array', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ metadata: validMetadata, unexpected: [] }}/>)
    const card = document.querySelector('[data-domain-card="coastal-water-level"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveTextContent('documented water-level data array')
  })

  it('fails closed when the provider station identity does not match the request', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ metadata: { ...validMetadata, id: '9414290', name: 'Fabricated Station' }, data: [validReading] }}/>)
    const card = document.querySelector('[data-domain-card="coastal-water-level"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveTextContent('same NOAA CO-OPS station')
    expect(card).not.toHaveTextContent('0.325 m')
    expect(card).not.toHaveTextContent('Fabricated Station')
  })

  it('fails closed when the successful response is attached to an unsupported extra query parameter', () => {
    render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&foo=bar`} data={{ metadata: validMetadata, data: [validReading] }}/>)
    const card = document.querySelector('[data-domain-card="coastal-water-level"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveTextContent('exact supported NOAA CO-OPS water-level request')
    expect(card).not.toHaveTextContent('0.325 m')
  })

  it('fails closed when a duplicate query key makes the executed units ambiguous', () => {
    render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&units=english`} data={{ metadata: validMetadata, data: [validReading] }}/>)
    const card = document.querySelector('[data-domain-card="coastal-water-level"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveTextContent('exact supported NOAA CO-OPS water-level request')
    expect(card).not.toHaveTextContent('0.325 m')
  })

  it('fails closed when the executed request changes the fixed date contract', () => {
    const todayRequest = requestUrl.replace('date=latest', 'date=today')
    render(<ResponseDemoPreview api={api} requestUrl={todayRequest} data={{ metadata: validMetadata, data: [validReading] }}/>)
    const card = document.querySelector('[data-domain-card="coastal-water-level"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveTextContent('exact supported NOAA CO-OPS water-level request')
    expect(card).not.toHaveTextContent('0.325 m')
  })

  it('marks mixed valid and malformed observation rows partial and omits the malformed measurement', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{ metadata: validMetadata, data: [validReading, { t: 'bad-time', v: '999.999', s: '0.001', f: '0,0,0,0', q: 'p' }] }}/>)
    const card = document.querySelector('.tide-water-level-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(card).toHaveAttribute('data-count-contract-valid', 'false')
    expect(card).toHaveTextContent('0.325 m')
    expect(card).not.toHaveTextContent('999.999')
  })

  it('keeps a structurally valid matching-station zero-observation response empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{ metadata: validMetadata, data: [] }}/>)
    const card = document.querySelector('[data-domain-card="coastal-water-level"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveTextContent('no water-level observation')
  })

  it('fails closed when a canonical displayed URL is attached to an executed POST', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST', body: '{}' }} data={{ metadata: validMetadata, data: [validReading] }}/>)
    const card = document.querySelector('[data-domain-card="coastal-water-level"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('0.325 m')
  })
  it("does not mark a valid NOAA measurement ready without executed-request evidence", () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ metadata: validMetadata, data: [validReading] }}/>)
    const card = document.querySelector(".tide-water-level-preview")
    expect(card).toHaveAttribute("data-result-state", "partial")
    expect(card).toHaveAttribute("data-request-bound", "false")
  })

  it("fails closed when a GET carries a request body", () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: "GET", body: {} }} data={{ metadata: validMetadata, data: [validReading] }}/>)
    const card = document.querySelector("[data-domain-card=\"coastal-water-level\"]")
    expect(card).toHaveAttribute("data-result-state", "invalid")
    expect(card).toHaveAttribute("data-request-bound", "false")
  })
})
