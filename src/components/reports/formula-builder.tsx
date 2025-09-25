
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// --- Utils ---
function sanitizeForVariableName(name: string): string {
  if (!name) return '';
  return name
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^(\d)/, "_$1");
}

function sanitizeExpression(expression: string, aliasMap: Record<string,string>): string {
  const sortedKeys = Object.keys(aliasMap).sort((a,b) => b.length - a.length);
  const pattern = new RegExp(sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  return expression.replace(pattern, match => aliasMap[match]);
}

function prettifyExpression(expression: string, aliasMap: Record<string,string>): string {
  const reverseMap = Object.fromEntries(Object.entries(aliasMap).map(([raw, safe]) => [safe, raw]));
  const sortedKeys = Object.keys(reverseMap).sort((a,b) => b.length - a.length);
  const pattern = new RegExp(sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  return expression.replace(pattern, match => reverseMap[match]);
}

// --- Real safe evaluator ---
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
    for (const [original, sanitized] of Object.entries(nameMap)) {
      const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      rebuilt = rebuilt.replace(new RegExp(`("${escaped}"|'${escaped}'|\\b${escaped}\\b)`, "g"), sanitized);
    }

    if (!/^[a-zA-Z0-9_+\-*/().\s]+$/.test(rebuilt)) {
      throw new Error("Expression contains invalid characters after sanitization.");
    }

    const formula = new Function(...Object.keys(sanitizedContext), `return ${rebuilt};`);
    const result = formula(...Object.values(sanitizedContext));

    return typeof result === "number" && isFinite(result) ? result : null;
  } catch (err: any) {
    console.error("Formula evaluation error:", err);
    throw new Error(`Invalid formula: ${err.message}`);
  }
};

// --- Component ---
interface FormulaBuilderProps {
  availableVariables: string[];
  sampleContext: Record<string, number>;
  onAddFormula: (name: string, safeExpression: string) => Promise<boolean>;
  existingFormula?: { name: string, expression: string } | null; 
}

export default function FormulaBuilder({
  availableVariables,
  sampleContext,
  onAddFormula,
  existingFormula,
}: FormulaBuilderProps) {
  const [name, setName] = useState(existingFormula?.name || "");
  const [expression, setExpression] = useState("");
  const [testResult, setTestResult] = useState<number | null>(null);
  const [testError, setTestError] = useState("");

  const aliasMap = useMemo(() => {
    const map: Record<string, string> = {};
    availableVariables.forEach(v => {
      map[v] = sanitizeForVariableName(v);
    });
    return map;
  }, [availableVariables]);

  useEffect(() => {
    if (existingFormula?.expression) {
      setExpression(prettifyExpression(existingFormula.expression, aliasMap));
      setName(existingFormula.name);
    } else {
      setExpression("");
      setName("");
    }
  }, [existingFormula, aliasMap]);

  const testFormula = () => {
    if (!expression.trim()) return;
    setTestError(""); 
    setTestResult(null);
    try {
      const safeExpr = sanitizeExpression(expression, aliasMap);
      const result = safeEvaluateExpression(safeExpr, sampleContext);
      if (result == null) throw new Error("Formula did not return a number.");
      setTestResult(result);
    } catch (e: any) {
      setTestError(e.message || "Invalid formula.");
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || !expression.trim()) return;
    try {
      const safeExpr = sanitizeExpression(expression, aliasMap);
      const valid = safeEvaluateExpression(safeExpr, sampleContext);
      if (valid == null) throw new Error("Formula is invalid.");
      
      const success = await onAddFormula(name.trim(), safeExpr);
      if (!success) throw new Error("Save failed.");

      setName(""); 
      setExpression(""); 
      setTestResult(null);
      setTestError("");
      toast({ title: "Formula added successfully!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Invalid Formula", description: e.message });
    }
  };

  return (
    <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="formula-name">Formula Name</Label>
            <Input
                id="formula-name"
                placeholder="e.g., Net Savings Rate"
                value={name}
                onChange={e => setName(e.target.value)}
            />
        </div>

        <div className="space-y-2">
            <Label htmlFor="formula-expression">Formula Expression</Label>
            <Input
                id="formula-expression"
                placeholder="e.g. (totalIncome - totalExpense) / totalIncome * 100"
                value={expression}
                onChange={e => setExpression(e.target.value)}
            />
        </div>
      
        <div className="space-y-2">
            <Label>Insert Variable</Label>
            <Select
                onValueChange={(value) => setExpression(prev => `${prev} ${value}`.trim())}
            >
                <SelectTrigger>
                <SelectValue placeholder="Select a variable to insert..." />
                </SelectTrigger>
                <SelectContent>
                {Object.keys(aliasMap).sort((a,b) => a.localeCompare(b)).map(rawName => (
                    <SelectItem key={rawName} value={rawName}>
                    {rawName}
                    </SelectItem>
                ))}
                </SelectContent>
            </Select>
        </div>


      <div className="flex space-x-2">
        <Button variant="outline" onClick={testFormula}>Test Formula</Button>
        <Button onClick={handleAdd}>Save Formula</Button>
      </div>

      {testResult !== null && (
        <div className="p-3 bg-muted rounded-md">
            <p className="text-sm font-medium">Test Result:</p>
            <p className="text-lg font-mono text-primary">
                {new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(testResult)}
            </p>
        </div>
      )}
      {testError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm font-medium text-red-900">Error:</p>
            <p className="text-sm text-red-700">{testError}</p>
        </div>
      )}
    </div>
  );
}

