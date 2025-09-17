
'use client';

import React, { useState, useMemo, useRef } from 'react';
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
  PieChart, 
  TrendingUp,
  Grid,
  List,
  Calendar,
  Filter,
  Plus,
  X
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line,
  PieChart as RechartsPieChart,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer
} from 'recharts';

// Mock data - replace with your actual data
const mockTransactions = [
  { id: 1, amount: 1200, category: 'Salary', type: 'income', date: '2024-01-15' },
  { id: 2, amount: 800, category: 'Food', type: 'expense', date: '2024-01-16' },
  { id: 3, amount: 300, category: 'Transportation', type: 'expense', date: '2024-01-17' },
  { id: 4, amount: 150, category: 'Entertainment', type: 'expense', date: '2024-01-18' },
  { id: 5, amount: 2000, category: 'Salary', type: 'income', date: '2024-02-15' },
  { id: 6, amount: 900, category: 'Food', type: 'expense', date: '2024-02-16' },
];

const CHART_TYPES = {
  bar: { name: 'Bar Chart', icon: BarChart3, component: 'BarChart' },
  line: { name: 'Line Chart', icon: TrendingUp, component: 'LineChart' },
  area: { name: 'Area Chart', icon: BarChart3, component: 'AreaChart' },
  pie: { name: 'Pie Chart', icon: PieChart, component: 'PieChart' }
};

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

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

export default function CustomizableReports() {
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [savedReports, setSavedReports] = useState([
    { id: 1, name: 'Monthly Overview', widgets: DEFAULT_WIDGETS },
    { id: 2, name: 'Expense Analysis', widgets: DEFAULT_WIDGETS.filter(w => w.id !== 'balance-trend') }
  ]);
  const [newReportName, setNewReportName] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [layout, setLayout] = useState('grid');
  const reportRef = useRef(null);

  // Process data for different chart types
  const processedData = useMemo(() => {
    const monthlyData = mockTransactions.reduce((acc, transaction) => {
      const month = new Date(transaction.date).toLocaleDateString('en', { month: 'short' });
      if (!acc[month]) {
        acc[month] = { month, income: 0, expense: 0 };
      }
      acc[month][transaction.type] += transaction.amount;
      return acc;
    }, {});

    const categoryData = mockTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, transaction) => {
        if (!acc[transaction.category]) {
          acc[transaction.category] = 0;
        }
        acc[transaction.category] += transaction.amount;
        return acc;
      }, {});

    let runningBalance = 0;
    const balanceData = Object.values(monthlyData).map(month => {
      runningBalance += month.income - month.expense;
      return { ...month, balance: runningBalance };
    });

    return {
      monthly: Object.values(monthlyData),
      category: Object.entries(categoryData).map(([name, value], index) => ({
        name,
        value,
        fill: CHART_COLORS[index % CHART_COLORS.length]
      })),
      balance: balanceData
    };
  }, []);

  const renderChart = (widget) => {
    const data = processedData[widget.dataKey];
    
    switch (widget.type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="income" fill="#82ca9d" />
              <Bar dataKey="expense" fill="#ff7c7c" />
            </BarChart>
          </ResponsiveContainer>
        );
      
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#82ca9d" />
              <Line type="monotone" dataKey="expense" stroke="#ff7c7c" />
            </LineChart>
          </ResponsiveContainer>
        );
      
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} accessibilityLayer role="img" aria-label="Balance trend over time">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="balance" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        );
      
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <RechartsPieChart data={data} cx="50%" cy="50%" outerRadius={80}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </RechartsPieChart>
              <Tooltip />
              <Legend />
            </RechartsPieChart>
          </ResponsiveContainer>
        );
      
      default:
        return <div>Unsupported chart type</div>;
    }
  };

  const updateWidget = (widgetId, updates) => {
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

  const removeWidget = (widgetId) => {
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

  const loadReport = (report) => {
    setWidgets(report.widgets);
    setSelectedReport(report);
  };

  const enabledWidgets = widgets.filter(w => w.enabled).sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Customizable Reports</h2>
          <p className="text-gray-600">Design your perfect financial dashboard</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setLayout(layout === 'grid' ? 'list' : 'grid')}
          >
            {layout === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
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

      {/* Customization Panel */}
      {isCustomizing && (
        <Card>
          <CardHeader>
            <CardTitle>Report Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="widgets" className="w-full">
              <TabsList>
                <TabsTrigger value="widgets">Widgets</TabsTrigger>
                <TabsTrigger value="layout">Layout</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
              </TabsList>
              
              <TabsContent value="widgets" className="space-y-4">
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
                            checked={widget.enabled}
                            onCheckedChange={(checked) =>
                              updateWidget(widget.id, { enabled: checked })
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
                          size="sm"
                          onClick={() => removeWidget(widget.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
              
              <TabsContent value="layout" className="space-y-4">
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
              
              <TabsContent value="templates" className="space-y-4">
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
                        <Button onClick={saveReport} disabled={!newReportName.trim()}>
                          Save Report
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <div className="grid gap-2">
                  {savedReports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{report.name}</h4>
                        <p className="text-sm text-gray-600">
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
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-blue-800 font-medium">
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

        <div className={`grid gap-6 ${
          layout === 'grid' 
            ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' 
            : 'grid-cols-1'
        }`}>
          {enabledWidgets.map((widget) => {
            const sizeClasses = {
              small: layout === 'grid' ? 'lg:col-span-1' : '',
              medium: layout === 'grid' ? 'lg:col-span-1' : '',
              large: layout === 'grid' ? 'lg:col-span-2' : ''
            };

            return (
              <Card key={widget.id} className={sizeClasses[widget.size]}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {widget.title}
                    <Badge variant="outline">
                      {CHART_TYPES[widget.type]?.name}
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
      </div>
    </div>
  );
}
