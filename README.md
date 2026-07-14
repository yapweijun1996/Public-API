# Public API Admin Console

A reusable Vite + React + TypeScript admin console for demonstrating public APIs to developers and browser-based AI agents.

**Live demo:** [yapweijun1996.github.io/Public-API](https://yapweijun1996.github.io/Public-API/)

## What is included

- A searchable catalog of keyless public APIs
- Generated parameter forms with validation
- Live JSON requests with loading, success, and error states
- Copyable JavaScript examples
- Responsive, keyboard-friendly UI
- Desktop catalog table, mobile API cards, navigation drawer, and selected-module drawer
- Five WebMCP tools registered through `document.modelContext`
- Typed catalog tests that validate every default endpoint

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

## Deploy

Pushes to `main` are tested, built, and deployed to GitHub Pages by `.github/workflows/deploy-pages.yml`. The workflow sets Vite's repository base path automatically and publishes the `dist` artifact through GitHub's official Pages actions.

## Add another public API

Add one entry to `src/apiCatalog.ts` with:

1. Catalog metadata such as name, provider, category, and documentation URL.
2. A list of input fields and sensible defaults.
3. A `buildUrl(parameters)` function that returns an HTTPS endpoint.

The admin table, detail panel, request form, generated code, validation, and WebMCP discovery tool are derived from that entry.

## WebMCP

When `document.modelContext` is available, the app registers:

- `list_public_api_demos`
- `filter_public_api_catalog`
- `navigate_api_console`
- `open_public_api_demo`
- `run_public_api_demo`

The API is currently experimental. The visual explorer remains fully usable when WebMCP is unavailable.

Agent actions reuse the same application logic as human interactions. They can filter the visible catalog, navigate the console, select a module, and execute a live request while keeping the UI synchronized.
