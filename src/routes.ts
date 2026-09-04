export const REQUEST_LAB_PATH = '/request-lab'

export const readHashPath = (hash = window.location.hash): string => {
  const raw = hash.replace(/^#/, '')
  return raw.split('?', 1)[0] ?? ''
}

export const readRequestLabApiId = (hash = window.location.hash): string | undefined => {
  const raw = hash.replace(/^#/, '')
  const separator = raw.indexOf('?')
  if (separator < 0 || raw.slice(0, separator) !== REQUEST_LAB_PATH) return undefined
  const apiId = new URLSearchParams(raw.slice(separator + 1)).get('api')?.trim()
  return apiId || undefined
}

export const buildRequestLabHash = (apiId: string): string =>
  `#${REQUEST_LAB_PATH}?api=${encodeURIComponent(apiId)}`

export const buildRequestLabUrl = (apiId: string): string =>
  new URL(`${import.meta.env.BASE_URL}${buildRequestLabHash(apiId)}`, window.location.origin).toString()
