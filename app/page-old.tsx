'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CrewAssignment from '@/components/CrewAssignment';
import CrewStats from '@/components/CrewStats';
import ActiveCrews from '@/components/ActiveCrews';
import NextRotation from '@/components/NextRotation';
import ZoneMap from '@/components/ZoneMap';
import { supabase, subscribeToCrewUpdates, subscribeToStats } from '@/lib/supabase/client';

interface Stats {
  totalCrews: number;
  totalProtesters: number;
  activeZones: number;
  nextRotation: string | null;
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats>({
    totalCrews: 0,
    totalProtesters: 0,
    activeZones: 0,
    nextRotation: null,
  });
  const [zones, setZones] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    const statsSub = subscribeToStats(() => fetchStats());

    // Auto-refresh every 50 seconds with smoother updates
    const interval = setInterval(fetchStats, 50000);

    return () => {
      crewSub.unsubscribe();
      statsSub.unsubscribe();
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
      }
    } catch (error) {
      console.error('Stats fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const cityName = process.env.NEXT_PUBLIC_CITY_NAME || 'Los Angeles';
  const cityShort = process.env.NEXT_PUBLIC_CITY_SHORT || 'LA';

  return (
    <main className="min-h-screen bg-protest-black">
      {/* Mobile-optimized Hero Section */}
      <section className="relative overflow-hidden border-b-4 border-protest-red">
        <div className="absolute inset-0 bg-gradient-to-br from-protest-red/30 to-transparent" />
        
        <div className="relative z-10 mobile-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h1 className="text-responsive font-protest uppercase mb-3 text-white">
              OVERWHELM {cityShort}
            </h1>
            
            <p className="text-responsive-sm mb-6 font-bold uppercase tracking-wider px-2">
              Join. Move. Overwhelm.
            </p>

            {/* Main CTA - Full width on mobile */}
            <div className="w-full max-w-lg mx-auto">
              <CrewAssignment />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Live Stats Section - Sticky on mobile */}
      <section className="border-b-4 border-white mobile-sticky">
        <div className="mobile-container">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-responsive-md font-protest uppercase text-center mb-6"
          >
            LIVE STATUS
          </motion.h2>
          
          <CrewStats stats={stats} isLoading={isLoading} />
          
          {stats.nextRotation && (
            <div className="mt-6">
              <NextRotation nextRotation={stats.nextRotation} />
            </div>
          )}
        </div>
      </section>

      {/* Zone Map Section */}
      <section className="border-b-4 border-protest-red">
        <div className="mobile-container">
          <ZoneMap zones={zones} />
        </div>
      </section>

      {/* Active Crews - Swipeable on mobile */}
      <section className="border-b-4 border-protest-red">
        <div className="mobile-container">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-responsive-md font-protest uppercase text-center mb-4"
          >
            ACTIVE ZONES
          </motion.h2>
          
          <p className="text-center text-base sm:text-lg mb-6 uppercase tracking-wider px-2">
            Find your crew&apos;s location
          </p>
          
          <ActiveCrews />
        </div>
      </section>

      {/* How It Works - Simplified for mobile */}
      <section className="border-b-4 border-white">
        <div className="mobile-container">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-responsive-md font-protest uppercase text-center mb-6"
          >
            HOW IT WORKS
          </motion.h2>
          
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-protest-gray p-6 border-l-4 border-protest-red"
            >
              <div className="flex items-center gap-4">
                <div className="text-4xl flex-shrink-0 font-protest">1</div>
                <div>
                  <h3 className="text-lg font-protest uppercase">Join</h3>
                  <p className="text-sm text-gray-300">Get assigned to nearest crew with space</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-protest-gray p-6 border-l-4 border-protest-yellow"
            >
              <div className="flex items-center gap-4">
                <div className="text-4xl flex-shrink-0 font-protest">2</div>
                <div>
                  <h3 className="text-lg font-protest uppercase">Move</h3>
                  <p className="text-sm text-gray-300">New zone every 30 minutes</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-protest-gray p-6 border-l-4 border-white"
            >
              <div className="flex items-center gap-4">
                <div className="text-4xl flex-shrink-0 font-protest">3</div>
                <div>
                  <h3 className="text-lg font-protest uppercase">Overwhelm</h3>
                  <p className="text-sm text-gray-300">Multiple crews, unstoppable movement</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer - Fixed bottom on mobile */}
      <footer className="mobile-bottom-safe text-center">
        <div className="mobile-container">
          <p className="text-base sm:text-lg font-bold uppercase tracking-wider mb-2">
            No permission needed.
          </p>
          <p className="text-sm sm:text-base text-gray-400 mb-4">
            Fork it. Deploy it. Own it.
          </p>
          <div>
            <a
              href="https://github.com/yourusername/overwhelm"
              className="btn-secondary inline-block"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Code
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}