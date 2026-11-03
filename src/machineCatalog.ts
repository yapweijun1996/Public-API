import type { DeclarativeRequestSpec, NonDeclarativeRequest } from './declarativeRequest'
import { getAgentExecutionPolicy, getApiResponseType, getAutomatedVerificationPolicy, type ApiDemo, type ApiField, type ApiResponseType } from './apiCatalog'

export const MACHINE_CATALOG_SCHEMA_VERSION = 2 as const

export type MachineCatalogParameter = Pick<ApiField, 'id' | 'label' | 'type' | 'defaultValue' | 'help'> & {
  min?: number
  max?: number
  step?: number
  minimumFromField?: string
  minLength?: number
  maxLength?: number
  pattern?: string
  patternDescription?: string
  options?: Array<{ label: string; value: string }>
}

export type MachineCatalogApi = {
  id: string
  name: string
  provider: string
  category: string
  description: string
  keywords?: string[]
  documentationUrl: string
  method: 'GET' | 'POST'
  keyRequired: false
  responseType: ApiResponseType
  responseContentTypes?: string[]
  requestLabUrl: string
  agentExecution: ReturnType<typeof getAgentExecutionPolicy>
  automatedVerification?: ReturnType<typeof getAutomatedVerificationPolicy>
  usageNote?: string
  parameters: MachineCatalogParameter[]
  request: DeclarativeRequestSpec | NonDeclarativeRequest
}

export type MachineCatalog = {
  schemaVersion: typeof MACHINE_CATALOG_SCHEMA_VERSION
  contentHash: string
  catalogCount: number
  catalogPath: string
  requestLabPattern: string
  health: 'not-included'
  automatedVerificationDefault: { mode: 'enabled' }
  apis: MachineCatalogApi[]
}

const normalizeBase = (base: string): string => {
  const withLeadingSlash = base.startsWith('/') ? base : `/${base}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

const exportParameter = ({ id, label, type, defaultValue, help, min, max, step, minimumFromField, minLength, maxLength, pattern, patternDescription, options }: ApiField): MachineCatalogParameter => ({
  id,
  label,
  type,
  defaultValue,
  help,
  ...(min === undefined ? {} : { min }),
  ...(max === undefined ? {} : { max }),
  ...(step === undefined ? {} : { step }),
  ...(minimumFromField === undefined ? {} : { minimumFromField }),
  ...(minLength === undefined ? {} : { minLength }),
  ...(maxLength === undefined ? {} : { maxLength }),
  ...(pattern === undefined ? {} : { pattern }),
  ...(patternDescription === undefined ? {} : { patternDescription }),
  ...(options?.length ? { options: options.map(({ label: optionLabel, value }) => ({ label: optionLabel, value })) } : {}),
})

const fnv1a = (value: string): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export const buildMachineCatalog = (apis: ApiDemo[], base = '/'): MachineCatalog => {
  const catalogPath = normalizeBase(base)
  const catalog = {
    schemaVersion: MACHINE_CATALOG_SCHEMA_VERSION,
    catalogCount: apis.length,
    catalogPath,
    requestLabPattern: `${catalogPath}#/request-lab?api={api-id}`,
    health: 'not-included' as const,
    automatedVerificationDefault: { mode: 'enabled' as const },
    apis: apis.map((api) => ({
      id: api.id,
      name: api.name,
      provider: api.provider,
      category: api.category,
      description: api.description,
      ...(api.keywords?.length ? { keywords: [...api.keywords] } : {}),
      documentationUrl: api.documentationUrl,
      method: api.method ?? 'GET',
      keyRequired: false as const,
      responseType: getApiResponseType(api),
      ...(api.responseContentTypes?.length ? { responseContentTypes: [...api.responseContentTypes] } : {}),
      requestLabUrl: `${catalogPath}#/request-lab?api=${encodeURIComponent(api.id)}`,
      agentExecution: getAgentExecutionPolicy(api),
      ...(api.automatedVerification ? { automatedVerification: getAutomatedVerificationPolicy(api) } : {}),
      ...(api.usageNote ? { usageNote: api.usageNote } : {}),
      request: api.request ?? { declarative: false as const, reason: 'Request construction uses custom repository JavaScript and has not been expressed as a closed declarative template.' },
      parameters: api.fields.map(exportParameter),
    })),
  }
  return { ...catalog, contentHash: fnv1a(JSON.stringify(catalog)) }
}
