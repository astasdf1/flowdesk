import {
  flowdeskNoRealDispatchBoundary,
  flowdeskRelease1Scope
} from "@flowdesk/core";

export const flowdeskOpencodePluginPackageName = "@flowdesk/opencode-plugin" as const;
export const flowdeskPluginId = "flowdesk" as const;

export const flowdeskPluginScaffold = {
  packageName: flowdeskOpencodePluginPackageName,
  pluginId: flowdeskPluginId,
  releaseScope: flowdeskRelease1Scope,
  productionToolRegistration: "not-implemented",
  runtimeBoundary: flowdeskNoRealDispatchBoundary,
  supportedPhase0Modes: ["dry-run", "fake-runtime"]
} as const;

export function describeFlowDeskPluginScaffold(): string {
  return `${flowdeskPluginScaffold.packageName}: ${flowdeskPluginScaffold.productionToolRegistration}`;
}

export function hasProductionOpenCodeRegistration(): false {
  return false;
}

export * from "./command-handlers.js";
export * from "./commands.js";
export * from "./tool-stubs.js";
