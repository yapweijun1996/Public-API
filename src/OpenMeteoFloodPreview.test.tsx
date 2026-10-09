import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'open-meteo-flood')
if (!api) throw new Error('Missing Open-Meteo Flood API fixture')

const requestUrl = api.buildUrl({ latitude: '1.3521', longitude: '103.8198', days: '2' })
const executedGet = { url: requestUrl, method: 'GET' } as const
const response = {
  latitude: 1.375,
  longitude: 103.825,
  utc_offset_seconds: 0,
  timezone: 'GMT',
  timezone_abbreviation: 'GMT',
  daily_units: {
    time: 'iso8601',
    river_discharge: 'm³/s',
    river_discharge_mean: 'm³/s',
    river_discharge_max: 'm³/s',
  },
  daily: {
    time: ['2026-09-16', '2026-09-17'],
    river_discharge: [1, 1.2],
    river_discharge_mean: [0.99, 1.3],
    river_discharge_max: [1.86, 2.17],
  },
}

const card = () => document.querySelector('[data-domain-card="flood-forecast"]')

describe('Open-Meteo Flood semantic preview', () => {
  afterEach(cleanup)

  it('binds aligned native-number discharge rows to the executed forecast request', async () => {
    render(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={executedGet}/>)

    expect(await screen.findByText('Forecast peak')).toBeInTheDocument()
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-request-bound', 'true')
    expect(card()).toHaveAttribute('data-request-latitude', '1.3521')
    expect(card()).toHaveAttribute('data-request-longitude', '103.8198')
    expect(card()).toHaveAttribute('data-request-forecast-days', '2')
    expect(card()).toHaveAttribute('data-provider-row-count', '2')
    expect(card()).toHaveAttribute('data-valid-row-count', '2')
    expect(card()).toHaveAttribute('data-array-length-contract', 'true')
    expect(card()).toHaveAttribute('data-unit-contract', 'true')
    expect(card()).toHaveAttribute('data-cadence-contract', 'true')
    expect(card()).toHaveAttribute('data-primary-peak-date', '2026-09-17')
    expect(card()).toHaveAttribute('data-primary-peak-discharge', '2.17')
  })

  it('accepts the documented daily-units shape when the optional time unit is absent', async () => {
    const documentedUnits = Object.fromEntries(Object.entries(response.daily_units).filter(([key]) => key !== 'time'))
    render(<ResponseDemoPreview api={api} data={{ ...response, daily_units: documentedUnits }} requestUrl={requestUrl} executedRequest={executedGet}/>)

    expect(await screen.findByText('Forecast peak')).toBeInTheDocument()
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-unit-contract', 'true')
  })

  it('keeps a structurally valid flood payload partial when execution evidence is missing', async () => {
    render(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl}/>)

    expect(await screen.findByText('Forecast peak')).toBeInTheDocument()
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
  })

  it('fails closed when the displayed flood URL disagrees with the actual transport', async () => {
    const invalidRequests = [
      { url: requestUrl, method: 'POST' },
      { url: requestUrl, method: 'GET', body: { unexpected: true } },
      { url: `${requestUrl}&extra=1`, method: 'GET' },
    ]
    const { rerender } = render(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={invalidRequests[0]}/>)

    for (const executedRequest of invalidRequests) {
      rerender(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={executedRequest}/>)
      expect(await screen.findByText('Flood forecast evidence unavailable')).toBeInTheDocument()
      expect(card()).toHaveAttribute('data-result-state', 'invalid')
      expect(card()).toHaveAttribute('data-request-bound', 'false')
      expect(card()).not.toHaveTextContent('2.17')
    }
  })

  it('withholds numeric strings instead of coercing them into a plausible flood forecast', async () => {
    render(<ResponseDemoPreview
      api={api}
      requestUrl={requestUrl}
      executedRequest={executedGet}
      data={{
        ...response,
        daily: {
          ...response.daily,
          river_discharge: ['999.9', 1.2],
        },
      }}
    />)

    expect(await screen.findByText('Forecast peak')).toBeInTheDocument()
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-invalid-measurement-count', '1')
    expect(card()).not.toHaveTextContent('999.9')
  })

  it('keeps parallel date and measurement identity when one row is incomplete', async () => {
    render(<ResponseDemoPreview
      api={api}
      requestUrl={requestUrl}
      executedRequest={executedGet}
      data={{
        ...response,
        daily: {
          ...response.daily,
          river_discharge: [null, 1.2],
        },
      }}
    />)

    expect(await screen.findByText('Forecast peak')).toBeInTheDocument()
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-missing-measurement-count', '1')
    expect(card()).toHaveAttribute('data-valid-row-count', '1')
    expect(card()).toHaveAttribute('data-primary-peak-date', '2026-09-17')
  })

  it('distinguishes an aligned all-missing series from parallel-array drift', async () => {
    const missingSeries = {
      ...response,
      daily: {
        ...response.daily,
        river_discharge: [null, null],
        river_discharge_mean: [null, null],
        river_discharge_max: [null, null],
      },
    }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={missingSeries}/>)

    expect(await screen.findByText('No flood forecast measurements returned')).toBeInTheDocument()
    expect(card()).toHaveAttribute('data-result-state', 'empty')
    expect(card()).toHaveAttribute('data-array-length-contract', 'true')
    expect(card()).toHaveAttribute('data-horizon-contract', 'true')

    rerender(<ResponseDemoPreview
      api={api}
      requestUrl={requestUrl}
      executedRequest={executedGet}
      data={{
        ...missingSeries,
        daily: {
          ...missingSeries.daily,
          river_discharge_max: [null],
        },
      }}
    />)

    expect(await screen.findByText('Flood forecast evidence unavailable')).toBeInTheDocument()
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-array-length-contract', 'false')
  })

  it('fails malformed or unsupported HTTP-success request/response identities closed', async () => {
    const { rerender } = render(<ResponseDemoPreview api={api} data={{}} requestUrl={requestUrl} executedRequest={executedGet}/>)
    expect(await screen.findByText('Flood forecast evidence unavailable')).toBeInTheDocument()
    expect(card()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview
      api={api}
      data={response}
      requestUrl="https://flood-api.open-meteo.com/v1/flood?latitude=1.3521&longitude=103.8198&daily=river_discharge&forecast_days=2"
    />)
    expect(await screen.findByText('Flood forecast evidence unavailable')).toBeInTheDocument()
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).not.toHaveTextContent('2.17')

    rerender(<ResponseDemoPreview
      api={api}
      data={{ ...response, daily_units: { ...response.daily_units, river_discharge_max: 'ft³/s' } }}
      requestUrl={requestUrl}
      executedRequest={executedGet}
    />)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-unit-contract', 'false')
  })
})
