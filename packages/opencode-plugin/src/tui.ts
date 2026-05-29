import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { createElement, createTextNode, insert, setProp, type JSX } from "@opentui/solid";
import { createSignal } from "solid-js";
import {
	formatFlowDeskTuiUsageSnapshotCompactLines,
	loadFlowDeskTuiUsageSnapshotViewV1,
	type FlowDeskTuiUsageSnapshotViewV1,
} from "./tui-usage-snapshot.js";
import {
	formatFlowDeskTuiAutoNextReadyCompactLines,
	formatFlowDeskTuiSubtaskActivityCompactLines,
	loadFlowDeskTuiAutoNextReadyViewV1,
	loadFlowDeskTuiSubtaskActivityViewV1,
	type FlowDeskTuiAutoNextReadyViewV1,
	type FlowDeskTuiSubtaskActivityViewV1,
} from "./tui-subtask-activity.js";

interface FlowDeskTuiPluginOptionsV1 {
	durableStateRootDir?: string;
	usageWorkflowId?: string;
	showAppBottom?: boolean;
	showSessionPromptRight?: boolean;
}

const USAGE_SIDEBAR_REFRESH_INTERVAL_MS = 30_000;

type UsageSnapshotState = {
	view: () => FlowDeskTuiUsageSnapshotViewV1;
	dispose: () => void;
};

type SubtaskActivityState = {
	view: () => FlowDeskTuiSubtaskActivityViewV1;
	autoNextView: () => FlowDeskTuiAutoNextReadyViewV1;
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
	const read = (): FlowDeskTuiSubtaskActivityViewV1 =>
		loadFlowDeskTuiSubtaskActivityViewV1({
			rootDir: options.durableStateRootDir,
		});
	const readAutoNext = (): FlowDeskTuiAutoNextReadyViewV1 =>
		loadFlowDeskTuiAutoNextReadyViewV1({
			rootDir: options.durableStateRootDir,
		});
	const [view, setView] = createSignal(read());
	const [autoNextView, setAutoNextView] = createSignal(readAutoNext());
	const refresh = () => {
		setView(read());
		setAutoNextView(readAutoNext());
	};

	const intervalId = setInterval(refresh, USAGE_SIDEBAR_REFRESH_INTERVAL_MS);

	return {
		view: () => view(),
		autoNextView: () => autoNextView(),
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
		...(typeof record.showAppBottom === "boolean" ? { showAppBottom: record.showAppBottom } : {}),
		...(typeof record.showSessionPromptRight === "boolean"
			? { showSessionPromptRight: record.showSessionPromptRight }
			: {}),
	};
}

function textLine(value: string): JSX.Element {
	const node = createElement("text");
	insert(node, createTextNode(value));
	return node as unknown as JSX.Element;
}

function box(children: readonly JSX.Element[], props: Record<string, unknown> = {}): JSX.Element {
	const node = createElement("box");
	for (const [key, value] of Object.entries(props)) setProp(node, key, value);
	for (const child of children) insert(node, child);
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

function usageSidebar(usageState: UsageSnapshotState, subtaskState: SubtaskActivityState): JSX.Element {
	const view = usageState.view();
	const subtaskView = subtaskState.view();
	const autoNextLines = formatFlowDeskTuiAutoNextReadyCompactLines(subtaskState.autoNextView());
	return box(
		[
			...formatFlowDeskTuiUsageSnapshotCompactLines(view).map((line) => textLine(line)),
			textLine(formatObservedAt(view.observedAt)),
			textLine(view.status === "loaded" ? "cache readable" : "run /flowdesk-usage"),
			textLine(""),
			...autoNextLines.map((line) => textLine(line)),
			...(autoNextLines.length > 0 ? [textLine("")] : []),
			...formatFlowDeskTuiSubtaskActivityCompactLines(subtaskView).map((line) => textLine(line)),
		],
		{ flexShrink: 0, paddingTop: 1, paddingBottom: 1 },
	);
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
				return usageSidebar(usageSnapshotState, subtaskActivityState);
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
