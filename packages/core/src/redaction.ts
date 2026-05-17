import { validateNoForbiddenRawPayloads, type ValidationResult } from "./validators.js";

export const FLOWDESK_REDACTION_VERSION_V1 = "redaction-v1" as const;

export function validateRedactedPersistedPayload(value: unknown, label = "persisted payload"): ValidationResult {
  return validateNoForbiddenRawPayloads(value, label);
}

export function assertRedactedPersistedPayload(value: unknown, label = "persisted payload"): void {
  const result = validateRedactedPersistedPayload(value, label);
  if (!result.ok) throw new Error(result.errors.join("; "));
}
