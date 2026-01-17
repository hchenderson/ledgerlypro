"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForwardForecast } from "@/hooks/use-forward-forecast";
import { ForecastNetChart } from "@/components/dashboard/forecast-net-chart";
import { RecurringCommitmentsList } from "@/components/dashboard/recurring-commitments-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket, Repeat } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { useState } from "react";
import { Segmented } from "./forecast-controls";

export function ForwardAnalyticsPanel() {
  const { loading: userDataLoading } = useUserData();
  const { series, recurringFuture } = useForwardForecast(90);
  const isForecastLoading = userDataLoading || !series || !recurringFuture;
  const [chartMode, setChartMode] = useState<'net' | 'cumulativeNet'>('cumulativeNet');

  return (
    <div>
      <h3 className="text-2xl font-bold tracking-tight font-headline mb-4">
        Forward-Looking Analytics
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><Rocket /> Next 90-Day Net Forecast</CardTitle>
                    <CardDescription>Projected net change based on recurring transactions and historical spending habits.</CardDescription>
                </div>
                 <Segmented
                    value={chartMode}
                    onChange={(value) => setChartMode(value as 'net' | 'cumulativeNet')}
                    options={[
                        { value: 'cumulativeNet', label: 'Cumulative' },
                        { value: 'net', label: 'Daily Net' },
                    ]}
                />
            </div>
          </CardHeader>
          <CardContent>
            {isForecastLoading ? (
              <Skeleton className="h-[256px] w-full" />
            ) : (
              <ForecastNetChart data={series} mode={chartMode} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Repeat /> Recurring Commitments</CardTitle>
            <CardDescription>Scheduled transactions coming up in the next 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {isForecastLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <RecurringCommitmentsList recurringFuture={recurringFuture} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
