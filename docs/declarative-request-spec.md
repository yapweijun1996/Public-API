# Declarative request specifications

A declarative request is a data-only description of an API request. `src/declarativeRequest.ts` interprets it without calling API-specific repository code. The catalog remains the source of truth: when `request.declarative` is true, `buildUrl` and any request body/header accessors must be derived from the same spec. A builder that needs logic outside the closed set must retain its custom implementation and declare `{ declarative: false, reason }`.

## Shape

```ts
{
  declarative: true,
  method: 'GET' | 'POST',
  urlTemplate: 'https://api.example.test/items/{item}{?limit,from}{&to}',
  hosts: ['api.example.test'],
  headers: { Accept: 'application/json' }, // optional; never put credentials here
  body: { query: '{query}', count: '{count}' }, // optional; POST only
  transforms: { item: 'uppercase', from: 'date:YYYYMMDD' }, // optional
  responseTransform: 'json' | 'csv' | 'xml' | 'text' | 'image-url'
}
```

The supported RFC 6570 level-3 URI-template subset is simple path substitution (`{var}`), query introduction (`{?a,b}`), and query continuation (`{&a,b}`). Values use URI-component percent encoding. Missing values expand to empty values; `omitIfEmpty` omits that variable from a query expression. Query order follows the template.

Body templates are JSON values; string values may contain `{parameterId}` slots. POST specs may declare a body; GET specs must not. Headers are literal non-secret strings.

## Closed transforms

- `uppercase`, `lowercase`: fixed casing conversion.
- `date:YYYYMMDD`, `date:YYYY-MM`: fixed ISO date projections.
- `{ map: { input: output } }`: explicit finite value mapping; unmapped values remain unavailable to a map expression.
- `omitIfEmpty`: omit an empty query value.
- `{ join: separator }`: join a comma-delimited parameter with a fixed separator.

Do not add open-ended expression languages, callbacks, arbitrary regular expressions, or API-specific branches to this interpreter. If provider semantics need clamping, conditional endpoint selection, validation-dependent fallback, computed date windows, non-JSON request encoding, or another operation outside this set, retain a custom builder and explain why it is non-declarative.

## Catalog and verification

`buildMachineCatalog` exports each API's request description, including its non-declarative reason, without exporting functions or secrets. Schema version 2 includes a deterministic content hash. The generated `api-catalog.json` is built from `apiCatalog.ts`; never edit the artifact directly.

Each declarative API needs captured builder/spec parity cases covering defaults and relevant valid boundaries or enum/date/zero/empty behavior. Every expanded URL must be HTTPS and its host must appear in `hosts`. Manual-only execution policy remains authoritative even when an API has a declarative spec: describing a request does not grant permission to execute it.
