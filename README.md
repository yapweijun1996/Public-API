# Public API Admin Console

A reusable Vite + React + TypeScript admin console for demonstrating public APIs to developers and browser-based AI agents.

**Live demo:** [yapweijun1996.github.io/Public-API](https://yapweijun1996.github.io/Public-API/)

## What is included

- A curated catalog of 196 keyless public API demos
- Generated parameter forms with validation
- Preview-first Request Lab with one live-response SSOT card for every catalog API
- JSON APIs retain Raw JSON as a secondary developer view; non-JSON APIs expose accurately labelled response details, and generated fetch code is available where provider policy permits reusable integration code
- Copyable JavaScript examples
- Responsive, keyboard-friendly UI
- Installable PWA shell with a Pages-base-safe manifest and privacy-safe offline catalog/app-shell reopening; provider responses are never cached by the service worker
- English / 简体中文 primary application chrome with a persisted locale selector and runtime `html[lang]`; API IDs, provider contracts, routes, WebMCP, and machine catalog remain language-neutral SSOT
- Desktop catalog table with bounded 50-item semantic pagination and global SSOT search/filter, plus mobile API cards, navigation drawer, and selected-module drawer
- Five WebMCP tools registered through `document.modelContext`
- Build-generated `api-catalog.json` fallback for agents without WebMCP, advertised from the page and generated from the same API SSOT
- Typed catalog tests that validate every default endpoint
- Bounded live requests with a 20-second timeout and superseded-request cancellation

## Product North Star and AI-agent architecture

Public-API is a quality-first browser-native workbench for humans/developers and AI agents. The product treats accessibility semantics as AI usability infrastructure and targets one SSOT exposed through three complementary surfaces: Human UI, an agent-readable DOM/accessibility contract, and WebMCP when the environment supports it.

See:

- [`docs/product-north-star-and-agent-architecture.md`](docs/product-north-star-and-agent-architecture.md) — North Star, Agent-Readable DOM Contract, WebMCP/fallback strategy, semantic response architecture, capability discovery, and maturity roadmap.
- [`docs/autonomous-optimization-loop.md`](docs/autonomous-optimization-loop.md) — local-only autonomous research/optimization workflow, quality gates, KB-MCP learning policy, and publication boundary.

## Run locally

Use Node.js 20.19+, 22.12+, or 24+ (an active LTS release is recommended).

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Verify

```bash
npm test
npm run build
```

Before publication, use the bounded policy-safe gate:

```bash
npm run test:publish-readiness
```

That gate runs the unit suite, a GitHub-Pages-base production build, PWA install/offline-shell verification, preview-bundle isolation/failure-recovery checks, native WebMCP/provider-policy checks, and a local-candidate hygiene gate that covers both tracked changes and untracked candidate files without staging them. The hygiene gate checks whitespace errors and unresolved conflict markers, closing the blind spot where plain `git diff --check` cannot see untracked local work. It deliberately does **not** run a full live-provider sweep: manual-only endpoints must never be automated, CIRCL browser checks use policy-safe synthetic fixtures because generic browser code cannot supply its required contact-bearing `User-Agent`, cadence-limited providers such as CelesTrak must respect their SSOT interval, NVD endpoints require isolated checks that honor the provider's recommended six-second public cadence, and broader live browser checks should be selected from the affected scope.

## PWA app shell

The local candidate includes an installable web app manifest with 192px/512px PNG icons, a standalone launch mode, and relative `start_url`/`scope` so the same contract works at the GitHub Pages `/Public-API/` base path. The production build emits a content-revisioned service worker that precaches only the initial app entry assets plus the manifest/icons and generated machine catalog; fixed-name shell assets participate in the cache identity so manifest/icon/catalog-only releases cannot silently reuse a stale app-shell cache. Lazy semantic preview bundles remain on-demand instead of being downloaded during service-worker installation.

The service worker handles only same-origin requests inside its own app scope. Cross-origin public API/provider requests are passed through and are never written to Cache Storage, so live Request Lab results do not become offline/user-data caches. Offline mode is intentionally an **app-shell/catalog** capability: users can reopen and browse the interface and machine catalog, but live provider execution still requires network access. Verify this contract with `npm run test:browser:pwa`.

## Internationalization

The local candidate has a bounded i18n foundation for the primary operational chrome: Overview, navigation, page titles, Catalog, Request Lab, Agent Tools, and selected-API detail actions support English and Simplified Chinese. The selector is keyboard/native-control friendly, persists through `localStorage`, and updates the document-level BCP 47 `lang` value so assistive technology receives the active interface language. GitHub Pages hashes, API IDs, selected modules, and deep links do not change when the locale changes.

Translations live in `src/i18n.ts` and are intentionally limited to Human UI copy. `apiCatalog.ts` remains the single source for provider names, API names/descriptions, field schema, policy, URLs, and execution semantics; WebMCP and `api-catalog.json` are not duplicated or translated into a second registry. Fixed chrome in Collections, Providers, Tags, Health, and Documentation now follows the active locale, while source-faithful provider/API names, descriptions, category identities, hostnames, and other canonical metadata remain unchanged and carry local `lang="en"` semantics where needed inside the Chinese UI. Verify the bilingual contract with `npm run test:browser:i18n`; the test is deterministic UI-only evidence and must not contact providers.

## Deploy

Pushes to `main` are tested, built, and deployed to GitHub Pages by `.github/workflows/deploy-pages.yml`. The workflow sets Vite's repository base path automatically and publishes the `dist` artifact through GitHub's official Pages actions.

## Request Lab SSOT cards

Each catalog API is required to resolve through `apiSsotCardRegistry`. The registry joins its request definition, preview profile, and API-owned React component into one fail-closed response contract.

A successful Request Lab run shows the semantic SSOT card before the raw inspector. Shared primitives such as metric grids, semantic cards, maps, galleries, charts, and timelines are reusable, but the API adapter is responsible for translating the provider response into meaningful fields. Generic `Result 1` output is treated as a fallback defect for catalog APIs. The current local candidate has no `data-table` preview profiles: even compact scalar/content APIs such as ipify and Cat Facts use domain-specific semantic cards.

The current quality contract is:

1. Every catalog ID must have exactly one preview profile and one SSOT card component.
2. SSOT cards are generated only from the live API response and request metadata.
3. Single-result cards span the available response surface instead of leaving an unused second column.
4. Raw JSON and fetch code are diagnostic views, not the primary result experience.
5. API-specific regression tests should assert meaningful domain fields and reject generic fallback rendering.

### Preview performance boundary

Result-only CSS follows the same lazy ownership as preview code. The initial Catalog/Overview shell does not download Weather, CatalogFamily, Specialized, Developer-semantic, Package-semantic, Market, or other response-family styles before a result is requested; reusable DateList, SemanticCards, and station-list styles load with those lazy dependencies instead of the application entry CSS. Responsive rules for those lazy families/primitives stay with the same CSS owner so a later-loaded desktop base rule cannot override an earlier app-shell mobile media rule. `npm run test:browser:preview-bundles` runs from the GitHub Pages origin, enforces a 50 KB decoded initial-CSS budget, allowlists the CSS dependencies for each representative result path, and keeps per-result CSS budgets plus chunk-failure recovery deterministic.

## Add another public API

A catalog addition is not complete until its Request Lab SSOT card is defined. Add:

1. Catalog metadata in `src/apiCatalog.ts`, including provider, category, documentation, defaults, an HTTPS request builder, bounded `usageNote` constraints, `agentExecution` when official provider policy restricts automation/platform use, and `automatedVerification` when official policy imposes a stricter cadence/backoff contract on recurring health probes, including enabled providers that must defer same-run provider-documented rate-limit responses such as HTTP 429 or a documented 403/429 pair.
2. A response parser when the provider does not return ordinary JSON (for example newline-delimited version lists).
3. One intentional profile in `src/previewProfiles.ts` describing the semantic layout used by the response.
4. One API-owned card component/adapter under `src/previews/`, registered by `src/responsePreview.tsx`. Reuse visual primitives and shared response-data helpers, but map the provider response to domain fields rather than generic `Result 1` output.
5. Contract tests for the default request, policy semantics, and semantic card fields. Use real GitHub-Pages-origin browser E2E only where provider policy permits automated verification; for `manual-only` endpoints prove policy discovery, accessible DOM warnings, and zero-provider-request fail-closed behavior with deterministic fixtures.

`apiSsotCardRegistry` is fail-closed: every catalog ID must resolve to a profile and component. The admin table, detail panel, request form, generated code, validation, WebMCP discovery, and Request Lab SSOT surface are then derived from those registered contracts.

## Machine-readable catalog

`api-catalog.json` is generated during development/build from `src/apiCatalog.ts`; do not maintain a second catalog file by hand. A Pages build with base `/Public-API/` publishes it at `/Public-API/api-catalog.json`. It includes deterministic Request Lab paths, an explicit resolved response transport (`json`, `text`, or `image`) for every API, parameter metadata, task-oriented search keywords when defined, provider usage constraints, `agentExecution`, and `automatedVerification` policy, but no executable `buildUrl` functions and no synthetic live-health status. `health: "not-included"` is intentional until health telemetry has a durable SSOT. The document head and Agent Tools page both advertise the artifact for ordinary browser agents.

## WebMCP

When `document.modelContext` is available, the app registers:

- `list_public_api_demos` — supports optional task-oriented `query` / `category` discovery through the same SSOT search matcher as the Human UI, and returns total/matched counts, task keywords, deterministic Request Lab URLs, parameter help, numeric bounds, and select options.
- `filter_public_api_catalog`
- `navigate_api_console`
- `open_public_api_demo`
- `run_public_api_demo`

The API is currently experimental. The visual explorer remains fully usable when WebMCP is unavailable.

Agent actions reuse the same request definitions and validation logic as human interactions. They can filter the visible catalog, navigate the console, select a module, and execute permitted live requests while keeping the UI synchronized. Provider automation restrictions are part of the catalog SSOT: discovery returns `agentExecution` plus provider `usageNote` constraints when present, manual-only APIs are excluded from the run-tool enum, and `run_public_api_demo` independently fails closed if a blocked ID is submitted. Generic fetch-code generation is also withheld for manual-only endpoints. The human Request Lab remains available for provider-permitted interactive use and exposes the same policy in accessible DOM metadata. CIRCL Vulnerability-Lookup is manual-only for structured agents because its official policy requires automated clients to send a meaningful `User-Agent` with contact information, which browser JavaScript cannot control; automated CIRCL verification therefore uses deterministic fixtures and sends no live provider request.

Request Lab routes are deterministic per API: `#/request-lab?api=<api-id>`. Opening that URL directly selects the requested catalog entry and its default parameters; invalid IDs fail closed to a valid canonical selection. WebMCP discovery returns the same per-API Request Lab URL so structured agents and ordinary browser agents share one navigation contract.
