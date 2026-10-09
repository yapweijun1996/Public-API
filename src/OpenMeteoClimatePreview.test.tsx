import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'open-meteo-climate')
if (!api) throw new Error('Missing open-meteo-climate fixture')

const requestUrl = 'https://climate-api.open-meteo.com/v1/climate?latitude=1.4&longitude=103.8&start_date=2026-08-03&end_date=2026-08-05&models=CMCC_CM2_VHR4&daily=temperature_2m_mean%2Cprecipitation_sum&format=json'
const executedRequest = { method: 'GET', url: requestUrl } as const

describe('Open-Meteo Climate semantic preview', () => {
  afterEach(cleanup)

  it('preserves the executed climate model and maps daily climate arrays into semantic metrics', () => {
    render(<ResponseDemoPreview
      api={api}
      requestUrl={requestUrl}
      executedRequest={executedRequest}
      data={{
        latitude: 1.4,
        longitude: 103.8,
        elevation: 46,
        daily_units: { time: 'iso8601', temperature_2m_mean: '°C', precipitation_sum: 'mm' },
        daily: {
          time: ['2026-08-03', '2026-08-04', '2026-08-05'],
          temperature_2m_mean: [26, 27, 28],
          precipitation_sum: [1.5, 0, 2.5],
        },
      }}
    />)

    const preview = screen.getByRole('region', { name: 'Open-Meteo Climate' })
    expect(preview).toHaveAttribute('data-preview-layout', 'market-chart')
    const card = preview.querySelector('[data-domain-card="climate-projection"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-primary-model', 'CMCC_CM2_VHR4')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-date-range-contract', 'true')
    expect(card).toHaveAttribute('data-array-length-contract', 'true')
    expect(card).toHaveAttribute('data-daily-cadence-contract', 'true')
    expect(card).toHaveAttribute('data-unit-contract', 'true')
    expect(card).toHaveAttribute('data-invalid-record-count', '0')
    expect(card).toHaveAttribute('data-period-start', '2026-08-03')
    expect(card).toHaveAttribute('data-period-end', '2026-08-05')
    expect(card).toHaveAttribute('data-observation-count', '3')
    expect(card).toHaveAttribute('data-latest-temperature', '28')
    expect(preview).toHaveTextContent('CMCC_CM2_VHR4 climate projection')
    expect(preview).toHaveTextContent('Latest daily mean28 °C')
    expect(preview).toHaveTextContent('Period mean27 °C')
    expect(preview).toHaveTextContent('Total precipitation4 mm')
    expect(preview).toHaveTextContent('Returned days3')
    expect(preview).not.toHaveTextContent('Observations1')
  })


  it('fails closed when the displayed climate URL was actually executed with POST, a GET body, or a different URL', () => {
    const data = {
      latitude: 1.4,
      longitude: 103.8,
      daily_units: { time: 'iso8601', temperature_2m_mean: '°C', precipitation_sum: 'mm' },
      daily: {
        time: ['2026-08-03', '2026-08-04', '2026-08-05'],
        temperature_2m_mean: [26, 27, 28],
        precipitation_sum: [1.5, 0, 2.5],
      },
    }
    const assertions = [
      { method: 'POST', url: requestUrl },
      { method: 'GET', url: requestUrl, body: '{}' },
      { method: 'GET', url: requestUrl.replace('latitude=1.4', 'latitude=1.5') },
    ]
    for (const actual of assertions) {
      const { unmount } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={actual} data={data}/>)
      const card = screen.getByRole('region', { name: 'Open-Meteo Climate' }).querySelector('[data-domain-card="climate-projection"]')
      expect(card).toHaveAttribute('data-result-state', 'invalid')
      expect(card).toHaveAttribute('data-request-bound', 'false')
      unmount()
    }
  })

  it('does not mark a climate response ready when executed transport evidence is unavailable', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{
      latitude: 1.4,
      longitude: 103.8,
      daily_units: { time: 'iso8601', temperature_2m_mean: '°C', precipitation_sum: 'mm' },
      daily: {
        time: ['2026-08-03', '2026-08-04', '2026-08-05'],
        temperature_2m_mean: [26, 27, 28],
        precipitation_sum: [1.5, 0, 2.5],
      },
    }}/>)
    const card = screen.getByRole('region', { name: 'Open-Meteo Climate' }).querySelector('[data-domain-card="climate-projection"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('rejects a non-Open-Meteo URL even when its query parameters imitate the climate request', () => {
    const spoofed = requestUrl.replace('https://climate-api.open-meteo.com/v1/climate', 'https://example.com/v1/climate')
    render(<ResponseDemoPreview api={api} requestUrl={spoofed} executedRequest={{ method: 'GET', url: spoofed }} data={{
      latitude: 1.4,
      longitude: 103.8,
      daily_units: { time: 'iso8601', temperature_2m_mean: '°C', precipitation_sum: 'mm' },
      daily: { time: ['2026-08-03', '2026-08-04', '2026-08-05'], temperature_2m_mean: [26, 27, 28], precipitation_sum: [1.5, 0, 2.5] },
    }}/>)
    const card = screen.getByRole('region', { name: 'Open-Meteo Climate' }).querySelector('[data-domain-card="climate-projection"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('fails semantically closed when no dated daily climate series is present', () => {
    render(<ResponseDemoPreview api={api} data={{ daily: { time: [], temperature_2m_mean: [] } }}/>)
    const preview = screen.getByRole('region', { name: 'Open-Meteo Climate' })
    const empty = preview.querySelector('[data-domain-card="climate-projection"]')
    expect(empty).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Climate projection unavailable')
  })

  it('rejects a plausible HTTP-success climate series whose dates do not match the executed request', () => {
    render(<ResponseDemoPreview
      api={api}
      requestUrl={requestUrl}
      executedRequest={executedRequest}
      data={{
        latitude: 1.4,
        longitude: 103.8,
        daily_units: { time: 'iso8601', temperature_2m_mean: '°C', precipitation_sum: 'mm' },
        daily: {
          time: ['2026-08-04', '2026-08-05', '2026-08-06'],
          temperature_2m_mean: [26, 27, 28],
          precipitation_sum: [1.5, 0, 2.5],
        },
      }}
    />)

    const preview = screen.getByRole('region', { name: 'Open-Meteo Climate' })
    const card = preview.querySelector('[data-domain-card="climate-projection"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-date-range-contract', 'false')
    expect(preview).toHaveTextContent('Climate projection identity mismatch')
    expect(preview).not.toHaveTextContent('Latest daily mean28 °C')
  })

  it('marks a structurally usable but incomplete daily array response as partial', () => {
    render(<ResponseDemoPreview
      api={api}
      requestUrl={requestUrl}
      executedRequest={executedRequest}
      data={{
        latitude: 1.4,
        longitude: 103.8,
        daily_units: { time: 'iso8601', temperature_2m_mean: '°C', precipitation_sum: 'mm' },
        daily: {
          time: ['2026-08-03', '2026-08-04', '2026-08-05'],
          temperature_2m_mean: [26, 27, 28],
          precipitation_sum: [1.5, 0],
        },
      }}
    />)

    const preview = screen.getByRole('region', { name: 'Open-Meteo Climate' })
    const card = preview.querySelector('[data-domain-card="climate-projection"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-array-length-contract', 'false')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(preview).toHaveTextContent('Partial climate response')
    expect(preview).toHaveTextContent('Validated days2')
    expect(preview).not.toHaveTextContent('Period mean')
    expect(preview).not.toHaveTextContent('Total precipitation')
  })
})
