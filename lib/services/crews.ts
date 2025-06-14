/**
 * Stateless crew assignment algorithm
 * No cookies, no tracking - just math based on time
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AnchorCrewService } from './anchor-strategy';
import { Database } from '../supabase/client';

const MAX_CREWS = parseInt(process.env.NEXT_PUBLIC_MAX_CREWS || '20');
const MAX_CREW_SIZE = parseInt(process.env.NEXT_PUBLIC_MAX_CREW_SIZE || '200');
const CREW_FILL_THRESHOLD = 150; // Start new crew after this many people

// Singleton anchor service (invisible to frontend)
const anchorService = new AnchorCrewService();

export interface CrewAssignment {
  crewId: number;
  crewName: string;
  estimatedSize: number;
  zoneId: string;
  zoneName: string;
  nextRotation: Date;
  preferredZoneId?: string; // Based on user location
}

/**
 * Get crew assignment for a user based on current time and location
 * Assigns to crews in nearest zone if possible
 */
export async function getCrewAssignment(
  supabase: SupabaseClient<Database>,
  preferredZoneId?: string
): Promise<CrewAssignment> {
  // Time bucket: 10-second windows for crew assignment
  const now = new Date();
  const timeBucket = Math.floor(now.getTime() / 10000);
  
  // Get current crew stats from database
  const { data: crewStats } = await supabase
    .rpc('get_crew_stats')
    .single();
  
  const activeCrews = (crewStats as Database['public']['Functions']['get_crew_stats']['Returns'] | null)?.active_crews || 0;
  
  // Calculate next rotation time (every 30 minutes)
  const rotationInterval = 30 * 60 * 1000; // 30 minutes
  const currentRotationCycle = Math.floor(now.getTime() / rotationInterval);
  const nextRotationTime = (currentRotationCycle + 1) * rotationInterval;
  const nextRotation = new Date(nextRotationTime);
  
  // Get current crew sizes
  const { data: currentCrews } = await supabase
    .from('current_crews')
    .select('crew_id, estimated_size, zone_id')
    .order('crew_id');
  
  // Find crew to assign based on current distribution
  let assignedCrewId = 1;
  let currentCrewSize = 0;
  
  if (currentCrews && currentCrews.length > 0) {
    // Find a crew that isn't full
    for (const crew of currentCrews) {
      if (crew.estimated_size < CREW_FILL_THRESHOLD) {
        assignedCrewId = crew.crew_id;
        currentCrewSize = crew.estimated_size;
        break;
      }
    }
    
    // If all existing crews are near capacity, start a new one
    if (currentCrewSize >= CREW_FILL_THRESHOLD && activeCrews < MAX_CREWS) {
      assignedCrewId = activeCrews + 1;
      currentCrewSize = 0;
    } else if (currentCrewSize >= CREW_FILL_THRESHOLD) {
      // All crews full, assign to least full crew
      const leastFullCrew = currentCrews.reduce((prev, curr) => 
        prev.estimated_size < curr.estimated_size ? prev : curr
      );
      assignedCrewId = leastFullCrew.crew_id;
      currentCrewSize = leastFullCrew.estimated_size;
    }
  }
  
  // Use time-based randomness for distribution within time bucket
  const bucketRandom = hashCode(timeBucket.toString()) / 2147483647;
  const crewOffset = Math.floor(bucketRandom * 3) - 1; // -1, 0, or 1
  assignedCrewId = Math.max(1, Math.min(MAX_CREWS, assignedCrewId + crewOffset));
  
  // Smart zone assignment: Find nearest zone with available space
  let zoneId = preferredZoneId || 'downtown';
  let assignmentFound = false;
  
  if (preferredZoneId && currentCrews) {
    // First, try preferred zone
    const crewsInPreferredZone = currentCrews.filter(c => 
      c.zone_id === parseInt(preferredZoneId) && 
      c.estimated_size < CREW_FILL_THRESHOLD
    );
    
    if (crewsInPreferredZone.length > 0) {
      // Found space in preferred zone
      const availableCrew = crewsInPreferredZone[0];
      assignedCrewId = availableCrew.crew_id;
      currentCrewSize = availableCrew.estimated_size;
      zoneId = preferredZoneId;
      assignmentFound = true;
    }
    
    // If preferred zone is full, find nearest zone with space
    if (!assignmentFound) {
      // Get all zones with available space
      const { data: zones } = await supabase
        .from('zones')
        .select('id, name, center_lat, center_lng')
        .eq('active', true);
      
      if (zones && preferredZoneId) {
        // Get preferred zone coordinates
        const preferredZone = zones.find(z => z.id === parseInt(preferredZoneId));
        
        if (preferredZone) {
          // Find nearest zone with available space
          let nearestZoneId = null;
          let nearestDistance = Infinity;
          
          for (const zone of zones) {
            if (zone.id === parseInt(preferredZoneId)) continue; // Skip preferred (it's full)
            
            // Check if zone has crews with space
            const crewsInZone = currentCrews.filter(c => 
              c.zone_id === zone.id && 
              c.estimated_size < CREW_FILL_THRESHOLD
            );
            
            if (crewsInZone.length > 0) {
              // Calculate distance
              const distance = calculateDistance(
                preferredZone.center_lat, preferredZone.center_lng,
                zone.center_lat, zone.center_lng
              );
              
              if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestZoneId = zone.id;
              }
            }
          }
          
          // Assign to nearest zone with space
          if (nearestZoneId) {
            const crewsInNearestZone = currentCrews.filter(c => 
              c.zone_id === nearestZoneId && 
              c.estimated_size < CREW_FILL_THRESHOLD
            );
            
            if (crewsInNearestZone.length > 0) {
              const availableCrew = crewsInNearestZone[0];
              assignedCrewId = availableCrew.crew_id;
              currentCrewSize = availableCrew.estimated_size;
              zoneId = nearestZoneId.toString();
              assignmentFound = true;
            }
          }
        }
      }
    }
  }
  
  // Fallback: Use default assignment if no location-based match
  if (!assignmentFound) {
    const crewData = currentCrews?.find(c => c.crew_id === assignedCrewId);
    if (crewData) {
      zoneId = crewData.zone_id.toString();
    }
  }
  
  // Get zone details
  const { data: zone } = await supabase
    .from('zones')
    .select('name')
    .eq('id', zoneId)
    .single();
  
  // Increment estimated size (this is just for display, not stored per user)
  const estimatedSize = currentCrewSize + 1;
  
  return {
    crewId: assignedCrewId,
    crewName: getCrewName(assignedCrewId),
    estimatedSize,
    zoneId,
    zoneName: zone?.name || 'Downtown',
    nextRotation,
    preferredZoneId
  };
}

/**
 * Get simple group identifier
 */
function getCrewName(crewId: number): string {
  return `Group ${crewId}`;
}

/**
 * Simple hash function for consistent randomness
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Calculate distance between two points
 */
function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate current active protesters across all crews
 * This is intentionally fuzzy for privacy
 */
export async function estimateTotalProtesters(supabase: SupabaseClient<Database>): Promise<number> {
  const { data: stats } = await supabase
    .rpc('get_crew_stats')
    .single();
  
  const baseCount = (stats as Database['public']['Functions']['get_crew_stats']['Returns'] | null)?.total_protesters || 0;
  
  // Add some realistic variance based on time of day
  const hour = new Date().getHours();
  const variance = Math.sin((hour - 14) * Math.PI / 12) * 0.2; // Peak at 2pm
  const multiplier = 1 + variance;
  
  return Math.round(baseCount * multiplier);
}

/**
 * Get all active crews with their current zones
 * This is public information - transparency is our strength
 */
export async function getAllActiveCrews(supabase: SupabaseClient<Database>) {
  const { data: crews } = await supabase
    .from('current_crews')
    .select(`
      crew_id,
      estimated_size,
      assigned_at,
      next_rotation,
      zone:zones(id, name, center_lat, center_lng)
    `)
    .gt('estimated_size', 0)
    .order('crew_id');
  
  return crews?.map(crew => ({
    id: crew.crew_id,
    name: getCrewName(crew.crew_id),
    size: crew.estimated_size,
    zone: crew.zone,
    assignedAt: crew.assigned_at,
    nextRotation: crew.next_rotation
  })) || [];
}