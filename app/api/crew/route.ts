import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { getCrewAssignment } from '@/lib/services/anchor-aware-crews';

// Helper to calculate next rotation time
function calculateNextRotation(): Date {
  const now = Date.now();
  const rotationInterval = 30 * 60 * 1000; // 30 minutes
  const currentCycle = Math.floor(now / rotationInterval);
  const nextRotationTime = (currentCycle + 1) * rotationInterval;
  return new Date(nextRotationTime);
}

/**
 * GET /api/crew
 * Get crew assignment for current user (stateless)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Check for preferred zone from query params (passed from frontend)
    const { searchParams } = new URL(request.url);
    const preferredZoneId = searchParams.get('zone') || undefined;
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const getNextZone = searchParams.get('getNextZone') === 'true';
    const currentZoneId = searchParams.get('currentZone');
    const crewId = searchParams.get('crewId');
    
    // Handle next zone request (for rotation)
    if (getNextZone && currentZoneId && crewId) {
      return handleNextZoneRequest(supabase, currentZoneId, crewId);
    }
    
    // SECURITY: Require valid coordinates for initial assignment
    if (!lat || !lng) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Location required for crew assignment'
        },
        { status: 403 }
      );
    }
    
    // Build user coordinates
    const userCoords = {
      lat: parseFloat(lat),
      lng: parseFloat(lng)
    };
    
    // Verify user is within protest area
    const { data: nearbyZones } = await supabase
      .rpc('find_nearby_zones', {
        user_lat: userCoords.lat,
        user_lng: userCoords.lng,
        search_radius_meters: parseFloat(process.env.NEXT_PUBLIC_WALKING_RADIUS_KM || '4.8') * 1000
      });
    
    if (!nearbyZones || nearbyZones.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'You must be within walking distance of an active protest zone'
        },
        { status: 403 }
      );
    }
    
    // Get crew assignment (with invisible anchor logic)
    const assignment = await getCrewAssignment(supabase, preferredZoneId, userCoords);
    
    // Update crew size estimate in database
    // This is fire-and-forget, we don't wait for it
    updateCrewSize(supabase, assignment.crewId, assignment.zoneId, assignment.estimatedSize);
    
    return NextResponse.json({
      success: true,
      crew: assignment,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Crew assignment error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to assign crew',
        // Fallback assignment
        crew: {
          crewId: 1,
          crewName: 'Crew 1',
          estimatedSize: 150,
          zoneId: '1',
          zoneName: 'City Hall',
          nextRotation: calculateNextRotation(),
        }
      },
      { status: 500 }
    );
  }
}

/**
 * Update crew size estimate (async, best effort)
 */
async function updateCrewSize(
  supabase: any,
  crewId: number,
  zoneId: string,
  estimatedSize: number
) {
  try {
    // Get current crew data
    const { data: currentCrew } = await supabase
      .from('current_crews')
      .select('zone_id, estimated_size')
      .eq('crew_id', crewId)
      .single();
    
    if (!currentCrew) {
      // Create new crew entry with correct zone
      await supabase.from('crew_zones').insert({
        crew_id: crewId,
        zone_id: parseInt(zoneId), // Use the assigned zone!
        estimated_size: estimatedSize,
      });
    } else if (Math.abs(currentCrew.estimated_size - estimatedSize) > 5) {
      // Only update if significant change (>5 people)
      await supabase.from('crew_zones').insert({
        crew_id: crewId,
        zone_id: currentCrew.zone_id,
        estimated_size: estimatedSize,
      });
    }
  } catch (error) {
    // Silently fail - this is best effort
    console.error('Crew size update failed:', error);
  }
}

/**
 * Handle next zone request for crew rotation
 */
async function handleNextZoneRequest(
  supabase: any,
  currentZoneId: string,
  crewId: string
) {
  try {
    // Check if this is the anchor crew (crew 1)
    if (crewId === '1') {
      // Anchor crew doesn't move unless emergency
      const { data: currentZone } = await supabase
        .from('zones')
        .select('id, name')
        .eq('id', currentZoneId)
        .single();
      
      return NextResponse.json({
        success: true,
        crew: {
          crewId: parseInt(crewId),
          crewName: `Crew ${crewId}`,
          zoneId: currentZoneId,
          zoneName: currentZone?.name || 'Downtown',
          nextRotation: calculateNextRotation(),
          message: 'Anchor crew holds position'
        }
      });
    }
    
    // Get all active zones
    const { data: zones } = await supabase
      .from('zones')
      .select('id, name, center_lat, center_lng')
      .eq('active', true)
      .neq('type', 'avoid');
    
    if (!zones || zones.length === 0) {
      throw new Error('No active zones found');
    }
    
    // Get current zone details
    const currentZone = zones.find((z: any) => z.id === parseInt(currentZoneId));
    if (!currentZone) {
      throw new Error('Current zone not found');
    }
    
    // Get crew distribution to avoid overcrowding
    const { data: crewDistribution } = await supabase
      .from('current_crews')
      .select('zone_id, estimated_size')
      .gt('estimated_size', 0);
    
    // Calculate zone occupancy
    const zoneOccupancy = new Map();
    crewDistribution?.forEach((crew: any) => {
      const current = zoneOccupancy.get(crew.zone_id) || 0;
      zoneOccupancy.set(crew.zone_id, current + crew.estimated_size);
    });
    
    // Find best next zone
    let bestZone = null;
    let bestScore = -Infinity;
    
    for (const zone of zones as any[]) {
      if (zone.id === parseInt(currentZoneId)) continue; // Skip current zone
      
      // Calculate distance
      const distance = calculateDistance(
        currentZone.center_lat,
        currentZone.center_lng,
        zone.center_lat,
        zone.center_lng
      );
      
      // Skip if too far (more than 1.5km)
      if (distance > 1.5) continue;
      
      // Calculate score (closer is better, less crowded is better)
      const occupancy = zoneOccupancy.get(zone.id) || 0;
      const distanceScore = 1 / (distance + 0.1); // Closer zones score higher
      const occupancyScore = 1 / (occupancy + 1); // Less crowded zones score higher
      
      const totalScore = distanceScore + occupancyScore;
      
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestZone = zone;
      }
    }
    
    // If no good zone found, pick random nearby zone
    if (!bestZone) {
      const nearbyZones = zones.filter((z: any) => {
        if (z.id === parseInt(currentZoneId)) return false;
        const distance = calculateDistance(
          currentZone.center_lat,
          currentZone.center_lng,
          z.center_lat,
          z.center_lng
        );
        return distance <= 2.0; // Within 2km
      });
      
      if (nearbyZones.length > 0) {
        bestZone = nearbyZones[Math.floor(Math.random() * nearbyZones.length)];
      }
    }
    
    // Return new assignment
    const newZone = bestZone || currentZone; // Stay put if no good option
    
    return NextResponse.json({
      success: true,
      crew: {
        crewId: parseInt(crewId),
        crewName: `Crew ${crewId}`,
        zoneId: newZone.id.toString(),
        zoneName: newZone.name,
        nextRotation: calculateNextRotation(),
        isRotation: true
      }
    });
    
  } catch (error) {
    console.error('Next zone request error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get next zone assignment'
      },
      { status: 500 }
    );
  }
}

function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}