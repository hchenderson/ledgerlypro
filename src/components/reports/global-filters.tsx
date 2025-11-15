
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Filter } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableMultiSelect } from '@/components/ui/searchable-multi-select';
import { cn } from '@/lib/utils';
import { format, type DateRange } from 'date-fns';

interface GlobalFiltersProps {
    presetRanges: { label: string; value: string }[];
    dateRange: DateRange | undefined;
    onDateRangeChange: (range: DateRange | undefined) => void;
    onPresetChange: (value: string) => void;
    categoryOptions?: { value: string; label: string }[];
    selectedCategories?: string[];
    onSelectedCategoriesChange?: (value: string[]) => void;
    showCategoryFilter?: boolean;
    filterTitle?: string;
}

export function GlobalFilters({
    presetRanges,
    dateRange,
    onDateRangeChange,
    onPresetChange,
    categoryOptions,
    selectedCategories,
    onSelectedCategoriesChange,
    showCategoryFilter = false,
    filterTitle = "Filters"
}: GlobalFiltersProps) {
    const showDateFilter = presetRanges.length > 0;
    
    if (!showDateFilter && !showCategoryFilter) {
        return null;
    }

    return (
        <Card className={cn(!showDateFilter && "border-none shadow-none bg-transparent")}>
            <CardHeader className={cn(!showDateFilter && "p-0 mb-4")}>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Filter className="h-4 w-4" />
                    {filterTitle}
                </CardTitle>
            </CardHeader>
            <CardContent className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", !showDateFilter && "p-0")}>
                 {showDateFilter && (
                     <div className="space-y-2">
                        <Label className="text-sm">Date Range</Label>
                        <div className="flex gap-2">
                            <Select onValueChange={onPresetChange}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select a preset" />
                                </SelectTrigger>
                                <SelectContent>
                                    {presetRanges.map(preset => (
                                        <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn('flex-1 justify-start text-left font-normal', !dateRange && 'text-muted-foreground')}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange?.from ? (dateRange.to ? (`${format(dateRange.from, 'LLL dd, y')} - ${format(dateRange.to, 'LLL dd, y')}`) : format(dateRange.from, 'LLL dd, y')) : (<span>Pick a date</span>)}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={dateRange?.from}
                                        selected={dateRange}
                                        onSelect={onDateRangeChange}
                                        numberOfMonths={2}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                 )}

                {showCategoryFilter && categoryOptions && selectedCategories && onSelectedCategoriesChange && (
                    <div className="space-y-2">
                        <Label className="text-sm">Categories</Label>
                        <SearchableMultiSelect
                            options={categoryOptions}
                            selected={selectedCategories}
                            onChange={onSelectedCategoriesChange}
                            placeholder="All Categories"
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
