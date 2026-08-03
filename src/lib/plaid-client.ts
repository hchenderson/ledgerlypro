import "server-only";

const PLAID_BASE_URLS = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
} as const;

export type PlaidEnvironment = keyof typeof PLAID_BASE_URLS;

export class PlaidApiError extends Error {
  readonly errorCode?: string;
  readonly errorType?: string;
  readonly requestId?: string;
  readonly status: number;

  constructor(
    message: string,
    {
      errorCode,
      errorType,
      requestId,
      status,
    }: {
      errorCode?: string;
      errorType?: string;
      requestId?: string;
      status: number;
    },
  ) {
    super(message);
    this.name = "PlaidApiError";
    this.errorCode = errorCode;
    this.errorType = errorType;
    this.requestId = requestId;
    this.status = status;
  }
}

export function plaidConfigurationStatus() {
  const environment = (process.env.PLAID_ENV ?? "sandbox") as PlaidEnvironment;
  const missing = [
    ["PLAID_CLIENT_ID", process.env.PLAID_CLIENT_ID],
    ["PLAID_SECRET", process.env.PLAID_SECRET],
    ["PLAID_TOKEN_ENCRYPTION_KEY", process.env.PLAID_TOKEN_ENCRYPTION_KEY],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (!(environment in PLAID_BASE_URLS)) missing.push("PLAID_ENV");
  return {
    configured: missing.length === 0,
    environment,
    missing,
  };
}

export async function plaidRequest<T>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
  const status = plaidConfigurationStatus();
  if (!status.configured) {
    throw new Error(
      `Plaid is not configured. Missing: ${status.missing.join(", ")}.`,
    );
  }
  const response = await fetch(
    `${PLAID_BASE_URLS[status.environment]}/${endpoint.replace(/^\//, "")}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...body,
        client_id: process.env.PLAID_CLIENT_ID,
        secret: process.env.PLAID_SECRET,
      }),
      cache: "no-store",
    },
  );
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new PlaidApiError(
      typeof payload.error_message === "string"
        ? payload.error_message
        : "Plaid request failed.",
      {
        errorCode:
          typeof payload.error_code === "string"
            ? payload.error_code
            : undefined,
        errorType:
          typeof payload.error_type === "string"
            ? payload.error_type
            : undefined,
        requestId:
          typeof payload.request_id === "string"
            ? payload.request_id
            : undefined,
        status: response.status,
      },
    );
  }
  return payload as T;
}

export function publicPlaidConfiguration() {
  const status = plaidConfigurationStatus();
  return {
    configured: status.configured,
    environment: status.environment,
    realTimeBalanceEnabled:
      process.env.PLAID_REALTIME_BALANCE_ENABLED === "true",
  };
}
