# FlowDesk for opencode

FlowDesk for opencode is an OpenCode plugin project that helps ordinary users route natural-language work into guarded, recoverable workflows.

Final product purpose: FlowDesk keeps the main agent small and focused. Heavy workflow authoring, refinement, and review should happen in bounded subagent lanes, while the main agent handles intake, routing, compact summaries, Guard handoff, status, and safe next actions.

Current repository status: Release 1 local packages build, test, and dry-run pack successfully. The bootstrap CLI is available as `flowdesk-install-release1` from the `@flowdesk/opencode-plugin` package bin for local/development profiles. Packages remain private and unpublished until release packaging is explicitly approved.

Release 1 is intentionally conservative. Chat is the normal entry point, while commands are setup, status, recovery, diagnostics, and fallback controls. Release 1 supports guarded planning with delegated authoring records, guarded dry-run, deterministic fake-runtime execution, provider health diagnostics, redacted audit/debug records, safe recovery, lane status summaries, and OpenCode conformance reporting. It does not perform real OpenCode dispatch, actual OpenCode subtask/model/provider lane launches, automatic provider/model fallback, hard chat cancellation, community telemetry upload, or score-based approval.

## First Use

1. Build and test the workspace for your local development checkout: `npm run build` and `npm test`.
2. Preview bootstrap installation without writing files:

   ```text
   flowdesk-install-release1 --profile-root <opencode-profile-dir> --durable-root <flowdesk-state-dir> --target-profile <profile-ref> --confirmation <confirmation-ref> --expires-at <iso-time>
   ```

3. Re-run with the exact approval phrase printed by the preview using `--approve "<exact phrase>"`.
4. Run `/flowdesk-doctor` to check compatibility, policy, usage readiness, provider health, hook harness mode, and conformance state.
5. Ask in chat: `Use FlowDesk to plan this change and show me the guarded steps.`
6. Use `/flowdesk-plan` if chat routing is unavailable or FlowDesk asks you to plan through command fallback.
7. Review the plan, scope, delegated lane summaries when available, required approval, and safe next action.
8. Use `/flowdesk-run` for Release 1 dry-run or fake-runtime behavior only.
9. Use `/flowdesk-status`, `/flowdesk-resume`, `/flowdesk-retry`, `/flowdesk-abort`, `/flowdesk-usage`, or `/flowdesk-export-debug` when FlowDesk suggests recovery or diagnostics, including subagent lane inspection.

The bootstrap installer writes portable `/flowdesk-*` command files and redacted `.flowdesk/bootstrap` artifacts only after exact typed approval. It does not launch lanes, call providers, enable real dispatch, switch providers/models, or grant hard chat cancellation/no-reply authority.

`opencode run` is not a FlowDesk user workflow or parallel review command. It is only a smoke-test or diagnostic primitive for implementers.

If Claude, a provider API, or a selected model is unavailable, use `/flowdesk-status`, `/flowdesk-usage`, and `/flowdesk-doctor`. Release 1 reports usage and provider health separately, then stays on diagnostic, degraded, guarded dry-run, or fake-runtime paths. It does not switch providers or models automatically.

OpenCode Go and z.ai are designed as diagnostic provider families under the same boundary. FlowDesk may report configuration, credential, model-list, and safe failure-class evidence, but missing quota evidence remains unknown and non-dispatchable for real provider/model selection.

OpenUsage-style usage sources may inform FlowDesk's collector design through source labels such as provider API truth, local observed history, response usage accounting, or inferred estimate. Local-only history is diagnostic context, not account-wide quota truth.

See `docs/QUICKSTART.md` for the ordinary-user quickstart.

## Safety Boundary

FlowDesk Guard is the only dispatch authority. Hook containment, audit, echo, provider health snapshots, subagent lane summaries, conformance, scores, and community signals are never approval authority. Release 1 does not upload telemetry or community scores.

Implementation details are in `docs/START_HERE.md` and the implementation specification.
