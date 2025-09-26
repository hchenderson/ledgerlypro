import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Parser } from 'expr-eval';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeForVariableName(name: string): string {
  if (!name) return '';
  // Replace all non-alphanumeric characters with underscores
  let sanitized = name.replace(/[^a-zA-Z0-9_]/g, "_");
  // If the first character is a number, prepend an underscore
  if (/^\d/.test(sanitized)) {
    sanitized = "_" + sanitized;
  }
  return sanitized;
}

export function prettifyExpression(expression: string, aliasMap: Record<string,string>): string {
  const reverseMap = Object.fromEntries(Object.entries(aliasMap).map(([raw, safe]) => [safe, raw]));
  // Sort keys by length descending
  const sortedKeys = Object.keys(reverseMap).sort((a,b) => b.length - a.length);
  
  const pattern = new RegExp(sortedKeys.join("|"), "g");

  return expression.replace(pattern, match => {
    return reverseMap[match] || match;
  });
}

export const safeEvaluateExpression = (
  expression: string,
  context: Record<string, any>
): number | null => {
  if (!expression || typeof expression !== 'string' || expression.trim() === '') {
    return null;
  }
  try {
    const parser = new Parser();
    const expr = parser.parse(expression);
    const result = expr.evaluate(context);
    
    if (typeof result !== 'number' || !isFinite(result)) {
      console.warn(`Formula "${expression}" produced a non-finite or non-numeric result:`, result);
      return null;
    }
    
    return result;
  } catch (err: any) {
    console.error(`Error evaluating formula "${expression}":`, err.message);
    throw new Error(`Invalid formula: ${err.message}`);
  }
};
