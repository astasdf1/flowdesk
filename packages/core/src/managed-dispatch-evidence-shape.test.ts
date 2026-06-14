import assert from "node:assert/strict";
import test from "node:test";
import {
	validateFlowDeskManagedDispatchBetaRuntimeEchoShapeV1,
	validateFlowDeskManagedDispatchBetaTelemetryCorrelationShapeV1,
	validateFlowDeskManagedDispatchBetaUsageAuthorityShapeV1,
} from "./index.js";

const now = Date.parse("2026-06-15T12:00:00.000Z");
const freshObservedAt = "2026-06-15T11:59:00.000Z";
const staleObservedAt = "2026-06-15T11:50:00.000Z";

function usageAuthorityEvidence(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.managed_dispatch_beta.usage_authority_evidence.v1",
		observedAt: freshObservedAt,
		attestation_scope: "plugin_observed_only",
		authority_ref: "authority-ref-1",
		...overrides,
	};
}

function runtimeEchoEvidence(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1",
		observedAt: freshObservedAt,
		attestation_scope: "plugin_observed_only",
		runtime_echo_ref: "runtime-echo-ref-1",
		...overrides,
	};
}

function telemetryCorrelationEvidence(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.managed_dispatch_beta.telemetry_correlation.v1",
		observedAt: freshObservedAt,
		attestation_scope: "plugin_observed_only",
		telemetry_ref: "telemetry-ref-1",
		...overrides,
	};
}

test("managed dispatch evidence shape accepts valid fresh plugin-observed evidence", () => {
	assert.equal(
		validateFlowDeskManagedDispatchBetaUsageAuthorityShapeV1(
			usageAuthorityEvidence(),
			{ now },
		).ok,
		true,
	);
	assert.equal(
		validateFlowDeskManagedDispatchBetaRuntimeEchoShapeV1(runtimeEchoEvidence(), {
			now,
		}).ok,
		true,
	);
	assert.equal(
		validateFlowDeskManagedDispatchBetaTelemetryCorrelationShapeV1(
			telemetryCorrelationEvidence(),
			{ now },
		).ok,
		true,
	);
});

test("managed dispatch evidence shape blocks stale evidence", () => {
	const result = validateFlowDeskManagedDispatchBetaUsageAuthorityShapeV1(
		usageAuthorityEvidence({ observedAt: staleObservedAt }),
		{ now },
	);

	assert.equal(result.ok, false);
	assert.match(result.errors.join("; "), /stale/);
});

test("managed dispatch evidence shape blocks non plugin-observed attestation scopes", () => {
	for (const attestation_scope of [
		"raw_provider_echo",
		"telemetry_only",
		"unverified",
	]) {
		const result = validateFlowDeskManagedDispatchBetaRuntimeEchoShapeV1(
			runtimeEchoEvidence({ attestation_scope }),
			{ now },
		);

		assert.equal(result.ok, false);
		assert.match(result.errors.join("; "), /attestation_scope/);
	}
});

test("managed dispatch evidence shape blocks forbidden raw payload fields", () => {
	for (const forbiddenField of [
		"token",
		"auth",
		"rawTranscript",
		"rawProviderPayload",
	]) {
		const result = validateFlowDeskManagedDispatchBetaTelemetryCorrelationShapeV1(
			telemetryCorrelationEvidence({ [forbiddenField]: "redacted-test-value" }),
			{ now },
		);

		assert.equal(result.ok, false);
		assert.match(result.errors.join("; "), /forbidden raw payload field/);
	}
});
