# Public-API Autonomous Optimization Loop

## Purpose

The autonomous loop continuously moves Public-API toward the North Star in `product-north-star-and-agent-architecture.md`.

It is not a requirement to change code every hour. Each cycle researches the current state, chooses the highest-value gap, performs local work when justified, verifies it, updates durable project knowledge, and leaves publication under explicit user control.

## Operating boundary

Scheduled autonomous runs may:

- call KB-MCP to recall current Public-API decisions, findings, and known issues;
- call VMMCP to inspect the repository and persistent working tree;
- research code and architecture;
- probe public endpoints and browser CORS behavior;
- run unit tests, TypeScript builds, and browser E2E;
- make local code/documentation/test changes;
- self-review diffs and continue improving local work;
- write durable, verified project knowledge back to KB-MCP.

Scheduled autonomous runs must **not** commit, push, open a pull request, merge, or mutate the owner repository unless the user explicitly requests publication in a chat turn.

The persistent VMMCP working tree is the local engineering workspace. KB-MCP is the long-term project brain.

## Hourly cycle

```text
1. Recall Public-API knowledge from KB-MCP
2. Inspect Git and the VMMCP working tree
3. Check product/release health where useful
4. Identify the highest-value gap to the North Star
5. Research before changing code
6. Implement locally only when evidence supports a change
7. Run focused tests
8. Run full unit/build gates when appropriate
9. Run real browser E2E for affected flows
10. Review the diff for scope, regressions, duplication, and complexity
11. Update KB-MCP with durable verified knowledge
12. Leave the result local; do not publish
```

A later cycle must understand existing local modifications before starting new work. It should continue, repair, simplify, or validate the existing candidate rather than blindly overwriting it.

## Priority selection

Choose work by expected product value, not novelty.

Default priority:

1. production breakage or security/safety issue;
2. API health / CORS / provider-contract drift;
3. incorrect or generic SSOT semantics;
4. AI-agent usability / Agent-Readable DOM Contract;
5. mobile, responsive, accessibility, and UI/UX defects;
6. tests, observability, error classification, and reliability gaps;
7. performance and bundle/runtime cost;
8. architecture/modularity problems that materially slow future work;
9. PWA / i18n maturity;
10. new APIs that fill a real capability gap.

The ordering may change when evidence shows another task has greater impact.

## New API quality gate

Do not admit an API merely because it is free or keyless. Confirm:

- it is not an unnecessary duplicate capability;
- a representative request succeeds;
- expected content is parseable;
- browser CORS permits the production GitHub Pages origin or `*`;
- rate limits and usage constraints are understood;
- the provider's current automation/platform policy is checked: explicit automation or generic-platform restrictions become SSOT execution policy with an official policy link, while rate limits/attribution alone do not imply `manual-only`;
- autonomous verification never sends live requests to an endpoint classified `manual-only`; use deterministic synthetic UI/policy fixtures plus a zero-provider-request fail-closed check instead;
- provider-specific verification cadence/backoff is enforced from the catalog SSOT: a cadence-limited endpoint is excluded from generic recurring health sweeps, a provider that requires M2M clients to stop after non-200 responses must not receive same-run retry probes, and an enabled provider with explicit rate-limit backoff policy must defer same-run retries for its provider-documented rate-limit statuses rather than immediately probing again;
- attribution/licensing/data-quality caveats are recorded where needed;
- direct frontend use is appropriate, including any mandatory provider identification/header contract that a normal browser must be able to satisfy without privileged header control;
- a semantic SSOT card and browser E2E contract can be defined.

## Human and AI-agent quality gate

Every meaningful UI change should be reviewed for both user classes.

### Human / developer

- clear information hierarchy;
- semantic result before source-appropriate response details (Raw JSON for JSON APIs);
- responsive desktop/mobile behavior;
- keyboard operation;
- understandable loading/error states;
- no unnecessary visual dead space.

### AI / browser agent

- deterministic headings and accessible names;
- semantic/native controls or equivalent ARIA behavior;
- no important icon-only ambiguity;
- stable DOM metadata where useful;
- no dependency on screenshot interpretation or full-text highlighting;
- semantic text for information that is also visualized.
- locale changes preserve API IDs/routes/tool contracts and update programmatic page language; localization must not fork provider/API metadata into a second SSOT, and mixed-language source content should carry the correct local `lang`.
- the generated machine catalog remains discoverable from ordinary HTML and aligned with catalog/WebMCP execution policy; no separate hand-maintained machine registry or fabricated live-health metadata.

## Testing policy

Prefer layered verification:

```text
contract/unit tests
      -> TypeScript + production build
      -> targeted browser E2E
      -> wider browser regression when risk warrants it
```

Publication hygiene must cover the complete unpublished local candidate without violating the no-staging boundary. Plain `git diff --check` does not inspect untracked files, so the bounded release gate must also enumerate non-ignored untracked candidate files and check them for whitespace errors and unresolved merge markers. The check must remain read-only with respect to the Git index.

Do not call a provider healthy based only on server-side `curl`. Browser-origin behavior is the admission criterion for this static GitHub Pages product.
For search/filter demos, HTTP success alone is also insufficient: verify that the documented provider parameter is actually recognized and that the returned result semantics match the requested input. Prefer provider-echoed request metadata when available; an ignored query parameter that still returns HTTP 200 is a request-definition regression, not a healthy search.
When provider documentation defines a successful no-result status such as HTTP 204, test both a live/contract-backed no-result path and a malformed HTTP-success body. The no-result status may map to semantic `empty` only through an API-specific SSOT declaration; an undeclared empty 2xx body must continue to fail closed as an invalid response. For intentionally non-JSON transports, verify the provider's documented/live media type and encode the admitted media types in SSOT; regression coverage should prove a mismatched HTTP-2xx `Content-Type` cannot be parsed into a plausible result.
For date-sensitive demos, also verify the provider's documented date format and compare the provider-echoed Gregorian/reporting date with the requested date when the response exposes it. HTTP 200 with a differently interpreted day or year is a request-definition regression, even if the returned measurements look plausible.

For WebMCP behavior, prefer native `document.modelContext` browser verification when the test browser exposes the WebMCP testing surface. Unit-level registration mocks remain useful, but they cannot prove imperative tool lifecycle behavior. In framework integrations, a normal UI state change must not abort and re-register the tool set while an invocation is in flight.

Separate transient provider instability from product regression through controlled retries and direct/browser evidence. Never hide a genuine failure just to report 200/200.
Exhausting the bounded retry window means the provider is **unresolved in this run**, not proven persistently down. Preserve the first-pass and retry evidence, then use a later independent fresh-browser confirmation before changing browser-admission status or describing durable provider drift.
When Chromium exposes `Network.loadingFailed` diagnostics, the maintenance sweep may record bounded `blockedReason` / `corsErrorStatus` evidence to refine a JavaScript `network-or-cors` failure for investigation. Keep this as test-only evidence: missing CORS metadata is not proof that CORS was not involved, and the product runtime must not invent a more specific cause than the browser exposes.

For large catalog-wide browser audits, bounded sharding is allowed when one long runner is unreliable. Every shard must derive from the same verification-eligible SSOT set and the same Pages-base bundle. Aggregate results only after proving exact coverage with no missing, duplicate, or extra API IDs; preserve each shard's first-pass and retry evidence independently. A shard that fails before provider requests (for example a wrong-base build preflight) does not count as provider-health evidence and must be rerun after repairing the harness state.

For large UI collections, prefer measured bounded rendering over speculative optimization. Compare production-like browser DOM/control/node cost before and after the candidate, preserve global SSOT search/discovery semantics, and verify pagination or windowing with exact ID coverage rather than assuming off-screen items remain reachable.

## KB-MCP learning policy

Keep project knowledge current without turning KB-MCP into a raw log sink.

Write durable facts such as:

- architecture decisions;
- verified provider/API contract changes;
- important browser-CORS findings;
- completed product milestones;
- non-obvious debugging lessons;
- reusable engineering rules;
- persistent blockers;
- decisions that supersede stale knowledge.

Do not store routine file opens, command timings, or every passing test execution.

When a verified fact makes old knowledge stale, prefer update/supersession semantics instead of accumulating contradictions.

## Publication workflow

Autonomous scheduled work remains local until the user explicitly requests publication.

When publication is requested:

```text
1. Re-read the complete local diff
2. Sync/rebase against the latest owner main when safe
3. Resolve conflicts without discarding validated work
4. Run final tests/build/E2E
5. Create one coherent commit or minimal coherent series
6. Push through the VMMCP contributor/fork workflow
7. Open the owner-repository PR
8. User manually reviews and merges
```

After the user reports a merge:

```text
main commit
-> GitHub Actions
-> Pages deployment
-> live bundle/assets
-> production browser E2E
```

Only then is the published candidate complete.

## Stop condition

The loop is allowed to conclude:

> No material improvement is justified this cycle.

In that case, leave the repository unchanged, update KB-MCP only if a material fact changed, and wait for the next cycle.

A mature project should spend more time preserving quality and detecting drift than producing arbitrary code churn.
