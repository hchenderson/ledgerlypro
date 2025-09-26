
"use client";

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from './use-toast';

export interface Widget {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'composed' | 'metric';
  size: 'small' | 'medium' | 'large';
  mainDataKey?: string;
  comparisonKey?: string;
  dataCategories: string[];
  enabled: boolean;
  position: number;
  colorTheme: string;
  showLegend: boolean;
  showGrid: boolean;
  showTargetLines: boolean;
  height: number;
  customFilters: {
    categories: string[];
  };
  formulaId: string | null;
}

export interface Formula {
  id: string;
  name: string;
  expression: string;
}

export interface KPITargets {
  monthlyIncome: number;
  monthlyExpense: number;
  savingsRate: number;
}

const defaultWidgets: Widget[] = [
    {
      id: 'income-expense',
      title: 'Income vs Expense',
      type: 'bar',
      size: 'large',
      mainDataKey: 'income',
      comparisonKey: 'expense',
      dataCategories: [],
      enabled: true,
      position: 0,
      colorTheme: 'default',
      showLegend: true,
      showGrid: true,
      showTargetLines: false,
      height: 300,
      customFilters: { categories: [] },
      formulaId: null,
    }
];

export function useReportSettings(userId?: string) {
    const { toast } = useToast();
    const [widgets, setWidgets] = useState<Widget[]>(defaultWidgets);
    const [kpiTargets, setKpiTargets] = useState<KPITargets>({ monthlyIncome: 5000, monthlyExpense: 3000, savingsRate: 40 });
    const [formulas, setFormulas] = useState<Formula[]>([]);
    const [savedReports, setSavedReports] = useState<any[]>([]);
    
    useEffect(() => {
        if (userId) {
            const settingsDocRef = doc(db, 'users', userId, 'settings', 'reports');
            getDoc(settingsDocRef).then(docSnap => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.kpiTargets) setKpiTargets(data.kpiTargets);
                    if (data.formulas) setFormulas(data.formulas);
                    if (data.savedReports) setSavedReports(data.savedReports);
                    if (data.widgets) setWidgets(data.widgets);
                }
            }).catch(error => {
                console.error("Error loading settings:", error);
                toast({ variant: 'destructive', title: "Load Error", description: "Failed to load report settings." });
            });
        }
    }, [userId, toast]);
    
    const saveSettings = useCallback(async (updates: any) => {
        if (userId) {
            try {
                const settingsDocRef = doc(db, 'users', userId, 'settings', 'reports');
                await setDoc(settingsDocRef, updates, { merge: true });
                if (updates.widgets) setWidgets(updates.widgets);
                if (updates.kpiTargets) setKpiTargets(updates.kpiTargets);
                if (updates.formulas) setFormulas(updates.formulas);
            } catch (error) {
                console.error("Error saving settings:", error);
                toast({ variant: 'destructive', title: "Save Error", description: "Failed to save settings." });
            }
        }
    }, [userId, toast]);

    const addReport = useCallback(async (name: string, reportWidgets: Widget[]) => {
        const newReport = {
            id: `report-${Date.now()}`,
            name,
            widgets: JSON.parse(JSON.stringify(reportWidgets))
        };
        const updatedReports = [...savedReports, newReport];
        setSavedReports(updatedReports);
        await saveSettings({ savedReports: updatedReports });
    }, [savedReports, saveSettings]);

    const deleteReport = useCallback(async (reportId: string) => {
        const updatedReports = savedReports.filter(r => r.id !== reportId);
        setSavedReports(updatedReports);
        await saveSettings({ savedReports: updatedReports });
        toast({ title: "Report Deleted" });
    }, [savedReports, saveSettings, toast]);

    return {
        widgets,
        setWidgets,
        kpiTargets,
        formulas,
        savedReports,
        saveSettings,
        addReport,
        deleteReport,
    };
}
