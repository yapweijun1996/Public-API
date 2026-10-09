import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'osrm-route')!
const requestUrl = api.buildUrl({ startLatitude: '1.3521', startLongitude: '103.8198', endLatitude: '1.290270', endLongitude: '103.851959', alternatives: '1' })
const executedRequest = { url: requestUrl, method: 'GET' }
const route = {
  distance: 11480.8, duration: 1174.9, weight: 4444.6, weight_name: 'routability',
  geometry: { type: 'LineString', coordinates: [[103.8198, 1.3521], [103.835, 1.32], [103.851959, 1.29027]] },
  legs: [{ distance: 11480.8, duration: 1174.9, steps: [
    { distance: 120.4, duration: 28.2, name: 'Start Road', maneuver: { type: 'depart', modifier: 'straight' } },
    { distance: 840.2, duration: 95.1, name: 'Orchard Road', maneuver: { type: 'turn', modifier: 'left' } },
  ] }],
}
const waypoints = [
  { name: 'Start Road', location: [103.8198, 1.3521] },
  { name: 'Destination Road', location: [103.851959, 1.29027] },
]
const response = (routes: unknown[] = [route], extra: Record<string, unknown> = {}) => ({ code: 'Ok', waypoints, routes, ...extra })
const card = () => screen.getByRole('region', { name: 'OSRM Route' }).querySelector('.route-summary-preview') as HTMLElement

describe('OSRM Route semantic identity', () => {
  afterEach(cleanup)

  it('renders ready only from a coherent request-bound route', () => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={response()}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-route-code', 'Ok')
    expect(root).toHaveAttribute('data-requested-start', '103.8198,1.3521')
    expect(root).toHaveAttribute('data-requested-end', '103.851959,1.29027')
    expect(root).toHaveAttribute('data-requested-alternatives', '1')
    expect(root).toHaveAttribute('data-provider-route-count', '1')
    expect(root).toHaveAttribute('data-valid-route-count', '1')
    expect(root).toHaveAttribute('data-invalid-route-count', '0')
    expect(root).toHaveAttribute('data-incomplete-route-count', '0')
    expect(root).toHaveAttribute('data-waypoint-contract-valid', 'true')
    expect(root).toHaveAttribute('data-primary-distance-m', '11480.8')
    expect(root).toHaveAttribute('data-primary-duration-s', '1174.9')
    expect(root).toHaveAttribute('data-primary-step-count', '2')
    expect(root).toHaveAttribute('data-primary-geometry-point-count', '3')
    expect(within(root).getByText('Calculated route')).toBeInTheDocument()
    expect(root).toHaveTextContent('Start Road · 1.3521, 103.8198')
    expect(root).toHaveTextContent('Destination Road · 1.29027, 103.85196')
    expect(root).toHaveTextContent('Orchard Road')
  })

  it('fails closed on a non-Ok HTTP-success outcome', () => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={{ code: 'NoRoute', waypoints, routes: [route] }}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-route-code', 'NoRoute')
    expect(root).toHaveAttribute('data-primary-distance-m', '')
    expect(root).not.toHaveTextContent('Calculated route')
    expect(root).not.toHaveTextContent('11.48 km')
  })

  it('rejects malformed envelopes and core route identity', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={{ code: 'Ok', waypoints }}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveTextContent('Invalid OSRM route envelope')
    rerender(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={response([{ ...route, distance: '11480.8' }])}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveTextContent('Invalid OSRM route identity')
    rerender(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={response([{ ...route, geometry: { type: 'Point', coordinates: [[103.8198, 1.3521]] } }])}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('omits malformed routes and marks a mixed batch partial', () => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={response([
      route,
      { ...route, distance: 999999, geometry: { type: 'LineString', coordinates: [['fake', 1.3], [103.9, 1.2]] } },
    ])}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-provider-route-count', '2')
    expect(root).toHaveAttribute('data-valid-route-count', '1')
    expect(root).toHaveAttribute('data-invalid-route-count', '1')
    expect(root).toHaveAttribute('data-result-count', '1')
    expect(root).toHaveTextContent('Calculated route')
    expect(root).not.toHaveTextContent('999.00 km')
  })

  it('keeps core route facts but hides malformed turn steps as partial', () => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={response([{ ...route, legs: [{ steps: [{ distance: 10, duration: 2, name: 'Fake Road', maneuver: {} }] }] }])}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-incomplete-route-count', '1')
    expect(root).toHaveAttribute('data-primary-step-count', '0')
    expect(root).toHaveTextContent('11.48 km')
    expect(root).not.toHaveTextContent('Fake Road')
  })

  it('marks malformed snapped-waypoint context partial', () => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={response([route], { waypoints: [{ name: 'Start', location: ['bad', 1.3] }, waypoints[1]] })}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-waypoint-contract-valid', 'false')
    expect(root).toHaveTextContent('Snapped from — to —')
  })

  it('requires the actual executed transport to be the supported bodyless GET', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} executedRequest={{ url: requestUrl, method: 'POST' }} data={response()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveTextContent('Invalid OSRM request identity')

    rerender(<ResponseDemoPreview api={api} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={response()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveTextContent('Invalid OSRM request identity')
  })

  it('does not claim request-bound readiness without a valid executed URL', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} data={response()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-requested-start', '')
    expect(card()).toHaveTextContent('Calculated route')
    rerender(<ResponseDemoPreview api={api} executedRequest={{ url: 'https://router.project-osrm.org/route/v1/walking/103.8198,1.3521;103.851959,1.29027?alternatives=1&geometries=geojson&overview=full&steps=true', method: 'GET' }} data={response()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveTextContent('Invalid OSRM request identity')
    expect(card()).not.toHaveTextContent('Calculated route')
    rerender(<ResponseDemoPreview api={api} executedRequest={{ url: `${requestUrl}&foo=bar`, method: 'GET' }} data={response()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveTextContent('Invalid OSRM request identity')
    rerender(<ResponseDemoPreview api={api} executedRequest={{ url: requestUrl.replace('alternatives=1', 'alternatives=1&alternatives=2'), method: 'GET' }} data={response()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    rerender(<ResponseDemoPreview api={api} executedRequest={{ url: requestUrl.replace('https://router.project-osrm.org', 'https://user:pass@router.project-osrm.org'), method: 'GET' }} data={response()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    rerender(<ResponseDemoPreview api={api} executedRequest={{ url: `${requestUrl}#debug`, method: 'GET' }} data={response()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })
})
