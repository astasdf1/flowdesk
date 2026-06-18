import assert from "node:assert/strict";
import test from "node:test";
import { probeReadOnlySdkSessionMessagesV1 } from "./sdk-session-messages-probe.js";

test("probeReadOnlySdkSessionMessagesV1 uses structured path id first", async () => {
	const calls: unknown[] = [];
	const client = {
		session: {
			async messages(options: unknown) {
				calls.push(options);
				return [{ id: "msg-1" }];
			},
		},
	};

	const result = await probeReadOnlySdkSessionMessagesV1(client, "ses-123");

	assert.equal(result.status, "ok");
	if (result.status === "ok") {
		assert.equal(result.transport, "structured_path_id");
		assert.deepEqual(result.response, [{ id: "msg-1" }]);
	}
	assert.deepEqual(calls, [{ path: { id: "ses-123" } }]);
});

test("probeReadOnlySdkSessionMessagesV1 falls back to legacy sessionID after structured error", async () => {
	const calls: unknown[] = [];
	const client = {
		session: {
			async messages(options: unknown) {
				calls.push(options);
				if (calls.length === 1) throw new Error("redacted structured shape failure");
				return { data: [{ id: "msg-legacy" }] };
			},
		},
	};

	const result = await probeReadOnlySdkSessionMessagesV1(client, "ses-legacy");

	assert.equal(result.status, "ok");
	if (result.status === "ok") {
		assert.equal(result.transport, "legacy_session_id");
		assert.deepEqual(result.response, { data: [{ id: "msg-legacy" }] });
	}
	assert.deepEqual(calls, [
		{ path: { id: "ses-legacy" } },
		{ sessionID: "ses-legacy" },
	]);
});

test("probeReadOnlySdkSessionMessagesV1 fails closed with typed failure when probes fail", async () => {
	const calls: unknown[] = [];
	const client = {
		session: {
			async messages(options: unknown) {
				calls.push(options);
				throw new Error("raw sdk error must not escape");
			},
		},
	};

	const result = await probeReadOnlySdkSessionMessagesV1(client, "ses-fail");

	assert.deepEqual(result, { status: "failed", reason: "legacy_messages_api_error" });
	assert.deepEqual(calls, [
		{ path: { id: "ses-fail" } },
		{ sessionID: "ses-fail" },
	]);
});

test("probeReadOnlySdkSessionMessagesV1 falls back on structured SDK error response", async () => {
	const calls: unknown[] = [];
	const client = {
		session: {
			async messages(options: unknown) {
				calls.push(options);
				if (calls.length === 1) return { error: { name: "NotFound" } };
				return [];
			},
		},
	};

	const result = await probeReadOnlySdkSessionMessagesV1(client, "ses-error-response");

	assert.equal(result.status, "ok");
	if (result.status === "ok") assert.equal(result.transport, "legacy_session_id");
	assert.deepEqual(calls, [
		{ path: { id: "ses-error-response" } },
		{ sessionID: "ses-error-response" },
	]);
});
