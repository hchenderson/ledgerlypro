
"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Palette,
  Settings,
  Plus,
  Grid,
} from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { Separator } from '../ui/separator';
import { SearchableMultiSelect } from '../ui/searchable-multi-select';

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
  colorTheme: string;
  customColors?: string[];
  showLegend: boolean;
  showGrid: boolean;
  showTargetLines: boolean;
  height: number;
  customFilters: {
    categories: string[];
  };
  formulaId: string | null;
  titleFontSize?: number;
  axisFontSize?: number;
  titleFontWeight?: string;
  showDataLabels?: boolean;
  animateChart?: boolean;
  padding?: { top: number; right: number; bottom: number; left: number };
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  responsive?: boolean;
}

interface AdvancedWidgetCustomizerProps {
    widget: Widget | null;
    onUpdate: (id: string, updates: Partial<Widget>) => void;
    onClose: () => void;
    allCategoryOptions: { value: string; label: string }[];
    availableDataFields: { value: string; label: string }[];
}


export function AdvancedWidgetCustomizer({ 
  widget, 
  onUpdate, 
  onClose, 
  allCategoryOptions,
  availableDataFields 
}: AdvancedWidgetCustomizerProps) {
  const [localWidget, setLocalWidget] = useState<Widget | null>(null);
  const [activeTab, setActiveTab] = useState('data');

  useEffect(() => {
    // Only set the local widget when the dialog is opened with a new widget
    if (widget && !localWidget) {
      setLocalWidget({ ...widget });
    }
    if (!widget && localWidget) {
      setLocalWidget(null);
    }
  }, [widget, localWidget]);

  if (!widget || !localWidget) return null;

  const handleLocalUpdate = (updates: Partial<Widget>) => {
    if (localWidget) {
        setLocalWidget(prev => prev ? ({ ...prev, ...updates }) : null);
    }
  };

  const handleSave = () => {
    if (localWidget) {
        onUpdate(widget.id, localWidget);
    }
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
          <DialogDescription>
            Modify the widget's appearance, data source, and filters.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="filters">Filters</TabsTrigger>
          </TabsList>

          {/* Data Configuration Tab */}
          <TabsContent value="data" className="space-y-4 pt-4">
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
                      onValueChange={(value) => handleLocalUpdate({ type: value as Widget['type'] })}
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
                        comparisonKey: value === 'none' ? undefined : value 
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-4 pt-4">
            <AppearanceCustomizer 
              widget={localWidget}
              onUpdate={handleLocalUpdate}
            />
          </TabsContent>

          {/* Layout Tab */}
          <TabsContent value="layout" className="space-y-4 pt-4">
            <LayoutCustomizer 
              widget={localWidget}
              onUpdate={handleLocalUpdate}
            />
          </TabsContent>

          {/* Filters Tab */}
          <TabsContent value="filters" className="space-y-4 pt-4">
            <FiltersCustomizer 
              widget={localWidget}
              onUpdate={handleLocalUpdate}
              allCategoryOptions={allCategoryOptions}
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
function AppearanceCustomizer({ widget, onUpdate }: { widget: Widget; onUpdate: (updates: Partial<Widget>) => void }) {
  const [customColors, setCustomColors] = useState(widget.customColors || []);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);

  const colorThemes: Record<string, string[]> = {
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
                  {(colors.length > 0 ? colors : ['#ccc', '#bbb', '#aaa', '#999']).slice(0, 4).map((color, i) => (
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
                <input
                    type="color"
                    value={customColors[selectedColorIndex] || '#000000'}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-full h-10 rounded border"
                />
            )}
          </div>
        )}

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
function LayoutCustomizer({ widget, onUpdate }: { widget: Widget; onUpdate: (updates: Partial<Widget>) => void }) {
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
              onValueChange={(value) => onUpdate({ size: value as Widget['size'] })}
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
          <Label>Legend Position</Label>
          <Select
            value={widget.legendPosition || 'bottom'}
            onValueChange={(value) => onUpdate({ legendPosition: value as Widget['legendPosition'] })}
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
  widget: Widget; 
  onUpdate: (updates: Partial<Widget>) => void;
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
          <SearchableMultiSelect
            options={allCategoryOptions}
            selected={widget.customFilters?.categories || []}
            onChange={(value) => onUpdate({ customFilters: { ...(widget.customFilters || { categories: [] }), categories: value } })}
            placeholder="Select categories..."
          />
        </div>
      </CardContent>
    </Card>
  );
}
