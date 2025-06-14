'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { checkIfNearProtest, formatDistance, estimateWalkingTime } from '@/lib/services/geofence';

interface LocationGateProps {
  children: React.ReactNode;
  onLocationChecked?: (allowed: boolean, nearestZone?: any) => void;
}

export default function LocationGate({ children, onLocationChecked }: LocationGateProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [checkResult, setCheckResult] = useState<{
    allowed: boolean;
    reason?: string;
    distance?: number;
    nearestZone?: any;
  } | null>(null);
  const [crew, setCrew] = useState<any>(null);
  const [crewError, setCrewError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user has verified location this session
    const locationVerified = sessionStorage.getItem('overwhelm-location-verified');
    if (locationVerified === 'true') {
      setIsAllowed(true);
    }
    setIsChecking(false);
  }, []);

  async function performLocationCheck() {
    setIsChecking(true);
    
    try {
      const result = await checkIfNearProtest();
      setCheckResult(result);
      setIsAllowed(result.allowed);
      
      if (result.allowed && result.nearestZone) {
        // Only store the nearest zone for crew assignment
        sessionStorage.setItem('overwhelm-nearest-zone', JSON.stringify(result.nearestZone));
        
        // Also get crew assignment right away
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });
          });
          
          const params = new URLSearchParams({
            zone: result.nearestZone.id.toString(),
            lat: position.coords.latitude.toString(),
            lng: position.coords.longitude.toString()
          });
          
          const crewResponse = await fetch(`/api/crew?${params}`);
          const crewData = await crewResponse.json();
          
          if (crewData.success && crewData.crew) {
            setCrew(crewData.crew);
            // Store crew assignment
            localStorage.setItem('overwhelm-crew', JSON.stringify({
              crew: crewData.crew,
              timestamp: Date.now(),
            }));
          } else {
            setCrewError(crewData.error || 'Failed to assign crew');
          }
        } catch (error) {
          console.error('Crew assignment error:', error);
          setCrewError('Unable to assign crew. Please try again.');
        }
      }
      
      // Use setTimeout to avoid state update during render
      setTimeout(() => {
        onLocationChecked?.(result.allowed, result.nearestZone);
      }, 0);
    } catch (error) {
      console.error('Location check error:', error);
      // Fail closed - block access on error
      setIsAllowed(false);
      setCheckResult({
        allowed: false,
        reason: 'Location check failed. Please try again.'
      });
    } finally {
      setIsChecking(false);
    }
  }

  // No bypass allowed - security requirement

  const walkingRadius = parseFloat(process.env.NEXT_PUBLIC_WALKING_RADIUS_KM || '4.8');

  // Show initial state or checking
  if (isChecking) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg mb-2">Checking location...</p>
          <p className="text-sm text-muted">
            Please wait while we verify your location
          </p>
        </div>
      </div>
    );
  }

  // Show verification needed
  if (isAllowed === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full border border-minimal-border p-8 text-center">
          <Image 
            src="/fist.png" 
            alt="Solidarity" 
            width={48} 
            height={72}
            className="mx-auto mb-6 opacity-80"
          />
          <h2 className="text-xl font-semibold mb-4">
            Location Verification Required
          </h2>
          
          <div className="text-left mb-6 space-y-3">
            <p className="text-sm font-semibold">Why Use Overwhelm?</p>
            <ul className="space-y-2 text-sm text-muted">
              <li className="flex items-start">
                <span className="mr-2">→</span>
                <span><strong>Stay Together:</strong> Groups protesters into crews for maximum impact, protestor safety, and movement coordination.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">→</span>
                <span><strong>Move Safely:</strong> Coordinates movement of crews to avoid danger, and amplify the impact of the movement.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">→</span>
                <span><strong>Fill the Streets:</strong> Distributes crowds across zones to create a unified, visible movement.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">→</span>
                <span><strong>Stay Anonymous:</strong> No sign-ups, no tracking, no data stored, no bullshit. Fuck big tech.</span>
              </li>
            </ul>
          </div>
          <button
            onClick={performLocationCheck}
            className="btn"
          >
            Verify My Location
          </button>
          <p className="text-xs text-muted mt-4">
            Your location is only used for zone assignment and is never stored. You will be asked to verify location every time you check in to a protest. This keeps access limited to our people on the ground.
          </p>
        </div>
      </div>
    );
  }

  // Show block message if not allowed
  if (!isAllowed && checkResult) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full border border-minimal-border p-8 text-center">
          <h2 className="text-xl font-semibold mb-4">
            Location Verification Required - Never stored.
          </h2>
          
          <p className="mb-6">
            {checkResult.reason}
          </p>
          
          <div className="bg-minimal-border p-4 mb-6">
            <p className="text-sm text-muted mb-2">
              You must be within walking distance
            </p>
            <p className="font-semibold">
              {formatDistance(walkingRadius)} radius
            </p>
            {checkResult.distance && (
              <p className="text-sm text-muted mt-2">
                You are {estimateWalkingTime(checkResult.distance)} away
              </p>
            )}
          </div>
          
          <p className="text-sm text-muted mb-6">
            This is an open source tool.{' '}
            <a 
              href="https://github.com/overwhelmcity/overwhelm" 
              className="text-minimal-focus"
              target="_blank"
              rel="noopener noreferrer"
            >
              Deploy for your city
            </a>
          </p>
          
          <button
            onClick={performLocationCheck}
            className="btn"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Location allowed - show crew assignment or error
  if (crew) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full border-2 border-minimal-border p-8 text-center"
        >
          <Image 
            src="/fist.png" 
            alt="Solidarity" 
            width={48} 
            height={72}
            className="mx-auto mb-4"
          />
          <h2 className="text-xl font-semibold mb-4">Welcome to the Movement</h2>
          
          <div className="p-6 bg-green-50 mb-6">
            <p className="text-xs text-muted uppercase tracking-wider mb-1">GO TO</p>
            <p className="text-5xl font-bold mb-2">ZONE {String.fromCharCode(65 + (parseInt(crew.zoneId) - 1))}</p>
            <p className="text-lg font-semibold mb-3">{crew.zoneName}</p>
            <p className="text-sm text-muted">Join {crew.crewName} at this location</p>
          </div>
          
          <p className="text-sm text-muted mb-6">
            {crew.estimatedSize} people in your crew
          </p>
          
          <button
            onClick={() => {
              // Store verification in session and reload
              sessionStorage.setItem('overwhelm-location-verified', 'true');
              window.location.reload();
            }}
            className="btn w-full"
          >
            I&apos;m with my crew
          </button>
          
          <p className="text-xs text-muted mt-4">
            Crew rotations happen every 30 minutes
          </p>
        </motion.div>
      </div>
    );
  }
  
  // Show error if crew assignment failed
  if (crewError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="text-xl font-semibold mb-4 text-red-900">
            Crew Assignment Failed
          </h2>
          <p className="text-red-700 mb-6">{crewError}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  // If location is allowed but no crew assignment process is happening, show the main content
  if (isAllowed && !crew && !crewError) {
    return <>{children}</>;
  }
  
  // Still loading crew assignment
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-lg mb-2">Assigning crew...</p>
        <p className="text-sm text-muted">
          Finding the best crew for your location
        </p>
      </div>
    </div>
  );
}