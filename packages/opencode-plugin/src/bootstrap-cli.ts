#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
import {
  expectedFlowDeskRelease1BootstrapApprovalPhrase,
  flowDeskBootstrapProfileRootRef,
  installFlowDeskRelease1Bootstrap,
  prepareFlowDeskRelease1BootstrapTypedConfirmation
} from "./bootstrap-installer.js";

export interface FlowDeskRelease1BootstrapCliStreams {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
}

export interface FlowDeskRelease1BootstrapCliOptions {
  argv: readonly string[];
  env?: Readonly<Record<string, string | undefined>>;
  now?: Date;
  streams?: FlowDeskRelease1BootstrapCliStreams;
}

export interface FlowDeskRelease1BootstrapCliResult {
  exitCode: 0 | 1 | 2;
}

interface ParsedInstallArgs {
  profileRootDir?: string;
  durableStateRootDir?: string;
  targetProfileRef?: string;
  confirmationRef?: string;
  expiresAt?: string;
  approve?: string;
  help: boolean;
}

const defaultStreams: FlowDeskRelease1BootstrapCliStreams = {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message)
};

function usage(): string {
  return [
    "Usage: flowdesk-install-release1 --profile-root <dir> --durable-root <dir> --target-profile <ref> --confirmation <ref> --expires-at <iso> --approve <exact phrase>",
    "",
    "Release 1 installs portable /flowdesk-* command files and redacted bootstrap artifacts only.",
    "It does not launch lanes, call providers, enable dispatch, or grant fallback/hard-chat authority.",
    "",
    "To preview the required approval phrase, omit --approve. No files are written until --approve exactly matches the displayed phrase."
  ].join("\n");
}

function parseArgs(argv: readonly string[]): { parsed?: ParsedInstallArgs; errors: string[] } {
  const parsed: ParsedInstallArgs = { help: false };
  const errors: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    const next = argv[index + 1];
    const requireValue = (name: string): string | undefined => {
      if (next === undefined || next.startsWith("--")) {
        errors.push(`${name} requires a value`);
        return undefined;
      }
      index += 1;
      return next;
    };
    switch (arg) {
      case "--profile-root":
      case "--profile-root-dir":
        parsed.profileRootDir = requireValue(arg);
        break;
      case "--durable-root":
      case "--durable-state-root":
      case "--durable-state-root-dir":
        parsed.durableStateRootDir = requireValue(arg);
        break;
      case "--target-profile":
      case "--target-profile-ref":
        parsed.targetProfileRef = requireValue(arg);
        break;
      case "--confirmation":
      case "--confirmation-ref":
        parsed.confirmationRef = requireValue(arg);
        break;
      case "--expires-at":
        parsed.expiresAt = requireValue(arg);
        break;
      case "--approve":
        parsed.approve = requireValue(arg);
        break;
      default:
        errors.push(`unknown argument: ${arg}`);
    }
  }
  return { parsed, errors };
}

function envDefault(env: Readonly<Record<string, string | undefined>>, names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return undefined;
}

function defaultExpiresAt(now: Date): string {
  return new Date(now.getTime() + 10 * 60 * 1000).toISOString();
}

function ensureInstallRoots(profileRootDir: string, durableStateRootDir: string): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  for (const [label, directory] of [["profile root", profileRootDir], ["durable state root", durableStateRootDir]] as const) {
    try {
      mkdirSync(directory, { recursive: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      errors.push(`${label} creation failed: ${message}`);
    }
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function completeArgs(parsed: ParsedInstallArgs, env: Readonly<Record<string, string | undefined>>, now: Date): Required<Omit<ParsedInstallArgs, "help">> & { help: false } {
  const profileRootDir = parsed.profileRootDir ?? envDefault(env, ["FLOWDESK_PROFILE_ROOT", "OPENCODE_CONFIG_DIR", "XDG_CONFIG_HOME"]);
  const durableStateRootDir = parsed.durableStateRootDir ?? envDefault(env, ["FLOWDESK_DURABLE_STATE_ROOT", "FLOWDESK_PROFILE_ROOT", "OPENCODE_CONFIG_DIR", "XDG_CONFIG_HOME"]);
  return {
    help: false,
    profileRootDir: profileRootDir ?? "",
    durableStateRootDir: durableStateRootDir ?? "",
    targetProfileRef: parsed.targetProfileRef ?? "profile-release1",
    confirmationRef: parsed.confirmationRef ?? `confirmation-release1-${now.getTime().toString(36)}`,
    expiresAt: parsed.expiresAt ?? defaultExpiresAt(now),
    approve: parsed.approve ?? ""
  };
}

export function runFlowDeskRelease1BootstrapCli(options: FlowDeskRelease1BootstrapCliOptions): FlowDeskRelease1BootstrapCliResult {
  const streams = options.streams ?? defaultStreams;
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const { parsed, errors } = parseArgs(options.argv);
  if (parsed?.help) {
    streams.stdout(`${usage()}\n`);
    return { exitCode: 0 };
  }
  if (errors.length > 0 || parsed === undefined) {
    streams.stderr(`${errors.join("\n")}\n\n${usage()}\n`);
    return { exitCode: 2 };
  }

  const args = completeArgs(parsed, env, now);
  const missing = [
    ["profile root", args.profileRootDir],
    ["durable state root", args.durableStateRootDir],
    ["target profile ref", args.targetProfileRef],
    ["confirmation ref", args.confirmationRef],
    ["expiry timestamp", args.expiresAt]
  ].flatMap(([label, value]) => value.length === 0 ? [label] : []);
  if (missing.length > 0) {
    streams.stderr(`missing required values: ${missing.join(", ")}\n\n${usage()}\n`);
    return { exitCode: 2 };
  }

  const profileRootDir = resolve(args.profileRootDir);
  const durableStateRootDir = resolve(args.durableStateRootDir);
  const requiredPhrase = expectedFlowDeskRelease1BootstrapApprovalPhrase(profileRootDir, args.targetProfileRef, args.confirmationRef);
  if (args.approve !== requiredPhrase) {
    streams.stdout(`${[
      "FlowDesk Release 1 bootstrap installer is ready.",
      `Profile root: ${profileRootDir}`,
      `Durable state root: ${durableStateRootDir}`,
      `Target profile: ${args.targetProfileRef}`,
      `Profile root ref: ${flowDeskBootstrapProfileRootRef(profileRootDir)}`,
      `Confirmation ref: ${args.confirmationRef}`,
      `Expires at: ${args.expiresAt}`,
      "",
      "No files were written.",
      "Re-run with this exact approval phrase:",
      requiredPhrase,
      "",
      "Release 1 bootstrap remains portable-command-only: non-dispatch registration metadata does not grant provider calls or runtime dispatch."
    ].join("\n")}\n`);
    return { exitCode: 2 };
  }

  const rootPreparation = ensureInstallRoots(profileRootDir, durableStateRootDir);
  if (!rootPreparation.ok) {
    streams.stderr(`FlowDesk Release 1 bootstrap install failed:\n${rootPreparation.errors.join("\n")}\n`);
    return { exitCode: 1 };
  }

  const result = installFlowDeskRelease1Bootstrap({
    profileRootDir,
    durableStateRootDir,
    targetProfileRef: args.targetProfileRef,
    typedConfirmation: prepareFlowDeskRelease1BootstrapTypedConfirmation({
      profileRootDir,
      targetProfileRef: args.targetProfileRef,
      confirmationRef: args.confirmationRef,
      expiresAt: args.expiresAt,
      typedPhrase: args.approve
    }),
    now
  });

  if (!result.ok) {
    streams.stderr(`FlowDesk Release 1 bootstrap install failed:\n${result.errors.join("\n")}\n`);
    return { exitCode: 1 };
  }

  streams.stdout(`${[
    "FlowDesk Release 1 bootstrap install complete.",
    `Profile root: ${result.profileRootDir ?? profileRootDir}`,
    `Durable state root: ${result.durableStateRootDir ?? durableStateRootDir}`,
    `Command files written: ${result.commandFilesWritten}`,
    `Bootstrap artifacts written: ${result.bootstrapArtifactsWritten}`,
    `Doctor handoff ref: ${result.doctorHandoffRef ?? "unknown"}`,
    "Safe next actions: /flowdesk-doctor, /flowdesk-status",
    "Production registration: release1 non-dispatch command-backed only",
    "Provider/runtime dispatch: disabled"
  ].join("\n")}\n`);
  return { exitCode: 0 };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runFlowDeskRelease1BootstrapCli({ argv: process.argv.slice(2) });
  process.exitCode = result.exitCode;
}
