
"use client";

import { useEffect, useRef } from 'react';
import { Card } from './ui/card';
import { cn } from '@/lib/utils';

declare global {
    interface Window {
        adsbygoogle: Array<Record<string, unknown>>;
    }
}

interface AdBannerProps {
    showAds: boolean;
    className?: string;
    slot: string;
    format?: 'auto' | 'fluid' | 'rectangle' | 'vertical' | 'horizontal';
    responsive?: boolean;
}

export function AdBanner({
    showAds,
    className,
    slot,
    format = 'auto',
    responsive = true,
}: AdBannerProps) {
    const adElement = useRef<HTMLModElement>(null);
    const adsEnabled =
        process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true' &&
        Boolean(process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID) &&
        Boolean(slot);

    useEffect(() => {
        const element = adElement.current;
        if (!showAds || !adsEnabled || !element) return;
        if (element.dataset.adsbygoogleStatus || element.dataset.ledgerlyRequested === 'true') {
            return;
        }
        element.dataset.ledgerlyRequested = 'true';
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes("already have ads")) {
                console.error('AdSense error:', error);
            }
        }
    }, [adsEnabled, showAds, slot]);
    
    if (!showAds || !adsEnabled) {
        return null;
    }

    return (
        <Card className={cn("flex items-center justify-center bg-secondary/50 max-w-lg w-full h-[90px] m-2 p-0 overflow-hidden", className)}>
             <ins ref={adElement} className="adsbygoogle"
                style={{ display: 'block', width: "100%", height: "100%" }}
                data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID}
                data-ad-slot={slot}
                data-ad-format={format}
                data-full-width-responsive={responsive.toString()}
            ></ins>
        </Card>
    );
}
