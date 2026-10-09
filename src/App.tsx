import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  apiCategories,
  apiCatalog,
  getDefaultParameters,
  getAgentExecutionPolicy,
  getAutomatedVerificationPolicy,
  getApiById,
  getApiResponseType,
  matchesApiSearch,
  validateParameters,
  type ApiCategory,
  type ApiDemo,
  type ApiField,
} from './apiCatalog'
import { useWebMcp, WEBMCP_TOOL_COUNT, WEBMCP_TOOL_UI_LIST, type AdminSection } from './webmcp'
import { buildRequestLabHash, readHashPath, readRequestLabApiId } from './routes'
import { useModalFocusTrap } from './useModalFocusTrap'
import { useApiRequestRuntime } from './useApiRequestRuntime'
import { PreviewLoadBoundary } from './PreviewLoadBoundary'
import { readUiLocale, uiLocaleOptions, uiText, UI_LOCALE_STORAGE_KEY, type UiMessageKey } from './i18n'

const loadResponsePreview = () => import('./responsePreview')
const LazyResponseDemoPreview = lazy(() => loadResponsePreview().then(({ ResponseDemoPreview }) => ({ default: ResponseDemoPreview })))

type AdminPage =
  | 'overview'
  | 'catalog'
  | 'collections'
  | 'providers'
  | 'tags'
  | 'request-lab'
  | 'agent-tools'
  | 'health'
  | 'documentation'

type SupportingPage = 'collections' | 'providers' | 'tags' | 'health' | 'documentation'

type IconName =
  | 'activity'
  | 'agent'
  | 'alert'
  | 'api'
  | 'arrow'
  | 'book'
  | 'box'
  | 'check'
  | 'chevron'
  | 'code'
  | 'copy'
  | 'database'
  | 'external'
  | 'filter'
  | 'grid'
  | 'help'
  | 'home'
  | 'link'
  | 'menu'
  | 'play'
  | 'search'
  | 'shield'
  | 'spark'
  | 'x'

const categories: Array<'All' | ApiCategory> = ['All', ...apiCategories]

const paths: Record<IconName, React.ReactNode> = {
  activity: <><path d="M3 12h4l2-7 4 14 2-7h6" /></>,
  agent: <><rect x="4" y="7" width="16" height="12" rx="3" /><path d="M9 12h.01M15 12h.01M9 16h6M12 7V3M10 3h4" /></>,
  alert: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  api: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
  box: <><path d="m21 8-9 5-9-5 9-5 9 5Z" /><path d="m3 8 9 5 9-5v8l-9 5-9-5V8Z" /><path d="M12 13v8" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  code: <><path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" /></>,
  copy: <><rect width="13" height="13" x="8" y="8" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></>,
  external: <><path d="M15 3h6v6M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
  filter: <path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.5 2.5 0 1 1 4.7 1.2c-.8 1.1-2.4 1.2-2.4 3M12 17h.01" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  play: <path d="m8 5 11 7-11 7V5Z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
  spark: <><path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3Z" /><path d="m5 14-.9 2.1L2 17l2.1.9L5 20l.9-2.1L8 17l-2.1-.9L5 14Z" /></>,
  x: <path d="M18 6 6 18M6 6l12 12" />,
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

const formatBytes = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
const codeSample = (api: ApiDemo, parameters: Record<string, string>) => {
  const url = api.buildUrl(parameters)
  const method = api.method ?? DEFAULT_HTTP_METHOD
  const body = api.buildBody?.(parameters)
  const isForm = api.bodyEncoding === 'form'
  const sampleHeaders = JSON.stringify(
    {
      Accept: 'application/json',
      ...(api.headers ?? {}),
      ...(body === undefined ? {} : { 'Content-Type': isForm ? 'application/x-www-form-urlencoded' : 'application/json' }),
    },
    null,
    2,
  ).slice(2, -2)
  const options = [
    `  method: '${method}',`,
    `  headers: { ${sampleHeaders} },`,
    ...(body === undefined ? [] : isForm ? [`  body: new URLSearchParams(${JSON.stringify(body)}).toString(),`] : [`  body: JSON.stringify(${JSON.stringify(body, null, 2).replace(/\n/g, '\n  ')}),`]),
  ].join('\n')
  const responseType = getApiResponseType(api)
  const contentTypeGuard = api.responseContentTypes?.length
    ? `const contentType = (response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();\nconst acceptedContentTypes = ${JSON.stringify(api.responseContentTypes.map((value) => value.toLowerCase()))};\nif (!acceptedContentTypes.includes(contentType)) throw new Error(\`Expected response Content-Type: ${api.responseContentTypes.join(' or ')}.\`);\n`
    : ''
  const parse = responseType === 'image'
    ? `${contentTypeGuard}const data = await response.blob();`
    : responseType === 'text'
      ? `${contentTypeGuard}const data = await response.text();`
      : api.successNoContent
        ? `const text = await response.text();\nconst data = ${JSON.stringify(api.successNoContent.statuses)}.includes(response.status) && text.trim() === ''\n  ? ${JSON.stringify(api.successNoContent.data)}\n  : JSON.parse(text);`
        : 'const data = await response.json();'
  return `const response = await fetch('${url}', {\n${options}\n});\n\n${parse}`
}

const sidebarPreferenceKey = 'api-console.sidebar-collapsed'

const DEFAULT_HTTP_METHOD: NonNullable<ApiDemo['method']> = 'GET'
const DEFAULT_RISK: NonNullable<ApiDemo['risk']> = 'Low'
const KEYLESS_TAG_LABEL = 'no-key'
const MACHINE_CATALOG_URL = `${import.meta.env.BASE_URL}api-catalog.json`
const CATALOG_PAGE_SIZE = 50

const pageMeta: Record<AdminPage, { titleKey: UiMessageKey; subtitleKey: UiMessageKey; path: string }> = {
  overview: { titleKey: 'page.overview.title', subtitleKey: 'page.overview.subtitle', path: '/overview' },
  catalog: { titleKey: 'page.catalog.title', subtitleKey: 'page.catalog.subtitle', path: '/catalog' },
  collections: { titleKey: 'page.collections.title', subtitleKey: 'page.collections.subtitle', path: '/collections' },
  providers: { titleKey: 'page.providers.title', subtitleKey: 'page.providers.subtitle', path: '/providers' },
  tags: { titleKey: 'page.tags.title', subtitleKey: 'page.tags.subtitle', path: '/tags' },
  'request-lab': { titleKey: 'page.requestLab.title', subtitleKey: 'page.requestLab.subtitle', path: '/request-lab' },
  'agent-tools': { titleKey: 'page.agentTools.title', subtitleKey: 'page.agentTools.subtitle', path: '/agent-tools' },
  health: { titleKey: 'page.health.title', subtitleKey: 'page.health.subtitle', path: '/health' },
  documentation: { titleKey: 'page.documentation.title', subtitleKey: 'page.documentation.subtitle', path: '/documentation' },
}

const pageFromPath = Object.fromEntries(Object.entries(pageMeta).map(([page, meta]) => [meta.path, page])) as Record<string, AdminPage>

function readPageFromLocation(): AdminPage {
  const hashPath = readHashPath()
  return pageFromPath[hashPath] ?? pageFromPath[window.location.pathname] ?? 'catalog'
}

type SupportingCard = {
  key: string
  title: string
  description: string
  meta: string
  titleLang?: 'en'
  descriptionLang?: 'en'
  metaLang?: 'en'
}

type SupportingPageDefinition = {
  icon: IconName
  eyebrow: string
  description: string
  cards: SupportingCard[]
}

type TranslateUi = (key: UiMessageKey, values?: Record<string, string | number>) => string

const buildSupportingPages = (t: TranslateUi): Record<SupportingPage, SupportingPageDefinition> => ({
  collections: {
    icon: 'box',
    eyebrow: t('support.collections.eyebrow'),
    description: t('support.collections.description'),
    cards: [
      { key: 'keyless-starter-pack', title: t('support.collections.keylessTitle'), description: t('support.collections.keylessDescription'), meta: t('support.apiCount', { count: apiCatalog.length }) },
      { key: 'singapore-open-data', title: t('support.collections.singaporeTitle'), description: t('support.collections.singaporeDescription'), meta: t('support.apiCount', { count: apiCatalog.filter((api) => api.category === 'Singapore').length }) },
      { key: 'developer-toolbox', title: t('support.collections.developerTitle'), description: t('support.collections.developerDescription'), meta: t('support.apiCount', { count: apiCatalog.filter((api) => api.category === 'Developer').length }) },
    ],
  },
  providers: {
    icon: 'database',
    eyebrow: t('support.providers.eyebrow'),
    description: t('support.providers.description'),
    cards: apiCatalog.map((api) => ({
      key: api.id,
      title: api.provider,
      description: api.name,
      meta: new URL(api.documentationUrl).hostname,
      titleLang: 'en',
      descriptionLang: 'en',
      metaLang: 'en',
    })),
  },
  tags: {
    icon: 'filter',
    eyebrow: t('support.tags.eyebrow'),
    description: t('support.tags.description'),
    cards: [
      { key: 'no-key', title: KEYLESS_TAG_LABEL, description: t('support.tags.noKeyDescription'), meta: t('support.apiCount', { count: apiCatalog.length }), titleLang: 'en' },
      { key: 'get', title: DEFAULT_HTTP_METHOD, description: t('support.tags.getDescription'), meta: t('support.apiCount', { count: apiCatalog.filter((api) => (api.method ?? DEFAULT_HTTP_METHOD) === DEFAULT_HTTP_METHOD).length }), titleLang: 'en' },
      ...apiCategories.map((category) => {
        const count = apiCatalog.filter((api) => api.category === category).length
        return { key: `category-${category}`, title: category, description: t('support.tags.categoryDescription'), meta: t('support.apiCount', { count }), titleLang: 'en' as const }
      }).filter((card) => !card.meta.startsWith('0 ')),
    ],
  },
  health: {
    icon: 'shield',
    eyebrow: t('support.health.eyebrow'),
    description: t('support.health.description'),
    cards: apiCatalog.map((api) => ({
      key: api.id,
      title: api.name,
      description: api.provider,
      meta: t('support.health.catalogRisk', { risk: api.risk ?? DEFAULT_RISK }),
      titleLang: 'en',
      descriptionLang: 'en',
    })),
  },
  documentation: {
    icon: 'book',
    eyebrow: t('support.documentation.eyebrow'),
    description: t('support.documentation.description'),
    cards: [
      { key: 'add-module', title: t('support.documentation.addTitle'), description: t('support.documentation.addDescription'), meta: 'Catalog', metaLang: 'en' },
      { key: 'test-endpoint', title: t('support.documentation.testTitle'), description: t('support.documentation.testDescription'), meta: 'Runtime', metaLang: 'en' },
      { key: 'agent-controls', title: t('support.documentation.agentTitle'), description: t('support.documentation.agentDescription'), meta: 'WebMCP', metaLang: 'en' },
    ],
  },
})

function readSidebarPreference() {
  try {
    return window.localStorage.getItem(sidebarPreferenceKey) === 'true'
  } catch {
    return false
  }
}

const navGroups: Array<{ labelKey?: UiMessageKey; items: Array<{ icon: IconName; page: AdminPage; badge?: string }> }> = [
  { items: [{ icon: 'home', page: 'overview' }] },
  { labelKey: 'nav.discover', items: [{ icon: 'api', page: 'catalog' }, { icon: 'box', page: 'collections' }, { icon: 'database', page: 'providers' }, { icon: 'filter', page: 'tags' }] },
  { labelKey: 'nav.operate', items: [{ icon: 'activity', page: 'request-lab' }, { icon: 'agent', page: 'agent-tools', badge: String(WEBMCP_TOOL_COUNT) }, { icon: 'shield', page: 'health' }] },
  { labelKey: 'nav.resources', items: [{ icon: 'book', page: 'documentation' }] },
]

if (import.meta.env.DEV) {
  const navPages = new Set(navGroups.flatMap((group) => group.items.map((item) => item.page)))
  const missing = (Object.keys(pageMeta) as AdminPage[]).filter((page) => !navPages.has(page))
  if (missing.length) console.warn(`navGroups is missing sidebar entries for: ${missing.join(', ')}`)
}

const getNativeFieldMinimum = (field: ApiField, parameters: Record<string, string>): string | number | undefined => {
  const linkedMinimum = field.minimumFromField ? parameters[field.minimumFromField]?.trim() : ''
  if (field.type === 'date') return linkedMinimum || undefined
  if (field.type !== 'number') return undefined
  if (!linkedMinimum || !Number.isFinite(Number(linkedMinimum))) return field.min
  return field.min === undefined ? linkedMinimum : Math.max(field.min, Number(linkedMinimum))
}

function App() {
  const [currentPage, setCurrentPage] = useState<AdminPage>(readPageFromLocation)
  const [locale, setLocale] = useState(readUiLocale)
  const t = useCallback((key: UiMessageKey, values?: Record<string, string | number>) => uiText(locale, key, values), [locale])
  const [selectedId, setSelectedId] = useState(() => getApiById(readRequestLabApiId() ?? '')?.id ?? apiCatalog[0].id)
  const [parameters, setParameters] = useState<Record<string, string>>(() => {
    const initialApi = getApiById(readRequestLabApiId() ?? '') ?? apiCatalog[0]
    return getDefaultParameters(initialApi)
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('All')
  const [catalogPage, setCatalogPage] = useState(1)
  const [mobileNav, setMobileNav] = useState(false)
  const mobileNavOpenRef = useRef(mobileNav)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarPreference)
  const [viewport, setViewport] = useState(() => ({
    compact: window.matchMedia('(max-width: 1180px)').matches,
    mobile: window.matchMedia('(max-width: 760px)').matches,
  }))
  const [detailOpen, setDetailOpen] = useState(() => !window.matchMedia('(max-width: 1180px)').matches)
  const [outputTab, setOutputTab] = useState<'response' | 'code'>('response')
  const [copied, setCopied] = useState(false)
  const selectedIdRef = useRef(selectedId)
  const pageHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const previousPageRef = useRef(currentPage)
  const mobileNavRef = useRef<HTMLElement | null>(null)
  const mobileNavTriggerRef = useRef<HTMLButtonElement | null>(null)
  const mobileCloseRef = useRef<HTMLButtonElement | null>(null)
  const detailPanelRef = useRef<HTMLElement | null>(null)
  const detailCloseRef = useRef<HTMLButtonElement | null>(null)
  const detailHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const detailTriggerRef = useRef<HTMLElement | null>(null)
  const responsiveDetailFocusRef = useRef<HTMLElement | null>(null)
  selectedIdRef.current = selectedId
  mobileNavOpenRef.current = mobileNav

  const { close: closeMobileNavigation } = useModalFocusTrap({
    active: mobileNav,
    containerRef: mobileNavRef,
    initialFocusRef: mobileCloseRef,
    returnFocusRef: mobileNavTriggerRef,
    setOpen: setMobileNav,
  })
  const { close: closeDetailPanel, cancelRestore: cancelDetailFocusRestore } = useModalFocusTrap({
    active: viewport.compact && detailOpen,
    containerRef: detailPanelRef,
    initialFocusRef: detailCloseRef,
    returnFocusRef: detailTriggerRef,
    setOpen: setDetailOpen,
  })

  const handleRequestStart = useCallback((api: ApiDemo, values: Record<string, string>) => {
    setSelectedId(api.id)
    setParameters(values)
  }, [])
  const { request, runRequest, cancelActiveRequest, resetRequest } = useApiRequestRuntime({
    onRunStart: handleRequestStart,
    preloadResponsePreview: loadResponsePreview,
  })

  const activeApi = apiCatalog.find((api) => api.id === selectedId) ?? apiCatalog[0]
  const activePageMeta = pageMeta[currentPage]
  const activePage = { ...activePageMeta, title: t(activePageMeta.titleKey), subtitle: t(activePageMeta.subtitleKey) }
  const supportingPages = useMemo(() => buildSupportingPages(t), [t])
  const supportingPage = currentPage in supportingPages ? supportingPages[currentPage as SupportingPage] : null

  const navigatePage = useCallback((page: AdminPage, replace = false, requestLabApiId?: string) => {
    const path = pageMeta[page].path
    const hash = page === 'request-lab' ? buildRequestLabHash(requestLabApiId ?? selectedIdRef.current) : `#${path}`
    const sameDestination = window.location.hash === hash
    if (!sameDestination) {
      window.history[replace ? 'replaceState' : 'pushState']({}, '', `${import.meta.env.BASE_URL}${hash}`)
    }
    setCurrentPage(page)
    if (sameDestination && window.matchMedia('(max-width: 760px)').matches && mobileNavRef.current?.contains(document.activeElement)) {
      closeMobileNavigation(true)
    } else {
      setMobileNav(false)
    }
    if (page !== 'catalog') {
      cancelDetailFocusRestore()
      setDetailOpen(false)
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    const syncRoute = (canonicalizeRequestLab = false) => {
      const page = readPageFromLocation()
      setCurrentPage(page)
      setMobileNav(false)
      if (page !== 'catalog') {
        cancelDetailFocusRestore()
        setDetailOpen(false)
      }
      if (page !== 'request-lab') return

      const requestedId = readRequestLabApiId()
      const requestedApi = requestedId ? getApiById(requestedId) : undefined
      if (!requestedApi) {
        if (canonicalizeRequestLab) navigatePage('request-lab', true, selectedId)
        return
      }
      if (requestedApi.id === selectedId) return
      cancelActiveRequest()
      setSelectedId(requestedApi.id)
      setParameters(getDefaultParameters(requestedApi))
      setErrors({})
      resetRequest()
      setOutputTab('response')
    }

    if (!pageFromPath[readHashPath()]) navigatePage(readPageFromLocation(), true)
    else syncRoute(true)

    const handleRouteChange = () => syncRoute(true)
    window.addEventListener('popstate', handleRouteChange)
    window.addEventListener('hashchange', handleRouteChange)
    return () => {
      window.removeEventListener('popstate', handleRouteChange)
      window.removeEventListener('hashchange', handleRouteChange)
    }
  }, [cancelActiveRequest, navigatePage, resetRequest, selectedId])

  useEffect(() => {
    document.title = `${activePage.title} — Public API Admin`
  }, [activePage.title])

  useEffect(() => {
    document.documentElement.lang = locale
    try {
      window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, locale)
    } catch {
      // Storage may be unavailable in private or restricted browser contexts.
    }
  }, [locale])

  useEffect(() => {
    if (previousPageRef.current === currentPage) return
    previousPageRef.current = currentPage
    pageHeadingRef.current?.focus({ preventScroll: true })
  }, [currentPage])

  useEffect(() => {
    const compactQuery = window.matchMedia('(max-width: 1180px)')
    const mobileQuery = window.matchMedia('(max-width: 760px)')
    const updateViewport = () => {
      if (compactQuery.matches && detailPanelRef.current?.contains(document.activeElement)) {
        responsiveDetailFocusRef.current = document.querySelector<HTMLElement>(`tr[data-api-id="${selectedIdRef.current}"] .api-identity`) ?? pageHeadingRef.current
      } else if (!compactQuery.matches && document.activeElement === detailCloseRef.current) {
        responsiveDetailFocusRef.current = detailHeadingRef.current
      }
      if (!mobileQuery.matches && mobileNavOpenRef.current) {
        const activeNavigationItem = mobileNavRef.current?.querySelector<HTMLElement>('nav button.active')
        ;(activeNavigationItem ?? pageHeadingRef.current)?.focus({ preventScroll: true })
      }
      setViewport({ compact: compactQuery.matches, mobile: mobileQuery.matches })
      setDetailOpen(!compactQuery.matches)
      if (!mobileQuery.matches) setMobileNav(false)
    }
    compactQuery.addEventListener('change', updateViewport)
    mobileQuery.addEventListener('change', updateViewport)
    return () => {
      compactQuery.removeEventListener('change', updateViewport)
      mobileQuery.removeEventListener('change', updateViewport)
    }
  }, [])

  useEffect(() => {
    const target = responsiveDetailFocusRef.current
    responsiveDetailFocusRef.current = null
    if (target?.isConnected) target.focus({ preventScroll: true })
  }, [detailOpen, viewport.compact])

  useEffect(() => {
    try {
      window.localStorage.setItem(sidebarPreferenceKey, String(sidebarCollapsed))
    } catch {
      // Storage may be unavailable in private or restricted browser contexts.
    }
  }, [sidebarCollapsed])

  const filteredApis = useMemo(() => {
    return apiCatalog.filter((api) => {
      const matchesCategory = category === 'All' || api.category === category
      return matchesCategory && matchesApiSearch(api, query)
    })
  }, [category, query])
  const catalogPageCount = Math.max(1, Math.ceil(filteredApis.length / CATALOG_PAGE_SIZE))
  const visibleCatalogPage = Math.min(catalogPage, catalogPageCount)
  const catalogPageStart = (visibleCatalogPage - 1) * CATALOG_PAGE_SIZE
  const visibleCatalogApis = filteredApis.slice(catalogPageStart, catalogPageStart + CATALOG_PAGE_SIZE)
  const catalogRangeStart = filteredApis.length ? catalogPageStart + 1 : 0
  const catalogRangeEnd = Math.min(catalogPageStart + visibleCatalogApis.length, filteredApis.length)

  const navigateSection = useCallback((section: AdminSection) => {
    navigatePage(section)
  }, [navigatePage])

  const filterCatalog = useCallback((nextQuery: string, nextCategory: string) => {
    navigatePage('catalog')
    setCatalogPage(1)
    setQuery(nextQuery)
    if (categories.includes(nextCategory as (typeof categories)[number])) setCategory(nextCategory)
  }, [navigatePage])

  const rememberDetailTrigger = () => {
    if (!viewport.compact || detailOpen) return
    if (document.activeElement instanceof HTMLElement) detailTriggerRef.current = document.activeElement
  }

  const selectApi = useCallback((id: string, openOnMobile = true) => {
    const api = apiCatalog.find((candidate) => candidate.id === id)
    if (!api) return
    cancelActiveRequest()
    setSelectedId(id)
    setParameters(getDefaultParameters(api))
    setErrors({})
    resetRequest()
    setOutputTab('response')
    if (openOnMobile) setDetailOpen(true)
  }, [cancelActiveRequest, resetRequest])


  const selectApiForAgent = useCallback((id: string) => {
    selectApi(id, false)
    navigatePage('request-lab', false, id)
  }, [navigatePage, selectApi])

  const webMcpStatus = useWebMcp({ onSelectApi: selectApiForAgent, onRunApi: runRequest, onNavigate: navigateSection, onFilter: filterCatalog })
  const endpoint = activeApi.buildUrl(parameters)
  const agentExecutionPolicy = getAgentExecutionPolicy(activeApi)
  const automatedVerificationPolicy = getAutomatedVerificationPolicy(activeApi)
  const agentExecutionNoteId = `agent-execution-policy-${activeApi.id}`
  const activeResponseType = getApiResponseType(activeApi)
  const responseOutputLabel = activeResponseType === 'json' ? t('request.rawJson') : t('request.responseDetails')
  const copyResponseLabel = activeResponseType === 'json' ? t('request.copyJson') : t('request.copyDetails')

  const executeRequest = useCallback(async (api: ApiDemo, values: Record<string, string>) => {
    const nextErrors = validateParameters(api, values)
    setErrors(nextErrors)
    setOutputTab('response')
    if (Object.keys(nextErrors).length) return false
    await runRequest(api, values).catch(() => undefined)
    return true
  }, [runRequest])

  const updateParameter = (fieldId: string, value: string) => {
    cancelActiveRequest()
    setParameters((current) => ({ ...current, [fieldId]: value }))
    if (request.status !== 'idle') resetRequest()
    setOutputTab('response')
  }

  const handleOutputTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])
    if (!tabs.length) return
    const currentIndex = tabs.indexOf(event.currentTarget)
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    const nextTab = tabs[nextIndex]
    if (!nextTab) return
    event.preventDefault()
    setOutputTab(nextTab.dataset.outputTab === 'code' ? 'code' : 'response')
    nextTab.focus()
  }

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await executeRequest(activeApi, parameters)
  }

  const trySelectedApi = () => {
    closeDetailPanel(false)
    navigatePage('request-lab', false, activeApi.id)
    if (agentExecutionPolicy.mode === 'manual-only') return
    void executeRequest(activeApi, parameters)
  }

  const copyOutput = async () => {
    const value = outputTab === 'code'
      ? codeSample(activeApi, parameters)
      : request.status === 'success'
        ? JSON.stringify(request.data, null, 2)
        : endpoint
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  const copyFetch = async () => {
    await navigator.clipboard.writeText(codeSample(activeApi, parameters))
  }

  return (
    <div className={`admin-shell ${currentPage === 'catalog' ? 'has-detail' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside ref={mobileNavRef} id="primary-navigation" className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileNav ? 'mobile-open' : ''}`} role={viewport.mobile && mobileNav ? 'dialog' : undefined} aria-modal={viewport.mobile && mobileNav ? 'true' : undefined} aria-label={t('nav.primary')} aria-hidden={viewport.mobile && !mobileNav} inert={(viewport.mobile && !mobileNav) || (viewport.compact && detailOpen) ? true : undefined}>
        <div className="sidebar-brand">
          <button
            className="sidebar-brand-toggle"
            type="button"
            onClick={() => viewport.mobile ? closeMobileNavigation() : setSidebarCollapsed((current) => !current)}
            aria-controls="primary-navigation"
            aria-expanded={viewport.mobile ? mobileNav : !sidebarCollapsed}
            aria-label={viewport.mobile ? t('nav.closeBrand') : sidebarCollapsed ? t('nav.expand') : t('nav.collapse')}
            title={viewport.mobile ? t('nav.closeBrand') : sidebarCollapsed ? t('nav.expand') : t('nav.collapse')}
          >
            <span className="logo-cube"><i /></span>
            <span className="sidebar-brand-copy" lang="en" translate="no"><b>API Console</b><small>Govern • Discover • Operate</small></span>
          </button>
          <button ref={mobileCloseRef} className="mobile-close" type="button" onClick={() => closeMobileNavigation(true)} aria-label={t('nav.close')}><Icon name="x" /></button>
        </div>
        <nav aria-label={t('nav.primary')}>
          {navGroups.map((group, index) => (
            <div className="nav-group" key={`${group.labelKey ?? 'root'}-${index}`}>
              {group.labelKey && <span className="nav-label">{t(group.labelKey)}</span>}
              {group.items.map((item) => {
                const label = t(pageMeta[item.page].titleKey)
                return (
                  <button
                    type="button"
                    className={item.page === currentPage ? 'active' : ''}
                    key={item.page}
                    onClick={() => navigatePage(item.page)}
                    aria-current={item.page === currentPage ? 'page' : undefined}
                    aria-label={sidebarCollapsed && !viewport.mobile ? label : undefined}
                    title={sidebarCollapsed && !viewport.mobile ? label : undefined}
                  >
                    <Icon name={item.icon} size={17} /><span>{label}</span>{item.badge && <em>{item.badge}</em>}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-version">API Console v1.0.0</div>
      </aside>

      {mobileNav && <button className="nav-scrim" type="button" tabIndex={-1} aria-hidden="true" onClick={() => closeMobileNavigation(true)} />}

      <div className="admin-main" inert={mobileNav || (viewport.compact && detailOpen) ? true : undefined}>
        <header className="topbar">
          <button ref={mobileNavTriggerRef} className="menu-button" type="button" onClick={() => setMobileNav(true)} aria-label={t('nav.open')} aria-controls="primary-navigation" aria-expanded={mobileNav}><Icon name="menu" /></button>
          <div className="page-title"><h1 ref={pageHeadingRef} tabIndex={-1}>{activePage.title}</h1><p>{activePage.subtitle}</p></div>
          <div className="topbar-actions"><label className="locale-control"><span className="sr-only">{t('language.label')}</span><select aria-label={t('language.label')} value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)}>{uiLocaleOptions.map((option) => <option key={option.value} value={option.value} lang={option.lang}>{option.label}</option>)}</select></label>
          <button className="icon-button" type="button" aria-label={t('help')} onClick={() => navigatePage('documentation')}><Icon name="help" /></button></div>
        </header>

        <main className="dashboard">
          {currentPage === 'overview' && <>
          <section className="metric-grid" aria-label={t('overview.summary')}>
            {[
              { label: t('overview.totalApis'), value: apiCatalog.length, note: t('overview.totalApisNote'), icon: 'box' as IconName, tone: 'blue' },
              { label: t('overview.sourceLinked'), value: apiCatalog.length, note: t('overview.sourceLinkedNote'), icon: 'link' as IconName, tone: 'blue' },
              { label: t('overview.curatedDemos'), value: apiCatalog.length, note: t('overview.curatedDemosNote'), icon: 'shield' as IconName, tone: 'green' },
              { label: t('overview.getRequests'), value: apiCatalog.filter((api) => (api.method ?? DEFAULT_HTTP_METHOD) === DEFAULT_HTTP_METHOD).length, note: t('overview.getRequestsNote'), icon: 'activity' as IconName, tone: 'green' },
              { label: t('overview.noKey'), value: apiCatalog.length, note: t('overview.noKeyNote'), icon: 'alert' as IconName, tone: 'orange' },
              { label: t('overview.agentTools'), value: WEBMCP_TOOL_COUNT, note: t('overview.agentToolsNote'), icon: 'agent' as IconName, tone: 'violet' },
            ].map((metric) => (
              <article className="metric-card" key={metric.label}>
                <span className={`metric-icon ${metric.tone}`}><Icon name={metric.icon} /></span>
                <div><strong>{metric.value}</strong><b>{metric.label}</b><small>{metric.note}</small></div>
              </article>
            ))}
          </section>

          <section className="overview-launch" aria-labelledby="overview-heading">
            <div className="workspace-heading"><span><Icon name="spark" /></span><div><p>{t('overview.workspace')}</p><h2 id="overview-heading">{t('overview.next')}</h2><small>{t('overview.nextNote')}</small></div></div>
            <div className="launch-grid">
              <button type="button" onClick={() => navigatePage('catalog')}><span><Icon name="api" /></span><div><b>{t('overview.browseCatalog')}</b><small>{t('overview.browseCatalogNote')}</small></div><Icon name="arrow" /></button>
              <button type="button" onClick={() => navigatePage('request-lab')}><span><Icon name="activity" /></span><div><b>{t('overview.openLab')}</b><small>{t('overview.openLabNote')}</small></div><Icon name="arrow" /></button>
              <button type="button" onClick={() => navigatePage('agent-tools')}><span><Icon name="agent" /></span><div><b>{t('overview.inspectAgentTools')}</b><small>{t('overview.inspectAgentToolsNote')}</small></div><Icon name="arrow" /></button>
            </div>
          </section>
          </>}

          {currentPage === 'catalog' && <section className="catalog-panel page-panel" aria-labelledby="catalog-heading">
            <div className="panel-heading">
              <div><h2 id="catalog-heading">{t('catalog.inventory')}</h2><p>{t('catalog.inventoryDescription')}</p></div>
              <div className={`agent-connection ${webMcpStatus}`}><i /><span>{webMcpStatus === 'ready' ? t('catalog.agentConnected') : webMcpStatus === 'unsupported' ? t('catalog.browserPreview') : webMcpStatus === 'error' ? t('catalog.agentUnavailable') : t('catalog.checkingWebmcp')}</span></div>
            </div>
            <div className="catalog-toolbar">
              <label className="module-search"><Icon name="search" size={16} /><span className="sr-only">{t('catalog.search')}</span><input aria-label={t('catalog.search')} value={query} onChange={(event) => { setQuery(event.target.value); setCatalogPage(1) }} placeholder={t('catalog.searchPlaceholder')} /></label>
              <select aria-label={t('catalog.filterCategory')} value={category} onChange={(event) => { setCategory(event.target.value); setCatalogPage(1) }}>{categories.map((item) => <option value={item} key={item}>{item === 'All' ? t('catalog.allCategories') : item}</option>)}</select>
              <span className="result-count" aria-live="polite">{t('catalog.resultCount', { count: filteredApis.length })}</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead><tr><th aria-label={t('catalog.selection')} /><th>{t('catalog.api')}</th><th>{t('catalog.provider')}</th><th>{t('catalog.risk')}</th><th>{t('catalog.tags')}</th></tr></thead>
                <tbody>
                  {visibleCatalogApis.map((api) => (
                    <tr
                      className={api.id === selectedId ? 'selected' : ''}
                      key={api.id}
                      data-api-id={api.id}
                      data-category={api.category}
                      data-provider={api.provider}
                      data-http-method={api.method ?? DEFAULT_HTTP_METHOD}
                      data-agent-execution={getAgentExecutionPolicy(api).mode}
                      data-automated-verification={api.automatedVerification?.mode ?? 'enabled'}
                      data-verification-minimum-interval-seconds={api.automatedVerification?.mode === 'cadence-limited' ? api.automatedVerification.minimumIntervalSeconds : undefined}
                      data-verification-retry-on-rate-limit={api.automatedVerification?.mode === 'enabled' && api.automatedVerification.retryOnRateLimit === false ? 'false' : undefined}
                      data-verification-rate-limit-statuses={api.automatedVerification?.mode === 'enabled' && api.automatedVerification.rateLimitStatuses?.length ? api.automatedVerification.rateLimitStatuses.join(',') : undefined}
                      data-selected={api.id === selectedId ? 'true' : 'false'}
                    >
                      <td><label className="api-radio-target"><input type="radio" name="selected-api" checked={api.id === selectedId} onChange={() => { rememberDetailTrigger(); selectApi(api.id) }} aria-label={t('catalog.selectApi', { name: api.name })} /></label></td>
                      <td data-label={t('catalog.api')}><button className="api-identity" type="button" onClick={() => { rememberDetailTrigger(); selectApi(api.id) }}><span style={{ '--api-color': api.accent } as React.CSSProperties}>{api.monogram}</span><div lang="en"><b>{api.name}</b><small>{api.description}</small></div></button></td>
                      <td data-label={t('catalog.provider')}><div className="provider-cell"><b lang="en">{api.provider}</b><a href={api.documentationUrl} target="_blank" rel="noreferrer" aria-label={t('catalog.openDocumentation', { name: api.name })} data-api-docs-for={api.id}>{t('catalog.documentation')} <Icon name="external" size={11} /></a></div></td>
                      <td data-label={t('catalog.risk')}><span className="risk"><Icon name="shield" size={14} /> {api.risk ?? DEFAULT_RISK}</span></td>
                      <td data-label={t('catalog.tags')}><div className="tags"><span className="tag blue">{KEYLESS_TAG_LABEL}</span><span className="tag green">{api.method ?? DEFAULT_HTTP_METHOD}</span><span className="tag plain">{api.category}</span></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredApis.length === 0 && <div className="catalog-empty"><Icon name="search" /><b>{t('catalog.emptyTitle')}</b><p>{t('catalog.emptyDescription')}</p></div>}
            </div>
            <div className="table-footer" data-catalog-page={visibleCatalogPage} data-page-count={catalogPageCount} data-page-size={CATALOG_PAGE_SIZE}><span>{t('catalog.showing', { start: catalogRangeStart, end: catalogRangeEnd, matched: filteredApis.length, total: apiCatalog.length })}</span><div aria-label={t('catalog.pagination')}><button type="button" disabled={visibleCatalogPage <= 1} aria-label={t('catalog.previousPage')} onClick={() => setCatalogPage((page) => Math.max(1, page - 1))}>‹</button><span className="current" aria-current="page" aria-label={t('catalog.page', { page: visibleCatalogPage, pages: catalogPageCount })}>{visibleCatalogPage}</span><button type="button" disabled={visibleCatalogPage >= catalogPageCount} aria-label={t('catalog.nextPage')} onClick={() => setCatalogPage((page) => Math.min(catalogPageCount, page + 1))}>›</button></div></div>
          </section>}

          {currentPage === 'request-lab' && <section className={`request-lab page-section ${request.status === 'success' ? 'has-ssot-result' : ''}`} aria-labelledby="lab-heading" data-api-id={activeApi.id} data-request-state={request.status} data-response-type={activeResponseType} data-response-content-types={activeApi.responseContentTypes?.join(',')} data-agent-execution={agentExecutionPolicy.mode} data-automated-verification={automatedVerificationPolicy.mode} data-verification-minimum-interval-seconds={automatedVerificationPolicy.mode === 'cadence-limited' ? automatedVerificationPolicy.minimumIntervalSeconds : undefined} data-verification-retry-on-rate-limit={automatedVerificationPolicy.mode === 'enabled' && automatedVerificationPolicy.retryOnRateLimit === false ? 'false' : undefined} data-verification-rate-limit-statuses={automatedVerificationPolicy.mode === 'enabled' && automatedVerificationPolicy.rateLimitStatuses?.length ? automatedVerificationPolicy.rateLimitStatuses.join(',') : undefined}>
            <div className="section-title"><span><Icon name="activity" /></span><div><h2 id="lab-heading">{t('request.heading')}</h2><p>{t('request.description')}</p></div></div>
            {request.status === 'success' && <PreviewLoadBoundary resetKey={`${activeApi.id}:${request.runId}`}><Suspense fallback={<div className="response-preview-loading" role="status" aria-live="polite">{t('request.preparingPreview')}</div>}><LazyResponseDemoPreview api={activeApi} data={request.data} requestUrl={request.url} executedRequest={request.executedRequest} responseMedia={request.responseMedia} runtime={{ httpStatus: request.httpStatus, elapsed: request.elapsed, size: request.size }} locale={locale} /></Suspense></PreviewLoadBoundary>}
            <div className="lab-grid">
              <form className="parameter-card" aria-label={t('request.configure', { name: activeApi.name })} data-api-id={activeApi.id} data-agent-execution={agentExecutionPolicy.mode} onSubmit={submitRequest} noValidate>
                <div className="active-api"><span style={{ '--api-color': activeApi.accent } as React.CSSProperties}>{activeApi.monogram}</span><div><small>{t('request.selectedModule')}</small><b lang="en">{activeApi.name}</b></div><a href={activeApi.documentationUrl} target="_blank" rel="noreferrer">{t('request.docs')} <Icon name="external" size={12} /></a></div>
                {agentExecutionPolicy.mode === 'manual-only' && <aside id={agentExecutionNoteId} className="agent-policy-note" aria-label={t('request.agentRestriction')}><Icon name="shield" size={17} /><div><b>{t('request.interactiveOnly')}</b><p lang="en">{agentExecutionPolicy.reason}</p>{agentExecutionPolicy.policyUrl && <a href={agentExecutionPolicy.policyUrl} target="_blank" rel="noreferrer">{t('request.providerPolicy')} <Icon name="external" size={11} /></a>}</div></aside>}
                <div className="endpoint-box"><span>{activeApi.method ?? DEFAULT_HTTP_METHOD}</span><code>{endpoint}</code></div>
                <div className="parameter-heading"><b>{t('request.parameters')}</b><small>{activeApi.fields.length ? t('request.requiredCount', { count: activeApi.fields.length }) : t('request.noInput')}</small></div>
                <div className="parameter-fields">
                  {activeApi.fields.map((field) => (
                    <label key={field.id} htmlFor={`parameter-${field.id}`}><span><span lang="en">{field.label}</span><em>{t('request.required')}</em></span>
                      {field.type === 'select' ? <select lang="en" id={`parameter-${field.id}`} name={field.id} value={parameters[field.id] ?? ''} aria-label={field.label} aria-required="true" aria-invalid={Boolean(errors[field.id])} aria-describedby={`parameter-${field.id}-help`} onChange={(event) => updateParameter(field.id, event.target.value)}>{field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select> : <input lang="en" id={`parameter-${field.id}`} name={field.id} type={field.type} min={getNativeFieldMinimum(field, parameters)} max={field.type === 'number' ? field.max : undefined} step={field.type === 'number' ? field.step : undefined} minLength={field.type === 'text' ? field.minLength : undefined} maxLength={field.type === 'text' ? field.maxLength : undefined} pattern={field.type === 'text' ? field.pattern : undefined} value={parameters[field.id] ?? ''} placeholder={field.placeholder} aria-label={field.label} aria-required="true" aria-invalid={Boolean(errors[field.id])} aria-describedby={`parameter-${field.id}-help`} onChange={(event) => updateParameter(field.id, event.target.value)} />}
                      <small lang="en" id={`parameter-${field.id}-help`} className={errors[field.id] ? 'error' : ''}>{errors[field.id] ?? field.help}</small>
                    </label>
                  ))}
                </div>
                <button className="primary-action" type="submit" disabled={request.status === 'loading'} data-agent-execution={agentExecutionPolicy.mode} aria-describedby={agentExecutionPolicy.mode === 'manual-only' ? agentExecutionNoteId : undefined}>{request.status === 'loading' ? <span className="spinner" /> : <Icon name="play" size={16} />}{request.status === 'loading' ? t('request.running') : t('request.tryLive')}</button>
              </form>
              <div className="response-card" role="region" aria-label={t('request.output', { name: activeApi.name })} data-api-id={activeApi.id} data-request-state={request.status} data-error-type={request.status === 'error' ? request.errorType : undefined}>
                <div className="response-head"><div role="tablist" aria-label={t('request.outputTabs')}><button id="request-output-response-tab" data-output-tab="response" role="tab" aria-controls="request-output-panel" aria-selected={outputTab === 'response'} tabIndex={outputTab === 'response' ? 0 : -1} type="button" onClick={() => setOutputTab('response')} onKeyDown={handleOutputTabKeyDown}>{responseOutputLabel}</button>{agentExecutionPolicy.mode === 'enabled' && <button id="request-output-code-tab" data-output-tab="code" role="tab" aria-controls="request-output-panel" aria-selected={outputTab === 'code'} tabIndex={outputTab === 'code' ? 0 : -1} type="button" onClick={() => setOutputTab('code')} onKeyDown={handleOutputTabKeyDown}>{t('request.fetchCode')}</button>}</div>{request.status === 'success' && <span className="response-meta"><b>{request.httpStatus} OK</b>{request.elapsed} ms · {formatBytes(request.size)}</span>}<button type="button" className="copy-output" onClick={copyOutput}><Icon name={copied ? 'check' : 'copy'} size={14} />{copied ? t('request.copied') : outputTab === 'code' ? t('request.copyCode') : copyResponseLabel}</button></div>
                <div id="request-output-panel" className="response-body" role="tabpanel" aria-labelledby={outputTab === 'response' ? 'request-output-response-tab' : 'request-output-code-tab'} tabIndex={0} aria-live="polite">
                  {outputTab === 'code' ? <pre>{codeSample(activeApi, parameters)}</pre> : request.status === 'idle' ? <div className="response-empty"><span><Icon name="play" /></span><b>{t('request.ready')}</b><p>{t('request.readyDescription')}</p></div> : request.status === 'loading' ? <div className="response-empty"><span><Icon name="activity" /></span><b>{t('request.contacting', { provider: activeApi.provider })}</b><p>{t('request.waiting')}</p></div> : request.status === 'error' ? <div className="response-error" role="alert" aria-label={t('request.failedLabel', { type: request.errorType })} data-error-type={request.errorType} data-http-status={request.httpStatus}><Icon name="alert" /><b>{t('request.failed')}</b><p>{request.message}</p><small className="sr-only">{t('request.errorTypeLabel', { type: request.errorType })}{request.httpStatus ? `; HTTP ${request.httpStatus}` : ''}</small></div> : <pre>{JSON.stringify(request.data, null, 2)}</pre>}
                </div>
              </div>
            </div>
          </section>}

          {currentPage === 'agent-tools' && <section className="agent-section page-section" aria-labelledby="agent-heading">
            <div className="agent-intro"><span className="agent-hero-icon"><Icon name="agent" size={26} /></span><p className="eyebrow">{t('agent.eyebrow')}</p><h2 id="agent-heading">{t('agent.heading')}</h2><p>{t('agent.description')}</p><div className={`webmcp-state ${webMcpStatus}`}><i /><div><b>{webMcpStatus === 'ready' ? t('agent.registered') : webMcpStatus === 'unsupported' ? t('agent.unsupported') : t('agent.checking')}</b><small>{t('agent.fallback')}</small></div></div><a className="machine-catalog-link" href={MACHINE_CATALOG_URL} data-agent-catalog="api-catalog-json"><Icon name="code" size={15} /><span><b>{t('agent.machineCatalog')}</b><small>{t('agent.machineCatalogMeta')}</small></span><Icon name="external" size={12} /></a></div>
            <div className="tool-list">
              {WEBMCP_TOOL_UI_LIST.map(([name, description, type], index) => <article key={name}><span>0{index + 1}</span><div><code>{name}</code><p lang="en">{description}</p></div><em>{type}</em><Icon name="check" /></article>)}
            </div>
          </section>}

          {supportingPage && <section className="workspace-page" aria-labelledby="workspace-heading">
            <div className="workspace-hero">
              <span><Icon name={supportingPage.icon} size={24} /></span>
              <p>{t('support.workspace')}</p>
              <h2 id="workspace-heading">{supportingPage.eyebrow}</h2>
              <small>{supportingPage.description}</small>
            </div>
            <div className="workspace-grid">
              {supportingPage.cards.map((card) => <article key={card.key}><span lang={card.metaLang}>{card.meta}</span><h3 lang={card.titleLang}>{card.title}</h3><p lang={card.descriptionLang}>{card.description}</p></article>)}
            </div>
            <div className="workspace-actions">
              <button className="primary-action" type="button" onClick={() => navigatePage(currentPage === 'health' ? 'request-lab' : 'catalog')}><Icon name={currentPage === 'health' ? 'activity' : 'api'} size={15} /> {currentPage === 'health' ? t('support.openRequestLab') : t('support.openCatalog')}</button>
              {currentPage !== 'documentation' && <button type="button" onClick={() => navigatePage('documentation')}><Icon name="book" size={15} /> {t('support.readGuide')}</button>}
            </div>
          </section>}
        </main>
      </div>

      {currentPage === 'catalog' && viewport.compact && detailOpen && <div className="detail-scrim" aria-hidden="true" onClick={() => closeDetailPanel(true)} />}
      {currentPage === 'catalog' && <aside ref={detailPanelRef} className={`detail-panel ${detailOpen ? 'mobile-open' : ''}`} role={viewport.compact && detailOpen ? 'dialog' : undefined} aria-modal={viewport.compact && detailOpen ? 'true' : undefined} aria-label={viewport.compact && detailOpen ? t('detail.dialogLabel', { name: activeApi.name }) : t('detail.selectedDetails')} aria-hidden={viewport.compact && !detailOpen} inert={mobileNav || (viewport.compact && !detailOpen) ? true : undefined} data-api-id={activeApi.id} data-agent-execution={agentExecutionPolicy.mode} data-automated-verification={automatedVerificationPolicy.mode} data-verification-minimum-interval-seconds={automatedVerificationPolicy.mode === 'cadence-limited' ? automatedVerificationPolicy.minimumIntervalSeconds : undefined} data-verification-retry-on-rate-limit={automatedVerificationPolicy.mode === 'enabled' && automatedVerificationPolicy.retryOnRateLimit === false ? 'false' : undefined} data-verification-rate-limit-statuses={automatedVerificationPolicy.mode === 'enabled' && automatedVerificationPolicy.rateLimitStatuses?.length ? automatedVerificationPolicy.rateLimitStatuses.join(',') : undefined}>
        <div className="detail-head"><span>{t('detail.selectedModule')}</span>{viewport.compact && <button ref={detailCloseRef} type="button" onClick={() => closeDetailPanel(true)} aria-label={t('detail.close')}><Icon name="x" /></button>}</div>
        <div className="detail-title"><span style={{ '--api-color': activeApi.accent } as React.CSSProperties}>{activeApi.monogram}</span><div lang="en"><h2 ref={detailHeadingRef} tabIndex={-1}>{activeApi.name}</h2><small lang={locale}>{t('detail.demoPick')}</small></div></div>
        <p className="detail-description" lang="en">{activeApi.description}</p>
        <div className="detail-tags"><span className="tag green">{t('detail.curatedDemo')}</span><span className="tag blue">{KEYLESS_TAG_LABEL}</span><span className={`tag ${activeApi.risk === 'Review' ? 'plain' : 'green'}`}>{t('detail.riskSuffix', { risk: activeApi.risk ?? DEFAULT_RISK })}</span><span className="tag plain">{activeApi.category}</span></div>
        <section className="detail-box"><div className="box-title"><span>{t('detail.contractSource')}</span><b>{t('detail.riskSuffix', { risk: activeApi.risk ?? DEFAULT_RISK })}</b></div><dl><div><dt>{t('detail.sourceHost')}</dt><dd>{new URL(activeApi.documentationUrl).hostname}</dd></div><div><dt>{t('detail.documentation')}</dt><dd>{t('detail.linked')}</dd></div><div><dt>{t('detail.liveHealth')}</dt><dd>{t('detail.checkLab')}</dd></div><div><dt>{t('detail.agentExecution')}</dt><dd>{agentExecutionPolicy.mode === 'manual-only' ? t('detail.manualOnly') : t('detail.webmcpAvailable')}</dd></div><div><dt>{t('detail.attribution')}</dt><dd>{t('detail.reviewProviderDocs')}</dd></div></dl></section>
        <section className="detail-box"><div className="box-title"><span>{t('detail.usageLicence')}</span><b>{t('detail.reviewTerms')}</b></div><p><small>{t('detail.importantNotes')}</small><span lang={activeApi.usageNote ? 'en' : locale}>{activeApi.usageNote ?? t('detail.defaultUsage')}</span></p><a href={activeApi.documentationUrl} target="_blank" rel="noreferrer">{t('detail.openDocs')} <Icon name="external" size={12} /></a></section>
        <section className="detail-box endpoint-detail"><div className="box-title"><span>{t('detail.endpoint')}</span><b>{activeApi.method ?? DEFAULT_HTTP_METHOD}</b></div><code>{endpoint}</code></section>
        <div className="detail-actions"><button className="primary-action" type="button" onClick={trySelectedApi} data-agent-execution={agentExecutionPolicy.mode}>{agentExecutionPolicy.mode === 'manual-only' ? <><Icon name="activity" size={15} /> {t('detail.openInteractiveLab')}</> : <><Icon name="play" size={15} /> {t('request.tryLive')}</>}</button>{agentExecutionPolicy.mode === 'enabled' && <button type="button" onClick={copyFetch}><Icon name="code" size={15} /> {t('detail.copyFetch')}</button>}</div>
      </aside>}
    </div>
  )
}

export default App
