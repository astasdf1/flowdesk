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
  productionToolRegistration: "release1-non-dispatch-command-backed",
  runtimeBoundary: flowdeskNoRealDispatchBoundary,
  supportedPhase0Modes: ["dry-run", "fake-runtime"]
} as const;

export function describeFlowDeskPluginScaffold(): string {
  return `${flowdeskPluginScaffold.packageName}: ${flowdeskPluginScaffold.productionToolRegistration}`;
}

export function hasProductionOpenCodeRegistration(): true {
  return true;
}
