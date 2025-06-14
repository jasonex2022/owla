'use client';

import { useState, useEffect } from 'react';

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
  const [isTimeToMove, setIsTimeToMove] = useState(false);
  const [isInitialCheckIn, setIsInitialCheckIn] = useState(true);

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
          // If they've been with crew for more than 5 minutes, assume they've checked in
          if (Date.now() - parsed.timestamp > 5 * 60 * 1000) {
            setIsInitialCheckIn(false);
          }
        } else {
          localStorage.removeItem('overwhelm-crew');
        }
      } catch {
        localStorage.removeItem('overwhelm-crew');
      }
    }
  }, []);

  // Function to check for updates
  const checkUpdates = async () => {
    if (!crew) return;
    
    try {
      // If it's time to move, get next zone assignment
      if (isTimeToMove) {
        const params = new URLSearchParams({
          getNextZone: 'true',
          currentZone: crew.zoneId,
          crewId: crew.crewId.toString()
        });
        
        const response = await fetch(`/api/crew?${params}`);
        const data = await response.json();
        
        if (data.success && data.crew) {
          setCrew(data.crew);
          localStorage.setItem('overwhelm-crew', JSON.stringify({
            crew: data.crew,
            timestamp: Date.now(),
          }));
          setIsTimeToMove(false); // Reset the flag
        }
      } else {
        // Normal update check
        const response = await fetch('/api/crew');
        const data = await response.json();
        
        if (data.success && data.crew) {
          setCrew(data.crew);
          localStorage.setItem('overwhelm-crew', JSON.stringify({
            crew: data.crew,
            timestamp: Date.now(),
          }));
        }
      }
    } catch (error) {
      console.error('Update check failed:', error);
    }
  };

  // Check for zone updates periodically
  useEffect(() => {
    if (!crew) return;

    // Check every 10 minutes for updates
    const interval = setInterval(checkUpdates, 600000); // 10 minutes
    return () => clearInterval(interval);
  }, [crew?.zoneId]);

  // Check if it's time to move
  useEffect(() => {
    if (!crew) return;
    
    const checkTime = () => {
      const now = new Date();
      const target = new Date(crew.nextRotation);
      const diff = target.getTime() - now.getTime();
      const wasTimeToMove = isTimeToMove;
      const nowTimeToMove = diff <= 0;
      setIsTimeToMove(nowTimeToMove);
      
      // If timer just hit zero, automatically check for new zone
      if (!wasTimeToMove && nowTimeToMove) {
        checkUpdates();
      }
    };
    
    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [crew?.nextRotation, isTimeToMove]);

  async function joinCrew() {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      // Re-verify location at join time (security requirement)
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0 // Don't use cached position
        });
      });
      
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      // Get nearest zone from sessionStorage
      const nearestZoneStr = sessionStorage.getItem('overwhelm-nearest-zone');
      let zoneParam = '';
      if (nearestZoneStr) {
        const nearestZone = JSON.parse(nearestZoneStr);
        zoneParam = `zone=${nearestZone.id}`;
      }
      
      // Include coordinates for server-side verification
      const params = new URLSearchParams({
        ...(zoneParam && { zone: nearestZoneStr ? JSON.parse(nearestZoneStr).id : '' }),
        lat: lat.toString(),
        lng: lng.toString()
      });
      
      const response = await fetch(`/api/crew?${params}`);
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to join crew');
      }
      
      if (data.crew) {
        setCrew(data.crew);
        setHasJoined(true);
        
        // Save to localStorage for persistence
        localStorage.setItem('overwhelm-crew', JSON.stringify({
          crew: data.crew,
          timestamp: Date.now(),
        }));
      }
    } catch (error: any) {
      console.error('Failed to join crew:', error);
      
      // Handle location errors
      if (error.name === 'GeolocationPositionError' || error.code === 1) {
        alert('Location access required. Please enable location services and try again.');
      } else if (error.message) {
        alert(error.message);
      } else {
        alert('Unable to join crew. Please ensure you are near a protest zone.');
      }
      
      // Do NOT show fallback crew - security requirement
      setHasJoined(false);
    } finally {
      setIsLoading(false);
    }
  }

  function leaveCrew() {
    setCrew(null);
    setHasJoined(false);
    localStorage.removeItem('overwhelm-crew');
  }

  // Convert zone ID to letter
  const getZoneLetter = (zoneId: string) => {
    const id = parseInt(zoneId);
    return String.fromCharCode(65 + (id - 1)); // A, B, C, etc.
  };

  if (!hasJoined) {
    return (
      <div className="text-center">
        <button
          onClick={joinCrew}
          disabled={isLoading}
          className="btn"
        >
          {isLoading ? 'Finding nearest crew...' : 'Join a crew'}
        </button>
        
        <p className="mt-4 text-sm text-muted">
          No login required • No personal data stored
        </p>
      </div>
    );
  }

  return (
    <div className="border-2 border-minimal-border">
      {crew && (
        <>
          {/* Header */}
          <div className="p-4 bg-gray-50 border-b border-minimal-border">
            <div className="text-center">
              <p className="text-sm text-muted uppercase tracking-wider">Your Assignment</p>
              <h3 className="text-xl font-bold">{crew.crewName}</h3>
              <p className="text-sm text-muted">{crew.estimatedSize} participants</p>
            </div>
          </div>

          {/* Zone Display - Different for initial check-in vs active */}
          {isInitialCheckIn ? (
            <div className="p-6 bg-green-50 text-center">
              <p className="text-xs text-muted uppercase tracking-wider mb-1">GO TO</p>
              <p className="text-5xl font-bold mb-2">ZONE {getZoneLetter(crew.zoneId)}</p>
              <a 
                href={`https://www.google.com/maps/search/${encodeURIComponent(crew.zoneName.split('(')[0].trim())},+Los+Angeles,+CA`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold mb-3 text-minimal-focus hover:underline block"
              >
                {crew.zoneName}
              </a>
              <p className="text-sm text-muted">Join your crew at this location</p>
            </div>
          ) : (
            <div className={`p-6 text-center ${isTimeToMove ? 'bg-red-50' : 'bg-orange-50'}`}>
              <p className="text-xs text-muted uppercase tracking-wider mb-1">
                {isTimeToMove ? 'TIME TO MOVE TO NEW ZONE' : 'YOUR CURRENT ZONE'}
              </p>
              <p className="text-5xl font-bold mb-2">ZONE {getZoneLetter(crew.zoneId)}</p>
              <a 
                href={`https://www.google.com/maps/search/${encodeURIComponent(crew.zoneName.split('(')[0].trim())},+Los+Angeles,+CA`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold text-minimal-focus hover:underline block"
              >
                {crew.zoneName}
              </a>
              {isTimeToMove && (
                <button
                  onClick={checkUpdates}
                  className="mt-4 px-4 py-2 bg-red-600 text-white font-semibold rounded hover:bg-red-700"
                >
                  Get New Zone Assignment
                </button>
              )}
            </div>
          )}

          {/* Timer */}
          <div className="p-4 bg-gray-100 text-center border-t border-b border-minimal-border">
            <p className="text-xs text-muted uppercase tracking-wider mb-1">
              {isInitialCheckIn ? 'Crew moves in' : isTimeToMove ? 'Movement in Progress' : 'Time Until Next Movement'}
            </p>
            <div className="text-2xl font-bold font-mono">
              <CountdownToRotation nextRotation={crew.nextRotation} />
            </div>
            <p className="text-xs text-muted mt-1">
              {isInitialCheckIn ? 'Join before movement or wait for next cycle' : 'Crews move to new zones every 30 minutes'}
            </p>
          </div>

          {/* Actions */}
          <div className="p-4">
            {isInitialCheckIn ? (
              <>
                <button
                  onClick={() => setIsInitialCheckIn(false)}
                  className="btn w-full mb-3"
                >
                  I&apos;m with my crew
                </button>
                <button
                  onClick={leaveCrew}
                  className="text-sm text-muted underline w-full"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={leaveCrew}
                className="text-sm text-muted underline w-full"
              >
                Leave crew
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CountdownToRotation({ nextRotation }: { nextRotation: string }) {
  const [timeLeft, setTimeLeft] = useState('Loading...');
  const [isTimeUp, setIsTimeUp] = useState(false);

  useEffect(() => {
    // Calculate immediately on mount
    const updateTimer = () => {
      const now = new Date();
      const target = new Date(nextRotation);
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('TIME TO MOVE!');
        setIsTimeUp(true);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        setIsTimeUp(false);
      }
    };

    // Update immediately
    updateTimer();

    // Then update every second
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [nextRotation]);

  return (
    <span className={isTimeUp ? 'text-danger animate-pulse' : ''}>
      {timeLeft}
    </span>
  );
}