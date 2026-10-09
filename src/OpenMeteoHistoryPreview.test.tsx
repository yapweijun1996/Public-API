import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'open-meteo-history')
if (!api) throw new Error('Missing open-meteo-history fixture')

const requestUrl = api.buildUrl({})
const executedRequest = { method: 'GET', url: requestUrl } as const
const days = Array.from({ length: 14 }, (_, index) => new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10))
const dailyValues = (value: unknown) => Array.from({ length: 14 }, () => value)

const historyResponse = (dailyOverrides: Record<string, unknown> = {}) => ({
  latitude: 1.3708259,
  longitude: 103.80237,
  generationtime_ms: 0.1,
  utc_offset_seconds: 28800,
  timezone: 'Asia/Singapore',
  timezone_abbreviation: 'GMT+8',
  elevation: 7,
  daily_units: {
    time: 'iso8601',
    temperature_2m_max: '°C',
    temperature_2m_min: '°C',
    precipitation_sum: 'mm',
  },
  daily: {
    time: days,
    temperature_2m_max: dailyValues(31.8),
    temperature_2m_min: dailyValues(22.8),
    precipitation_sum: dailyValues(3.3),
    ...dailyOverrides,
  },
})

const region = () => screen.getByRole('region', { name: 'Historical Weather' })
const card = () => region().querySelector('[data-domain-card="historical-weather"]')

describe('Open-Meteo Historical Weather semantic preview', () => {
  afterEach(cleanup)

  it('binds the documented daily response to the exact executed date-range request', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={historyResponse()}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(region()).toHaveAttribute('data-preview-layout', 'historical-weather')
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-request-bound', 'true')
    expect(card()).toHaveAttribute('data-request-start-date', '2025-01-01')
    expect(card()).toHaveAttribute('data-request-end-date', '2025-01-14')
    expect(card()).toHaveAttribute('data-provider-day-count', '14')
    expect(card()).toHaveAttribute('data-valid-day-count', '14')
    expect(card()).toHaveAttribute('data-date-range-contract', 'true')
    expect(card()).toHaveAttribute('data-array-length-contract', 'true')
    expect(card()).toHaveAttribute('data-unit-contract', 'true')
    expect(region()).toHaveTextContent('Average high')
    expect(region()).toHaveTextContent('Total rain')
  })

  it('fails closed when the displayed historical-weather URL was executed with POST, a GET body, or a different URL', async () => {
    const executions = [
      { method: 'POST', url: requestUrl },
      { method: 'GET', url: requestUrl, body: '{}' },
      { method: 'GET', url: requestUrl.replace('latitude=1.3521', 'latitude=1.3') },
    ]

    for (const actual of executions) {
      const { unmount } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={actual} data={historyResponse()}/>)
      await waitFor(() => expect(card()).toBeInTheDocument())
      expect(card()).toHaveAttribute('data-result-state', 'invalid')
      expect(card()).toHaveAttribute('data-request-bound', 'false')
      unmount()
    }
  })

  it('keeps usable historical data partial when executed-request evidence is unavailable', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={historyResponse()}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(region()).toHaveTextContent('Partial response')
  })

  it('withholds a missing daily measurement instead of manufacturing a plausible zero', async () => {
    const rain = dailyValues(3.3)
    rain[13] = null
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={historyResponse({ precipitation_sum: rain })}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-missing-measurement-count', '1')
    expect(card()).toHaveAttribute('data-valid-day-count', '13')
    expect(region()).not.toHaveTextContent('0 mm')
  })

  it('rejects numeric-string measurements and a plausible HTTP-200 truncated date range', async () => {
    const highs = dailyValues(31.8)
    highs[0] = '99.9'
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={historyResponse({
      time: days.slice(0, 13),
      temperature_2m_max: highs.slice(0, 13),
      temperature_2m_min: dailyValues(22.8).slice(0, 13),
      precipitation_sum: dailyValues(3.3).slice(0, 13),
    })}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-date-range-contract', 'false')
    expect(card()).toHaveAttribute('data-invalid-measurement-count', '1')
    expect(region()).not.toHaveTextContent('99.9')
  })

  it('fails closed when the executed URL expands the supported request surface', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&temperature_unit=fahrenheit`} executedRequest={{ method: 'GET', url: `${requestUrl}&temperature_unit=fahrenheit` }} data={historyResponse()}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(region()).toHaveTextContent('Historical weather unavailable')
    expect(region()).not.toHaveTextContent('31.8')
  })
})
