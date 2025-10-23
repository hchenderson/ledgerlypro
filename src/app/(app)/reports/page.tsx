

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useUserData } from '@/hooks/use-user-data';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  PieChart as PieChartIcon, 
  TrendingUp,
  Settings,
} from 'lucide-react';
import type { Category, SubCategory, Widget } from '@/types';
import { DateRange } from 'react-day-picker';
import { subMonths, startOfMonth, endOfMonth } from 'date-fns';

import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AdvancedWidgetCustomizer } from '@/components/reports/customization';
import { OverviewChart } from '@/components/dashboard/overview-chart';
import { CategoryPieChart } from '@/components/reports/category-pie-chart';
import { SearchableMultiSelect } from '@/components/ui/searchable-multi-select';
import { useAuth } from '@/hooks/use-auth';
import { useReportSettings, SavedReport } from '@/hooks/use-report-settings';
import { useFormulaVariables } from '@/hooks/use-formula-variables';
import { ReportToolbar } from '@/components/reports/report-toolbar';
import { GlobalFilters } from '@/components/reports/global-filters';
import { WidgetCard } from '@/components/reports/widget-card';
import { Button } from '@/components/ui/button';
import { sanitizeForVariableName } from '@/lib/utils';
import { Parser } from 'expr-eval';
import { useWidgetData } from '@/hooks/use-widget-data';


const PRESET_RANGES = [
  { label: 'This Month', value: 'this-month' },
  { label: 'Last Month', value: 'last-month' },
  { label: 'This Year', value: 'this-year' },
  { label: 'Last 30 Days', value: 'last-30' },
  { label: 'Last 90 Days', value: 'last-90' },
];


function BasicReports() {
  const { allTransactions, categories } = useUserData();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedExpenseCategories, setSelectedExpenseCategories] = useState<string[]>([]);
  const [selectedIncomeCategories, setSelectedIncomeCategories] = useState<string[]>([]);

  const expenseCategoryOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const recurse = (cats: (Category | SubCategory)[]) => {
      (cats || []).forEach(c => {
        options.push({ value: c.name, label: c.name });
        if (c.subCategories) recurse(c.subCategories);
      });
    };
    recurse(categories.filter(c => c.type === 'expense'));
    return options.sort((a,b) => a.label.localeCompare(b.label));
  }, [categories]);

  const incomeCategoryOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const recurse = (cats: (Category | SubCategory)[]) => {
      (cats || []).forEach(c => {
        options.push({ value: c.name, label: c.name });
        if (c.subCategories) recurse(c.subCategories);
      });
    };
    recurse(categories.filter(c => c.type === 'income'));
    return options.sort((a,b) => a.label.localeCompare(b.label));
  }, [categories]);

  const handlePresetChange = (value: string) => {
    const now = new Date();
    let fromDate: Date;
    let toDate: Date;
    switch (value) {
      case 'this-month':
        fromDate = startOfMonth(now);
        toDate = endOfMonth(now);
        break;
      case 'last-month':
        const lastMonth = subMonths(now, 1);
        fromDate = startOfMonth(lastMonth);
        toDate = endOfMonth(lastMonth);
        break;
      case 'this-year':
         fromDate = new Date(now.getFullYear(), 0, 1);
         toDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'last-30':
         fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
         toDate = now;
        break;
      case 'last-90':
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);
        toDate = now;
        break;
      default:
        return;
    }
    setDateRange({ from: fromDate, to: toDate });
  };

  const dateFilteredTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      return dateRange?.from && dateRange?.to
        ? transactionDate >= dateRange.from && transactionDate <= dateRange.to
        : true;
    });
  }, [allTransactions, dateRange]);

  const findMainCategory = useCallback((subCategoryName: string, allCategories: Category[]): string => {
      for (const mainCat of allCategories) {
        if (mainCat.name === subCategoryName) return mainCat.name;

        const recurse = (currentSubs: SubCategory[] | undefined): string | null => {
            if (!currentSubs) return null;
            for (const sub of currentSubs) {
                if (sub.name === subCategoryName) return mainCat.name;
                const found = recurse(sub.subCategories);
                if (found) return found;
            }
            return null;
        }
        const found = recurse(mainCat.subCategories);
        if (found) return found;
      }
      return 'Uncategorized';
    }, []);

  const expenseByCategory = useMemo(() => {
    const data: { [key: string]: number } = {};
    dateFilteredTransactions
      .filter(t => t.type === 'expense')
      .filter(t => selectedExpenseCategories.length === 0 || selectedExpenseCategories.includes(findMainCategory(t.category, categories)))
      .forEach(t => {
        const mainCategory = findMainCategory(t.category, categories);
        data[mainCategory] = (data[mainCategory] || 0) + t.amount;
      });
  
    return Object.entries(data)
      .map(([name, amount]) => ({
        category: name,
        amount: amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [dateFilteredTransactions, categories, selectedExpenseCategories, findMainCategory]);
  
  const incomeByCategory = useMemo(() => {
    const data: { [key: string]: number } = {};
    dateFilteredTransactions
      .filter(t => t.type === 'income')
      .filter(t => selectedIncomeCategories.length === 0 || selectedIncomeCategories.includes(findMainCategory(t.category, categories)))
      .forEach(t => {
        const mainCategory = findMainCategory(t.category, categories);
        data[mainCategory] = (data[mainCategory] || 0) + t.amount;
      });
  
    return Object.entries(data)
      .map(([name, amount]) => ({
        category: name,
        amount: amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [dateFilteredTransactions, categories, selectedIncomeCategories, findMainCategory]);

  const overviewData = useMemo(() => {
    const dataByMonth: { [key: string]: { name: string; income: number; expense: number } } = {};
    dateFilteredTransactions.forEach(t => {
      const tDate = new Date(t.date);
      if (isNaN(tDate.getTime())) return;
      const monthKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
      if (!dataByMonth[monthKey]) {
        dataByMonth[monthKey] = { name: tDate.toLocaleString('en', { month: 'short', year: 'numeric' }), income: 0, expense: 0 };
      }
      dataByMonth[monthKey][t.type] += t.amount;
    });
    return Object.values(dataByMonth).sort((a, b) => a.name.localeCompare(b.name));
  }, [dateFilteredTransactions]);

  return (
    <div className="space-y-6">
       <GlobalFilters
            presetRanges={PRESET_RANGES}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            onPresetChange={handlePresetChange}
            categoryOptions={[]}
            selectedCategories={[]}
            onSelectedCategoriesChange={() => {}}
            showCategoryFilter={false}
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp/> Income vs. Expense Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <OverviewChart data={overviewData} />
          </CardContent>
        </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChartIcon/> Income Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <SearchableMultiSelect
                options={incomeCategoryOptions}
                selected={selectedIncomeCategories}
                onChange={setSelectedIncomeCategories}
                placeholder="Filter income categories..."
            />
            <CategoryPieChart data={incomeByCategory} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChartIcon/> Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <SearchableMultiSelect
                options={expenseCategoryOptions}
                selected={selectedExpenseCategories}
                onChange={setSelectedExpenseCategories}
                placeholder="Filter expense categories..."
            />
            <CategoryPieChart data={expenseByCategory} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdvancedReports() {
  const { allTransactions, categories: userCategories, getBudgetDetails } = useUserData();
  const { user } = useAuth();
  const { toast } = useToast();

  const {
      widgets, setWidgets,
      kpiTargets,
      formulas,
      savedReports,
      saveSettings,
      addReport,
      deleteReport
  } = useReportSettings(user?.uid);
  
  const [newReportName, setNewReportName] = useState("");
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);
  const [layout, setLayout] = useState('grid');
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  
  const [globalFilters, setGlobalFilters] = useState<{
    dateRange: DateRange | undefined;
    categories: string[];
  }>({
    dateRange: {
      from: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 29),
      to: new Date(),
    },
    categories: [],
  });

  const formulaVariables = useFormulaVariables(userCategories, getBudgetDetails);

  const { getWidgetData } = useWidgetData(
    allTransactions, 
    globalFilters, 
    formulas, 
    userCategories, 
    getBudgetDetails
  );
  
  const handleSaveReport = async () => {
    if (!newReportName.trim()) {
      toast({ variant: 'destructive', title: "Report name cannot be empty." });
      return;
    }
    await addReport(newReportName, widgets);
    toast({ title: "Report Saved!", description: `"${newReportName}" has been saved.` });
    setIsSaveDialogOpen(false);
    setNewReportName("");
  };

  const handleLoadReport = (report: SavedReport) => {
    setWidgets(report.widgets);
    toast({ title: "Report Loaded", description: `Switched to "${report.name}" report.` });
  };

  const addWidget = useCallback(() => {
    const newWidget: Widget = {
      id: `widget-${Date.now()}`,
      title: 'New Widget',
      type: 'bar',
      size: 'medium',
      mainDataKey: 'income',
      comparisonKey: 'expense',
      dataCategories: [],
      enabled: true,
      position: widgets.length,
      colorTheme: 'default',
      showLegend: true,
      showGrid: true,
      showTargetLines: false,
      height: 300,
      customFilters: { categories: [] },
      formulaId: null,
      responsive: true,
      animateChart: true,
      legendPosition: 'bottom'
    };
    const updatedWidgets = [...widgets, newWidget];
    saveSettings({ widgets: updatedWidgets });
  }, [widgets, saveSettings]);

  const updateWidget = useCallback((widgetId: string, updates: Partial<Widget> | Widget[]) => {
    if (widgetId === 'all' && Array.isArray(updates)) {
      setWidgets(updates);
      saveSettings({ widgets: updates });
      return;
    }

    const updatedWidgets = widgets.map(w => w.id === widgetId ? { ...w, ...updates } : w);
    setWidgets(updatedWidgets);
    saveSettings({ widgets: updatedWidgets });
  }, [widgets, saveSettings, setWidgets]);
  
  const removeWidget = useCallback((widgetId: string) => {
    const updatedWidgets = widgets.filter(w => w.id !== widgetId);
    saveSettings({ widgets: updatedWidgets });
  }, [widgets, saveSettings]);

  const duplicateWidget = useCallback((widget: Widget) => {
    const newWidget = {
      ...widget,
      id: `widget-${Date.now()}`,
      title: `${widget.title} (Copy)`,
      position: widgets.length
    };
    const updatedWidgets = [...widgets, newWidget];
    saveSettings({ widgets: updatedWidgets });
  }, [widgets, saveSettings]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, widgetId: string) => {
    setDraggedWidgetId(widgetId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropWidgetId: string) => {
    e.preventDefault();
    if (draggedWidgetId && draggedWidgetId !== dropWidgetId) {
      const draggedIndex = widgets.findIndex(w => w.id === draggedWidgetId);
      const dropIndex = widgets.findIndex(w => w.id === dropWidgetId);

      const newWidgets = [...widgets];
      const [draggedItem] = newWidgets.splice(draggedIndex, 1);
      newWidgets.splice(dropIndex, 0, draggedItem);
      
      const reorderedWidgets = newWidgets.map((w, i) => ({ ...w, position: i }));
      
      setWidgets(reorderedWidgets);
      saveSettings({ widgets: reorderedWidgets });
    }
    setDraggedWidgetId(null);
  };
  
  const enabledWidgets = widgets.filter(w => w.enabled).sort((a, b) => a.position - b.position);

  const allCategoryOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const recurse = (cats: (Category | SubCategory)[]) => {
      (cats || []).forEach(c => {
        options.push({ value: c.name, label: c.name });
        if(c.subCategories) recurse(c.subCategories);
      });
    };
    recurse(userCategories);
    return options;
  }, [userCategories]);

  const availableDataFields = useMemo(() => {
    const fields = [
      { value: 'income', label: 'Income' },
      { value: 'expense', label: 'Expense' },
    ];
  
    userCategories.forEach(c => {
      fields.push({ 
        value: sanitizeForVariableName(c.name), 
        label: `Category: ${c.name}`
      });
    });
  
    const budgets = getBudgetDetails();
    budgets.forEach(b => {
      fields.push({
        value: sanitizeForVariableName(`budget_${b.categoryName}_amount`),
        label: `Budget: ${b.categoryName} Amount`,
      });
       fields.push({
        value: sanitizeForVariableName(`budget_${b.categoryName}_spent`),
        label: `Budget: ${b.categoryName} Spent`,
      });
       fields.push({
        value: sanitizeForVariableName(`budget_${b.categoryName}_remaining`),
        label: `Budget: ${b.categoryName} Remaining`,
      });
    });
  
    return fields;
  }, [userCategories, getBudgetDetails]);
  
  return (
    <div className="space-y-6">
      <ReportToolbar
        kpiTargets={kpiTargets}
        formulas={formulas}
        formulaVariables={formulaVariables}
        isCustomizing={isCustomizing}
        onSaveKpiTargets={(newTargets) => saveSettings({ kpiTargets: newTargets })}
        onAddFormula={(name, expr) => saveSettings({ formulas: [...formulas, { id: `formula-${Date.now()}`, name, expression: expr }] })}
        onDeleteFormula={(id) => saveSettings({ formulas: formulas.filter(f => f.id !== id) })}
        onToggleCustomizing={() => setIsCustomizing(!isCustomizing)}
      />

       <GlobalFilters
            presetRanges={PRESET_RANGES}
            dateRange={globalFilters.dateRange}
            onDateRangeChange={(range) => setGlobalFilters(prev => ({...prev, dateRange: range}))}
            onPresetChange={(value) => {
                 const now = new Date();
                let from: Date, to: Date;
                switch (value) {
                    case 'this-month': from = startOfMonth(now); to = endOfMonth(now); break;
                    case 'last-month': const last = subMonths(now, 1); from = startOfMonth(last); to = endOfMonth(last); break;
                    case 'this-year': from = new Date(now.getFullYear(), 0, 1); to = new Date(now.getFullYear(), 11, 31); break;
                    case 'last-30': from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29); to = now; break;
                    case 'last-90': from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89); to = now; break;
                    default: return;
                }
                setGlobalFilters(prev => ({...prev, dateRange: { from, to }}));
            }}
            categoryOptions={allCategoryOptions}
            selectedCategories={globalFilters.categories}
            onSelectedCategoriesChange={(value) => setGlobalFilters(prev => ({...prev, categories: value}))}
            showCategoryFilter={true}
        />

      {isCustomizing && (
        <Card>
          <CardHeader>
            <CardTitle>Advanced Configuration</CardTitle>
          </CardHeader>
          <CardContent>
              <WidgetCard.Configuration
                widgets={widgets}
                savedReports={savedReports}
                formulas={formulas}
                layout={layout}
                isSaveDialogOpen={isSaveDialogOpen}
                newReportName={newReportName}
                onAddWidget={addWidget}
                onUpdateWidget={updateWidget}
                onRemoveWidget={removeWidget}
                onDuplicateWidget={duplicateWidget}
                onSetSelectedWidget={setSelectedWidget}
                onSaveReport={handleSaveReport}
                onLoadReport={handleLoadReport}
                onDeleteReport={deleteReport}
                onSetLayout={setLayout}
                setIsSaveDialogOpen={setIsSaveDialogOpen}
                setNewReportName={setNewReportName}
              />
          </CardContent>
        </Card>
      )}

      <div>
        {enabledWidgets.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12">
            <CardHeader className="text-center">
              <PieChartIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <CardTitle className="mt-4">No Widgets Enabled</CardTitle>
              <CardDescription>
                Enable some widgets in the customization panel to see your report.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setIsCustomizing(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Customize Report
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div 
            className={cn(
              "grid gap-6", 
              layout === 'grid' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
            )}
            onDragOver={handleDragOver}
          >
            {enabledWidgets.map((widget) => (
               <div
                key={widget.id}
                draggable={isCustomizing}
                onDragStart={(e) => handleDragStart(e, widget.id)}
                onDrop={(e) => handleDrop(e, widget.id)}
                className={cn(
                  'transition-opacity',
                  isCustomizing && 'cursor-move',
                  draggedWidgetId === widget.id && 'opacity-30'
                )}
               >
                  <WidgetCard
                    widget={widget}
                    getWidgetData={getWidgetData}
                    layout={layout}
                  />
              </div>
            ))}
          </div>
        )}
      </div>

       <AdvancedWidgetCustomizer
        widget={selectedWidget}
        onUpdate={updateWidget}
        onClose={() => setSelectedWidget(null)}
        allCategoryOptions={allCategoryOptions}
        availableDataFields={availableDataFields}
      />
    </div>
  );
}

export default function ReportsPage() {
    return (
        <Tabs defaultValue="basic" className="w-full">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight font-headline">Reports</h2>
                     <p className="text-muted-foreground">
                        A summary of your financial activity.
                    </p>
                </div>
                <TabsList>
                    <TabsTrigger value="basic">Basic</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="basic" className="pt-6">
                <BasicReports />
            </TabsContent>
            <TabsContent value="advanced" className="pt-6">
                <AdvancedReports />
            </TabsContent>
        </Tabs>
    )
}
