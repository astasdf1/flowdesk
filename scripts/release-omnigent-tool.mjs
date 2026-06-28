#!/usr/bin/env node
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function usage() {
  return [
    "Usage: node scripts/release-omnigent-tool.mjs [options]",
    "",
    "Builds flowdesk-omnigent-tool and verifies a fresh wheel install.",
    "Publishing is opt-in and requires PyPI/TestPyPI credentials or trusted publishing.",
    "",
    "Options:",
    "  --out-dir <dir>       Build output directory (default: temp dir)",
    "  --publish            Publish to PyPI after build/smoke",
    "  --test-pypi          Publish to TestPyPI after build/smoke",
    "  --skip-smoke         Skip fresh venv install smoke",
    "  --keep-temp          Keep temporary build/venv directories",
    "  --help               Show this help",
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = { publish: false, testPypi: false, skipSmoke: false, keepTemp: false };
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
    else if (arg === "--out-dir") parsed.outDir = value(arg);
    else if (arg === "--publish") parsed.publish = true;
    else if (arg === "--test-pypi") parsed.testPypi = true;
    else if (arg === "--skip-publish") parsed.publish = false;
    else if (arg === "--skip-smoke") parsed.skipSmoke = true;
    else if (arg === "--keep-temp") parsed.keepTemp = true;
    else errors.push(`unknown argument: ${arg}`);
  }
  if (parsed.publish && parsed.testPypi) errors.push("choose only one of --publish or --test-pypi");
  return { parsed, errors };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
}

function output(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr}`);
  return result.stdout.trim();
}

function findWheel(outDir) {
  const wheels = readdirSync(outDir).filter((name) => name.endsWith(".whl") && name.startsWith("flowdesk_omnigent_tool-"));
  if (wheels.length !== 1) throw new Error(`expected exactly one flowdesk_omnigent_tool wheel in ${outDir}, found ${wheels.length}`);
  return join(outDir, wheels[0]);
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

  const tempRoot = mkdtempSync(join(tmpdir(), "flowdesk-omnigent-release-"));
  const outDir = parsed.outDir ? resolve(parsed.outDir) : join(tempRoot, "dist");
  const venvDir = join(tempRoot, "venv");
  try {
    run("uv", ["build", "--sdist", "--wheel", "--out-dir", outDir, join(repoRoot, "packages", "omnigent-tool")]);
    const wheel = findWheel(outDir);
    process.stdout.write(`Built wheel: ${wheel}\n`);

    if (!parsed.skipSmoke) {
      run("uv", ["venv", venvDir, "--python", "3.12"]);
      const python = join(venvDir, "bin", "python");
      const mcp = join(venvDir, "bin", "flowdesk-omnigent-mcp");
      run("uv", ["pip", "install", "--python", python, wheel]);
      const smoke = output(python, [
        "-c",
        [
          "import json",
          "from flowdesk_omnigent.selection import select_agent_model",
          "selection = select_agent_model({'task_id':'task-release-smoke','task_role':'architecture','allowed_provider_families':['openai']})",
          "assert selection['selection_status'] == 'selected'",
          "print(json.dumps({'agent':selection['agent'],'harness':selection['harness'],'model':selection.get('model')}))",
        ].join("; "),
      ]);
      process.stdout.write(`Import smoke: ${smoke}\n`);
      const listRequest = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
      const result = spawnSync(mcp, [], { input: `${listRequest}\n`, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`flowdesk-omnigent-mcp smoke failed:\n${result.stderr}`);
      const response = JSON.parse(result.stdout.trim());
      if (response.result?.tools?.[0]?.name !== "flowdesk_select_agent_model") throw new Error("MCP tools/list smoke returned unexpected tool name");
      process.stdout.write("MCP console script smoke: ok\n");
    }

    if (parsed.publish || parsed.testPypi) {
      const args = ["publish"];
      if (parsed.testPypi) args.push("--publish-url", "https://test.pypi.org/legacy/");
      args.push("--directory", outDir);
      run("uv", args);
    } else {
      process.stdout.write("Publish skipped. Re-run with --test-pypi or --publish after configuring credentials/trusted publishing.\n");
    }
  } finally {
    if (parsed.keepTemp || parsed.outDir) process.stdout.write(`Kept build artifacts in ${outDir}\n`);
    if (!parsed.keepTemp) rmSync(tempRoot, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
