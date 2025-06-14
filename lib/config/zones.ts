/**
 * Zone configuration using GeoJSON neighborhoods
 * Each city can provide their own GeoJSON file with neighborhood boundaries
 */

export interface Zone {
  id: string;
  name: string;
  type: 'primary' | 'secondary' | 'avoid';
  center: [number, number]; // [lng, lat] for GeoJSON compatibility
  bounds?: [[number, number], [number, number]]; // SW, NE corners
  properties?: Record<string, any>;
}

// High-priority protest zones for LA (can be customized per city)
export const PRIMARY_ZONES = [
  'Downtown',
  'Civic Center',
  'Bunker Hill',
  'Little Tokyo',
  'Arts District',
  'Chinatown',
  'Hollywood',
  'Westwood',
  'Venice',
  'MacArthur Park'
];

// Zones to avoid (police stations, federal buildings, etc)
export const AVOID_ZONES = [
  'LAPD Central Division',
  'Federal Building',
  'Metropolitan Detention Center'
];

/**
 * Load and parse GeoJSON neighborhood data
 * Returns zones suitable for crew assignment
 */
export async function loadZonesFromGeoJSON(geoJsonUrl: string): Promise<Zone[]> {
  try {
    const response = await fetch(geoJsonUrl);
    const geoData = await response.json();
    
    const zones: Zone[] = [];
    
    for (const feature of geoData.features) {
      const name = feature.properties?.name || feature.properties?.NAME || 'Unknown';
      const geometry = feature.geometry;
      
      // Calculate center point (rough centroid)
      let center: [number, number] = [0, 0];
      let bounds: [[number, number], [number, number]] | undefined;
      
      if (geometry.type === 'Polygon') {
        const coordinates = geometry.coordinates[0];
        center = calculateCentroid(coordinates);
        bounds = calculateBounds(coordinates);
      } else if (geometry.type === 'MultiPolygon') {
        // Use the first polygon for simplicity
        const coordinates = geometry.coordinates[0][0];
        center = calculateCentroid(coordinates);
        bounds = calculateBounds(coordinates);
      }
      
      // Determine zone type
      let type: Zone['type'] = 'secondary';
      if (PRIMARY_ZONES.some(pz => name.toLowerCase().includes(pz.toLowerCase()))) {
        type = 'primary';
      } else if (AVOID_ZONES.some(az => name.toLowerCase().includes(az.toLowerCase()))) {
        type = 'avoid';
      }
      
      zones.push({
        id: feature.properties?.id || name.toLowerCase().replace(/\s+/g, '-'),
        name,
        type,
        center,
        bounds,
        properties: feature.properties
      });
    }
    
    return zones;
  } catch (error) {
    console.error('Failed to load GeoJSON zones:', error);
    // Fallback to default zones
    return getDefaultZones();
  }
}

/**
 * Calculate rough centroid of polygon coordinates
 */
function calculateCentroid(coordinates: number[][]): [number, number] {
  let sumLng = 0;
  let sumLat = 0;
  
  for (const [lng, lat] of coordinates) {
    sumLng += lng;
    sumLat += lat;
  }
  
  return [sumLng / coordinates.length, sumLat / coordinates.length];
}

/**
 * Calculate bounding box of polygon
 */
function calculateBounds(coordinates: number[][]): [[number, number], [number, number]] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  
  for (const [lng, lat] of coordinates) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  
  return [[minLng, minLat], [maxLng, maxLat]];
}

/**
 * Fallback zones if GeoJSON fails to load
 */
export function getDefaultZones(): Zone[] {
  return [
    { id: 'downtown', name: 'Downtown', type: 'primary', center: [-118.2437, 34.0522] },
    { id: 'hollywood', name: 'Hollywood', type: 'primary', center: [-118.3287, 34.0928] },
    { id: 'venice', name: 'Venice', type: 'primary', center: [-118.4695, 33.9850] },
    { id: 'westwood', name: 'Westwood', type: 'primary', center: [-118.4452, 34.0689] },
    { id: 'echo-park', name: 'Echo Park', type: 'secondary', center: [-118.2606, 34.0781] },
    { id: 'silver-lake', name: 'Silver Lake', type: 'secondary', center: [-118.2703, 34.0869] },
    { id: 'koreatown', name: 'Koreatown', type: 'secondary', center: [-118.3009, 34.0577] },
    { id: 'beverly-hills', name: 'Beverly Hills', type: 'secondary', center: [-118.4001, 34.0736] },
    { id: 'santa-monica', name: 'Santa Monica', type: 'secondary', center: [-118.4912, 34.0195] },
    { id: 'culver-city', name: 'Culver City', type: 'secondary', center: [-118.3965, 34.0211] }
  ];
}

/**
 * Get zones suitable for crew assignment (excluding avoid zones)
 */
export function getAssignableZones(allZones: Zone[]): Zone[] {
  return allZones.filter(zone => zone.type !== 'avoid');
}

/**
 * Get high-priority zones for initial crew placement
 */
export function getPrimaryZones(allZones: Zone[]): Zone[] {
  return allZones.filter(zone => zone.type === 'primary');
}