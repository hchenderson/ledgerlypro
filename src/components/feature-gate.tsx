
"use client";

import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Lock } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import { Skeleton } from "./ui/skeleton";

export function FeatureGate({ children }: { children: React.ReactNode }) {
    const { plan, loading } = useAuth();

    if (loading) {
        return (
             <div className="space-y-4">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-40 w-full" />
             </div>
        )
    }

    if (plan === 'pro') {
        return <>{children}</>;
    }

    return (
        <div className="w-full flex justify-center items-center py-10">
            <Card className="max-w-md text-center">
                <CardHeader>
                    <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit mb-2">
                        <Lock className="h-6 w-6" />
                    </div>
                    <CardTitle>This is a Pro Feature</CardTitle>
                    <CardDescription>
                        You need to upgrade to the Pro plan to access this feature.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild>
                        <Link href="/pricing">Upgrade to Pro</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
