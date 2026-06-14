import assert from "node:assert/strict";
import test from "node:test";
import {
	evaluateSdkAdapterCapabilitySmokeV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	validateFlowDeskSdkAdapterCapabilitySmokeV1,
} from "./index.js";

const baseInput = {
	workflowId: "workflow-sdk-smoke-test",
	attemptId: "attempt-sdk-smoke-test",
	opencodeVersionRef: "opencode-version-test",
	adapterProfileRef: "adapter-profile-managed-dispatch-beta-test",
	observedAt: "2026-06-15T00:00:00.000Z",
};

test("valid injected SDK client passes without a provider call", () => {
	let promptCalled = false;
	const record = evaluateSdkAdapterCapabilitySmokeV1({
		...baseInput,
		client: {
			session: {
				prompt() {
					promptCalled = true;
				},
				promptAsync() {
					promptCalled = true;
				},
			},
		},
	});
	assert.equal(record.prompt_method_available, true);
	assert.equal(record.promptAsync_method_available, true);
	assert.equal(record.provider_family_mapping_valid, true);
	assert.equal(record.missing_method_blocked, false);
	assert.equal(record.absent_client_blocked, false);
	assert.equal(record.capability_smoke_passed, true);
	assert.equal(record.providerCall, false);
	assert.equal(record.actualLaneLaunch, false);
	assert.equal(record.runtimeExecution, false);
	assert.equal(promptCalled, false);
	assert.equal(validateFlowDeskSdkAdapterCapabilitySmokeV1(record).ok, true);

	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: baseInput.workflowId,
		evidenceId: "sdk-smoke-valid-client",
		record: record as unknown as Record<string, unknown>,
	});
	assert.equal(prepared.ok, true, prepared.errors.join("; "));
	assert.equal(prepared.writeIntent?.evidenceClass, "sdk_adapter_capability_smoke");
});

test("missing prompt and promptAsync methods fail closed", () => {
	const record = evaluateSdkAdapterCapabilitySmokeV1({
		...baseInput,
		client: { session: { create() {} } },
	});
	assert.equal(record.prompt_method_available, false);
	assert.equal(record.promptAsync_method_available, false);
	assert.equal(record.missing_method_blocked, true);
	assert.equal(record.absent_client_blocked, false);
	assert.equal(record.capability_smoke_passed, false);
	assert.equal(validateFlowDeskSdkAdapterCapabilitySmokeV1(record).ok, true);
});

test("absent injected SDK client fails closed", () => {
	const record = evaluateSdkAdapterCapabilitySmokeV1(baseInput);
	assert.equal(record.prompt_method_available, false);
	assert.equal(record.promptAsync_method_available, false);
	assert.equal(record.missing_method_blocked, false);
	assert.equal(record.absent_client_blocked, true);
	assert.equal(record.capability_smoke_passed, false);
	assert.equal(validateFlowDeskSdkAdapterCapabilitySmokeV1(record).ok, true);
});

test("authority flags are always false and validator rejects authority smuggling", () => {
	for (const client of [
		undefined,
		{ session: {} },
		{ session: { promptAsync() {} } },
	]) {
		const record = evaluateSdkAdapterCapabilitySmokeV1({
			...baseInput,
			client,
		});
		assert.equal(record.dispatch_authority_enabled, false);
		assert.equal(record.providerCall, false);
		assert.equal(record.actualLaneLaunch, false);
		assert.equal(record.runtimeExecution, false);
		assert.equal(
			validateFlowDeskSdkAdapterCapabilitySmokeV1({
				...record,
				providerCall: true,
			}).ok,
			false,
		);
	}
});
