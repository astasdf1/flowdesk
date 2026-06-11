/**
 * Score Ledger GitHub Publisher — P7-S22.
 *
 * Publishes a sealed (or immutable) FlowDeskScoreLedgerPartitionV1 to GitHub
 * by delegating to the existing publishToGitHubV1 path from
 * federated-registry-connector.ts.
 *
 * Gate hierarchy:
 *   1. partition.state must be "sealed" or "immutable" → blocked: "partition-not-sealed"
 *   2. allowActualRemoteWrite must be true → dry_run_recorded (no network call)
 *   3. allowActualRemoteWrite === true → publishToGitHubV1 (compaction lock check
 *      + redaction marker scan + existing AND-gate conditions all inherited)
 *
 * Advisory-only, all authority flags false.
 */
import { randomBytes } from "node:crypto";
import {
	FORBIDDEN_RAW_PAYLOAD_MARKERS,
	flowDeskCompactionLockPathV1,
	createFlowDeskGitHubDryRunPublicationResultV1,
	type FlowDeskScoreLedgerPartitionV1,
	type FlowDeskScoreLedgerPartitionStateV1,
} from "@flowdesk/core";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	publishToGitHubV1,
	type GitHubPublicationTargetV1,
	type GitHubPublicationFetchV1,
} from "./federated-registry-connector.js";

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ScoreLedgerGitHubPublishInputV1 {
	partition: FlowDeskScoreLedgerPartitionV1;
	partitionJsonl: string;              // partition's JSONL content
	target: GitHubPublicationTargetV1;   // reuse existing federated-registry-connector type
	allowActualRemoteWrite?: boolean;     // default false
	surplusUsageGateRef?: string;
	minimizationPolicyRef?: string;
	guardApprovalRef?: string;
	attemptId?: string;
	durableStateRoot?: string;
	fetchImpl?: typeof globalThis.fetch; // test seam
}

export interface ScoreLedgerGitHubPublishResultV1 {
	status: "published" | "blocked" | "dry_run_recorded";
	blocked_labels?: string[];
	partitionId: string;
	partitionState: FlowDeskScoreLedgerPartitionStateV1;
	authority: {
		advisoryOnlyRecord: true;
		remoteWriteAuthorityEnabledInRecord: false;
		dispatchAuthorityEnabled: false;
		laneLaunchAuthorityEnabled: false;
	};
}

// ── Constants ────────────────────────────────────────────────────────────────

const AUTHORITY_BLOCK = {
	advisoryOnlyRecord: true as const,
	remoteWriteAuthorityEnabledInRecord: false as const,
	dispatchAuthorityEnabled: false as const,
	laneLaunchAuthorityEnabled: false as const,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Scan partition JSONL content for forbidden raw payload markers.
 * Returns true when a forbidden marker is detected. Case-insensitive.
 */
function partitionJsonlContainsForbiddenMarkers(partitionJsonl: string): boolean {
	if (typeof partitionJsonl !== "string" || partitionJsonl.length === 0) return false;
	const lower = partitionJsonl.toLowerCase();
	for (const marker of FORBIDDEN_RAW_PAYLOAD_MARKERS) {
		if (lower.includes(marker.toLowerCase())) return true;
	}
	return false;
}

/**
 * Build a synthetic dry-run result for the partition publish operation.
 * The attempt_id defaults to a fresh random id when not supplied by the caller.
 */
function buildPartitionDryRunResult(
	partition: FlowDeskScoreLedgerPartitionV1,
	attemptId: string,
	connectorKind: GitHubPublicationTargetV1["kind"],
) {
	return createFlowDeskGitHubDryRunPublicationResultV1({
		dryRunResultId: `dry-run-score-ledger-${partition.partition_id.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 40)}`,
		preflightRef: `preflight-score-ledger-${partition.partition_id.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 40)}`,
		writePlanRef: `write-plan-score-ledger-${partition.partition_id.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 40)}`,
		workflowId: `workflow-score-ledger-${partition.partition_id.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 40)}`,
		attemptId,
		connectorKind,
		redactedTargetLabel: `score-ledger-partition:${partition.partition_id.slice(0, 40)}`,
		redactedContentPreview: `partition-state:${partition.state} entry-count:${partition.entry_count}`,
		contentHashRef: partition.chain_head_hash,
		dryRunState: "dry_run_recorded",
		blockedLabels: [],
		fakeRemoteWriteAttempted: false,
	});
}

/**
 * Determine the compaction lock path: prefer durableStateRoot when provided,
 * fall back to cwd-relative .flowdesk/locks/compaction.lock.
 */
function resolveCompactionLockPath(durableStateRoot?: string): string {
	if (typeof durableStateRoot === "string" && durableStateRoot.trim().length > 0) {
		return flowDeskCompactionLockPathV1(durableStateRoot);
	}
	return join(process.cwd(), ".flowdesk", "locks", "compaction.lock");
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Publish a sealed score ledger partition to GitHub.
 *
 * Gate 1: partition.state must be "sealed" or "immutable".
 * Gate 2: allowActualRemoteWrite must be true for any network call.
 * Gate 3 (when allowActualRemoteWrite=true): all publishToGitHubV1 AND-gate
 *         conditions are inherited (compaction lock, redaction marker scan,
 *         production-publish flag, surplus-usage gate, minimization policy,
 *         guard-approval binding, ledger-idempotency binding).
 *
 * All returned authority flags are always false.
 */
export async function publishScoreLedgerPartitionToGitHubV1(
	input: ScoreLedgerGitHubPublishInputV1,
): Promise<ScoreLedgerGitHubPublishResultV1> {
	const partitionId = input.partition.partition_id;
	const partitionState = input.partition.state;

	// ── Gate 1: partition must be sealed or immutable ──────────────────────────
	if (partitionState !== "sealed" && partitionState !== "immutable") {
		return {
			status: "blocked",
			blocked_labels: ["partition-not-sealed"],
			partitionId,
			partitionState,
			authority: AUTHORITY_BLOCK,
		};
	}

	// ── Gate 2: dry-run path when allowActualRemoteWrite is not true ───────────
	if (input.allowActualRemoteWrite !== true) {
		return {
			status: "dry_run_recorded",
			partitionId,
			partitionState,
			authority: AUTHORITY_BLOCK,
		};
	}

	// ── Gate 3: actual publish via publishToGitHubV1 ───────────────────────────
	// Build a stable attempt-id for this publish operation.
	const attemptId =
		typeof input.attemptId === "string" && input.attemptId.trim().length > 0
			? input.attemptId
			: `attempt-score-ledger-${randomBytes(8).toString("hex")}`;

	// Build synthetic dry-run result for the partition.
	const dryRunCreation = buildPartitionDryRunResult(input.partition, attemptId, input.target.kind);
	if (!dryRunCreation.ok || dryRunCreation.result === undefined) {
		return {
			status: "blocked",
			blocked_labels: ["partition-dry-run-build-failed"],
			partitionId,
			partitionState,
			authority: AUTHORITY_BLOCK,
		};
	}
	const dryRunResult = dryRunCreation.result;

	// Check compaction lock early so we can return a clean blocked label.
	const lockPath = resolveCompactionLockPath(input.durableStateRoot);
	if (existsSync(lockPath)) {
		return {
			status: "blocked",
			blocked_labels: ["compaction-lock-held"],
			partitionId,
			partitionState,
			authority: AUTHORITY_BLOCK,
		};
	}

	// Perform a redaction marker scan on the JSONL content before passing to
	// publishToGitHubV1 as contentMarkdown (JSONL is used verbatim as the body).
	if (partitionJsonlContainsForbiddenMarkers(input.partitionJsonl)) {
		return {
			status: "blocked",
			blocked_labels: ["partition-jsonl-contains-forbidden-marker"],
			partitionId,
			partitionState,
			authority: AUTHORITY_BLOCK,
		};
	}

	// Delegate to publishToGitHubV1 with all AND-gate refs threaded through.
	const publishResult = await publishToGitHubV1({
		dryRunResult,
		ledgerIdempotencyRef: `ledger-idempotency-score-ledger-${partitionId.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 40)}`,
		guardApprovalRef: input.guardApprovalRef ?? "",
		target: input.target,
		contentMarkdown: input.partitionJsonl,
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		surplusUsageGateRef: input.surplusUsageGateRef,
		minimizationPolicyRef: input.minimizationPolicyRef,
		attemptId,
		durableStateRoot: input.durableStateRoot,
		fetchImpl: input.fetchImpl as GitHubPublicationFetchV1 | undefined,
	});

	if (!publishResult.ok || publishResult.remoteWrite.state !== "posted") {
		const rawLabels = publishResult.publicationResult?.blocked_labels ?? [
			publishResult.remoteWrite.redactedReason ?? "publish-failed",
		];
		const blockedLabels: string[] = Array.isArray(rawLabels) ? [...rawLabels] : ["publish-failed"];
		return {
			status: "blocked",
			blocked_labels: blockedLabels.length > 0 ? blockedLabels : ["publish-failed"],
			partitionId,
			partitionState,
			authority: AUTHORITY_BLOCK,
		};
	}

	return {
		status: "published",
		partitionId,
		partitionState,
		authority: AUTHORITY_BLOCK,
	};
}
