
"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon, Wallet, TrendingUp, TrendingDown, DollarSign, CalendarClock, Activity, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CalendarClock,
  Activity,
  PiggyBank,
};


interface StatCardProps {
  title: string;
  value: number;
  icon: keyof typeof icons;
  trendValue: string;
  isPercentage?: boolean;
  isDate?: boolean;
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
  isDate = false,
  variant = "default",
}: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);

  const Icon = icons[icon] as LucideIcon;

  useEffect(() => {
    if (isDate) return;

    const reduceMotionOrSmallScreen = window.matchMedia(
      "(prefers-reduced-motion: reduce), (max-width: 767px)"
    ).matches;
    if (reduceMotionOrSmallScreen) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }
    
    let startTimestamp: number | null = null;
    let animationFrame = 0;
    const duration = 1000; // 1 second animation
    const startValue = prevValueRef.current;
    const endValue = value;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
      
      setDisplayValue(startValue + (endValue - startValue) * easedProgress);

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
        prevValueRef.current = endValue;
      }
    };

    animationFrame = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [value, isDate]);

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-2 sm:p-6 sm:pb-2">
        <CardTitle className="min-w-0 break-words text-sm font-medium">{title}</CardTitle>
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
        {!isDate && (
          <div
            className="break-words font-code text-xl font-bold leading-tight tabular-nums min-[375px]:text-2xl"
            title={formatValue(value, isPercentage)}
          >
            {formatValue(displayValue, isPercentage)}
          </div>
        )}
        <p className={cn("break-words text-xs text-muted-foreground",
          isDate && "text-sm font-medium",
          variant === 'success' && 'text-emerald-600',
          variant === 'danger' && 'text-red-600'
        )}>
          {trendValue}
        </p>
      </CardContent>
    </Card>
  );
}
