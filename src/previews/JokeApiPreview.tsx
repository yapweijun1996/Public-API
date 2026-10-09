import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { cleanText } from './previewData'
import { isRecord, nonNegativeSafeInteger } from './semanticValidation'

type JokeRequest = { category: string; type: 'single' | 'twopart' }
type JokeModel = {
  state: 'ready' | 'invalid'
  reason: string
  requestBound: boolean
  request?: JokeRequest
  providerCategory?: string
  providerType?: string
  providerId?: number
  providerLanguage?: string
  safeFlags: boolean
  setup?: string
  delivery?: string
  joke?: string
}

const JOKE_API_ORIGIN = 'https://v2.jokeapi.dev'
const FLAG_KEYS = ['nsfw', 'religious', 'political', 'racist', 'sexist', 'explicit'] as const

const fieldOptionValues = (api: ApiDemo, fieldId: string) => api.fields.find((field) => field.id === fieldId)?.options?.map((option) => option.value) ?? []

const parseRequestUrl = (api: ApiDemo, value?: string): JokeRequest | undefined => {
  if (api.id !== 'jokeapi-safe' || !value) return undefined
  try {
    const url = new URL(value)
    if (url.origin !== JOKE_API_ORIGIN || url.username || url.password || url.port || url.hash) return undefined
    const pathMatch = /^\/joke\/([^/]+)$/.exec(url.pathname)
    if (!pathMatch) return undefined
    const category = decodeURIComponent(pathMatch[1])
    const type = url.searchParams.get('type')
    const entries = [...url.searchParams.entries()]
    const allowedKeys = ['safe-mode', 'type', 'amount'] as const
    if (entries.length !== allowedKeys.length) return undefined
    if (allowedKeys.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    if (entries.some(([key]) => !allowedKeys.includes(key as typeof allowedKeys[number]))) return undefined
    if (url.searchParams.get('safe-mode') !== '' || url.searchParams.get('amount') !== '1') return undefined
    if (!fieldOptionValues(api, 'category').includes(category) || !fieldOptionValues(api, 'type').includes(type ?? '')) return undefined
    if (type !== 'single' && type !== 'twopart') return undefined
    const request: JokeRequest = { category, type }
    return api.buildUrl({ category, type }) === value ? request : undefined
  } catch {
    return undefined
  }
}

const bindRequest = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext) => {
  const request = parseRequestUrl(api, requestUrl)
  if (!request || !requestUrl || !executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, requestBound: false as const }
  }
  const executed = parseRequestUrl(api, executedRequest.url)
  return { request, requestBound: Boolean(executed && executed.category === request.category && executed.type === request.type) }
}

const parseSafeFlags = (value: unknown): boolean => {
  if (!isRecord(value)) return false
  return FLAG_KEYS.every((key) => value[key] === false)
}

export const buildJokeApiModel = (api: ApiDemo, data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): JokeModel => {
  const identity = bindRequest(api, requestUrl, executedRequest)
  const base = { requestBound: identity.requestBound, request: identity.request, safeFlags: false }
  if (!identity.requestBound || !identity.request) return { ...base, state: 'invalid', reason: 'missing-or-mismatched-request-evidence' }
  if (!isRecord(data) || typeof data.error !== 'boolean') return { ...base, state: 'invalid', reason: 'invalid-response-envelope' }
  if (data.error) return { ...base, state: 'invalid', reason: 'provider-error' }

  const providerCategory = cleanText(data.category)
  const providerType = cleanText(data.type)
  const providerId = nonNegativeSafeInteger(data.id)
  const providerLanguage = cleanText(data.lang)
  const safeFlags = parseSafeFlags(data.flags)
  const common = { ...base, providerCategory, providerType, providerId, providerLanguage, safeFlags }

  if (providerCategory !== identity.request.category || providerType !== identity.request.type) {
    return { ...common, state: 'invalid', reason: 'provider-request-identity-mismatch' }
  }
  if (data.safe !== true || !safeFlags) return { ...common, state: 'invalid', reason: 'unsafe-or-unverified-joke' }
  if (providerId === undefined || !providerLanguage) return { ...common, state: 'invalid', reason: 'invalid-joke-identity' }

  if (identity.request.type === 'twopart') {
    const setup = cleanText(data.setup)
    const delivery = cleanText(data.delivery)
    if (!setup || !delivery) return { ...common, state: 'invalid', reason: 'invalid-twopart-content' }
    return { ...common, setup, delivery, state: 'ready', reason: 'trusted-safe-twopart-joke' }
  }

  const joke = cleanText(data.joke)
  if (!joke) return { ...common, state: 'invalid', reason: 'invalid-single-content' }
  return { ...common, joke, state: 'ready', reason: 'trusted-safe-single-joke' }
}

export function JokeApiPreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = buildJokeApiModel(api, data, requestUrl, executedRequest)
  const attrs = {
    'data-domain-card': 'jokeapi-safe',
    'data-result-state': model.state,
    'data-result-reason': model.reason,
    'data-request-bound': String(model.requestBound),
    'data-request-contract': 'exact-jokeapi-safe-bodyless-get',
    'data-requested-category': model.request?.category,
    'data-requested-type': model.request?.type,
    'data-provider-category': model.providerCategory,
    'data-provider-type': model.providerType,
    'data-provider-id': model.providerId,
    'data-provider-language': model.providerLanguage,
    'data-safe-flags': String(model.safeFlags),
  }

  if (model.state === 'invalid') {
    const safetyFailure = model.reason === 'unsafe-or-unverified-joke'
    return <section className="weather-empty" aria-label="JokeAPI safe joke evidence" {...attrs}><strong>Safe joke response not trusted</strong><span>{safetyFailure ? 'JokeAPI did not provide complete safe-mode moderation evidence, so the joke content is withheld.' : 'The successful response was not bound to the exact supported safe-mode JokeAPI request or contradicted its requested category/type contract.'}</span></section>
  }

  const twoPart = model.request?.type === 'twopart'
  return <section className="trivia-preview" aria-label="JokeAPI safe joke evidence" {...attrs}>
    <div className="trivia-score"><span>Safe joke</span><strong>{model.providerId}</strong><b>{model.providerCategory} · {model.providerType}</b><small>Exact safe-mode request and all provider moderation flags verified.</small></div>
    <div className="trivia-grid" aria-label="Safe joke card"><article><header><span>J</span><div><small>{model.providerCategory} · {model.providerLanguage}</small><h3>{twoPart ? model.setup : model.joke}</h3></div></header>{twoPart ? <ul><li className="correct"><span>A</span>{model.delivery}<b>Punchline</b></li></ul> : null}</article></div>
  </section>
}
