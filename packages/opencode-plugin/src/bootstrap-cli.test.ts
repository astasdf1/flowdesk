import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES } from "@flowdesk/core";
import { expectedFlowDeskRelease1BootstrapApprovalPhrase, runFlowDeskRelease1BootstrapCli } from "./index.js";

function capture() {
  let stdout = "";
  let stderr = "";
  return {
    streams: {
      stdout: (message: string) => {
        stdout += message;
      },
      stderr: (message: string) => {
        stderr += message;
      }
    },
    output: () => ({ stdout, stderr })
  };
}

test("Release 1 bootstrap CLI previews exact approval without writing files", () => {
  const profileRoot = mkdtempSync(join(tmpdir(), "flowdesk-cli-profile-preview-"));
  const durableRoot = mkdtempSync(join(tmpdir(), "flowdesk-cli-durable-preview-"));
  try {
    const io = capture();
    const result = runFlowDeskRelease1BootstrapCli({
      argv: [
        "--profile-root", profileRoot,
        "--durable-root", durableRoot,
        "--target-profile", "profile-cli-preview",
        "--confirmation", "confirmation-cli-preview",
        "--expires-at", "2026-05-19T00:10:00.000Z"
      ],
      now: new Date("2026-05-19T00:00:00.000Z"),
      streams: io.streams
    });

    const { stdout, stderr } = io.output();
    assert.equal(result.exitCode, 2);
    assert.equal(stderr, "");
    assert.match(stdout, /No files were written/);
    assert.match(stdout, /install FlowDesk release1 profile-cli-preview/);
    assert.equal(existsSync(join(profileRoot, "commands")), false);
    assert.equal(existsSync(join(durableRoot, ".flowdesk")), false);
  } finally {
    rmSync(profileRoot, { recursive: true, force: true });
    rmSync(durableRoot, { recursive: true, force: true });
  }
});

test("Release 1 bootstrap CLI installs only after exact approval phrase", () => {
  const profileRoot = mkdtempSync(join(tmpdir(), "flowdesk-cli-profile-install-"));
  const durableRoot = mkdtempSync(join(tmpdir(), "flowdesk-cli-durable-install-"));
  try {
    const targetProfileRef = "profile-cli-install";
    const confirmationRef = "confirmation-cli-install";
    const approve = expectedFlowDeskRelease1BootstrapApprovalPhrase(profileRoot, targetProfileRef, confirmationRef);
    const io = capture();
    const result = runFlowDeskRelease1BootstrapCli({
      argv: [
        "--profile-root", profileRoot,
        "--durable-root", durableRoot,
        "--target-profile", targetProfileRef,
        "--confirmation", confirmationRef,
        "--expires-at", "2026-05-19T00:10:00.000Z",
        "--approve", approve
      ],
      now: new Date("2026-05-19T00:00:00.000Z"),
      streams: io.streams
    });

    const { stdout, stderr } = io.output();
    assert.equal(result.exitCode, 0);
    assert.equal(stderr, "");
    assert.match(stdout, /FlowDesk Release 1 bootstrap install complete/);
    assert.match(stdout, /Production registration: release1 non-dispatch command-backed only/);
    assert.match(stdout, /Provider\/runtime dispatch: disabled/);
    for (const commandName of FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES) {
      assert.equal(existsSync(join(profileRoot, "commands", `${commandName.slice(1)}.md`)), true, commandName);
    }
    const ledgerText = readFileSync(join(durableRoot, ".flowdesk", "bootstrap", "confirmations", `${confirmationRef}.json`), "utf8");
    const ledger = JSON.parse(ledgerText) as Record<string, unknown>;
    assert.equal(ledger.status, "consumed");
    assert.equal(ledger.confirmation_ref, confirmationRef);
    assert.equal(ledgerText.includes(approve), false);
    assert.equal(existsSync(join(durableRoot, ".flowdesk", "bootstrap", `install-plan-${targetProfileRef}`)), true);
  } finally {
    rmSync(profileRoot, { recursive: true, force: true });
    rmSync(durableRoot, { recursive: true, force: true });
  }
});

test("Release 1 bootstrap CLI exposes package bin without dispatch authority", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as Record<string, unknown>;
  assert.deepEqual(packageJson.bin, { "flowdesk-install-release1": "dist/bootstrap-cli.js" });
});
