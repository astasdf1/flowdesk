/**
 * P7-S25: GitHub Pages aggregate summary export.
 *
 * Generates a static HTML summary page from a FlowDeskLedgerRollupResultV1.
 *
 * Security / redaction rules:
 *   - Raw score values (weighted_mean_score, p25, p50, p75, p90,
 *     decay_adjusted_mean) are NEVER exposed in the HTML output.
 *   - Only confidence_bucket label + sample_count + last_observation_at are
 *     surfaced.
 *   - FORBIDDEN_RAW_PAYLOAD_MARKERS are scanned in the serialised rollup;
 *     any match is a hard error.
 *   - Inline CSS only — no external resources.
 *   - advisory_only comment is embedded in the HTML.
 *
 * Authority:
 *   - advisory_only: true
 *   - dispatch_authority_enabled: false
 *   - No dispatch, provider, runtime, lane-launch, fallback, write, or
 *     hard-chat authority.
 */

import type { FlowDeskLedgerRollupResultV1 } from "@flowdesk/core";
import { FORBIDDEN_RAW_PAYLOAD_MARKERS } from "@flowdesk/core";

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface RollupStaticExportInputV1 {
	rollup: FlowDeskLedgerRollupResultV1;
	pageTitle?: string;
	generatedAt?: string;
}

export interface RollupStaticExportResultV1 {
	html: string;
	redactionApplied: true;
	advisory_only: true;
	dispatch_authority_enabled: false;
}

// ─── Redaction helpers ────────────────────────────────────────────────────────

/**
 * Scan a serialised string for any FORBIDDEN_RAW_PAYLOAD_MARKERS.
 * Returns the first found marker, or null if clean.
 */
function scanForForbiddenMarkers(text: string): string | null {
	const lowerText = text.toLowerCase();
	for (const marker of FORBIDDEN_RAW_PAYLOAD_MARKERS) {
		// Match the marker as a whole word or JSON key to avoid false positives
		// on substrings (e.g. "token" inside "tokenize").
		// We check for the marker surrounded by non-word characters or string
		// boundaries, which covers JSON keys like "\"token\":" and plain text.
		const pattern = new RegExp(`(?:^|[^a-z0-9_])${marker}(?:[^a-z0-9_]|$)`, "i");
		if (pattern.test(lowerText)) {
			return marker;
		}
	}
	return null;
}

/**
 * Escape a string for safe inclusion in HTML text content.
 */
function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

// ─── Main export function ─────────────────────────────────────────────────────

/**
 * Generate a static HTML summary page from a ledger rollup result.
 *
 * Throws an Error if the rollup serialisation contains any
 * FORBIDDEN_RAW_PAYLOAD_MARKERS. This is a hard error — the caller must not
 * catch and continue.
 *
 * The returned HTML:
 *   - Contains no raw numeric scores.
 *   - Contains only confidence_bucket, sample_count, and last_observation_at.
 *   - Uses inline CSS only.
 *   - Includes an advisory_only HTML comment.
 *   - Is marked advisory_only: true, dispatch_authority_enabled: false.
 */
export function generateRollupStaticPageV1(
	input: RollupStaticExportInputV1,
): RollupStaticExportResultV1 {
	const { rollup, pageTitle, generatedAt } = input;

	// ── Redaction gate: scan serialised rollup for forbidden markers ──────────
	const serialisedRollup = JSON.stringify(rollup);
	const forbiddenHit = scanForForbiddenMarkers(serialisedRollup);
	if (forbiddenHit !== null) {
		throw new Error(
			`generateRollupStaticPageV1: forbidden raw payload marker detected in rollup: "${forbiddenHit}". ` +
			`The rollup input contains a field that must not appear in exported output. ` +
			`Remove or redact the field before calling this function.`,
		);
	}

	// ── Safe display values only ───────────────────────────────────────────────
	// Raw score values (weighted_mean_score, p25, p50, p75, p90,
	// decay_adjusted_mean, scorer_concentration, etc.) are intentionally
	// excluded from the HTML output.
	const confidenceBucket = escapeHtml(rollup.confidence_bucket);
	const sampleCount = Number.isFinite(rollup.sample_count) ? rollup.sample_count : 0;
	const lastObservationAt = escapeHtml(rollup.last_observation_at ?? "unknown");
	const title = escapeHtml(pageTitle ?? "FlowDesk Score Ledger Summary");
	const generatedAtDisplay = escapeHtml(
		generatedAt ?? new Date().toISOString(),
	);

	// ── Confidence bucket label display name ───────────────────────────────────
	const bucketDisplayMap: Record<string, string> = {
		low: "Low",
		medium: "Medium",
		high: "High",
		very_high: "Very High",
	};
	const bucketDisplay = escapeHtml(
		bucketDisplayMap[rollup.confidence_bucket] ?? rollup.confidence_bucket,
	);

	// ── Inline CSS ─────────────────────────────────────────────────────────────
	const inlineCss = [
		"body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#1a1a1a;background:#fff}",
		"h1{font-size:1.5rem;margin-bottom:1rem;border-bottom:2px solid #0066cc;padding-bottom:.5rem}",
		".advisory-banner{background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:.75rem 1rem;margin-bottom:1.5rem;font-size:.875rem}",
		".summary-table{width:100%;border-collapse:collapse;margin-bottom:1.5rem}",
		".summary-table th,.summary-table td{text-align:left;padding:.5rem .75rem;border-bottom:1px solid #e0e0e0}",
		".summary-table th{background:#f5f5f5;font-weight:600}",
		".bucket-badge{display:inline-block;padding:.2rem .6rem;border-radius:12px;font-size:.875rem;font-weight:600}",
		".bucket-low{background:#fde8e8;color:#991b1b}",
		".bucket-medium{background:#fef3c7;color:#92400e}",
		".bucket-high{background:#d1fae5;color:#065f46}",
		".bucket-very_high{background:#dbeafe;color:#1e40af}",
		".footer{font-size:.75rem;color:#666;margin-top:2rem;border-top:1px solid #e0e0e0;padding-top:.75rem}",
	].join("\n");

	// ── Confidence bucket CSS class ────────────────────────────────────────────
	const safeBucketClass = `bucket-${confidenceBucket.replace(/[^a-z_]/g, "")}`;

	// ── HTML assembly ──────────────────────────────────────────────────────────
	const html = [
		"<!DOCTYPE html>",
		"<html lang=\"en\">",
		"<head>",
		"<meta charset=\"UTF-8\">",
		"<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
		`<title>${title}</title>`,
		"<style>",
		inlineCss,
		"</style>",
		"</head>",
		"<body>",
		// advisory_only comment — required per spec
		"<!-- advisory_only: true | dispatch_authority_enabled: false | ranking_authority_enabled: false -->",
		`<h1>${title}</h1>`,
		// Advisory banner
		"<div class=\"advisory-banner\">",
		"&#9432; This summary is <strong>advisory only</strong>. It does not confer dispatch, ",
		"ranking, or provider-call authority. Raw score values are intentionally omitted.",
		"</div>",
		// Summary table — only safe fields
		"<table class=\"summary-table\">",
		"<thead><tr><th>Field</th><th>Value</th></tr></thead>",
		"<tbody>",
		"<tr>",
		"<td>Confidence Bucket</td>",
		`<td><span class="bucket-badge ${safeBucketClass}">${bucketDisplay}</span></td>`,
		"</tr>",
		"<tr>",
		"<td>Sample Count</td>",
		`<td>${sampleCount}</td>`,
		"</tr>",
		"<tr>",
		"<td>Last Observation</td>",
		`<td>${lastObservationAt}</td>`,
		"</tr>",
		"</tbody>",
		"</table>",
		// Footer
		"<div class=\"footer\">",
		`Generated: ${generatedAtDisplay} &mdash; `,
		"FlowDesk advisory export &mdash; no dispatch authority",
		"</div>",
		"</body>",
		"</html>",
	].join("\n");

	return {
		html,
		redactionApplied: true,
		advisory_only: true,
		dispatch_authority_enabled: false,
	};
}
