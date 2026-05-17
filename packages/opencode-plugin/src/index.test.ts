import assert from "node:assert/strict";
import test from "node:test";
import {
  describeFlowDeskPluginScaffold,
  flowdeskOpencodePluginPackageName,
  flowdeskPluginId,
  flowdeskPluginScaffold,
  hasProductionOpenCodeRegistration
} from "./index.js";

test("plugin scaffold exposes identity without production registration", () => {
  assert.equal(flowdeskOpencodePluginPackageName, "@flowdesk/opencode-plugin");
  assert.equal(flowdeskPluginId, "flowdesk");
  assert.equal(flowdeskPluginScaffold.productionToolRegistration, "not-implemented");
  assert.equal(flowdeskPluginScaffold.runtimeBoundary.realOpenCodeDispatch, "disabled");
  assert.equal(hasProductionOpenCodeRegistration(), false);
  assert.match(describeFlowDeskPluginScaffold(), /not-implemented/);
});
