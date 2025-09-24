

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
  UploadCloud,
  AlertTriangle
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
import type { Category, SubCategory, Transaction } from '@/types';
import { DateRange } from 'react-day-picker';
import { subDays, format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AdvancedWidgetCustomizer } from '@/components/reports/customization';
import { OverviewChart } from '@/components/dashboard/overview-chart';
import { CategoryPieChart } from '@/components/reports/category-pie-chart';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchableMultiSelect } from '@/components/ui/searchable-multi-select';


const PRESET_RANGES = [
  { label: 'This Month', value: 'this-month' },
  { label: 'Last Month', value: 'last-month' },
  { label: 'This Year', value: 'this-year' },
  { label: 'Last 30 Days', value: 'last-30' },
  { label: 'Last 90 Days', value: 'last-90' },
];

class ChartErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Chart error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex h-full items-center justify-center text-muted-foreground p-4 text-center">
          <div className="space-y-2">
            <AlertTriangle className="h-8 w-8 mx-auto" />
            <div>
              <p className="font-medium">Chart Error</p>
              <p className="text-sm">Unable to render this chart</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


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
  pastel: ['#FFB6C1', '#98FB98', '#87CEEB', '#DDA0DD', '#F0E68C'],
};

interface Widget {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'composed' | 'metric';
  size: 'small' | 'medium' | 'large';
  mainDataKey?: string;
  comparisonKey?: string;
  dataCategories: string[];
  enabled: boolean;
  position: number;
  colorTheme: keyof typeof COLOR_THEMES;
  showLegend: boolean;
  showGrid: boolean;
  showTargetLines: boolean;
  height: number;
  customFilters: {
    categories: string[];
  };
  formulaId: string | null;
}

interface Formula {
  id: string;
  name: string;
  expression: string;
}

interface KPITargets {
  monthlyIncome: number;
  monthlyExpense: number;
  savingsRate: number;
}


const sanitizeForVariableName = (name: string): string => {
  if (!name) return '';
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_') // Replace non-alphanumeric with underscore
    .replace(/^[0-9]/, '_$&')      // Prefix with underscore if starts with number
    .replace(/__+/g, '_')           // Replace multiple underscores with single
    .replace(/^_|_$/g, '');         // Remove leading/trailing underscores
};

const safeEvaluateExpression = (expression: string, context: Record<string, number | string | boolean>): number | null => {
  try {
      if (!expression || typeof expression !== 'string' || expression.trim() === '') {
        return null;
      }
      
      let sanitizedExpression = expression;
      const sanitizedContext: Record<string, number | string | boolean> = {};

      for (const key in context) {
        const sanitizedKey = sanitizeForVariableName(key);
        sanitizedContext[sanitizedKey] = context[key];
        // Important: Replace the original, potentially unsafe key in the expression
        // with the sanitized version. Use a regex to avoid replacing parts of other words.
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        sanitizedExpression = sanitizedExpression.replace(regex, sanitizedKey);
      }

      // The pattern should validate the sanitized expression
      const allowedPattern = /^[a-zA-Z0-9_+\-*/().\s]+$/;
      if (!allowedPattern.test(sanitizedExpression)) {
          throw new Error("Expression contains invalid characters after sanitization.");
      }

      // Using Function constructor is safer than eval()
      const formula = new Function(...Object.keys(sanitizedContext), `return ${sanitizedExpression};`);
      const result = formula(...Object.values(sanitizedContext));

      return typeof result === 'number' && isFinite(result) ? result : null;
  } catch (error: any) {
      console.error("Formula evaluation error:", error);
      throw new Error(`Invalid formula: ${error.message}`);
  }
};


function KpiTargetsDialog({ 
  targets, 
  onSave, 
  children 
}: {
  targets: KPITargets;
  onSave: (newTargets: any) => void;
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

const DraggableItem = ({ value }: { value: string }) => {
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData('text/plain', value);
    };

    return (
      <div
        draggable
        onDragStart={handleDragStart}
        className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs truncate cursor-move"
      >
        {value}
      </div>
    );
};

function FormulaBuilderTabContent({ 
  formulas, 
  onAddFormula, 
  onDeleteFormula,
  availableVariables
}: {
  formulas: Formula[];
  onAddFormula: (name: string, expression: string) => Promise<boolean>;
  onDeleteFormula: (id: string) => void;
  availableVariables: string[];
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [expression, setExpression] = useState("");
  const [testResult, setTestResult] = useState<number | null>(null);
  const [testError, setTestError] = useState<string>("");
  const expressionRef = useRef<HTMLTextAreaElement>(null);

  const mathSymbols = ['+', '-', '*', '/', '(', ')'];

  const sampleContext = useMemo(() => {
    const context: Record<string, number> = {
      totalIncome: 5000,
      totalExpense: 3000,
      transactionCount: 25,
      avgTransactionAmount: 320,
      netIncome: 2000,
      savingsRate: 40
    };
    availableVariables.forEach(v => {
      if (!context[v]) {
        context[v] = Math.floor(Math.random() * 1000);
      }
    });
    return context;
  }, [availableVariables]);

  const handleAdd = async () => {
    if (name.trim() && expression.trim()) {
      try {
        safeEvaluateExpression(expression, sampleContext);
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Invalid Formula',
          description: e.message || "Please check your formula syntax and try again.",
        });
        return;
      }
      const success = await onAddFormula(name.trim(), expression.trim());
      if (success) {
        setName("");
        setExpression("");
        setTestResult(null);
        setTestError("");
      }
    }
  };

  const testFormula = () => {
    if (expression.trim()) {
      setTestError("");
      setTestResult(null);
      try {
        const result = safeEvaluateExpression(expression, sampleContext);
        if (result === null) {
          setTestError("Formula evaluated to a non-number.");
        } else {
          setTestResult(result);
        }
      } catch (error: any) {
        setTestError(error.message || "Formula evaluation failed. Check console for details.");
      }
    }
  };

    const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain');
        const textarea = expressionRef.current;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newExpression = expression.substring(0, start) + data + expression.substring(end);
            setExpression(newExpression);
            
            // Move cursor to after the inserted text
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + data.length;
                textarea.focus();
            }, 0);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
    };

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-6 p-1">
        <Tabs defaultValue="create">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create">Create</TabsTrigger>
                <TabsTrigger value="existing">Existing</TabsTrigger>
            </TabsList>
            <TabsContent value="create" className="pt-4 space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="formula-name">Formula Name</Label>
                    <Input 
                    id="formula-name" 
                    placeholder="e.g., Net Income" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    />
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="formula-expression">Formula Expression</Label>
                    <Textarea
                    id="formula-expression"
                    ref={expressionRef}
                    placeholder="e.g., totalIncome - totalExpense"
                    rows={3}
                    value={expression}
                    onChange={e => setExpression(e.target.value)}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    />
                </div>

                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={testFormula}>
                    Test Formula
                    </Button>
                    <Button size="sm" onClick={handleAdd} disabled={!name.trim() || !expression.trim()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Formula
                    </Button>
                </div>

                 {testResult !== null && (
                    <div className="p-3 bg-muted rounded-md">
                        <p className="text-sm font-medium">Test Result:</p>
                        <p className="text-lg font-mono">
                        {new Intl.NumberFormat('en-US', { 
                            style: 'currency', 
                            currency: 'USD' 
                        }).format(testResult)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                        Using sample data.
                        </p>
                    </div>
                )}
                {testError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm font-medium text-red-900">Error:</p>
                        <p className="text-sm text-red-700">{testError}</p>
                    </div>
                )}

            </TabsContent>
            <TabsContent value="existing" className="pt-4 space-y-4">
                 {formulas.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-4 border rounded-md text-center">
                        No formulas created yet.
                    </div>
                    ) : (
                    <div className="border rounded-md max-h-60 overflow-y-auto">
                        {formulas.map(formula => (
                        <div key={formula.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                            <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{formula.name}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">
                                {formula.expression}
                            </p>
                            </div>
                            <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => onDeleteFormula(formula.id)}
                            className="flex-shrink-0 ml-2"
                            >
                            <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        </div>
                        ))}
                    </div>
                )}
            </TabsContent>
        </Tabs>
        
        <div className="space-y-2">
            <h4 className="font-medium">Operators</h4>
            <div className="flex flex-wrap gap-2">
              {mathSymbols.map(symbol => (
                <DraggableItem key={symbol} value={symbol} />
              ))}
            </div>
          </div>

        <div className="space-y-2">
          <h4 className="font-medium">Available Variables</h4>
          <p className="text-xs text-muted-foreground">
            The "Test Formula" button uses these sample values. Actual reports use your live data.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto border p-2 rounded-md">
            {availableVariables.map(variable => (
              <DraggableItem key={variable} value={variable} />
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function BasicReports() {
  const { allTransactions, categories } = useUserData();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  const allCategoryOptions = useMemo(() => {
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
         fromDate = subDays(now, 29);
         toDate = now;
        break;
      case 'last-90':
        fromDate = subDays(now, 89);
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

  const expenseByCategory = useMemo(() => {
    const findMainCategory = (subCategoryName: string, allCategories: Category[]): string => {
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
    };
  
    const data: { [key: string]: number } = {};
    dateFilteredTransactions
      .filter(t => t.type === 'expense')
      .filter(t => selectedCategories.length === 0 || selectedCategories.includes(findMainCategory(t.category, categories)))
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
  }, [dateFilteredTransactions, categories, selectedCategories]);

  const overviewData = useMemo(() => {
    const dataByMonth: { [key: string]: { name: string; income: number; expense: number } } = {};
    dateFilteredTransactions.forEach(t => {
      const month = format(new Date(t.date), 'MMM yy');
      if (!dataByMonth[month]) {
        dataByMonth[month] = { name: month, income: 0, expense: 0 };
      }
      dataByMonth[month][t.type] += t.amount;
    });
    return Object.values(dataByMonth).sort((a, b) => new Date(`1 ${a.name}`).getTime() - new Date(`1 ${b.name}`).getTime());
  }, [dateFilteredTransactions]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select onValueChange={handlePresetChange}>
                <SelectTrigger>
                    <SelectValue placeholder="Select a preset" />
                </SelectTrigger>
                <SelectContent>
                    {PRESET_RANGES.map(preset => (
                        <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Popover>
            <PopoverTrigger asChild>
                <Button
                id="date"
                variant="outline"
                className={cn(
                    'justify-start text-left font-normal',
                    !dateRange && 'text-muted-foreground'
                )}
                >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                    dateRange.to ? (
                    <>
                        {format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}
                    </>
                    ) : (
                    format(dateRange.from, 'LLL dd, y')
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
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                />
            </PopoverContent>
            </Popover>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp/> Income vs. Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <OverviewChart data={overviewData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChartIcon/> Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <SearchableMultiSelect
                options={allCategoryOptions}
                selected={selectedCategories}
                onChange={setSelectedCategories}
                placeholder="Filter categories..."
            />
            <CategoryPieChart data={expenseByCategory} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


function AdvancedReports() {
  const { allTransactions, categories: userCategories } = useUserData();
  const { user } = useAuth();
  const [startingBalance, setStartingBalance] = useState(0);
  const { toast } = useToast();

  const [widgets, setWidgets] = useState<Widget[]>([
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
  ]);
  
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [newReportName, setNewReportName] = useState("");

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<any>(null);
  const [layout, setLayout] = useState('grid');
  
  const [globalFilters, setGlobalFilters] = useState<{
    dateRange: DateRange | undefined;
    categories: string[];
    tags: string[];
  }>({
    dateRange: {
      from: subDays(new Date(), 29),
      to: new Date(),
    },
    categories: [],
    tags: [],
  });

  const [kpiTargets, setKpiTargets] = useState<KPITargets>({
    monthlyIncome: 5000,
    monthlyExpense: 3000,
    savingsRate: 40
  });

  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [isFormulaBuilderOpen, setIsFormulaBuilderOpen] = useState(false);
  
  // Load settings from Firebase
  useEffect(() => {
    if (user) {
      const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'reports');
      getDoc(settingsDocRef).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.kpiTargets) {
            setKpiTargets(data.kpiTargets);
          }
          if (data.formulas) {
            setFormulas(data.formulas);
          }
          if (data.savedReports) {
            setSavedReports(data.savedReports);
          }
          if (data.widgets) {
            setWidgets(data.widgets);
          }
        }
      }).catch(error => {
        console.error("Error loading settings:", error);
      });
    }
  }, [user]);

  // Save settings to Firebase
  const saveSettingsToFirestore = async (updates: any) => {
    if (user) {
      try {
        const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'reports');
        await setDoc(settingsDocRef, updates, { merge: true });
      } catch (error) {
        console.error("Error saving settings:", error);
        toast({ 
          variant: 'destructive', 
          title: "Save Error", 
          description: "Failed to save settings. Please try again." 
        });
      }
    }
  };

  const handleSaveReport = async () => {
    if (!newReportName.trim()) {
      toast({ variant: 'destructive', title: "Report name cannot be empty." });
      return;
    }
    const newReport = {
      id: `report-${Date.now()}`,
      name: newReportName,
      widgets: JSON.parse(JSON.stringify(widgets))
    };
    const updatedReports = [...savedReports, newReport];
    setSavedReports(updatedReports);
    await saveSettingsToFirestore({ savedReports: updatedReports });
    toast({ title: "Report Saved!", description: `"${newReportName}" has been saved.` });
    setIsSaveDialogOpen(false);
    setNewReportName("");
  };

  const handleLoadReport = (report: any) => {
    setWidgets(report.widgets);
    toast({ title: "Report Loaded", description: `Switched to "${report.name}" report.` });
  };
  
  const handleDeleteReport = async (reportId: string) => {
    const updatedReports = savedReports.filter(r => r.id !== reportId);
    setSavedReports(updatedReports);
    await saveSettingsToFirestore({ savedReports: updatedReports });
    toast({ title: "Report Deleted" });
  };

  const handleSaveKpiTargets = async (newTargets: any) => {
    setKpiTargets(newTargets);
    await saveSettingsToFirestore({ kpiTargets: newTargets });
    toast({ title: "KPI Targets Saved" });
  };

  const handleAddFormula = async (name: string, expression: string): Promise<boolean> => {
    if (name.trim() && expression.trim()) {
      const newFormula: Formula = { 
        id: `formula-${Date.now()}`, 
        name: name.trim(), 
        expression: expression.trim() 
      };
      const updatedFormulas = [...formulas, newFormula];
      setFormulas(updatedFormulas);
      await saveSettingsToFirestore({ formulas: updatedFormulas });
      toast({ title: 'Formula Added', description: `"${name}" has been created.` });
      return true;
    }
    toast({ 
      variant: 'destructive', 
      title: 'Invalid Formula', 
      description: 'Name and expression cannot be empty.' 
    });
    return false;
  };

  const handleDeleteFormula = async (id: string) => {
    const updatedFormulas = formulas.filter(f => f.id !== id);
    setFormulas(updatedFormulas);
    
    const updatedWidgets = widgets.map(w => 
      w.formulaId === id ? { ...w, formulaId: null } : w
    );
    setWidgets(updatedWidgets);
    
    await saveSettingsToFirestore({ 
      formulas: updatedFormulas,
      widgets: updatedWidgets 
    });
    toast({ title: 'Formula Deleted' });
  };

  const formulaVariables = useMemo(() => {
    const baseVars = [
      'totalIncome', 'totalExpense', 'transactionCount',
      'avgTransactionAmount', 'netIncome', 'savingsRate'
    ];
    
    const categoryVars = new Set<string>();
    const recurse = (cats: (Category | SubCategory)[]) => {
      (cats || []).forEach(c => {
        categoryVars.add(sanitizeForVariableName(c.name));
        if (c.subCategories) recurse(c.subCategories);
      });
    };
    recurse(userCategories);

    return [...baseVars, ...Array.from(categoryVars)];
  }, [userCategories]);

  const getWidgetData = useCallback((widget: any) => {
    const transactions = allTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      const inDateRange = globalFilters.dateRange?.from && globalFilters.dateRange?.to ?
        (transactionDate >= globalFilters.dateRange.from && transactionDate <= globalFilters.dateRange.to) : true;
      
      const globalCategoryCheck = globalFilters.categories.length === 0 || globalFilters.categories.includes(t.category);
      const widgetCategoryCheck = widget.customFilters?.categories?.length > 0 ? 
        widget.customFilters.categories.includes(t.category) : true;
      
      return inDateRange && globalCategoryCheck && widgetCategoryCheck;
    });
    
    const dataKeys = (widget.dataCategories || []).length > 0
        ? widget.dataCategories
        : [widget.mainDataKey, widget.comparisonKey].filter(Boolean);

    const monthlyData: { [key: string]: any } = transactions.reduce((acc: { [key:string]: any }, transaction) => {
      const month = new Date(transaction.date).toLocaleDateString('en', { month: 'short', year: '2-digit' });
      if (!acc[month]) {
        acc[month] = { month };
        dataKeys.forEach(key => (acc[month][key] = 0));
      }

      dataKeys.forEach(key => {
        if (key === transaction.type) {
            acc[month][key] = (acc[month][key] || 0) + transaction.amount;
        } else if (key === transaction.category) {
            acc[month][key] = (acc[month][key] || 0) + transaction.amount;
        }
      });
  
      return acc;
    }, {});


    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    const categoryTotals = transactions.reduce((acc, t) => {
        if (t.category) {
            const sanitizedName = sanitizeForVariableName(t.category);
            if (sanitizedName) {
                if (!acc[sanitizedName]) {
                    acc[sanitizedName] = 0;
                }
                acc[sanitizedName] += t.amount;
            }
        }
        return acc;
    }, {} as Record<string, number>);

    const kpis = {
      totalIncome,
      totalExpense,
      transactionCount: transactions.length,
      avgTransactionAmount: transactions.reduce((sum, t) => sum + t.amount, 0) / (transactions.length || 1),
      netIncome: totalIncome - totalExpense,
      savingsRate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0,
      ...categoryTotals
    };

    const monthly = Object.values(monthlyData).sort((a: any, b: any) => 
      new Date(`1 ${a.month}`).getTime() - new Date(`1 ${b.month}`).getTime()
    );
    
    if (widget.type === 'metric') {
        const formula = formulas.find(f => f.id === widget.formulaId);
        if (formula) {
            try {
                const value = safeEvaluateExpression(formula.expression, kpis);
                return { kpis, data: [{ name: formula.name, value, formula: formula.expression }] };
            } catch (error) {
                console.error(`Error evaluating formula "${formula.name}":`, error);
                return { kpis, data: [{ name: formula.name, value: null, formula: formula.expression }] };
            }
        } else if (widget.mainDataKey && kpis.hasOwnProperty(widget.mainDataKey)) {
            const value = kpis[widget.mainDataKey as keyof typeof kpis];
            return { kpis, data: [{ name: widget.title, value }] };
        }
        return { kpis, data: null };
    }
    
    return { kpis, data: monthly, dataKeys };
  }, [allTransactions, globalFilters, formulas]);

  const renderAdvancedChart = (widget: any) => {
    return (
      <ChartErrorBoundary>
        {(() => {
          const { data, kpis, dataKeys } = getWidgetData(widget);
          const theme = COLOR_THEMES[widget.colorTheme] || COLOR_THEMES.default;

          if (widget.type === 'metric') {
            if (!data || data[0]?.value === null || data[0]?.value === undefined) {
              return (
                <div className="flex h-full items-center justify-center text-muted-foreground p-4 text-center">
                  <div className="space-y-2">
                    <AlertTriangle className="h-8 w-8 mx-auto" />
                    <div>
                      {formulas.length === 0 ? (
                        <>
                          <p className="font-medium">No formulas available</p>
                          <p className="text-sm">Create a formula first in the Formula Builder</p>
                        </>
                      ) : !widget.formulaId ? (
                        <>
                          <p className="font-medium">No formula selected</p>
                          <p className="text-sm">Please select a formula for this metric card</p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium">Formula error</p>
                          <p className="text-sm">Check your formula expression</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
            
            const metric = data[0];
            const isPercentage = metric.name?.toLowerCase().includes('rate');
            const formatOptions = isPercentage 
              ? { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }
              : { style: 'currency', currency: 'USD' };
            const displayValue = isPercentage ? metric.value / 100 : metric.value;

            return (
              <div className="p-6 text-center">
                <p className="text-4xl font-bold font-mono text-primary">
                  {new Intl.NumberFormat('en-US', formatOptions).format(displayValue)}
                </p>
                <p className="text-lg font-medium mt-2">{metric.name}</p>
                {metric.formula && (
                  <p className="text-sm text-muted-foreground mt-1 font-mono">
                    {metric.formula}
                  </p>
                )}
              </div>
            );
          }

          if (!data || data.length === 0) {
            return (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                  <BarChart3 className="h-8 w-8 mx-auto" />
                  <p>No data available for this configuration.</p>
                  <p className="text-sm">Try adjusting your filters.</p>
                </div>
              </div>
            );
          }

          const chartProps = {
            margin: { top: 20, right: 30, left: 20, bottom: 20 }
          };

          const CustomTooltip = ({ active, payload, label }: any) => {
            if (!active || !payload || !payload.length) return null;
            
            return (
              <div className="bg-background p-3 border rounded-lg shadow-lg">
                <p className="font-medium">{label}</p>
                {payload.map((entry: any, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: entry.color }} 
                    />
                    <span className="text-sm capitalize">
                      {entry.name}: {new Intl.NumberFormat('en-US', { 
                        style: 'currency', 
                        currency: 'USD' 
                      }).format(entry.value)}
                    </span>
                  </div>
                ))}
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
                    {dataKeys?.map((key: string, index: number) => (
                      <Bar key={key} yAxisId="left" dataKey={key} fill={theme[index % theme.length]} name={key} />
                    ))}
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
                    <Scatter name="Data" data={data as any[]} fill={theme[0]} />
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
                    {widget.showTargetLines && (
                      <>
                        <ReferenceLine y={kpiTargets.monthlyIncome} label={{ value: "Income Target", position: 'insideTopLeft' }} stroke="green" strokeDasharray="3 3" />
                        <ReferenceLine y={kpiTargets.monthlyExpense} label={{ value: "Expense Target", position: 'insideTopLeft' }} stroke="red" strokeDasharray="3 3" />
                      </>
                    )}
                    {dataKeys?.map((key: string, index: number) => (
                      <Bar key={key} dataKey={key} fill={theme[index % theme.length]} name={key} />
                    ))}
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
                    {widget.showTargetLines && (
                      <>
                        <ReferenceLine y={kpiTargets.monthlyIncome} label={{ value: "Income Target", position: 'insideTopLeft' }} stroke="green" strokeDasharray="3 3" />
                        <ReferenceLine y={kpiTargets.monthlyExpense} label={{ value: "Expense Target", position: 'insideTopLeft' }} stroke="red" strokeDasharray="3 3" />
                      </>
                    )}
                    {dataKeys?.map((key: string, index: number) => (
                      <Line key={key} type="monotone" dataKey={key} stroke={theme[index % theme.length]} name={key} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              );

            case 'area':
              return (
                <ResponsiveContainer width="100%" height={widget.height}>
                  <AreaChart data={data as any[]} {...chartProps}>
                    {widget.showGrid && <CartesianGrid strokeDasharray="3 3" />}
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    {widget.showLegend && <Legend />}
                    {dataKeys?.map((key: string, index: number) => (
                      <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={theme[index % theme.length]} fill={theme[index % theme.length]} name={key} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              );
              
            case 'pie':
              const pieData = dataKeys.map(key => ({
                  name: key,
                  value: data.reduce((acc: number, month: any) => acc + (month[key] || 0), 0)
              })).filter(d => d.value > 0);

              return (
                <ResponsiveContainer width="100%" height={widget.height}>
                  <RechartsPieChart>
                    <Tooltip content={<CustomTooltip />} />
                    <Pie data={pieData as any[]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill={theme[0]}>
                      {(pieData as any[]).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={theme[index % theme.length]} />
                      ))}
                    </Pie>
                    {widget.showLegend && <Legend />}
                  </RechartsPieChart>
                </ResponsiveContainer>
              );

            default:
              return <div>Chart type not implemented</div>;
          }
        })()}
      </ChartErrorBoundary>
    )
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
    };
    const updatedWidgets = [...widgets, newWidget];
    setWidgets(updatedWidgets);
    saveSettingsToFirestore({ widgets: updatedWidgets });
  }, [widgets, saveSettingsToFirestore]);

  const updateWidget = useCallback((widgetId: string, updates: any) => {
    const updatedWidgets = widgets.map(w => w.id === widgetId ? { ...w, ...updates } : w);
    setWidgets(updatedWidgets);
    saveSettingsToFirestore({ widgets: updatedWidgets });
  }, [widgets, saveSettingsToFirestore]);
  
  const removeWidget = useCallback((widgetId: string) => {
    const updatedWidgets = widgets.filter(w => w.id !== widgetId);
    setWidgets(updatedWidgets);
    saveSettingsToFirestore({ widgets: updatedWidgets });
  }, [widgets, saveSettingsToFirestore]);

  const duplicateWidget = useCallback((widget: any) => {
    const newWidget = {
      ...widget,
      id: `widget-${Date.now()}`,
      title: `${widget.title} (Copy)`,
      position: widgets.length
    };
    const updatedWidgets = [...widgets, newWidget];
    setWidgets(updatedWidgets);
    saveSettingsToFirestore({ widgets: updatedWidgets });
  }, [widgets, saveSettingsToFirestore]);

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
      { value: 'netIncome', label: 'Net Income' },
      { value: 'savingsRate', label: 'Savings Rate (%)' },
      { value: 'transactionCount', label: 'Transaction Count' },
      { value: 'avgTransactionAmount', label: 'Avg. Transaction Amount' },
    ];
    userCategories.forEach(cat => {
      fields.push({ value: cat.name, label: `Category: ${cat.name}` });
      (cat.subCategories || []).forEach(sub => {
        fields.push({ value: sub.name, label: `  - ${sub.name}` });
      });
    });
    return fields;
  }, [userCategories]);
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          
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
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Formula Builder</DialogTitle>
                <DialogDescription>
                  Create custom calculations for your metric cards.
                </DialogDescription>
              </DialogHeader>
              <FormulaBuilderTabContent
                formulas={formulas}
                onAddFormula={handleAddFormula}
                onDeleteFormula={handleDeleteFormula}
                availableVariables={formulaVariables}
              />
            </DialogContent>
          </Dialog>
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
                <Label>Categories</Label>
                <SearchableMultiSelect
                    options={allCategoryOptions}
                    selected={globalFilters.categories}
                    onChange={(value) => setGlobalFilters(prev => ({...prev, categories: value}))}
                    placeholder="All Categories"
                />
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
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="widgets">Widgets</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
                <TabsTrigger value="layout">Layout</TabsTrigger>
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
                            onClick={() => setSelectedWidget(widget)}
                            title="Advanced Settings"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeWidget(widget.id)}
                            title="Remove Widget"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
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
                              value={widget.formulaId || ""}
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
                            <div className="col-span-2 lg:col-span-3">
                              <Label>Categories to Display</Label>
                              <SearchableMultiSelect
                                options={allCategoryOptions}
                                selected={widget.dataCategories || []}
                                onChange={(value: string[]) => updateWidget(widget.id, { dataCategories: value })}
                                placeholder="Select categories..."
                              />
                            </div>
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

              <TabsContent value="layout" className="space-y-4 pt-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Dashboard Layout</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Layout Style</Label>
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
                  </div>
                </div>
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
                  </div>
                </div>
              </TabsContent>
            </Tabs>
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
                    <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
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


