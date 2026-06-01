import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const agentDir = resolve(repoRoot, ".opencode/agent");

const expectedProfiles = [
  "flowdesk-docs-writer",
  "flowdesk-explorer-researcher",
  "flowdesk-git-master",
  "flowdesk-code-backend",
  "flowdesk-code-frontend",
  "flowdesk-code-language-specialist",
  "flowdesk-critical-reviewer",
  "flowdesk-architecture",
  "flowdesk-oracle-decision",
  "flowdesk-verifier-testing",
  "flowdesk-security-policy",
  "flowdesk-performance",
  "flowdesk-migration-refactor"
] as const;

const writeCapableProfiles = new Set<string>([
  "flowdesk-code-backend",
  "flowdesk-code-frontend",
  "flowdesk-code-language-specialist",
  "flowdesk-docs-writer",
  "flowdesk-migration-refactor",
]);

function readProfile(name: string): string {
  const path = resolve(agentDir, `${name}.md`);
  assert.equal(existsSync(path), true, `${path} must exist`);
  return readFileSync(path, "utf8");
}

function frontmatterOf(markdown: string): string {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(markdown);
  assert.ok(match, "profile must start with YAML frontmatter");
  return match[1];
}

test("Release 1 project subagent profiles exist and use supported frontmatter", () => {
  for (const profile of expectedProfiles) {
    const markdown = readProfile(profile);
    const frontmatter = frontmatterOf(markdown);
    const topLevelKeys = [...frontmatter.matchAll(/^([a-zA-Z_][a-zA-Z0-9_]*):/gm)].map((match) => match[1]);

    assert.deepEqual(topLevelKeys, ["description", "mode", "model", "permission"], `${profile} frontmatter keys`);
    assert.match(frontmatter, /^mode: subagent$/m, `${profile} must be a subagent`);
    if (writeCapableProfiles.has(profile)) {
      assert.match(frontmatter, /^  edit: allow$/m, `${profile} should be bounded write-capable for its implementation role`);
      assert.match(frontmatter, /^  bash: ask$/m, `${profile} should ask before verification commands`);
      assert.match(markdown, /bounded/i, `${profile} must describe bounded edit scope`);
    } else {
      assert.match(frontmatter, /^  edit: deny$/m, `${profile} must remain edit-denied`);
    }
    assert.doesNotMatch(
      frontmatter,
      /^(input_contract|output_contract|registry_entry|agent_id|role_category|release_gate|dispatch_authority_enabled|fallback_allowed):/m
    );
  }
});

test("Release 1 project subagent profiles do not smuggle unsafe authority", () => {
  const forbiddenPatterns = [
    /\bOMO\b/i,
    /opencode\s+run/i,
    /allowProviderCall:\s*true/i,
    /developerModeAcknowledged:\s*true/i,
    /flowdesk_agent_task_run/i,
    /flowdesk_quick_reviewer_run/i,
    /flowdesk_workflow_dispatch_plan/i,
    /fallback_allowed:\s*true/i,
    /dispatch_authority_enabled:\s*true/i,
    /real dispatch is enabled/i,
    /approve(s|d)?\s+(real\s+)?dispatch/i,
    /hard chat cancellation/i,
    /hidden\s+injection\s+is\s+allowed/i,
    /nested\s+OpenCode\s+CLI\s+execution\s+is\s+allowed/i
  ];

  for (const profile of expectedProfiles) {
    const markdown = readProfile(profile);
    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(markdown, pattern, `${profile} must not match ${pattern}`);
    }
  }
});
