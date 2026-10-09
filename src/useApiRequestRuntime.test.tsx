import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getApiById, getDefaultParameters, type ApiDemo } from './apiCatalog'
import { REQUEST_TIMEOUT_MS, useApiRequestRuntime } from './useApiRequestRuntime'

const api = (id: string): ApiDemo => {
  const match = getApiById(id)
  if (!match) throw new Error(`Missing test API: ${id}`)
  return match
}

type HarnessProps = {
  api: ApiDemo
  values?: Record<string, string>
  onRunStart?: (api: ApiDemo, values: Record<string, string>) => void
}

function RuntimeHarness({ api: activeApi, values = getDefaultParameters(activeApi), onRunStart = () => undefined }: HarnessProps) {
  const { request, runRequest, cancelActiveRequest } = useApiRequestRuntime({ onRunStart })

  return (
    <section>
      <button type="button" onClick={() => void runRequest(activeApi, values).catch(() => undefined)}>Run request</button>
      <button type="button" onClick={cancelActiveRequest}>Cancel request</button>
      <output
        data-testid="request-state"
        data-status={request.status}
        data-error-type={request.status === 'error' ? request.errorType : undefined}
        data-http-status={request.status === 'success' || request.status === 'error' ? request.httpStatus : undefined}
        data-run-id={request.status === 'success' ? request.runId : undefined}
        data-request-method={request.status === 'success' ? request.executedRequest.method : undefined}
        data-request-url={request.status === 'success' ? request.executedRequest.url : undefined}
        data-request-body={request.status === 'success' && request.executedRequest.body !== undefined ? JSON.stringify(request.executedRequest.body) : undefined}
        data-response-media-url={request.status === 'success' ? request.responseMedia?.objectUrl : undefined}
        data-response-media-type={request.status === 'success' ? request.responseMedia?.contentType : undefined}
      >
        {request.status === 'success' ? JSON.stringify(request.data) : request.status === 'error' ? request.message : request.status}
      </output>
    </section>
  )
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useApiRequestRuntime', () => {
  it('owns the successful request lifecycle shared by Human UI and WebMCP', async () => {
    const countries = api('countries')
    const onRunStart = vi.fn()
    const payload = [{ page: 1 }, [{ id: 'SGP', name: 'Singapore' }]]
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(<RuntimeHarness api={countries} onRunStart={onRunStart} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))

    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'success'))
    expect(screen.getByTestId('request-state')).toHaveTextContent('Singapore')
    expect(screen.getByTestId('request-state')).toHaveAttribute('data-http-status', '200')
    expect(onRunStart).toHaveBeenCalledWith(countries, getDefaultParameters(countries))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('assigns a new success run ID even when a POST API keeps the same request URL', async () => {
    const aniList = api('anilist-graphql')
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: { Page: { pageInfo: {}, media: [] } } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))
    vi.stubGlobal('fetch', fetchMock)

    const { rerender } = render(<RuntimeHarness api={aniList} values={{ query: 'One', mediaType: 'ANIME', page: '1', limit: '6' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-run-id', '1'))

    rerender(<RuntimeHarness api={aniList} values={{ query: 'Two', mediaType: 'ANIME', page: '1', limit: '6' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-run-id', '2'))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(fetchMock.mock.calls[1]?.[0])
    const state = screen.getByTestId('request-state')
    expect(state).toHaveAttribute('data-request-method', 'POST')
    expect(state).toHaveAttribute('data-request-url', aniList.buildUrl({ query: 'Two', mediaType: 'ANIME', page: '1', limit: '6' }))
    const expectedBody = aniList.buildBody?.({ query: 'Two', mediaType: 'ANIME', page: '1', limit: '6' })
    expect(JSON.parse(state.getAttribute('data-request-body') ?? '{}')).toEqual(expectedBody)
    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined
    expect(JSON.parse(String(secondInit?.body))).toEqual(expectedBody)
  })

  it('sends provider-identification headers from the shared API SSOT', async () => {
    const wikidata = api('wikidata-sparql')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ head: { vars: [] }, results: { bindings: [] } }), {
      status: 200,
      headers: { 'Content-Type': 'application/sparql-results+json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(<RuntimeHarness api={wikidata} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))

    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'success'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    expect(init?.headers).toMatchObject({
      Accept: 'application/sparql-results+json',
      'Api-User-Agent': 'Public-API/0.1 (https://yapweijun1996.github.io/Public-API/)',
    })
  })

  it('rejects invalid select input before any provider request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<RuntimeHarness api={api('people')} values={{ count: '3', nationality: 'xx' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))

    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects fractional USAspending fiscal years and award limits before provider execution', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const usaspending = api('usaspending')
    const defaults = getDefaultParameters(usaspending)
    const { rerender } = render(<RuntimeHarness api={usaspending} values={{ ...defaults, fiscalYear: '2025.5' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))
    rerender(<RuntimeHarness api={usaspending} values={{ ...defaults, limit: '8.5' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects blank names and fractional GBIF occurrence limits before provider execution', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const gbif = api('gbif-occurrence-search')
    const { rerender } = render(<RuntimeHarness api={gbif} values={{ scientificName: '   ', limit: '6' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))
    rerender(<RuntimeHarness api={gbif} values={{ scientificName: 'Panthera leo', limit: '6.5' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects blank Stack Exchange tags and fractional page sizes before provider execution', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const stackExchange = api('stack-exchange')
    const { rerender } = render(<RuntimeHarness api={stackExchange} values={{ tags: '   ', limit: '8' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))
    rerender(<RuntimeHarness api={stackExchange} values={{ tags: 'javascript', limit: '8.5' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects blank Swiss transit endpoints and fractional connection counts before provider execution', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const swissTransit = api('swiss-transit-connections')
    const { rerender } = render(<RuntimeHarness api={swissTransit} values={{ from: '   ', to: 'Geneva', limit: '6' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))
    rerender(<RuntimeHarness api={swissTransit} values={{ from: 'Zurich', to: '   ', limit: '6' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))
    rerender(<RuntimeHarness api={swissTransit} values={{ from: 'Zurich', to: 'Geneva', limit: '6.5' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects blank Crossref research queries and fractional result counts before provider execution', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const crossref = api('crossref-works')
    const { rerender } = render(<RuntimeHarness api={crossref} values={{ query: '   ', rows: '8' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))
    rerender(<RuntimeHarness api={crossref} values={{ query: 'agentic AI', rows: '8.5' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects fractional Open-Meteo Seasonal forecast days before provider execution', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<RuntimeHarness api={api('open-meteo-seasonal')} values={{ latitude: '1.3521', longitude: '103.8198', forecastDays: '42.5' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))

    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects fractional Open-Meteo Ensemble forecast days before provider execution', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<RuntimeHarness api={api('open-meteo-ensemble')} values={{ latitude: '1.3521', longitude: '103.8198', variable: 'temperature_2m', forecastDays: '3.5' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))

    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects fractional Open Trivia question counts before provider execution', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<RuntimeHarness api={api('open-trivia')} values={{ amount: '6.5', category: '9', difficulty: 'medium' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))

    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects blank, fractional, and out-of-range Art Institute inputs before provider execution', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const art = api('art-institute-search')
    const { rerender } = render(<RuntimeHarness api={art} values={{ query: '   ', limit: '8' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))
    rerender(<RuntimeHarness api={art} values={{ query: 'monet', limit: '2.5' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))
    rerender(<RuntimeHarness api={art} values={{ query: 'monet', limit: '21' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'idle'))

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('captures an image response body once and exposes a revocable object URL for semantic rendering', async () => {
    const qr = api('qr-code-generator')
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:public-api-qr-1').mockReturnValueOnce('blob:public-api-qr-2')
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(new Blob(['png-bytes'], { type: 'image/png' }), {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    })))
    vi.stubGlobal('fetch', fetchMock)

    const { unmount } = render(<RuntimeHarness api={qr} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))

    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'success'))
    const state = screen.getByTestId('request-state')
    expect(state).toHaveAttribute('data-response-media-url', 'blob:public-api-qr-1')
    expect(state).toHaveAttribute('data-response-media-type', 'image/png')
    expect(state).toHaveTextContent('\"kind\":\"image\"')
    expect(state).toHaveTextContent('\"contentType\":\"image/png\"')
    expect(createObjectUrl).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ Accept: 'image/png' })

    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(state).toHaveAttribute('data-response-media-url', 'blob:public-api-qr-2'))
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:public-api-qr-1')
    expect(createObjectUrl).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    unmount()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:public-api-qr-2')
  })

  it('fails image-response APIs closed when HTTP 2xx returns a non-image body', async () => {
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('upstream HTML', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })))

    render(<RuntimeHarness api={api('dicebear-avatar')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))

    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'error'))
    expect(screen.getByTestId('request-state')).toHaveAttribute('data-error-type', 'invalid-response')
    expect(screen.getByTestId('request-state')).toHaveAttribute('data-http-status', '200')
    expect(screen.getByTestId('request-state')).toHaveTextContent('Content-Type text/html, expected image/svg+xml')
    expect(createObjectUrl).not.toHaveBeenCalled()
  })

  it('classifies browser fetch TypeError as network-or-cors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    render(<RuntimeHarness api={api('countries')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))

    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'error'))
    expect(screen.getByTestId('request-state')).toHaveAttribute('data-error-type', 'network-or-cors')
    expect(screen.getByTestId('request-state')).toHaveTextContent('Failed to fetch')
  })

  it('fails closed when HTTP 2xx violates an ordinary JSON response contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>temporary provider page</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })))

    render(<RuntimeHarness api={api('countries')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))

    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'error'))
    expect(screen.getByTestId('request-state')).toHaveAttribute('data-error-type', 'invalid-response')
    expect(screen.getByTestId('request-state')).toHaveAttribute('data-http-status', '200')
    expect(screen.getByTestId('request-state')).toHaveTextContent('could not be parsed as expected')
  })

  it('maps a provider-declared 204 no-content response to API-specific semantic empty data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    render(<RuntimeHarness api={api('worms-species-lookup')} values={{ name: 'DefinitelyNotARealMarineTaxonXYZ' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))

    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'success'))
    expect(screen.getByTestId('request-state')).toHaveAttribute('data-http-status', '204')
    expect(screen.getByTestId('request-state')).toHaveTextContent('[]')
  })

  it('keeps undeclared empty JSON success responses fail-closed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    render(<RuntimeHarness api={api('countries')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))

    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'error'))
    expect(screen.getByTestId('request-state')).toHaveAttribute('data-error-type', 'invalid-response')
    expect(screen.getByTestId('request-state')).toHaveAttribute('data-http-status', '204')
  })

  it('accepts a declared text response Content-Type with charset parameters', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('v1.0.0\nv1.1.0\n', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
    })))

    render(<RuntimeHarness api={api('go-module-proxy')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))

    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'success'))
    expect(screen.getByTestId('request-state')).toHaveTextContent('v1.0.0')
    expect(screen.getByTestId('request-state')).toHaveTextContent('v1.1.0')
  })

  it('fails text-response APIs closed when HTTP 2xx returns an undeclared HTML media type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>temporary provider page</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })))

    render(<RuntimeHarness api={api('go-module-proxy')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))

    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'error'))
    expect(screen.getByTestId('request-state')).toHaveAttribute('data-error-type', 'invalid-response')
    expect(screen.getByTestId('request-state')).toHaveAttribute('data-http-status', '200')
    expect(screen.getByTestId('request-state')).toHaveTextContent('Content-Type text/html, expected text/plain')
    expect(screen.getByTestId('request-state')).not.toHaveTextContent('temporary provider page')
  })

  it('classifies HTTP failure before invoking an explicit non-JSON response parser', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('temporary upstream failure', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' },
    })))

    render(<RuntimeHarness api={api('go-module-proxy')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))

    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'error'))
    expect(screen.getByTestId('request-state')).toHaveAttribute('data-error-type', 'provider-unavailable')
    expect(screen.getByTestId('request-state')).toHaveAttribute('data-http-status', '503')
    expect(screen.getByTestId('request-state')).toHaveTextContent('503 Service Unavailable')
  })

  it('turns a stalled request into the deterministic 20-second timeout state', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      if (!signal) return reject(new Error('Missing AbortSignal'))
      signal.addEventListener('abort', () => reject(new DOMException('The user aborted a request.', 'AbortError')), { once: true })
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(<RuntimeHarness api={api('countries')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'loading')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1)
    })

    expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'error')
    expect(screen.getByTestId('request-state')).toHaveAttribute('data-error-type', 'timeout')
    expect(screen.getByTestId('request-state')).toHaveTextContent('The request timed out after 20 seconds.')
  })

  it('aborts a superseded request and prevents stale data from replacing the newer result', async () => {
    let firstSignal: AbortSignal | undefined
    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      if (fetchMock.mock.calls.length === 1) {
        firstSignal = init?.signal ?? undefined
        return new Promise<Response>((_resolve, reject) => {
          firstSignal?.addEventListener('abort', () => reject(firstSignal?.reason ?? new DOMException('Aborted', 'AbortError')), { once: true })
        })
      }
      return Promise.resolve(new Response(JSON.stringify([{ page: 1 }, [{ id: 'MYS', name: 'Malaysia' }]]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const countries = api('countries')
    const { rerender } = render(<RuntimeHarness api={countries} values={{ code: 'SG' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    rerender(<RuntimeHarness api={countries} values={{ code: 'MY' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(firstSignal?.aborted).toBe(true)
    await waitFor(() => expect(screen.getByTestId('request-state')).toHaveAttribute('data-status', 'success'))
    expect(screen.getByTestId('request-state')).toHaveTextContent('Malaysia')
    expect(screen.getByTestId('request-state')).not.toHaveTextContent('Singapore')
  })

  it('aborts an active request when the owning UI unmounts', async () => {
    let signal: AbortSignal | undefined
    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal?.reason ?? new DOMException('Aborted', 'AbortError')), { once: true })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { unmount } = render(<RuntimeHarness api={api('countries')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run request' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    unmount()
    expect(signal?.aborted).toBe(true)
  })
})
