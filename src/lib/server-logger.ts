import "server-only";

type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, boolean | number | string | null | undefined>;

function serializeError(error: unknown) {
  if (!(error instanceof Error)) return { errorType: typeof error };
  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
  return {
    errorName: error.name,
    errorMessage: error.message,
    errorCode: code,
  };
}

export function requestLogContext(req: Request, operation: string) {
  return {
    operation,
    requestId: req.headers.get("x-request-id") || crypto.randomUUID(),
  };
}

export function logServerEvent(
  level: LogLevel,
  event: string,
  context: LogContext = {},
  error?: unknown
) {
  const entry = {
    severity: level.toUpperCase(),
    event,
    timestamp: new Date().toISOString(),
    ...context,
    ...(error === undefined ? {} : serializeError(error)),
  };
  console[level](JSON.stringify(entry));
}
