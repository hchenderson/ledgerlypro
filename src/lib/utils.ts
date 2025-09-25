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
    sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "g"
  );

  return expression.replace(pattern, match => aliasMap[match]);
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
  context: Record<string, number | string | boolean>
): number | null => {
  try {
    if (!expression || typeof expression !== "string" || expression.trim() === "") {
      return null;
    }
    
    // Validate the formula contains only allowed characters
    if (!/^[a-zA-Z0-9_+\-*/().\s]+$/.test(expression)) {
      throw new Error('Formula contains invalid characters');
    }

    const formula = new Function(...Object.keys(context), `return ${expression};`);
    const result = formula(...Object.values(context));

    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch (err: any) {
    console.error('Formula evaluation error:', err);
    throw new Error(`Invalid formula: ${err.message}`);
  }
};
