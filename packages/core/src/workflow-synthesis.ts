export const FLOWDESK_WORKFLOW_SYNTHESIS_RESULT_SCHEMA_VERSION_V1="flowdesk.workflow_synthesis_result.v1" as const;
export interface FlowDeskWorkflowSynthesisResultV1{
	schema_version:typeof FLOWDESK_WORKFLOW_SYNTHESIS_RESULT_SCHEMA_VERSION_V1;
	workflow_id:string;
	synthesis_id:string;
	tasks_summarized:number;
	task_refs:string[];
	conflict_detected:boolean;
	synthesis_summary:string;
	safe_next_actions:string[]
}
type ValidationResult={ok:boolean;errors:string[]};
const K=["schema_version","workflow_id","synthesis_id","tasks_summarized","task_refs","conflict_detected","synthesis_summary","safe_next_actions"];
const bad=/system prompt|provider payload|token|secret|opencode\srun|hidden injection|model switch|lane launch/i;
const id=(v:unknown,n:string,e:string[])=>{if(typeof v!=="string"||!v.trim()||v.length>128)e.push(`${n} invalid`)};
const text=(v:unknown,n:string,m:number,e:string[])=>{if(typeof v!=="string"||!v.trim()||v.length>m||bad.test(v))e.push(`${n} invalid`)};

export function validateFlowDeskWorkflowSynthesisResultV1(v:unknown):ValidationResult{
	const e:string[]=[];
	if(!v||typeof v!=="object"||Array.isArray(v))return{ok:false,errors:["workflow synthesis result must be an object"]};
	const r=v as Record<string,unknown>;
	for(const k of Object.keys(r))if(!K.includes(k))e.push(`unknown property: ${k}`);
	for(const k of K)if(!(k in r))e.push(`missing field: ${k}`);
	if(r.schema_version!==FLOWDESK_WORKFLOW_SYNTHESIS_RESULT_SCHEMA_VERSION_V1)e.push("schema_version invalid");
	id(r.workflow_id,"workflow_id",e);
	id(r.synthesis_id,"synthesis_id",e);
	if(!Number.isInteger(r.tasks_summarized)||Number(r.tasks_summarized)<0)e.push("tasks_summarized invalid");
	if(!Array.isArray(r.task_refs)||r.task_refs.length>32)e.push("task_refs invalid");
	else r.task_refs.forEach((x,i)=>id(x,`task_refs[${i}]`,e));
	if(Array.isArray(r.task_refs)&&r.tasks_summarized!==r.task_refs.length)e.push("tasks_summarized must match task_refs");
	if(typeof r.conflict_detected!=="boolean")e.push("conflict_detected invalid");
	text(r.synthesis_summary,"synthesis_summary",700,e);
	if(!Array.isArray(r.safe_next_actions)||r.safe_next_actions.length>8)e.push("safe_next_actions invalid");
	else r.safe_next_actions.forEach((x,i)=>text(x,`safe_next_actions[${i}]`,120,e));
	return{ok:e.length===0,errors:e};
}