
"use client";

import { useAuth } from '@/hooks/use-auth';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppProviders } from '@/app/providers';

function AuthenticatedAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, onboardingComplete } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && user) {
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
  }, [user, loading, router, pathname, onboardingComplete]);

  // Show a loading spinner while checking auth state or if we are about to redirect.
  if (loading || (user && !onboardingComplete && pathname !== '/welcome')) {
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

  return <>{children}</>;
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProviders>
      <AuthenticatedAuthLayout>{children}</AuthenticatedAuthLayout>
    </AppProviders>
  );
}
