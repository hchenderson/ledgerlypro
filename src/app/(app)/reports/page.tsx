
'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useUserData } from '@/hooks/use-user-data';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { 
  Settings, 
  Save, 
  Download, 
  Eye, 
  BarChart3, 
  PieChart as PieChartIcon, 
  TrendingUp,
  Grid,
  List,
  Plus,
  X,
  Filter,
  Calendar as CalendarIcon,
  Palette,
  Move,
  Copy,
  FileText,
  Target,
  Calculator,
  Zap,
  BarChart2,
  Trash2,
  UploadCloud
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ComposedChart,
  ReferenceLine
} from 'recharts';
import type { Category, SubCategory } from '@/types';
import { DateRange } from 'react-day-picker';
import { subDays, format } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';
import { useToast } from '@/hooks/use-toast';


const CHART_TYPES = {
  bar: { name: 'Bar Chart', icon: BarChart3, allowsComparison: true },
  line: { name: 'Line Chart', icon: TrendingUp, allowsComparison: true },
  area: { name: 'Area Chart', icon: BarChart3, allowsComparison: false },
  pie: { name: 'Pie Chart', icon: PieChartIcon, allowsComparison: false },
  scatter: { name: 'Scatter Plot', icon: BarChart2, allowsComparison: false },
  composed: { name: 'Combined Chart', icon: BarChart2, allowsComparison: true },
  metric: { name: 'Metric Card', icon: Calculator, allowsComparison: false },
};

const COLOR_THEMES: Record<string, string[]> = {
  default: ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'],
  vibrant: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
  professional: ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6', '#BDC3C7'],
  warm: ['#E74C3C', '#E67E22', '#F39C12', '#F1C40F', '#D4AC0D'],
  cool: ['#3498DB', '#2980B9', '#1ABC9C', '#16A085', '#27AE60'],
  pastel: ['#FFB6C1', '#98FB98', '#87CEEB', '#DDA0DD', '#F0E68C']
};

const DATA_AGGREGATIONS = {
  sum: 'Sum',
  average: 'Average',
  count: 'Count',
  max: 'Maximum',
  min: 'Minimum'
};

const TIME_PERIODS = {
  daily: 'Daily',
  weekly: 'Weekly', 
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly'
};

function KpiTargetsDialog({ targets, onSave, children }: {
  targets: { monthlyIncome: number; monthlyExpense: number; savingsRate: number; };
  onSave: (newTargets: any) => void;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [localTargets, setLocalTargets] = useState(targets);

  useEffect(() => {
    setLocalTargets(targets);
  }, [targets, isOpen]);

  const handleSave = () => {
    onSave(localTargets);
    setIsOpen(false);
  };

  const handleChange = (key: keyof typeof targets, value: string) => {
    const numValue = parseInt(value, 10);
    setLocalTargets(prev => ({ ...prev, [key]: isNaN(numValue) ? 0 : numValue }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set KPI Targets</DialogTitle>
          <DialogDescription>Define your key performance indicators to track your financial goals.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Monthly Income Target</Label>
            <Input
              type="number"
              value={localTargets.monthlyIncome}
              onChange={e => handleChange('monthlyIncome', e.target.value)}
              placeholder="e.g., 5000"
            />
          </div>
          <div className="space-y-2">
            <Label>Monthly Expense Limit</Label>
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
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSave}>Save Targets</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Simple and safe formula evaluator
const evaluateFormula = (expression: string, context: Record<string, number>): number | null => {
  try {
    const variableNames = Object.keys(context);
    const variableValues = Object.values(context);
    
    // Sanitize expression to only allow variable names, numbers, and basic operators
    const sanitizedExpression = expression.replace(/[^a-zA-Z0-9_+\-*/(). ]/g, '');
    if(sanitizedExpression !== expression) {
        console.warn("Formula expression contained invalid characters and was sanitized.");
    }
    
    const func = new Function(...variableNames, `return ${sanitizedExpression}`);
    const result = func(...variableValues);

    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch (error) {
    console.error("Formula evaluation error:", error);
    return null;
  }
};


export default function AdvancedCustomizableReports() {
  const { allTransactions, categories: userCategories } = useUserData();
  const { user } = useAuth();
  const [startingBalance, setStartingBalance] = useState(0);
  const { toast } = useToast();

  const [widgets, setWidgets] = useState([
    {
      id: 'income-expense',
      title: 'Income vs Expense',
      type: 'bar',
      size: 'large',
      dataKey: 'monthly',
      mainDataKey: 'income',
      comparisonKey: 'expense',
      enabled: true,
      position: 0,
      colorTheme: 'default',
      showLegend: true,
      showGrid: true,
      height: 300,
      aggregation: 'sum',
      timePeriod: 'monthly',
      customFilters: [],
      annotations: [],
      formulaId: null,
    }
  ]);
  
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [newReportName, setNewReportName] = useState("");

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<any>(null);
  const [layout, setLayout] = useState('grid');
  
  const [globalFilters, setGlobalFilters] = useState({
    dateRange: {
      from: subDays(new Date(), 29),
      to: new Date()
    } as DateRange | undefined,
    categories: [] as string[],
    amountRange: [0, 10000] as [number, number],
    tags: [] as string[]
  });

  const [draggedWidget, setDraggedWidget] = useState<any>(null);
  const [kpiTargets, setKpiTargets] = useState({
    monthlyIncome: 5000,
    monthlyExpense: 3000,
    savingsRate: 40
  });

  const [formulas, setFormulas] = useState<{ id: string; name: string; expression: string }[]>([]);
  const [isFormulaBuilderOpen, setIsFormulaBuilderOpen] = useState(false);
  
  useEffect(() => {
    if (user) {
      const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'main');
      getDoc(settingsDocRef).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStartingBalance(data.startingBalance || 0);
          if (data.kpiTargets) {
            setKpiTargets(data.kpiTargets);
          }
        }
      });
    }
  }, [user]);
  
  const handleSaveReport = () => {
    if (!newReportName.trim()) {
      toast({ variant: 'destructive', title: "Report name cannot be empty." });
      return;
    }
    const newReport = {
      id: `report-${Date.now()}`,
      name: newReportName,
      widgets: JSON.parse(JSON.stringify(widgets)) // Deep copy
    };
    setSavedReports(prev => [...prev, newReport]);
    toast({ title: "Report Saved!", description: `"${newReportName}" has been saved.` });
    setIsSaveDialogOpen(false);
    setNewReportName("");
  };

  const handleLoadReport = (report: any) => {
    setWidgets(report.widgets);
    toast({ title: "Report Loaded", description: `Switched to "${report.name}" report.` });
  };
  
  const handleDeleteReport = (reportId: string) => {
    setSavedReports(prev => prev.filter(r => r.id !== reportId));
    toast({ title: "Report Deleted" });
  };

  const handleSaveKpiTargets = async (newTargets: any) => {
    setKpiTargets(newTargets);
    if(user) {
        const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'main');
        await setDoc(settingsDocRef, { kpiTargets: newTargets }, { merge: true });
    }
    toast({ title: "KPI Targets Saved" });
  };


  const processedData = useMemo(() => {
    const filtered = allTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      const inDateRange = globalFilters.dateRange?.from && globalFilters.dateRange?.to ?
        (transactionDate >= globalFilters.dateRange.from && transactionDate <= globalFilters.dateRange.to) : true;
      const passesAmountFilter = t.amount >= globalFilters.amountRange[0] && 
                                t.amount <= globalFilters.amountRange[1];
      const passesCategoryFilter = globalFilters.categories.length === 0 || 
                                  globalFilters.categories.includes(t.category);
      return inDateRange && passesAmountFilter && passesCategoryFilter;
    });

    const monthlyData: { [key: string]: any } = filtered.reduce((acc: { [key: string]: any }, transaction) => {
      const month = new Date(transaction.date).toLocaleDateString('en', { month: 'short', year: '2-digit' });
      if (!acc[month]) {
        acc[month] = { 
          month, 
          income: 0, 
          expense: 0, 
          transactions: 0,
          avgTransaction: 0,
          maxTransaction: 0,
          categories: new Set()
        };
      }
      
      acc[month][transaction.type] += transaction.amount;
      acc[month].transactions += 1;
      acc[month].maxTransaction = Math.max(acc[month].maxTransaction, transaction.amount);
      acc[month].categories.add(transaction.category);
      
      return acc;
    }, {});

    Object.values(monthlyData).forEach(month => {
      month.avgTransaction = (month.income + month.expense) / month.transactions || 0;
      month.netIncome = month.income - month.expense;
      month.savingsRate = month.income > 0 ? ((month.income - month.expense) / month.income) * 100 : 0;
      month.categoryCount = month.categories.size;
      month.categories = Array.from(month.categories);
    });

    const categoryTrends: { [key: string]: { [key: string]: number } } = {};
    filtered.filter(t => t.type === 'expense').forEach(t => {
      const month = new Date(t.date).toLocaleDateString('en', { month: 'short' });
      if (!categoryTrends[t.category]) {
        categoryTrends[t.category] = {};
      }
      categoryTrends[t.category][month] = (categoryTrends[t.category][month] || 0) + t.amount;
    });
    
    const totalIncome = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    return {
      monthly: Object.values(monthlyData).sort((a, b) => new Date(`1 ${a.month}`).getTime() - new Date(`1 ${b.month}`).getTime()),
      categories: Object.entries(categoryTrends).map(([category, months]) => ({
        category,
        total: Object.values(months).reduce((sum, val) => sum + val, 0),
        trend: Object.entries(months),
        avgMonthly: Object.values(months).reduce((sum, val) => sum + val, 0) / Object.keys(months).length
      })),
      kpis: {
        totalIncome,
        totalExpense,
        transactionCount: filtered.length,
        avgTransactionAmount: filtered.reduce((sum, t) => sum + t.amount, 0) / (filtered.length || 1),
        netIncome: totalIncome - totalExpense,
        savingsRate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0
      }
    };
  }, [globalFilters, allTransactions]);

  const renderAdvancedChart = (widget: any) => {
    const theme = COLOR_THEMES[widget.colorTheme] || COLOR_THEMES.default;
    const data = processedData[widget.dataKey === 'category' ? 'categories' : 'monthly' as keyof typeof processedData];
    
    if (widget.type === 'metric') {
      const formula = formulas.find(f => f.id === widget.formulaId);
      if (!formula) {
        return (
          <div className="flex h-full items-center justify-center text-muted-foreground p-4 text-center">
            Please select a formula for this metric card in the customize panel.
          </div>
        );
      }
      const value = evaluateFormula(formula.expression, processedData.kpis);
      
      return (
        <div className="p-6">
          <p className="text-4xl font-bold font-code">
            {value !== null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value) : 'Error'}
          </p>
          <p className="text-sm text-muted-foreground">{formula.name}</p>
        </div>
      );
    }

    if (!data || data.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          No data available for this configuration.
        </div>
      );
    }

    const chartProps = {
      margin: { top: 20, right: 30, left: 20, bottom: 20 }
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
      if (!active || !payload || !payload.length) return null;

      const data = payload[0].payload;
      
      const getTarget = (dataKey: string) => {
        if (dataKey === 'income') return kpiTargets.monthlyIncome;
        if (dataKey === 'expense') return kpiTargets.monthlyExpense;
        if (dataKey === 'savingsRate') return kpiTargets.savingsRate;
        return null;
      }
      
      const isExpense = (dataKey: string) => dataKey === 'expense';

      return (
        <div className="bg-background p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => {
             const target = getTarget(entry.dataKey);
             const isOverTarget = target && isExpense(entry.dataKey) && entry.value > target;
             const isUnderTarget = target && !isExpense(entry.dataKey) && entry.value < target;

             return (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm capitalize">
                    {entry.name}: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(entry.value)}
                  </span>
                </div>
                {target && (
                  <Badge variant={isOverTarget || isUnderTarget ? 'destructive' : 'default'} className="text-xs">
                    {((entry.value / target) * 100).toFixed(0)}% of target
                  </Badge>
                )}
              </div>
            )
          })}
          {data.netIncome !== undefined && (
             <p className={cn("text-xs text-muted-foreground mt-2 pt-2 border-t", data.netIncome > 0 ? 'text-emerald-500' : 'text-red-500')}>
              Net: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.netIncome)}
            </p>
          )}
        </div>
      );
    };

    switch (widget.type) {
      case 'composed':
        return (
          <ResponsiveContainer width="100%" height={widget.height}>
            <ComposedChart data={data as any[]} {...chartProps}>
              {widget.showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip content={<CustomTooltip />} />
              {widget.showLegend && <Legend />}
              <Bar yAxisId="left" dataKey={widget.mainDataKey} fill={theme[0]} name={widget.mainDataKey.charAt(0).toUpperCase() + widget.mainDataKey.slice(1)} />
              {widget.comparisonKey && (
                <Line yAxisId="right" type="monotone" dataKey={widget.comparisonKey} stroke={theme[2]} name={widget.comparisonKey.charAt(0).toUpperCase() + widget.comparisonKey.slice(1)} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={widget.height}>
            <ScatterChart data={data as any[]} {...chartProps}>
              {widget.showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey="income" name="Income" />
              <YAxis dataKey="expense" name="Expense" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
              <Scatter name="Income vs Expense" data={data as any[]} fill={theme[0]} />
            </ScatterChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={widget.height}>
            <BarChart data={data as any[]} {...chartProps}>
              {widget.showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              {widget.showLegend && <Legend />}
              <Bar dataKey={widget.mainDataKey} fill={theme[0]} name={widget.mainDataKey.charAt(0).toUpperCase() + widget.mainDataKey.slice(1)} />
              {widget.comparisonKey && (
                <Bar dataKey={widget.comparisonKey} fill={theme[1]} name={widget.comparisonKey.charAt(0).toUpperCase() + widget.comparisonKey.slice(1)} />
              )}
            </BarChart>
          </ResponsiveContainer>
        );
        
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={widget.height}>
            <LineChart data={data as any[]} {...chartProps}>
              {widget.showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              {widget.showLegend && <Legend />}
              <Line type="monotone" dataKey={widget.mainDataKey} stroke={theme[0]} name={widget.mainDataKey.charAt(0).toUpperCase() + widget.mainDataKey.slice(1)} />
               {widget.comparisonKey && (
                <Line type="monotone" dataKey={widget.comparisonKey} stroke={theme[1]} name={widget.comparisonKey.charAt(0).toUpperCase() + widget.comparisonKey.slice(1)} />
              )}
            </LineChart>
          </ResponsiveContainer>
        );


      default:
        return <div>Chart type not implemented</div>;
    }
  };
  
  const dataFieldOptions = useMemo(() => {
    if (processedData.monthly.length > 0) {
      return Object.keys(processedData.monthly[0]).map(key => ({
        value: key,
        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
      }));
    }
    return [];
  }, [processedData.monthly]);

  const addWidget = useCallback(() => {
    const newWidget = {
      id: `widget-${Date.now()}`,
      title: 'New Widget',
      type: 'bar',
      size: 'medium',
      dataKey: 'monthly',
      mainDataKey: 'income',
      comparisonKey: 'expense',
      enabled: true,
      position: widgets.length,
      colorTheme: 'default',
      showLegend: true,
      showGrid: true,
      height: 300,
      aggregation: 'sum',
      timePeriod: 'monthly',
      customFilters: [],
      annotations: [],
      formulaId: null,
    };
    setWidgets([...widgets, newWidget]);
  }, [widgets]);

  const updateWidget = useCallback((widgetId: string, updates: any) => {
    setWidgets(prevWidgets => 
      prevWidgets.map(w => w.id === widgetId ? { ...w, ...updates } : w)
    );
  }, []);

  const duplicateWidget = useCallback((widget: any) => {
    const newWidget = {
      ...widget,
      id: `widget-${Date.now()}`,
      title: `${widget.title} (Copy)`,
      position: widgets.length
    };
    setWidgets([...widgets, newWidget]);
  }, [widgets]);

  const enabledWidgets = widgets.filter(w => w.enabled).sort((a, b) => a.position - b.position);

  const allCategoryOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const recurse = (cats: (Category | SubCategory)[]) => {
      cats.forEach(c => {
        options.push({ value: c.name, label: c.name });
        if(c.subCategories) recurse(c.subCategories);
      });
    };
    recurse(userCategories);
    return options;
  }, [userCategories]);

  const handleAddFormula = (name: string, expression: string) => {
    if (name && expression) {
      setFormulas(prev => [...prev, { id: `formula-${Date.now()}`, name, expression }]);
      toast({ title: 'Formula Added', description: `"${name}" has been created.` });
      return true;
    }
    toast({ variant: 'destructive', title: 'Invalid Formula', description: 'Name and expression cannot be empty.' });
    return false;
  };

  const handleDeleteFormula = (id: string) => {
    setFormulas(prev => prev.filter(f => f.id !== id));
    toast({ title: 'Formula Deleted' });
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Advanced Reports</h2>
          <p className="text-muted-foreground">Create powerful, interactive financial dashboards</p>
        </div>
        <div className="flex flex-wrap gap-2">
           <KpiTargetsDialog targets={kpiTargets} onSave={handleSaveKpiTargets}>
            <Button variant="outline" size="sm">
              <Target className="h-4 w-4 mr-2" />
              KPI Targets
            </Button>
          </KpiTargetsDialog>
          <Dialog open={isFormulaBuilderOpen} onOpenChange={setIsFormulaBuilderOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Calculator className="h-4 w-4 mr-2" />
                Formula Builder
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Formula Builder</DialogTitle>
                <DialogDescription>
                  Create, view, and manage your custom formulas. These can be used later to generate new data fields for your reports.
                </DialogDescription>
              </DialogHeader>
              <FormulaBuilderTabContent
                formulas={formulas}
                onAddFormula={handleAddFormula}
                onDeleteFormula={handleDeleteFormula}
              />
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm">
            <Zap className="h-4 w-4 mr-2" />
            Auto Insights
          </Button>
          <Button
            variant={isCustomizing ? "default" : "outline"}
            onClick={() => setIsCustomizing(!isCustomizing)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Customize
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Global Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label>Date Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !globalFilters.dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {globalFilters.dateRange?.from ? (
                        globalFilters.dateRange.to ? (
                          <>
                            {format(globalFilters.dateRange.from, "LLL dd, y")} -{" "}
                            {format(globalFilters.dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(globalFilters.dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={globalFilters.dateRange?.from}
                      selected={globalFilters.dateRange}
                      onSelect={(range) => setGlobalFilters(prev => ({...prev, dateRange: range}))}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
            </div>
            <div className="space-y-2">
              <Label>Amount Range</Label>
              <Slider
                value={globalFilters.amountRange}
                onValueChange={(value) => setGlobalFilters(prev => ({ ...prev, amountRange: value as [number, number] }))}
                min={0}
                max={10000}
                step={100}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>${globalFilters.amountRange[0]}</span>
                <span>${globalFilters.amountRange[1]}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isCustomizing && (
        <Card>
          <CardHeader>
            <CardTitle>Advanced Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="widgets" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="widgets">Widgets</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
                <TabsTrigger value="styling">Styling</TabsTrigger>
                <TabsTrigger value="formulas">Formulas</TabsTrigger>
                <TabsTrigger value="export">Export</TabsTrigger>
              </TabsList>
              
              <TabsContent value="widgets" className="space-y-4 pt-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Widget Management</h3>
                  <div className="flex gap-2">
                     <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline"><Save className="h-4 w-4 mr-2" />Save Current</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Save Report</DialogTitle>
                                <DialogDescription>Enter a name for your current report configuration.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2">
                                <Label htmlFor="report-name">Report Name</Label>
                                <Input id="report-name" value={newReportName} onChange={(e) => setNewReportName(e.target.value)} />
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                <Button onClick={handleSaveReport}>Save Report</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button size="sm" onClick={addWidget}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Widget
                    </Button>
                  </div>
                </div>
                
                <div className="grid gap-4">
                  {widgets.map((widget) => (
                    <Card key={widget.id} className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={widget.enabled}
                            onCheckedChange={(checked) => updateWidget(widget.id, { enabled: !!checked })}
                          />
                          <Input
                            value={widget.title}
                            onChange={(e) => updateWidget(widget.id, { title: e.target.value })}
                            className="font-medium"
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => duplicateWidget(widget)}
                            title="Duplicate"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedWidget(widget as any)}
                            title="Advanced Settings"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <Label>Chart Type</Label>
                          <Select
                            value={widget.type}
                            onValueChange={(value) => updateWidget(widget.id, { type: value, formulaId: value === 'metric' ? (formulas[0]?.id || null) : null })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(CHART_TYPES).map(([key, type]) => (
                                <SelectItem key={key} value={key}>{type.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                         {widget.type === 'metric' ? (
                          <div>
                            <Label>Formula</Label>
                            <Select
                              value={widget.formulaId}
                              onValueChange={(value) => updateWidget(widget.id, { formulaId: value })}
                              disabled={formulas.length === 0}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a formula" />
                              </SelectTrigger>
                              <SelectContent>
                                {formulas.map(f => (
                                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <>
                            <div>
                                <Label>Main Data</Label>
                                <Select value={widget.mainDataKey} onValueChange={(value) => updateWidget(widget.id, { mainDataKey: value })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                    {dataFieldOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            {CHART_TYPES[widget.type as keyof typeof CHART_TYPES].allowsComparison && (
                                <div>
                                    <Label>Comparison Data</Label>
                                    <Select value={widget.comparisonKey} onValueChange={(value) => updateWidget(widget.id, { comparisonKey: value })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">None</SelectItem>
                                            {dataFieldOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div>
                              <Label>Height (px)</Label>
                              <Input
                                type="number"
                                value={widget.height}
                                onChange={(e) => updateWidget(widget.id, { 
                                  height: parseInt(e.target.value) || 300 
                                })}
                                min={200}
                                max={800}
                              />
                            </div>
                          </>
                        )}
                      </div>
                      
                      {widget.type !== 'metric' && (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={widget.showLegend}
                                onCheckedChange={(checked) => updateWidget(widget.id, { showLegend: !!checked })}
                              />
                              <Label>Show Legend</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={widget.showGrid}
                                onCheckedChange={(checked) => updateWidget(widget.id, { showGrid: !!checked })}
                              />
                              <Label>Show Grid</Label>
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="templates" className="space-y-4 pt-4">
                <h3 className="text-lg font-medium">Saved Reports</h3>
                {savedReports.length === 0 ? (
                    <p className="text-sm text-muted-foreground">You have no saved reports. Save the current widget configuration as a new report.</p>
                ) : (
                    <div className="space-y-2">
                        {savedReports.map(report => (
                            <div key={report.id} className="flex items-center justify-between p-2 border rounded-md">
                                <span className="font-medium">{report.name}</span>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => handleLoadReport(report)}>
                                        <UploadCloud className="h-4 w-4 mr-2" /> Load
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => handleDeleteReport(report.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
              </TabsContent>

              <TabsContent value="styling" className="space-y-4 pt-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Global Styling Options</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Dashboard Layout</Label>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant={layout === 'grid' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setLayout('grid')}
                        >
                          <Grid className="h-4 w-4 mr-2" />
                          Grid
                        </Button>
                        <Button
                          variant={layout === 'list' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setLayout('list')}
                        >
                          <List className="h-4 w-4 mr-2" />
                          List
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Color Palette Preview</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(COLOR_THEMES).map(([name, colors]) => (
                          <div key={name} className="flex">
                            {colors.map((color, i) => (
                              <div
                                key={i}
                                className="w-4 h-4 rounded-sm"
                                style={{ backgroundColor: color }}
                                title={name}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="formulas" className="space-y-4 pt-4">
                <FormulaBuilderTabContent
                  formulas={formulas}
                  onAddFormula={handleAddFormula}
                  onDeleteFormula={handleDeleteFormula}
                />
              </TabsContent>
              
              <TabsContent value="export" className="space-y-4 pt-4">
                <div>
                  <h3 className="text-lg font-medium">Export Options</h3>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <Button variant="outline">
                      <FileText className="h-4 w-4 mr-2" />
                      Export as PDF
                    </Button>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export Data (CSV)
                    </Button>
                    <Button variant="outline">
                      <Palette className="h-4 w-4 mr-2" />
                      Export as Image
                    </Button>
                    <Button variant="outline">
                      <Settings className="h-4 w-4 mr-2" />
                      Export Configuration
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <div ref={useRef(null)}>
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
          <div className={`grid gap-6 ${
            layout === 'grid' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
          }`}>
            {enabledWidgets.map((widget) => {
              const sizeClasses = {
                small: layout === 'grid' ? 'md:col-span-1' : '',
                medium: layout === 'grid' ? 'md:col-span-1' : '',
                large: layout === 'grid' ? 'md:col-span-2' : ''
              };

              return (
                <Card 
                  key={widget.id} 
                  className={cn(
                    `${sizeClasses[widget.size as keyof typeof sizeClasses]} transition-all duration-200 hover:shadow-md flex flex-col`,
                  )}
                >
                  <CardHeader className={cn("pb-2", widget.type === 'metric' && 'hidden')}>
                    <CardTitle className="flex items-center justify-between">
                      <span>{widget.title}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {CHART_TYPES[widget.type as keyof typeof CHART_TYPES]?.name}
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className={cn("flex-1 flex", widget.type !== 'metric' && 'p-0')}>
                    {renderAdvancedChart(widget)}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


function FormulaBuilderTabContent({ formulas, onAddFormula, onDeleteFormula }: {
  formulas: { id: string; name: string; expression: string }[];
  onAddFormula: (name: string, expression: string) => boolean;
  onDeleteFormula: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [expression, setExpression] = useState("");

  const handleAdd = () => {
    if(onAddFormula(name, expression)) {
      setName("");
      setExpression("");
    }
  };

  return (
    <div>
      <h3 className="text-lg font-medium">Custom Calculations</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Create custom metrics using formulas (e.g., "totalIncome - totalExpense"). Available variables: totalIncome, totalExpense, transactionCount, avgTransactionAmount, netIncome, savingsRate.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div>
            <Label htmlFor="formula-name">Formula Name</Label>
            <Input id="formula-name" placeholder="e.g. Net Income" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="formula-expression">Formula Expression</Label>
            <Textarea
              id="formula-expression"
              placeholder="e.g. totalIncome - totalExpense"
              rows={3}
              value={expression}
              onChange={e => setExpression(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Formula
          </Button>
        </div>
        <div className="space-y-2">
          <h4 className="font-medium">Existing Formulas</h4>
          {formulas.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 border rounded-md text-center">No formulas created yet.</p>
          ) : (
            <div className="border rounded-md max-h-60 overflow-y-auto">
              {formulas.map(formula => (
                <div key={formula.id} className="flex items-center justify-between p-2 border-b last:border-b-0">
                  <div>
                    <p className="font-semibold">{formula.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{formula.expression}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => onDeleteFormula(formula.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

    