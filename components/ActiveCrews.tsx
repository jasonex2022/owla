'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { checkForDangerAlerts } from '@/lib/services/notifications';

interface Zone {
  id: number;
  name: string;
  type: string;
  center_lat: number;
  center_lng: number;
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

export default function ActiveCrews() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);

  useEffect(() => {
    fetchZones();
    const interval = setInterval(fetchZones, 50000); // Refresh every 50s
    return () => clearInterval(interval);
  }, []);

  async function fetchZones() {
    try {
      const response = await fetch('/api/zones');
      const data = await response.json();
      if (data.success) {
        setZones(data.zones);
        
        // Check for new danger alerts
        const policeActivity = data.zones
          .filter((z: Zone) => z.status.policeActivity)
          .map((z: Zone) => ({
            zone_id: z.id.toString(),
            severity: z.status.policeActivity!.severity
          }));
        
        if (policeActivity.length > 0) {
          await checkForDangerAlerts(policeActivity);
        }
      }
    } catch (error) {
      console.error('Failed to fetch zones:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const activeZones = zones.filter(z => z.status.crews.length > 0);
  const dangerZones = zones.filter(z => z.status.policeActivity?.severity === 'high' || z.status.policeActivity?.severity === 'critical');

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-xl uppercase tracking-wider animate-pulse">LOADING ZONES...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Danger Zones Warning */}
      {dangerZones.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="alert-danger mb-8"
        >
          <h3 className="text-xl mb-2">DANGER ZONES - AVOID</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {dangerZones.map(zone => (
              <div key={zone.id} className="bg-black/50 p-3">
                <p className="font-bold">{zone.name}</p>
                <p className="text-sm opacity-80">
                  {zone.status.policeActivity?.description || 'Heavy police presence'}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Active Zones - Horizontal scroll on mobile */}
      <div className="md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6">
        <div className="md:hidden overflow-x-auto swipe-card flex gap-4 pb-4 -mx-4 px-4">
          {activeZones.map((zone, index) => (
            <motion.div
              key={zone.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="crew-card flex-shrink-0 w-80 cursor-pointer"
              onClick={() => setSelectedZone(zone)}
            >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-protest uppercase">{zone.name}</h3>
              {zone.type === 'primary' && (
                <span className="zone-badge">PRIMARY</span>
              )}
            </div>

            <div className="space-y-3">
              {zone.status.crews.map(crew => (
                <div key={crew.id} className="bg-black/30 p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{crew.name}</span>
                    <span className="text-protest-yellow">{crew.size} people</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-600">
              <p className="text-2xl font-protest text-protest-red">
                {zone.status.totalProtesters} TOTAL
              </p>
            </div>

            {zone.status.policeActivity && (
              <div className="mt-3 text-sm text-yellow-400 uppercase">
                Police activity
              </div>
            )}
            </motion.div>
          ))}
        </div>
        
        {/* Desktop grid */}
        <div className="hidden md:contents">
          {activeZones.map((zone, index) => (
            <motion.div
              key={zone.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="crew-card cursor-pointer transform hover:scale-105 transition-transform"
              onClick={() => setSelectedZone(zone)}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-protest uppercase">{zone.name}</h3>
                {zone.type === 'primary' && (
                  <span className="zone-badge">PRIMARY</span>
                )}
              </div>

              <div className="space-y-3">
                {zone.status.crews.map(crew => (
                  <div key={crew.id} className="bg-black/30 p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold">{crew.name}</span>
                      <span className="text-protest-yellow">{crew.size} people</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-600">
                <p className="text-2xl font-protest text-protest-red">
                  {zone.status.totalProtesters} TOTAL
                </p>
              </div>

              {zone.status.policeActivity && (
                <div className="mt-3 text-sm text-yellow-400 uppercase">
                  Police activity
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* No Active Zones */}
      {activeZones.length === 0 && (
        <div className="text-center py-12">
          <p className="text-xl uppercase tracking-wider mb-2">
            NO ACTIVE CREWS
          </p>
          <p className="text-gray-400 uppercase">
            Be the first to join
          </p>
        </div>
      )}

      {/* Zone Detail Modal */}
      <AnimatePresence>
        {selectedZone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedZone(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-protest-gray border-4 border-protest-red p-6 sm:p-8 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl sm:text-2xl font-protest uppercase">
                  {selectedZone.name}
                </h3>
                <button
                  onClick={() => setSelectedZone(null)}
                  className="text-3xl leading-none text-gray-400 hover:text-white"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm uppercase tracking-wider text-gray-400 mb-2">
                    Active Crews ({selectedZone.status.crews.length})
                  </p>
                  {selectedZone.status.crews.map(crew => (
                    <div key={crew.id} className="flex justify-between py-2">
                      <span>{crew.name}</span>
                      <span className="text-protest-yellow">{crew.size} people</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-600 pt-4">
                  <p className="text-3xl font-protest text-protest-red">
                    {selectedZone.status.totalProtesters} PROTESTERS
                  </p>
                </div>

                {selectedZone.status.policeActivity && (
                  <div className="bg-red-900/50 p-4 border-2 border-red-600">
                    <p className="font-bold uppercase">POLICE ACTIVITY</p>
                    <p className="text-sm mt-1">
                      {selectedZone.status.policeActivity.description}
                    </p>
                  </div>
                )}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}