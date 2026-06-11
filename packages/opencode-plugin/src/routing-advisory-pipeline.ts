/**
 * Routing Advisory Pipeline — P7-S05 + P7-S08.
 *
 * evaluateAndRecordRoutingAdvisoryV1() runs the threshold gate to decide
 * whether to reuse an existing ledger score or append a new entry.
 *
 * Pipeline flow:
 *  1. rootDir absent  → skipped_no_rootdir
 *  2. currentScore absent → skipped_no_score
 *  3. Load existing ledger via loadRoutingAdvisoryLedgerV1
 *  4. filterValidLedgerEntries — fail-closed gate (P7-S08)
 *  5. Evaluate createFlowDeskScoreReuseThresholdGateV1
 *  6. gate_decision="reuse"      → reuse_advisory (no append)
 *  7. gate_decision="recompute"  → appendRoutingAdvisoryEntryV1 → new_advisory_appended
 *
 * Advisory-only: no dispatch, provider, runtime, lane-launch, fallback,
 * write, or hard-chat authority.
 */
import { randomBytes } from "node:crypto";
import {
	createFlowDeskScoreReuseThresholdGateV1,
	type FlowDeskRoutingAdvisoryLedgerEntryV1,
	validateNoForbiddenRawPayloads,
} from "@flowdesk/core";
import { loadRoutingAdvisoryLedgerV1 } from "./oi-ledger-reader.js";
import { appendRoutingAdvisoryEntryV1 } from "./oi-ledger-writer.js";

// ─── Public contracts ─────────────────────────────────────────────────────────

export interface RoutingAdvisoryPipelineInputV1 {
	workflowId: string;
	taskId: string;
	rootDir: string;
	/** Current scoring result (0..100). Required for the pipeline to proceed. */
	currentScore?: number;
	/** Context hash for the current request. Must be a hash-* ref. */
	currentContextHash?: string;
	/** Opaque signature ref identifying the task type. */
	signatureRef?: string;
	/** Max age in seconds before a ledger entry is considered stale (default: 86400 = 24h). */
	maxAgeThresholdSeconds?: number;
	/** Minimum number of samples required to use reuse path (default: 3). */
	minSampleCount?: number;
	/** ISO timestamp override; defaults to new Date().toISOString(). */
	now?: string;
}

export interface RoutingAdvisoryPipelineResultV1 {
	status:
		| "reuse_advisory"
		| "new_advisory_appended"
		| "skipped_no_score"
		| "skipped_no_rootdir";
	gateDecision?: "reuse" | "recompute";
	ledgerEntryCount?: number;
	/** P7-S08: Number of ledger entries excluded by the fail-closed filter. */
	excludedEntryCount?: number;
	/** P7-S08: Redacted reasons for excluded entries (one per distinct reason). */
	excludedReasons?: string[];
	advisory_only: true;
	dispatch_authority_enabled: false;
}

// ─── P7-S08: Fail-closed ledger entry filter ──────────────────────────────────

type ExcludedEntry = { reason: string; index: number };

function isRecordUnknown(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Filters a list of FlowDeskRoutingAdvisoryLedgerEntryV1 entries,
 * returning only those that pass all fail-closed validity checks.
 *
 * Conditions for exclusion (ANY → excluded):
 *  1. Schema validation failure (required fields missing/invalid type)
 *  2. advisory_score (weighted_score × 100) out of 0..100 range
 *  3. schema_hash field mismatch if options.schemaHash is provided
 *  4. Forbidden payload markers detected in the entry
 *
 * Advisory-only: no dispatch, provider, runtime, lane-launch, fallback,
 * write, or hard-chat authority.
 */
export function filterValidLedgerEntries(
	entries: FlowDeskRoutingAdvisoryLedgerEntryV1[],
	options?: { schemaHash?: string; policyHash?: string },
): {
	valid: FlowDeskRoutingAdvisoryLedgerEntryV1[];
	excluded: ExcludedEntry[];
} {
	const valid: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [];
	const excluded: ExcludedEntry[] = [];

	for (const [index, entry] of entries.entries()) {
		const record = entry as unknown as Record<string, unknown>;

		// ── Condition 1: Schema validation — required fields must be present/typed ─
		const schemaErrors: string[] = [];
		if (!isRecordUnknown(entry)) {
			schemaErrors.push("entry must be an object");
		} else {
			if (typeof record.signature_ref !== "string" || record.signature_ref.length === 0) {
				schemaErrors.push("signature_ref must be a non-empty string");
			}
			if (typeof record.model_ref !== "string" || record.model_ref.length === 0) {
				schemaErrors.push("model_ref must be a non-empty string");
			}
			if (typeof record.weighted_score !== "number" || !Number.isFinite(record.weighted_score)) {
				schemaErrors.push("weighted_score must be a finite number");
			}
			if (
				typeof record.recorded_at !== "string" ||
				record.recorded_at.length === 0 ||
				!Number.isFinite(Date.parse(record.recorded_at))
			) {
				schemaErrors.push("recorded_at must be a parseable timestamp");
			}
		}
		if (schemaErrors.length > 0) {
			excluded.push({ reason: "schema_validation_failed", index });
			continue;
		}

		// ── Condition 2: advisory_score range check (weighted_score × 100 must be 0..100) ─
		const advisoryScore = (record.weighted_score as number) * 100;
		if (advisoryScore < 0 || advisoryScore > 100) {
			excluded.push({ reason: "score_out_of_range", index });
			continue;
		}

		// ── Condition 3: schema_hash mismatch (only checked when options.schemaHash provided) ─
		if (
			options?.schemaHash !== undefined &&
			typeof record.schema_hash === "string" &&
			record.schema_hash !== options.schemaHash
		) {
			excluded.push({ reason: "schema_hash_mismatch", index });
			continue;
		}

		// ── Condition 4: Forbidden payload markers ────────────────────────────────
		const payloadResult = validateNoForbiddenRawPayloads(entry, `ledger_entry[${index}]`);
		if (!payloadResult.ok) {
			excluded.push({ reason: "forbidden_payload_detected", index });
			continue;
		}

		valid.push(entry);
	}

	return { valid, excluded };
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_MAX_AGE_THRESHOLD_SECONDS = 86400; // 24 hours
const DEFAULT_MIN_SAMPLE_COUNT = 3;
const DEFAULT_SIGNATURE_REF = "signature-default";
const DEFAULT_CONTEXT_HASH = "hash-default-context";
const DEFAULT_PREVIOUS_SCORE_REF = "score-ref-default";

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Evaluate the score reuse threshold gate and, if recompute is needed,
 * atomically append a new routing advisory ledger entry.
 *
 * Authority: advisory-only. No dispatch, provider, runtime, lane-launch,
 * fallback, write, or hard-chat authority.
 *
 * Never throws. All errors degrade gracefully.
 */
export function evaluateAndRecordRoutingAdvisoryV1(
	input: RoutingAdvisoryPipelineInputV1,
): RoutingAdvisoryPipelineResultV1 {
	const SAFE_RESULT = {
		advisory_only: true as const,
		dispatch_authority_enabled: false as const,
	};

	// ── Guard: rootDir required ───────────────────────────────────────────────
	if (typeof input.rootDir !== "string" || input.rootDir.trim().length === 0) {
		return { status: "skipped_no_rootdir", ...SAFE_RESULT };
	}

	// ── Guard: currentScore required ─────────────────────────────────────────
	if (
		input.currentScore === undefined ||
		input.currentScore === null ||
		typeof input.currentScore !== "number" ||
		!Number.isFinite(input.currentScore)
	) {
		return { status: "skipped_no_score", ...SAFE_RESULT };
	}

	const now = input.now ?? new Date().toISOString();
	const maxAgeThresholdSeconds =
		input.maxAgeThresholdSeconds ?? DEFAULT_MAX_AGE_THRESHOLD_SECONDS;
	const minSampleCount = input.minSampleCount ?? DEFAULT_MIN_SAMPLE_COUNT;
	const signatureRef = input.signatureRef ?? DEFAULT_SIGNATURE_REF;
	const currentContextHash = input.currentContextHash ?? DEFAULT_CONTEXT_HASH;

	// Clamp currentScore to 0..100
	const clampedScore = Math.max(0, Math.min(100, input.currentScore));

	// ── Load existing ledger ──────────────────────────────────────────────────
	let rawEntries: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [];
	try {
		rawEntries = loadRoutingAdvisoryLedgerV1(input.rootDir);
	} catch {
		// Treat as empty ledger — advisory pipeline is fail-open
		rawEntries = [];
	}

	// ── P7-S08: Fail-closed filter — exclude malformed/stale/tampered entries ─
	const filterResult = filterValidLedgerEntries(rawEntries);
	const existingEntries = filterResult.valid;
	const excludedEntryCount = filterResult.excluded.length;
	const excludedReasons = excludedEntryCount > 0
		? [...new Set(filterResult.excluded.map((e) => e.reason))]
		: undefined;

	// Filter entries for this signature, sorted most-recent first
	const signatureEntries = existingEntries
		.filter((e) => e.signature_ref === signatureRef)
		.sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at));

	const sampleCount = signatureEntries.length;

	// ── Determine gate inputs from most recent ledger entry ───────────────────
	// If we have a previous entry, use its values; otherwise use defaults that
	// will produce a "recompute" decision.
	const mostRecent = signatureEntries[0];
	const hasPreviousEntry = mostRecent !== undefined;

	const previousScoreRef = hasPreviousEntry
		? `score-ref-${signatureRef}-${mostRecent.recorded_at}`.replace(
				/[^A-Za-z0-9_.:-]/g,
				"-",
			)
		: DEFAULT_PREVIOUS_SCORE_REF;

	// Derive previous context hash: if a context_hash-like field exists on the
	// entry we use it; otherwise fall back to a fixed sentinel that will not
	// match currentContextHash and trigger a recompute.
	const entryRecord = mostRecent as (FlowDeskRoutingAdvisoryLedgerEntryV1 & Record<string, unknown>) | undefined;
	const previousContextHash: string =
		hasPreviousEntry &&
		typeof entryRecord?.context_hash === "string" &&
		/^hash-/.test(entryRecord.context_hash)
			? (entryRecord.context_hash as string)
			: "hash-previous-unknown";

	// Score age: seconds elapsed since the most recent entry was recorded
	const scoreAgeSeconds = hasPreviousEntry
		? Math.max(0, (Date.parse(now) - Date.parse(mostRecent.recorded_at)) / 1000)
		: Number.MAX_SAFE_INTEGER;

	// Previous advisory score (0..100): convert from weighted_score (0..1)
	const previousAdvisoryScore = hasPreviousEntry
		? Math.max(0, Math.min(100, mostRecent.weighted_score * 100))
		: 0;

	// ── Apply minSampleCount pre-check ────────────────────────────────────────
	// If we don't have enough samples, always recompute (append) regardless of gate.
	const hasEnoughSamples = sampleCount >= minSampleCount;

	// ── Evaluate threshold gate ───────────────────────────────────────────────
	const gateId = `gate-${randomBytes(4).toString("hex")}`;
	const reasonRefs = [`reason-eval-${gateId}`];

	let finalGateDecision: "reuse" | "recompute" = "recompute";

	if (hasEnoughSamples) {
		const gateResult = createFlowDeskScoreReuseThresholdGateV1({
			gateId,
			workflowId: input.workflowId || `workflow-pipeline-${randomBytes(4).toString("hex")}`,
			previousScoreRef,
			previousContextHash,
			currentContextHash,
			scoreAgeSeconds,
			maxAgeThresholdSeconds,
			previousAdvisoryScore,
			reasonRefs,
			evaluatedAt: now,
		});

		if (gateResult.ok && gateResult.gate) {
			const decision = gateResult.gate.gate_decision;
			// Treat "blocked" as recompute (conservative)
			finalGateDecision = decision === "reuse" ? "reuse" : "recompute";
		} else {
			// Gate validation failed — fall back to recompute (fail-open)
			finalGateDecision = "recompute";
		}
	}
	// else: not enough samples → recompute (default)

	// ── Build excluded fields (additive, redacted) ───────────────────────────
	const excludedFields: Pick<RoutingAdvisoryPipelineResultV1, "excludedEntryCount" | "excludedReasons"> =
		excludedEntryCount > 0
			? { excludedEntryCount, excludedReasons }
			: {};

	// ── Handle reuse path ─────────────────────────────────────────────────────
	if (finalGateDecision === "reuse") {
		return {
			status: "reuse_advisory",
			gateDecision: "reuse",
			ledgerEntryCount: sampleCount,
			...excludedFields,
			...SAFE_RESULT,
		};
	}

	// ── Handle recompute path: append new entry ───────────────────────────────
	const newEntry: FlowDeskRoutingAdvisoryLedgerEntryV1 = {
		signature_ref: signatureRef,
		model_ref: `model-ref-${input.workflowId || "unknown"}-${input.taskId || "unknown"}`.replace(/[^A-Za-z0-9_.:-]/g, "-"),
		weighted_score: clampedScore / 100, // convert 0..100 → 0..1
		recorded_at: now,
	};

	// Attempt to append — advisory pipeline is fail-open on write error
	try {
		appendRoutingAdvisoryEntryV1({ rootDir: input.rootDir, entry: newEntry, now });
	} catch {
		// Fail-open: advisory append failure does not block the caller
	}

	return {
		status: "new_advisory_appended",
		gateDecision: "recompute",
		ledgerEntryCount: sampleCount + 1,
		...excludedFields,
		...SAFE_RESULT,
	};
}
