import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  scope: 'deterministic i18n browser contract with one synthetic World Bank response; no live provider requests',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const assertCompactTouchTargets = async (b, selectors, label) => {
  const metrics = await b.ev(`(()=>{const selectors=${JSON.stringify(selectors)};return selectors.flatMap((selector)=>Array.from(document.querySelectorAll(selector)).map((element)=>{const rect=element.getBoundingClientRect();const style=getComputedStyle(element);return {selector,name:element.getAttribute('aria-label')||element.textContent?.trim()||element.getAttribute('name')||element.id||element.tagName,width:rect.width,height:rect.height,display:style.display,visibility:style.visibility,inert:Boolean(element.closest('[inert]'))}})).filter((entry)=>entry.display!=='none'&&entry.visibility!=='hidden'&&!entry.inert)})()`)
  assert(metrics.length > 0, `${label}: no compact touch targets were found`)
  const undersized = metrics.filter((entry) => entry.width < 43.5 || entry.height < 43.5)
  assert.deepEqual(undersized, [], `${label}: compact touch targets must be at least 44x44 CSS px: ${JSON.stringify(undersized)}`)
  return metrics.length
}
const countryUrl = 'https://api.worldbank.org/v2/country/SGP?format=json'
const countryFixture = [
  { page: 1, pages: 1, per_page: '50', total: 1 },
  [{ id: 'SGP', iso2Code: 'SG', name: 'Singapore', capitalCity: 'Singapore', region: { id: 'EAS', value: 'East Asia & Pacific' }, incomeLevel: { id: 'HIC', value: 'High income' } }],
]
let b
try {
  b = await browser(`${root}/dist`, { fixtures: new Map([[countryUrl, { body: countryFixture }]]) })
  await b.viewport(1440, 1000)
  await b.call('Page.navigate', { url: 'https://yapweijun1996.github.io/Public-API/#/catalog' })
  await b.wait(`document.querySelector('.catalog-panel') && document.querySelector('.locale-control select')`)

  const initial = await b.ev(`({
    lang: document.documentElement.lang,
    title: document.querySelector('.page-title h1')?.textContent || '',
    locale: document.querySelector('.locale-control select')?.value || '',
    catalogRows: document.querySelectorAll('tbody tr[data-api-id]').length,
    selectedId: document.querySelector('tbody tr[data-selected="true"]')?.dataset.apiId || '',
  })`)
  assert.deepEqual(initial, { lang: 'en', title: 'API Catalog', locale: 'en', catalogRows: 50, selectedId: 'countries' })

  await b.ev(`(()=>{const select=document.querySelector('.locale-control select');select.value='zh-CN';select.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
  await b.wait(`document.documentElement.lang === 'zh-CN' && document.querySelector('.page-title h1')?.textContent === 'API 目录'`)
  const zhCatalog = await b.ev(`({
    lang: document.documentElement.lang,
    title: document.querySelector('.page-title h1')?.textContent || '',
    searchLabel: document.querySelector('.module-search input')?.getAttribute('aria-label') || '',
    filterLabel: document.querySelector('.catalog-toolbar select:not(.locale-control select)')?.getAttribute('aria-label') || '',
    firstApiId: document.querySelector('tbody tr[data-api-id]')?.dataset.apiId || '',
    stored: localStorage.getItem('public-api.ui-locale'),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  })`)
  assert.equal(zhCatalog.lang, 'zh-CN')
  assert.equal(zhCatalog.title, 'API 目录')
  assert.equal(zhCatalog.searchLabel, '搜索目录')
  assert.equal(zhCatalog.filterLabel, '按类别筛选')
  assert.equal(zhCatalog.firstApiId, 'countries')
  assert.equal(zhCatalog.stored, 'zh-CN')
  assert.equal(zhCatalog.overflow, false)

  await b.ev(`location.hash='#/request-lab?api=countries'`)
  await b.wait(`document.querySelector('.request-lab')?.dataset.apiId === 'countries' && document.querySelector('.page-title h1')?.textContent === '请求实验室'`)
  const zhLab = await b.ev(`({
    title: document.querySelector('.page-title h1')?.textContent || '',
    heading: document.querySelector('#lab-heading')?.textContent || '',
    formLabel: document.querySelector('form.parameter-card')?.getAttribute('aria-label') || '',
    apiId: document.querySelector('.request-lab')?.dataset.apiId || '',
    runLabel: document.querySelector('.parameter-card .primary-action')?.textContent?.trim() || '',
  })`)
  assert.equal(zhLab.title, '请求实验室')
  assert.equal(zhLab.heading, '请求实验室')
  assert.equal(zhLab.formLabel, '配置 Country Explorer')
  assert.equal(zhLab.apiId, 'countries')
  assert.match(zhLab.runLabel, /运行实时 API/)

  await b.ev(`document.querySelector('.parameter-card').requestSubmit()`)
  await b.wait(`document.querySelector('.request-lab')?.dataset.requestState === 'success' && document.querySelector('.demo-preview')`)
  const zhResultShell = await b.ev(`(()=>{const preview=document.querySelector('.demo-preview');const context=preview?.querySelector('.demo-preview-context');const runtime=preview?.querySelector('.ssot-runtime');return {
    status: preview?.querySelector('[role="status"]')?.textContent || '',
    badge: preview?.querySelector('.live-response-badge')?.textContent?.trim() || '',
    contextLabel: context?.getAttribute('aria-label') || '',
    contextText: context?.textContent || '',
    runtimeLabel: runtime?.getAttribute('aria-label') || '',
    httpLabel: runtime?.querySelector('b')?.getAttribute('aria-label') || '',
    headingLang: preview?.querySelector('h2')?.getAttribute('lang') || '',
    descriptionLang: preview?.querySelector('.demo-preview-copy > p')?.getAttribute('lang') || '',
    profileLang: preview?.querySelector('.preview-profile-badge')?.getAttribute('lang') || '',
  }})()`)
  assert.equal(zhResultShell.status, '已收到 Country Explorer 的实时响应。')
  assert.equal(zhResultShell.badge, '实时响应')
  assert.equal(zhResultShell.contextLabel, 'API 上下文')
  assert.match(zhResultShell.contextText, /提供方 · World Bank/)
  assert.match(zhResultShell.contextText, /类别 · Data/)
  assert.equal(zhResultShell.runtimeLabel, '实时请求元数据')
  assert.equal(zhResultShell.httpLabel, 'HTTP 状态 200')
  assert.equal(zhResultShell.headingLang, 'en')
  assert.equal(zhResultShell.descriptionLang, 'en')
  assert.equal(zhResultShell.profileLang, 'en')
  assert(!/ready|就绪/i.test(zhResultShell.status))

  await b.ev(`location.hash='#/collections'`)
  await b.wait(`document.querySelector('.page-title h1')?.textContent === '集合' && document.querySelector('#workspace-heading')?.textContent === '精选工作区'`)
  const zhCollections = await b.ev(`({
    route: location.hash,
    workspaceLabel: document.querySelector('.workspace-hero > p')?.textContent || '',
    firstCard: document.querySelector('.workspace-grid article h3')?.textContent || '',
    primaryAction: document.querySelector('.workspace-actions .primary-action')?.textContent?.trim() || '',
  })`)
  assert.deepEqual(zhCollections, { route: '#/collections', workspaceLabel: '工作区', firstCard: '免密入门合集', primaryAction: '打开 API 目录' })

  await b.ev(`location.hash='#/providers'`)
  await b.wait(`document.querySelector('.page-title h1')?.textContent === '提供方' && document.querySelector('#workspace-heading')?.textContent === '来源目录'`)
  const zhProviders = await b.ev(`(()=>{const card=document.querySelector('.workspace-grid article');return {
    route: location.hash,
    title: card?.querySelector('h3')?.textContent || '',
    titleLang: card?.querySelector('h3')?.getAttribute('lang') || '',
    description: card?.querySelector('p')?.textContent || '',
    descriptionLang: card?.querySelector('p')?.getAttribute('lang') || '',
  }})()`)
  assert.equal(zhProviders.route, '#/providers')
  assert.ok(zhProviders.title)
  assert.equal(zhProviders.titleLang, 'en')
  assert.ok(zhProviders.description)
  assert.equal(zhProviders.descriptionLang, 'en')

  await b.ev(`(()=>{const select=document.querySelector('.locale-control select');select.value='en';select.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
  await b.wait(`document.documentElement.lang === 'en' && document.querySelector('.page-title h1')?.textContent === 'Providers'`)
  const enProviderIdentity = await b.ev(`(()=>{const card=document.querySelector('.workspace-grid article');return {route:location.hash,title:card?.querySelector('h3')?.textContent || '',description:card?.querySelector('p')?.textContent || ''}})()`)
  assert.deepEqual(enProviderIdentity, { route: '#/providers', title: zhProviders.title, description: zhProviders.description })
  await b.ev(`(()=>{const select=document.querySelector('.locale-control select');select.value='zh-CN';select.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
  await b.wait(`document.documentElement.lang === 'zh-CN' && document.querySelector('.page-title h1')?.textContent === '提供方'`)

  await b.ev(`location.hash='#/tags'`)
  await b.wait(`document.querySelector('.page-title h1')?.textContent === '标签' && document.querySelector('#workspace-heading')?.textContent === '目录分类体系'`)
  const zhTags = await b.ev(`(()=>{const card=document.querySelector('.workspace-grid article');return {
    route: location.hash,
    title: card?.querySelector('h3')?.textContent || '',
    titleLang: card?.querySelector('h3')?.getAttribute('lang') || '',
    description: card?.querySelector('p')?.textContent || '',
  }})()`)
  assert.deepEqual(zhTags, { route: '#/tags', title: 'no-key', titleLang: 'en', description: '无需 API key 或注册账号。' })

  await b.ev(`location.hash='#/health'`)
  await b.wait(`document.querySelector('.page-title h1')?.textContent === '健康状态' && document.querySelector('#workspace-heading')?.textContent === '目录就绪状态'`)
  const zhHealth = await b.ev(`(()=>{const card=document.querySelector('.workspace-grid article');return {
    route: location.hash,
    description: document.querySelector('.workspace-hero small')?.textContent || '',
    apiLang: card?.querySelector('h3')?.getAttribute('lang') || '',
    providerLang: card?.querySelector('p')?.getAttribute('lang') || '',
    action: document.querySelector('.workspace-actions .primary-action')?.textContent?.trim() || '',
  }})()`)
  assert.equal(zhHealth.route, '#/health')
  assert.match(zhHealth.description, /静态目录元数据/)
  assert.equal(zhHealth.apiLang, 'en')
  assert.equal(zhHealth.providerLang, 'en')
  assert.equal(zhHealth.action, '打开请求实验室')

  await b.ev(`location.hash='#/documentation'`)
  await b.wait(`document.querySelector('.page-title h1')?.textContent === '文档' && document.querySelector('#workspace-heading')?.textContent === '开发者指南'`)
  const zhDocumentation = await b.ev(`({
    route: location.hash,
    firstCard: document.querySelector('.workspace-grid article h3')?.textContent || '',
    firstMetaLang: document.querySelector('.workspace-grid article > span')?.getAttribute('lang') || '',
    primaryAction: document.querySelector('.workspace-actions .primary-action')?.textContent?.trim() || '',
  })`)
  assert.deepEqual(zhDocumentation, { route: '#/documentation', firstCard: '1. 添加模块', firstMetaLang: 'en', primaryAction: '打开 API 目录' })

  await b.ev(`location.hash='#/request-lab?api=countries'`)
  await b.wait(`document.querySelector('.request-lab')?.dataset.apiId === 'countries' && document.querySelector('.page-title h1')?.textContent === '请求实验室'`)

  await b.viewport(1440, 1000)
  await b.ev(`location.hash='#/catalog'`)
  await b.wait(`document.querySelector('.page-title h1')?.textContent === 'API 目录' && !document.querySelector('.detail-panel')?.hasAttribute('inert')`)
  const desktopDetailFocus = await b.ev(`(()=>{const panel=document.querySelector('.detail-panel');const action=panel?.querySelector('.detail-actions .primary-action');action?.focus();return {inside:panel?.contains(document.activeElement) ?? false,text:document.activeElement?.textContent?.trim() || ''}})()`)
  assert.equal(desktopDetailFocus.inside, true)
  assert.ok(desktopDetailFocus.text)
  await b.viewport(1024, 800)
  await b.wait(`document.activeElement?.classList?.contains('api-identity') && document.activeElement.closest('tr')?.dataset.apiId === 'countries'`)
  const compactResizeFocus = await b.ev(`(()=>{const panel=document.querySelector('.detail-panel');const active=document.activeElement;return {apiId:active?.closest('tr')?.dataset.apiId || '',activeClass:active?.className || '',panelHidden:panel?.getAttribute('aria-hidden') || '',panelInert:panel?.hasAttribute('inert') ?? false,focusInsideHiddenPanel:panel?.contains(active) ?? false}})()`)
  assert.deepEqual(compactResizeFocus, { apiId: 'countries', activeClass: 'api-identity', panelHidden: 'true', panelInert: true, focusInsideHiddenPanel: false })

  await b.ev(`document.querySelector('tr[data-api-id="countries"] .api-identity')?.click()`)
  await b.wait(`document.querySelector('.detail-panel[role="dialog"]') && document.activeElement?.getAttribute('aria-label') === '关闭所选 API 详情'`)
  await b.viewport(1440, 1000)
  await b.wait(`!document.querySelector('button[aria-label="关闭所选 API 详情"]') && document.activeElement === document.querySelector('.detail-title h2')`)
  const desktopResizeFocus = await b.ev(`(()=>{const panel=document.querySelector('.detail-panel');const active=document.activeElement;return {apiId:panel?.dataset.apiId || '',heading:active?.textContent || '',headingTabIndex:active?.tabIndex,panelInert:panel?.hasAttribute('inert') ?? false,focusInsidePanel:panel?.contains(active) ?? false}})()`)
  assert.deepEqual(desktopResizeFocus, { apiId: 'countries', heading: 'Country Explorer', headingTabIndex: -1, panelInert: false, focusInsidePanel: true })

  await b.viewport(390, 844)
  await b.ev(`location.hash='#/catalog'`)
  await b.wait(`document.querySelector('.page-title h1')?.textContent === 'API 目录' && document.querySelector('tr[data-api-id="countries"]')`)
  const mobile = await b.ev(`(()=>{const row=document.querySelector('tr[data-api-id="countries"]');return {
    lang: document.documentElement.lang,
    localeLabel: document.querySelector('.locale-control select')?.getAttribute('aria-label') || '',
    primaryNavigationLabel: document.querySelector('#primary-navigation')?.getAttribute('aria-label') || '',
    navLabel: document.querySelector('#primary-navigation nav')?.getAttribute('aria-label') || '',
    mobileLabels: Array.from(row?.querySelectorAll('td[data-label]') || []).map((cell)=>cell.getAttribute('data-label')),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }})()`)
  assert.equal(mobile.lang, 'zh-CN')
  assert.equal(mobile.localeLabel, '界面语言')
  assert.equal(mobile.primaryNavigationLabel, '主导航')
  assert.equal(mobile.navLabel, '主导航')
  assert.deepEqual(mobile.mobileLabels, ['API', '提供方 / 来源', '风险', '标签'])
  assert.equal(mobile.overflow, false)
  const catalogTouchTargets = await assertCompactTouchTargets(b, ['.menu-button', '.locale-control select', '.icon-button', '.module-search input', '.catalog-toolbar select', '.table-footer button', '.api-radio-target', '.provider-cell a'], 'mobile catalog')

  await b.ev(`document.querySelector('.menu-button')?.click()`)
  await b.wait(`document.querySelector('#primary-navigation[role="dialog"]') && document.activeElement?.getAttribute('aria-label') === '关闭导航菜单'`)
  const navigationTouchTargets = await assertCompactTouchTargets(b, ['.mobile-close', '.nav-group button'], 'mobile navigation')
  await b.ev(`document.querySelector('#primary-navigation nav button.active')?.click()`)
  await b.wait(`!document.querySelector('#primary-navigation[role="dialog"]') && document.activeElement?.classList?.contains('menu-button')`)
  const sameRouteNavFocus = await b.ev(`({ hash: location.hash, focusClass: document.activeElement?.className || '', sidebarInert: document.querySelector('#primary-navigation')?.hasAttribute('inert') ?? false })`)
  assert.deepEqual(sameRouteNavFocus, { hash: '#/catalog', focusClass: 'menu-button', sidebarInert: true })

  await b.ev(`document.querySelector('.menu-button')?.click()`)
  await b.wait(`document.querySelector('#primary-navigation[role="dialog"]') && document.activeElement?.getAttribute('aria-label') === '关闭导航菜单'`)
  await b.viewport(900, 844)
  await b.wait(`!document.querySelector('#primary-navigation[role="dialog"]') && document.activeElement === document.querySelector('#primary-navigation nav button.active')`)
  const mobileToDesktopNavFocus = await b.ev(`({ activeText: document.activeElement?.textContent?.trim() || '', sidebarInert: document.querySelector('#primary-navigation')?.hasAttribute('inert') ?? false, menuDisplay: getComputedStyle(document.querySelector('.menu-button')).display })`)
  assert.deepEqual(mobileToDesktopNavFocus, { activeText: 'API 目录', sidebarInert: false, menuDisplay: 'none' })
  await b.viewport(390, 844)
  await b.wait(`document.querySelector('.menu-button') && getComputedStyle(document.querySelector('.menu-button')).display !== 'none'`)

  await b.ev(`document.querySelector('tr[data-api-id="weather"] input[type="radio"]')?.click()`)
  await b.wait(`document.querySelector('.detail-panel[role="dialog"]')?.getAttribute('aria-label') === 'Live Weather 详情'`)
  const detailDialog = await b.ev(`({
    label: document.querySelector('.detail-panel[role="dialog"]')?.getAttribute('aria-label') || '',
    closeLabel: document.querySelector('.detail-panel[role="dialog"] .detail-head button')?.getAttribute('aria-label') || '',
  })`)
  assert.deepEqual(detailDialog, { label: 'Live Weather 详情', closeLabel: '关闭所选 API 详情' })
  const detailTouchTargets = await assertCompactTouchTargets(b, ['.detail-panel[role="dialog"] .detail-head button', '.detail-panel[role="dialog"] .detail-actions button', '.detail-panel[role="dialog"] .detail-box a'], 'compact API detail')
  await b.ev(`document.querySelector('.detail-panel[role="dialog"] .detail-head button')?.click()`)
  await b.wait(`!document.querySelector('.detail-panel[role="dialog"]')`)

  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)

  await b.ev(`location.hash='#/request-lab?api=countries'`)
  await b.wait(`document.querySelector('.request-lab')?.dataset.apiId === 'countries'`)
  const requestLabTouchTargets = await assertCompactTouchTargets(b, ['.menu-button', '.locale-control select', '.icon-button', '.active-api a', '.parameter-fields input, .parameter-fields select', '.parameter-card > .primary-action', '.response-head [role="tab"]', '.copy-output'], 'mobile Request Lab')
  await b.call('Page.reload', { ignoreCache: true })
  await b.wait(`document.querySelector('.request-lab')?.dataset.apiId === 'countries' && document.documentElement.lang === 'zh-CN'`)
  const persisted = await b.ev(`({lang:document.documentElement.lang, locale:document.querySelector('.locale-control select')?.value || '', apiId:document.querySelector('.request-lab')?.dataset.apiId || ''})`)
  assert.deepEqual(persisted, { lang: 'zh-CN', locale: 'zh-CN', apiId: 'countries' })

  assert.equal(b.blockedProviders.length, 0, 'i18n verification must not contact un-fixtured providers')
  assert.equal(b.fixtureRequests.length, 1, 'i18n result-shell verification should use exactly one synthetic response')
  assert.equal(b.fixtureRequests[0]?.url, countryUrl)
  assert.deepEqual(b.errors, [])
  report.checks.push({ primaryChrome: 'en + zh-CN', supportingWorkspaces: ['collections', 'providers', 'tags', 'health', 'documentation'], resultShellChromeLocalized: true, resultAnnouncement: 'transport-neutral received wording', sourceEnglishIdentityStable: true, htmlLangUpdates: true, localePersistence: true, routeAndApiIdentityStable: true, localizedMobileCatalogLabels: true, localizedNavigationSemantics: true, desktopToCompactFocusRestore: 'selected API control', compactToDesktopFocusHandoff: 'selected API detail heading', mobileSameRouteFocusRestore: 'menu trigger', mobileToDesktopNavFocusHandoff: 'active persistent navigation item', localizedCompactDetailDialog: true, compactTouchTargets: { minimumCssPx: 44, catalog: catalogTouchTargets, navigation: navigationTouchTargets, detail: detailTouchTargets, requestLab: requestLabTouchTargets }, mobile390Overflow: false, unnamedControls: 0, liveProviderRequests: 0, syntheticProviderFixtures: 1 })
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}
fs.writeFileSync(`${evidence}/i18n-chrome.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/i18n-chrome.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
