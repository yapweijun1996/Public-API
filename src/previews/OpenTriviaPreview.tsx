import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { cleanText } from './previewData'
import { isRecord } from './semanticValidation'

type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'
type TriviaRequest = { amount: number; category: string; difficulty: string; type: 'multiple' }
type TriviaQuestion = { category: string; difficulty: string; question: string; correctAnswer: string; incorrectAnswers: string[] }
type TriviaModel = {
  state: ResultState
  reason: string
  requestBound: boolean
  request?: TriviaRequest
  providerCount?: number
  questions: TriviaQuestion[]
  invalidCount: number
  responseCode?: number
}

const OPEN_TRIVIA_ORIGIN = 'https://opentdb.com'
const OPEN_TRIVIA_PATH = '/api.php'

const fieldOptionValues = (api: ApiDemo, fieldId: string) => api.fields.find((field) => field.id === fieldId)?.options?.map((option) => option.value) ?? []

const parseCanonicalAmount = (api: ApiDemo, value: string | null) => {
  const field = api.fields.find((candidate) => candidate.id === 'amount')
  if (!field || field.min === undefined || field.max === undefined || !value || !/^[1-9]\d*$/.test(value)) return undefined
  const amount = Number(value)
  return Number.isSafeInteger(amount) && amount >= field.min && amount <= field.max && String(amount) === value ? amount : undefined
}

const parseRequestUrl = (api: ApiDemo, value?: string): TriviaRequest | undefined => {
  if (api.id !== 'open-trivia' || !value) return undefined
  try {
    const url = new URL(value)
    if (url.origin !== OPEN_TRIVIA_ORIGIN || url.pathname !== OPEN_TRIVIA_PATH || url.username || url.password || url.port || url.hash) return undefined
    const entries = [...url.searchParams.entries()]
    const allowedKeys = ['amount', 'category', 'difficulty', 'type'] as const
    if (entries.length !== allowedKeys.length) return undefined
    if (allowedKeys.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    if (entries.some(([key]) => !allowedKeys.includes(key as typeof allowedKeys[number]))) return undefined

    const amount = parseCanonicalAmount(api, url.searchParams.get('amount'))
    const category = url.searchParams.get('category') ?? ''
    const difficulty = url.searchParams.get('difficulty') ?? ''
    const type = url.searchParams.get('type')
    if (amount === undefined || !fieldOptionValues(api, 'category').includes(category) || !fieldOptionValues(api, 'difficulty').includes(difficulty) || type !== 'multiple') return undefined

    const request: TriviaRequest = { amount, category, difficulty, type }
    return api.buildUrl({ amount: String(amount), category, difficulty }) === value ? request : undefined
  } catch {
    return undefined
  }
}

const bindRequest = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext) => {
  const request = parseRequestUrl(api, requestUrl)
  if (!request || !requestUrl || !executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) return { request, requestBound: false as const }
  const executed = parseRequestUrl(api, executedRequest.url)
  const requestBound = Boolean(executed
    && executed.amount === request.amount
    && executed.category === request.category
    && executed.difficulty === request.difficulty
    && executed.type === request.type)
  return { request, requestBound }
}

const parseQuestion = (value: unknown, request: TriviaRequest): TriviaQuestion | undefined => {
  if (!isRecord(value) || value.type !== 'multiple' || value.difficulty !== request.difficulty) return undefined
  const category = cleanText(value.category)
  const question = cleanText(value.question)
  const correctAnswer = cleanText(value.correct_answer)
  if (!category || !question || !correctAnswer || !Array.isArray(value.incorrect_answers) || value.incorrect_answers.length !== 3) return undefined
  const incorrectAnswers = value.incorrect_answers.map(cleanText)
  if (!incorrectAnswers.every((answer): answer is string => Boolean(answer))) return undefined
  const answers = [correctAnswer, ...incorrectAnswers]
  if (new Set(answers).size !== answers.length) return undefined
  return { category, difficulty: request.difficulty, question, correctAnswer, incorrectAnswers }
}

const responseCodeReason: Record<number, string> = {
  1: 'provider-no-results',
  2: 'provider-invalid-parameter',
  3: 'provider-token-not-found',
  4: 'provider-token-empty',
  5: 'provider-rate-limit',
}

export const buildOpenTriviaModel = (api: ApiDemo, data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): TriviaModel => {
  const identity = bindRequest(api, requestUrl, executedRequest)
  const base = { requestBound: identity.requestBound, request: identity.request, questions: [], invalidCount: 0 }
  if (!identity.requestBound || !identity.request) return { ...base, state: 'invalid', reason: 'missing-or-mismatched-request-evidence' }
  if (!isRecord(data) || typeof data.response_code !== 'number' || !Number.isInteger(data.response_code)) return { ...base, state: 'invalid', reason: 'invalid-response-envelope' }
  const responseCode = data.response_code
  if (responseCode !== 0) {
    if (responseCode === 1) return { ...base, responseCode, state: 'empty', reason: responseCodeReason[responseCode] }
    return { ...base, responseCode, state: 'invalid', reason: responseCodeReason[responseCode] ?? 'unknown-provider-response-code' }
  }
  if (!Array.isArray(data.results)) return { ...base, responseCode, state: 'invalid', reason: 'invalid-results-envelope' }
  const providerCount = data.results.length
  if (providerCount > identity.request.amount) return { ...base, responseCode, providerCount, invalidCount: providerCount, state: 'invalid', reason: 'provider-count-exceeds-request' }
  if (providerCount === 0) return { ...base, responseCode, providerCount, state: 'empty', reason: 'request-bound-empty-success' }

  const questions: TriviaQuestion[] = []
  let invalidCount = 0
  for (const value of data.results) {
    const question = parseQuestion(value, identity.request)
    if (!question) invalidCount += 1
    else questions.push(question)
  }
  if (!questions.length) return { ...base, responseCode, providerCount, invalidCount, state: 'invalid', reason: 'no-trustworthy-questions' }
  return {
    ...base,
    responseCode,
    providerCount,
    questions,
    invalidCount,
    state: invalidCount ? 'partial' : 'ready',
    reason: invalidCount ? 'partial-question-evidence' : 'trusted-question-deck',
  }
}

const providerStatusMessage = (reason: string) => {
  if (reason === 'provider-no-results') return 'Open Trivia DB reported no results for this exact request.'
  if (reason === 'provider-invalid-parameter') return 'Open Trivia DB rejected one or more request parameters.'
  if (reason === 'provider-token-not-found') return 'Open Trivia DB reported an invalid session token.'
  if (reason === 'provider-token-empty') return 'Open Trivia DB reported that the session token has no unused questions left.'
  if (reason === 'provider-rate-limit') return 'Open Trivia DB rate-limited the request; wait before trying again.'
  return 'Open Trivia DB returned an unsupported response code.'
}

export function OpenTriviaPreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = buildOpenTriviaModel(api, data, requestUrl, executedRequest)
  const attrs = {
    'data-domain-card': 'open-trivia',
    'data-result-state': model.state,
    'data-result-reason': model.reason,
    'data-request-bound': String(model.requestBound),
    'data-request-contract': 'exact-open-trivia-multiple-bodyless-get',
    'data-requested-amount': model.request?.amount,
    'data-requested-category': model.request?.category,
    'data-requested-difficulty': model.request?.difficulty,
    'data-requested-type': model.request?.type,
    'data-provider-response-code': model.responseCode,
    'data-provider-question-count': model.providerCount,
    'data-valid-question-count': model.providerCount === undefined ? undefined : model.questions.length,
    'data-invalid-question-count': model.providerCount === undefined ? undefined : model.invalidCount,
  }

  if (model.state === 'invalid') {
    const providerError = model.responseCode !== undefined && model.responseCode !== 0
    return <section className="weather-empty" aria-label="Open Trivia question evidence" {...attrs}><strong>Trivia response not trusted</strong><span>{providerError ? providerStatusMessage(model.reason) : 'The successful response was not bound to the exact supported Open Trivia request or did not contain trustworthy multiple-choice question evidence.'}</span></section>
  }
  if (model.state === 'empty') {
    return <section className="weather-empty" aria-label="Open Trivia question evidence" {...attrs}><strong>No trivia questions returned</strong><span>{model.reason === 'provider-no-results' ? providerStatusMessage(model.reason) : 'Open Trivia DB returned a request-bound successful response with an empty question list.'}</span></section>
  }

  return <section className="trivia-preview" aria-label="Open Trivia question evidence" {...attrs}>
    <div className="trivia-score"><span>Quiz deck</span><strong>{model.questions.length}</strong><b>trusted {model.questions.length === 1 ? 'question' : 'questions'}</b><small>{model.invalidCount ? `${model.invalidCount} malformed ${model.invalidCount === 1 ? 'question was' : 'questions were'} withheld.` : 'Correct answers are highlighted for this developer demo.'}</small></div>
    <div className="trivia-grid" aria-label="Trivia question cards">{model.questions.map((question, index) => {
      const answers = [question.correctAnswer, ...question.incorrectAnswers]
      return <article key={`${question.question}-${index}`} data-question-difficulty={question.difficulty} data-question-category={question.category}><header><span>{index + 1}</span><div><small>{question.category} · {question.difficulty}</small><h3>{question.question}</h3></div></header><ul>{answers.map((answer, answerIndex) => <li className={answerIndex === 0 ? 'correct' : ''} key={`${answer}-${answerIndex}`}><span>{String.fromCharCode(65 + answerIndex)}</span>{answer}{answerIndex === 0 && <b>Answer</b>}</li>)}</ul></article>
    })}</div>
  </section>
}
