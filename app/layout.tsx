'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import './globals.css';

const LocationGate = dynamic(() => import('@/components/LocationGate'), {
  ssr: false,
});

// Metadata must be set in a separate metadata.ts file for client components

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locationAllowed, setLocationAllowed] = useState<boolean | null>(null);
  const [nearestZone, setNearestZone] = useState<any>(null);
  
  const cityName = process.env.NEXT_PUBLIC_CITY_NAME || 'Los Angeles';
  const cityShort = process.env.NEXT_PUBLIC_CITY_SHORT || 'LA';

  function handleLocationChecked(allowed: boolean, zone?: any) {
    setLocationAllowed(allowed);
    setNearestZone(zone);
  }

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Coordinate" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <title>Overwhelm Los Angeles - Effective Assembly Tool</title>
        <meta name="description" content="Coordination tool for effective assembly in Los Angeles. Safe movement and communication." />
      </head>
      <body className="antialiased">
        <LocationGate onLocationChecked={handleLocationChecked}>
          {children}
        </LocationGate>
      </body>
    </html>
  );
}