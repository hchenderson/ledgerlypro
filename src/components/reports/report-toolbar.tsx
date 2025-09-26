

"use client";

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, Settings, Target } from 'lucide-react';
import { useState, useEffect } from 'react';
import FormulaManager from './formula-manager';
import type { Formula } from '@/types';
import type { KPITargets } from '@/hooks/use-report-settings';

interface ReportToolbarProps {
    kpiTargets: KPITargets;
    formulas: Formula[];
    formulaVariables: string[];
    isCustomizing: boolean;
    onSaveKpiTargets: (targets: KPITargets) => void;
    onAddFormula: (name: string, expression: string) => void;
    onDeleteFormula: (id: string) => void;
    onToggleCustomizing: () => void;
}

function KpiTargetsDialog({ 
  targets, 
  onSave, 
  children 
}: {
  targets: KPITargets;
  onSave: (newTargets: KPITargets) => void;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [localTargets, setLocalTargets] = useState(targets);

  useEffect(() => {
    if (isOpen) {
      setLocalTargets(targets);
    }
  }, [targets, isOpen]);

  const handleSave = () => {
    onSave(localTargets);
    setIsOpen(false);
  };

  const handleChange = (key: keyof typeof targets, value: string) => {
    const numValue = parseFloat(value);
    setLocalTargets(prev => ({ 
      ...prev, 
      [key]: isNaN(numValue) ? 0 : numValue 
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set KPI Targets</DialogTitle>
          <DialogDescription>
            Define your key performance indicators to track your financial goals.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Monthly Income Target ($)</Label>
            <Input
              type="number"
              value={localTargets.monthlyIncome}
              onChange={e => handleChange('monthlyIncome', e.target.value)}
              placeholder="e.g., 5000"
            />
          </div>
          <div className="space-y-2">
            <Label>Monthly Expense Limit ($)</Label>
            <Input
              type="number"
              value={localTargets.monthlyExpense}
              onChange={e => handleChange('monthlyExpense', e.target.value)}
              placeholder="e.g., 3000"
            />
          </div>
          <div className="space-y-2">
            <Label>Target Savings Rate (%)</Label>
            <Input
              type="number"
              value={localTargets.savingsRate}
              onChange={e => handleChange('savingsRate', e.target.value)}
              placeholder="e.g., 40"
              min="0"
              max="100"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave}>Save Targets</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export function ReportToolbar({
    kpiTargets,
    formulas,
    formulaVariables,
    isCustomizing,
    onSaveKpiTargets,
    onAddFormula,
    onDeleteFormula,
    onToggleCustomizing
}: ReportToolbarProps) {
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
                 <p className="text-muted-foreground">Create powerful, interactive financial dashboards</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <KpiTargetsDialog targets={kpiTargets} onSave={onSaveKpiTargets}>
                    <Button variant="outline" size="sm">
                        <Target className="h-4 w-4 mr-2" />
                        KPI Targets
                    </Button>
                </KpiTargetsDialog>
                <FormulaManager
                    formulas={formulas}
                    onAddFormula={async (name, expr) => { onAddFormula(name, expr); return true; }}
                    onDeleteFormula={onDeleteFormula}
                    availableVariables={formulaVariables}
                />
                <Button
                    variant={isCustomizing ? "default" : "outline"}
                    onClick={onToggleCustomizing}
                >
                    <Settings className="h-4 w-4 mr-2" />
                    Customize
                </Button>
            </div>
        </div>
    );
}
