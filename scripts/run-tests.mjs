#!/usr/bin/env node

import { readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
	const arg = process.argv[i];
	if (!arg.startsWith("--")) continue;
	const [key, inlineValue] = arg.slice(2).split("=", 2);
	const value = inlineValue ?? (process.argv[i + 1]?.startsWith("--") ? "true" : process.argv[++i] ?? "true");
	args.set(key, value);
}

const mode = args.get("mode") ?? "functional";
const packageFilter = args.get("package");

const knownSlowTestFiles = new Set([
	"packages/opencode-plugin/dist/async-lane.test.js",
	"packages/opencode-plugin/dist/stall-recovery.test.js",
]);

const integrationTestFiles = new Set([
	"packages/opencode-plugin/dist/managed-dispatch-adapter.test.js",
	"packages/opencode-plugin/dist/quick-reviewer-run.test.js",
	"packages/opencode-plugin/dist/server.test.js",
]);

function collectTestFiles(dir) {
	const entries = readdirSync(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) files.push(...collectTestFiles(path));
		else if (entry.isFile() && entry.name.endsWith(".test.js")) files.push(path);
	}
	return files;
}

const packageNames = packageFilter ? [packageFilter] : ["core", "opencode-plugin"];
const allFiles = packageNames.flatMap((name) => collectTestFiles(join(repoRoot, "packages", name, "dist")));

const selectedFiles = allFiles
	.filter((file) => {
		const rel = relative(repoRoot, file);
		if (mode === "full") return true;
		if (mode === "slow") return knownSlowTestFiles.has(rel);
		if (mode === "integration") return integrationTestFiles.has(rel);
		if (mode === "functional") return !knownSlowTestFiles.has(rel) && !integrationTestFiles.has(rel);
		throw new Error(`Unknown test mode: ${mode}`);
	})
	.sort();

if (selectedFiles.length === 0) {
	console.log(`No ${mode} tests selected${packageFilter ? ` for ${packageFilter}` : ""}.`);
	process.exit(0);
}

const displayFiles = selectedFiles.map((file) => relative(repoRoot, file));
console.log(`Running ${selectedFiles.length} ${mode} test file(s):`);
for (const file of displayFiles) console.log(`- ${file}`);

const result = spawnSync(process.execPath, ["--test", ...displayFiles], {
	cwd: repoRoot,
	stdio: "inherit",
});

process.exit(result.status ?? 1);
