export type RequestTransform =
  | 'uppercase'
  | 'lowercase'
  | 'trim'
  | 'form'
  | 'date:YYYYMMDD'
  | 'date:YYYY-MM'
  | { map: Record<string, string> }
  | 'omitIfEmpty'
  | { join: string }

export type DeclarativeRequestSpec = {
  declarative: true
  method: 'GET' | 'POST'
  urlTemplate: string
  hosts: string[]
  headers?: Record<string, string>
  body?: unknown
  transforms?: Record<string, RequestTransform>
  responseTransform: 'json' | 'csv' | 'xml' | 'text' | 'image-url'
}

export type NonDeclarativeRequest = { declarative: false; reason: string }
export type BuiltRequest = { method: 'GET' | 'POST'; url: string; headers: Record<string, string>; body?: unknown }
const transformValue = (value: string, transform: RequestTransform): string | undefined => {
  if (transform === 'omitIfEmpty') return value === '' ? undefined : value
  if (transform === 'uppercase') return value.toUpperCase()
  if (transform === 'lowercase') return value.toLowerCase()
  if (transform === 'trim') return value.trim()
  if (transform === 'form') return value.trim()
  if (transform === 'date:YYYYMMDD') return value.replaceAll('-', '')
  if (transform === 'date:YYYY-MM') return value.slice(0, 7)
  if (typeof transform === 'object' && 'map' in transform) return transform.map[value]
  if (typeof transform === 'object' && 'join' in transform) return value.split(',').join(transform.join)
  return value
}

const encode = (value: string): string => encodeURIComponent(value)

const encodeQueryValue = (name: string, value: string, spec: DeclarativeRequestSpec): string =>
  spec.transforms?.[name] === 'form'
    ? new URLSearchParams({ value }).toString().slice('value='.length)
    : encode(value)

export const buildRequestFromSpec = (
  spec: DeclarativeRequestSpec,
  params: Record<string, string>,
): BuiltRequest => {
  const valueFor = (name: string): string | undefined => {
    const raw = params[name] ?? ''
    const transform = spec.transforms?.[name]
    return transform ? transformValue(raw, transform) : raw
  }
  const render = (template: string): string => template.replace(/\{([?&]?)([^{}]+)\}/g, (_match, operator: string, names: string, offset: number) => {
    const values = names.split(',').flatMap((name) => {
      const value = valueFor(name)
      return value === undefined ? [] : [[name, value] as const]
    })
    if (operator === '?') return values.length ? `?${values.map(([name, value]) => `${encode(name)}=${encodeQueryValue(name, value, spec)}`).join('&')}` : ''
    if (operator === '&') return values.length ? `&${values.map(([name, value]) => `${encode(name)}=${encodeQueryValue(name, value, spec)}`).join('&')}` : ''
    if (names.includes(',')) throw new Error('Simple URI-template expressions accept one variable.')
    const value = valueFor(names)
    if (value === undefined) return ''
    const prefix = template.slice(0, offset)
    const queryValue = prefix.includes('?') && prefix.lastIndexOf('=') > prefix.lastIndexOf('&')
    return queryValue ? encodeQueryValue(names, value, spec) : encode(value)
  })
  const body = spec.body === undefined ? undefined : JSON.parse(JSON.stringify(spec.body), (_key, value: unknown) => {
    if (typeof value !== 'string') return value
    return value.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_match, name: string) => valueFor(name) ?? '')
  })
  return {
    method: spec.method,
    url: render(spec.urlTemplate),
    headers: { ...(spec.headers ?? {}) },
    ...(body === undefined ? {} : { body }),
  }
}
