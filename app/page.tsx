'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import CrewAssignment from '@/components/CrewAssignment';
import { supabase, subscribeToCrewUpdates } from '@/lib/supabase/client';

interface Stats {
  totalCrews: number;
  totalProtesters: number;
  activeZones: number;
  nextRotation: string | null;
}

interface Zone {
  id: number;
  name: string;
  status: {
    crews: Array<{
      id: number;
      name: string;
      size: number;
    }>;
    totalProtesters: number;
    policeActivity?: {
      severity: string;
      description: string;
    };
  };
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats>({
    totalCrews: 0,
    totalProtesters: 0,
    activeZones: 0,
    nextRotation: null,
  });
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const cityName = process.env.NEXT_PUBLIC_CITY_NAME || 'Los Angeles';

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(error => {
        console.log('SW registration failed:', error);
      });
    }

    // Initial stats fetch
    fetchStats();

    // Subscribe to real-time updates
    const crewSub = subscribeToCrewUpdates(() => fetchStats());

    // Auto-refresh every 10 minutes (movements happen every 30 min)
    const interval = setInterval(fetchStats, 600000); // 10 minutes

    return () => {
      crewSub.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  async function fetchStats() {
    try {
      const response = await fetch('/api/zones');
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
        setZones(data.zones || []);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Stats fetch error:', error);
    } finally {
      // Only set loading false on initial load
      if (isLoading) {
        setIsLoading(false);
      }
    }
  }

  // Convert zone IDs to letters
  const getZoneLetter = (zoneId: number) => {
    return String.fromCharCode(65 + (zoneId - 1)); // A, B, C, etc.
  };

  return (
    <main className="min-h-screen">
      <div className="container">
        {/* Header */}
        <header className="section">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <Image 
                src="/fist.png" 
                alt="Solidarity" 
                width={32} 
                height={48}
                className="opacity-80"
              />
              <div>
                <h1 className="mb-1">Overwhelm {cityName}</h1>
                <p className="text-muted">For effective assembly and safe movement</p>
              </div>
            </div>
            <div className="text-right text-sm">
              {lastUpdate && (
                <motion.div
                  key={lastUpdate.getTime()}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-muted"
                >
                  <span className="inline-block w-2 h-2 bg-minimal-safe rounded-full mr-2"></span>
                  Updated {lastUpdate.toLocaleTimeString()}
                </motion.div>
              )}
            </div>
          </div>
        </header>

        {/* Share URL */}
        <section className="section">
          <div className="bg-white border-2 border-minimal-border p-4 text-center">
            <p className="text-sm text-muted mb-1">Share with other protesters:</p>
            <p className="text-2xl font-mono font-bold">overwhelm.city/la</p>
          </div>
        </section>

        {/* Join Section */}
        <section className="section">
          <CrewAssignment />
        </section>

        {/* Stats */}
        <section className="section">
          <motion.div 
            key={`stats-${lastUpdate?.getTime() || 0}`}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border-2 border-minimal-border text-center">
              <div className="text-2xl font-bold">{stats.totalCrews}</div>
              <div className="text-sm text-muted uppercase tracking-wider">Groups</div>
            </div>
            <div className="p-4 border-2 border-minimal-border text-center">
              <div className="text-2xl font-bold">{stats.totalProtesters}</div>
              <div className="text-sm text-muted uppercase tracking-wider">People</div>
            </div>
            <div className="p-4 border-2 border-minimal-border text-center">
              <div className="text-2xl font-bold">{stats.activeZones}</div>
              <div className="text-sm text-muted uppercase tracking-wider">Zones</div>
            </div>
            {stats.nextRotation && (
              <div className="p-4 border-2 border-minimal-accent text-center">
                <div className="text-2xl font-bold">{formatTimeUntil(stats.nextRotation)}</div>
                <div className="text-sm text-muted uppercase tracking-wider">Next Move</div>
              </div>
            )}
          </motion.div>
        </section>

        {/* Current Assignments */}
        <section className="section">
          <h2>Current Assignments</h2>
          {zones.length > 0 ? (
            <motion.div
              key={zones.map(z => z.id).join('-')}
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <table className="table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Zone</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {zones.flatMap(zone => 
                  zone.status.crews.map(crew => (
                    <tr key={crew.id}>
                      <td>{crew.name}</td>
                      <td>Zone {getZoneLetter(zone.id)}</td>
                      <td>{crew.size} people</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </motion.div>
          ) : (
            <p className="text-muted">No active groups at this time.</p>
          )}
        </section>


        {/* How to Use */}
        <section className="section">
          <h3 className="font-semibold mb-3">How to Use This Tool</h3>
          <ol className="space-y-2 text-sm">
            <li className="flex items-start">
              <span className="mr-3 font-mono">1.</span>
              <span>Join a crew above and get your zone assignment</span>
            </li>
            <li className="flex items-start">
              <span className="mr-3 font-mono">2.</span>
              <span>Go to your assigned zone and find others with your crew number</span>
            </li>
            <li className="flex items-start">
              <span className="mr-3 font-mono">3.</span>
              <span>When the timer reaches zero, check for your new zone</span>
            </li>
            <li className="flex items-start">
              <span className="mr-3 font-mono">4.</span>
              <span>Move together as a crew - the more people use this, the stronger we are</span>
            </li>
          </ol>
        </section>

        {/* Safety Guidelines */}
        <section className="section">
          <div className="p-6 bg-gray-50 border border-minimal-border">
            <h3 className="mb-4">Safety Guidelines</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start">
                <span className="mr-2 text-minimal-muted">•</span>
                Protest peacefully for maximum impact
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-minimal-muted">•</span>
                Look out for one another
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-minimal-muted">•</span>
                Always move if you feel unsafe
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-minimal-muted">•</span>
                <a 
                  href="https://www.aclusocal.org/en/know-your-rights/protesters" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-minimal-focus underline hover:no-underline"
                >
                  Know your rights
                </a>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-minimal-muted">•</span>
                Tell loved ones where you are and what you&apos;re doing
              </li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-sm text-muted py-8">
          <p>Stay safe. Stay peaceful. Know your rights.</p>
          <p className="mt-2">
            <a href="https://github.com/overwhelmcity/overwhelm" className="text-minimal-focus">
              Open source coordination tool
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}

function formatTimeUntil(isoString: string): string {
  const now = new Date();
  const target = new Date(isoString);
  const diff = target.getTime() - now.getTime();
  
  if (diff <= 0) return 'now';
  
  const minutes = Math.floor(diff / 60000);
  return `${minutes} min`;
}