

"use client";

import React, { useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ComposedChart, ReferenceLine } from 'recharts';
import { AlertTriangle, BarChart2, BarChart3, Calculator, Copy, Grid, Info, List, Move, Palette, PieChart as PieChartIcon, Plus, Save, Settings, Trash2, TrendingUp, UploadCloud, X, Zap, Download, Upload } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import type { Widget, Formula } from '@/types';
import type { SavedReport } from '@/hooks/use-report-settings';
import { useToast } from '@/hooks/use-toast';


export const CHART_TYPES = {
  bar: { name: 'Bar Chart', icon: BarChart3, allowsComparison: true },
  line: { name: 'Line Chart', icon: TrendingUp, allowsComparison: true },
  area: { name: 'Area Chart', icon: BarChart3, allowsComparison: false },
  pie: { name: 'Pie Chart', icon: PieChartIcon, allowsComparison: false },
  scatter: { name: 'Scatter Plot', icon: BarChart2, allowsComparison: false },
  composed: { name: 'Combined Chart', icon: BarChart2, allowsComparison: true },
  metric: { name: 'Metric Card', icon: Calculator, allowsComparison: false },
};

export const COLOR_THEMES: Record<string, string[]> = {
  default: ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'],
  vibrant: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
  professional: ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6', '#BDC3C7'],
  warm: ['#E74C3C', '#E67E22', '#F39C12', '#F1C40F', '#D4AC0D'],
  cool: ['#3498DB', '#2980B9', '#1ABC9C', '#16A085', '#27AE60'],
  pastel: ['#FFB6C1', '#98FB98', '#87CEEB', '#DDA0DD', '#F0E68C'],
};


function MetricDebugDialog({ kpis, formula }: { kpis: Record<string, number>; formula: string; }) {
    const [isOpen, React.useState(false);
    
    let formulaVariables: string[] = [];
    if (formula) {
        try {
            const parser = new (require('expr-eval').Parser)();
            const ast = parser.parse(formula);
            formulaVariables = ast.variables();
        } catch (e) {
            console.warn("Could not parse formula for debug:", formula);
        }
    }


    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6">
            <Info className="h-4 w-4" />
            <span className="sr-only">Debug Info</span>
            </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
            <DialogTitle>Formula Debug Information</DialogTitle>
            <DialogDescription>
                These are the underlying numbers used to calculate this metric.
            </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <div>
                    <h4 className="font-medium mb-2">Formula</h4>
                    <p className="text-sm font-mono p-2 bg-muted rounded-md">{formula}</p>
                </div>
                <div>
                    <h4 className="font-medium mb-2">Available Data (KPIs)</h4>
                    {Object.keys(kpis).length === 0 && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 p-4 border border-dashed border-yellow-500/50 rounded-md">
                            ⚠️ No variables available for this formula in the current context. The formula will evaluate with all variables as 0.
                        </p>
                    )}
                    <ScrollArea className="h-72">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Variable</TableHead>
                                    <TableHead className="text-right">Value</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(kpis).sort((a,b) => a[0].localeCompare(b[0])).map(([key, value]) => (
                                    <TableRow key={key} className={cn(formulaVariables.includes(key) && "bg-primary/10")}>
                                        <TableCell className="font-mono text-xs">{key}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">
                                            {new Intl.NumberFormat('en-US', {
                                                style: 'decimal',
                                                maximumFractionDigits: 2,
                                            }).format(value)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            </div>
            <DialogFooter>
            <DialogClose asChild>
                <Button>Close</Button>
            </DialogClose>
            </DialogFooter>
        </DialogContent>
        </Dialog>
    );
}

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

function renderAdvancedChart({ widget, data, kpis, dataKeys, originalDataKeys, formulas, kpiTargets }: any) {
    return (
      <ChartErrorBoundary>
        {(() => {
          const theme = COLOR_THEMES[widget.colorTheme] || COLOR_THEMES.default;

          if (widget.type === 'metric') {
            const metric = data?.[0];
            const formula = formulas.find((f: any) => f.id === widget.formulaId);
            if (!metric || metric.value === null || typeof metric.value === 'undefined') {
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
            
            const isPercentage = metric.name?.toLowerCase().includes('rate');
            const displayValue = metric.value;

            return (
              <div className="p-6 text-center relative w-full">
                <MetricDebugDialog kpis={kpis} formula={formula?.expression || ""} />
                <p className="text-4xl font-bold font-mono text-primary">
                   {typeof displayValue === "number"
                    ? new Intl.NumberFormat("en-US", isPercentage ? {style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1} : {style: 'currency', currency: 'USD'}).format(displayValue)
                    : "--"}
                </p>
                <p className="text-lg font-medium mt-2">{metric?.name}</p>
                {formula?.expression && (
                  <p className="text-sm text-muted-foreground mt-1 font-mono">
                    {formula.expression}
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
                {payload.map((entry: any, index: number) => {
                    const originalName = originalDataKeys[dataKeys.indexOf(entry.dataKey)] || entry.name;
                    return (
                        <div key={index} className="flex items-center gap-2">
                            <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: entry.color }} 
                            />
                            <span className="text-sm capitalize">
                            {originalName}: {new Intl.NumberFormat('en-US', { 
                                style: 'currency', 
                                currency: 'USD' 
                            }).format(entry.value)}
                            </span>
                        </div>
                    )
                })}
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
                      <Bar key={key} yAxisId="left" dataKey={key} fill={theme[index % theme.length]} name={originalDataKeys[index]} />
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
                      <Bar key={key} dataKey={key} fill={theme[index % theme.length]} name={originalDataKeys[index]} />
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
                        <ReferenceLine y={kpiTargets.monthlyIncome} label={{ value: "Income Target", position: 'insideTopLeft' }} stroke="green" strokeDasharray="3.3" />
                        <ReferenceLine y={kpiTargets.monthlyExpense} label={{ value: "Expense Target", position: 'insideTopLeft' }} stroke="red" strokeDasharray="3 3" />
                      </>
                    )}
                    {dataKeys?.map((key: string, index: number) => (
                      <Line key={key} type="monotone" dataKey={key} stroke={theme[index % theme.length]} name={originalDataKeys[index]} />
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
                      <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={theme[index % theme.length]} fill={theme[index % theme.length]} name={originalDataKeys[index]} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              );
              
            case 'pie':
              const pieData = (dataKeys || []).map((key: string, index: number) => ({
                  name: originalDataKeys[index],
                  value: (data || []).reduce((acc: number, month: any) => acc + (month[key] || 0), 0)
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

export function WidgetCard({ widget, getWidgetData, layout }: { widget: Widget, getWidgetData: any, layout: string }) {
    const { data, kpis, dataKeys, originalDataKeys, formulas, kpiTargets } = getWidgetData(widget);
    const sizeClasses = {
        small: layout === 'grid' ? 'md:col-span-1' : '',
        medium: layout === 'grid' ? 'md:col-span-1' : '',
        large: layout === 'grid' ? 'md:col-span-2' : ''
    };

    return (
        <Card
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
                {renderAdvancedChart({ widget, data, kpis, dataKeys, originalDataKeys, formulas, kpiTargets })}
            </CardContent>
        </Card>
    );
}

interface WidgetConfigurationProps {
  widgets: Widget[];
  savedReports: SavedReport[];
  formulas: Formula[];
  layout: string;
  isSaveDialogOpen: boolean;
  newReportName: string;
  onAddWidget: () => void;
  onUpdateWidget: (id: string, updates: Partial<Widget>) => void;
  onRemoveWidget: (id: string) => void;
  onDuplicateWidget: (widget: Widget) => void;
  onSetSelectedWidget: (widget: Widget | null) => void;
  onSaveReport: () => void;
  onLoadReport: (report: SavedReport) => void;
  onDeleteReport: (id: string) => void;
  onSetLayout: (layout: string) => void;
  setIsSaveDialogOpen: (isOpen: boolean) => void;
  setNewReportName: (name: string) => void;
}


WidgetCard.Configuration = function WidgetConfiguration({
    widgets,
    savedReports,
    formulas,
    layout,
    isSaveDialogOpen,
    newReportName,
    onAddWidget,
    onUpdateWidget,
    onRemoveWidget,
    onDuplicateWidget,
    onSetSelectedWidget,
    onSaveReport,
    onLoadReport,
    onDeleteReport,
    onSetLayout,
    setIsSaveDialogOpen,
    setNewReportName,
}: WidgetConfigurationProps) {
    const { toast } = useToast();
    const importInputRef = useRef<HTMLInputElement>(null);

    const handleExport = () => {
        const dataStr = JSON.stringify({ widgets, layout }, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = 'report.json';
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("Invalid file content");
                
                const importedData = JSON.parse(text);
                if (Array.isArray(importedData.widgets) && typeof importedData.layout === 'string') {
                    onUpdateWidget('all', importedData.widgets); // Special action to replace all widgets
                    onSetLayout(importedData.layout);
                    toast({ title: "Import Successful", description: "Report layout has been loaded." });
                } else {
                    throw new Error("JSON is missing 'widgets' array or 'layout' string.");
                }
            } catch (err: any) {
                toast({ variant: 'destructive', title: "Import Failed", description: err.message });
            }
        };
        reader.readAsText(file);

        // Reset file input
        if(event.target) event.target.value = '';
    };

    return (
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
                                    <Button onClick={onSaveReport}>Save Report</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Button size="sm" onClick={onAddWidget}>
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
                                    <Checkbox checked={widget.enabled} onCheckedChange={(checked) => onUpdateWidget(widget.id, { enabled: !!checked })} />
                                    <Input value={widget.title} onChange={(e) => onUpdateWidget(widget.id, { title: e.target.value })} className="font-medium" />
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => onDuplicateWidget(widget)} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => onSetSelectedWidget(widget)} title="Advanced Settings"><Settings className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => onRemoveWidget(widget.id)} title="Remove Widget"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <Label>Chart Type</Label>
                                    <Select value={widget.type} onValueChange={(value) => onUpdateWidget(widget.id, { type: value, formulaId: value === 'metric' ? (formulas[0]?.id || null) : null })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{Object.entries(CHART_TYPES).map(([key, type]) => (<SelectItem key={key} value={key}>{type.name}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                                {widget.type === 'metric' ? (
                                    <div>
                                        <Label>Formula</Label>
                                        <Select value={widget.formulaId || ""} onValueChange={(value) => onUpdateWidget(widget.id, { formulaId: value })} disabled={formulas.length === 0}>
                                            <SelectTrigger><SelectValue placeholder="Select a formula" /></SelectTrigger>
                                            <SelectContent>{formulas.map((f) => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}</SelectContent>
                                        </Select>
                                    </div>
                                ) : (
                                    <>
                                        <div className="col-span-2 lg:col-span-3"><Label>Categories to Display</Label></div>
                                        <div>
                                            <Label>Height (px)</Label>
                                            <Input type="number" value={widget.height} onChange={(e) => onUpdateWidget(widget.id, { height: parseInt(e.target.value) || 300 })} min={200} max={800} />
                                        </div>
                                    </>
                                )}
                            </div>
                            {widget.type !== 'metric' && (
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center space-x-4">
                                        <div className="flex items-center space-x-2"><Switch checked={widget.showLegend} onCheckedChange={(checked) => onUpdateWidget(widget.id, { showLegend: !!checked })} /><Label>Show Legend</Label></div>
                                        <div className="flex items-center space-x-2"><Switch checked={widget.showGrid} onCheckedChange={(checked) => onUpdateWidget(widget.id, { showGrid: !!checked })} /><Label>Show Grid</Label></div>
                                    </div>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            </TabsContent>
            
            <TabsContent value="templates" className="space-y-4 pt-4">
                <h3 className="text-lg font-medium">Saved Reports</h3>
                {savedReports.length === 0 ? (<p className="text-sm text-muted-foreground">You have no saved reports.</p>) : (
                    <div className="space-y-2">
                        {savedReports.map((report) => (
                            <div key={report.id} className="flex items-center justify-between p-2 border rounded-md">
                                <span className="font-medium">{report.name}</span>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => onLoadReport(report)}><UploadCloud className="h-4 w-4 mr-2" /> Load</Button>
                                    <Button size="sm" variant="destructive" onClick={() => onDeleteReport(report.id)}><Trash2 className="h-4 w-4" /></Button>
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
                                <Button variant={layout === 'grid' ? 'default' : 'outline'} size="sm" onClick={() => onSetLayout('grid')}><Grid className="h-4 w-4 mr-2" />Grid</Button>
                                <Button variant={layout === 'list' ? 'default' : 'outline'} size="sm" onClick={() => onSetLayout('list')}><List className="h-4 w-4 mr-2" />List</Button>
                            </div>
                        </div>
                    </div>
                </div>
            </TabsContent>
            
            <TabsContent value="export" className="space-y-4 pt-4">
                 <h3 className="text-lg font-medium">Import / Export Report</h3>
                 <p className="text-sm text-muted-foreground">Save your current report configuration to a file or load one from your disk.</p>
                 <div className="flex gap-4">
                    <Button onClick={handleExport} variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export Report
                    </Button>
                     <Button onClick={() => importInputRef.current?.click()} variant="outline">
                        <Upload className="mr-2 h-4 w-4" />
                        Import Report
                    </Button>
                    <input 
                        type="file" 
                        ref={importInputRef} 
                        className="hidden" 
                        accept=".json"
                        onChange={handleImport}
                    />
                 </div>
            </TabsContent>
        </Tabs>
    );
};
