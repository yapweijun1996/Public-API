import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  apiCatalog,
  getDefaultParameters,
  validateParameters,
  type ApiCategory,
  type ApiDemo,
} from './apiCatalog'
import { useWebMcp, type AdminSection } from './webmcp'

type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: unknown; httpStatus: number; elapsed: number; size: number; url: string }
  | { status: 'error'; message: string; url: string }

type IconName =
  | 'activity'
  | 'agent'
  | 'alert'
  | 'api'
  | 'arrow'
  | 'bell'
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
  | 'settings'
  | 'shield'
  | 'spark'
  | 'users'
  | 'x'

const categories: Array<'All' | ApiCategory> = ['All', 'Data', 'Utility', 'People', 'Nature']

const paths: Record<IconName, React.ReactNode> = {
  activity: <><path d="M3 12h4l2-7 4 14 2-7h6" /></>,
  agent: <><rect x="4" y="7" width="16" height="12" rx="3" /><path d="M9 12h.01M15 12h.01M9 16h6M12 7V3M10 3h4" /></>,
  alert: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  api: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
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
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
  spark: <><path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3Z" /><path d="m5 14-.9 2.1L2 17l2.1.9L5 20l.9-2.1L8 17l-2.1-.9L5 14Z" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  x: <path d="M18 6 6 18M6 6l12 12" />,
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

async function fetchApi(api: ApiDemo, parameters: Record<string, string>) {
  const url = api.buildUrl(parameters)
  const started = performance.now()
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  const text = await response.text()
  let data: unknown
  try { data = JSON.parse(text) as unknown } catch { data = text }
  if (!response.ok) throw new Error(`The API returned ${response.status} ${response.statusText}.`)
  return { data, httpStatus: response.status, elapsed: Math.round(performance.now() - started), size: new Blob([text]).size, url }
}

const formatBytes = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
const codeSample = (url: string) => `const response = await fetch('${url}', {\n  headers: { Accept: 'application/json' },\n});\n\nconst data = await response.json();`

const navGroups: Array<{ label: string; items: Array<{ label: string; icon: IconName; section?: AdminSection; badge?: string }> }> = [
  { label: '', items: [{ label: 'Overview', icon: 'home' }] },
  { label: 'Discover', items: [{ label: 'API Catalog', icon: 'api', section: 'catalog' }, { label: 'Collections', icon: 'box' }, { label: 'Providers', icon: 'database' }, { label: 'Tags', icon: 'filter' }] },
  { label: 'Operate', items: [{ label: 'Request Lab', icon: 'activity', section: 'request-lab' }, { label: 'Agent Tools', icon: 'agent', section: 'agent-tools', badge: '5' }, { label: 'Health', icon: 'shield' }] },
  { label: 'Admin', items: [{ label: 'Settings', icon: 'settings' }, { label: 'Users & Teams', icon: 'users' }, { label: 'Documentation', icon: 'book' }] },
]

function App() {
  const [selectedId, setSelectedId] = useState(apiCatalog[0].id)
  const [parameters, setParameters] = useState<Record<string, string>>(getDefaultParameters(apiCatalog[0]))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [request, setRequest] = useState<RequestState>({ status: 'idle' })
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('All')
  const [mobileNav, setMobileNav] = useState(false)
  const [viewport, setViewport] = useState(() => ({
    compact: window.matchMedia('(max-width: 1180px)').matches,
    mobile: window.matchMedia('(max-width: 760px)').matches,
  }))
  const [detailOpen, setDetailOpen] = useState(() => !window.matchMedia('(max-width: 1180px)').matches)
  const [outputTab, setOutputTab] = useState<'response' | 'code'>('response')
  const [copied, setCopied] = useState(false)
  const catalogRef = useRef<HTMLElement>(null)
  const labRef = useRef<HTMLElement>(null)
  const agentRef = useRef<HTMLElement>(null)

  const activeApi = apiCatalog.find((api) => api.id === selectedId) ?? apiCatalog[0]

  useEffect(() => {
    const compactQuery = window.matchMedia('(max-width: 1180px)')
    const mobileQuery = window.matchMedia('(max-width: 760px)')
    const updateViewport = () => {
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

  const filteredApis = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return apiCatalog.filter((api) => {
      const matchesCategory = category === 'All' || api.category === category
      const matchesSearch = !needle || `${api.name} ${api.provider} ${api.category} ${api.description}`.toLowerCase().includes(needle)
      return matchesCategory && matchesSearch
    })
  }, [category, query])

  const navigateSection = useCallback((section: AdminSection) => {
    const refs = { catalog: catalogRef, 'request-lab': labRef, 'agent-tools': agentRef }
    refs[section].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMobileNav(false)
  }, [])

  const filterCatalog = useCallback((nextQuery: string, nextCategory: string) => {
    setQuery(nextQuery)
    if (categories.includes(nextCategory as (typeof categories)[number])) setCategory(nextCategory)
  }, [])

  const selectApi = useCallback((id: string, openOnMobile = true) => {
    const api = apiCatalog.find((candidate) => candidate.id === id)
    if (!api) return
    setSelectedId(id)
    setParameters(getDefaultParameters(api))
    setErrors({})
    setRequest({ status: 'idle' })
    setOutputTab('response')
    if (openOnMobile) setDetailOpen(true)
  }, [])

  const runForAgent = useCallback(async (api: ApiDemo, values: Record<string, string>) => {
    const nextErrors = validateParameters(api, values)
    if (Object.keys(nextErrors).length) throw new Error(Object.values(nextErrors).join(' '))
    setSelectedId(api.id)
    setParameters(values)
    setRequest({ status: 'loading' })
    try {
      const result = await fetchApi(api, values)
      setRequest({ status: 'success', ...result })
      return result.data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The request failed.'
      setRequest({ status: 'error', message, url: api.buildUrl(values) })
      throw error
    }
  }, [])

  const selectApiForAgent = useCallback((id: string) => {
    selectApi(id, true)
    requestAnimationFrame(() => labRef.current?.scrollIntoView({ behavior: 'smooth' }))
  }, [selectApi])

  const webMcpStatus = useWebMcp({ onSelectApi: selectApiForAgent, onRunApi: runForAgent, onNavigate: navigateSection, onFilter: filterCatalog })
  const endpoint = activeApi.buildUrl(parameters)

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateParameters(activeApi, parameters)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    await runForAgent(activeApi, parameters).catch(() => undefined)
  }

  const copyFetch = async () => {
    await navigator.clipboard.writeText(codeSample(endpoint))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="admin-shell">
      <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`} aria-hidden={viewport.mobile && !mobileNav} inert={viewport.mobile && !mobileNav ? true : undefined}>
        <div className="sidebar-brand">
          <span className="logo-cube"><i /></span>
          <div><b>API Console</b><small>Govern • Discover • Operate</small></div>
          <button className="mobile-close" type="button" onClick={() => setMobileNav(false)} aria-label="Close navigation"><Icon name="x" /></button>
        </div>
        <nav aria-label="Admin navigation">
          {navGroups.map((group, index) => (
            <div className="nav-group" key={`${group.label}-${index}`}>
              {group.label && <span className="nav-label">{group.label}</span>}
              {group.items.map((item) => (
                <button type="button" className={item.section === 'catalog' ? 'active' : ''} key={item.label} onClick={() => item.section && navigateSection(item.section)}>
                  <Icon name={item.icon} size={17} /><span>{item.label}</span>{item.badge && <em>{item.badge}</em>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-environment"><Icon name="database" /><div><small>Environment</small><b><i /> Production</b></div><Icon name="chevron" size={14} /></div>
        <div className="sidebar-version">API Console v1.0.0</div>
      </aside>

      {mobileNav && <button className="nav-scrim" type="button" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

      <div className="admin-main">
        <header className="topbar">
          <button className="menu-button" type="button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Icon name="menu" /></button>
          <div className="page-title"><h1>API Catalog</h1><p>Discover, evaluate and operate trusted public APIs</p></div>
          <label className="global-search"><Icon name="search" size={17} /><span className="sr-only">Search APIs</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search APIs, tags, providers…" /><kbd>⌘ K</kbd></label>
          <button className="icon-button has-dot" type="button" aria-label="Notifications"><Icon name="bell" /></button>
          <button className="icon-button" type="button" aria-label="Help"><Icon name="help" /></button>
          <div className="admin-profile"><span>AD</span><div><b>Admin</b><small>Platform Admin</small></div><Icon name="chevron" size={14} /></div>
        </header>

        <main className="dashboard">
          <section className="metric-grid" aria-label="API catalog summary">
            {[
              { label: 'Total APIs', value: apiCatalog.length, note: '100% of catalog', icon: 'box' as IconName, tone: 'blue' },
              { label: 'Source linked', value: apiCatalog.length, note: 'Documentation attached', icon: 'link' as IconName, tone: 'blue' },
              { label: 'Business review', value: 5, note: 'Demo ready', icon: 'shield' as IconName, tone: 'green' },
              { label: 'Low risk', value: 5, note: 'Keyless GET requests', icon: 'activity' as IconName, tone: 'green' },
              { label: 'No key', value: apiCatalog.length, note: 'No signup required', icon: 'alert' as IconName, tone: 'orange' },
              { label: 'Agent tools', value: 5, note: 'WebMCP controls', icon: 'agent' as IconName, tone: 'violet' },
            ].map((metric) => (
              <article className="metric-card" key={metric.label}>
                <span className={`metric-icon ${metric.tone}`}><Icon name={metric.icon} /></span>
                <div><strong>{metric.value}</strong><b>{metric.label}</b><small>{metric.note}</small></div>
              </article>
            ))}
          </section>

          <section className="catalog-panel" ref={catalogRef} aria-labelledby="catalog-heading">
            <div className="panel-heading">
              <div><h2 id="catalog-heading">Public API inventory</h2><p>Select an API to inspect its source, parameters and live response.</p></div>
              <div className={`agent-connection ${webMcpStatus}`}><i /><span>{webMcpStatus === 'ready' ? 'Agent connected' : webMcpStatus === 'unsupported' ? 'Browser preview' : webMcpStatus === 'error' ? 'Agent unavailable' : 'Checking WebMCP'}</span></div>
            </div>
            <div className="catalog-toolbar">
              <label className="module-search"><Icon name="search" size={16} /><span className="sr-only">Search catalog</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, description, or provider…" /></label>
              <select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option value={item} key={item}>{item === 'All' ? 'All categories' : item}</option>)}</select>
              <button className="toolbar-button" type="button"><Icon name="filter" size={15} /> Filters</button>
              <span className="result-count">{filteredApis.length} APIs</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead><tr><th aria-label="Selection" /><th>API</th><th>Provider / Source</th><th>Quality</th><th>Risk</th><th>Tags</th><th>Last reviewed</th><th>Status</th></tr></thead>
                <tbody>
                  {filteredApis.map((api, index) => (
                    <tr className={api.id === selectedId ? 'selected' : ''} key={api.id}>
                      <td><input type="radio" name="selected-api" checked={api.id === selectedId} onChange={() => selectApi(api.id)} aria-label={`Select ${api.name}`} /></td>
                      <td data-label="API"><button className="api-identity" type="button" onClick={() => selectApi(api.id)}><span style={{ '--api-color': api.accent } as React.CSSProperties}>{api.monogram}</span><div><b>{api.name}</b><small>{api.description}</small></div></button></td>
                      <td data-label="Provider"><div className="provider-cell"><b>{api.provider}</b><a href={api.documentationUrl} target="_blank" rel="noreferrer">Documentation <Icon name="external" size={11} /></a></div></td>
                      <td data-label="Quality"><span className="tag green">verified</span></td>
                      <td data-label="Risk"><span className="risk"><Icon name="shield" size={14} /> Low</span></td>
                      <td data-label="Tags"><div className="tags"><span className="tag blue">no-key</span><span className="tag green">GET</span><span className="tag plain">{api.category}</span></div></td>
                      <td data-label="Reviewed">2026-07-{String(14 - Math.min(index, 5)).padStart(2, '0')}</td>
                      <td data-label="Status"><span className="source-status"><i /> source-linked</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredApis.length === 0 && <div className="catalog-empty"><Icon name="search" /><b>No matching APIs</b><p>Clear the search or choose another category.</p></div>}
            </div>
            <div className="table-footer"><span>Showing {filteredApis.length} of {apiCatalog.length} APIs</span><div><button type="button" disabled>‹</button><button type="button" className="current">1</button><button type="button" disabled>›</button></div></div>
          </section>

          <section className="request-lab" ref={labRef} aria-labelledby="lab-heading">
            <div className="section-title"><span><Icon name="activity" /></span><div><h2 id="lab-heading">Request lab</h2><p>Run the selected public API and inspect the raw response.</p></div></div>
            <div className="lab-grid">
              <form className="parameter-card" onSubmit={submitRequest} noValidate>
                <div className="active-api"><span style={{ '--api-color': activeApi.accent } as React.CSSProperties}>{activeApi.monogram}</span><div><small>Selected module</small><b>{activeApi.name}</b></div><a href={activeApi.documentationUrl} target="_blank" rel="noreferrer">Docs <Icon name="external" size={12} /></a></div>
                <div className="endpoint-box"><span>GET</span><code>{endpoint}</code></div>
                <div className="parameter-heading"><b>Parameters</b><small>{activeApi.fields.length} required</small></div>
                <div className="parameter-fields">
                  {activeApi.fields.map((field) => (
                    <label key={field.id}><span>{field.label}<em>required</em></span>
                      {field.type === 'select' ? <select value={parameters[field.id] ?? ''} onChange={(event) => setParameters((current) => ({ ...current, [field.id]: event.target.value }))}>{field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select> : <input type={field.type} min={field.min} max={field.max} value={parameters[field.id] ?? ''} placeholder={field.placeholder} aria-invalid={Boolean(errors[field.id])} onChange={(event) => setParameters((current) => ({ ...current, [field.id]: event.target.value }))} />}
                      <small className={errors[field.id] ? 'error' : ''}>{errors[field.id] ?? field.help}</small>
                    </label>
                  ))}
                </div>
                <button className="primary-action" type="submit" disabled={request.status === 'loading'}>{request.status === 'loading' ? <span className="spinner" /> : <Icon name="play" size={16} />}{request.status === 'loading' ? 'Running request…' : 'Try live API'}</button>
              </form>
              <div className="response-card">
                <div className="response-head"><div role="tablist" aria-label="Request output"><button role="tab" aria-selected={outputTab === 'response'} type="button" onClick={() => setOutputTab('response')}>Response</button><button role="tab" aria-selected={outputTab === 'code'} type="button" onClick={() => setOutputTab('code')}>Fetch code</button></div>{request.status === 'success' && <span className="response-meta"><b>{request.httpStatus} OK</b>{request.elapsed} ms · {formatBytes(request.size)}</span>}<button type="button" className="copy-output" onClick={copyFetch}><Icon name={copied ? 'check' : 'copy'} size={14} />{copied ? 'Copied' : 'Copy'}</button></div>
                <div className="response-body" aria-live="polite">
                  {outputTab === 'code' ? <pre>{codeSample(endpoint)}</pre> : request.status === 'idle' ? <div className="response-empty"><span><Icon name="play" /></span><b>Ready to test</b><p>Configure the parameters and run this API.</p></div> : request.status === 'loading' ? <div className="response-empty"><span><Icon name="activity" /></span><b>Contacting {activeApi.provider}</b><p>Waiting for the public endpoint…</p></div> : request.status === 'error' ? <div className="response-error"><Icon name="alert" /><b>Request failed</b><p>{request.message}</p></div> : <pre>{JSON.stringify(request.data, null, 2)}</pre>}
                </div>
              </div>
            </div>
          </section>

          <section className="agent-section" ref={agentRef} aria-labelledby="agent-heading">
            <div className="agent-intro"><span className="agent-hero-icon"><Icon name="agent" size={26} /></span><p className="eyebrow">WebMCP control layer</p><h2 id="agent-heading">Built for people.<br />Operable by AI agents.</h2><p>The same actions a person performs in this console are exposed as typed browser tools. Agent actions update the visible interface, preserving shared context and user control.</p><div className={`webmcp-state ${webMcpStatus}`}><i /><div><b>{webMcpStatus === 'ready' ? 'WebMCP tools registered' : webMcpStatus === 'unsupported' ? 'WebMCP preview not available in this browser' : 'Checking WebMCP support'}</b><small>The admin console remains fully usable without agent support.</small></div></div></div>
            <div className="tool-list">
              {[
                ['list_public_api_demos', 'Discover APIs and input schemas', 'Read'],
                ['filter_public_api_catalog', 'Search and filter the visible inventory', 'Control'],
                ['navigate_api_console', 'Open catalog, request lab, or agent tools', 'Control'],
                ['open_public_api_demo', 'Select a module in the shared UI', 'Control'],
                ['run_public_api_demo', 'Execute a live request and return JSON', 'Execute'],
              ].map(([name, description, type], index) => <article key={name}><span>0{index + 1}</span><div><code>{name}</code><p>{description}</p></div><em>{type}</em><Icon name="check" /></article>)}
            </div>
          </section>
        </main>
      </div>

      <aside className={`detail-panel ${detailOpen ? 'mobile-open' : ''}`} aria-label="Selected API details" aria-hidden={viewport.compact && !detailOpen} inert={viewport.compact && !detailOpen ? true : undefined}>
        <div className="detail-head"><span>Selected module</span><button type="button" onClick={() => setDetailOpen(false)} aria-label="Close details"><Icon name="x" /></button></div>
        <div className="detail-title"><span style={{ '--api-color': activeApi.accent } as React.CSSProperties}>{activeApi.monogram}</span><div><h2>{activeApi.name}</h2><small>DEMO PICK</small></div></div>
        <p className="detail-description">{activeApi.description}</p>
        <div className="detail-tags"><span className="tag green">Recommended demo</span><span className="tag blue">no-key</span><span className="tag green">Low risk</span><span className="tag plain">{activeApi.category}</span></div>
        <section className="detail-box"><div className="box-title"><span>Quality & source</span><b>low</b></div><dl><div><dt>Source host</dt><dd>{new URL(activeApi.documentationUrl).hostname}</dd></div><div><dt>Review status</dt><dd>source-linked</dd></div><div><dt>Production readiness</dt><dd>demo-ready</dd></div><div><dt>Attribution</dt><dd>Review provider documentation</dd></div></dl></section>
        <section className="detail-box"><div className="box-title"><span>Usage / licence</span><b>Review terms</b></div><p><small>Commercial use</small>Suitable for demonstration and internal prototyping. Review the provider terms before production use.</p><a href={activeApi.documentationUrl} target="_blank" rel="noreferrer">Open official documentation <Icon name="external" size={12} /></a></section>
        <section className="detail-box endpoint-detail"><div className="box-title"><span>Endpoint</span><b>GET</b></div><code>{endpoint}</code></section>
        <div className="detail-actions"><button className="primary-action" type="button" onClick={() => { setDetailOpen(false); navigateSection('request-lab') }}><Icon name="play" size={15} /> Try live API</button><button type="button" onClick={copyFetch}><Icon name="code" size={15} /> Copy fetch</button></div>
      </aside>
    </div>
  )
}

export default App
