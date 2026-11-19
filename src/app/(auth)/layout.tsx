
"use client";

import { useAuth } from '@/hooks/use-auth';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { AppProviders } from '@/app/providers';

function AuthLoadingState() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent motion-reduce:animate-none" aria-hidden="true" />
      <span className="sr-only">Loading your account</span>
    </div>
  );
}

function AuthenticatedAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, onboardingComplete } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const budgetPortalSwitch = pathname === '/signin' && searchParams.get('budget') === '1';

  useEffect(() => {
    if (!loading && user && !budgetPortalSwitch) {
        // If user is authenticated and onboarding is complete, redirect to dashboard
        if (onboardingComplete) {
            router.push('/dashboard');
        } 
        // If user is authenticated but onboarding is not complete, and they are not on the welcome page,
        // redirect them to the welcome page.
        else if (pathname !== '/welcome') {
            router.push('/welcome');
        }
    }
  }, [user, loading, router, pathname, onboardingComplete, budgetPortalSwitch]);

  // Show a loading spinner while checking auth state or if we are about to redirect.
  if (loading || (user && !onboardingComplete && pathname !== '/welcome')) {
    return <AuthLoadingState />;
  }

  return <>{children}</>;
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProviders>
      <Suspense fallback={<AuthLoadingState />}>
        <AuthenticatedAuthLayout>{children}</AuthenticatedAuthLayout>
      </Suspense>
    </AppProviders>
  );
}
