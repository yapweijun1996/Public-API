export type OptionalValue<T> = { value?: T; malformed: boolean }

export const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

export const trimmedText = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined

export const finiteNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined

export const positiveInteger = (value: unknown): number | undefined => typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined

export const nonNegativeInteger = (value: unknown): number | undefined => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined

export const positiveSafeInteger = (value: unknown): number | undefined => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined

export const nonNegativeSafeInteger = (value: unknown): number | undefined => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined

export const optionalTrimmedText = (value: unknown): OptionalValue<string> => {
  if (value === undefined || value === null) return { malformed: false }
  if (typeof value !== 'string') return { malformed: true }
  const normalized = value.trim()
  return { value: normalized || undefined, malformed: false }
}

export const formatOptionalCount = (value?: number) => value === undefined ? 'Unavailable' : value.toLocaleString('en')

export const isoDateFromEpochSeconds = (epochSeconds?: number) => epochSeconds === undefined ? 'Unavailable' : new Date(epochSeconds * 1000).toISOString().slice(0, 10)

export const exactRequestLimit = (requestUrl: string | undefined, pattern: RegExp, min: number, max: number): number | undefined => {
  const match = requestUrl?.match(pattern)
  if (!match || !/^[1-9]\d*$/.test(match[1] ?? '')) return undefined
  const parsed = Number(match[1])
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : undefined
}

export type ExecutedTransportContext = { url: string; method: string; body?: unknown }
export type ExactGetLimitIdentity =
  | { valid: true; limit: number; transportBound: boolean }
  | { valid: false; transportBound: false }

export const exactBodylessGetRequestLimit = (
  requestUrl: string | undefined,
  executedRequest: ExecutedTransportContext | undefined,
  pattern: RegExp,
  min: number,
  max: number,
): ExactGetLimitIdentity => {
  const displayedLimit = exactRequestLimit(requestUrl, pattern, min, max)
  if (displayedLimit === undefined) return { valid: false, transportBound: false }
  if (!executedRequest) return { valid: true, limit: displayedLimit, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { valid: false, transportBound: false }
  }
  const executedLimit = exactRequestLimit(executedRequest.url, pattern, min, max)
  if (executedLimit !== displayedLimit) return { valid: false, transportBound: false }
  return { valid: true, limit: displayedLimit, transportBound: true }
}
