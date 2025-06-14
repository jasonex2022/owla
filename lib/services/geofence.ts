/**
 * Geofencing for protest areas - all client-side
 * No location data sent to server
 */

interface GeofenceConfig {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  walkingRadiusKm: number; // Much tighter radius for crew assignment
  cityName: string;
}

interface Zone {
  id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  type: string;
}

/**
 * Check if user is within walking distance of active protest
 * Uses much tighter radius than city-wide check
 */
export async function checkIfNearProtest(): Promise<{
  allowed: boolean;
  nearestZone?: Zone;
  distance?: number;
  reason?: string;
}> {
  // Check for test mode
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const testMode = urlParams.get('test');
    const testKey = urlParams.get('key');
    
    // Secret test key for development
    if (testMode === 'true' && testKey === process.env.NEXT_PUBLIC_TEST_KEY) {
      return {
        allowed: true,
        nearestZone: {
          id: '1',
          name: 'City Hall',
          center_lat: 34.0537,
          center_lng: -118.2427,
          type: 'primary'
        },
        distance: 0.5,
        reason: 'Test mode enabled'
      };
    }
  }

  const config: GeofenceConfig = {
    centerLat: parseFloat(process.env.NEXT_PUBLIC_CITY_CENTER_LAT || '34.0522'),
    centerLng: parseFloat(process.env.NEXT_PUBLIC_CITY_CENTER_LNG || '-118.2437'),
    radiusKm: parseFloat(process.env.NEXT_PUBLIC_CITY_RADIUS_KM || '50'),
    walkingRadiusKm: parseFloat(process.env.NEXT_PUBLIC_WALKING_RADIUS_KM || '2'), // 2km = ~25 min walk
    cityName: process.env.NEXT_PUBLIC_CITY_NAME || 'Los Angeles'
  };

  if (!('geolocation' in navigator)) {
    return { 
      allowed: false, 
      reason: 'Location services are required to use this tool' 
    };
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, // Need accurate location for zone assignment
        timeout: 10000,
        maximumAge: 60000 // Accept 1-minute old position
      });
    });

    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;

    // First check if in city at all
    const cityDistance = calculateDistance(
      userLat, userLng,
      config.centerLat, config.centerLng
    );

    if (cityDistance > config.radiusKm) {
      const miles = Math.round(cityDistance * 0.621371);
      return {
        allowed: false,
        reason: `You're ${miles} miles from ${config.cityName}. This tool is for on-the-ground protesters only.`,
        distance: cityDistance
      };
    }

    // Get active zones from API
    const zones = await fetchActiveZones();
    
    // Find nearest zone
    let nearestZone: Zone | null = null;
    let nearestDistance = Infinity;

    for (const zone of zones) {
      const distance = calculateDistance(
        userLat, userLng,
        zone.center_lat, zone.center_lng
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestZone = zone;
      }
    }

    // Check if within walking distance of nearest zone
    if (nearestZone && nearestDistance <= config.walkingRadiusKm) {
      return {
        allowed: true,
        nearestZone,
        distance: nearestDistance
      };
    } else {
      const walkingMiles = (config.walkingRadiusKm * 0.621371).toFixed(1);
      const nearestMiles = Math.round(nearestDistance * 0.621371);
      return {
        allowed: false,
        reason: `You need to be within walking distance (${walkingMiles} miles) of an active protest zone. Nearest zone is ${nearestMiles} miles away.`,
        distance: nearestDistance
      };
    }

  } catch (error) {
    console.log('Geolocation error:', error);
    // If user denies location, block access for security
    return { 
      allowed: false, 
      reason: 'Location access required. Please enable location services and reload.' 
    };
  }
}

/**
 * Get user's nearest zone for crew assignment
 * Only called after location is verified
 */
export async function getNearestZone(
  userLat: number,
  userLng: number,
  zones: Zone[]
): Promise<Zone | null> {
  let nearestZone: Zone | null = null;
  let nearestDistance = Infinity;

  for (const zone of zones) {
    const distance = calculateDistance(
      userLat, userLng,
      zone.center_lat, zone.center_lng
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestZone = zone;
    }
  }

  // Only return if within walking distance
  const walkingRadius = parseFloat(process.env.NEXT_PUBLIC_WALKING_RADIUS_KM || '2');
  if (nearestDistance <= walkingRadius) {
    return nearestZone;
  }

  return null;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Fetch active zones from API
 */
async function fetchActiveZones(): Promise<Zone[]> {
  try {
    const response = await fetch('/api/zones');
    const data = await response.json();
    
    if (data.success && data.zones) {
      // Filter to only active zones with crews
      return data.zones.filter((z: any) => 
        z.status.crews.length > 0 || z.type === 'primary'
      );
    }
  } catch (error) {
    console.error('Failed to fetch zones:', error);
  }
  
  // Return default zones if fetch fails
  return getDefaultActiveZones();
}

/**
 * Default zones for LA (fallback)
 */
function getDefaultActiveZones(): Zone[] {
  return [
    { id: 'downtown', name: 'Downtown', center_lat: 34.0522, center_lng: -118.2437, type: 'primary' },
    { id: 'hollywood', name: 'Hollywood', center_lat: 34.0928, center_lng: -118.3287, type: 'primary' },
    { id: 'westwood', name: 'Westwood', center_lat: 34.0689, center_lng: -118.4452, type: 'primary' },
  ];
}

/**
 * Format distance for display in miles
 */
export function formatDistance(km: number): string {
  const miles = km * 0.621371;
  if (miles < 0.1) {
    const feet = Math.round(miles * 5280);
    return `${feet} feet`;
  }
  if (miles < 1) {
    return `${miles.toFixed(1)} miles`;
  }
  return `${Math.round(miles)} miles`;
}

/**
 * Estimate walking time
 */
export function estimateWalkingTime(km: number): string {
  const minutes = Math.round(km * 12); // ~5km/h walking speed
  if (minutes < 60) {
    return `${minutes} min walk`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}min walk`;
}