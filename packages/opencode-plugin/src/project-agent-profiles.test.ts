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
  "flowdesk-algorithm-architect",
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

const buildTestCapableProfiles = new Set<string>([
  "flowdesk-code-backend",
  "flowdesk-code-frontend",
  "flowdesk-code-language-specialist",
  "flowdesk-migration-refactor",
  "flowdesk-verifier-testing",
]);

const readOnlyGitCapableProfiles = new Set<string>([
	"flowdesk-architecture",
	"flowdesk-algorithm-architect",
	"flowdesk-critical-reviewer",
  "flowdesk-git-master",
  "flowdesk-security-policy",
  "flowdesk-verifier-testing",
]);

const mutatingGitDenyPatterns = ["git add*", "git commit*", "git push*", "git reset*", "git checkout*", "git switch*", "git rebase*", "git merge*", "git clean*"];
const ordinaryGitMutationProfiles = new Set<string>(["flowdesk-git-master"]);

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
      assert.match(markdown, /bounded/i, `${profile} must describe bounded edit scope`);
    } else {
      assert.match(frontmatter, /^  edit: deny$/m, `${profile} must remain edit-denied`);
    }
    if (ordinaryGitMutationProfiles.has(profile)) assert.match(frontmatter, /^  bash:\n    "\*": allow$/m, `${profile} bash may default to allow for ordinary git actions`);
    else assert.match(frontmatter, /^  bash:\n    "\*": ask$/m, `${profile} bash must default to ask`);
    assert.match(frontmatter, /^  read: allow$/m, `${profile} must allow read-only file reads`);
    assert.match(frontmatter, /^  glob: allow$/m, `${profile} must allow read-only glob searches`);
    assert.match(frontmatter, /^  grep: allow$/m, `${profile} must allow read-only content searches`);
    assert.match(frontmatter, /^  list: allow$/m, `${profile} must allow read-only directory listing`);
    assert.match(frontmatter, /^  external_directory:\n    "\*": allow$/m, `${profile} must allow external read boundary crossing`);
    assert.match(frontmatter, /^    "head \*": allow$/m, `${profile} may run read-only head utility`);
    assert.match(frontmatter, /^    "grep \*": allow$/m, `${profile} may run read-only grep utility`);
    assert.match(frontmatter, /^    "echo \*": allow$/m, `${profile} may run read-only echo utility`);
    for (const pattern of mutatingGitDenyPatterns) {
      if (ordinaryGitMutationProfiles.has(profile) && ["git add*", "git commit*", "git push*"].includes(pattern)) continue;
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
      assert.match(frontmatter, new RegExp(`^    "${escaped}": deny$`, "m"), `${profile} must deny ${pattern}`);
    }
    if (ordinaryGitMutationProfiles.has(profile)) {
      assert.doesNotMatch(frontmatter, /^    "git add\*": deny$/m, `${profile} must allow ordinary git add`);
      assert.doesNotMatch(frontmatter, /^    "git commit\*": deny$/m, `${profile} must allow ordinary git commit`);
      assert.doesNotMatch(frontmatter, /^    "git push\*": deny$/m, `${profile} must allow ordinary git push`);
      assert.match(frontmatter, /^    "git commit --amend\*": deny$/m, `${profile} must deny commit amend`);
      assert.match(frontmatter, /^    "git push --force\*": deny$/m, `${profile} must deny force push`);
      assert.match(frontmatter, /^    "git push -f\*": deny$/m, `${profile} must deny shorthand force push`);
    }
    if (readOnlyGitCapableProfiles.has(profile)) {
      assert.match(frontmatter, /^    "git status\*": allow$/m, `${profile} may run read-only git status`);
      assert.match(frontmatter, /^    "git diff\*": allow$/m, `${profile} may run read-only git diff`);
    } else {
      assert.doesNotMatch(frontmatter, /^    "git status\*": allow$/m, `${profile} should not explicitly allow git status`);
      assert.doesNotMatch(frontmatter, /^    "git diff\*": allow$/m, `${profile} should not explicitly allow git diff`);
    }
    if (buildTestCapableProfiles.has(profile)) {
      assert.match(frontmatter, /^    "npm run build\*": allow$/m, `${profile} may run build checks`);
      assert.match(frontmatter, /^    "npm run test\*": allow$/m, `${profile} may run test checks`);
    } else {
      assert.doesNotMatch(frontmatter, /^    "npm run build\*": allow$/m, `${profile} should not explicitly allow build checks`);
      assert.doesNotMatch(frontmatter, /^    "npm run test\*": allow$/m, `${profile} should not explicitly allow test checks`);
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
