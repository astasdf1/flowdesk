import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  FLOWDESK_RELEASE_1_COMMAND_MANIFEST,
  FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES,
  getFlowDeskPreSpikeProductionCommandRegistry
} from "@flowdesk/core";
import {
  FLOWDESK_DESIRED_ALIAS_GATE_ARTIFACTS,
  FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS,
  FLOWDESK_PRE_CONFORMANCE_WRITTEN_ALIAS_REGISTRY,
  FLOWDESK_PRE_SPIKE_WRITTEN_COMMAND_FILE_REGISTRY,
  getFlowDeskDesiredAliasGateArtifact,
  getFlowDeskDesiredAliasGateArtifacts,
  getFlowDeskPortableCommandFileArtifact,
  getFlowDeskPortableCommandFileArtifacts,
  getFlowDeskPreConformanceWrittenAliasRegistry,
  getFlowDeskPreSpikeWrittenCommandFileRegistry,
  materializeFlowDeskPortableCommandFiles,
  validateFlowDeskDesiredAliasGateArtifact,
  validateFlowDeskDesiredAliasGateArtifactsComplete,
  validateFlowDeskPortableCommandFileArtifact,
  validateFlowDeskPortableCommandFileArtifactsComplete
} from "./index.js";

test("portable command file artifacts cover exactly the Release 1 minimum portable commands", () => {
  assert.equal(FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS.length, 9);
  assert.deepEqual(
    FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS.map((artifact) => artifact.commandName),
    [...FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES]
  );
  assert.deepEqual(getFlowDeskPortableCommandFileArtifacts(), FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS);
  assert.equal(validateFlowDeskPortableCommandFileArtifactsComplete().ok, true);
});

test("portable command file artifacts are static, portable-only, and schema-backed", () => {
  for (const artifact of FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS) {
    const manifestEntry = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.find((entry) => entry.commandName === artifact.commandName);
    assert.ok(manifestEntry, artifact.commandName);
    assert.equal(artifact.commandFileName, `${artifact.commandName.slice(1)}.md`);
    assert.equal(artifact.commandFileName.includes(":"), false);
    assert.equal(artifact.commandFileName.includes("/"), false);
    assert.equal(artifact.commandProfileRelativePath, `commands/${artifact.commandFileName}`);
    assert.equal(artifact.toolName, manifestEntry.toolName);
    assert.equal(artifact.requestSchemaId, manifestEntry.requestSchemaId);
    assert.equal(artifact.responseSchemaId, manifestEntry.responseSchemaId);
    assert.equal(artifact.fixturePrefix, manifestEntry.fixturePrefix);
    assert.equal(artifact.aliasMode, "portable_only_pre_conformance");
    assert.equal(artifact.generationMode, "inert_static_command_file_artifact");
    assert.equal(artifact.writeMode, "not_written_pre_spike_artifact");
    assert.match(artifact.commandContent, new RegExp(artifact.commandName.replace("/", "\\/")));
    assert.match(artifact.commandContent, /Preferred agent-facing wrapper:/);
    assert.doesNotMatch(artifact.commandContent, /Matching FlowDesk tool stub:/);
    assert.match(artifact.commandContent, new RegExp(artifact.toolName));
    assert.match(artifact.commandContent, new RegExp(artifact.requestSchemaId.replaceAll(".", "\\.")));
    assert.match(artifact.commandContent, new RegExp(artifact.responseSchemaId.replaceAll(".", "\\.")));
    assert.equal(validateFlowDeskPortableCommandFileArtifact(artifact).ok, true);
    assert.equal(getFlowDeskPortableCommandFileArtifact(artifact.commandName), artifact);
  }
});

test("portable command file artifacts remain production-disabled and non-authorizing", () => {
  assert.equal(FLOWDESK_PRE_SPIKE_WRITTEN_COMMAND_FILE_REGISTRY.length, 0);
  assert.equal(getFlowDeskPreSpikeWrittenCommandFileRegistry().length, 0);
  assert.equal(getFlowDeskPreSpikeProductionCommandRegistry().length, 0);
  for (const artifact of FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS) {
    assert.equal(artifact.productionRegistrationEligible, false);
    assert.equal(artifact.schemaConversionReady, false);
    assert.equal(artifact.commandAliasEligible, false);
    assert.equal(artifact.dispatchApprovalEligible, false);
    assert.equal(artifact.fallbackAuthority, false);
    assert.equal(artifact.hardCancelOrNoReplyAuthority, false);
    assert.equal(artifact.actualLaneLaunch, false);
    assert.equal(artifact.providerCall, false);
    assert.equal(artifact.runtimeExecution, false);
  }
});

test("portable command files materialize into a profile commands directory without aliases or authority", () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-commands-"));
  try {
    const result = materializeFlowDeskPortableCommandFiles(root);
    assert.equal(result.ok, true);
    assert.equal(result.commandFilesWritten, 9);
    assert.equal(result.aliasFilesWritten, 0);
    assert.deepEqual(result.writtenCommandRefs, FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS.map((artifact) => artifact.commandProfileRelativePath));
    assert.equal(result.productionRegistrationEligible, false);
    assert.equal(result.commandAliasEligible, false);
    assert.equal(result.providerCall, false);
    assert.equal(result.runtimeExecution, false);

    for (const artifact of FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS) {
      const target = join(root, artifact.commandProfileRelativePath);
      assert.equal(existsSync(target), true, artifact.commandName);
      const content = readFileSync(target, "utf8");
      assert.match(content, new RegExp(artifact.commandName.replace("/", "\\/")));
      assert.match(content, new RegExp(artifact.toolName));
      assert.equal(target.includes("/flowdesk:"), false);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("portable command materialization fails closed for incomplete or unsafe artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-commands-invalid-"));
  try {
    const incomplete = materializeFlowDeskPortableCommandFiles(root, FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS.slice(1));
    assert.equal(incomplete.ok, false);
    assert.equal(incomplete.commandFilesWritten, 0);
    assert.equal(incomplete.runtimeExecution, false);

    const unsafe = materializeFlowDeskPortableCommandFiles(root, [{ ...FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS[0], commandProfileRelativePath: "../flowdesk-doctor.md" } as never]);
    assert.equal(unsafe.ok, false);
    assert.equal(unsafe.commandFilesWritten, 0);
    assert.equal(unsafe.actualLaneLaunch, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("portable command file artifact validator rejects aliases, writes, unsafe content, and forged authority", () => {
  const artifact = FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS[0];
  assert.ok(artifact);
  assert.equal(validateFlowDeskPortableCommandFileArtifact({ ...artifact, commandFileName: "flowdesk:doctor.md" }).ok, false);
  assert.equal(validateFlowDeskPortableCommandFileArtifact({ ...artifact, commandProfileRelativePath: ".opencode/command/flowdesk-doctor.md" }).ok, false);
  assert.equal(validateFlowDeskPortableCommandFileArtifact({ ...artifact, aliasMode: "colon_alias_supported" }).ok, false);
  assert.equal(validateFlowDeskPortableCommandFileArtifact({ ...artifact, writeMode: "write_profile_command_file" }).ok, false);
  assert.equal(validateFlowDeskPortableCommandFileArtifact({ ...artifact, commandContent: "Run $(date) before tool validation" }).ok, false);
  assert.equal(validateFlowDeskPortableCommandFileArtifact({ ...artifact, commandContent: "real OpenCode dispatch is supported" }).ok, false);
  assert.equal(validateFlowDeskPortableCommandFileArtifact({ ...artifact, productionRegistrationEligible: true }).ok, false);
  assert.equal(validateFlowDeskPortableCommandFileArtifact({ ...artifact, schemaConversionReady: true }).ok, false);
  assert.equal(validateFlowDeskPortableCommandFileArtifact({ ...artifact, commandAliasEligible: true }).ok, false);
  assert.equal(validateFlowDeskPortableCommandFileArtifact({ ...artifact, providerCall: true }).ok, false);
  assert.equal(validateFlowDeskPortableCommandFileArtifactsComplete(FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS.slice(1)).ok, false);
});

test("desired alias gate artifacts enumerate colon aliases but keep them blocked pre-conformance", () => {
  const expectedAliases = [
    "/flowdesk:doctor",
    "/flowdesk:plan",
    "/flowdesk:run",
    "/flowdesk:status",
    "/flowdesk:resume",
    "/flowdesk:retry",
    "/flowdesk:abort",
    "/flowdesk:usage",
    "/flowdesk:export-debug"
  ];
  assert.deepEqual(
    FLOWDESK_DESIRED_ALIAS_GATE_ARTIFACTS.map((artifact) => artifact.desiredAlias),
    expectedAliases
  );
  assert.deepEqual(getFlowDeskDesiredAliasGateArtifacts(), FLOWDESK_DESIRED_ALIAS_GATE_ARTIFACTS);
  assert.equal(validateFlowDeskDesiredAliasGateArtifactsComplete().ok, true);
  assert.equal(FLOWDESK_PRE_CONFORMANCE_WRITTEN_ALIAS_REGISTRY.length, 0);
  assert.equal(getFlowDeskPreConformanceWrittenAliasRegistry().length, 0);
});

test("desired alias gate artifacts map to portable fallback commands without authority", () => {
  for (const artifact of FLOWDESK_DESIRED_ALIAS_GATE_ARTIFACTS) {
    const commandArtifact = getFlowDeskPortableCommandFileArtifact(artifact.portableFallbackCommand);
    assert.ok(commandArtifact, artifact.desiredAlias);
    assert.equal(artifact.portableCommandFileName, commandArtifact.commandFileName);
    assert.equal(artifact.toolName, commandArtifact.toolName);
    assert.equal(artifact.conformanceMode, "portable_only_pre_conformance");
    assert.equal(artifact.aliasGenerationMode, "blocked_until_alias_conformance_passes");
    assert.equal(artifact.aliasWriteMode, "not_written_pre_conformance_artifact");
    assert.equal(artifact.requiredConformanceRef, "missing_pinned_alias_parser_conformance");
    assert.equal(artifact.productionRegistrationEligible, false);
    assert.equal(artifact.schemaConversionReady, false);
    assert.equal(artifact.commandAliasEligible, false);
    assert.equal(artifact.dispatchApprovalEligible, false);
    assert.equal(artifact.fallbackAuthority, false);
    assert.equal(artifact.hardCancelOrNoReplyAuthority, false);
    assert.equal(artifact.actualLaneLaunch, false);
    assert.equal(artifact.providerCall, false);
    assert.equal(artifact.runtimeExecution, false);
    assert.equal(getFlowDeskDesiredAliasGateArtifact(artifact.desiredAlias), artifact);
    assert.equal(validateFlowDeskDesiredAliasGateArtifact(artifact).ok, true);
  }
});

test("desired alias gate validator rejects forged conformance, writes, mappings, and authority", () => {
  const artifact = FLOWDESK_DESIRED_ALIAS_GATE_ARTIFACTS[0];
  assert.ok(artifact);
  assert.equal(validateFlowDeskDesiredAliasGateArtifact({ ...artifact, desiredAlias: "/flowdesk-doctor" }).ok, false);
  assert.equal(validateFlowDeskDesiredAliasGateArtifact({ ...artifact, desiredAlias: "/flowdesk:run" }).ok, false);
  assert.equal(validateFlowDeskDesiredAliasGateArtifact({ ...artifact, portableFallbackCommand: "/flowdesk-run" }).ok, false);
  assert.equal(validateFlowDeskDesiredAliasGateArtifact({ ...artifact, conformanceMode: "colon_alias_supported" }).ok, false);
  assert.equal(validateFlowDeskDesiredAliasGateArtifact({ ...artifact, aliasGenerationMode: "enabled" }).ok, false);
  assert.equal(validateFlowDeskDesiredAliasGateArtifact({ ...artifact, aliasWriteMode: "write_alias_command_file" }).ok, false);
  assert.equal(validateFlowDeskDesiredAliasGateArtifact({ ...artifact, requiredConformanceRef: "conformance-123" }).ok, false);
  assert.equal(validateFlowDeskDesiredAliasGateArtifact({ ...artifact, commandAliasEligible: true }).ok, false);
  assert.equal(validateFlowDeskDesiredAliasGateArtifact({ ...artifact, productionRegistrationEligible: true }).ok, false);
  assert.equal(validateFlowDeskDesiredAliasGateArtifact({ ...artifact, schemaConversionReady: true }).ok, false);
  assert.equal(validateFlowDeskDesiredAliasGateArtifactsComplete(FLOWDESK_DESIRED_ALIAS_GATE_ARTIFACTS.slice(1)).ok, false);
});
