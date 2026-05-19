import assert from "node:assert/strict";
import test from "node:test";
import {
  describeFlowDeskPluginScaffold,
  flowdeskOpencodePluginPackageName,
  flowdeskPluginId,
  flowdeskPluginScaffold,
  hasProductionOpenCodeRegistration
} from "./index.js";

test("plugin scaffold exposes Release 1 non-dispatch production registration", () => {
  assert.equal(flowdeskOpencodePluginPackageName, "@flowdesk/opencode-plugin");
  assert.equal(flowdeskPluginId, "flowdesk");
  assert.equal(flowdeskPluginScaffold.productionToolRegistration, "release1-non-dispatch-command-backed");
  assert.equal(flowdeskPluginScaffold.runtimeBoundary.realOpenCodeDispatch, "disabled");
  assert.equal(hasProductionOpenCodeRegistration(), true);
  assert.match(describeFlowDeskPluginScaffold(), /release1-non-dispatch-command-backed/);
});
