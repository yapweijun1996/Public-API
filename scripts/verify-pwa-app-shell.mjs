import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createOwnedBrowserProfile, hasChildExited, removeOwnedBrowserProfile, terminateChildProcess } from './lib/browser-temp-profile.mjs'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const dist = path.join(root, 'dist')
const indexPath = path.join(dist, 'index.html')
if (!fs.existsSync(indexPath)) throw new Error('Run `npm run build:pages` before the PWA browser verifier.')
const indexHtml = fs.readFileSync(indexPath, 'utf8')
if (!indexHtml.includes('src="/Public-API/assets/')) throw new Error('PWA verification requires the /Public-API/ Pages-base build.')

const sha256 = (content) => createHash('sha256').update(content).digest('hex')
const swSource = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8')
const cacheVersion = swSource.match(/CACHE_NAME = CACHE_PREFIX \+ "([a-f0-9]{12})";/)?.[1]
const precacheSource = swSource.match(/const PRECACHE_URLS = (\[[\s\S]*?\]);/)?.[1]
if (!cacheVersion || !precacheSource) throw new Error('Generated service worker is missing versioned precache metadata.')
const precacheUrls = JSON.parse(precacheSource)
const fixedPrecacheRevisions = Object.fromEntries([
  ['index.html', fs.readFileSync(path.join(root, 'index.html'))],
  ['api-catalog.json', fs.readFileSync(path.join(dist, 'api-catalog.json'))],
  ['manifest.webmanifest', fs.readFileSync(path.join(root, 'public/manifest.webmanifest'))],
  ['favicon.svg', fs.readFileSync(path.join(root, 'public/favicon.svg'))],
  ['icons/pwa-192.png', fs.readFileSync(path.join(root, 'public/icons/pwa-192.png'))],
  ['icons/pwa-512.png', fs.readFileSync(path.join(root, 'public/icons/pwa-512.png'))],
].map(([fileName, content]) => [fileName, sha256(content)]))
const expectedCacheVersion = sha256(JSON.stringify({
  base: '/Public-API/',
  precacheUrls,
  fixedPrecacheRevisions,
})).slice(0, 12)
assert.equal(cacheVersion, expectedCacheVersion, 'PWA cache version must include fixed precache content revisions, not URL names alone')
const syntheticManifestRevision = {
  ...fixedPrecacheRevisions,
  'manifest.webmanifest': sha256(Buffer.concat([fs.readFileSync(path.join(root, 'public/manifest.webmanifest')), Buffer.from('\nsynthetic-revision')]))
}
const syntheticCacheVersion = sha256(JSON.stringify({
  base: '/Public-API/',
  precacheUrls,
  fixedPrecacheRevisions: syntheticManifestRevision,
})).slice(0, 12)
assert.notEqual(cacheVersion, syntheticCacheVersion, 'Changing a fixed precache asset must invalidate the app-shell cache identity')

const mime = (file) => file.endsWith('.html') ? 'text/html; charset=utf-8'
  : file.endsWith('.js') ? 'application/javascript; charset=utf-8'
  : file.endsWith('.css') ? 'text/css; charset=utf-8'
  : file.endsWith('.json') || file.endsWith('.webmanifest') ? 'application/json; charset=utf-8'
  : file.endsWith('.svg') ? 'image/svg+xml'
  : file.endsWith('.png') ? 'image/png'
  : 'application/octet-stream'

const listen = (server) => new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => resolve(server.address().port))
})
const closeServer = (server) => new Promise((resolve) => server.close(resolve))
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const appServer = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  if (!url.pathname.startsWith('/Public-API/')) {
    response.writeHead(404).end('Not found')
    return
  }
  const relative = decodeURIComponent(url.pathname.slice('/Public-API/'.length)) || 'index.html'
  const file = path.resolve(dist, relative)
  if (!file.startsWith(`${path.resolve(dist)}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404).end('Not found')
    return
  }
  response.writeHead(200, { 'Content-Type': mime(file), 'Cache-Control': 'no-store' })
  fs.createReadStream(file).pipe(response)
})

const providerServer = http.createServer((_request, response) => {
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify({ source: 'synthetic-cross-origin-provider', ok: true }))
})

const appPort = await listen(appServer)
const providerPort = await listen(providerServer)
const appUrl = `http://127.0.0.1:${appPort}/Public-API/#/catalog`
const providerUrl = `http://127.0.0.1:${providerPort}/provider.json`
const profile = createOwnedBrowserProfile('public-api-pwa-profile-')
const cdpPort = 9950 + Math.floor(Math.random() * 30)
let chrome
let ws
try {
  chrome = spawn(process.env.CHROME_BIN || '/usr/bin/google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--disable-sync',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' })

  let pages
  for (let i = 0; i < 80; i += 1) {
    try {
      pages = await fetch(`http://127.0.0.1:${cdpPort}/json`).then((response) => response.json())
      if (pages.length) break
    } catch {}
    await sleep(100)
  }
  if (!pages?.length) throw new Error('Chromium CDP unavailable for PWA verification.')

  ws = new WebSocket(pages.find((page) => page.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let sequence = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (!message.id) return
    const handler = pending.get(message.id)
    if (!handler) return
    pending.delete(message.id)
    message.error ? handler.reject(new Error(JSON.stringify(message.error))) : handler.resolve(message.result)
  }
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  const wait = async (expression, timeoutMs = 12000) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (await evaluate(`Boolean(${expression})`)) return
      await sleep(100)
    }
    throw new Error(`Timed out waiting for ${expression}`)
  }

  await call('Page.enable')
  await call('Runtime.enable')
  await call('Network.enable')
  await call('ServiceWorker.enable')
  await call('Page.navigate', { url: appUrl })
  await wait(`document.querySelector('.catalog-panel')`)

  const manifestLink = await evaluate(`document.querySelector('link[rel="manifest"]')?.href || ''`)
  assert.equal(manifestLink, `http://127.0.0.1:${appPort}/Public-API/manifest.webmanifest`)
  const manifest = await fetch(manifestLink).then((response) => response.json())
  const browserManifest = await call('Page.getAppManifest')
  assert.deepEqual(browserManifest.errors ?? [], [], 'Chromium reported manifest parse/install metadata errors')
  const installability = await call('Page.getInstallabilityErrors')
  assert.deepEqual(installability.installabilityErrors ?? [], [], 'Chromium reported PWA installability errors')
  assert.equal(manifest.name, 'Public API Console')
  assert.equal(manifest.start_url, './')
  assert.equal(manifest.scope, './')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.lang, 'en')
  assert(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.type === 'image/png'))
  assert(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.type === 'image/png'))

  await evaluate(`navigator.serviceWorker.ready.then(() => true)`)
  await wait(`navigator.serviceWorker.controller`, 15000)
  const swState = await evaluate(`(async()=>{const registration=await navigator.serviceWorker.ready;return {scope:registration.scope,controller:navigator.serviceWorker.controller?.scriptURL||''}})()`)
  assert.equal(swState.scope, `http://127.0.0.1:${appPort}/Public-API/`)
  assert.equal(swState.controller, `http://127.0.0.1:${appPort}/Public-API/sw.js`)

  const providerResult = await evaluate(`fetch(${JSON.stringify(providerUrl)}).then(r=>r.json())`)
  assert.equal(providerResult.source, 'synthetic-cross-origin-provider')
  const cacheState = await evaluate(`(async()=>{const names=await caches.keys();const entries=[];for(const name of names){const cache=await caches.open(name);for(const request of await cache.keys())entries.push(request.url)}return {names,entries}})()`)
  assert(cacheState.names.some((name) => name.startsWith('public-api-app-shell-')))
  assert(cacheState.entries.some((url) => url.endsWith('/Public-API/api-catalog.json')))
  assert(cacheState.entries.some((url) => /\/Public-API\/assets\/index-[^/]+\.js$/.test(new URL(url).pathname)))
  assert(cacheState.entries.some((url) => /\/Public-API\/assets\/index-[^/]+\.css$/.test(new URL(url).pathname)))
  assert.equal(cacheState.entries.some((url) => /responsePreview|SemanticPreviewBundle|DiagnosticPreviewBundle/.test(url)), false, 'Lazy preview bundles were eagerly precached')
  assert(cacheState.entries.every((url) => new URL(url).origin === `http://127.0.0.1:${appPort}`), 'Cross-origin response entered Cache Storage')
  assert.equal(cacheState.entries.includes(providerUrl), false, 'Synthetic provider response was cached')

  await call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 })
  await call('Page.reload', { ignoreCache: true })
  await wait(`document.querySelector('.catalog-panel')`, 15000)
  const offlineState = await evaluate(`({title:document.title,total:document.querySelector('.table-footer')?.textContent||'',controlled:Boolean(navigator.serviceWorker.controller),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1})`)
  assert.equal(offlineState.controlled, true)
  assert(offlineState.total.includes('196 total'))
  assert.equal(offlineState.overflow, false)
  await call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })

  console.log(JSON.stringify({
    verdict: 'PASS',
    origin: `http://127.0.0.1:${appPort}`,
    pagesBase: '/Public-API/',
    manifest: { startUrl: manifest.start_url, scope: manifest.scope, display: manifest.display, iconSizes: manifest.icons.map((icon) => icon.sizes), chromiumInstallabilityErrors: 0 },
    serviceWorker: swState,
    appShellCacheCount: cacheState.entries.length,
    cacheVersion,
    fixedPrecacheContentRevisioned: Object.keys(fixedPrecacheRevisions).length,
    crossOriginProviderCached: false,
    offlineReload: 'PASS',
    catalogTotalVisibleOffline: 196,
    providerEvidence: 'synthetic cross-origin fixture only; no live provider health claim',
  }, null, 2))
} finally {
  if (ws) ws.close()
  const chromeExited = await terminateChildProcess(chrome)
  await closeServer(appServer)
  await closeServer(providerServer)
  if (chromeExited && hasChildExited(chrome)) removeOwnedBrowserProfile(profile)
  else throw new Error('Chromium did not terminate; preserving its browser profile for safe owner-bound cleanup.')
}
