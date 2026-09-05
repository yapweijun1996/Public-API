# SSOT Card UX Phase 2

Status: **implementation candidate**. Publication and deployment are established by the owner PR merge and GitHub Pages verification, not by this ledger. Builds on the Health-honesty and result-card-v2 changes from base `b85fcbaa17a5261989818ad3cd72fde852a1215a`.

## Goal and scope

Replace the least useful DataTablePreview compositions with domain-specific experiences, not different decoration around arbitrary properties. Phase 2 is incremental: **9 of the original 64 DataTablePreview routes** are upgraded across two bounded batches; 55 remain. Batch 1 covered six APIs and batch 2 covers three diagnostic APIs. The catalog still has 200 APIs. Request builders and WebMCP execution are unchanged; LanguageTool usage guidance now states the official human-driven-only restriction.

| API ID | Composition | User benefit |
| --- | --- | --- |
| `color-api` | Color swatch and specifications | Actual requested color, exact hex copying, all supplied color spaces, nearest-name distinction |
| `google-dns-doh` | DNS diagnostic panel | Readable record types, TTL in seconds, complete TXT values, DNS status distinct from HTTP status |
| `npm-download-counts` | Package download summary | Package identity, exact total, inclusive UTC reporting window, explicitly calculated daily average |
| `endoflife-date` | Release support explorer | Filter and reveal all returned cycles, independent support/EOL flags, latest version, native support-date disclosure |
| `exchange-rate-current` | Daily FX conversion board | Client-side amount conversion, searchable currencies, full supplied rate precision and update times, required attribution |
| `ecb-fx-rates` | Coinbase fiat/crypto conversion board | Same calculation primitives, separate Coinbase adapter, tiny crypto rates preserved, no invented update timestamp |

The legacy ID `ecb-fx-rates` remains stable but its current provider is Coinbase. Do not label it ECB.

### Batch 2: diagnostic evidence

| API ID | Composition | User benefit |
| --- | --- | --- |
| `openssf-scorecard` | Security practice evidence board | Provider aggregate, all individual checks, true zero versus inconclusive/unknown, complete reasons and expandable evidence, official per-check guidance |
| `languagetool-grammar-check` | Writing review | Full explanations, context-local highlights, explicit flagged text, selectable/copyable suggestions, no-issues versus malformed/partial results |
| `nhtsa-vehicle-recalls` | Recall investigation report | Campaign identity, complete defect/consequence/remedy, positive do-not-drive/park-outside flags, unknown flags kept distinct, model-level versus VIN scope |

Before this batch, the live NHTSA adapter exposed arbitrary early properties and omitted the entire defect/consequence/remedy narrative. The Scorecard adapter reduced documentation to `2 properties`. These were reproduced in the existing candidate before replacement.

Diagnostic rules:

- Scorecard `-1` is inconclusive, not `0`. Missing/out-of-range scores have no meter or numeric value. The aggregate is supplied by the provider, never recomputed from the visible subset. Score/date/commit are snapshot evidence, not certification or a new scan initiated by the browser.
- Grammar requires a usable `matches` array. An empty valid array means no issues returned, not guaranteed error-free text. Missing/malformed matches or an explicitly incomplete result cannot become a green all-clear. Highlights use context-local bounds, with plain text when the bounds are invalid; replacements never silently modify or resubmit text.
- Recall arrays, malformed rows, missing safety narratives and count/list mismatches stay distinct. A model search never determines whether a particular VIN is affected, repaired or safe. Provider dates are preserved verbatim, avoiding a locale guess for values such as `10/12/2020` from an endpoint also returning `25/03/2021`.
- Complete safety text is visible by default; only supporting evidence/notes use native disclosure. No line clamps or property-count placeholders hide critical information.
- Unknown boolean flags are not rendered as false. Flag counts include the unknown count explicitly.
- Public LanguageTool prohibits automated requests. Its documentation/usage warning and attribution are now explicit. New browser testing blocks this endpoint unless an explicit synthetic response fixture is provided. This is a test-harness boundary, not a claim that application-wide WebMCP execution-policy enforcement has been implemented.


## Data and interaction rules

- Domain adapters return typed view models. Visual content and machine-readable metadata use the same values; no parallel agent payload or duplicate catalog.
- Missing/null/invalid numbers are not zero. Genuine zero downloads and zero-second TTL remain valid.
- Rate strings preserve supplied decimal digits. Numeric JSON rates preserve the parsed numeric value, not their original wire formatting. Converted amounts use finite JavaScript arithmetic and are reference estimates, not financial settlement or trade quotes.
- A DNS HTTP 200 can contain NXDOMAIN or SERVFAIL. Expose that domain outcome through `data-result-state` and DNS code text without calling it a transport failure.
- A period download total cannot support a historical sparkline or growth percentage. Derive only the labeled average over valid inclusive UTC dates.
- Lifecycle `isEol` and `isMaintained` are independent. Maintenance may include extended/paid support. Unknown dates do not imply unlimited support.
- Color swatches use validated six-digit provider hex values. A nearest named color and suggested text color are not an exact-name match or a verified contrast certification.
- Native inputs/selects/details/buttons expose clear labels, keyboard operation and >=44px control height. Local conversion, filtering, show-more and copy actions do not refetch providers.
- New styles live under `.domain-card` and load with the existing lazy response-preview chunk. Single-result content is not forced into a half-empty grid.
- Global body min-width no longer forces a 320px document into a smaller content area when a desktop scrollbar is present. This baseline issue was reproduced before changing the one rule. Color swatches explicitly fit their container instead of letting aspect-ratio/min-height create hidden horizontal clipping.

## Research

Official contracts checked before implementation:

- Color fields and closest-name metadata: https://www.thecolorapi.com/docs
- DNS JSON status, RR type codes, TTL seconds and complete TXT strings: https://developers.google.com/speed/public-dns/docs/doh/json
- npm period totals and inclusive UTC windows: https://github.com/npm/registry/blob/main/docs/download-counts.md
- Lifecycle flags and nullable support dates: https://endoflife.date/docs/api/v1/openapi.yml
- Open FX update frequency and attribution requirement: https://www.exchangerate-api.com/docs/free
- Coinbase base/rate response contract: https://docs.cdp.coinbase.com/coinbase-app/track-apis/exchange-rates
- Scorecard scoring and limitations: https://github.com/ossf/scorecard
- Scorecard inconclusive sentinel: https://github.com/ossf/scorecard/blob/main/checker/check_result.go
- LanguageTool response schema: https://languagetool.org/http-api/languagetool-swagger.json
- LanguageTool public-service restrictions and attribution: https://dev.languagetool.org/public-http-api.html
- NHTSA model-level API: https://www.nhtsa.gov/nhtsa-datasets-and-apis
- NHTSA VIN scope: https://www.nhtsa.gov/recalls
- Responsive reflow: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html

## Verification and reproducibility

```sh
npm test
npm run build -- --base /Public-API/
npm run test:browser:domain-cards
npm run test:browser:diagnostic-cards
git diff --check
```

The browser commands need Chromium. Set `CHROME_BIN` when it is not `/usr/bin/google-chrome`; optional `EVIDENCE_DIR` selects a local evidence folder. By default evidence is saved to a unique OS temporary directory. The harness uses a new isolated profile, not the user's authenticated browser.

It serves the candidate's local built HTML/JS/CSS through bounded browser interception **only for the GitHub Pages application path**. The page origin remains `https://yapweijun1996.github.io`; the first batch and the live diagnostic cases do not mock, proxy or rewrite provider responses. Diagnostic negative cases and LanguageTool UI checks use explicitly labelled synthetic fixtures in a separate browser context. Those are not live-health evidence. This verifies an unpublished candidate under the real browser origin; it is **not evidence of production deployment**.

Coverage includes six default live flows at 1440, 900, 390 and 320px Chromium viewport widths; document/card overflow; value clipping; control height; required accessibility-tree names; real clipboard write/readback; Enter-driven disclosure/show-more; rate calculations and filtering without additional requests; preview JS/CSS lazy loading; and live DNS NXDOMAIN/TXT cases. Country, Weather and GitHub provide unaffected-flow smoke coverage. Tests use synthetic edge fixtures separately from live provider evidence.

Initial local acceptance on 2026-09-05: unit suite 110/110; build/diff checks passed; six flows x four widths passed; three unaffected smokes passed; actual clipboard and keyboard checks passed; live DNS NXDOMAIN remained HTTP 200 with DNS status 3; live TXT values stayed complete. This is targeted evidence, **not a 200-API health sweep or a Safari/iOS device certification**. Provider health is a point-in-time observation.

## Next batch

Batch 2 is locally verified. Review the nine redesigned result experiences together before widening the candidate; owner review and merge remain separate from these local acceptance results. A separate orchestration follow-up should derive manual-only/provider execution policies from the SSOT and enforce them for structured agent runs; until then autonomous agents must not send LanguageTool public checks.

Batch 2 local acceptance on 2026-09-05: 137/137 unit tests, including 27 diagnostic tests; Pages-base build and diff checks passed. Two real provider journeys (OpenSSF and NHTSA) and one explicitly synthetic LanguageTool journey passed at 1440/900/390/320 widths, named AX contracts and >=44px interactive controls. Full live recall narratives were compared to the response, all returned checks/campaigns were reachable, keyboard filters/disclosures and actual replacement clipboard readback passed without additional fetches. Eleven synthetic edge cases verified no-issues/empty/invalid/partial states and HTTP429. Removing the LanguageTool fixture explicitly tested fail-closed network blocking.

The prior six-card regression passed its six default live cases and Country smoke on the first batch-2 run, then stopped on a 20-second Weather timeout. Controlled follow-up returned successful Weather results twice and a successful GitHub result without source/request changes. Preserve the failed first-run evidence rather than relabeling it a clean pass. This remains point-in-time provider variability, not a full 200-API sweep.

### Remaining DataTablePreview routes

- `aladhan-prayer-times`
- `carbon-intensity-gb`
- `fiscal-data-treasury`
- `ipify-public-ip`
- `nws-weather`
- `usaspending`
- `wikidata-sparql`
- `opencitations-index`
- `openfda-drug-labels`
- `open-meteo-elevation`
- `rxnorm-drug-search`
- `un-sdg-goals`
- `celestrak-satellites`
- `musicbrainz-artist-search`
- `eurostat-population`
- `fema-disasters`
- `noaa-tides`
- `rdap-domain-lookup`
- `pubchem-compound`
- `chembl-molecule`
- `uniprot-protein`
- `rcsb-pdb-entry`
- `ensembl-gene-lookup`
- `obis-marine-occurrences`
- `worms-species-lookup`
- `paleobiodb-taxa`
- `usgs-water-legacy`
- `ipwhois-lookup`
- `newton-math-solver`
- `datamuse-rhymes`
- `open5e-monster-search`
- `catfacts`
- `jolpica-f1`
- `malaysia-core-cpi`
- `malaysia-household-income`
- `malaysia-population`
- `openfda-food-recalls`
- `iconify-search`
- `homebrew-formula-json`
- `geoboundaries-admin-boundaries`
- `osrm-route`
- `opendota-pro-matches`
- `openligadb-matches`
- `uk-parliament-members`
- `mlb-stats-api`
- `gleif-lei`
- `fdic-bankfind`
- `uk-food-hygiene`
- `uk-flood-monitoring`
- `unhcr-refugees`
- `hdx-humanitarian-datasets`
- `models-dev`
- `vatcomply`
- `mempool-space-btc`
- `canada-open-data-search`
