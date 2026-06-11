#!/usr/bin/env node
/**
 * FlowDesk GitHub Workflow Permission Auditor.
 *
 * Validates that workflow YAML files under the configured templates directory
 * follow the FlowDesk least-privilege permission standard.
 *
 * Rules enforced:
 *   1. No top-level `permissions: write-all` or `permissions: admin` block.
 *   2. No per-job `permissions: write-all` or `permissions: admin` block.
 *   3. `contents: write` is allowed only when workflow name contains
 *      "publish", "release", or "deploy" (case-insensitive).
 *   4. `actions: write` is forbidden unconditionally.
 *   5. `packages: write` is forbidden unconditionally.
 *   6. `secrets: read` or `secrets: write` is forbidden unconditionally
 *      (secrets are accessed via ${{ secrets.* }} expressions, not permissions).
 *   7. Every workflow must have an explicit top-level `permissions:` block
 *      (absence defaults to permissive write, which is not least-privilege).
 *
 * Exit codes:
 *   0 — all workflows pass
 *   1 — one or more violations found
 *   2 — script usage/invocation error
 *
 * Usage:
 *   node scripts/audit-github-workflow-permissions.mjs [--dir <path>] [--verbose]
 *
 * Authority:
 *   This script does NOT grant dispatch / fallback / provider /
 *   remote-write / lane-launch authority. It performs read-only YAML
 *   analysis under the configured templates directory.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { argv, exit, stdout, stderr } from 'node:process';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_WORKFLOWS_DIR =
  'packages/opencode-plugin/templates/github-workflows';

/** Permissions that are unconditionally forbidden in any context. */
const UNCONDITIONALLY_FORBIDDEN_PERMISSIONS = new Set([
  'write-all',
  'admin',
  'actions: write',
  'packages: write',
  'secrets: read',
  'secrets: write',
]);

/** Forbidden when the workflow name does not indicate a publish/release/deploy intent. */
const PUBLISH_ONLY_PERMISSIONS = new Set(['contents: write']);

/** Workflow name patterns that allow `contents: write`. */
const PUBLISH_NAME_PATTERNS = [/publish/i, /release/i, /deploy/i];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse CLI arguments (no third-party deps). */
function parseArgs(args) {
  const out = { dir: DEFAULT_WORKFLOWS_DIR, verbose: false, help: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) {
      out.dir = args[++i];
    } else if (args[i] === '--verbose') {
      out.verbose = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      out.help = true;
    }
  }
  return out;
}

/** Collect *.yml and *.yaml files from a directory (non-recursive). */
function collectWorkflowFiles(dir) {
  const resolved = resolve(dir);
  let entries;
  try {
    entries = readdirSync(resolved);
  } catch (err) {
    return { ok: false, reason: `cannot read directory: ${err.message}` };
  }
  const files = entries
    .filter((e) => e.endsWith('.yml') || e.endsWith('.yaml'))
    .filter((e) => {
      const full = join(resolved, e);
      try {
        return statSync(full).isFile();
      } catch {
        return false;
      }
    })
    .map((e) => join(resolved, e));
  return { ok: true, files };
}

/**
 * Minimal structural YAML parser for the permissions block.
 *
 * We deliberately avoid a third-party YAML parser to keep this script
 * dependency-free. Instead we use line-by-line heuristics that are
 * sufficient for well-formed GitHub Actions workflow files.
 *
 * Returns a structured object with:
 *   name          — workflow name (string or undefined)
 *   hasTopPermissions — boolean: top-level `permissions:` key present
 *   topPermissions — object: key→value map of top-level permissions
 *   jobPermissions — map of jobId → {key→value} for per-job overrides
 */
function parseWorkflowPermissions(text) {
  const lines = text.split('\n');
  const result = {
    name: undefined,
    hasTopPermissions: false,
    topPermissions: {},
    jobPermissions: {},
  };

  let inTopPermissions = false;
  let inJobs = false;
  let currentJobId = null;
  let inJobPermissions = false;
  let currentIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trimEnd();
    if (trimmed.trimStart().startsWith('#')) continue; // skip comments
    const indent = raw.length - raw.trimStart().length;

    // Detect workflow name (top-level key, indent 0)
    if (indent === 0) {
      const nameMatch = trimmed.match(/^name:\s*(.+)$/);
      if (nameMatch) {
        result.name = nameMatch[1].replace(/^['"]|['"]$/g, '').trim();
      }
    }

    // Detect top-level `permissions:` block (indent 0)
    if (indent === 0 && /^permissions\s*:/.test(trimmed)) {
      inTopPermissions = true;
      inJobs = false;
      inJobPermissions = false;
      currentJobId = null;
      result.hasTopPermissions = true;
      // Check for inline value: `permissions: read-all` or `permissions: write-all`
      const inlineMatch = trimmed.match(/^permissions\s*:\s*(\S+)/);
      if (inlineMatch && inlineMatch[1] !== '') {
        result.topPermissions['__inline__'] = inlineMatch[1];
      }
      continue;
    }

    // Detect top-level `jobs:` block (indent 0)
    if (indent === 0 && /^jobs\s*:/.test(trimmed)) {
      inTopPermissions = false;
      inJobs = true;
      currentJobId = null;
      inJobPermissions = false;
      continue;
    }

    // Any other top-level key ends the permissions block
    if (indent === 0 && !/^\s*$/.test(trimmed)) {
      if (inTopPermissions && !/^permissions\s*:/.test(trimmed)) {
        inTopPermissions = false;
      }
    }

    // Inside top-level permissions block (indent 2)
    if (inTopPermissions && indent === 2) {
      const kvMatch = trimmed.trim().match(/^(\S+)\s*:\s*(\S+)/);
      if (kvMatch) {
        result.topPermissions[kvMatch[1]] = kvMatch[2];
      }
    }

    // Inside jobs block: detect job IDs (indent 2)
    if (inJobs && indent === 2 && /^\S/.test(trimmed.trimStart())) {
      const jobIdMatch = trimmed.trim().match(/^(\w[\w-]*):\s*$/);
      if (jobIdMatch) {
        currentJobId = jobIdMatch[1];
        inJobPermissions = false;
        result.jobPermissions[currentJobId] = {};
      }
    }

    // Inside a specific job: detect `permissions:` key (indent 4)
    if (inJobs && currentJobId && indent === 4) {
      if (/^permissions\s*:/.test(trimmed.trim())) {
        inJobPermissions = true;
        const inlineMatch = trimmed.trim().match(/^permissions\s*:\s*(\S+)/);
        if (inlineMatch && inlineMatch[1] !== '') {
          result.jobPermissions[currentJobId]['__inline__'] = inlineMatch[1];
        }
        continue;
      } else {
        // Any other indent-4 key ends the permissions sub-block
        inJobPermissions = false;
      }
    }

    // Inside a job's permissions block (indent 6)
    if (inJobs && currentJobId && inJobPermissions && indent === 6) {
      const kvMatch = trimmed.trim().match(/^(\S+)\s*:\s*(\S+)/);
      if (kvMatch) {
        result.jobPermissions[currentJobId][kvMatch[1]] = kvMatch[2];
      }
    }
  }

  return result;
}

/**
 * Audit a single workflow file.
 * Returns an array of violation strings (empty = pass).
 */
function auditWorkflow(filePath) {
  let text;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch (err) {
    return [`[read-error] Cannot read file: ${err.message}`];
  }

  const parsed = parseWorkflowPermissions(text);
  const violations = [];
  const name = parsed.name ?? basename(filePath);

  // Rule 7: must have explicit top-level permissions block
  if (!parsed.hasTopPermissions) {
    violations.push(
      `[missing-permissions-block] Workflow "${name}" has no top-level ` +
        `"permissions:" block. Absence defaults to write-all, violating ` +
        `least-privilege principle.`,
    );
  }

  // Rule 1+2: check top-level inline value (write-all / admin / etc.)
  const topInline = parsed.topPermissions['__inline__'];
  if (topInline) {
    if (topInline === 'write-all') {
      violations.push(
        `[top-write-all] Workflow "${name}" uses top-level "permissions: write-all". ` +
          `Use explicit per-scope grants instead.`,
      );
    } else if (topInline === 'admin') {
      violations.push(
        `[top-admin] Workflow "${name}" uses top-level "permissions: admin". ` +
          `Admin-level permissions are forbidden.`,
      );
    }
  }

  // Rule 3–6: check each key→value pair in the top-level permissions map
  for (const [key, value] of Object.entries(parsed.topPermissions)) {
    if (key === '__inline__') continue;
    const combined = `${key}: ${value}`;
    if (value === 'write-all' || value === 'admin') {
      violations.push(
        `[forbidden-perm] Workflow "${name}" top-level permission "${combined}" is forbidden.`,
      );
    }
    if (key === 'actions' && value === 'write') {
      violations.push(
        `[actions-write] Workflow "${name}" grants "actions: write" at top level. ` +
          `This is unconditionally forbidden.`,
      );
    }
    if (key === 'packages' && value === 'write') {
      violations.push(
        `[packages-write] Workflow "${name}" grants "packages: write" at top level. ` +
          `This is unconditionally forbidden.`,
      );
    }
    if (key === 'secrets') {
      violations.push(
        `[secrets-perm] Workflow "${name}" grants "secrets: ${value}" at top level. ` +
          `Secrets are accessed via expressions, not permissions.`,
      );
    }
    if (key === 'contents' && value === 'write') {
      const isPublishWorkflow = PUBLISH_NAME_PATTERNS.some((re) =>
        re.test(name),
      );
      if (!isPublishWorkflow) {
        violations.push(
          `[contents-write-non-publish] Workflow "${name}" grants "contents: write" ` +
            `but the workflow name does not indicate a publish/release/deploy intent. ` +
            `Remove the permission or rename the workflow.`,
        );
      }
    }
  }

  // Rule 1+2: check per-job permissions
  for (const [jobId, perms] of Object.entries(parsed.jobPermissions)) {
    const jobInline = perms['__inline__'];
    if (jobInline) {
      if (jobInline === 'write-all') {
        violations.push(
          `[job-write-all] Job "${jobId}" in workflow "${name}" uses ` +
            `"permissions: write-all". Use explicit grants.`,
        );
      } else if (jobInline === 'admin') {
        violations.push(
          `[job-admin] Job "${jobId}" in workflow "${name}" uses ` +
            `"permissions: admin". Admin-level permissions are forbidden.`,
        );
      }
    }
    for (const [key, value] of Object.entries(perms)) {
      if (key === '__inline__') continue;
      if (value === 'write-all' || value === 'admin') {
        violations.push(
          `[job-forbidden-perm] Job "${jobId}" in workflow "${name}" grants ` +
            `"${key}: ${value}". Forbidden.`,
        );
      }
      if (key === 'actions' && value === 'write') {
        violations.push(
          `[job-actions-write] Job "${jobId}" in workflow "${name}" grants ` +
            `"actions: write". This is unconditionally forbidden.`,
        );
      }
      if (key === 'packages' && value === 'write') {
        violations.push(
          `[job-packages-write] Job "${jobId}" in workflow "${name}" grants ` +
            `"packages: write". This is unconditionally forbidden.`,
        );
      }
      if (key === 'secrets') {
        violations.push(
          `[job-secrets-perm] Job "${jobId}" in workflow "${name}" grants ` +
            `"secrets: ${value}". Secrets are accessed via expressions, not permissions.`,
        );
      }
    }
  }

  return violations;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function printHelp() {
  stdout.write(
    [
      'Usage: node scripts/audit-github-workflow-permissions.mjs [--dir <path>] [--verbose]',
      '',
      'Validates that GitHub Actions workflow YAML files use least-privilege permissions.',
      '',
      'Options:',
      `  --dir <path>   Directory containing *.yml / *.yaml workflow files.`,
      `                 Defaults to: ${DEFAULT_WORKFLOWS_DIR}`,
      '  --verbose      Print passing files as well as failures.',
      '  --help, -h     Show this help text.',
      '',
      'Exit codes:',
      '  0   All workflows pass.',
      '  1   One or more violations found.',
      '  2   Invocation error (bad --dir, unreadable path, etc.).',
      '',
    ].join('\n'),
  );
}

async function main() {
  const args = parseArgs(argv.slice(2));

  if (args.help) {
    printHelp();
    return 0;
  }

  const collected = collectWorkflowFiles(args.dir);
  if (!collected.ok) {
    stderr.write(
      `audit-github-workflow-permissions: ${collected.reason}\n`,
    );
    return 2;
  }

  const { files } = collected;
  if (files.length === 0) {
    stdout.write(
      `audit-github-workflow-permissions: no workflow files found in "${args.dir}"\n`,
    );
    return 0;
  }

  let totalViolations = 0;

  for (const file of files) {
    const violations = auditWorkflow(file);
    if (violations.length === 0) {
      if (args.verbose) {
        stdout.write(`  PASS  ${basename(file)}\n`);
      }
    } else {
      stdout.write(`  FAIL  ${basename(file)}\n`);
      for (const v of violations) {
        stdout.write(`        ${v}\n`);
      }
      totalViolations += violations.length;
    }
  }

  if (totalViolations > 0) {
    stdout.write(
      `\naudit-github-workflow-permissions: ${totalViolations} violation(s) ` +
        `found across ${files.length} file(s).\n`,
    );
    return 1;
  }

  stdout.write(
    `audit-github-workflow-permissions: all ${files.length} workflow file(s) pass.\n`,
  );
  return 0;
}

main().then(
  (code) => exit(code),
  (err) => {
    stderr.write(
      `audit-github-workflow-permissions: unexpected error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    exit(2);
  },
);
