import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES } from "@flowdesk/core";
import { installFlowDeskRelease1Bootstrap } from "./index.js";

test("Release 1 bootstrap installer materializes commands and redacted bootstrap artifacts", () => {
  const profileRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-profile-"));
  const durableRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-durable-"));
  try {
    const result = installFlowDeskRelease1Bootstrap({
      profileRootDir: profileRoot,
      durableStateRootDir: durableRoot,
      targetProfileRef: "profile-release1",
      typedConfirmationRef: "confirmation-release1",
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

test("Release 1 bootstrap installer fails before writes without typed confirmation", () => {
  const profileRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-profile-invalid-"));
  const durableRoot = mkdtempSync(join(tmpdir(), "flowdesk-install-durable-invalid-"));
  try {
    const result = installFlowDeskRelease1Bootstrap({
      profileRootDir: profileRoot,
      durableStateRootDir: durableRoot,
      targetProfileRef: "profile-release1",
      typedConfirmationRef: "../confirmation",
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
