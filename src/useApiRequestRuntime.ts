import { useCallback, useEffect, useRef, useState } from 'react'
import { getApiResponseType, validateParameters, type ApiDemo } from './apiCatalog'

export type RequestErrorKind = 'rate-limit' | 'provider-unavailable' | 'http-error' | 'network-or-cors' | 'timeout' | 'invalid-response' | 'unknown'

export const REQUEST_TIMEOUT_MS = 20_000

export type ExecutedRequestContext = {
  url: string
  method: string
  body?: unknown
}

export type ResponseMediaContext = {
  objectUrl: string
  contentType: string
}

export type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: unknown; httpStatus: number; elapsed: number; size: number; url: string; executedRequest: ExecutedRequestContext; responseMedia?: ResponseMediaContext; runId: number }
  | { status: 'error'; message: string; url: string; errorType: RequestErrorKind; httpStatus?: number }

type RequestRuntimeOptions = {
  onRunStart: (api: ApiDemo, parameters: Record<string, string>) => void
  preloadResponsePreview?: () => unknown
}

const normalizeContentType = (value: string | null): string => (value ?? '').split(';', 1)[0].trim().toLowerCase()

const requireDeclaredContentType = (api: ApiDemo, response: Response): string => {
  const contentType = normalizeContentType(response.headers.get('content-type'))
  const accepted = api.responseContentTypes?.map((value) => normalizeContentType(value)).filter(Boolean) ?? []
  if (!accepted.length || accepted.includes(contentType)) return contentType
  const error = new Error(`The API returned a successful HTTP response with Content-Type ${contentType || '(missing)'}, expected ${accepted.join(' or ')}.`) as Error & { httpStatus: number; errorType: RequestErrorKind }
  error.httpStatus = response.status
  error.errorType = 'invalid-response'
  throw error
}

async function fetchApi(api: ApiDemo, parameters: Record<string, string>, signal?: AbortSignal) {
  const url = api.buildUrl(parameters)
  const method = api.method ?? 'GET'
  const body = api.buildBody?.(parameters)
  const executedRequest: ExecutedRequestContext = { url, method, ...(body === undefined ? {} : { body }) }
  const isForm = api.bodyEncoding === 'form'
  const started = performance.now()
  const requestHeaders = {
    Accept: 'application/json',
    ...(api.headers ?? {}),
    ...(body === undefined ? {} : { 'Content-Type': isForm ? 'application/x-www-form-urlencoded' : 'application/json' }),
  }
  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    signal,
    ...(body === undefined ? {} : { body: isForm ? new URLSearchParams(body as Record<string, string>).toString() : JSON.stringify(body) }),
  })
  if (!response.ok) {
    const error = new Error(`The API returned ${response.status} ${response.statusText}.`) as Error & { httpStatus: number; errorType: RequestErrorKind }
    error.httpStatus = response.status
    error.errorType = response.status === 429 ? 'rate-limit' : response.status >= 500 ? 'provider-unavailable' : 'http-error'
    throw error
  }

  const responseType = getApiResponseType(api)
  const contentType = responseType === 'json' ? '' : requireDeclaredContentType(api, response)

  if (responseType === 'image') {
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    return {
      data: { kind: 'image', contentType, bytes: blob.size },
      httpStatus: response.status,
      elapsed: Math.round(performance.now() - started),
      size: blob.size,
      url,
      executedRequest,
      responseMedia: { objectUrl, contentType },
    }
  }

  const text = await response.text()
  let data: unknown
  const declaredNoContent = text.trim() === '' && api.successNoContent?.statuses.includes(response.status)
  try {
    data = declaredNoContent ? api.successNoContent?.data : api.parseResponse ? api.parseResponse(text) : JSON.parse(text) as unknown
  } catch (cause) {
    const error = new Error('The API returned a successful HTTP response that could not be parsed as expected.', { cause }) as Error & { httpStatus: number; errorType: RequestErrorKind }
    error.httpStatus = response.status
    error.errorType = 'invalid-response'
    throw error
  }
  return { data, httpStatus: response.status, elapsed: Math.round(performance.now() - started), size: new Blob([text]).size, url, executedRequest }
}

const classifyRequestError = (error: unknown, abortReason?: unknown): { message: string; errorType: RequestErrorKind; httpStatus?: number } => {
  const candidate = typeof error === 'object' && error !== null
    ? error as { name?: string; message?: string; httpStatus?: number; errorType?: RequestErrorKind }
    : undefined
  const reasonCandidate = typeof abortReason === 'object' && abortReason !== null
    ? abortReason as { name?: string }
    : undefined
  const httpStatus = candidate?.httpStatus
  const isTimeout = candidate?.name === 'TimeoutError' || reasonCandidate?.name === 'TimeoutError'
  const errorType = candidate?.errorType
    ?? (isTimeout ? 'timeout' : error instanceof TypeError ? 'network-or-cors' : 'unknown')
  const message = isTimeout ? `The request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.` : candidate?.message ?? 'The request failed.'
  return { message, errorType, ...(httpStatus === undefined ? {} : { httpStatus }) }
}

export function useApiRequestRuntime({ onRunStart, preloadResponsePreview }: RequestRuntimeOptions) {
  const [request, setRequest] = useState<RequestState>({ status: 'idle' })
  const requestRunIdRef = useRef(0)
  const requestAbortRef = useRef<AbortController | null>(null)
  const responseMediaObjectUrlRef = useRef<string | null>(null)

  const releaseResponseMedia = useCallback(() => {
    if (!responseMediaObjectUrlRef.current) return
    URL.revokeObjectURL(responseMediaObjectUrlRef.current)
    responseMediaObjectUrlRef.current = null
  }, [])

  const cancelActiveRequest = useCallback(() => {
    requestRunIdRef.current += 1
    requestAbortRef.current?.abort(new DOMException('Request superseded.', 'AbortError'))
    requestAbortRef.current = null
    releaseResponseMedia()
  }, [releaseResponseMedia])

  const resetRequest = useCallback(() => {
    releaseResponseMedia()
    setRequest({ status: 'idle' })
  }, [releaseResponseMedia])

  const runRequest = useCallback(async (api: ApiDemo, values: Record<string, string>) => {
    const nextErrors = validateParameters(api, values)
    if (Object.keys(nextErrors).length) throw new Error(Object.values(nextErrors).join(' '))
    cancelActiveRequest()
    const runId = requestRunIdRef.current
    const controller = new AbortController()
    requestAbortRef.current = controller
    const timeoutId = window.setTimeout(() => {
      controller.abort(new DOMException('Request timed out.', 'TimeoutError'))
    }, REQUEST_TIMEOUT_MS)
    onRunStart(api, values)
    setRequest({ status: 'loading' })
    void preloadResponsePreview?.()
    try {
      const result = await fetchApi(api, values, controller.signal)
      if (runId === requestRunIdRef.current) {
        if (result.responseMedia) responseMediaObjectUrlRef.current = result.responseMedia.objectUrl
        setRequest({ status: 'success', ...result, runId })
      } else if (result.responseMedia) {
        URL.revokeObjectURL(result.responseMedia.objectUrl)
      }
      return result.data
    } catch (error) {
      if (runId === requestRunIdRef.current) {
        const classified = classifyRequestError(error, controller.signal.reason)
        setRequest({ status: 'error', ...classified, url: api.buildUrl(values) })
      }
      throw error
    } finally {
      window.clearTimeout(timeoutId)
      if (requestAbortRef.current === controller) requestAbortRef.current = null
    }
  }, [cancelActiveRequest, onRunStart, preloadResponsePreview])

  useEffect(() => () => cancelActiveRequest(), [cancelActiveRequest])

  return { request, runRequest, cancelActiveRequest, resetRequest }
}
