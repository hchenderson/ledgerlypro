
"use client";

import { useEffect } from 'react';
import aa from 'search-insights';
import { useAuth } from '@/hooks/use-auth';
import { algoliaAppId, algoliaSearchKey, isAlgoliaConfigured } from '@/lib/algolia';

export function AlgoliaInsightsProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();

    useEffect(() => {
        if (isAlgoliaConfigured) {
            aa('init', {
                appId: algoliaAppId,
                apiKey: algoliaSearchKey,
            });
        }
    }, []);

    useEffect(() => {
        if (user && isAlgoliaConfigured) {
            aa('setAuthenticatedUserToken', user.uid);
        }
    }, [user]);

    return <>{children}</>;
}
