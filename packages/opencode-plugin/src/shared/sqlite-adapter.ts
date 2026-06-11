/**
 * SQLite runtime adapter for FlowDesk plugin.
 *
 * OpenCode 1.16.0 loads plugins via Bun 1.3.14, which provides bun:sqlite but
 * does not support node:sqlite (tracked: https://github.com/oven-sh/bun/issues/20412).
 *
 * The test suite runs under Node.js 22+ (npm test), which provides node:sqlite
 * but cannot resolve bun:sqlite.
 *
 * This adapter detects the runtime at module load time and re-exports a unified
 * DatabaseAdapter interface backed by whichever engine is available.
 *
 * Usage (read-only queries only — this is the FlowDesk dispatch gate use case):
 *   import { openReadonlyDb } from "./shared/sqlite-adapter.js";
 *   const db = openReadonlyDb(path);
 *   const rows = db.prepare<Row>(sql).all();
 *   db.close();
 */

export interface PreparedStatement<T> {
	all(...params: unknown[]): T[];
}

export interface DatabaseAdapter {
	prepare<T = unknown>(sql: string): PreparedStatement<T>;
	close(): void;
}

function isBunRuntime(): boolean {
	// Bun exposes globalThis.Bun; Node.js does not.
	return typeof (globalThis as Record<string, unknown>)["Bun"] !== "undefined";
}

/**
 * Open a SQLite database file in read-only mode.
 * Dispatches to bun:sqlite in the Bun plugin runtime,
 * or node:sqlite in the Node.js test runner.
 */
export function openReadonlyDb(filePath: string): DatabaseAdapter {
	if (isBunRuntime()) {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { Database } = require("bun:sqlite") as {
			Database: new (path: string, opts?: { readonly?: boolean }) => {
				prepare<T>(sql: string): { all(...p: unknown[]): T[] };
				close(): void;
			};
		};
		return new Database(filePath, { readonly: true });
	} else {
		// Node.js 22+ built-in
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { DatabaseSync } = require("node:sqlite") as {
			DatabaseSync: new (path: string, opts?: { open?: boolean }) => {
				prepare<T>(sql: string): { all(...p: unknown[]): T[] };
				close(): void;
			};
		};
		return new DatabaseSync(filePath, { open: true });
	}
}
