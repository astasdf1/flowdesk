import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

test("Release 1 bootstrap installer materializes commands and redacted bootstrap artifacts", () => {
  const profileRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-profile-"));
  const durableRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-durable-"));
  try {
    const result = installFlowDeskRelease1Bootstrap({
      profileRootDir: profileRoot,
      durableStateRootDir: durableRoot,
      targetProfileRef: "profile-release1",
      typedConfirmation: typedConfirmation("profile-release1", profileRoot, "happy"),
      now: new Date("2026-05-19T00:00:00.000Z")
    });

    assert.equal(result.ok, true);
    assert.equal(result.commandFilesWritten, 9);
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

    const bootstrapDir = join(durableRoot, ".flowdesk/bootstrap/install-plan-profile-release1");
    assert.deepEqual(readdirSync(bootstrapDir).sort(), ["bootstrap-report", "bootstrap-install-plan", "command-generation-summary", "doctor-handoff"].sort());
    const report = JSON.parse(readFileSync(join(bootstrapDir, "bootstrap-report/report-profile-release1.json"), "utf8")) as Record<string, unknown>;
    assert.equal(report.schema_version, "flowdesk.bootstrap_report.v1");
    assert.equal(report.doctor_handoff_ref, "handoff-profile-release1");
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
  const root = mkdtempSync(join(tmpdir(), "flowdesk-install-durable-rollback-"));
  const blockedDurableRoot = join(root, "not-a-directory");
  try {
    writeFileSync(blockedDurableRoot, "blocked", "utf8");
    const result = installFlowDeskRelease1Bootstrap({
      profileRootDir: profileRoot,
      durableStateRootDir: blockedDurableRoot,
      targetProfileRef: "profile-release1",
      typedConfirmation: typedConfirmation("profile-release1", profileRoot, "rollback"),
      now: new Date("2026-05-19T00:00:00.000Z")
    });

    assert.equal(result.ok, false);
    assert.equal(result.commandFilesWritten, 0);
    assert.equal(result.bootstrapArtifactsWritten, 0);
    assert.equal(result.rollbackCommandRefs?.length, 9);
    for (const commandName of FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES) {
      assert.equal(existsSync(join(profileRoot, "commands", `${commandName.slice(1)}.md`)), false, commandName);
    }
    assert.equal(result.providerCall, false);
    assert.equal(result.runtimeExecution, false);
  } finally {
    rmSync(profileRoot, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
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
