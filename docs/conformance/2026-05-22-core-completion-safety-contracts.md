# Core Completion Safety Contracts

Date: 2026-05-22

## Scope

This slice implements the first dependency-safe corrections from the multi-model review of `docs/CORE_COMPLETION_EXECUTION_PLAN.md`. It adds additive, fail-closed contracts only. It does not enable default managed dispatch, real remote writes, reviewer fan-out, connector installation, actual lane launch, automatic fallback, operational-intelligence authority, or federated data sharing.

## Multi-Model Review Result

1. Claude Opus produced a usable verdict after verdict-only continuation: `changes_required`.
2. GPT frontier produced no usable document review and ended `inconclusive`; it is recorded as non-approval evidence only.
3. Gemini Pro produced a usable verdict after verdict-only continuation: `changes_required`.

Consensus: proceed only with non-authorizing safety contracts first.

## Added Contracts

`@flowdesk/core` now exposes:

1. `flowdesk.connector_profile.v1`
   - Binds connector kind, active profile ref, allowed target kinds, required tool refs, auth scope refs, recipe/playbook refs, install policy, rollback ref, and doctor status ref.
   - Keeps gateway execution, remote write, external write, and dispatch authority disabled.

2. `flowdesk.connector_recipe_ref.v1`
   - Binds recipe ref, connector profile ref, connector kind, target kind, operation label, and playbook ref.
   - Requires content-hash binding and dry-run behavior and forbids raw locators.

3. `flowdesk.advisory_output_firewall.v1`
   - Records that operational-intelligence advisory outputs cannot be consumed as Guard, approval, dispatch, verification, external-write, or reviewer-verdict-acceptance authority.

4. `flowdesk.federated_registry_state.v1`
   - Records disabled/documentation-only registry state with upload, download, planning influence, ranking influence, Guard influence, approval influence, dispatch influence, and external-write authority all false.

5. `tool_calls_only_no_verdict` lane lifecycle state
   - Classifies review or lane sessions that only perform tool calls or otherwise return no final verdict as incomplete/non-approval evidence.

## Safety Boundary

The contracts are schema/validator artifacts only. They do not install tools, call providers, launch lanes, execute connector commands, write remotely, switch providers, mutate profiles, or enable default dispatch.

## Verification

Targeted verification passed:

```text
npm run typecheck --workspace @flowdesk/core
npm test --workspace @flowdesk/core -- --test-name-pattern "connector profile|advisory output|federated registry|lane lifecycle separates"
```

The targeted test run passed 287/287 selected core tests after build.

## Remaining Gaps

1. ConnectorProfile contracts are not yet wired into a generic connector gateway.
2. No durable remote-write evidence class or doctor/status connector readiness surface yet.
3. Reviewer assignment-time availability revalidation remains pending.
4. Durable evidence reload proof before default managed-dispatch promotion remains pending.
5. Operational intelligence remains advisory contract scaffolding only.
6. Federated registry remains disabled/documentation-only; no data sharing is implemented.
