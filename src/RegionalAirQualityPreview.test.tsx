import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { RegionalAirQualityPreview } from './previews/WeatherPreviews'

const api = (id: 'data-gov-psi' | 'data-gov-pm25') => {
  const match = apiCatalog.find((candidate) => candidate.id === id)
  if (!match) throw new Error(`Missing API fixture: ${id}`)
  return match
}

const response = (metricKey: string, readings: Record<string, unknown>, timestamps: Record<string, unknown> = {}) => ({
  items: [{
    timestamp: '2026-09-14T10:00:00+08:00',
    update_timestamp: '2026-09-14T10:08:52+08:00',
    ...timestamps,
    readings: { [metricKey]: readings },
  }],
})

const allRegions = (value: number) => ({ north: value, south: value, east: value, west: value, central: value })

describe('RegionalAirQualityPreview semantic contract', () => {
  afterEach(cleanup)

  it('exposes a complete PSI response as ready with stable provider evidence', () => {
    const { container } = render(<RegionalAirQualityPreview api={api('data-gov-psi')} data={response('psi_twenty_four_hourly', {
      north: 49,
      south: 80,
      east: 101,
      west: 180,
      central: 75,
    })}/>)

    const card = container.querySelector('[data-domain-card="regional-air-quality"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-metric-key', 'psi_twenty_four_hourly')
    expect(card).toHaveAttribute('data-provider-region-count', '5')
    expect(card).toHaveAttribute('data-valid-region-count', '5')
    expect(card).toHaveAttribute('data-invalid-region-count', '0')
    expect(card).toHaveAttribute('data-missing-region-count', '0')
    expect(card).toHaveAttribute('data-unit', 'PSI')
    expect(card).toHaveAttribute('data-band', 'Unhealthy')
    expect(card).toHaveAttribute('data-observation-time', '2026-09-14T10:00:00+08:00')
    expect(card).toHaveAttribute('data-update-time', '2026-09-14T10:08:52+08:00')
    expect(screen.getByText('Derived regional average · PSI')).toBeInTheDocument()
    expect(screen.getByText('Unhealthy')).toBeInTheDocument()
  })

  it.each([
    [50, 'Good'],
    [51, 'Moderate'],
    [100, 'Moderate'],
    [101, 'Unhealthy'],
    [200, 'Unhealthy'],
    [201, 'Very unhealthy'],
    [300, 'Very unhealthy'],
    [301, 'Hazardous'],
  ])('uses the official Singapore PSI band at %s', (value, band) => {
    const { container } = render(<RegionalAirQualityPreview api={api('data-gov-psi')} data={response('psi_twenty_four_hourly', allRegions(value))}/>)

    const card = container.querySelector('[data-domain-card="regional-air-quality"]')
    expect(card).toHaveAttribute('data-band', band)
    expect(card).toHaveAttribute('data-band-basis', 'highest-regional-reading')
    expect(screen.getByText(band)).toBeInTheDocument()
  })

  it.each([
    [55, 'Normal'],
    [56, 'Elevated'],
    [150, 'Elevated'],
    [151, 'High'],
    [250, 'High'],
    [251, 'Very High'],
  ])('uses the official Singapore one-hour PM2.5 band at %s µg/m³', (value, band) => {
    const { container } = render(<RegionalAirQualityPreview api={api('data-gov-pm25')} data={response('pm25_one_hourly', allRegions(value))}/>)

    const card = container.querySelector('[data-domain-card="regional-air-quality"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-metric-key', 'pm25_one_hourly')
    expect(card).toHaveAttribute('data-unit', 'µg/m³')
    expect(card).toHaveAttribute('data-band', band)
    expect(screen.getByText(band)).toBeInTheDocument()
  })

  it('fails closed instead of presenting a different pollutant as PSI', () => {
    const { container } = render(<RegionalAirQualityPreview api={api('data-gov-psi')} data={response('pm10_twenty_four_hourly', allRegions(27))}/>)

    const card = container.querySelector('[data-domain-card="regional-air-quality"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-metric-key', 'psi_twenty_four_hourly')
    expect(card).toHaveAttribute('data-valid-region-count', '0')
    expect(screen.getByText('Regional PSI response invalid')).toBeInTheDocument()
    expect(screen.queryByText('27')).not.toBeInTheDocument()
    expect(screen.queryByText(/Good|Moderate|Unhealthy|Hazardous/)).not.toBeInTheDocument()
  })

  it('rejects numeric strings instead of coercing them into PM2.5 measurements', () => {
    const { container } = render(<RegionalAirQualityPreview api={api('data-gov-pm25')} data={response('pm25_one_hourly', {
      north: '40',
      south: '41',
      east: '42',
      west: '43',
      central: '44',
    })}/>)

    const card = container.querySelector('[data-domain-card="regional-air-quality"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-provider-region-count', '5')
    expect(card).toHaveAttribute('data-valid-region-count', '0')
    expect(card).toHaveAttribute('data-invalid-region-count', '5')
    expect(screen.queryByText('40')).not.toBeInTheDocument()
    expect(screen.queryByText(/Normal|Elevated|High|Very High/)).not.toBeInTheDocument()
  })

  it('rejects negative and non-finite numeric values as invalid measurements', () => {
    const { container } = render(<RegionalAirQualityPreview api={api('data-gov-pm25')} data={response('pm25_one_hourly', {
      north: -1,
      south: Number.NaN,
      east: Number.POSITIVE_INFINITY,
      west: Number.NEGATIVE_INFINITY,
      central: -5,
    })}/>)

    const card = container.querySelector('[data-domain-card="regional-air-quality"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-provider-region-count', '5')
    expect(card).toHaveAttribute('data-valid-region-count', '0')
    expect(card).toHaveAttribute('data-invalid-region-count', '5')
    expect(screen.queryByText(/Normal|Elevated|High|Very High/)).not.toBeInTheDocument()
  })

  it('marks mixed trusted, malformed, unknown, and missing regional values partial', () => {
    const { container } = render(<RegionalAirQualityPreview api={api('data-gov-pm25')} data={response('pm25_one_hourly', {
      north: 40,
      south: '41',
      east: 42,
      west: 43,
      northeast: 44,
    })}/>)

    const card = container.querySelector('[data-domain-card="regional-air-quality"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-region-count', '5')
    expect(card).toHaveAttribute('data-valid-region-count', '3')
    expect(card).toHaveAttribute('data-invalid-region-count', '2')
    expect(card).toHaveAttribute('data-missing-region-count', '1')
    expect(screen.getByRole('status')).toHaveTextContent('incomplete')
    expect(screen.getByText('South').closest('article')).toHaveTextContent('—')
    expect(screen.getByText('Central').closest('article')).toHaveTextContent('—')
    expect(screen.queryByText('Northeast')).not.toBeInTheDocument()
  })

  it('marks complete measurements partial when provider timestamps are not valid ISO date-times', () => {
    const { container } = render(<RegionalAirQualityPreview api={api('data-gov-psi')} data={response('psi_twenty_four_hourly', allRegions(50), {
      timestamp: '14 September 2026 10am',
      update_timestamp: null,
    })}/>)

    const card = container.querySelector('[data-domain-card="regional-air-quality"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).not.toHaveAttribute('data-observation-time')
    expect(card).not.toHaveAttribute('data-update-time')
    expect(screen.getByRole('status')).toHaveTextContent('timestamp')
  })

  it('rejects a malformed items envelope even if it contains plausible readings', () => {
    const { container } = render(<RegionalAirQualityPreview api={api('data-gov-pm25')} data={{
      items: {
        timestamp: '2026-09-14T10:00:00+08:00',
        update_timestamp: '2026-09-14T10:08:52+08:00',
        readings: { pm25_one_hourly: allRegions(40) },
      },
    }}/>)

    expect(container.querySelector('[data-domain-card="regional-air-quality"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.queryByText('40')).not.toBeInTheDocument()
  })
})
