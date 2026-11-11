export const DEFAULT_REPORTING_TIME_ZONE = "America/New_York";
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const OFFSET_TIMESTAMP = /(Z|[+-]\d{2}:?\d{2})$/;

export function isValidReportingTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function assertLedgerDate(value: string): string {
  const match = DATE_ONLY.exec(value);
  if (!match) throw new Error("Ledger date must use YYYY-MM-DD.");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) throw new Error("Ledger date is not a real calendar date.");
  return value;
}

export function dateInTimeZone(date: Date, timeZone = DEFAULT_REPORTING_TIME_ZONE): string {
  if (!isValidReportingTimeZone(timeZone)) throw new Error("Invalid reporting time zone.");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Date-only input stays unchanged. Offset timestamps are mapped in the ledger zone. */
export function toLedgerDate(value: string | Date, timeZone = DEFAULT_REPORTING_TIME_ZONE): string {
  if (value instanceof Date) return dateInTimeZone(value, timeZone);
  if (DATE_ONLY.test(value)) return assertLedgerDate(value);
  if (!OFFSET_TIMESTAMP.test(value)) {
    const prefix = value.slice(0, 10);
    if (DATE_ONLY.test(prefix)) return assertLedgerDate(prefix);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Transaction date is invalid.");
  return dateInTimeZone(parsed, timeZone);
}

/** Use for calendar/date-picker values whose displayed components are the user's intended ledger day. */
export function calendarDateToLedgerDate(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new Error("Transaction date is invalid.");
  return assertLedgerDate(
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
  );
}

export function transactionLedgerDate(
  transaction: { date: string; ledgerDate?: string },
  timeZone = DEFAULT_REPORTING_TIME_ZONE,
): string {
  return transaction.ledgerDate ? assertLedgerDate(transaction.ledgerDate) : toLedgerDate(transaction.date, timeZone);
}

/** Local noon preserves calendar components when existing date-fns UI code receives a Date. */
export function ledgerDateToDate(value: string): Date {
  const [year, month, day] = assertLedgerDate(value).split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function todayLedgerDate(now = new Date(), timeZone = DEFAULT_REPORTING_TIME_ZONE): string {
  return dateInTimeZone(now, timeZone);
}

export function isAmbiguousLegacyDate(value: string): boolean {
  // Any non-date-only value without an explicit UTC offset depends on the
  // runtime's locale/time zone parser, including US-style MM/DD/YYYY strings.
  return !DATE_ONLY.test(value) && !OFFSET_TIMESTAMP.test(value);
}
