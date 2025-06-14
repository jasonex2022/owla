'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationToggle from './NotificationToggle';
import { checkForCrewUpdates } from '@/lib/services/notifications';

interface Crew {
  crewId: number;
  crewName: string;
  estimatedSize: number;
  zoneId: string;
  zoneName: string;
  nextRotation: string;
}

export default function CrewAssignment() {
  const [crew, setCrew] = useState<Crew | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

  // Check if user already has a crew (from localStorage)
  useEffect(() => {
    const savedCrew = localStorage.getItem('overwhelm-crew');
    if (savedCrew) {
      try {
        const parsed = JSON.parse(savedCrew);
        // Check if crew assignment is still valid (within 2 hours)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 2 * 60 * 60 * 1000) {
          setCrew(parsed.crew);
          setHasJoined(true);
        } else {
          localStorage.removeItem('overwhelm-crew');
        }
      } catch {
        localStorage.removeItem('overwhelm-crew');
      }
    }
  }, []);

  // Check for zone updates periodically
  useEffect(() => {
    if (!crew) return;

    const checkUpdates = async () => {
      try {
        // Include zone preference if available
        const nearestZoneStr = sessionStorage.getItem('overwhelm-nearest-zone');
        let nearestZone = null;
        if (nearestZoneStr) {
          try {
            nearestZone = JSON.parse(nearestZoneStr);
          } catch {}
        }
        
        const url = nearestZone 
          ? `/api/crew?zone=${nearestZone.id}`
          : '/api/crew';
          
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.crew) {
          // Check if zone changed
          if (crew.zoneId !== data.crew.zoneId) {
            await checkForCrewUpdates(crew.zoneId, data.crew.zoneId);
          }
          
          setCrew(data.crew);
          localStorage.setItem('overwhelm-crew', JSON.stringify({
            crew: data.crew,
            timestamp: Date.now(),
          }));
        }
      } catch (error) {
        console.error('Update check failed:', error);
      }
    };

    // Check every 50 seconds for smoother experience
    const interval = setInterval(checkUpdates, 50000);
    return () => clearInterval(interval);
  }, [crew?.zoneId]);

  async function joinCrew() {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      // Get nearest zone from session storage
      const nearestZoneStr = sessionStorage.getItem('overwhelm-nearest-zone');
      let nearestZone = null;
      if (nearestZoneStr) {
        try {
          nearestZone = JSON.parse(nearestZoneStr);
        } catch {}
      }
      
      // Include zone preference in request
      const url = nearestZone 
        ? `/api/crew?zone=${nearestZone.id}`
        : '/api/crew';
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.crew) {
        setCrew(data.crew);
        setHasJoined(true);
        
        // Save to localStorage for persistence
        localStorage.setItem('overwhelm-crew', JSON.stringify({
          crew: data.crew,
          timestamp: Date.now(),
        }));
      }
    } catch (error) {
      console.error('Failed to join crew:', error);
      // Show fallback crew
      const fallbackCrew = {
        crewId: 1,
        crewName: 'Sunset',
        estimatedSize: 150,
        zoneId: 'downtown',
        zoneName: 'Downtown',
        nextRotation: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
      setCrew(fallbackCrew);
      setHasJoined(true);
    } finally {
      setIsLoading(false);
    }
  }

  function leaveCrew() {
    setCrew(null);
    setHasJoined(false);
    localStorage.removeItem('overwhelm-crew');
  }

  if (!hasJoined) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center"
      >
        <button
          onClick={joinCrew}
          disabled={isLoading}
          className="btn-protest focus-visible-protest"
        >
          {isLoading ? (
            <span className="animate-pulse">FINDING CREW...</span>
          ) : (
            'JOIN THE MOVEMENT'
          )}
        </button>
        
        <p className="mt-6 text-gray-400 uppercase text-sm tracking-wider px-4">
          No login • No tracking • Just action
        </p>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {crew && (
        <motion.div
          key="crew-info"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="bg-protest-gray border-4 border-protest-red p-6 sm:p-8"
        >
          {/* Crew Info - Compact on mobile */}
          <div className="text-center mb-4 sm:mb-6">
            <h3 className="text-responsive-md font-protest uppercase mb-1">
              {crew.crewName}
            </h3>
            <p className="text-protest-yellow text-xl sm:text-2xl font-bold uppercase">
              {crew.estimatedSize} STRONG
            </p>
          </div>

          {/* Current Zone - Most important info */}
          <div className="bg-black/70 p-5 sm:p-6 mb-4 sm:mb-6 rounded-none border-2 border-protest-red">
            <p className="text-xs sm:text-sm uppercase tracking-wider mb-1 text-gray-400">
              GO TO
            </p>
            <h4 className="text-critical">
              {crew.zoneName}
            </h4>
            <p className="mt-2 text-sm sm:text-base text-gray-300">
              Move now. Stay together.
            </p>
          </div>

          {/* Action buttons - Stack on mobile */}
          <div className="space-y-3 mb-4">
            <button
              onClick={() => window.location.reload()}
              className="btn-secondary"
            >
              REFRESH
            </button>
            
            <NotificationToggle />
          </div>

          {/* Next rotation - Always visible */}
          <div className="bg-protest-yellow text-black p-4 text-center">
            <p className="text-sm font-bold uppercase tracking-wider">
              Next move in
            </p>
            <div className="text-2xl sm:text-3xl font-protest">
              <CountdownToRotation nextRotation={crew.nextRotation} />
            </div>
          </div>

          {/* Leave crew - Less prominent */}
          <button
            onClick={leaveCrew}
            className="mt-4 text-sm text-gray-500 underline w-full text-center"
          >
            Leave crew
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CountdownToRotation({ nextRotation }: { nextRotation: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const target = new Date(nextRotation);
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('NOW!');
        // Auto-refresh after rotation
        setTimeout(() => window.location.reload(), 2000);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [nextRotation]);

  return <>{timeLeft}</>;
}