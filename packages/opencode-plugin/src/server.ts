import { getRelease1SchemaArtifact } from "@flowdesk/core";
import type { Plugin, PluginModule, PluginOptions } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import type { z } from "zod";
import {
  flowdeskPluginId,
  flowdeskPluginScaffold,
  hasProductionOpenCodeRegistration
} from "./index.js";
import {
  FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS,
  hasPassingFds1SchemaConversionSpike,
  runFlowDeskPreSpikePluginToolStub
} from "./tool-stubs.js";

export const flowdeskPreSpikeDoctorToolName = "flowdesk_pre_spike_doctor" as const;
export const flowdeskFds1SchemaConversionProbeOption = "fds1SchemaConversionProbe" as const;

type FlowDeskOpenCodeTool = ReturnType<typeof tool>;
type FlowDeskOpenCodeToolArgs = Parameters<typeof tool>[0]["args"];
type FlowDeskOpenCodeToolArg = z.ZodType;

function enumValues(values: readonly string[]): [string, ...string[]] {
  if (values.length === 0) throw new Error("FDS-1 enum field has no values");
  return [values[0] as string, ...values.slice(1)];
}

function zodForSchemaProperty(schemaId: string, fieldName: string, required: boolean): FlowDeskOpenCodeToolArg {
  const artifact = getRelease1SchemaArtifact(schemaId);
  if (artifact === undefined) throw new Error(`missing FDS-1 schema artifact: ${schemaId}`);
  const property = artifact.properties[fieldName];
  if (property === undefined) throw new Error(`missing FDS-1 property ${fieldName} for ${schemaId}`);

  let schema: FlowDeskOpenCodeToolArg;
  if (property.enum !== undefined) schema = tool.schema.enum(enumValues(property.enum));
  else if (property.type === "number") schema = tool.schema.number();
  else if (property.type === "boolean") schema = tool.schema.boolean();
  else if (property.type === "array") schema = tool.schema.array(tool.schema.string());
  else if (property.type === "object") schema = tool.schema.record(tool.schema.string(), tool.schema.unknown());
  else schema = tool.schema.string();

  if (property.maxLength !== undefined && property.type === "string") schema = (schema as z.ZodString).max(property.maxLength);
  if (property.maxItems !== undefined && property.type === "array") schema = (schema as z.ZodArray<z.ZodString>).max(property.maxItems);
  schema = schema.describe(property.description);
  return required ? schema : schema.optional();
}

export function createFlowDeskFds1SchemaConversionProbeTools(): Record<string, FlowDeskOpenCodeTool> {
  return Object.fromEntries(
    FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS.map((stub) => {
      const artifact = getRelease1SchemaArtifact(stub.requestSchemaId);
      if (artifact === undefined) throw new Error(`missing FDS-1 schema artifact: ${stub.requestSchemaId}`);
      const required = new Set(artifact.required);
      const args = Object.fromEntries(
        Object.keys(artifact.properties).map((fieldName) => [fieldName, zodForSchemaProperty(stub.requestSchemaId, fieldName, required.has(fieldName))])
      ) as FlowDeskOpenCodeToolArgs;
      return [
        stub.toolName,
        tool({
          description: `FlowDesk FDS-1 schema conversion probe for ${stub.toolName}; no dispatch, provider call, or runtime execution.`,
          args,
          async execute(request) {
            return JSON.stringify(runFlowDeskPreSpikePluginToolStub(stub.toolName, request));
          }
        })
      ];
    })
  );
}

function isFds1SchemaConversionProbeEnabled(options?: PluginOptions): boolean {
  return options?.[flowdeskFds1SchemaConversionProbeOption] === true;
}

const flowdeskServerPlugin: Plugin = async (_input, options) => {
  const tools: Record<string, FlowDeskOpenCodeTool> = {
    [flowdeskPreSpikeDoctorToolName]: tool({
      description: "Report FlowDesk plugin load status without enabling production tools or dispatch.",
      args: {},
      async execute() {
        return JSON.stringify({
          pluginId: flowdeskPluginId,
          loaded: true,
          productionOpenCodeRegistration: hasProductionOpenCodeRegistration(),
          productionToolRegistration: flowdeskPluginScaffold.productionToolRegistration,
          fds1SchemaConversionSpikePassed: hasPassingFds1SchemaConversionSpike(),
          realOpenCodeDispatch: flowdeskPluginScaffold.runtimeBoundary.realOpenCodeDispatch,
          providerCall: false,
          runtimeExecution: false,
          actualLaneLaunch: false,
          fallbackAuthority: false,
          hardCancelOrNoReplyAuthority: false
        });
      }
    })
  };
  if (isFds1SchemaConversionProbeEnabled(options)) Object.assign(tools, createFlowDeskFds1SchemaConversionProbeTools());
  return { tool: tools };
};

export const flowdeskOpenCodeServerPlugin = {
  id: flowdeskPluginId,
  server: flowdeskServerPlugin
} satisfies PluginModule;

export default flowdeskOpenCodeServerPlugin;
