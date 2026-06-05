import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { createElement, insert, setProp, type JSX } from "@opentui/solid";
import { createMemo, createSignal } from "solid-js";
import {
	formatFlowDeskTuiUsageSnapshotCompactLines,
	loadFlowDeskTuiUsageSnapshotViewV1,
	type FlowDeskTuiUsageSnapshotViewV1,
} from "./tui-usage-snapshot.js";
import {
	formatFlowDeskTuiAutoNextReadyCompactLines,
	formatFlowDeskTuiSubtaskActivityCompactLines,
	loadFlowDeskTuiAutoNextReadyViewV1,
	loadFlowDeskTuiCompletionWakeNoticeViewV1,
	loadFlowDeskTuiSubtaskActivityViewV1,
	type FlowDeskTuiAutoNextReadyViewV1,
	type FlowDeskTuiCompletionWakeNoticeViewV1,
	type FlowDeskTuiSubtaskActivityViewV1,
} from "./tui-subtask-activity.js";
import { formatFlowDeskTuiSidebarCompactLines } from "./tui-sidebar-format.js";

interface FlowDeskTuiPluginOptionsV1 {
	durableStateRootDir?: string;
	usageWorkflowId?: string;
	currentParentSessionRef?: string;
	currentSessionRef?: string;
	showAppBottom?: boolean;
	showSessionPromptRight?: boolean;
}

const USAGE_SIDEBAR_REFRESH_INTERVAL_MS = 30_000;
const SUBTASK_ACTIVITY_REFRESH_INTERVAL_MS = 1_000;

type UsageSnapshotState = {
	view: () => FlowDeskTuiUsageSnapshotViewV1;
	dispose: () => void;
};

type SubtaskActivityState = {
	view: (currentSessionRef?: string) => FlowDeskTuiSubtaskActivityViewV1;
	autoNextView: (currentSessionRef?: string) => FlowDeskTuiAutoNextReadyViewV1;
	wakeNoticeView: (currentSessionRef?: string) => FlowDeskTuiCompletionWakeNoticeViewV1;
	dispose: () => void;
};

function createUsageSnapshotState(options: FlowDeskTuiPluginOptionsV1): UsageSnapshotState {
	const read = (): FlowDeskTuiUsageSnapshotViewV1 =>
		loadFlowDeskTuiUsageSnapshotViewV1({
			rootDir: options.durableStateRootDir,
			workflowId: options.usageWorkflowId,
		});

	const [view, setView] = createSignal(read());
	const refresh = () => {
		setView(read());
	};

	const intervalId = setInterval(refresh, USAGE_SIDEBAR_REFRESH_INTERVAL_MS);

	return {
		view: () => view(),
		dispose: () => {
			clearInterval(intervalId);
		},
	};
}

function createSubtaskActivityState(options: FlowDeskTuiPluginOptionsV1): SubtaskActivityState {
	const effectiveSessionRef = (currentSessionRef: string | undefined): string | undefined =>
		currentSessionRef ?? options.currentParentSessionRef ?? options.currentSessionRef;
	const read = (currentSessionRef?: string): FlowDeskTuiSubtaskActivityViewV1 =>
		loadFlowDeskTuiSubtaskActivityViewV1({
			rootDir: options.durableStateRootDir,
			currentParentSessionRef: effectiveSessionRef(currentSessionRef),
		});
	const readAutoNext = (currentSessionRef?: string): FlowDeskTuiAutoNextReadyViewV1 =>
		loadFlowDeskTuiAutoNextReadyViewV1({
			rootDir: options.durableStateRootDir,
			currentParentSessionRef: effectiveSessionRef(currentSessionRef),
		});
	const readWakeNotice = (currentSessionRef?: string): FlowDeskTuiCompletionWakeNoticeViewV1 =>
		loadFlowDeskTuiCompletionWakeNoticeViewV1({
			rootDir: options.durableStateRootDir,
			currentParentSessionRef: effectiveSessionRef(currentSessionRef),
			consumeReady: true,
		});
	const [refreshTick, setRefreshTick] = createSignal(0);
	const refresh = () => {
		setRefreshTick((tick) => tick + 1);
	};

	const intervalId = setInterval(refresh, SUBTASK_ACTIVITY_REFRESH_INTERVAL_MS);

	return {
		view: (currentSessionRef?: string) => {
			refreshTick();
			return read(currentSessionRef);
		},
		autoNextView: (currentSessionRef?: string) => {
			refreshTick();
			return readAutoNext(currentSessionRef);
		},
		wakeNoticeView: (currentSessionRef?: string) => {
			refreshTick();
			return readWakeNotice(currentSessionRef);
		},
		dispose: () => {
			clearInterval(intervalId);
		},
	};
}

function optionsFrom(value: unknown): FlowDeskTuiPluginOptionsV1 {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
	const record = value as Record<string, unknown>;
	return {
		...(typeof record.durableStateRootDir === "string"
			? { durableStateRootDir: record.durableStateRootDir }
			: {}),
		...(typeof record.usageWorkflowId === "string" ? { usageWorkflowId: record.usageWorkflowId } : {}),
		...(typeof record.currentParentSessionRef === "string" ? { currentParentSessionRef: record.currentParentSessionRef } : {}),
		...(typeof record.currentSessionRef === "string" ? { currentSessionRef: record.currentSessionRef } : {}),
		...(typeof record.showAppBottom === "boolean" ? { showAppBottom: record.showAppBottom } : {}),
		...(typeof record.showSessionPromptRight === "boolean"
			? { showSessionPromptRight: record.showSessionPromptRight }
			: {}),
	};
}

function textLine(value: string | (() => string)): JSX.Element {
	const node = createElement("text");
	insert(node, value);
	return node as unknown as JSX.Element;
}

function formatObservedAt(iso: string): string {
	const ms = Date.parse(iso);
	if (!Number.isFinite(ms)) return "updated ?";
	const date = new Date(ms);
	const hh = String(date.getHours()).padStart(2, "0");
	const mm = String(date.getMinutes()).padStart(2, "0");
	const ss = String(date.getSeconds()).padStart(2, "0");
	return `updated ${hh}:${mm}:${ss}`;
}

function currentRouteSessionRef(api: Parameters<TuiPlugin>[0]): string | undefined {
	const route = api.route.current;
	const sessionID = route.name === "session" ? route.params?.sessionID : undefined;
	return typeof sessionID === "string" && sessionID.length > 0
		? sessionID
		: undefined;
}

function dynamicTextLineBox(lines: () => readonly string[], props: Record<string, unknown> = {}): JSX.Element {
	const node = createElement("box");
	for (const [key, value] of Object.entries(props)) setProp(node, key, value);
	insert(node, () => lines().map((line) => textLine(line)));
	return node as unknown as JSX.Element;
}

function usageSidebar(usageState: UsageSnapshotState, subtaskState: SubtaskActivityState, currentSessionRef: () => string | undefined): JSX.Element {
	const usageLines = createMemo(() => formatFlowDeskTuiUsageSnapshotCompactLines(usageState.view()));
	const observedLine = createMemo(() => formatObservedAt(usageState.view().observedAt));
	const statusLine = createMemo(() => {
		const view = usageState.view();
		if (view.status !== "loaded") return "run /flowdesk-usage";
		return view.redactedReason === "provider usage sidebar cache is stale"
			? "cache stale; run /flowdesk-usage"
			: "cache readable";
	});
	const autoNextLines = createMemo(() => formatFlowDeskTuiAutoNextReadyCompactLines(subtaskState.autoNextView(currentSessionRef())));
	const wakeNoticeView = createMemo(() => subtaskState.wakeNoticeView(currentSessionRef()));
	const subtaskLines = createMemo(() => formatFlowDeskTuiSubtaskActivityCompactLines(subtaskState.view(currentSessionRef()), 5));
	const allLines = createMemo(() => {
		// Keep the completion-wake consumer active for main-session wake handling,
		// but do not render those notices in sidebar_content.
		wakeNoticeView();
		return formatFlowDeskTuiSidebarCompactLines({
			usageLines: usageLines(),
			observedLine: observedLine(),
			statusLine: statusLine(),
			autoNextLines: autoNextLines(),
			subtaskLines: subtaskLines(),
		});
	});
	return dynamicTextLineBox(allLines, { flexShrink: 0 });
}

function usageBadge(state: UsageSnapshotState): JSX.Element {
	const view = state.view();
	const connected = view.providers.filter((provider) => provider.connected).length;
	return textLine(`FD ${connected}/${view.providers.length}`);
}

const tui: TuiPlugin = async (api, rawOptions) => {
	const options = optionsFrom(rawOptions);
	const usageSnapshotState = createUsageSnapshotState(options);
	const subtaskActivityState = createSubtaskActivityState(options);
	api.lifecycle.onDispose(usageSnapshotState.dispose);
	api.lifecycle.onDispose(subtaskActivityState.dispose);

	api.slots.register({
			slots: {
				sidebar_content() {
					return usageSidebar(usageSnapshotState, subtaskActivityState, () => currentRouteSessionRef(api));
				},
			...(options.showAppBottom === true
				? {
						app_bottom() {
							return usageBadge(usageSnapshotState);
						},
					}
				: {}),
			...(options.showSessionPromptRight === true
				? {
						session_prompt_right() {
							return usageBadge(usageSnapshotState);
						},
					}
				: {}),
		},
	});
};

export default {
	id: "flowdesk.tui",
	tui,
} satisfies TuiPluginModule & { id: string };
