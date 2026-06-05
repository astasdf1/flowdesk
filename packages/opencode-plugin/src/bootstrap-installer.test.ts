import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES } from "@flowdesk/core";
import { flowDeskBootstrapProfileRootRef, installFlowDeskRelease1Bootstrap } from "./index.js";

const installedAgentProfiles = [
  "flowdesk-main",
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
  "flowdesk-release-package-verifier",
  "flowdesk-security-policy",
  "flowdesk-performance",
  "flowdesk-migration-refactor",
] as const;

const installedWriteCapableProfiles = new Set<string>([
  "flowdesk-code-backend",
  "flowdesk-code-frontend",
  "flowdesk-code-language-specialist",
  "flowdesk-docs-writer",
  "flowdesk-migration-refactor",
]);

const installedBuildTestCapableProfiles = new Set<string>([
  "flowdesk-code-backend",
  "flowdesk-code-frontend",
  "flowdesk-code-language-specialist",
  "flowdesk-migration-refactor",
  "flowdesk-performance",
  "flowdesk-verifier-testing",
]);

const installedReleasePackageVerifierProfiles = new Set<string>([
  "flowdesk-release-package-verifier",
]);

const installedReadOnlyGitCapableProfiles = new Set<string>([
	"flowdesk-architecture",
	"flowdesk-algorithm-architect",
	"flowdesk-critical-reviewer",
  "flowdesk-docs-writer",
  "flowdesk-explorer-researcher",
  "flowdesk-git-master",
  "flowdesk-oracle-decision",
  "flowdesk-performance",
  "flowdesk-security-policy",
  "flowdesk-verifier-testing",
]);

function typedConfirmation(targetProfileRef: string, profileRootDir: string, suffix: string) {
  const confirmationRef = `confirmation-release1-${suffix}`;
  const profileRootRef = flowDeskBootstrapProfileRootRef(profileRootDir);
  return {
    confirmationRef,
    targetProfileRef,
    profileRootRef,
    installPlanRef: `install-plan-${targetProfileRef}`,
    rollbackPlanRef: `rollback-plan-${targetProfileRef}`,
    expiresAt: "2026-05-19T00:10:00.000Z",
    actorClass: "user" as const,
    typedPhrase: `install FlowDesk release1 ${targetProfileRef} ${profileRootRef} ${confirmationRef} install-plan-${targetProfileRef}`
  };
}

function typedPhraseHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function ledgerPath(durableRoot: string, confirmationRef: string): string {
  return join(durableRoot, ".flowdesk", "bootstrap", "confirmations", `${confirmationRef}.json`);
}

function writeLedger(durableRoot: string, confirmation: ReturnType<typeof typedConfirmation>, status: "pending" | "consumed", overrides: Record<string, unknown> = {}) {
  const target = ledgerPath(durableRoot, confirmation.confirmationRef);
  mkdirSync(join(durableRoot, ".flowdesk", "bootstrap", "confirmations"), { recursive: true });
  const ledger: Record<string, unknown> = {
    schema_version: "flowdesk.bootstrap_confirmation_consumption.v1",
    confirmation_ref: confirmation.confirmationRef,
    status,
    target_profile_ref: confirmation.targetProfileRef,
    profile_root_ref: confirmation.profileRootRef,
    install_plan_ref: confirmation.installPlanRef,
    rollback_plan_ref: confirmation.rollbackPlanRef,
    typed_phrase_hash: typedPhraseHash(confirmation.typedPhrase),
    created_at: "2026-05-19T00:00:00.000Z",
    expires_at: confirmation.expiresAt,
    actor_class: confirmation.actorClass,
    ...overrides
  };
  if (status === "consumed" && ledger.consumed_at === undefined) ledger.consumed_at = "2026-05-19T00:00:00.000Z";
  writeFileSync(target, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

function writeConsumedLedger(durableRoot: string, confirmation: ReturnType<typeof typedConfirmation>, overrides: Record<string, unknown> = {}) {
  writeLedger(durableRoot, confirmation, "consumed", overrides);
}

function writePendingLedger(durableRoot: string, confirmation: ReturnType<typeof typedConfirmation>, overrides: Record<string, unknown> = {}) {
  writeLedger(durableRoot, confirmation, "pending", overrides);
}

function findFlowDeskPluginEntry(config: Record<string, unknown>): [string, Record<string, unknown>] {
	const plugins = config.plugin as unknown[];
	assert.equal(Array.isArray(plugins), true);
	const entry = plugins.find((candidate): candidate is [string, Record<string, unknown>] => {
		return Array.isArray(candidate) && typeof candidate[0] === "string" && candidate[0].includes("@flowdesk/opencode-plugin/dist/server.js");
	});
	if (entry === undefined) assert.fail("FlowDesk plugin entry missing");
	assert.equal(typeof entry[1], "object");
	assert.notEqual(entry[1], null);
	assert.equal(Array.isArray(entry[1]), false);
	return entry;
}

test("Release 1 bootstrap installer materializes commands and redacted bootstrap artifacts", () => {
  const profileRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-profile-"));
  const durableRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-durable-"));
  try {
    const confirmation = typedConfirmation("profile-release1", profileRoot, "happy");
    const result = installFlowDeskRelease1Bootstrap({
      profileRootDir: profileRoot,
      durableStateRootDir: durableRoot,
      targetProfileRef: "profile-release1",
      typedConfirmation: confirmation,
      now: new Date("2026-05-19T00:00:00.000Z")
    });

		assert.equal(result.ok, true);
		assert.equal(result.commandFilesWritten, 9);
		assert.equal(result.agentProfileFilesWritten, 16);
		assert.equal(result.profileConfigUpdated, true);
		assert.equal(result.aliasFilesWritten, 0);
		assert.equal(result.bootstrapArtifactsWritten, 4);
    assert.equal(result.productionRegistrationEligible, false);
    assert.equal(result.commandAliasEligible, false);
    assert.equal(result.providerCall, false);
    assert.equal(result.runtimeExecution, false);
    assert.equal(result.realOpenCodeDispatch, false);
    assert.equal(result.actualLaneLaunch, false);

		for (const commandName of FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES) {
			const commandFile = join(profileRoot, "commands", `${commandName.slice(1)}.md`);
			assert.equal(existsSync(commandFile), true, commandName);
			assert.match(readFileSync(commandFile, "utf8"), new RegExp(commandName.replace("/", "\\/")));
		}
		const mainAgent = readFileSync(join(profileRoot, "agent", "flowdesk-main.md"), "utf8");
		assert.match(mainAgent, /mode: primary/);
		assert.match(mainAgent, /permission:\n\s+read: allow/);
		assert.match(mainAgent, /^  bash:\n    "\*": allow$/m);
		assert.doesNotMatch(mainAgent, /^    "git commit\*": deny$/m);
		assert.doesNotMatch(mainAgent, /^    "git push\*": deny$/m);
		assert.match(mainAgent, /^    "git commit --amend\*": deny$/m);
		assert.match(mainAgent, /^    "git push --force\*": deny$/m);
		assert.match(mainAgent, /^  edit: allow$/m);
		assert.match(mainAgent, /^  task: deny$/m);
		assert.match(mainAgent, /^  lsr: allow$/m);
		assert.match(mainAgent, /^  external_directory:\n    "\*": allow$/m);
		assert.match(mainAgent, /model: openai\/gpt-5\.3-codex-spark/);
		assert.match(mainAgent, /Mandatory dispatch boundary/);
		assert.match(mainAgent, /flowdesk_agent_task_run/);
		assert.match(mainAgent, /flowdesk_quick_reviewer_run.*quarantined/s);
		assert.match(mainAgent, /Lane Size Gate — apply before every dispatch/);
		assert.match(mainAgent, /exactly 1 primary objective/);
		assert.match(mainAgent, /exactly 1 clear deliverable/);
		assert.match(mainAgent, /installer\/materialization behavior/);
		assert.match(mainAgent, /read-only root-cause slice/);
		assert.match(mainAgent, /progress events without a final answer/);
		assert.match(mainAgent, /inconsistent_finalizing_without_terminal/);
		assert.match(mainAgent, /task_launched.*launch ack only/s);
		assert.match(mainAgent, /not progress, completion, approval, or todo completion/);
		assert.match(mainAgent, /Do not call `flowdesk_status_live` immediately just to confirm startup/);
		assert.match(mainAgent, /Wake prompts are notification triggers only/);
		assert.match(mainAgent, /durable status\/result evidence remains the source of truth/);
		assert.match(mainAgent, /Call `flowdesk_status_live` when:.*FlowDesk wake arrives.*launch result failed\/uncertain.*잘 됐어.*결과는.*어디까지.*진행 상황.*how did it go/s);
		assert.match(mainAgent, /multi-lane synthesis needs durable evidence/);
		assert.match(mainAgent, /When multiple lanes are in flight, do not wait for all lanes by default/);
		assert.match(mainAgent, /completed lane is independent of still-running lanes/);
		assert.match(mainAgent, /next decision, synthesis, approval, or verification depends on their aggregate result/);
		assert.match(mainAgent, /Never mark an aggregate todo complete until all required dependent lanes are terminal/);
		assert.match(mainAgent, /one lane per perspective and stay within the 5-concurrent-lane cap/);
		assert.match(mainAgent, /status\/progress\/recent result\/stalled → `flowdesk_status_live`; see Status, nudge, and result handling/);
		assert.match(mainAgent, /do not mark todos completed from launch ack alone/);
		assert.doesNotMatch(mainAgent, /After launching work, call `flowdesk_status_live`/);
		assert.doesNotMatch(mainAgent, /not quarantined reviewer fan-out/);
		assert.match(mainAgent, /Auto-invocation rules/);
		assert.match(mainAgent, /Todo and safety discipline/);
		assert.doesNotMatch(mainAgent, /Completion continuation policy/);
		assert.doesNotMatch(mainAgent, /continue with that next todo automatically/);
		assert.doesNotMatch(mainAgent, /response-waiting mode/);
		for (const profile of installedAgentProfiles) {
			const subagent = readFileSync(join(profileRoot, "agent", `${profile}.md`), "utf8");
			assert.match(subagent, /^  external_directory:\n    "\*": allow$/m, `${profile} external directory boundary should allow read-only tools to inspect external paths`);
			if (profile !== "flowdesk-main" && profile !== "flowdesk-git-master") assert.doesNotMatch(subagent, /^  bash:\n    "\*": allow$/m, `${profile} must not gain broad bash from external-directory policy`);
			const agent = readFileSync(join(profileRoot, "agent", `${profile}.md`), "utf8");
			assert.match(agent, /^  read: allow$/m, `${profile} read permission`);
			assert.match(agent, /^  glob: allow$/m, `${profile} glob permission`);
			assert.match(agent, /^  grep: allow$/m, `${profile} grep permission`);
			assert.match(agent, /^  list: allow$/m, `${profile} list permission`);
			if (profile === "flowdesk-main" || profile === "flowdesk-git-master") assert.match(agent, /^  bash:\n    "\*": allow$/m, `${profile} bash default`);
			else {
				// Background subagents must never have `ask` permission rules (causes permanent stall).
				// They use explicit allow-lists with `"*": deny` first because OpenCode is last-match-wins.
				const frontmatter = agent.split("---")[1] ?? "";
				assert.doesNotMatch(frontmatter, /: ask$/m, `${profile} must not have any ask permission rules in frontmatter`);
				assert.match(agent, /^  bash:\n    "\*": deny$/m, `${profile} bash catch-all deny must come first`);
			}
			if (profile !== "flowdesk-main" && profile !== "flowdesk-git-master") {
				// Allow-list profiles have explicit safe-command entries
				if (!installedReleasePackageVerifierProfiles.has(profile)) {
					assert.match(agent, /^    "head \*": allow$/m, `${profile} head utility allow`);
					assert.match(agent, /^    "grep \*": allow$/m, `${profile} grep utility allow`);
					assert.match(agent, /^    "echo \*": allow$/m, `${profile} echo utility allow`);
				}
				if (profile === "flowdesk-explorer-researcher") assert.match(agent, /^  webfetch: allow$/m, `${profile} webfetch research allow`);
				else assert.doesNotMatch(agent, /^  webfetch: ask$/m, `${profile} must not use webfetch ask`);
			}
			if (profile === "flowdesk-main" || profile === "flowdesk-git-master") {
				// Broad allow profiles use explicit dangerous-git denials
				assert.doesNotMatch(agent, /^    "git commit\*": deny$/m, `${profile} allows ordinary git commit`);
				assert.doesNotMatch(agent, /^    "git push\*": deny$/m, `${profile} allows ordinary git push`);
				assert.match(agent, /^    "git commit --amend\*": deny$/m, `${profile} denies commit amend`);
				assert.match(agent, /^    "git push --force\*": deny$/m, `${profile} denies force push`);
				const broadAllowIndex = agent.split("\n").findIndex((line) => line.trim() === '"*": allow');
				const amendDenyIndex = agent.split("\n").findIndex((line) => line.trim() === '"git commit --amend*": deny');
				assert.ok(amendDenyIndex > broadAllowIndex, `${profile} dangerous denies must come after broad allow`);
			} else {
				// Allow-list + "*": deny profiles don't need individual git denials —
				// any command not in the allow-list is already denied by the catch-all.
				// Verify git mutating commands are NOT in the allow-list.
				assert.doesNotMatch(agent, /"git commit\*": allow/m, `${profile} must not allow git commit`);
				assert.doesNotMatch(agent, /"git push\*": allow/m, `${profile} must not allow git push`);
				assert.doesNotMatch(agent, /"git reset\*": allow/m, `${profile} must not allow git reset`);
			}
			if (profile === "flowdesk-main") assert.match(agent, /^  edit: allow$/m, `${profile} edit allow`);
			else if (installedWriteCapableProfiles.has(profile)) assert.match(agent, /^  edit: allow$/m, `${profile} edit allow`);
			else assert.match(agent, /^  edit: deny$/m, `${profile} edit deny`);
			// Allow-list profiles (not main/git-master) have explicit git read-only entries
			if (profile !== "flowdesk-main" && profile !== "flowdesk-git-master") {
				const catchAllIndex = agent.split("\n").findIndex((line) => line.trim() === '"*": deny');
				const headAllowIndex = agent.split("\n").findIndex((line) => line.trim() === '"head *": allow');
				assert.ok(catchAllIndex >= 0, `${profile} catch-all deny must exist`);
				if (!installedReleasePackageVerifierProfiles.has(profile)) assert.ok(headAllowIndex > catchAllIndex, `${profile} allow rules must come after catch-all deny`);
				if (installedReadOnlyGitCapableProfiles.has(profile)) {
					assert.match(agent, /^    "git status": allow$/m, `${profile} exact read-only git allow`);
					assert.match(agent, /^    "git status --short": allow$/m, `${profile} exact git status short allow`);
					assert.match(agent, /^    "git status \*": allow$/m, `${profile} read-only git args allow`);
					const gitStatusAllowIndex = agent.split("\n").findIndex((line) => line.trim() === '"git status": allow');
					assert.ok(gitStatusAllowIndex > catchAllIndex, `${profile} git status allow must come after catch-all deny`);
					const gitStatusShortAllowIndex = agent.split("\n").findIndex((line) => line.trim() === '"git status --short": allow');
					assert.ok(gitStatusShortAllowIndex > catchAllIndex, `${profile} git status --short allow must come after catch-all deny`);
					assert.match(agent, /^    "git diff --check": allow$/m, `${profile} exact git diff check allow`);
					const gitDiffCheckAllowIndex = agent.split("\n").findIndex((line) => line.trim() === '"git diff --check": allow');
					assert.ok(gitDiffCheckAllowIndex > catchAllIndex, `${profile} git diff --check allow must come after catch-all deny`);
				} else assert.doesNotMatch(agent, /^    "git status(?: \*)?": allow$/m, `${profile} no explicit git status allow`);
				if (installedBuildTestCapableProfiles.has(profile)) {
					assert.match(agent, /^    "npm run build --workspace @flowdesk\/opencode-plugin": allow$/m, `${profile} exact workspace build allow`);
					assert.match(agent, /^    "npm run test \*": allow$/m, `${profile} test args allow`);
					assert.match(agent, /^    "node scripts\/run-tests\.mjs": allow$/m, `${profile} exact root test-runner allow`);
					assert.match(agent, /^    "node scripts\/run-tests\.mjs --mode functional --package core": allow$/m, `${profile} exact focused functional test-runner allow`);
					assert.match(agent, /^    "node scripts\/run-tests\.mjs \*": allow$/m, `${profile} root test-runner args allow`);
					assert.match(agent, /^    "node \.\.\/\.\.\/scripts\/run-tests\.mjs": allow$/m, `${profile} exact workspace test-runner allow`);
					assert.match(agent, /^    "node \.\.\/\.\.\/scripts\/run-tests\.mjs \*": allow$/m, `${profile} workspace test-runner args allow`);
					assert.match(agent, /^    "node --test packages\/opencode-plugin\/dist\/bootstrap-installer\.test\.js packages\/opencode-plugin\/dist\/project-agent-profiles\.test\.js": allow$/m, `${profile} exact focused node test allow`);
					const focusedNodeTestAllowIndex = agent.split("\n").findIndex((line) => line.trim() === '"node --test packages/opencode-plugin/dist/bootstrap-installer.test.js packages/opencode-plugin/dist/project-agent-profiles.test.js": allow');
					assert.ok(focusedNodeTestAllowIndex > catchAllIndex, `${profile} focused node test allow must come after catch-all deny`);
					const smokeAllowIndex = agent.split("\n").findIndex((line) => line.trim() === '"node scripts/run-tests.mjs": allow');
					assert.ok(smokeAllowIndex > catchAllIndex, `${profile} smoke target allow must come after catch-all deny`);
				}
				if (installedReleasePackageVerifierProfiles.has(profile)) {
					assert.match(agent, /^    "git diff --check": allow$/m, `${profile} exact git diff check allow`);
					assert.match(agent, /^    "git status --short": allow$/m, `${profile} exact git status short allow`);
					assert.match(agent, /^    "npm ls --workspace @flowdesk\/core": allow$/m, `${profile} core npm ls allow`);
					assert.match(agent, /^    "npm ls --workspace @flowdesk\/opencode-plugin": allow$/m, `${profile} plugin npm ls allow`);
					assert.match(agent, /^    "npm ls @opencode-ai\/plugin @opentui\/core @flowdesk\/core --workspace @flowdesk\/opencode-plugin": allow$/m, `${profile} exact release dependency tuple npm ls allow`);
					assert.match(agent, /^    "npm pack --dry-run --json --workspace @flowdesk\/core": allow$/m, `${profile} core npm pack dry-run allow`);
					assert.match(agent, /^    "npm pack --dry-run --json --workspace @flowdesk\/opencode-plugin": allow$/m, `${profile} plugin npm pack dry-run allow`);
					assert.match(agent, /^    "opencode --version": allow$/m, `${profile} opencode version allow`);
					assert.match(agent, /^    "npm publish\*": deny$/m, `${profile} npm publish deny`);
					assert.match(agent, /^    "npm install\*": deny$/m, `${profile} npm install deny`);
					assert.match(agent, /^    "rm\*": deny$/m, `${profile} rm deny`);
					assert.ok(agent.split("\n").findIndex((line) => line.trim() === '"git diff --check": allow') > catchAllIndex, `${profile} pack allow rules must come after catch-all deny`);
					assert.ok(agent.split("\n").findIndex((line) => line.trim() === '"npm publish*": deny') > agent.split("\n").findIndex((line) => line.trim() === '"npm pack --dry-run --json --workspace @flowdesk/opencode-plugin": allow'), `${profile} publish deny must come after pack allows for last-match-wins safety`);
				}
				if (!installedBuildTestCapableProfiles.has(profile) && !installedReleasePackageVerifierProfiles.has(profile)) assert.doesNotMatch(agent, /^    "npm run test(?: \*)?": allow$/m, `${profile} no explicit test allow`);
			}
		}
		// git-master: broad allow + dangerous git deny (Tier 3)
		const gitMasterAgent = readFileSync(join(profileRoot, "agent", "flowdesk-git-master.md"), "utf8");
		assert.match(gitMasterAgent, /mode: subagent/);
		assert.match(gitMasterAgent, /edit: deny/);
		assert.match(gitMasterAgent, /"\*": allow/);
		assert.doesNotMatch(gitMasterAgent, /"git commit\*": deny/);
		assert.doesNotMatch(gitMasterAgent, /"git push\*": deny/);
		assert.match(gitMasterAgent, /"git commit --amend\*": deny/);
		assert.match(gitMasterAgent, /"git push --force\*": deny/);
		// algorithm-architect: allow-list + "*": deny (Tier 1)
		const algorithmArchitectAgent = readFileSync(join(profileRoot, "agent", "flowdesk-algorithm-architect.md"), "utf8");
		assert.match(algorithmArchitectAgent, /mode: subagent/);
		assert.match(algorithmArchitectAgent, /edit: deny/);
		assert.match(algorithmArchitectAgent, /"git status": allow/);
		assert.match(algorithmArchitectAgent, /"git status \*": allow/);
		assert.match(algorithmArchitectAgent, /"git diff": allow/);
		assert.match(algorithmArchitectAgent, /"git diff \*": allow/);
		assert.match(algorithmArchitectAgent, /"\*": deny/);
		assert.doesNotMatch(algorithmArchitectAgent, /"git commit\*": allow/);
		const verifierAgent = readFileSync(join(profileRoot, "agent", "flowdesk-verifier-testing.md"), "utf8");
		assert.match(verifierAgent, /"npm run build": allow/);
		assert.match(verifierAgent, /"npm run build \*": allow/);
		assert.match(verifierAgent, /"node --test": allow/);
		assert.match(verifierAgent, /"node --test \*": allow/);
		const opencodeConfig = JSON.parse(readFileSync(join(profileRoot, "opencode.json"), "utf8")) as Record<string, unknown>;
		assert.equal(opencodeConfig.default_agent, "flowdesk-main");
		assert.equal(opencodeConfig.$schema, "https://opencode.ai/config.json");
		const flowdeskPlugin = findFlowDeskPluginEntry(opencodeConfig);
		assert.equal(flowdeskPlugin[0], `file://${join(profileRoot, "node_modules", "@flowdesk", "opencode-plugin", "dist", "server.js")}`);
		assert.equal(flowdeskPlugin[1].durableStateRoot, durableRoot);
		assert.deepEqual(flowdeskPlugin[1].statusLive, { enabled: true, maxWorkflows: 10 });
		assert.deepEqual(flowdeskPlugin[1].providerUsageLive, {
			enabled: true,
			providers: ["claude", "openai", "gemini"],
			claudeOAuthUsage: true,
			codexLiveUsage: true,
			geminiQuota: true,
			persistSnapshots: true,
			persistWorkflowId: "workflow-global-provider-usage",
		});
		assert.deepEqual(flowdeskPlugin[1].reviewerFanoutDiagnostics, { enabled: true });
		assert.deepEqual(flowdeskPlugin[1].agentTaskRun, { enabled: true });
		assert.deepEqual(flowdeskPlugin[1].exactModelProviderAcquisitionLiveTest, {
			enabled: true,
			durableStateRoot: durableRoot,
			promptBackedCheck: {
				enabled: true,
				allowProviderCall: true,
				agent: "flowdesk-verifier-testing",
				allowedProviderQualifiedModelIds: [
					"anthropic/claude-opus-4-7",
					"claude/claude-opus-4-7",
					"anthropic/claude-opus-4-8",
					"claude/claude-opus-4-8",
					"anthropic/claude-opus-4-6",
					"claude/claude-opus-4-6",
					"anthropic/claude-opus-4-5",
					"claude/claude-opus-4-5",
					"anthropic/claude-opus-4-1",
					"claude/claude-opus-4-1",
					"anthropic/claude-opus-4-0",
					"claude/claude-opus-4-0",
					"anthropic/claude-sonnet-4-6",
					"claude/claude-sonnet-4-6",
					"anthropic/claude-sonnet-4-5",
					"claude/claude-sonnet-4-5",
					"anthropic/claude-sonnet-4-0",
					"claude/claude-sonnet-4-0",
					"anthropic/claude-haiku-4-5",
					"claude/claude-haiku-4-5",
					"openai/gpt-5.5",
					"openai/gpt-5.5-fast",
					"openai/gpt-5.4",
					"openai/gpt-5.4-fast",
					"openai/gpt-5.4-mini",
					"openai/gpt-5.4-mini-fast",
					"openai/gpt-5.3-codex",
					"openai/gpt-5.3-codex-spark",
					"openai/gpt-5.2",
					"google/gemini-2.5-flash",
					"gemini/gemini-2.5-flash",
					"google/gemini-2.5-flash-lite",
					"gemini/gemini-2.5-flash-lite",
					"google/gemini-2.5-pro",
					"gemini/gemini-2.5-pro",
					"google/gemini-3-flash-preview",
					"gemini/gemini-3-flash-preview",
					"google/gemini-3-pro-preview",
					"gemini/gemini-3-pro-preview",
					"google/gemini-3.1-flash-lite",
					"gemini/gemini-3.1-flash-lite",
					"google/gemini-3.1-flash-lite-preview",
					"gemini/gemini-3.1-flash-lite-preview",
					"google/gemini-3.1-pro-preview",
					"gemini/gemini-3.1-pro-preview",
				],
			},
		});
		assert.deepEqual(flowdeskPlugin[1].runtimeReviewerExecution, { enabled: true });
		assert.deepEqual(flowdeskPlugin[1].workflowDispatchPlanTool, { enabled: true });
		assert.deepEqual(flowdeskPlugin[1].workflowDispatch, { enabled: true, devBetaActualLaneLaunch: true });
		assert.deepEqual(flowdeskPlugin[1].autoContinueExecution, { enabled: true, devBetaActualLaneLaunch: true });
		assert.deepEqual(flowdeskPlugin[1].workflowOrchestrate, { enabled: true, devBetaActualLaneLaunch: true });
		assert.deepEqual(flowdeskPlugin[1].quickFallbackRun, { enabled: true });
		assert.deepEqual(flowdeskPlugin[1].managedFallbackRegate, { enabled: true });
		assert.deepEqual(flowdeskPlugin[1].laneHeartbeatWriter, { enabled: true, defaultExpectedIntervalMs: 120000 });
		assert.deepEqual(flowdeskPlugin[1].controlledWriteApply, { enabled: true, devBetaControlledWriteApply: true });
		assert.deepEqual(flowdeskPlugin[1].chatMessageStallAlert, { enabled: true, includeProgressCards: true, maxProgressCards: 4 });
		assert.deepEqual(flowdeskPlugin[1].completionWakeMainSession, { enabled: true });
		assert.equal("homeDir" in flowdeskPlugin[1], false);
		assert.equal("workspaceRoot" in flowdeskPlugin[1], false);
		assert.equal("geminiProjectId" in flowdeskPlugin[1], false);
		const tuiConfig = JSON.parse(readFileSync(join(profileRoot, "tui.json"), "utf8")) as Record<string, unknown>;
		const tuiPlugins = tuiConfig.plugin as unknown[];
		assert.equal(Array.isArray(tuiPlugins), true);
		const flowdeskTuiPlugin = tuiPlugins[0] as [string, Record<string, unknown>];
		assert.equal(flowdeskTuiPlugin[0], join(profileRoot, "node_modules", "@flowdesk", "opencode-plugin", "dist", "tui.js"));
		assert.equal(flowdeskTuiPlugin[1].durableStateRootDir, durableRoot);
		assert.equal(flowdeskTuiPlugin[1].usageWorkflowId, "workflow-global-provider-usage");

		const bootstrapDir = join(durableRoot, ".flowdesk/bootstrap/install-plan-profile-release1");
    assert.deepEqual(readdirSync(bootstrapDir).sort(), ["bootstrap-report", "bootstrap-install-plan", "command-generation-summary", "doctor-handoff"].sort());
    const report = JSON.parse(readFileSync(join(bootstrapDir, "bootstrap-report/report-profile-release1.json"), "utf8")) as Record<string, unknown>;
    assert.equal(report.schema_version, "flowdesk.bootstrap_report.v1");
    assert.equal(report.doctor_handoff_ref, "handoff-profile-release1");

    const rawLedger = readFileSync(ledgerPath(durableRoot, confirmation.confirmationRef), "utf8");
    const ledger = JSON.parse(rawLedger) as Record<string, unknown>;
    assert.equal(ledger.schema_version, "flowdesk.bootstrap_confirmation_consumption.v1");
    assert.equal(ledger.confirmation_ref, confirmation.confirmationRef);
    assert.equal(ledger.status, "consumed");
    assert.equal(ledger.target_profile_ref, confirmation.targetProfileRef);
    assert.equal(ledger.profile_root_ref, confirmation.profileRootRef);
    assert.equal(ledger.install_plan_ref, confirmation.installPlanRef);
    assert.equal(ledger.rollback_plan_ref, confirmation.rollbackPlanRef);
    assert.equal(ledger.expires_at, confirmation.expiresAt);
    assert.equal(ledger.actor_class, "user");
    assert.equal(ledger.consumed_at, "2026-05-19T00:00:00.000Z");
    assert.match(String(ledger.typed_phrase_hash), /^[a-f0-9]{64}$/);
    assert.notEqual(ledger.typed_phrase_hash, confirmation.typedPhrase);
    assert.equal(rawLedger.includes(confirmation.typedPhrase), false);
  } finally {
    rmSync(profileRoot, { recursive: true, force: true });
    rmSync(durableRoot, { recursive: true, force: true });
  }
});

test("Release 1 bootstrap installer preserves existing plugin entries and fills missing FlowDesk plugin options", () => {
	const profileRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-profile-existing-plugin-"));
	const durableRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-durable-existing-plugin-"));
	try {
		const nonFlowDeskPlugin = ["file:///tmp/other-opencode-plugin/server.js", { existing: true }];
		const existingFlowDeskPlugin = [
			"file:///custom/node_modules/@flowdesk/opencode-plugin/dist/server.js",
			{
				durableStateRoot: "/custom/durable/root",
				statusLive: { enabled: false },
				providerUsageLive: { providers: ["openai"] },
				quickFallbackRun: {
					enabled: false,
					defaultFromProvider: "anthropic/claude-opus-4-7",
					defaultToProvider: "openai/gpt-5.5",
				},
			},
		];
		writeFileSync(join(profileRoot, "opencode.json"), `${JSON.stringify({
			$schema: "https://opencode.ai/config.json",
			plugin: [nonFlowDeskPlugin, existingFlowDeskPlugin],
			someExistingSetting: "preserved",
		}, null, 2)}\n`, "utf8");

		const confirmation = typedConfirmation("profile-existing-plugin", profileRoot, "existing-plugin");
		const result = installFlowDeskRelease1Bootstrap({
			profileRootDir: profileRoot,
			durableStateRootDir: durableRoot,
			targetProfileRef: "profile-existing-plugin",
			typedConfirmation: confirmation,
			now: new Date("2026-05-19T00:00:00.000Z")
		});

		assert.equal(result.ok, true);
		const opencodeConfig = JSON.parse(readFileSync(join(profileRoot, "opencode.json"), "utf8")) as Record<string, unknown>;
		assert.equal(opencodeConfig.default_agent, "flowdesk-main");
		assert.equal(opencodeConfig.someExistingSetting, "preserved");
		const plugins = opencodeConfig.plugin as unknown[];
		assert.equal(plugins.length, 2);
		assert.deepEqual(plugins[0], nonFlowDeskPlugin);

		const flowdeskPlugin = plugins[1] as [string, Record<string, unknown>];
		assert.equal(flowdeskPlugin[0], existingFlowDeskPlugin[0]);
		assert.equal(flowdeskPlugin[1].durableStateRoot, "/custom/durable/root");
		assert.deepEqual(flowdeskPlugin[1].statusLive, { enabled: false, maxWorkflows: 10 });
		assert.deepEqual(flowdeskPlugin[1].providerUsageLive, {
			providers: ["openai"],
			enabled: true,
			claudeOAuthUsage: true,
			codexLiveUsage: true,
			geminiQuota: true,
			persistSnapshots: true,
			persistWorkflowId: "workflow-global-provider-usage",
		});
		assert.deepEqual(flowdeskPlugin[1].quickFallbackRun, {
			enabled: false,
			defaultFromProvider: "anthropic/claude-opus-4-7",
			defaultToProvider: "openai/gpt-5.5",
		});
		assert.deepEqual(flowdeskPlugin[1].agentTaskRun, { enabled: true });
		assert.deepEqual(flowdeskPlugin[1].exactModelProviderAcquisitionLiveTest, {
			enabled: true,
			durableStateRoot: durableRoot,
			promptBackedCheck: {
				enabled: true,
				allowProviderCall: true,
				agent: "flowdesk-verifier-testing",
				allowedProviderQualifiedModelIds: [
					"anthropic/claude-opus-4-7",
					"claude/claude-opus-4-7",
					"anthropic/claude-opus-4-8",
					"claude/claude-opus-4-8",
					"anthropic/claude-opus-4-6",
					"claude/claude-opus-4-6",
					"anthropic/claude-opus-4-5",
					"claude/claude-opus-4-5",
					"anthropic/claude-opus-4-1",
					"claude/claude-opus-4-1",
					"anthropic/claude-opus-4-0",
					"claude/claude-opus-4-0",
					"anthropic/claude-sonnet-4-6",
					"claude/claude-sonnet-4-6",
					"anthropic/claude-sonnet-4-5",
					"claude/claude-sonnet-4-5",
					"anthropic/claude-sonnet-4-0",
					"claude/claude-sonnet-4-0",
					"anthropic/claude-haiku-4-5",
					"claude/claude-haiku-4-5",
					"openai/gpt-5.5",
					"openai/gpt-5.5-fast",
					"openai/gpt-5.4",
					"openai/gpt-5.4-fast",
					"openai/gpt-5.4-mini",
					"openai/gpt-5.4-mini-fast",
					"openai/gpt-5.3-codex",
					"openai/gpt-5.3-codex-spark",
					"openai/gpt-5.2",
					"google/gemini-2.5-flash",
					"gemini/gemini-2.5-flash",
					"google/gemini-2.5-flash-lite",
					"gemini/gemini-2.5-flash-lite",
					"google/gemini-2.5-pro",
					"gemini/gemini-2.5-pro",
					"google/gemini-3-flash-preview",
					"gemini/gemini-3-flash-preview",
					"google/gemini-3-pro-preview",
					"gemini/gemini-3-pro-preview",
					"google/gemini-3.1-flash-lite",
					"gemini/gemini-3.1-flash-lite",
					"google/gemini-3.1-flash-lite-preview",
					"gemini/gemini-3.1-flash-lite-preview",
					"google/gemini-3.1-pro-preview",
					"gemini/gemini-3.1-pro-preview",
				],
			},
		});
		assert.deepEqual(flowdeskPlugin[1].runtimeReviewerExecution, { enabled: true });
		assert.deepEqual(flowdeskPlugin[1].workflowDispatch, { enabled: true, devBetaActualLaneLaunch: true });
		assert.deepEqual(flowdeskPlugin[1].controlledWriteApply, { enabled: true, devBetaControlledWriteApply: true });
	} finally {
		rmSync(profileRoot, { recursive: true, force: true });
		rmSync(durableRoot, { recursive: true, force: true });
	}
});

test("Release 1 bootstrap installer rejects a durable consumed confirmation before writes", () => {
  const profileRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-profile-durable-replay-"));
  const durableRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-durable-replay-ledger-"));
  try {
    const confirmation = typedConfirmation("profile-durable-replay", profileRoot, "durable-replay");
    writeConsumedLedger(durableRoot, confirmation);

    const result = installFlowDeskRelease1Bootstrap({
      profileRootDir: profileRoot,
      durableStateRootDir: durableRoot,
      targetProfileRef: "profile-durable-replay",
      typedConfirmation: confirmation,
      now: new Date("2026-05-19T00:00:00.000Z")
    });

    assert.equal(result.ok, false);
    assert.equal(result.commandFilesWritten, 0);
    assert.equal(result.bootstrapArtifactsWritten, 0);
    assert.equal(existsSync(join(profileRoot, "commands")), false);
    assert.equal(existsSync(join(durableRoot, ".flowdesk/bootstrap/install-plan-profile-durable-replay")), false);
    assert.equal(result.providerCall, false);
    assert.equal(result.runtimeExecution, false);
  } finally {
    rmSync(profileRoot, { recursive: true, force: true });
    rmSync(durableRoot, { recursive: true, force: true });
  }
});

test("Release 1 bootstrap installer rejects a durable pending confirmation before writes", () => {
  const profileRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-profile-pending-replay-"));
  const durableRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-durable-pending-replay-"));
  try {
    const confirmation = typedConfirmation("profile-pending-replay", profileRoot, "pending-replay");
    writePendingLedger(durableRoot, confirmation);

    const result = installFlowDeskRelease1Bootstrap({
      profileRootDir: profileRoot,
      durableStateRootDir: durableRoot,
      targetProfileRef: "profile-pending-replay",
      typedConfirmation: confirmation,
      now: new Date("2026-05-19T00:00:00.000Z")
    });

    assert.equal(result.ok, false);
    assert.equal(result.commandFilesWritten, 0);
    assert.equal(result.bootstrapArtifactsWritten, 0);
    assert.equal(existsSync(join(profileRoot, "commands")), false);
    assert.equal(existsSync(join(durableRoot, ".flowdesk/bootstrap/install-plan-profile-pending-replay")), false);
    assert.equal(result.providerCall, false);
    assert.equal(result.runtimeExecution, false);
  } finally {
    rmSync(profileRoot, { recursive: true, force: true });
    rmSync(durableRoot, { recursive: true, force: true });
  }
});

test("Release 1 bootstrap installer rejects a symlinked confirmation ledger directory before writes", () => {
  const profileRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-profile-symlink-ledger-"));
  const durableRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-durable-symlink-ledger-"));
  const symlinkTarget = mkdtempSync(join(tmpdir(), "flowdesk-install-ledger-symlink-target-"));
  try {
    const confirmation = typedConfirmation("profile-symlink-ledger", profileRoot, "symlink-ledger");
    mkdirSync(join(durableRoot, ".flowdesk", "bootstrap"), { recursive: true });
    symlinkSync(symlinkTarget, join(durableRoot, ".flowdesk", "bootstrap", "confirmations"), "dir");

    const result = installFlowDeskRelease1Bootstrap({
      profileRootDir: profileRoot,
      durableStateRootDir: durableRoot,
      targetProfileRef: "profile-symlink-ledger",
      typedConfirmation: confirmation,
      now: new Date("2026-05-19T00:00:00.000Z")
    });

    assert.equal(result.ok, false);
    assert.equal(result.commandFilesWritten, 0);
    assert.equal(result.bootstrapArtifactsWritten, 0);
    assert.equal(existsSync(join(profileRoot, "commands")), false);
    assert.equal(existsSync(join(durableRoot, ".flowdesk/bootstrap/install-plan-profile-symlink-ledger")), false);
    assert.equal(existsSync(join(symlinkTarget, `${confirmation.confirmationRef}.json`)), false);
    assert.equal(result.providerCall, false);
    assert.equal(result.runtimeExecution, false);
  } finally {
    rmSync(profileRoot, { recursive: true, force: true });
    rmSync(durableRoot, { recursive: true, force: true });
    rmSync(symlinkTarget, { recursive: true, force: true });
  }
});

test("Release 1 bootstrap installer rejects a mismatched durable confirmation ledger before writes", () => {
  const profileRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-profile-ledger-mismatch-"));
  const durableRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-durable-ledger-mismatch-"));
  try {
    const confirmation = typedConfirmation("profile-ledger-mismatch", profileRoot, "ledger-mismatch");
    writeConsumedLedger(durableRoot, confirmation, { install_plan_ref: "install-plan-other-profile" });

    const result = installFlowDeskRelease1Bootstrap({
      profileRootDir: profileRoot,
      durableStateRootDir: durableRoot,
      targetProfileRef: "profile-ledger-mismatch",
      typedConfirmation: confirmation,
      now: new Date("2026-05-19T00:00:00.000Z")
    });

    assert.equal(result.ok, false);
    assert.equal(result.commandFilesWritten, 0);
    assert.equal(result.bootstrapArtifactsWritten, 0);
    assert.equal(existsSync(join(profileRoot, "commands")), false);
    assert.equal(existsSync(join(durableRoot, ".flowdesk/bootstrap/install-plan-profile-ledger-mismatch")), false);
    assert.equal(result.providerCall, false);
    assert.equal(result.runtimeExecution, false);
  } finally {
    rmSync(profileRoot, { recursive: true, force: true });
    rmSync(durableRoot, { recursive: true, force: true });
  }
});

test("Release 1 bootstrap installer fails before writes without exact typed confirmation", () => {
  const profileRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-profile-invalid-"));
  const durableRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-durable-invalid-"));
  try {
    const result = installFlowDeskRelease1Bootstrap({
      profileRootDir: profileRoot,
      durableStateRootDir: durableRoot,
      targetProfileRef: "profile-release1",
      typedConfirmation: { ...typedConfirmation("profile-release1", profileRoot, "invalid-phrase"), typedPhrase: "install it" },
      now: new Date("2026-05-19T00:00:00.000Z")
    });

    assert.equal(result.ok, false);
    assert.equal(result.commandFilesWritten, 0);
    assert.equal(result.bootstrapArtifactsWritten, 0);
    assert.equal(existsSync(join(profileRoot, "commands")), false);
    assert.equal(existsSync(join(durableRoot, ".flowdesk")), false);
    assert.equal(result.providerCall, false);
    assert.equal(result.runtimeExecution, false);
  } finally {
    rmSync(profileRoot, { recursive: true, force: true });
    rmSync(durableRoot, { recursive: true, force: true });
  }
});

test("Release 1 bootstrap installer rolls back command files when durable artifact write fails", () => {
  const profileRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-profile-rollback-"));
  const durableRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-durable-rollback-"));
  try {
    const confirmation = typedConfirmation("profile-release1", profileRoot, "rollback");
    mkdirSync(join(durableRoot, ".flowdesk", "bootstrap"), { recursive: true });
    writeFileSync(join(durableRoot, ".flowdesk", "bootstrap", "install-plan-profile-release1"), "blocked", "utf8");
    const result = installFlowDeskRelease1Bootstrap({
      profileRootDir: profileRoot,
      durableStateRootDir: durableRoot,
      targetProfileRef: "profile-release1",
      typedConfirmation: confirmation,
      now: new Date("2026-05-19T00:00:00.000Z")
    });

		assert.equal(result.ok, false);
		assert.equal(result.commandFilesWritten, 0);
		assert.equal(result.agentProfileFilesWritten, 0);
		assert.equal(result.profileConfigUpdated, false);
		assert.equal(result.bootstrapArtifactsWritten, 0);
		assert.equal(result.rollbackCommandRefs?.length, 9);
		assert.deepEqual(result.rollbackProfileRefs?.sort(), [...installedAgentProfiles.map((profile) => `agent/${profile}.md`), "opencode.json", "tui.json"].sort());
		for (const commandName of FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES) {
			assert.equal(existsSync(join(profileRoot, "commands", `${commandName.slice(1)}.md`)), false, commandName);
		}
		for (const profile of installedAgentProfiles) assert.equal(existsSync(join(profileRoot, "agent", `${profile}.md`)), false, profile);
		assert.equal(existsSync(join(profileRoot, "opencode.json")), false);
		assert.equal(existsSync(join(profileRoot, "tui.json")), false);
    const rawLedger = readFileSync(ledgerPath(durableRoot, confirmation.confirmationRef), "utf8");
    const ledger = JSON.parse(rawLedger) as Record<string, unknown>;
    assert.equal(ledger.status, "pending");
    assert.equal(ledger.confirmation_ref, confirmation.confirmationRef);
    assert.equal(ledger.typed_phrase_hash, typedPhraseHash(confirmation.typedPhrase));
    assert.equal(ledger.consumed_at, undefined);
    assert.equal(rawLedger.includes(confirmation.typedPhrase), false);
    assert.equal(result.providerCall, false);
    assert.equal(result.runtimeExecution, false);
  } finally {
    rmSync(profileRoot, { recursive: true, force: true });
    rmSync(durableRoot, { recursive: true, force: true });
  }
});

test("Release 1 bootstrap installer rejects confirmation replay to a different profile root", () => {
  const originalProfileRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-profile-original-"));
  const replayProfileRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-profile-replay-"));
  const durableRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-durable-replay-"));
  try {
    const confirmation = typedConfirmation("profile-release1", originalProfileRoot, "replay");
    const result = installFlowDeskRelease1Bootstrap({
      profileRootDir: replayProfileRoot,
      durableStateRootDir: durableRoot,
      targetProfileRef: "profile-release1",
      typedConfirmation: confirmation,
      now: new Date("2026-05-19T00:00:00.000Z")
    });

    assert.equal(result.ok, false);
    assert.equal(result.commandFilesWritten, 0);
    assert.equal(result.bootstrapArtifactsWritten, 0);
    assert.equal(existsSync(join(replayProfileRoot, "commands")), false);
    assert.equal(existsSync(join(durableRoot, ".flowdesk")), false);
    assert.equal(result.providerCall, false);
  } finally {
    rmSync(originalProfileRoot, { recursive: true, force: true });
    rmSync(replayProfileRoot, { recursive: true, force: true });
    rmSync(durableRoot, { recursive: true, force: true });
  }
});

test("Release 1 bootstrap installer consumes successful confirmations once", () => {
  const firstProfileRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-profile-consume-first-"));
  const secondProfileRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-profile-consume-second-"));
  const firstDurableRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-durable-consume-first-"));
  const secondDurableRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-durable-consume-second-"));
  try {
    const confirmation = typedConfirmation("profile-consume", firstProfileRoot, "consume");
    const first = installFlowDeskRelease1Bootstrap({
      profileRootDir: firstProfileRoot,
      durableStateRootDir: firstDurableRoot,
      targetProfileRef: "profile-consume",
      typedConfirmation: confirmation,
      now: new Date("2026-05-19T00:00:00.000Z")
    });
    assert.equal(first.ok, true);

    const replay = installFlowDeskRelease1Bootstrap({
      profileRootDir: secondProfileRoot,
      durableStateRootDir: secondDurableRoot,
      targetProfileRef: "profile-consume",
      typedConfirmation: {
        ...confirmation,
        profileRootRef: flowDeskBootstrapProfileRootRef(secondProfileRoot),
        typedPhrase: `install FlowDesk release1 profile-consume ${flowDeskBootstrapProfileRootRef(secondProfileRoot)} ${confirmation.confirmationRef} install-plan-profile-consume`
      },
      now: new Date("2026-05-19T00:00:00.000Z")
    });
    assert.equal(replay.ok, false);
    assert.equal(replay.commandFilesWritten, 0);
    assert.equal(existsSync(join(secondProfileRoot, "commands")), false);
  } finally {
    rmSync(firstProfileRoot, { recursive: true, force: true });
    rmSync(secondProfileRoot, { recursive: true, force: true });
    rmSync(firstDurableRoot, { recursive: true, force: true });
    rmSync(secondDurableRoot, { recursive: true, force: true });
  }
});
