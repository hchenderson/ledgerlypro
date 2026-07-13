const STOP_WORDS = new Set([
  "inc", "llc", "co", "company", "corp", "corporation", "store", "stores",
  "payment", "pos", "purchase", "debit", "credit", "card", "online",
  "ach", "check", "transfer", "sq", "square", "paypal", "stripe",
]);

const CLEAN_RE = /[^a-z0-9\s]/g;

export function normalizeMerchant(raw: string | undefined | null) {
  const s = (raw ?? "").toLowerCase().trim();
  if (!s) return { merchantName: "Unknown", merchantKey: "unknown" };

  // Strip punctuation
  const cleaned = s.replace(CLEAN_RE, " ");

  // Collapse whitespace
  const parts = cleaned.split(/\s+/).filter(Boolean);

  // Remove stopwords + short tokens
  const filtered = parts.filter(p => !STOP_WORDS.has(p) && p.length >= 2);

  // Keep first N tokens for stability
  const top = filtered.slice(0, 4);
  const merchantKey = top.join("_") || "unknown";
  const merchantName = top.map(capitalize).join(" ") || "Unknown";

  return { merchantName, merchantKey };
}

function capitalize(w: string) {
  return w.charAt(0).toUpperCase() + w.slice(1);
}
