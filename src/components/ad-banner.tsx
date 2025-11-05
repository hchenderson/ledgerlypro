
"use client";

import { useEffect } from 'react';
import { Card } from './ui/card';

declare global {
    interface Window {
        adsbygoogle: any[];
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
    useEffect(() => {
        if (showAds) {
            try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (err) {
                console.error('AdSense error:', err);
            }
        }
    }, [showAds]);
    
    if (!showAds) {
        return null;
    }

    return (
        <Card className={className}>
             <ins className="adsbygoogle"
                style={{ display: 'block' }}
                data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID}
                data-ad-slot={slot}
                data-ad-format={format}
                data-full-width-responsive={responsive.toString()}
            ></ins>
        </Card>
    );
}
