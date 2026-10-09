import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'open-meteo-elevation')
if (!api) throw new Error('Missing open-meteo-elevation fixture')

describe('Open-Meteo Elevation semantic preview', () => {
  afterEach(cleanup)

  it('keeps the request coordinate beside the response elevation', () => {
    const requestUrl = "https://api.open-meteo.com/v1/elevation?latitude=1.3521&longitude=103.8198"
    render(<ResponseDemoPreview
      api={api}
      data={{ elevation: [46] }}
      requestUrl={requestUrl}
      executedRequest={{ url: requestUrl, method: 'GET' }}
    />)

    const preview = screen.getByRole('region', { name: 'Open-Meteo Elevation' })
    expect(preview).toHaveAttribute('data-preview-layout', 'terrain-elevation')
    expect(preview).toHaveAttribute('data-ssot-fallback', 'false')

    const card = preview.querySelector('.elevation-preview')
    expect(card).toHaveAttribute('data-primary-elevation-meters', '46')
    expect(card).toHaveAttribute('data-request-latitude', '1.3521')
    expect(card).toHaveAttribute('data-request-longitude', '103.8198')
    expect(card).toHaveAttribute('data-dem-resolution-meters', '90')
    expect(card).toHaveAttribute('data-source-dataset', 'Copernicus DEM 2021 GLO-90')
    expect(within(preview).getByRole('heading', { name: '46 m terrain elevation' })).toBeInTheDocument()
    expect(preview).toHaveTextContent('WGS84 1.3521, 103.8198')
    expect(preview).toHaveTextContent('Requested latitude1.3521')
    expect(preview).toHaveTextContent('Requested longitude103.8198')
    expect(preview).toHaveTextContent('Copernicus DEM 2021 GLO-90')
    expect(preview).toHaveTextContent('requires attribution to both the Copernicus programme and Open-Meteo')
    expect(preview).not.toHaveTextContent('Point 1')
    expect(preview.querySelector('.semantic-card-grid')).not.toBeInTheDocument()
  })

  it('does not trust a canonical display URL when the actual transport is not the exact bodyless GET', () => {
    const requestUrl = 'https://api.open-meteo.com/v1/elevation?latitude=1.3521&longitude=103.8198'
    const { rerender } = render(<ResponseDemoPreview
      api={api}
      data={{ elevation: [46] }}
      requestUrl={requestUrl}
      executedRequest={{ url: requestUrl, method: 'POST' }}
    />)

    let preview = screen.getByRole('region', { name: 'Open-Meteo Elevation' })
    expect(preview.querySelector('[data-domain-card="terrain-elevation"]')).not.toHaveAttribute('data-result-state', 'ready')

    rerender(<ResponseDemoPreview
      api={api}
      data={{ elevation: [46] }}
      requestUrl={requestUrl}
      executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }}
    />)
    preview = screen.getByRole('region', { name: 'Open-Meteo Elevation' })
    expect(preview.querySelector('[data-domain-card="terrain-elevation"]')).not.toHaveAttribute('data-result-state', 'ready')

    rerender(<ResponseDemoPreview
      api={api}
      data={{ elevation: [46] }}
      requestUrl={requestUrl}
      executedRequest={{ url: `${requestUrl}&extra=1`, method: 'GET' }}
    />)
    preview = screen.getByRole('region', { name: 'Open-Meteo Elevation' })
    expect(preview.querySelector('[data-domain-card="terrain-elevation"]')).not.toHaveAttribute('data-result-state', 'ready')
  })

  it('keeps the request coordinates visible but partial when the executed request identity is unavailable', () => {
    const requestUrl = 'https://api.open-meteo.com/v1/elevation?latitude=1.3521&longitude=103.8198'
    render(<ResponseDemoPreview api={api} data={{ elevation: [46] }} requestUrl={requestUrl}/>)

    const preview = screen.getByRole('region', { name: 'Open-Meteo Elevation' })
    const card = preview.querySelector('.elevation-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-request-latitude', '1.3521')
    expect(card).toHaveAttribute('data-request-longitude', '103.8198')
    expect(preview).toHaveTextContent('executed transport identity unavailable')
  })

  it('fails semantically closed when the provider elevation contract is malformed', () => {
    const { rerender } = render(<ResponseDemoPreview
      api={api}
      data={{ elevation: ['46'] }}
      requestUrl="https://api.open-meteo.com/v1/elevation?latitude=1.3521&longitude=103.8198"
    />)

    let preview = screen.getByRole('region', { name: 'Open-Meteo Elevation' })
    let invalid = preview.querySelector('[data-domain-card="terrain-elevation"]')
    expect(invalid).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('46 m terrain elevation')

    rerender(<ResponseDemoPreview
      api={api}
      data={{ elevation: [46, 47] }}
      requestUrl="https://api.open-meteo.com/v1/elevation?latitude=1.3521&longitude=103.8198"
    />)
    preview = screen.getByRole('region', { name: 'Open-Meteo Elevation' })
    invalid = preview.querySelector('[data-domain-card="terrain-elevation"]')
    expect(invalid).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('46 m terrain elevation')
  })
})
