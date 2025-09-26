

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
import { safeEvaluateExpression } from "@/lib/utils";
import { PlusCircle } from "lucide-react";


// --- Component ---
interface FormulaBuilderProps {
  onAddFormula: (name: string, safeExpression: string) => Promise<boolean>;
  availableVariables: string[];
  sampleContext: Record<string, number>;
  existingFormula?: string;
}

export default function FormulaBuilder({
  availableVariables,
  sampleContext,
  onAddFormula,
  existingFormula
}: FormulaBuilderProps) {
  const [name, setName] = useState("");
  const [expression, setExpression] = useState(existingFormula || "");
  const [testResult, setTestResult] = useState<number | null>(null);
  const [testError, setTestError] = useState("");
  
  useEffect(() => {
    if (existingFormula) {
      setExpression(existingFormula);
    }
  }, [existingFormula]);

  const testFormula = () => {
    if (!expression.trim()) return;
    setTestError(""); 
    setTestResult(null);
    try {
      const result = safeEvaluateExpression(expression, sampleContext);
      if (result == null) throw new Error("Formula did not return a number.");
      setTestResult(result);
    } catch (e: any) {
      setTestError(e.message || "Invalid formula.");
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || !expression.trim()) return;
    try {
      // Final validation before saving
      safeEvaluateExpression(expression, sampleContext);
      
      const success = await onAddFormula(name.trim(), expression);
      if (!success) throw new Error("Save failed. Please try again.");

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
                placeholder="e.g. (totalIncome - totalExpense) / totalIncome"
                value={expression}
                onChange={e => setExpression(e.target.value)}
            />
        </div>
        
        <div className="flex flex-wrap gap-2">
            {['+', '-', '*', '/', '(', ')'].map(op => (
                <Button
                    key={op}
                    type="button"
                    variant="outline"
                    className="h-8 w-10 font-mono"
                    onClick={() => setExpression(prev => `${prev.trim()} ${op} `)}
                >
                    {op}
                </Button>
            ))}
        </div>
      
        <div className="space-y-2">
            <Label>Insert Variable</Label>
            <Select
                onValueChange={(value) => {
                  if (value) {
                    setExpression(prev => `${prev.trim()} ${value} `)
                  }
                }}
            >
                <SelectTrigger>
                <SelectValue placeholder="Select a variable to insert..." />
                </SelectTrigger>
                <SelectContent>
                {(availableVariables || []).sort((a,b) => a.localeCompare(b)).map(rawName => (
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
