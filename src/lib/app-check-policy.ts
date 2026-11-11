export type AppCheckMode = "off" | "monitor" | "enforce";

export function resolveAppCheckMode(
  environment: Partial<Record<"FIREBASE_APP_CHECK_MODE" | "FIREBASE_APP_CHECK_ENFORCED", string | undefined>>,
): AppCheckMode {
  const configured = environment.FIREBASE_APP_CHECK_MODE?.toLowerCase();
  if (configured === "off" || configured === "monitor" || configured === "enforce") {
    return configured;
  }
  if (environment.FIREBASE_APP_CHECK_ENFORCED === "true") return "enforce";
  if (environment.FIREBASE_APP_CHECK_ENFORCED === "false") return "monitor";
  return "off";
}
