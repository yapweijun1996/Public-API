import { useEffect, useState } from 'react'
import { apiCatalog, getApiById, getDefaultParameters, type ApiDemo } from './apiCatalog'

type ToolInput = Record<string, unknown>

type ModelContextTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: {
    readOnlyHint?: boolean
    untrustedContentHint?: boolean
  }
  execute: (input: ToolInput) => Promise<unknown> | unknown
}

type ModelContext = {
  registerTool: (
    tool: ModelContextTool,
    options?: { signal?: AbortSignal },
  ) => Promise<void>
}

type WebMcpDocument = Document & {
  modelContext?: ModelContext
}

export type WebMcpStatus = 'checking' | 'ready' | 'unsupported' | 'error'
export type AdminSection = 'catalog' | 'request-lab' | 'agent-tools'

type UseWebMcpOptions = {
  onSelectApi: (id: string) => void
  onRunApi: (api: ApiDemo, parameters: Record<string, string>) => Promise<unknown>
  onNavigate: (section: AdminSection) => void
  onFilter: (query: string, category: string) => void
}

const stringParameters = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      if (typeof item === 'string' || typeof item === 'number') {
        return [[key, String(item)]]
      }
      return []
    }),
  )
}

export function useWebMcp({
  onSelectApi,
  onRunApi,
  onNavigate,
  onFilter,
}: UseWebMcpOptions): WebMcpStatus {
  const [status, setStatus] = useState<WebMcpStatus>('checking')

  useEffect(() => {
    const modelContext = (document as WebMcpDocument).modelContext
    if (!modelContext) {
      setStatus('unsupported')
      return
    }

    const controller = new AbortController()
    const tools: ModelContextTool[] = [
      {
        name: 'list_public_api_demos',
        description: 'List the public API demos available on this page and their required parameters.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: () => ({
          demos: apiCatalog.map((api) => ({
            id: api.id,
            name: api.name,
            provider: api.provider,
            description: api.description,
            parameters: api.fields.map(({ id, label, type, defaultValue }) => ({
              id,
              label,
              type,
              defaultValue,
            })),
          })),
        }),
      },
      {
        name: 'navigate_api_console',
        description: 'Navigate the visible API admin console to the catalog, request lab, or agent tools section.',
        inputSchema: {
          type: 'object',
          properties: {
            section: {
              type: 'string',
              enum: ['catalog', 'request-lab', 'agent-tools'],
              description: 'The admin console section to show to the user.',
            },
          },
          required: ['section'],
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: ({ section }) => {
          if (section !== 'catalog' && section !== 'request-lab' && section !== 'agent-tools') {
            throw new Error('Unknown admin console section.')
          }
          onNavigate(section)
          return { visibleSection: section }
        },
      },
      {
        name: 'filter_public_api_catalog',
        description: 'Filter the visible public API catalog by search text and optional category.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Text to match against API name, provider, description, or category.',
            },
            category: {
              type: 'string',
              enum: ['All', 'Data', 'Utility', 'People', 'Nature'],
              description: 'Optional catalog category filter.',
            },
          },
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: ({ query, category }) => {
          const safeQuery = typeof query === 'string' ? query : ''
          const safeCategory = typeof category === 'string' ? category : 'All'
          onFilter(safeQuery, safeCategory)
          onNavigate('catalog')
          return { query: safeQuery, category: safeCategory }
        },
      },
      {
        name: 'open_public_api_demo',
        description: 'Open one public API demo in the page explorer using its catalog ID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              enum: apiCatalog.map((api) => api.id),
              description: 'The public API demo ID.',
            },
          },
          required: ['id'],
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: ({ id }) => {
          if (typeof id !== 'string' || !getApiById(id)) {
            throw new Error('Unknown API demo ID.')
          }
          onSelectApi(id)
          return { opened: id }
        },
      },
      {
        name: 'run_public_api_demo',
        description: 'Run one of the page public API demos and return its live JSON response.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              enum: apiCatalog.map((api) => api.id),
              description: 'The public API demo ID.',
            },
            parameters: {
              type: 'object',
              description: 'Optional parameter values. Use list_public_api_demos to discover fields.',
              additionalProperties: { type: ['string', 'number'] },
            },
          },
          required: ['id'],
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async ({ id, parameters }) => {
          if (typeof id !== 'string') {
            throw new Error('API demo ID must be a string.')
          }
          const api = getApiById(id)
          if (!api) {
            throw new Error('Unknown API demo ID.')
          }
          const mergedParameters = {
            ...getDefaultParameters(api),
            ...stringParameters(parameters),
          }
          onSelectApi(api.id)
          return onRunApi(api, mergedParameters)
        },
      },
    ]

    Promise.all(
      tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal })),
    )
      .then(() => setStatus('ready'))
      .catch(() => setStatus('error'))

    return () => controller.abort()
  }, [onFilter, onNavigate, onRunApi, onSelectApi])

  return status
}
