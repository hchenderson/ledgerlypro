
'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useUserData } from '@/hooks/use-user-data';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc } from 'firebase/firestore';
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
  BarChart2
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
  ComposedChart
} from 'recharts';
import type { Category, SubCategory } from '@/types';
import { DateRange } from 'react-day-picker';
import { subDays, format } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';


const CHART_TYPES = {
  bar: { name: 'Bar Chart', icon: BarChart3, allowsComparison: true },
  line: { name: 'Line Chart', icon: TrendingUp, allowsComparison: true },
  area: { name: 'Area Chart', icon: BarChart3, allowsComparison: false },
  pie: { name: 'Pie Chart', icon: PieChartIcon, allowsComparison: false },
  scatter: { name: 'Scatter Plot', icon: BarChart2, allowsComparison: false },
  composed: { name: 'Combined Chart', icon: BarChart2, allowsComparison: true }
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

export default function AdvancedCustomizableReports() {
  const { allTransactions, categories: userCategories } = useUserData();
  const { user } = useAuth();
  const [startingBalance, setStartingBalance] = useState(0);

  const [widgets, setWidgets] = useState([
    {
      id: 'income-expense',
      title: 'Income vs Expense',
      type: 'bar',
      size: 'large',
      dataKey: 'monthly',
      enabled: true,
      position: 0,
      colorTheme: 'default',
      showLegend: true,
      showGrid: true,
      height: 300,
      aggregation: 'sum',
      timePeriod: 'monthly',
      comparison: null,
      customFilters: [],
      annotations: []
    }
  ]);

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
  
  React.useEffect(() => {
    if (user) {
      const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'main');
      getDoc(settingsDocRef).then(docSnap => {
        if (docSnap.exists()) {
          setStartingBalance(docSnap.data().startingBalance || 0);
        }
      });
    }
  }, [user]);

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

    return {
      monthly: Object.values(monthlyData).sort((a, b) => new Date(`1 ${a.month}`).getTime() - new Date(`1 ${b.month}`).getTime()),
      categories: Object.entries(categoryTrends).map(([category, months]) => ({
        category,
        total: Object.values(months).reduce((sum, val) => sum + val, 0),
        trend: Object.entries(months),
        avgMonthly: Object.values(months).reduce((sum, val) => sum + val, 0) / Object.keys(months).length
      })),
      kpis: {
        totalIncome: filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
        totalExpense: filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
        transactionCount: filtered.length,
        avgTransactionAmount: filtered.reduce((sum, t) => sum + t.amount, 0) / (filtered.length || 1)
      }
    };
  }, [globalFilters, allTransactions]);

  const renderAdvancedChart = (widget: any) => {
    const theme = COLOR_THEMES[widget.colorTheme] || COLOR_THEMES.default;
    const data = processedData[widget.dataKey === 'category' ? 'categories' : 'monthly' as keyof typeof processedData];

    if (!data || data.length === 0) {
      return (
        <div className="flex h-[300px] items-center justify-center text-muted-foreground">
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
      const targetKey = `monthly${payload[0].dataKey?.charAt(0).toUpperCase() + payload[0].dataKey?.slice(1)}`;
      const target = kpiTargets[targetKey as keyof typeof kpiTargets];

      return (
        <div className="bg-background p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-sm">
                {entry.name}: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(entry.value)}
              </span>
              {target && (
                <Badge variant={entry.value >= target ? 'default' : 'secondary'}>
                  {((entry.value / target) * 100).toFixed(0)}% of target
                </Badge>
              )}
            </div>
          ))}
          {data.savingsRate !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              Savings Rate: {data.savingsRate.toFixed(1)}%
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
              <Bar yAxisId="left" dataKey="income" fill={theme[0]} name="Income" />
              <Bar yAxisId="left" dataKey="expense" fill={theme[1]} name="Expense" />
              <Line yAxisId="right" type="monotone" dataKey="savingsRate" stroke={theme[2]} name="Savings Rate %" />
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
              <Bar dataKey="income" fill={theme[0]} name="Income" />
              <Bar dataKey="expense" fill={theme[1]} name="Expense" />
              {widget.comparison && (
                <Bar dataKey={widget.comparison} fill={theme[2]} name="Comparison" />
              )}
            </BarChart>
          </ResponsiveContainer>
        );

      default:
        return <div>Chart type not implemented</div>;
    }
  };

  const addWidget = useCallback(() => {
    const newWidget = {
      id: `widget-${Date.now()}`,
      title: 'New Widget',
      type: 'bar',
      size: 'medium',
      dataKey: 'monthly',
      enabled: true,
      position: widgets.length,
      colorTheme: 'default',
      showLegend: true,
      showGrid: true,
      height: 300,
      aggregation: 'sum',
      timePeriod: 'monthly',
      comparison: null,
      customFilters: [],
      annotations: []
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


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Advanced Reports</h2>
          <p className="text-muted-foreground">Create powerful, interactive financial dashboards</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            <Target className="h-4 w-4 mr-2" />
            KPI Targets
          </Button>
          <Button variant="outline" size="sm">
            <Calculator className="h-4 w-4 mr-2" />
            Formula Builder
          </Button>
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
            Global Filters & KPIs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            
            <div className="space-y-2">
              <Label>Monthly Income Target</Label>
              <Input
                type="number"
                value={kpiTargets.monthlyIncome}
                onChange={(e) => setKpiTargets(prev => ({ 
                  ...prev, 
                  monthlyIncome: parseInt(e.target.value) || 0 
                }))}
                placeholder="5000"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Savings Rate Target (%)</Label>
              <Input
                type="number"
                value={kpiTargets.savingsRate}
                onChange={(e) => setKpiTargets(prev => ({ 
                  ...prev, 
                  savingsRate: parseInt(e.target.value) || 0 
                }))}
                placeholder="40"
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
                <TabsTrigger value="styling">Styling</TabsTrigger>
                <TabsTrigger value="formulas">Formulas</TabsTrigger>
                <TabsTrigger value="export">Export</TabsTrigger>
              </TabsList>
              
              <TabsContent value="widgets" className="space-y-4 pt-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Widget Management</h3>
                  <div className="flex gap-2">
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
                            onValueChange={(value) => updateWidget(widget.id, { type: value })}
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
                        
                        <div>
                          <Label>Color Theme</Label>
                          <Select
                            value={widget.colorTheme}
                            onValueChange={(value) => updateWidget(widget.id, { colorTheme: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(COLOR_THEMES).map(theme => (
                                <SelectItem key={theme} value={theme}>
                                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label>Aggregation</Label>
                          <Select
                            value={widget.aggregation}
                            onValueChange={(value) => updateWidget(widget.id, { aggregation: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(DATA_AGGREGATIONS).map(([key, value]) => (
                                <SelectItem key={key} value={key}>{value}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                      </div>
                      
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
                    </Card>
                  ))}
                </div>
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
                <div>
                  <h3 className="text-lg font-medium">Custom Calculations</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create custom metrics using formulas (e.g., "income - expense", "savings_rate * 100")
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label>Formula Name</Label>
                      <Input placeholder="Net Worth Growth" />
                    </div>
                    <div>
                      <Label>Formula Expression</Label>
                      <Textarea 
                        placeholder="(current_balance - starting_balance) / starting_balance * 100"
                        rows={3}
                      />
                    </div>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Formula
                    </Button>
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
                  className={`${sizeClasses[widget.size as keyof typeof sizeClasses]} transition-all duration-200 hover:shadow-md`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between">
                      <span>{widget.title}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {CHART_TYPES[widget.type as keyof typeof CHART_TYPES]?.name}
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
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

    