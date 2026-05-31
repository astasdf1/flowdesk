import assert from "node:assert/strict";
import test from "node:test";
import {
	assessFlowDeskPluginVerificationBoundaryV1,
	classifyFlowDeskProductionBlockerByPluginBoundaryV1,
} from "./index.js";

test("platform-dependent blockers are classified as opencode_platform_dependent", () => {
	for (const label of [
		"runtime_echo_missing",
		"telemetry_correlation_missing",
		"lane_conformance_missing",
	]) {
		const entry = classifyFlowDeskProductionBlockerByPluginBoundaryV1(label);
		assert.equal(entry.classification, "opencode_platform_dependent");
		assert.ok(entry.platform_concern);
	}
});

test("plugin-satisfiable blockers are classified as plugin_satisfiable", () => {
	for (const label of [
		"pre_dispatch_audit_missing",
		"dispatch_idempotency_missing",
		"production_approval_source_missing",
		"provider_health_snapshot_missing",
		"configured_verification_missing",
		"provider_policy_missing",
	]) {
		const entry = classifyFlowDeskProductionBlockerByPluginBoundaryV1(label);
		assert.equal(entry.classification, "plugin_satisfiable", label);
		assert.equal(entry.platform_concern, undefined);
	}
});

test("assessment counts and only_platform_dependent flag are correct", () => {
	const mixed = assessFlowDeskPluginVerificationBoundaryV1([
		"runtime_echo_missing",
		"pre_dispatch_audit_missing",
		"lane_conformance_missing",
	]);
	assert.equal(mixed.total, 3);
	assert.equal(mixed.opencode_platform_dependent_count, 2);
	assert.equal(mixed.plugin_satisfiable_count, 1);
	assert.equal(mixed.only_platform_dependent_blockers_remain, false);

	const platformOnly = assessFlowDeskPluginVerificationBoundaryV1([
		"runtime_echo_missing",
		"telemetry_correlation_missing",
		"lane_conformance_missing",
	]);
	assert.equal(platformOnly.only_platform_dependent_blockers_remain, true);

	const empty = assessFlowDeskPluginVerificationBoundaryV1([]);
	assert.equal(empty.only_platform_dependent_blockers_remain, false);
});

test("assessment is authority-free", () => {
	const a = assessFlowDeskPluginVerificationBoundaryV1(["runtime_echo_missing"]);
	assert.equal(a.dispatch_authority_enabled, false);
	assert.equal(a.realOpenCodeDispatch, false);
	assert.equal(a.actualLaneLaunch, false);
	assert.equal(a.providerCall, false);
	assert.equal(a.runtimeExecution, false);
});
