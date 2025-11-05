
"use client";

import Script from "next/script";

export function AdSenseScript({ showAds }: { showAds: boolean }) {
  if (!showAds || !process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID) {
    return null;
  }

  return (
    <Script
      id="adsense-script"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
