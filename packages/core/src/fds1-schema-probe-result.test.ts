import assert from "node:assert/strict";
import test from "node:test";
import {
	createFlowDeskFds1SchemaProbeResultV1,
	validateFlowDeskFds1SchemaProbeResultV1,
} from "./index.js";

test("FDS-1 schema probe passes only with all fail-closed checks proven", () => {
	const result = createFlowDeskFds1SchemaProbeResultV1({
		probeId: "probe-fds1-1",
		toolName: "flowdesk_plan",
		requestSchemaRef: "flowdesk.plan.request.v1",
		responseSchemaRef: "flowdesk.plan.response.v1",
		observedAt: "2026-05-21T00:00:00.000Z",
		unknownPropertyRejected: true,
		malformedEventRejected: true,
		providerFacingConversionChecked: true,
		runtimeValidatorChecked: true,
		evidenceRefs: ["fds1-evidence-1"],
	});
	assert.equal(result.outcome, "probe_pass");
	assert.equal(result.providerCall, false);
	assert.equal(result.actualLaneLaunch, false);
	assert.equal(validateFlowDeskFds1SchemaProbeResultV1(result).ok, true);
});

test("FDS-1 schema probe blocks unchecked provider conversion and malformed events", () => {
	const result = createFlowDeskFds1SchemaProbeResultV1({
		probeId: "probe-fds1-2",
		toolName: "flowdesk_run",
		requestSchemaRef: "flowdesk.run.request.v1",
		responseSchemaRef: "flowdesk.run.response.v1",
		observedAt: "2026-05-21T00:00:00.000Z",
		unknownPropertyRejected: true,
		malformedEventRejected: false,
		providerFacingConversionChecked: false,
		runtimeValidatorChecked: true,
	});
	assert.equal(result.outcome, "probe_blocked");
	assert.ok(result.failure_labels.includes("malformed_event_not_rejected"));
	assert.ok(result.failure_labels.includes("provider_facing_conversion_unchecked"));
	assert.equal(validateFlowDeskFds1SchemaProbeResultV1(result).ok, true);
});

test("FDS-1 schema probe rejects forged pass and authority claims", () => {
	const forged = {
		...createFlowDeskFds1SchemaProbeResultV1({
			probeId: "probe-fds1-3",
			toolName: "flowdesk_status",
			requestSchemaRef: "flowdesk.status.request.v1",
			responseSchemaRef: "flowdesk.status.response.v1",
			observedAt: "2026-05-21T00:00:00.000Z",
			unknownPropertyRejected: false,
			malformedEventRejected: true,
			providerFacingConversionChecked: true,
			runtimeValidatorChecked: true,
		}),
		outcome: "probe_pass",
		providerCall: true,
		approve_dispatch: true,
	};
	const result = validateFlowDeskFds1SchemaProbeResultV1(forged);
	assert.equal(result.ok, false);
	assert.match(result.errors.join("|"), /probe_pass requires|runtime authority|unknown properties/);
});
