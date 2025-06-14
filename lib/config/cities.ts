/**
 * City configurations for multi-city deployment
 * Each city gets its own subdomain or path
 */

export interface CityConfig {
  id: string;
  name: string;
  shortName: string;
  center: {
    lat: number;
    lng: number;
  };
  radiusKm: number;
  walkingRadiusKm: number;
  timezone: string;
  primaryZones: string[];
  geoJsonUrl?: string;
}

export const CITIES: Record<string, CityConfig> = {
  la: {
    id: 'la',
    name: 'Los Angeles',
    shortName: 'LA',
    center: {
      lat: 34.0522,
      lng: -118.2437
    },
    radiusKm: 50,
    walkingRadiusKm: 2,
    timezone: 'America/Los_Angeles',
    primaryZones: ['Downtown', 'Hollywood', 'Westwood', 'Venice'],
    geoJsonUrl: '/data/los-angeles-county.geojson'
  },
  
  nyc: {
    id: 'nyc',
    name: 'New York City',
    shortName: 'NYC',
    center: {
      lat: 40.7128,
      lng: -74.0060
    },
    radiusKm: 30,
    walkingRadiusKm: 1.5,
    timezone: 'America/New_York',
    primaryZones: ['Times Square', 'Union Square', 'Washington Square', 'Brooklyn Bridge'],
    geoJsonUrl: '/data/new-york-city.geojson'
  },
  
  chi: {
    id: 'chi',
    name: 'Chicago',
    shortName: 'CHI',
    center: {
      lat: 41.8781,
      lng: -87.6298
    },
    radiusKm: 40,
    walkingRadiusKm: 2,
    timezone: 'America/Chicago',
    primaryZones: ['Loop', 'Grant Park', 'Federal Plaza', 'Millennium Park'],
    geoJsonUrl: '/data/chicago.geojson'
  },
  
  sf: {
    id: 'sf',
    name: 'San Francisco',
    shortName: 'SF',
    center: {
      lat: 37.7749,
      lng: -122.4194
    },
    radiusKm: 20,
    walkingRadiusKm: 1.5,
    timezone: 'America/Los_Angeles',
    primaryZones: ['Union Square', 'Civic Center', 'Mission', 'Castro'],
    geoJsonUrl: '/data/san-francisco.geojson'
  },
  
  dc: {
    id: 'dc',
    name: 'Washington DC',
    shortName: 'DC',
    center: {
      lat: 38.9072,
      lng: -77.0369
    },
    radiusKm: 20,
    walkingRadiusKm: 1.5,
    timezone: 'America/New_York',
    primaryZones: ['White House', 'Capitol', 'Lincoln Memorial', 'BLM Plaza'],
    geoJsonUrl: '/data/washington-dc.geojson'
  },
  
  sea: {
    id: 'sea',
    name: 'Seattle',
    shortName: 'SEA',
    center: {
      lat: 47.6062,
      lng: -122.3321
    },
    radiusKm: 30,
    walkingRadiusKm: 2,
    timezone: 'America/Los_Angeles',
    primaryZones: ['Capitol Hill', 'Downtown', 'University District', 'Cal Anderson'],
    geoJsonUrl: '/data/seattle.geojson'
  },
  
  atl: {
    id: 'atl',
    name: 'Atlanta',
    shortName: 'ATL',
    center: {
      lat: 33.7490,
      lng: -84.3880
    },
    radiusKm: 40,
    walkingRadiusKm: 2,
    timezone: 'America/New_York',
    primaryZones: ['Downtown', 'Centennial Park', 'CNN Center', 'State Capitol'],
    geoJsonUrl: '/data/atlanta.geojson'
  },
  
  pdx: {
    id: 'pdx',
    name: 'Portland',
    shortName: 'PDX',
    center: {
      lat: 45.5152,
      lng: -122.6784
    },
    radiusKm: 25,
    walkingRadiusKm: 1.5,
    timezone: 'America/Los_Angeles',
    primaryZones: ['Downtown', 'Pioneer Square', 'Waterfront', 'Justice Center'],
    geoJsonUrl: '/data/portland.geojson'
  }
};

/**
 * Get city config by ID or path
 */
export function getCityConfig(cityId: string): CityConfig | null {
  return CITIES[cityId.toLowerCase()] || null;
}

/**
 * Get city from hostname or path
 */
export function getCityFromUrl(url: string): CityConfig | null {
  // Check subdomain first (e.g., la.overwhelm.city)
  const subdomain = url.split('.')[0];
  if (CITIES[subdomain]) {
    return CITIES[subdomain];
  }
  
  // Check path (e.g., overwhelm.city/la)
  const pathMatch = url.match(/\/([a-z]{2,3})\/?$/);
  if (pathMatch && CITIES[pathMatch[1]]) {
    return CITIES[pathMatch[1]];
  }
  
  // Default to LA
  return CITIES.la;
}

/**
 * Generate city-specific environment variables
 */
export function getCityEnvVars(city: CityConfig): Record<string, string> {
  return {
    NEXT_PUBLIC_CITY_NAME: city.name,
    NEXT_PUBLIC_CITY_SHORT: city.shortName,
    NEXT_PUBLIC_CITY_CENTER_LAT: city.center.lat.toString(),
    NEXT_PUBLIC_CITY_CENTER_LNG: city.center.lng.toString(),
    NEXT_PUBLIC_CITY_RADIUS_KM: city.radiusKm.toString(),
    NEXT_PUBLIC_WALKING_RADIUS_KM: city.walkingRadiusKm.toString(),
  };
}