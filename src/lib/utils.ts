import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { parse } from 'expr-eval';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeForVariableName(name: string): string {
  if (!name) return '';
  return name
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^(\d)/, "_$1");
}

export function sanitizeExpression(expression: string, aliasMap: Record<string,string>): string {
  const sortedKeys = Object.keys(aliasMap).sort((a,b) => b.length - a.length);

  const pattern = new RegExp(
    sortedKeys.map(k => `"${k}"|'${k}'|\\b${k}\\b`).join("|"),
    "g"
  );

  return expression.replace(pattern, match => {
    const cleanMatch = match.replace(/['"]/g, ''); // remove quotes
    return aliasMap[cleanMatch] || match; // fallback to original match if not in map
  });
}


export function prettifyExpression(expression: string, aliasMap: Record<string,string>): string {
  const reverseMap = Object.fromEntries(Object.entries(aliasMap).map(([raw, safe]) => [safe, raw]));
  // Sort keys by length descending
  const sortedKeys = Object.keys(reverseMap).sort((a,b) => b.length - a.length);
  
  const pattern = new RegExp(sortedKeys.join("|"), "g");

  return expression.replace(pattern, match => {
    // If the variable name contains spaces or special characters, wrap it in quotes
    if (/[^a-zA-Z0-9_]/.test(reverseMap[match])) {
      return `"${reverseMap[match]}"`;
    }
    return reverseMap[match];
  });
}


export const safeEvaluateExpression = (
  expression: string,
  context: Record<string, number | string | boolean>
): number | null => {
  try {
    if (!expression || typeof expression !== "string" || expression.trim() === "") {
      return null;
    }

    const sanitizedContext: Record<string, number | string | boolean> = {};
    const nameMap: Record<string, string> = {};

    for (const key in context) {
      const sanitized = sanitizeForVariableName(key);
      sanitizedContext[sanitized] = context[key];
      nameMap[key] = sanitized;
    }

    let rebuilt = expression;
    // Sort by length descending to replace longer matches first
    const sortedOriginalKeys = Object.keys(nameMap).sort((a, b) => b.length - a.length);

    for (const original of sortedOriginalKeys) {
      const sanitized = nameMap[original];
      // Escape the raw key for safe use in a regular expression
      const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Use a global regex to replace all occurrences of the standalone "word" or quoted string
      const regex = new RegExp(`("${escaped}"|'${escaped}'|\\b${escaped}\\b)`, 'g');
      rebuilt = rebuilt.replace(regex, sanitized);
    }
    
    // Final safety check to ensure only allowed characters remain
    if (!/^[a-zA-Z0-9_+\-*/().\s]+$/.test(rebuilt)) {
      console.error("Expression contains invalid characters after sanitization:", rebuilt);
      throw new Error('Expression contains invalid characters after sanitization.');
    }

    const formula = new Function(...Object.keys(sanitizedContext), `return ${rebuilt};`);
    const result = formula(...Object.values(sanitizedContext));

    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch (err: any) {
    console.error('Formula evaluation error:', err);
    throw new Error(`Invalid formula: ${err.message}`);
  }
};
