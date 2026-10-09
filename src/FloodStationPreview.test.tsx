import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'uk-flood-monitoring')
if (!api) throw new Error('Missing uk-flood-monitoring fixture')

const station = {
  label: 'Worcester (Barbourne)',
  riverName: 'River Severn',
  notation: '2642',
  stationReference: '2642',
  status: 'http://environment.data.gov.uk/flood-monitoring/def/core/statusActive',
  town: 'Worcester',
  catchmentName: 'Worcestershire Middle Severn',
  lat: 52.206967,
  long: -2.235272,
  measures: [{
    '@id': 'http://environment.data.gov.uk/flood-monitoring/id/measures/2642-level-stage-i-15_min-mASD',
    parameter: 'level',
    parameterName: 'Water Level',
    period: 900,
    qualifier: 'Stage',
    unitName: 'mASD',
  }],
}

describe('UK flood monitoring station semantic preview', () => {
  afterEach(cleanup)

  it('preserves station identity, location, status, and available measure semantics', () => {
    const requestUrl = "https://environment.data.gov.uk/flood-monitoring/id/stations?riverName=River+Severn&_limit=8"
    render(<ResponseDemoPreview
      api={api}
      data={{ meta: { limit: 8 }, items: [station] }}
      requestUrl={requestUrl}
      executedRequest={{ url: requestUrl, method: 'GET' }}
    />)

    const preview = screen.getByRole('region', { name: 'UK Flood Monitoring' })
    expect(preview).toHaveAttribute('data-preview-layout', 'flood-stations')
    expect(preview).toHaveAttribute('data-ssot-fallback', 'false')
    const card = preview.querySelector('.flood-stations-preview')
    expect(card).toHaveAttribute('data-requested-river', 'River Severn')
    expect(card).toHaveAttribute('data-station-count', '1')
    expect(card).toHaveAttribute('data-primary-station-reference', '2642')

    const stationItem = preview.querySelector('[data-station-reference="2642"]')
    expect(stationItem).toHaveAttribute('data-river-name', 'River Severn')
    expect(stationItem).toHaveAttribute('data-station-status', 'Active')
    expect(stationItem).toHaveAttribute('data-measure-count', '1')
    expect(within(preview).getByRole('heading', { name: 'Worcester (Barbourne)' })).toBeInTheDocument()
    expect(preview).toHaveTextContent('Worcestershire Middle Severn')
    expect(preview).toHaveTextContent('52.206967, -2.235272')
    expect(preview).toHaveTextContent('Water Level · Stage · mASD · 900 s interval')
    expect(preview).toHaveTextContent('Live readings and flood warnings are separate API resources')
  })

  it('does not trust a canonical river-filter display URL when the actual transport identity differs', () => {
    const requestUrl = 'https://environment.data.gov.uk/flood-monitoring/id/stations?riverName=River+Severn&_limit=8'
    const { rerender } = render(<ResponseDemoPreview
      api={api}
      data={{ meta: { limit: 8 }, items: [station] }}
      requestUrl={requestUrl}
      executedRequest={{ url: requestUrl, method: 'POST' }}
    />)
    let preview = screen.getByRole('region', { name: 'UK Flood Monitoring' })
    expect(preview.querySelector('[data-domain-card="flood-stations"]')).not.toHaveAttribute('data-result-state', 'ready')

    rerender(<ResponseDemoPreview
      api={api}
      data={{ meta: { limit: 8 }, items: [station] }}
      requestUrl={requestUrl}
      executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }}
    />)
    preview = screen.getByRole('region', { name: 'UK Flood Monitoring' })
    expect(preview.querySelector('[data-domain-card="flood-stations"]')).not.toHaveAttribute('data-result-state', 'ready')

    rerender(<ResponseDemoPreview
      api={api}
      data={{ meta: { limit: 8 }, items: [station] }}
      requestUrl={requestUrl}
      executedRequest={{ url: requestUrl.replace('_limit=8', '_limit=7'), method: 'GET' }}
    />)
    preview = screen.getByRole('region', { name: 'UK Flood Monitoring' })
    expect(preview.querySelector('[data-domain-card="flood-stations"]')).not.toHaveAttribute('data-result-state', 'ready')
  })

  it('states that riverName is an exact provider filter when no stations are returned', () => {
    const requestUrl = "https://environment.data.gov.uk/flood-monitoring/id/stations?riverName=Thames&_limit=8"
    render(<ResponseDemoPreview
      api={api}
      data={{ meta: { limit: 8 }, items: [] }}
      requestUrl={requestUrl}
      executedRequest={{ url: requestUrl, method: 'GET' }}
    />)
    const preview = screen.getByRole('region', { name: 'UK Flood Monitoring' })
    expect(preview.querySelector('[data-domain-card="flood-stations"]')).toHaveAttribute('data-result-state', 'empty')
    expect(preview).toHaveTextContent('exact river-name filter “Thames”')
  })

  it('fails closed when the documented station list shape is missing', () => {
    render(<ResponseDemoPreview
      api={api}
      data={{ meta: { limit: 8 }, items: { label: 'Not a list' } }}
      requestUrl="https://environment.data.gov.uk/flood-monitoring/id/stations?riverName=River+Severn&_limit=8"
    />)
    const preview = screen.getByRole('region', { name: 'UK Flood Monitoring' })
    expect(preview.querySelector('[data-domain-card="flood-stations"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('station list was not an array')
  })

  it('rejects a non-canonical executed request instead of trusting a successful station payload', () => {
    render(<ResponseDemoPreview
      api={api}
      data={{ meta: { limit: 8 }, items: [station] }}
      requestUrl="https://environment.data.gov.uk/flood-monitoring/id/stations?riverName=River+Severn&_limit=8&_offset=0"
    />)
    const preview = screen.getByRole('region', { name: 'UK Flood Monitoring' })
    const card = preview.querySelector('[data-domain-card="flood-stations"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(preview).not.toHaveTextContent('Worcester (Barbourne)')
  })

  it('fails closed when every station contradicts the exact executed river filter', () => {
    render(<ResponseDemoPreview
      api={api}
      data={{ meta: { limit: 8 }, items: [{ ...station, riverName: 'River Thames' }] }}
      requestUrl="https://environment.data.gov.uk/flood-monitoring/id/stations?riverName=River+Severn&_limit=8"
    />)
    const preview = screen.getByRole('region', { name: 'UK Flood Monitoring' })
    const card = preview.querySelector('[data-domain-card="flood-stations"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-filter-contract', 'false')
    expect(preview).not.toHaveTextContent('Worcester (Barbourne)')
  })

  it('does not coerce provider pagination metadata from numeric strings', () => {
    render(<ResponseDemoPreview
      api={api}
      data={{ meta: { limit: '8' }, items: [station] }}
      requestUrl="https://environment.data.gov.uk/flood-monitoring/id/stations?riverName=River+Severn&_limit=8"
    />)
    const preview = screen.getByRole('region', { name: 'UK Flood Monitoring' })
    const card = preview.querySelector('[data-domain-card="flood-stations"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-metadata-contract', 'false')
    expect(preview).not.toHaveTextContent('Worcester (Barbourne)')
  })

  it('keeps trusted provider identities and omits malformed station rows', () => {
    render(<ResponseDemoPreview
      api={api}
      data={{ meta: { limit: 8 }, items: [station, { label: 'Fabricated Station', riverName: 'River Severn' }] }}
      requestUrl="https://environment.data.gov.uk/flood-monitoring/id/stations?riverName=River+Severn&_limit=8"
    />)
    const preview = screen.getByRole('region', { name: 'UK Flood Monitoring' })
    const card = preview.querySelector('.flood-stations-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(preview.querySelectorAll('[data-station-reference]')).toHaveLength(1)
    expect(preview).toHaveTextContent('Worcester (Barbourne)')
    expect(preview).not.toHaveTextContent('Fabricated Station')
    expect(preview).not.toHaveTextContent('Station 2')
  })
})
