export class FlowDeskTimeoutError extends Error {
  constructor(
    public readonly operationName: string,
    public readonly timeoutMs: number,
  ) {
    super(`FlowDesk: "${operationName}" timed out after ${timeoutMs}ms`);
    this.name = "FlowDeskTimeoutError";
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  let handle: ReturnType<typeof setTimeout> | undefined;
  // late rejection suppression (side-effect only, early rejection 보존)
  void promise.catch(() => undefined);
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(() => reject(new FlowDeskTimeoutError(operationName, timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (handle !== undefined) clearTimeout(handle);
  }
}

export const FLOWDESK_TIMEOUT_DEFAULTS = {
  sessionAbortMs: 10_000,
  sessionReadMs: 5_000,
  sessionDispatchMs: 30_000,
} as const;
