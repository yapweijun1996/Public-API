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
- attribution/licensing/data-quality caveats are recorded where needed;
- direct frontend use is appropriate;
- a semantic SSOT card and browser E2E contract can be defined.

## Human and AI-agent quality gate

Every meaningful UI change should be reviewed for both user classes.

### Human / developer

- clear information hierarchy;
- semantic result before Raw JSON;
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

## Testing policy

Prefer layered verification:

```text
contract/unit tests
      -> TypeScript + production build
      -> targeted browser E2E
      -> wider browser regression when risk warrants it
```

Do not call a provider healthy based only on server-side `curl`. Browser-origin behavior is the admission criterion for this static GitHub Pages product.

Separate transient provider instability from product regression through controlled retries and direct/browser evidence. Never hide a genuine failure just to report 200/200.

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
