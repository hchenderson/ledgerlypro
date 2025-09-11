
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle } from 'lucide-react';

export default function StripeCancelPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/50">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <XCircle className="h-8 w-8" />
          </div>
          <CardTitle className="mt-4">Payment Canceled</CardTitle>
          <CardDescription>
            Your payment process was canceled. You have not been charged. Feel free to return to the pricing page if you change your mind.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
           <Button asChild className="w-full">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/pricing">View Pricing</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
