import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES } from "@flowdesk/core";
import { flowDeskBootstrapProfileRootRef, installFlowDeskRelease1Bootstrap } from "./index.js";

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
		assert.equal(result.agentProfileFilesWritten, 1);
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
		assert.match(mainAgent, /model: openai\/gpt-5\.3-codex-spark/);
		assert.match(mainAgent, /FlowDesk workflow first/);
		assert.match(mainAgent, /broad repository reading/);
		assert.match(mainAgent, /sub-agent returns an empty result/);
		assert.match(mainAgent, /Work breakdown and lane sizing/);
		assert.match(mainAgent, /exactly one primary objective and one clear deliverable/);
		assert.match(mainAgent, /Long or complex work must be split into small lanes/);
		assert.match(mainAgent, /do not dispatch it yet; split it first/);
		assert.match(mainAgent, /combined root-cause analysis \+ code search \+ implementation \+ verification mega-lane/);
		assert.match(mainAgent, /repository-wide code search with patch writing/);
		assert.match(mainAgent, /progress events without a final answer/);
		assert.match(mainAgent, /Retrying the same prompt on a different model is not enough/);
		assert.match(mainAgent, /inconsistent_finalizing_without_terminal/);
		assert.match(mainAgent, /After FlowDesk is installed or updated, immediately verify the live diagnostics path/);
		assert.match(mainAgent, /\/flowdesk-usage/);
		assert.match(mainAgent, /If reviewer fanout diagnostics or SDK-health diagnostics are still unavailable/);
		assert.match(mainAgent, /prefer a concrete safe next action over silent success/);
		assert.doesNotMatch(mainAgent, /Completion continuation policy/);
		assert.doesNotMatch(mainAgent, /continue with that next todo automatically/);
		assert.doesNotMatch(mainAgent, /response-waiting mode/);
		const opencodeConfig = JSON.parse(readFileSync(join(profileRoot, "opencode.json"), "utf8")) as Record<string, unknown>;
		assert.equal(opencodeConfig.default_agent, "flowdesk-main");
		assert.equal(opencodeConfig.$schema, "https://opencode.ai/config.json");

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
		assert.deepEqual(result.rollbackProfileRefs?.sort(), ["agent/flowdesk-main.md", "opencode.json"].sort());
		for (const commandName of FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES) {
			assert.equal(existsSync(join(profileRoot, "commands", `${commandName.slice(1)}.md`)), false, commandName);
		}
		assert.equal(existsSync(join(profileRoot, "agent", "flowdesk-main.md")), false);
		assert.equal(existsSync(join(profileRoot, "opencode.json")), false);
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
