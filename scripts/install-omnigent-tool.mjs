#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

function usage() {
  return [
    "Usage: node scripts/install-omnigent-tool.mjs [options]",
    "",
    "Options:",
    "  --omnigent-root <dir>   Omnigent checkout containing .venv (default: ../omnigent if present)",
    "  --python <path>         Python executable for the Omnigent environment",
    "  --no-editable           Install package non-editably instead of -e",
    "  --skip-smoke            Skip post-install import/MCP smoke checks",
    "  --help                  Show this help",
    "",
    "Environment:",
    "  OMNIGENT_ROOT           Fallback Omnigent checkout path",
    "  OMNIGENT_PYTHON         Fallback Python executable",
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = { editable: true, skipSmoke: false };
  const errors = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    const value = (name) => {
      if (!next || next.startsWith("--")) {
        errors.push(`${name} requires a value`);
        return undefined;
      }
      index += 1;
      return next;
    };
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--omnigent-root") parsed.omnigentRoot = value(arg);
    else if (arg === "--python") parsed.python = value(arg);
    else if (arg === "--no-editable") parsed.editable = false;
    else if (arg === "--skip-smoke") parsed.skipSmoke = true;
    else errors.push(`unknown argument: ${arg}`);
  }
  return { parsed, errors };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function output(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function defaultOmnigentRoot(repoRoot) {
  const sibling = resolve(repoRoot, "..", "omnigent");
  return existsSync(sibling) ? sibling : undefined;
}

function resolvePython({ repoRoot, parsed }) {
  if (parsed.python) return resolve(parsed.python);
  if (process.env.OMNIGENT_PYTHON) return resolve(process.env.OMNIGENT_PYTHON);
  const omnigentRoot = parsed.omnigentRoot ?? process.env.OMNIGENT_ROOT ?? defaultOmnigentRoot(repoRoot);
  if (omnigentRoot) {
    const candidate = resolve(omnigentRoot, ".venv", "bin", "python");
    if (existsSync(candidate)) return candidate;
  }
  return "python3";
}

function main() {
  const repoRoot = resolve(new URL("..", import.meta.url).pathname);
  const { parsed, errors } = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (errors.length > 0) {
    process.stderr.write(`${errors.join("\n")}\n\n${usage()}\n`);
    process.exitCode = 2;
    return;
  }

  const packagePath = resolve(repoRoot, "packages", "omnigent-tool");
  const python = resolvePython({ repoRoot, parsed });
  const installArgs = ["pip", "install", "--python", python, parsed.editable ? "-e" : packagePath];
  if (parsed.editable) installArgs.push(packagePath);

  process.stdout.write(`Installing FlowDesk Omnigent tool into Python: ${python}\n`);
  run("uv", installArgs);

  if (!parsed.skipSmoke) {
    const smoke = output(python, [
      "-c",
      [
        "import json",
        "from flowdesk_omnigent.selection import select_agent_model",
        "from flowdesk_omnigent.mcp_server import handle_mcp_request",
        "selection = select_agent_model({'task_id':'task-install-smoke','task_role':'architecture','allowed_provider_families':['openai']})",
        "assert selection['schema_version'] == 'flowdesk.omnigent_selection.v1'",
        "assert selection['selection_status'] == 'selected'",
        "response = handle_mcp_request({'jsonrpc':'2.0','id':1,'method':'tools/list','params':{}})",
        "assert response['result']['tools'][0]['name'] == 'flowdesk_select_agent_model'",
        "print(json.dumps({'status':'ok','agent':selection['agent'],'harness':selection['harness'],'model':selection.get('model')}))",
      ].join("; "),
    ]);
    process.stdout.write(`Install smoke: ${smoke}\n`);
  }

  process.stdout.write("FlowDesk Omnigent tool install complete.\n");
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
