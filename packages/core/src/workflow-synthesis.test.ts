import assert from"node:assert/strict";
import test from"node:test";
import{validateFlowDeskWorkflowSynthesisResultV1}from"./workflow-synthesis.js";

const rec=(o:Record<string,unknown>={})=>({
	schema_version:"flowdesk.workflow_synthesis_result.v1",
	workflow_id:"workflow-1",
	synthesis_id:"synthesis-1",
	tasks_summarized:2,
	task_refs:["task-1","task-2"],
	conflict_detected:false,
	synthesis_summary:"Two bounded task outcomes were summarized for user review.",
	safe_next_actions:["/flowdesk-status","/flowdesk-export-debug"],
	...o
});

test("accepts workflow synthesis result",()=>{
	const r=validateFlowDeskWorkflowSynthesisResultV1(rec());
	assert.equal(r.ok,true,r.errors.join("; "))
});

test("rejects malformed counts and unknown fields",()=>{
	assert.equal(validateFlowDeskWorkflowSynthesisResultV1(rec({tasks_summarized:3})).ok,false);
	assert.equal(validateFlowDeskWorkflowSynthesisResultV1(rec({extra:"x"})).ok,false)
});

test("rejects unsafe text markers",()=>{
	const r=validateFlowDeskWorkflowSynthesisResultV1(rec({synthesis_summary:"contains system prompt marker"}));
	assert.equal(r.ok,false);
	assert.match(r.errors.join("|"),/synthesis_summary/)
});