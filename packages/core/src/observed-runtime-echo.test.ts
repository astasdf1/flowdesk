import assert from "node:assert/strict";
import test from "node:test";
import {
	flowDeskObservedRuntimeEchoSentinelV1,
	issueFlowDeskObservedRuntimeEchoV1,
	validateFlowDeskObservedRuntimeEchoEvidenceV1,
	type FlowDeskObservedRuntimeEchoInputV1,
} from "./index.js";

const NONCE = "fd-challenge-9c1f2a7b4e6d8a30";
const SENTINEL = flowDeskObservedRuntimeEchoSentinelV1(NONCE);

function input(
	overrides: Partial<FlowDeskObservedRuntimeEchoInputV1> = {},
): FlowDeskObservedRuntimeEchoInputV1 {
	return {
		workflowId: "workflow-echo-1",
		attemptId: "attempt-echo-1",
		laneId: "lane-echo-1",
		providerFamily: "openai",
		requestedProviderQualifiedModelId: "openai/gpt-5.5",
		observedProviderQualifiedModelId: "openai/gpt-5.5",
		childSessionRef: "ses-child-echo-1",
		observedMessageRef: "msg-echo-1",
		challengeNonceRef: "nonce-ref-echo-1",
		expectedChallengeNonce: NONCE,
		observedAssistantText: `Understood. Proceeding. ${SENTINEL}`,
		observedAt: "2026-05-31T00:00:00.000Z",
		...overrides,
	};
}

test("observed runtime echo issues an un-attested echo when model matches and nonce is echoed", () => {
	const result = issueFlowDeskObservedRuntimeEchoV1(input());
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.state, "issued_observed");
	assert.ok(result.evidence);
	assert.equal(result.evidence?.runtime_echo_mode, "untrusted");
	assert.equal(result.evidence?.attestation_strength, "observed_unattested");
	assert.equal(result.evidence?.dispatch_authority_enabled, false);
	assert.ok(result.uncertainty_labels.includes("observed_runtime_binding_not_cryptographically_attested"));
	assert.equal(validateFlowDeskObservedRuntimeEchoEvidenceV1(result.evidence).ok, true);
});

test("observed runtime echo never emits a trusted runtime echo mode", () => {
	const result = issueFlowDeskObservedRuntimeEchoV1(input());
	assert.notEqual(result.evidence?.runtime_echo_mode, "trusted");
	// And the validator rejects any record claiming trusted.
	const forged = validateFlowDeskObservedRuntimeEchoEvidenceV1({
		...result.evidence,
		runtime_echo_mode: "trusted",
	});
	assert.equal(forged.ok, false);
	assert.match(forged.errors.join("; "), /must not claim a trusted runtime echo mode/);
});

test("observed runtime echo fails closed on model binding drift", () => {
	const result = issueFlowDeskObservedRuntimeEchoV1(
		input({ observedProviderQualifiedModelId: "openai/gpt-5.4" }),
	);
	assert.equal(result.ok, false);
	assert.match(result.errors.join("; "), /does not byte-exactly match/);
});

test("observed runtime echo fails closed when the nonce is not echoed in output", () => {
	const result = issueFlowDeskObservedRuntimeEchoV1(
		input({ observedAssistantText: "Understood. Proceeding without the token." }),
	);
	assert.equal(result.ok, false);
	assert.match(result.errors.join("; "), /challenge nonce sentinel was not observed/);
});

test("observed runtime echo fails closed when only a bare nonce (no sentinel) is parroted", () => {
	// A model that merely quotes the bare nonce — without the sentinel envelope —
	// must NOT pass; this resists prompt parroting.
	const result = issueFlowDeskObservedRuntimeEchoV1(
		input({ observedAssistantText: `You asked me to include ${NONCE} somewhere.` }),
	);
	assert.equal(result.ok, false);
	assert.match(result.errors.join("; "), /challenge nonce sentinel was not observed/);
});

test("observed runtime echo rejects a trivial (too short) nonce to resist parroting", () => {
	const result = issueFlowDeskObservedRuntimeEchoV1(
		input({ expectedChallengeNonce: "ok", observedAssistantText: "ok" }),
	);
	assert.equal(result.ok, false);
	assert.match(result.errors.join("; "), /non-trivial string/);
});

test("observed runtime echo does not accept a caller boolean as the trust anchor", () => {
	// There is no "echoed=true" input; the only way to pass is for the issuer to
	// find the nonce itself in the observed text. A caller that omits the nonce
	// from the text cannot force issuance regardless of other fields.
	const result = issueFlowDeskObservedRuntimeEchoV1(
		input({ observedAssistantText: "" }),
	);
	assert.equal(result.ok, false);
	assert.equal(result.state, "blocked");
});

test("observed runtime echo keeps all authority flags false even when blocked", () => {
	const result = issueFlowDeskObservedRuntimeEchoV1(input({ observedAssistantText: "" }));
	assert.equal(result.dispatch_authority_enabled, false);
	assert.equal(result.realOpenCodeDispatch, false);
	assert.equal(result.actualLaneLaunch, false);
	assert.equal(result.providerCall, false);
	assert.equal(result.runtimeExecution, false);
});
