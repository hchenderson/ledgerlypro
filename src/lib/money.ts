/** Ledgerly currently supports USD only. Money is authoritative in integer cents. */
export const LEDGER_CURRENCY = "USD" as const;
export const LEDGER_MINOR_UNIT_SCALE = 100;
export const MAX_MONEY_MINOR = 9_000_000_000_000;

export interface LegacyMoneyValue {
  amount: number;
  amountMinor?: number;
  currency?: string;
}

export function assertSupportedCurrency(currency?: string): asserts currency is "USD" | undefined {
  if (currency && currency !== LEDGER_CURRENCY) {
    throw new Error(`Unsupported currency ${currency}. Ledgerly currently supports USD only.`);
  }
}

/** Exact decimal parser used at user/import boundaries. More than two decimal places is rejected. */
export function parseMoneyToMinor(value: string | number): number {
  const input = typeof value === "number" ? String(value) : value.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(input);
  if (!match) throw new Error("Enter a valid USD amount with no more than two decimal places.");
  const sign = match[1] === "-" ? -1 : 1;
  const whole = Number(match[2]);
  const fraction = Number((match[3] ?? "").padEnd(2, "0"));
  const minor = sign * (whole * LEDGER_MINOR_UNIT_SCALE + fraction);
  if (!Number.isSafeInteger(minor) || Math.abs(minor) > MAX_MONEY_MINOR) {
    throw new Error("Amount is outside Ledgerly's supported range.");
  }
  return minor;
}

/** Legacy reads round once to cents; migrations report any precision loss. */
export function legacyMajorToMinor(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const minor = Math.round(value * LEDGER_MINOR_UNIT_SCALE);
  return Number.isSafeInteger(minor) && Math.abs(minor) <= MAX_MONEY_MINOR ? minor : 0;
}

export function moneyMinor(value: LegacyMoneyValue): number {
  assertSupportedCurrency(value.currency);
  if (Number.isSafeInteger(value.amountMinor) && Math.abs(value.amountMinor!) <= MAX_MONEY_MINOR) {
    return Math.abs(value.amountMinor!);
  }
  return Math.abs(legacyMajorToMinor(value.amount));
}

export function minorToMajor(minor: number): number {
  if (!Number.isSafeInteger(minor)) throw new Error("Minor-unit amount must be an integer.");
  return minor / LEDGER_MINOR_UNIT_SCALE;
}

export function canonicalMoneyFields(value: string | number | LegacyMoneyValue) {
  const minor = typeof value === "object"
    ? moneyMinor(value)
    : Math.abs(parseMoneyToMinor(value));
  return { amountMinor: minor, amount: minorToMajor(minor), currency: LEDGER_CURRENCY };
}

export function signedMoneyMinor(value: { amount?: number; amountMinor?: number; currency?: string }): number {
  assertSupportedCurrency(value.currency);
  if (Number.isSafeInteger(value.amountMinor) && Math.abs(value.amountMinor!) <= MAX_MONEY_MINOR) return value.amountMinor!;
  return legacyMajorToMinor(value.amount ?? 0);
}

export function canonicalSignedMoneyFields(value: string | number) {
  const amountMinor = parseMoneyToMinor(value);
  return { amountMinor, amount: minorToMajor(amountMinor), currency: LEDGER_CURRENCY };
}

export function roundRatioMinor(numeratorMinor: number, numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numeratorMinor) || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    throw new Error("Cannot prorate an invalid monetary value.");
  }
  return Math.round((numeratorMinor * numerator) / denominator);
}
