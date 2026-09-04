# Public-API Product North Star and Agent Architecture

## North Star

Public-API is not trying to become the largest public-API directory.

> Build the highest-quality browser-native public API workbench for humans, developers, and AI agents, where users can discover, understand, test, and use curated public APIs without API keys, backend infrastructure, or reading raw JSON.

Quality is more important than catalog size. A new API is valuable only when it adds a useful capability and remains reliable, understandable, browser-compatible, agent-usable, and maintainable.

## Product audiences

Public-API serves two primary groups:

1. **Humans / developers** — discover APIs, configure requests, understand semantic results, inspect raw JSON, and copy integration code.
2. **AI agents** — discover capabilities, select APIs, configure inputs, execute requests, and read results through structured tools or ordinary browser interaction.

The product must not require an AI agent to guess from screenshots, visual position, color, icons, or a full-page text highlight.

## One SSOT, three access surfaces

All important product surfaces should derive from the same API registry and semantic contracts:

```text
                     Public-API SSOT
                          |
          +---------------+---------------+
          |               |               |
          v               v               v
      Human UI      Agent-readable Web   WebMCP
```

### Human UI

The catalog and Request Lab remain responsive, keyboard-friendly developer experiences. Charts, maps, galleries, tables, timelines, semantic cards, Raw JSON, and fetch code are optimized for human comprehension.

### Agent-readable Web UI

An AI agent without WebMCP must still be able to operate the site through the DOM and accessibility tree. The ordinary page is therefore a supported machine-operability surface, not only a visual rendering.

### WebMCP

When `document.modelContext` is available, WebMCP is the preferred structured agent interface. It must reuse the same SSOT, validation, request-building, execution, and navigation logic as the human UI rather than maintaining a parallel catalog.

WebMCP is important but optional. Public-API must remain agent-usable when WebMCP is unavailable.

## Agent-Readable DOM Contract

Agent-readable DOM semantics are a core product requirement.

### Controls

Every important control needs a deterministic accessible identity:

- Prefer semantic/native elements such as `button`, `input`, `select`, `form`, headings, lists, tables, and links.
- Icon-only actions need visible text or a clear accessible name such as `aria-label`.
- Custom selectors must expose equivalent roles, labels, state, keyboard behavior, and focus semantics rather than opaque clickable `div` elements.
- Form fields need associated labels and understandable help/error text.
- Use stable action names such as `Search APIs`, `Open ... in Request Lab`, `Run API`, `Copy JSON`, and `Copy fetch code`.
- Important controls must be keyboard-focusable and cannot require pointer-only interaction.

The accessibility tree should make this path obvious:

```text
Discover -> Search -> Select -> Open -> Configure -> Run -> Read result
```

### Stable machine metadata

Where useful, interactive surfaces should expose bounded data attributes derived from the SSOT, for example:

```html
<article
  data-api-id="nominatim-search"
  data-category="geo"
  data-browser-ready="true"
  data-key-required="false"
>
```

Request Lab surfaces may similarly expose API ID, SSOT card, adapter, layout, health/error state, and other values that exist in the product model.

These attributes supplement semantic HTML; they do not replace it.

## Accessibility is AI usability infrastructure

Accessibility is not treated only as compliance. Strong semantics improve:

- screen readers and keyboard users;
- Playwright/browser E2E automation;
- ChatGPT-style browser agents;
- computer-use agents;
- future autonomous agents.

Engineering principle:

> Accessible semantics are also machine-operability semantics.

A visually polished component that is opaque to the accessibility tree is incomplete.

## Semantic response architecture

Important information must never exist only as a chart, SVG path, color, icon, image, or map pin.

```text
Raw provider response
        |
        v
API-specific semantic adapter
        |
        v
Stable semantic ViewModel
       / \
      v   v
Visual UI  Agent-readable text/DOM
```

A chart may visualize a time series while the same ViewModel exposes latest value, min/max, trend, units, and dates as text. A map should expose names and coordinates in semantic DOM as well as pins.

## SSOT Card contract

The Request Lab contract remains:

```text
1 API
= 1 request definition
+ 1 semantic response adapter
+ 1 intentional card composition
+ 1 browser E2E contract
```

Shared primitives are encouraged; generic meaning is not. APIs may reuse `MetricGrid`, `DataTable`, `Map`, `Gallery`, or chart primitives, but each provider response must be adapted into domain meaning.

Generic output such as `Result 1`, arbitrary property dumps, or `Structured records unavailable` after a successful default request is a product defect.

## Capability-oriented discovery

AI agents usually ask for tasks rather than internal IDs. The SSOT should progressively capture metadata such as:

- `capabilities`;
- `keywords`;
- `useCases`;
- `inputTypes`;
- `outputTypes`;
- browser readiness;
- API-key requirement;
- health state;
- rate-limit and attribution notes.

An agent asking for “an API that converts an address to coordinates” should be able to discover the geocoding capability without already knowing the provider name.

## Agent fallbacks without WebMCP

### Required baseline

The normal DOM/accessibility tree must remain sufficient to discover and operate every supported API.

### Planned machine-readable catalog

A future build-time artifact such as `/api-catalog.json` should expose the same SSOT in compact machine-readable form. It must be generated from the registry, never separately maintained.

Candidate fields include ID, name, category, capabilities, input schema, key requirement, browser readiness, health, attribution, and Request Lab deep link.

### Planned deterministic deep links

Request Lab should support stable per-API routing so an agent can jump directly to the required form instead of replaying a long click sequence.

### Optional discovery helper

A future `llms.txt` may advertise the machine catalog, Request Lab, WebMCP support, and usage instructions. It is optional discovery metadata, not the primary contract.

## Machine-readable health and errors

Error states should distinguish provider unavailable, 429/rate limit, browser CORS rejection, timeout, invalid response/parser drift, and validation failure.

Future health metadata may expose `healthy`, `degraded`, and `down`, plus bounded facts such as last check and consecutive failures. A single transient error must not immediately redefine a provider as permanently broken.

## Quality objective

```text
Maximize:
  Reliability
  x Data usefulness
  x UX quality
  x Agent usability
  x Maintainability

Minimize:
  Broken APIs
  Generic rendering
  Duplicate capabilities
  Bundle/runtime cost
  Architecture complexity
  Manual maintenance
```

This objective is intentionally not `maximize API count`.

## Maturity roadmap

1. **Production integrity** — browser E2E health, no stale contracts, no generic fallback.
2. **Semantic API experience** — intentional SSOT cards and useful loading/empty/error states.
3. **Modular architecture** — reduce monolithic registry/preview cost while preserving contracts.
4. **Performance and quality** — code splitting, cancellation/timeouts, accessibility, mobile/responsive quality, visual regression.
5. **PWA and i18n** — installable app shell, theme, mobile-first behavior, internationalization.
6. **AI-agent native capability layer** — capability search, machine metadata, deep links, agent-readable results, richer WebMCP.
7. **Curated expansion** — add APIs only to fill meaningful capability gaps and pass admission rules.

## Build mode vs maintenance mode

The project does not recursively modify itself forever.

- **Build mode**: use while material maturity gaps remain; prioritize the largest gap to the North Star.
- **Maintenance mode**: once mature, focus on monitoring, drift detection, regression repair, and occasional high-value improvements.

The system must be allowed to decide that there is no worthwhile code change in a cycle.

> No meaningful improvement is better than optimization theatre.
