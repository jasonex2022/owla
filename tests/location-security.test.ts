/**
 * Location Security Tests
 * Verify that only users within protest zones can join crews
 */

import { checkIfNearProtest } from '../lib/services/geofence';

describe('Location Security', () => {
  
  // Mock navigator.geolocation
  const mockGeolocation = (lat: number, lng: number) => {
    const mockPosition = {
      coords: {
        latitude: lat,
        longitude: lng,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: Date.now()
    };

    global.navigator = {
      geolocation: {
        getCurrentPosition: (success: any) => success(mockPosition),
        watchPosition: jest.fn(),
        clearWatch: jest.fn()
      }
    } as any;
  };

  test('Philadelphia user cannot join LA crews', async () => {
    // Philadelphia coordinates
    mockGeolocation(39.9526, -75.1652);
    
    const result = await checkIfNearProtest();
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('You\'re');
    expect(result.reason).toContain('km from Los Angeles');
  });

  test('Downtown LA user can join crews', async () => {
    // LA City Hall coordinates
    mockGeolocation(34.0537, -118.2427);
    
    const result = await checkIfNearProtest();
    
    expect(result.allowed).toBe(true);
    expect(result.nearestZone).toBeDefined();
    expect(result.nearestZone?.name).toContain('City Hall');
  });

  test('Santa Monica user (15km away) cannot join', async () => {
    // Santa Monica Pier
    mockGeolocation(34.0084, -118.4912);
    
    const result = await checkIfNearProtest();
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('walking distance');
    expect(result.distance).toBeGreaterThan(10);
  });

  test('Denying location blocks access', async () => {
    // Mock geolocation denial
    global.navigator = {
      geolocation: {
        getCurrentPosition: (_: any, error: any) => {
          error({ code: 1, message: 'User denied' });
        }
      }
    } as any;
    
    const result = await checkIfNearProtest();
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Location access required');
  });

  test('No session storage bypass works', async () => {
    // Set fake session storage
    sessionStorage.setItem('overwhelm-location-verified', 'true');
    
    // Philadelphia coordinates
    mockGeolocation(39.9526, -75.1652);
    
    const result = await checkIfNearProtest();
    
    // Should still be blocked
    expect(result.allowed).toBe(false);
  });
});

describe('API Security', () => {
  
  test('API rejects requests without coordinates', async () => {
    const response = await fetch('/api/crew');
    const data = await response.json();
    
    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Location required');
  });

  test('API rejects coordinates outside protest area', async () => {
    // NYC coordinates
    const params = new URLSearchParams({
      lat: '40.7128',
      lng: '-74.0060'
    });
    
    const response = await fetch(`/api/crew?${params}`);
    const data = await response.json();
    
    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toContain('walking distance');
  });

  test('API accepts valid protest zone coordinates', async () => {
    // LA City Hall
    const params = new URLSearchParams({
      lat: '34.0537',
      lng: '-118.2427'
    });
    
    const response = await fetch(`/api/crew?${params}`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.crew).toBeDefined();
  });
});