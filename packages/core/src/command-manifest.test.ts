import assert from "node:assert/strict";
import test from "node:test";
import {
  FLOWDESK_PRE_SPIKE_PRODUCTION_COMMAND_REGISTRY,
  FLOWDESK_RELEASE_1_COMMAND_MANIFEST,
  FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES,
  getFlowDeskCommandManifestEntry,
  getFlowDeskPortableCommandToolName,
  getFlowDeskPreSpikeProductionCommandRegistry,
  getRelease1ProductionToolRegistry,
  getRelease1SchemaMetadata,
  RELEASE_1_OPTIONAL_DIAGNOSTIC_TOOL_NAMES,
  RELEASE_1_PRODUCTION_MINIMUM_TOOL_NAMES,
  validateFlowDeskCommandManifestComplete,
  validateFlowDeskCommandManifestEntry,
  validateFlowDeskStaticCommandTemplateSafety
} from "./index.js";

const expectedCommandPairs = [
  ["/flowdesk-doctor", "flowdesk_doctor"],
  ["/flowdesk-plan", "flowdesk_plan"],
  ["/flowdesk-run", "flowdesk_run"],
  ["/flowdesk-status", "flowdesk_status"],
  ["/flowdesk-resume", "flowdesk_resume"],
  ["/flowdesk-retry", "flowdesk_retry"],
  ["/flowdesk-abort", "flowdesk_abort"],
  ["/flowdesk-usage", "flowdesk_usage"],
  ["/flowdesk-export-debug", "flowdesk_export_debug"]
] as const;

test("Checkpoint 5 command manifest contains exactly the Release 1 minimum portable commands", () => {
  assert.deepEqual(FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES, expectedCommandPairs.map(([commandName]) => commandName));
  assert.deepEqual(FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.commandName), expectedCommandPairs.map(([commandName]) => commandName));
  assert.deepEqual(FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.toolName), expectedCommandPairs.map(([, toolName]) => toolName));
  assert.deepEqual([...RELEASE_1_PRODUCTION_MINIMUM_TOOL_NAMES], expectedCommandPairs.map(([, toolName]) => toolName));
  assert.equal(validateFlowDeskCommandManifestComplete().ok, true);
});

test("Checkpoint 5 manifest entries are registry-backed and fixture prefixes match", () => {
  for (const [commandName, toolName] of expectedCommandPairs) {
    assert.equal(getFlowDeskPortableCommandToolName(commandName), toolName);
    const entry = getFlowDeskCommandManifestEntry(commandName);
    assert.ok(entry);
    assert.equal(entry.toolName, toolName);

    const request = getRelease1SchemaMetadata(entry.requestSchemaId);
    const response = getRelease1SchemaMetadata(entry.responseSchemaId);
    assert.ok(request);
    assert.ok(response);
    assert.equal(request.toolName, toolName);
    assert.equal(response.toolName, toolName);
    assert.equal(request.kind, "tool_request");
    assert.equal(response.kind, "tool_response");
    assert.equal(request.fixturePrefix, entry.fixturePrefix);
    assert.equal(response.fixturePrefix, entry.fixturePrefix);
    assert.equal(request.release1MinimumTool, true);
    assert.equal(response.release1MinimumTool, true);
    assert.equal(validateFlowDeskCommandManifestEntry(entry).ok, true);
  }
});

test("Checkpoint 5 manifest is inert, non-authorizing, and pre-spike production-registration blocked", () => {
  assert.equal(getRelease1ProductionToolRegistry().length, 0);
  assert.equal(FLOWDESK_PRE_SPIKE_PRODUCTION_COMMAND_REGISTRY.length, 0);
  assert.equal(getFlowDeskPreSpikeProductionCommandRegistry().length, 0);
  for (const entry of FLOWDESK_RELEASE_1_COMMAND_MANIFEST) {
    assert.equal(entry.productionRegistrationEligible, false);
    assert.equal(entry.dispatchApprovalEligible, false);
    assert.equal(entry.fallbackAuthority, false);
    assert.equal(entry.hardCancelOrNoReplyAuthority, false);
    assert.equal(entry.actualLaneLaunch, false);
    assert.equal(entry.providerCall, false);
    assert.equal(entry.schemaCompatibilityStatus, "blocked_missing_schema_conversion_evidence");
    assert.equal(entry.schemaCompatibilityReadiness, "blocked_until_fds1_conversion_spike_passes");
  }
});

test("Checkpoint 5 static command templates are command-backed, schema-referenced, and safe", () => {
  for (const entry of FLOWDESK_RELEASE_1_COMMAND_MANIFEST) {
    assert.equal(validateFlowDeskStaticCommandTemplateSafety(entry.staticTemplate.content).ok, true);
    assert.match(entry.staticTemplate.templateId, /^flowdesk-static-command-template:/);
    assert.match(entry.staticTemplate.contentHashLabel, /^flowdesk-static-template-hash:/);
    assert.match(entry.staticTemplate.content, new RegExp(entry.commandName.replace("/", "\\/")));
    assert.match(entry.staticTemplate.content, new RegExp(entry.toolName));
    assert.match(entry.staticTemplate.content, new RegExp(entry.requestSchemaId.replaceAll(".", "\\.")));
    assert.match(entry.staticTemplate.content, new RegExp(entry.responseSchemaId.replaceAll(".", "\\.")));
    assert.match(entry.staticTemplate.content, new RegExp(entry.fixturePrefix));
  }
});

test("Checkpoint 5 static template safety rejects dynamic, shell, raw, provider, and authority markers", () => {
  const unsafeSamples = [
    "Run $(date)",
    "Use $" + "{provider}",
    "Use `date`",
    "```bash\nnpm test\n```",
    "shell: rm -rf target-ref",
    "Load import('provider') dynamically",
    "raw_prompt: persist this private prompt",
    "raw_body should be stored",
    "raw_path: /Users/example/private.txt",
    "provider call can execute now",
    "opencode run model task",
    "child_process access",
    "spawn provider task",
    "exec provider task",
    "execFile provider task",
    "noReply is supported",
    "hard cancel available",
    "cancel: true",
    "real OpenCode dispatch is supported",
    "production registration enabled",
    "dispatch approval ready",
    "fallback authority enabled",
    "launch lane for the model"
  ];
  for (const sample of unsafeSamples) assert.equal(validateFlowDeskStaticCommandTemplateSafety(sample).ok, false, sample);
});

test("Checkpoint 5 manifest excludes optional diagnostics from the minimum command surface", () => {
  const commandNames = new Set<string>(FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.commandName));
  const toolNames = new Set<string>(FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.toolName));
  assert.equal(commandNames.has("/flowdesk-explain-route"), false);
  assert.equal(commandNames.has("/flowdesk-audit"), false);
  assert.equal(commandNames.has("/flowdesk-chat-intake"), false);
  for (const optionalToolName of RELEASE_1_OPTIONAL_DIAGNOSTIC_TOOL_NAMES) assert.equal(toolNames.has(optionalToolName), false);
});

test("Checkpoint 5 command entry validator fails closed on forged authority or schema drift", () => {
  const entry = FLOWDESK_RELEASE_1_COMMAND_MANIFEST[0];
  assert.ok(entry);
  assert.equal(validateFlowDeskCommandManifestEntry({ ...entry, productionRegistrationEligible: true }).ok, false);
  assert.equal(validateFlowDeskCommandManifestEntry({ ...entry, dispatchApprovalEligible: true }).ok, false);
  assert.equal(validateFlowDeskCommandManifestEntry({ ...entry, fallbackAuthority: true }).ok, false);
  assert.equal(validateFlowDeskCommandManifestEntry({ ...entry, hardCancelOrNoReplyAuthority: true }).ok, false);
  assert.equal(validateFlowDeskCommandManifestEntry({ ...entry, actualLaneLaunch: true }).ok, false);
  assert.equal(validateFlowDeskCommandManifestEntry({ ...entry, providerCall: true }).ok, false);
  assert.equal(validateFlowDeskCommandManifestEntry({ ...entry, statePreconditions: ["forged precondition"] }).ok, false);
  assert.equal(validateFlowDeskCommandManifestEntry({ ...entry, stateOutputs: ["forged output"] }).ok, false);
  assert.equal(validateFlowDeskCommandManifestEntry({ ...entry, requestSchemaId: "flowdesk.run.request.v1" }).ok, false);
  assert.equal(validateFlowDeskCommandManifestEntry({ ...entry, staticTemplate: { ...entry.staticTemplate, content: "provider call approved" } }).ok, false);
});
