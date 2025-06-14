/**
 * Anchor-Aware Crew Assignment
 * Invisibly maintains a main crew at strategic locations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const MAX_CREWS = parseInt(process.env.NEXT_PUBLIC_MAX_CREWS || '20');
const ANCHOR_SIZE_MIN = 500;    // Minimum anchor size before splitting
const ANCHOR_SIZE_TARGET = 1000; // Target anchor crew size
const SUPPORT_CREW_SIZE = 150;   // Smaller support crews

interface CrewAssignment {
  crewId: number;
  crewName: string;
  estimatedSize: number;
  zoneId: string;
  zoneName: string;
  nextRotation: Date;
}

interface AnchorState {
  anchorCrewId: number | null;
  anchorZoneId: number | null;
  assignmentCount: number;
  lastAnchorCheck: Date;
}

interface CurrentCrew {
  crew_id: number;
  zone_id: number;
  estimated_size: number;
  zone?: {
    id: number;
    name: string;
    type: string;
    center_lat: number;
    center_lng: number;
  };
}

// Module-level state (persists across requests)
let anchorState: AnchorState = {
  anchorCrewId: null,
  anchorZoneId: null,
  assignmentCount: 0,
  lastAnchorCheck: new Date(0)
};

/**
 * Get crew assignment with invisible anchor logic
 */
export async function getCrewAssignment(
  supabase: SupabaseClient,
  preferredZoneId?: string,
  userCoords?: { lat: number; lng: number }
): Promise<CrewAssignment> {
  const now = new Date();
  
  // Initialize anchor as Crew 1 at City Hall if not set
  if (!anchorState.anchorCrewId) {
    anchorState.anchorCrewId = 1;
    anchorState.anchorZoneId = 1; // Zone A - City Hall
  }
  
  // Refresh anchor selection every 10 minutes (but only after we have 500+ people)
  if (now.getTime() - anchorState.lastAnchorCheck.getTime() > 10 * 60 * 1000) {
    const { data: anchorCrew } = await supabase
      .from('current_crews')
      .select('estimated_size')
      .eq('crew_id', anchorState.anchorCrewId)
      .single();
    
    // Only consider changing anchor if current one is large enough
    if (anchorCrew?.estimated_size >= ANCHOR_SIZE_MIN) {
      await selectAnchorCrew(supabase);
    }
    anchorState.lastAnchorCheck = now;
  }

  // Get all current crews
  const { data: currentCrews } = await supabase
    .from('current_crews')
    .select(`
      crew_id,
      zone_id,
      estimated_size,
      zone:zones!inner(
        id,
        name,
        type,
        center_lat,
        center_lng
      )
    `)
    .order('crew_id') as { data: CurrentCrew[] | null };

  // Increment assignment counter
  anchorState.assignmentCount++;

  // Determine if this person should go to anchor
  const shouldJoinAnchor = await decideAnchorAssignment(
    supabase,
    currentCrews || [],
    preferredZoneId,
    userCoords
  );

  let targetCrewId: number;
  let targetZoneId: string;

  if (shouldJoinAnchor && anchorState.anchorCrewId) {
    // Send to anchor crew
    targetCrewId = anchorState.anchorCrewId;
    const anchorCrew = currentCrews?.find((c: CurrentCrew) => c.crew_id === anchorState.anchorCrewId);
    targetZoneId = anchorCrew?.zone_id?.toString() || preferredZoneId || '1';
  } else {
    // Normal assignment to support crews
    const assignment = selectSupportCrew(currentCrews, preferredZoneId);
    targetCrewId = assignment.crewId;
    targetZoneId = assignment.zoneId;
  }

  // Get zone details
  const { data: zone } = await supabase
    .from('zones')
    .select('name')
    .eq('id', targetZoneId)
    .single();

  // Calculate next rotation
  const rotationInterval = 30 * 60 * 1000;
  const currentCycle = Math.floor(now.getTime() / rotationInterval);
  const nextRotationTime = (currentCycle + 1) * rotationInterval;

  // Get current size
  const currentCrew = currentCrews?.find((c: CurrentCrew) => c.crew_id === targetCrewId);
  const estimatedSize = (currentCrew?.estimated_size || 0) + 1;

  return {
    crewId: targetCrewId,
    crewName: `Crew ${targetCrewId}`,
    estimatedSize,
    zoneId: targetZoneId,
    zoneName: zone?.name || 'Downtown',
    nextRotation: new Date(nextRotationTime)
  };
}

/**
 * Select which crew should be the anchor
 * Called periodically, not on every assignment
 */
async function selectAnchorCrew(supabase: SupabaseClient) {
  const { data: crews } = await supabase
    .from('current_crews')
    .select(`
      crew_id,
      zone_id,
      estimated_size,
      zone:zones!inner(
        id,
        name,
        type
      )
    `)
    .gt('estimated_size', 100)
    .eq('zones.type', 'primary')
    .order('estimated_size', { ascending: false })
    .limit(5) as { data: CurrentCrew[] | null };

  if (!crews || crews.length === 0) {
    // No suitable anchor yet
    anchorState.anchorCrewId = null;
    anchorState.anchorZoneId = null;
    return;
  }

  // Score each potential anchor
  let bestScore = 0;
  let bestCrew: CurrentCrew | null = null;

  const strategicZones = [
    'City Hall South Lawn',
    'Federal Building', 
    'Grand Park'
  ];

  for (const crew of crews) {
    let score = 0;
    
    // Size score (want 500-1000 for anchor)
    if (crew.estimated_size >= ANCHOR_SIZE_MIN && crew.estimated_size <= ANCHOR_SIZE_TARGET) {
      score += 50;
    } else if (crew.estimated_size > ANCHOR_SIZE_TARGET) {
      score += 40; // Still good if bigger
    } else if (crew.estimated_size >= 200) {
      score += 30; // Building up
    } else {
      score += 20; // Too small yet
    }

    // Strategic location score
    if (crew.zone && strategicZones.includes(crew.zone.name)) {
      score += 40;
    }

    // Stability bonus if already anchor
    if (crew.crew_id === anchorState.anchorCrewId) {
      score += 20;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCrew = crew;
    }
  }

  if (bestCrew) {
    anchorState.anchorCrewId = bestCrew.crew_id;
    anchorState.anchorZoneId = bestCrew.zone_id;
  }
}

/**
 * Decide if new participant should join anchor
 * Uses various heuristics to maintain anchor strength
 */
async function decideAnchorAssignment(
  supabase: SupabaseClient,
  currentCrews: CurrentCrew[],
  preferredZoneId?: string,
  userCoords?: { lat: number; lng: number }
): Promise<boolean> {
  if (!anchorState.anchorCrewId) return false;

  const anchorCrew = currentCrews?.find((c: CurrentCrew) => c.crew_id === anchorState.anchorCrewId);
  if (!anchorCrew) return false;

  const anchorSize = anchorCrew.estimated_size;

  // CRITICAL: Check geographic constraints first
  if (userCoords && preferredZoneId) {
    // Get both user's preferred zone and anchor zone locations
    const { data: userZone } = await supabase
      .from('zones')
      .select('center_lat, center_lng')
      .eq('id', preferredZoneId)
      .single();
    
    if (userZone && anchorCrew.zone) {
      const distanceToPreferredZone = calculateDistance(
        userCoords.lat,
        userCoords.lng,
        userZone.center_lat,
        userZone.center_lng
      );
      
      const distanceToAnchor = calculateDistance(
        userCoords.lat,
        userCoords.lng,
        anchorCrew.zone.center_lat,
        anchorCrew.zone.center_lng
      );
      
      // If user is at a zone (within 500m), ALWAYS let them join it
      // This enables organic zone activation (e.g., someone at UCLA)
      if (distanceToPreferredZone < 0.5) { // 500m radius
        return false; // Let them join their local zone
      }
      
      // If user is far from anchor (>1km), don't force them there
      // This prevents sending UCLA protesters to City Hall
      if (distanceToAnchor > 1.0) { // 1km = reasonable walking distance
        return false; // Don't force distant users to anchor
      }
    }
  }

  // NEW ANCHOR STRATEGY (only applies when geographic constraints allow):
  // Phase 1: BUILD (0-500) - Send most people to anchor
  if (anchorSize < 500) {
    return true; // Send to anchor if they're within reasonable distance
  }
  
  // Phase 2: GROWTH (500-1000) - Send 50% to anchor
  if (anchorSize < 1000) {
    return Math.random() < 0.5; // 50% to anchor
  }
  
  // Phase 3: SUSTAIN (1000+) - Gradually reduce
  // Start at 30% and decrease as size grows
  const sustainProbability = Math.max(0.1, 300 / anchorSize); // Min 10%
  
  // Geographic boost - if user is already near anchor zone, send them there
  if (userCoords && anchorCrew.zone) {
    const distanceToAnchor = calculateDistance(
      userCoords.lat,
      userCoords.lng,
      anchorCrew.zone.center_lat,
      anchorCrew.zone.center_lng
    );
    
    if (distanceToAnchor < 0.2) { // Within 200m of anchor
      return true; // Always send to anchor if they're already there
    }
  }
  
  return Math.random() < sustainProbability;
}

/**
 * Get a random walkable zone (not the anchor zone)
 */
async function getRandomWalkableZone(supabase: SupabaseClient, excludeZoneId: string): Promise<string> {
  const { data: zones } = await supabase
    .from('zones')
    .select('id')
    .eq('active', true)
    .neq('type', 'avoid')
    .neq('id', excludeZoneId);
  
  if (zones && zones.length > 0) {
    return zones[Math.floor(Math.random() * zones.length)].id;
  }
  
  return '2'; // Fallback to zone 2
}

/**
 * Select a support crew for non-anchor assignment
 */
function selectSupportCrew(
  currentCrews: CurrentCrew[] | null,
  preferredZoneId?: string
): { crewId: number; zoneId: string } {
  // Filter out anchor crew
  const supportCrews = currentCrews?.filter(
    (c: CurrentCrew) => c.crew_id !== anchorState.anchorCrewId
  ) || [];

  // Try to find crew in preferred zone
  if (preferredZoneId) {
    const zoneCrews = supportCrews.filter(
      (c: CurrentCrew) => c.zone_id === parseInt(preferredZoneId) && 
           c.estimated_size < SUPPORT_CREW_SIZE
    );
    
    if (zoneCrews.length > 0) {
      const crew = zoneCrews[0];
      return { crewId: crew.crew_id, zoneId: crew.zone_id.toString() };
    }
    
    // No crew at preferred zone - CREATE NEW CREW THERE
    // This enables organic zone activation (e.g., first person at UCLA)
    // Find the next available crew ID
    const allCrewIds = currentCrews?.map((c: CurrentCrew) => c.crew_id) || [];
    const maxCrewId = Math.max(...allCrewIds, 0);
    const newCrewId = Math.min(maxCrewId + 1, MAX_CREWS);
    
    // If we haven't hit max crews, create new one at preferred zone
    if (newCrewId <= MAX_CREWS) {
      return { crewId: newCrewId, zoneId: preferredZoneId };
    }
  }

  // No preferred zone or can't create new crew - find existing crew with space
  const availableCrews = supportCrews.filter(
    (c: CurrentCrew) => c.estimated_size < SUPPORT_CREW_SIZE
  );

  if (availableCrews.length > 0) {
    // Only assign to crews in other zones if no preferred zone
    if (!preferredZoneId) {
      const index = anchorState.assignmentCount % availableCrews.length;
      const crew = availableCrews[index];
      return { crewId: crew.crew_id, zoneId: crew.zone_id.toString() };
    }
  }

  // All full - if we have a preferred zone, still try to create new crew there
  if (preferredZoneId) {
    const allCrewIds = currentCrews?.map((c: CurrentCrew) => c.crew_id) || [];
    const maxCrewId = Math.max(...allCrewIds, 0);
    const newCrewId = Math.min(maxCrewId + 1, MAX_CREWS);
    
    if (newCrewId <= MAX_CREWS) {
      return { crewId: newCrewId, zoneId: preferredZoneId };
    }
  }

  // Absolute fallback - find smallest crew
  if (supportCrews.length > 0) {
    const smallestCrew = supportCrews.reduce((prev: CurrentCrew, curr: CurrentCrew) => 
      prev.estimated_size < curr.estimated_size ? prev : curr
    );
    return { crewId: smallestCrew.crew_id, zoneId: smallestCrew.zone_id.toString() };
  }

  // Final fallback
  return { crewId: 2, zoneId: preferredZoneId || '2' };
}

interface RotationPlan {
  crew_id: number;
  from_zone_id: number;
  to_zone_id: number;
  estimated_size: number;
}

/**
 * Get rotation plan that protects anchor
 */
export async function getAnchorAwareRotation(
  supabase: SupabaseClient
): Promise<RotationPlan[]> {
  const { data: currentCrews } = await supabase
    .from('current_crews')
    .select('crew_id, zone_id, estimated_size')
    .gt('estimated_size', 0);

  const rotationPlan: RotationPlan[] = [];

  for (const crew of currentCrews || []) {
    // NEVER rotate the anchor crew during normal rotation
    if (crew.crew_id === anchorState.anchorCrewId) {
      continue;
    }

    // Normal rotation logic for support crews
    // ... implement rotation
  }

  return rotationPlan;
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