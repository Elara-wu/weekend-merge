# Agent runtime final fix report

Status: complete; all required checks passed. This report is included in the single `fix: harden agent runtime public boundaries and streaming` commit.
Authoritative scope: `final-fix-brief.md`. No subagents, live network, real Gemini key, deployment, catalog expansion, map/share features, or unrelated refactors were used.

## Changes and safeguards

- Public bodies are read progressively and capped at 32 KiB of actual UTF-8 bytes before JSON parsing. Both endpoints use the standard `413 REQUEST_TOO_LARGE` envelope.
- Static shared contracts enforce weekend dates, 3–12 hour duration including end `24:00`, Shanghai district/area allowlist, nine shared UI interests (max five), food/avoid max ten labels of at most 30 characters, wish max 80. Only HTTP consults the injected clock for the inclusive Shanghai today through +180-day window. The `2026-11-14` demo fixture remains statically valid.
- Live plan requests use a module-scope warm-instance limiter keyed by trusted Netlify IP (forwarded/unknown fallback) plus validated session ID: five requests per ten minutes, at most 5,000 keys, expired/oldest eviction. Demo bypasses this quota. Model creation and external tools occur only after request validation and limiter admission. Handler factory clock/limiter injection remains available.
- `runPlanningAgent` retains its array result and adds an optional validated event sink. `plan` returns a progressive `ReadableStream` before the model promise resolves; demo also uses streaming. The shared encoder inspects original descriptors/JSON safety before Zod, inspects normalized data, and validates serialized wire JSON. Terminal state closes immediately and prevents further events; unexpected producer errors/missing terminals emit one sanitized failure. Sink exceptions escape model/tool fallback catches so delivery never restarts or duplicates a terminal. Replan stays buffered.
- Live tool evidence uses typed allowlisted builders: Shanghai weather interval/count/temperature/rain range; curated IDs/names/lastVerifiedAt; candidate route/duration/walking ranges; budget totals/limit/within count; candidate-keyed public violation/warning codes including STALE_PLACE_DATA. Original prompts/preferences, tool free text, API errors, source URLs, addresses and hidden reasoning are omitted. Consensus now filters custom free-text avoidance labels from public explanations while still applying them as hard constraints.
- `run.failed.constraintCodes` is an optional closed eight-code allowlist and preserves `NoValidPlanError.violatedConstraintCodes` through actual endpoint NDJSON.
- Replan accepts the seven optional structured reason codes and deterministically maps supported Chinese/English keywords otherwise. Unsupported text returns `400 UNSUPPORTED_REPLAN_REASON`. Explicit positive/negative interests, same-category changes, crowd exclusions, cheapest-first, nearest-neighbor-first and indoor/outdoor selection affect candidates before scheduling/validation. New title/summary/reasons/score derive from the resulting itinerary and feedback. English tokens use word boundaries; combined activity/cost feedback retains cost priority.
- Preference dictionary lookups use own-property checks. Production tool registries share a bounded module-scope 30-minute weather cache (500 scopes); identical concurrent scopes share one fetch, failed fetches are removed, and expiry/oldest eviction remain testable with injected dependencies.
- README, architecture and API demo docs explain the request limits, streaming/evidence contract, keyword limitations, fixed fixture date and warm-instance enforcement limits. The only UI file adjustment reuses `InterestSchema.options` and its inferred state type so the required shared enum compiles; no UI features or flow changes were introduced.

## TDD evidence

The initial suite was 226 passing tests. Regressions were written and run before their corresponding implementation changes:

| Finding | Observed RED | GREEN evidence |
| --- | --- | --- |
| Static request bounds / public failure codes | Boundary + preference runs: 15 failures (reverse/short/long/weekday/area/text inputs accepted, constraint codes stripped, missing reason code, inherited dictionary lookup threw) | Contract/preference focused runs passed; final focused run includes all cases |
| HTTP body/date/quota + progressive stream | Protection + HTTP run: 8 failures (400 instead of 413, historical/future accepted, sixth request 200, deferred handler stayed blocked, missing stream helper) | Deferred model receives run.started and GATHER before resolution, full serialized stream validates, quota/body/date/terminal tests pass |
| Public evidence | Orchestrator regression failed because tool summary was `{ calls: 1 }` | Canonical weather/place/route/budget/validation summaries and stale warnings pass; endpoint budget/time/avoidance no-plan lines retain codes |
| Replan feedback | Replan regression run: requested coffee/exhibition alternatives stayed bookstores, unsupported text returned 200, outdoor feedback remained indoor | Category/negative-interest examples, structured crowd/indoor/outdoor/cost and retained-neighbor walking selection all pass; stale explanations removed |
| Weather cache | Three regressions failed: oldest scope retained, concurrent calls did not coalesce, two production registries fetched twice | Capacity eviction, concurrent one-fetch, two-registry reuse and TTL refetch pass |
| Free-text privacy | Orchestrator regression showed `避开：private avoid` in completion consensus | Arbitrary avoidance/food/wish strings are absent from serialized events |
| Parser self-review | `another exhibition` initially treated “not” inside “another” as negation; later five tests exposed training/rain and other English substring matches plus activity overriding cost | Word-boundary and combined-feedback regressions pass |

Existing fixtures were updated only where the new explicit public contract required it: weekend leap day, stale-data weekend, closed-venue weekend fixture, bounded all-avoided list, enum interest alias, and valid 3-hour no-plan window. Existing numeric/descriptor/serialization/lock/identity/model-budget tests remain in place.

## Final verification

- Focused final-review suites: `npx vitest run` with 12 explicit affected contract/HTTP/orchestrator/replan/validator/preferences/weather test paths: **250/250 passed**.
- Functions typecheck: `npx tsc --noEmit -p tsconfig.functions.json`: **passed, exit 0**.
- Full suite: `npx vitest run`: **291/291 tests, 21/21 files passed** (65 additional regressions over the 226-test base).
- Production build: `npm run build`: **passed** (`tsc -b`, Functions typecheck, Vite production build; 1,605 modules transformed).
- `git diff --check`: **passed**; staged patch also checked before commit.

## Self-review and remaining limits

Checked the patch against every brief item and preserved server-owned catalog/weather scope, two model requests/six model tool calls, canonical model descriptions, numeric bounds, original descriptor/JSON/terminal guards, locked-stop scheduling and cardinality semantics. No unresolved implementation findings remain.

Rate limiting and weather cache are warm-instance memory only; process restarts/other instances do not share state, and choosing another session ID changes the limiter key. Durable distributed quota/session enforcement remains outside this no-DB MVP. Replan feedback is a documented keyword/enum protocol rather than general language understanding; unsatisfiable supported feedback returns 422. Catalog/route/price data remain static estimates. Demo weather/plan evidence remains the existing fixed illustrative fixture, not live observations. Deployed Netlify delivery and real provider behavior were not exercised; tests use offline injected boundaries and the existing mocked SDK transport. The fixed HTTP demo date must be refreshed after its moving validity window expires.
