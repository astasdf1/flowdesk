export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringField(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function stableToken(value: string, fallback: string): string {
	const token = value.replaceAll(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 96);
	return token.length >= 3 ? token : fallback;
}

export function createAuthoritySmugglingValidator(
	authoritySmugglingKeys: Set<string>,
	forbiddenTextPattern?: RegExp
) {
	return function hasForbiddenAuthority(value: unknown): boolean {
		if (typeof value === "string") {
			if (forbiddenTextPattern && forbiddenTextPattern.test(value)) return true;
			return false;
		}
		if (!isRecord(value)) return false;
		for (const [key, entry] of Object.entries(value)) {
			if (
				authoritySmugglingKeys.has(key) &&
				entry !== false &&
				entry !== undefined
			)
				return true;
			if (hasForbiddenAuthority(entry)) return true;
		}
		return false;
	};
}