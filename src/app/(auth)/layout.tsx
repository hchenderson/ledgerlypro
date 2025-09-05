
"use client";

import { useAuth } from '@/hooks/use-auth';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && user) {
        const onboardingComplete = localStorage.getItem('onboardingComplete');
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
  }, [user, loading, router, pathname]);

  // Show a loading spinner while checking auth state or if we are about to redirect.
  if (loading || (user && !localStorage.getItem('onboardingComplete') && pathname !== '/welcome')) {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
    );
  }

  return <>{children}</>;
}
