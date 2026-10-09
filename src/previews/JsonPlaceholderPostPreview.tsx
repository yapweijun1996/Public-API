import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty, CardHeading, Facts } from './cardPrimitives'
import { isRecord } from './semanticValidation'

type PostRequest = { postId: number }

type TrustedPost = {
  id: number
  userId?: number
  title?: string
  body?: string
  incomplete: boolean
}

const nonEmptyText = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined
const boundedInteger = (value: unknown, min: number, max: number): number | undefined => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : undefined

const requestedPost = (requestUrl?: string): PostRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'jsonplaceholder.typicode.com' || url.search || url.hash || url.username || url.password) return undefined
    const match = url.pathname.match(/^\/posts\/(\d+)\/?$/)
    if (!match) return undefined
    const postId = Number(match[1])
    if (!Number.isInteger(postId) || postId < 1 || postId > 100) return undefined
    return { postId }
  } catch {
    return undefined
  }
}

const resolvePostRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext) => {
  const displayed = requestedPost(requestUrl)
  if (requestUrl && !displayed) return { request: undefined, valid: false, bound: false } as const
  if (!executedRequest) return { request: displayed, valid: true, bound: false } as const
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined
    || (requestUrl !== undefined && requestUrl !== executedRequest.url)) {
    return { request: undefined, valid: false, bound: false } as const
  }
  const executed = requestedPost(executedRequest.url)
  return executed
    ? { request: executed, valid: true, bound: true } as const
    : { request: undefined, valid: false, bound: false } as const
}

const parsePost = (data: unknown): TrustedPost | undefined => {
  if (!isRecord(data)) return undefined
  const id = boundedInteger(data.id, 1, 100)
  if (!id) return undefined
  const userId = boundedInteger(data.userId, 1, 10)
  const title = nonEmptyText(data.title)
  const body = nonEmptyText(data.body)
  return { id, userId, title, body, incomplete: userId === undefined || title === undefined || body === undefined }
}

const invalid = (title: string, detail: string) => <CardEmpty domain="jsonplaceholder-post" title={title} detail={detail} state="invalid"/>

export function JsonPlaceholderPostPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const transport = resolvePostRequest(requestUrl, executedRequest)
  const request = transport.request
  if (!transport.valid) {
    return invalid('Invalid JSONPlaceholder post request identity', 'The successful response is not bound to the exact supported bodyless GET JSONPlaceholder /posts/{id} request, or the executed request disagrees with the displayed URL.')
  }

  const post = parsePost(data)
  if (!post) {
    return invalid('Invalid JSONPlaceholder post response', 'The HTTP-success payload did not contain a trustworthy provider post identity in the documented 1–100 resource range.')
  }

  if (request && post.id !== request.postId) {
    return invalid('JSONPlaceholder post identity mismatch', `The provider returned post #${post.id}, which does not match the executed request for post #${request.postId}.`)
  }

  const state = transport.bound && request && !post.incomplete ? 'ready' : 'partial'
  const partialReason = !transport.bound
    ? 'The provider post is internally identifiable, but executed-request identity is unavailable, so the result cannot be fully bound to a requested post.'
    : 'The provider post identity matches the request, but one or more documented content or author fields are missing or malformed. Untrusted values are withheld.'

  return <article
    className="domain-card"
    data-domain-card="jsonplaceholder-post"
    data-ssot-reference="posts"
    data-result-state={state}
    data-request-bound={transport.bound ? 'true' : 'false'}
    data-requested-post-id={request?.postId}
    data-provider-post-id={post.id}
    data-identity-match={transport.bound && request ? 'true' : 'unknown'}
    data-author-user-id={post.userId}
    data-content-contract={post.title && post.body ? 'true' : 'false'}
    data-author-contract={post.userId === undefined ? 'false' : 'true'}
  >
    <CardHeading eyebrow="JSONPlaceholder fake REST resource" title={post.title ?? `Post #${post.id}`} description={post.body ?? 'Content unavailable'}/>
    <Facts items={[
      { label: 'Post ID', value: post.id.toLocaleString('en') },
      { label: 'Author user ID', value: post.userId?.toLocaleString('en') ?? 'Unavailable' },
      { label: 'Resource', value: `/posts/${post.id}` },
    ]}/>
    {state === 'partial' && <p className="domain-note">{partialReason}</p>}
  </article>
}
