
"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon, Wallet, TrendingUp, TrendingDown, DollarSign, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CalendarClock,
};


interface StatCardProps {
  title: string;
  value: number;
  icon: keyof typeof icons;
  trendValue: string;
  isPercentage?: boolean;
  variant?: "success" | "danger" | "default";
}

const formatValue = (value: number, isPercentage: boolean) => {
  if (isPercentage) {
    return `${value.toFixed(1)}%`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

export function StatCard({
  title,
  value,
  icon,
  trendValue,
  isPercentage = false,
  variant = "default",
}: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);

  const Icon = icons[icon] as LucideIcon;

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1000; // 1 second animation
    const startValue = prevValueRef.current;
    const endValue = value;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
      
      setDisplayValue(startValue + (endValue - startValue) * easedProgress);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
        prevValueRef.current = endValue;
      }
    };

    window.requestAnimationFrame(step);

    return () => {
      // No cleanup needed as requestAnimationFrame stops itself
    };
  }, [value]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="font-code text-2xl font-bold">
          {formatValue(displayValue, isPercentage)}
        </div>
        <p className={cn("text-xs text-muted-foreground",
          variant === 'success' && 'text-emerald-600',
          variant === 'danger' && 'text-red-600'
        )}>
          {trendValue}
        </p>
      </CardContent>
    </Card>
  );
}
