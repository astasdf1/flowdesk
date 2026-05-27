import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { createElement, createTextNode, insert, setProp, type JSX } from "@opentui/solid";
import { loadFlowDeskTuiUsageSnapshotViewV1 } from "./tui-usage-snapshot.js";

interface FlowDeskTuiPluginOptionsV1 {
	durableStateRootDir?: string;
	usageWorkflowId?: string;
	showAppBottom?: boolean;
	showSessionPromptRight?: boolean;
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

function percentLabel(value: number | null): string {
	return value === null ? "?" : `${Math.round(value)}%`;
}

function resetLabel(seconds: number | undefined): string {
	if (seconds === undefined) return "reset ?";
	if (seconds < 60) return "reset <1m";
	if (seconds < 3600) return `reset ${Math.ceil(seconds / 60)}m`;
	return `reset ${Math.ceil(seconds / 3600)}h`;
}

const providerLabels = {
	claude: "Claude",
	openai: "OpenAI",
	gemini: "Gemini",
} as const;

const statusGlyph = {
	ok: "●",
	warning: "▲",
	critical: "!",
	exhausted: "×",
	stale: "◌",
	unknown: "?",
} as const;

function usageSidebar(options: FlowDeskTuiPluginOptionsV1): JSX.Element {
	const view = loadFlowDeskTuiUsageSnapshotViewV1({
		rootDir: options.durableStateRootDir,
		workflowId: options.usageWorkflowId,
	});
	return box(
		[
			textLine("FlowDesk subscriptions"),
			...view.providers.map((provider) =>
				textLine(
					`${statusGlyph[provider.alertLevel]} ${providerLabels[provider.providerFamily]} · ${provider.connected ? "connected" : "unavailable"} · ${percentLabel(provider.remainingPercent)} · ${resetLabel(provider.secondsUntilReset)}`,
				),
			),
			textLine(view.status === "loaded" ? "cache readable" : "run /flowdesk-usage"),
		],
		{ flexShrink: 0, gap: 1, paddingTop: 1, paddingBottom: 1 },
	);
}

function usageBadge(options: FlowDeskTuiPluginOptionsV1): JSX.Element {
	const view = loadFlowDeskTuiUsageSnapshotViewV1({
		rootDir: options.durableStateRootDir,
		workflowId: options.usageWorkflowId,
	});
	const connected = view.providers.filter((provider) => provider.connected).length;
	return textLine(`FD ${connected}/${view.providers.length}`);
}

const tui: TuiPlugin = async (api, rawOptions) => {
	const options = optionsFrom(rawOptions);
	api.slots.register({
		slots: {
			sidebar_content() {
				return usageSidebar(options);
			},
			...(options.showAppBottom === true
				? {
						app_bottom() {
							return usageBadge(options);
						},
					}
				: {}),
			...(options.showSessionPromptRight === true
				? {
						session_prompt_right() {
							return usageBadge(options);
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
