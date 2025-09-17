
'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useUserData } from '@/hooks/use-user-data';
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
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
  ResponsiveContainer
} from 'recharts';
import { useAuth } from '@/hooks/use-auth';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';
import type { Category, SubCategory } from '@/types';


const CHART_TYPES = {
  bar: { name: 'Bar Chart', icon: BarChart3 },
  line: { name: 'Line Chart', icon: TrendingUp },
  area: { name: 'Area Chart', icon: BarChart3 },
  pie: { name: 'Pie Chart', icon: PieChartIcon }
};

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#a4de6c', '#d0ed57', '#ffc0cb'];

const DEFAULT_WIDGETS = [
  {
    id: 'income-expense',
    title: 'Income vs Expense',
    type: 'bar',
    size: 'large',
    dataKey: 'monthly',
    enabled: true,
    position: 0
  },
  {
    id: 'category-breakdown',
    title: 'Category Breakdown',
    type: 'pie',
    size: 'medium',
    dataKey: 'category',
    enabled: true,
    position: 1
  },
  {
    id: 'balance-trend',
    title: 'Balance Trend',
    type: 'area',
    size: 'large',
    dataKey: 'balance',
    enabled: true,
    position: 2
  }
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col space-y-1">
            <span className="text-[0.7rem] uppercase text-muted-foreground">
              {label || payload[0].name}
            </span>
            <span className="font-bold text-foreground">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(payload[0].value)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default function CustomizableReports() {
  const { allTransactions, categories: userCategories } = useUserData();
  const { user } = useAuth();
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [savedReports, setSavedReports] = useState([
    { id: 1, name: 'Monthly Overview', widgets: DEFAULT_WIDGETS },
    { id: 2, name: 'Expense Analysis', widgets: DEFAULT_WIDGETS.filter(w => w.id !== 'balance-trend') }
  ]);
  const [newReportName, setNewReportName] = useState('');
  const [selectedReport, setSelectedReport] = useState<{ id: number, name: string, widgets: any[] } | null>(null);
  const [layout, setLayout] = useState('grid');
  const reportRef = useRef(null);

  // Filter states
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date()
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [startingBalance, setStartingBalance] = useState(0);

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

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      const inDateRange = dateRange?.from && dateRange?.to ? 
        (transactionDate >= dateRange.from && transactionDate <= dateRange.to) : true;
      
      const inCategory = selectedCategories.length > 0 ? selectedCategories.includes(t.category) : true;
      
      return inDateRange && inCategory;
    });
  }, [allTransactions, dateRange, selectedCategories]);


  // Process data for different chart types
  const processedData = useMemo(() => {
    if (filteredTransactions.length === 0) {
      return { monthly: [], category: [], totalExpense: 0 };
    }
    
    // Monthly data for income vs expense
    const monthlyData: { [key: string]: { month: string; income: number; expense: number } } = {};
    filteredTransactions.forEach(transaction => {
      const month = new Date(transaction.date).toLocaleDateString('en', { month: 'short', year: '2-digit' });
      if (!monthlyData[month]) {
        monthlyData[month] = { month, income: 0, expense: 0 };
      }
      monthlyData[month][transaction.type] += transaction.amount;
    });

    // --- Category data for major categories ---
    const findParentCategory = (subCategoryName: string): Category | null => {
        for (const parent of userCategories) {
            if (parent.name === subCategoryName) {
                return parent; // It's a parent category itself
            }
            if (parent.subCategories?.some(sub => sub.name === subCategoryName)) {
                return parent;
            }
        }
        return null;
    };

    const categoryTotals: { [key: string]: number } = {};
    filteredTransactions
      .filter(t => t.type === 'expense' && t.category)
      .forEach(transaction => {
        const parentCategory = findParentCategory(transaction.category);
        const parentName = parentCategory?.name || 'Uncategorized';
        if (!categoryTotals[parentName]) {
          categoryTotals[parentName] = 0;
        }
        categoryTotals[parentName] += transaction.amount;
      });
    
    const totalExpense = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

    const sortedCategories = Object.entries(categoryTotals)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    let categoryData;
    const MAX_PIE_SLICES = 7;
    if (sortedCategories.length > MAX_PIE_SLICES) {
        const mainSlices = sortedCategories.slice(0, MAX_PIE_SLICES - 1);
        const otherSliceValue = sortedCategories.slice(MAX_PIE_SLICES - 1).reduce((sum, cat) => sum + cat.value, 0);
        categoryData = [...mainSlices, { name: 'Other', value: otherSliceValue }];
    } else {
        categoryData = sortedCategories;
    }

    const sortedMonths = Object.values(monthlyData).sort((a,b) => new Date(`1 ${a.month}`).getTime() - new Date(`1 ${b.month}`).getTime());
    
    return {
      monthly: sortedMonths,
      category: categoryData.map((item, index) => ({
        ...item,
        fill: CHART_COLORS[index % CHART_COLORS.length]
      })),
      totalExpense
    };
  }, [filteredTransactions, userCategories]);

  const renderChart = (widget: any) => {
    let data;

    if (widget.dataKey === 'balance') {
      const balanceStartDate = dateRange?.from || new Date(Math.min(...allTransactions.map(t => new Date(t.date).getTime())));
      const initialBalance = allTransactions
        .filter(t => new Date(t.date) < balanceStartDate)
        .reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), startingBalance);
      
      let runningBalance = initialBalance;
      data = processedData.monthly.map(monthData => {
        runningBalance += monthData.income - monthData.expense;
        return { month: monthData.month, balance: runningBalance };
      });
    } else {
      data = processedData[widget.dataKey as keyof typeof processedData];
    }
    
    if (!data || data.length === 0) {
      return <div className="flex h-[300px] items-center justify-center text-muted-foreground">No data available for this chart.</div>;
    }

    switch (widget.type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => `$${value}`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="income" fill="hsl(var(--chart-1))" name="Income" />
              <Bar dataKey="expense" fill="hsl(var(--chart-2))" name="Expense" />
            </BarChart>
          </ResponsiveContainer>
        );
      
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => `$${value}`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="hsl(var(--chart-1))" name="Income" />
              <Line type="monotone" dataKey="expense" stroke="hsl(var(--chart-2))" name="Expense" />
            </LineChart>
          </ResponsiveContainer>
        );
      
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} accessibilityLayer role="img" aria-label="Balance trend over time">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => `$${value}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="balance" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} name="Balance" />
            </AreaChart>
          </ResponsiveContainer>
        );
      
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Tooltip content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0];
                  const percentage = ((data.value / processedData.totalExpense) * 100).toFixed(2);
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <p className="text-sm font-medium">{`${data.name}: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(data.value)} (${percentage}%)`}</p>
                    </div>
                  );
                }
                return null;
              }} />
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                  const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                  const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                  return (
                    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-bold">
                      {`${(percent * 100).toFixed(0)}%`}
                    </text>
                  );
                }}>
                {(data as any[]).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={10} wrapperStyle={{fontSize: '12px'}}/>
            </RechartsPieChart>
          </ResponsiveContainer>
        );
      
      default:
        return <div>Unsupported chart type</div>;
    }
  };

  const updateWidget = (widgetId: string, updates: any) => {
    setWidgets(widgets.map(w => 
      w.id === widgetId ? { ...w, ...updates } : w
    ));
  };

  const addWidget = () => {
    const newWidget = {
      id: `widget-${Date.now()}`,
      title: 'New Widget',
      type: 'bar',
      size: 'medium',
      dataKey: 'monthly',
      enabled: true,
      position: widgets.length
    };
    setWidgets([...widgets, newWidget]);
  };

  const removeWidget = (widgetId: string) => {
    setWidgets(widgets.filter(w => w.id !== widgetId));
  };

  const saveReport = () => {
    if (!newReportName.trim()) return;
    
    const newReport = {
      id: Date.now(),
      name: newReportName,
      widgets: [...widgets]
    };
    
    setSavedReports([...savedReports, newReport]);
    setNewReportName('');
  };

  const loadReport = (report: any) => {
    setWidgets(report.widgets);
    setSelectedReport(report);
  };

  const enabledWidgets = widgets.filter(w => w.enabled).sort((a, b) => a.position - b.position);

  const resetFilters = useCallback(() => {
    setDateRange({ from: subDays(new Date(), 29), to: new Date() });
    setSelectedCategories([]);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight font-headline">Customizable Reports</h2>
          <p className="text-muted-foreground">Design your perfect financial dashboard.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setLayout(layout === 'grid' ? 'list' : 'grid')}
          >
            {layout === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </Button>
          <Button
            variant={isCustomizing ? "default" : "outline"}
            onClick={() => setIsCustomizing(!isCustomizing)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Customize
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5"/> Report Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          <div className="flex flex-col gap-2">
              <Label>Date Range</Label>
               <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
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
          </div>
          <div className="flex flex-col gap-2 lg:col-span-2">
            <Label>Categories</Label>
            <MultiSelect
              options={allCategoryOptions}
              selected={selectedCategories}
              onChange={setSelectedCategories}
              placeholder="All categories"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customization Panel */}
      {isCustomizing && (
        <Card>
          <CardHeader>
            <CardTitle>Report Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="widgets" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="widgets">Widgets</TabsTrigger>
                <TabsTrigger value="layout">Layout</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
              </TabsList>
              
              <TabsContent value="widgets" className="space-y-4 pt-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Manage Widgets</h3>
                  <Button size="sm" onClick={addWidget}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Widget
                  </Button>
                </div>
                
                <div className="grid gap-4">
                  {widgets.map((widget) => (
                    <Card key={widget.id} className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`enabled-${widget.id}`}
                            checked={widget.enabled}
                            onCheckedChange={(checked) =>
                              updateWidget(widget.id, { enabled: !!checked })
                            }
                          />
                          <Input
                            value={widget.title}
                            onChange={(e) =>
                              updateWidget(widget.id, { title: e.target.value })
                            }
                            className="font-medium"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeWidget(widget.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <Label>Chart Type</Label>
                          <Select
                            value={widget.type}
                            onValueChange={(value) =>
                              updateWidget(widget.id, { type: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(CHART_TYPES).map(([key, type]) => (
                                <SelectItem key={key} value={key}>
                                  {type.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label>Size</Label>
                          <Select
                            value={widget.size}
                            onValueChange={(value) =>
                              updateWidget(widget.id, { size: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="small">Small</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="large">Large</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label>Data Source</Label>
                          <Select
                            value={widget.dataKey}
                            onValueChange={(value) =>
                              updateWidget(widget.id, { dataKey: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly Data</SelectItem>
                              <SelectItem value="category">Category Data</SelectItem>
                              <SelectItem value="balance">Balance Data</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="layout" className="space-y-4 pt-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Layout Options</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant={layout === 'grid' ? 'default' : 'outline'}
                      onClick={() => setLayout('grid')}
                    >
                      <Grid className="h-4 w-4 mr-2" />
                      Grid Layout
                    </Button>
                    <Button
                      variant={layout === 'list' ? 'default' : 'outline'}
                      onClick={() => setLayout('list')}
                    >
                      <List className="h-4 w-4 mr-2" />
                      List Layout
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="templates" className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Saved Reports</h3>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Save className="h-4 w-4 mr-2" />
                        Save Current
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Save Report Template</DialogTitle>
                        <DialogDescription>
                          Give your custom report a name to save it for later use.
                        </DialogDescription>
                      </DialogHeader>
                      <div>
                        <Label htmlFor="report-name">Report Name</Label>
                        <Input
                          id="report-name"
                          value={newReportName}
                          onChange={(e) => setNewReportName(e.target.value)}
                          placeholder="My Custom Report"
                        />
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button onClick={saveReport} disabled={!newReportName.trim()}>
                            Save Report
                          </Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <div className="grid gap-2">
                  {savedReports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{report.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {report.widgets.filter(w => w.enabled).length} widgets
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadReport(report)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Load
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Report Display */}
      <div ref={reportRef}>
        {selectedReport && (
          <div className="mb-4 p-3 bg-primary/5 border-primary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-primary font-medium">
                Viewing: {selectedReport.name}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedReport(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        {enabledWidgets.length === 0 ? (
           <Card className="flex flex-col items-center justify-center py-12">
             <CardHeader className="text-center">
                <PieChartIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                <CardTitle className="mt-4">No Widgets Enabled</CardTitle>
                <CardDescription>Enable some widgets in the customization panel to see your report.</CardDescription>
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
            layout === 'grid' 
              ? 'grid-cols-1 md:grid-cols-2' 
              : 'grid-cols-1'
          }`}>
            {enabledWidgets.map((widget) => {
              const sizeClasses = {
                small: layout === 'grid' ? 'md:col-span-1' : '',
                medium: layout === 'grid' ? 'md:col-span-1' : '',
                large: layout === 'grid' ? 'md:col-span-2' : ''
              };

              return (
                <Card key={widget.id} className={sizeClasses[widget.size as keyof typeof sizeClasses]}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {widget.title}
                      <Badge variant="outline">
                        {CHART_TYPES[widget.type as keyof typeof CHART_TYPES]?.name}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderChart(widget)}
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
