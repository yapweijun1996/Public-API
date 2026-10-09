import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ExecutedRequestContext } from './useApiRequestRuntime'
import {
  DATA_GOV_TRAFFIC_IMAGES_URL,
  DataGovTrafficImagesPreview,
  buildDataGovTrafficImagesViewModel,
} from './previews/DataGovTrafficImagesPreview'

const request = (overrides: Partial<ExecutedRequestContext> = {}): ExecutedRequestContext => ({
  method: 'GET',
  url: DATA_GOV_TRAFFIC_IMAGES_URL,
  ...overrides,
})

const camera = (id: unknown, overrides: Record<string, unknown> = {}) => ({
  camera_id: id,
  timestamp: '2026-09-17T12:34:56+08:00',
  image: `https://images.data.gov.sg/api/traffic-images/${String(id)}.jpg`,
  location: { latitude: 1.3521, longitude: 103.8198 },
  image_metadata: { width: 1920, height: 1080, md5: '0123456789abcdef0123456789abcdef' },
  ...overrides,
})

const response = (cameras: unknown[], overrides: Record<string, unknown> = {}) => ({
  items: [{ timestamp: '2026-09-17T12:34:56+08:00', cameras }],
  api_info: { status: 'healthy' },
  ...overrides,
})

describe('DataGovTrafficImagesPreview', () => {
  afterEach(cleanup)

  it('renders a bounded request-bound sample while exposing trustworthy totals and camera identity', () => {
    const cameras = Array.from({ length: 10 }, (_, index) => camera(String(2701 + index)))
    render(<DataGovTrafficImagesPreview data={response(cameras)} executedRequest={request()}/>)
    const card = screen.getByText('10 traffic cameras in provider snapshot').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-provider-camera-count', '10')
    expect(card).toHaveAttribute('data-valid-camera-count', '10')
    expect(card).toHaveAttribute('data-sample-camera-count', '8')
    expect(card).toHaveAttribute('data-primary-camera-id', '2701')
    expect(within(card as HTMLElement).getAllByRole('img')).toHaveLength(8)
    expect(card).toHaveTextContent('Camera ID 2701')
    expect(card).toHaveTextContent('1920 × 1080')
    expect(card).toHaveTextContent('0123456789abcdef0123456789abcdef')
  })

  it('withholds malformed and duplicate camera identities as partial', () => {
    render(<DataGovTrafficImagesPreview data={response([
      camera('2701'),
      camera('2701', { image: 'https://images.data.gov.sg/duplicate.jpg' }),
      camera('2702', { location: { latitude: '1.3', longitude: 103.8 } }),
    ])} executedRequest={request()}/>)
    const card = screen.getByText('3 traffic cameras in provider snapshot').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-camera-count', '1')
    expect(card).toHaveAttribute('data-duplicate-camera-count', '1')
    expect(card).toHaveAttribute('data-malformed-camera-count', '1')
    expect(within(card as HTMLElement).getAllByRole('img')).toHaveLength(1)
    expect(card).toHaveTextContent('Malformed or duplicate camera rows were withheld')
  })

  it('maps a coherent single snapshot with an empty camera array to empty', () => {
    render(<DataGovTrafficImagesPreview data={response([])} executedRequest={request()}/>)
    expect(screen.getByText('No traffic cameras in this snapshot').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'empty')
  })

  it.each([
    ['missing request', undefined],
    ['query', request({ url: `${DATA_GOV_TRAFFIC_IMAGES_URL}?date_time=2026-09-17T12%3A00%3A00Z` })],
    ['hash', request({ url: `${DATA_GOV_TRAFFIC_IMAGES_URL}#snapshot` })],
    ['wrong method', request({ method: 'POST' })],
    ['body', request({ body: {} })],
    ['wrong endpoint', request({ url: `${DATA_GOV_TRAFFIC_IMAGES_URL}/` })],
  ])('rejects %s as inexact executed-request evidence', (_label, executedRequest) => {
    expect(buildDataGovTrafficImagesViewModel(response([camera('2701')]), executedRequest)).toMatchObject({ state: 'invalid', requestBound: false })
  })

  it.each([
    ['array root', []],
    ['missing items', { api_info: { status: 'healthy' } }],
    ['empty items without a snapshot timestamp', { items: [], api_info: { status: 'healthy' } }],
    ['multiple snapshots', { items: response([camera('2701')]).items.concat(response([camera('2702')]).items) }],
    ['missing snapshot timestamp', { items: [{ cameras: [camera('2701')] }] }],
    ['numeric camera ID', response([camera(2701)])],
    ['HTTP image', response([camera('2701', { image: 'http://images.test/traffic.jpg' })])],
    ['numeric-string coordinate', response([camera('2701', { location: { latitude: '1.3521', longitude: 103.8198 } })])],
    ['numeric-string dimension', response([camera('2701', { image_metadata: { width: '1920', height: 1080, md5: '0123456789abcdef0123456789abcdef' } })])],
    ['uppercase MD5', response([camera('2701', { image_metadata: { width: 1920, height: 1080, md5: '0123456789ABCDEF0123456789ABCDEF' } })])],
    ['invalid camera timestamp', response([camera('2701', { timestamp: '2026-02-30T12:34:56+08:00' })])],
  ])('fails closed for %s type or envelope contradiction', (_label, data) => {
    expect(buildDataGovTrafficImagesViewModel(data, request()).state).toBe('invalid')
  })

  it('does not use optional api_info status as readiness proof', () => {
    const healthyButInvalid = buildDataGovTrafficImagesViewModel(response([camera('2701', { image_metadata: null })]), request())
    expect(healthyButInvalid).toMatchObject({ state: 'invalid', apiInfoStatus: 'healthy' })
    const missingApiInfo = buildDataGovTrafficImagesViewModel(response([camera('2701')], { api_info: undefined }), request())
    expect(missingApiInfo).toMatchObject({ state: 'ready', apiInfoContract: true, apiInfoStatus: undefined })
    const malformedApiInfo = buildDataGovTrafficImagesViewModel(response([camera('2701')], { api_info: { status: 200 } }), request())
    expect(malformedApiInfo).toMatchObject({ state: 'partial', apiInfoContract: false, apiInfoStatus: undefined })
  })
})
