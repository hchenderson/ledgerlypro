
"use client";

import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "./ui/skeleton";

export function FeatureGate({ children }: { children: React.ReactNode }) {
    const { loading } = useAuth();

    if (loading) {
        return (
             <div className="space-y-4">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-40 w-full" />
             </div>
        )
    }

    return <>{children}</>;
}
