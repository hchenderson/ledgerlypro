
// Enhanced customization components for the reports system

import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Tabs, TabsContent, TabsList, TabsTrigger, Switch, Slider, Textarea,
  Card, CardContent, CardHeader, CardTitle, Badge, Separator
} from '@/components/ui';
import { 
  Palette, Type, BarChart3, Settings, Plus, Trash2, Move,
  Eye, EyeOff, Grid, List, Download, Save, Upload, RefreshCw
} from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { MultiSelect } from '../ui/multi-select';

// Enhanced Widget Customization Dialog
export function AdvancedWidgetCustomizer({ 
  widget, 
  onUpdate, 
  onClose, 
  allCategoryOptions,
  availableDataFields 
}: {
  widget: any | null;
  onUpdate: (id: string, updates: any) => void;
  onClose: () => void;
  allCategoryOptions: { value: string; label: string }[];
  availableDataFields: { value: string; label: string }[];
}) {
  const [localWidget, setLocalWidget] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('data');

  useEffect(() => {
    if (widget) {
      setLocalWidget({ ...widget });
    }
  }, [widget]);

  if (!widget || !localWidget) return null;

  const handleLocalUpdate = (updates: any) => {
    setLocalWidget(prev => ({ ...prev, ...updates }));
  };

  const handleSave = () => {
    onUpdate(widget.id, localWidget);
    onClose();
  };

  return (
    <Dialog open={!!widget} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Customize: {localWidget.title}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="filters">Filters</TabsTrigger>
            <TabsTrigger value="annotations">Annotations</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* Data Configuration Tab */}
          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Data Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Chart Type</Label>
                    <Select
                      value={localWidget.type}
                      onValueChange={(value) => handleLocalUpdate({ type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bar">Bar Chart</SelectItem>
                        <SelectItem value="line">Line Chart</SelectItem>
                        <SelectItem value="area">Area Chart</SelectItem>
                        <SelectItem value="pie">Pie Chart</SelectItem>
                        <SelectItem value="scatter">Scatter Plot</SelectItem>
                        <SelectItem value="composed">Combined Chart</SelectItem>
                        <SelectItem value="metric">Metric Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Primary Data Field</Label>
                    <Select
                      value={localWidget.mainDataKey}
                      onValueChange={(value) => handleLocalUpdate({ mainDataKey: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDataFields.map(field => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Secondary Data Field (Optional)</Label>
                    <Select
                      value={localWidget.comparisonKey || 'none'}
                      onValueChange={(value) => handleLocalUpdate({ 
                        comparisonKey: value === 'none' ? null : value 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {availableDataFields.map(field => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Data Aggregation</Label>
                    <Select
                      value={localWidget.aggregation || 'sum'}
                      onValueChange={(value) => handleLocalUpdate({ aggregation: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sum">Sum</SelectItem>
                        <SelectItem value="average">Average</SelectItem>
                        <SelectItem value="count">Count</SelectItem>
                        <SelectItem value="max">Maximum</SelectItem>
                        <SelectItem value="min">Minimum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Time Period Grouping</Label>
                  <Select
                    value={localWidget.timePeriod || 'monthly'}
                    onValueChange={(value) => handleLocalUpdate({ timePeriod: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-4">
            <AppearanceCustomizer 
              widget={localWidget}
              onUpdate={handleLocalUpdate}
            />
          </TabsContent>

          {/* Layout Tab */}
          <TabsContent value="layout" className="space-y-4">
            <LayoutCustomizer 
              widget={localWidget}
              onUpdate={handleLocalUpdate}
            />
          </TabsContent>

          {/* Filters Tab */}
          <TabsContent value="filters" className="space-y-4">
            <FiltersCustomizer 
              widget={localWidget}
              onUpdate={handleLocalUpdate}
              allCategoryOptions={allCategoryOptions}
            />
          </TabsContent>

          {/* Annotations Tab */}
          <TabsContent value="annotations" className="space-y-4">
            <AnnotationsCustomizer 
              widget={localWidget}
              onUpdate={handleLocalUpdate}
            />
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-4">
            <AdvancedCustomizer 
              widget={localWidget}
              onUpdate={handleLocalUpdate}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Appearance Customization Component
function AppearanceCustomizer({ widget, onUpdate }: { widget: any; onUpdate: (updates: any) => void }) {
  const [customColors, setCustomColors] = useState(widget.customColors || []);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);

  const colorThemes = {
    default: ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'],
    vibrant: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
    professional: ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6', '#BDC3C7'],
    warm: ['#E74C3C', '#E67E22', '#F39C12', '#F1C40F', '#D4AC0D'],
    cool: ['#3498DB', '#2980B9', '#1ABC9C', '#16A085', '#27AE60'],
    pastel: ['#FFB6C1', '#98FB98', '#87CEEB', '#DDA0DD', '#F0E68C'],
    custom: customColors
  };

  const handleColorChange = (color: string) => {
    const newColors = [...customColors];
    newColors[selectedColorIndex] = color;
    setCustomColors(newColors);
    onUpdate({ customColors: newColors, colorTheme: 'custom' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Visual Styling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Color Theme Selection */}
        <div>
          <Label className="text-base font-medium">Color Theme</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
            {Object.entries(colorThemes).map(([theme, colors]) => (
              <Button
                key={theme}
                variant={widget.colorTheme === theme ? "default" : "outline"}
                className="h-auto p-3 flex-col"
                onClick={() => onUpdate({ colorTheme: theme })}
              >
                <div className="flex gap-1 mb-2">
                  {colors.slice(0, 4).map((color, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-sm border"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="text-xs capitalize">{theme}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Color Picker */}
        {widget.colorTheme === 'custom' && (
          <div>
            <Label className="text-base font-medium">Custom Colors</Label>
            <div className="flex gap-2 mt-2 mb-4">
              {customColors.map((color, index) => (
                <Button
                  key={index}
                  variant={selectedColorIndex === index ? "default" : "outline"}
                  className="w-8 h-8 p-0 border-2"
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColorIndex(index)}
                />
              ))}
              <Button
                variant="outline"
                className="w-8 h-8 p-0"
                onClick={() => {
                  const newColors = [...customColors, '#8884d8'];
                  setCustomColors(newColors);
                  onUpdate({ customColors: newColors });
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {customColors.length > 0 && (
              <HexColorPicker
                color={customColors[selectedColorIndex]}
                onChange={handleColorChange}
              />
            )}
          </div>
        )}

        <Separator />

        {/* Typography and Text */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Typography</Label>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Title Font Size</Label>
              <Slider
                value={[widget.titleFontSize || 16]}
                onValueChange={([value]) => onUpdate({ titleFontSize: value })}
                min={12}
                max={24}
                step={1}
              />
              <div className="text-sm text-muted-foreground mt-1">
                {widget.titleFontSize || 16}px
              </div>
            </div>

            <div>
              <Label>Axis Font Size</Label>
              <Slider
                value={[widget.axisFontSize || 12]}
                onValueChange={([value]) => onUpdate({ axisFontSize: value })}
                min={8}
                max={16}
                step={1}
              />
              <div className="text-sm text-muted-foreground mt-1">
                {widget.axisFontSize || 12}px
              </div>
            </div>
          </div>

          <div>
            <Label>Title Font Weight</Label>
            <Select
              value={widget.titleFontWeight || 'normal'}
              onValueChange={(value) => onUpdate({ titleFontWeight: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
                <SelectItem value="bolder">Bolder</SelectItem>
                <SelectItem value="lighter">Lighter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Chart Elements */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Chart Elements</Label>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Show Legend</Label>
              <Switch
                checked={widget.showLegend}
                onCheckedChange={(checked) => onUpdate({ showLegend: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Show Grid Lines</Label>
              <Switch
                checked={widget.showGrid}
                onCheckedChange={(checked) => onUpdate({ showGrid: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Show Data Labels</Label>
              <Switch
                checked={widget.showDataLabels}
                onCheckedChange={(checked) => onUpdate({ showDataLabels: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Animate Chart</Label>
              <Switch
                checked={widget.animateChart !== false}
                onCheckedChange={(checked) => onUpdate({ animateChart: checked })}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Layout Customization Component
function LayoutCustomizer({ widget, onUpdate }: { widget: any; onUpdate: (updates: any) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid className="h-5 w-5" />
          Layout & Sizing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Widget Width</Label>
            <Select
              value={widget.size || 'medium'}
              onValueChange={(value) => onUpdate({ size: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small (1 column)</SelectItem>
                <SelectItem value="medium">Medium (1 column)</SelectItem>
                <SelectItem value="large">Large (2 columns)</SelectItem>
                <SelectItem value="full">Full Width</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Chart Height (px)</Label>
            <Input
              type="number"
              value={widget.height || 300}
              onChange={(e) => onUpdate({ height: parseInt(e.target.value) || 300 })}
              min={200}
              max={800}
            />
          </div>
        </div>

        <div>
          <Label>Padding</Label>
          <div className="grid grid-cols-4 gap-2 mt-2">
            <div>
              <Label className="text-xs">Top</Label>
              <Input
                type="number"
                value={widget.padding?.top || 20}
                onChange={(e) => onUpdate({
                  padding: { ...widget.padding, top: parseInt(e.target.value) || 20 }
                })}
                min={0}
                max={100}
              />
            </div>
            <div>
              <Label className="text-xs">Right</Label>
              <Input
                type="number"
                value={widget.padding?.right || 30}
                onChange={(e) => onUpdate({
                  padding: { ...widget.padding, right: parseInt(e.target.value) || 30 }
                })}
                min={0}
                max={100}
              />
            </div>
            <div>
              <Label className="text-xs">Bottom</Label>
              <Input
                type="number"
                value={widget.padding?.bottom || 20}
                onChange={(e) => onUpdate({
                  padding: { ...widget.padding, bottom: parseInt(e.target.value) || 20 }
                })}
                min={0}
                max={100}
              />
            </div>
            <div>
              <Label className="text-xs">Left</Label>
              <Input
                type="number"
                value={widget.padding?.left || 20}
                onChange={(e) => onUpdate({
                  padding: { ...widget.padding, left: parseInt(e.target.value) || 20 }
                })}
                min={0}
                max={100}
              />
            </div>
          </div>
        </div>

        <div>
          <Label>Legend Position</Label>
          <Select
            value={widget.legendPosition || 'bottom'}
            onValueChange={(value) => onUpdate({ legendPosition: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label>Responsive Sizing</Label>
          <Switch
            checked={widget.responsive !== false}
            onCheckedChange={(checked) => onUpdate({ responsive: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Filters Customization Component
function FiltersCustomizer({ 
  widget, 
  onUpdate, 
  allCategoryOptions 
}: { 
  widget: any; 
  onUpdate: (updates: any) => void;
  allCategoryOptions: { value: string; label: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Widget-Specific Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label>Filter by Categories</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Override global category filters for this widget only
          </p>
          <MultiSelect
            options={allCategoryOptions}
            selected={widget.customFilters?.categories || []}
            onChange={(value) => onUpdate({ customFilters: { ...widget.customFilters, categories: value } })}
            placeholder="Select categories..."
          />
        </div>

        <div>
          <Label>Date Range Override</Label>
          <div className="flex items-center space-x-2">
            <Switch
              checked={widget.customFilters?.dateOverride || false}
              onCheckedChange={(checked) => onUpdate({
                customFilters: { 
                  ...widget.customFilters, 
                  dateOverride: checked 
                }
              })}
            />
            <span className="text-sm">Use custom date range</span>
          </div>
        </div>

        <div>
          <Label>Amount Filter</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Label className="text-sm">Min:</Label>
              <Input
                type="number"
                value={widget.customFilters?.amountMin || 0}
                onChange={(e) => onUpdate({
                  customFilters: {
                    ...widget.customFilters,
                    amountMin: parseFloat(e.target.value) || 0
                  }
                })}
                className="w-24"
              />
              <Label className="text-sm">Max:</Label>
              <Input
                type="number"
                value={widget.customFilters?.amountMax || 10000}
                onChange={(e) => onUpdate({
                  customFilters: {
                    ...widget.customFilters,
                    amountMax: parseFloat(e.target.value) || 10000
                  }
                })}
                className="w-24"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Annotations Customization Component
function AnnotationsCustomizer({ widget, onUpdate }: { widget: any; onUpdate: (updates: any) => void }) {
  const [annotations, setAnnotations] = useState(widget.annotations || []);

  const addAnnotation = () => {
    const newAnnotation = {
      id: Date.now(),
      type: 'line', // line, area, point
      value: 0,
      label: 'Annotation',
      color: '#ff0000',
      axis: 'y' // x or y
    };
    const updated = [...annotations, newAnnotation];
    setAnnotations(updated);
    onUpdate({ annotations: updated });
  };

  const updateAnnotation = (id: number, updates: any) => {
    const updated = annotations.map(ann => 
      ann.id === id ? { ...ann, ...updates } : ann
    );
    setAnnotations(updated);
    onUpdate({ annotations: updated });
  };

  const removeAnnotation = (id: number) => {
    const updated = annotations.filter(ann => ann.id !== id);
    setAnnotations(updated);
    onUpdate({ annotations: updated });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Annotations & Reference Lines
          </div>
          <Button size="sm" onClick={addAnnotation}>
            <Plus className="h-4 w-4 mr-2" />
            Add Annotation
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {annotations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No annotations added. Click "Add Annotation" to create reference lines or markers.
          </p>
        ) : (
          annotations.map((annotation) => (
            <Card key={annotation.id} className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Input
                    placeholder="Annotation label"
                    value={annotation.label}
                    onChange={(e) => updateAnnotation(annotation.id, { label: e.target.value })}
                    className="flex-1 mr-2"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeAnnotation(annotation.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={annotation.type}
                      onValueChange={(value) => updateAnnotation(annotation.id, { type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="line">Reference Line</SelectItem>
                        <SelectItem value="area">Reference Area</SelectItem>
                        <SelectItem value="point">Point Marker</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Value</Label>
                    <Input
                      type="number"
                      value={annotation.value}
                      onChange={(e) => updateAnnotation(annotation.id, { 
                        value: parseFloat(e.target.value) || 0 
                      })}
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Color</Label>
                    <Input
                      type="color"
                      value={annotation.color}
                      onChange={(e) => updateAnnotation(annotation.id, { color: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// Advanced Customization Component
function AdvancedCustomizer({ widget, onUpdate }: { widget: any; onUpdate: (updates: any) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Advanced Options
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label>Custom CSS Classes</Label>
          <Input
            placeholder="custom-chart-style responsive-chart"
            value={widget.customClasses || ''}
            onChange={(e) => onUpdate({ customClasses: e.target.value })}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Space-separated CSS class names
          </p>
        </div>

        <div>
          <Label>Custom Tooltip Template</Label>
          <Textarea
            placeholder="Custom tooltip HTML template..."
            value={widget.customTooltip || ''}
            onChange={(e) => onUpdate({ customTooltip: e.target.value })}
            rows={3}
          />
        </div>

        <div>
          <Label>Data Processing Script</Label>
          <Textarea
            placeholder="// Custom data transformation
return data.map(item => ({ ...item, processed: true }));"
            value={widget.dataProcessor || ''}
            onChange={(e) => onUpdate({ dataProcessor: e.target.value })}
            rows={4}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            JavaScript code to transform data before charting
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Enable Data Export</Label>
            <Switch
              checked={widget.allowExport !== false}
              onCheckedChange={(checked) => onUpdate({ allowExport: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Show Refresh Button</Label>
            <Switch
              checked={widget.showRefresh || false}
              onCheckedChange={(checked) => onUpdate({ showRefresh: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Auto-refresh Data</Label>
            <Switch
              checked={widget.autoRefresh || false}
              onCheckedChange={(checked) => onUpdate({ autoRefresh: checked })}
            />
          </div>
        </div>

        {widget.autoRefresh && (
          <div>
            <Label>Refresh Interval (seconds)</Label>
            <Input
              type="number"
              value={widget.refreshInterval || 60}
              onChange={(e) => onUpdate({ refreshInterval: parseInt(e.target.value) || 60 })}
              min={10}
              max={3600}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Dashboard Layout Manager
export function DashboardLayoutManager({ 
  widgets, 
  onUpdateLayout,
  onUpdateWidget 
}: {
  widgets: any[];
  onUpdateLayout: (newLayout: string) => void;
  onUpdateWidget: (id: string, updates: any) => void;
}) {
  const [layout, setLayout] = useState('grid');
  const [draggedWidget, setDraggedWidget] = useState<any>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard Layout</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Layout Style</Label>
          <div className="flex gap-2 mt-2">
            <Button
              variant={layout === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setLayout('grid');
                onUpdateLayout('grid');
              }}
            >
              <Grid className="h-4 w-4 mr-2" />
              Grid
            </Button>
            <Button
              variant={layout === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setLayout('list');
                onUpdateLayout('list');
              }}
            >
              <List className="h-4 w-4 mr-2" />
              List
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
