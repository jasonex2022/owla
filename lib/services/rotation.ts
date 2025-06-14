/**
 * Zone rotation algorithm
 * Moves crews every 30 minutes based on police activity and distribution
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Zone, getAssignableZones } from '../config/zones';

interface PoliceActivity {
  zone_id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  expires_at: string;
}

interface CrewLocation {
  crew_id: number;
  zone_id: string;
  estimated_size: number;
}

interface RotationPlan {
  crew_id: number;
  zone_id: string;
  estimated_size: number;
}

/**
 * Execute crew rotation - called every 30 minutes by cron
 */
export async function rotateCrews(
  supabase: SupabaseClient,
  zones: Zone[]
): Promise<{ success: boolean; rotations: number; message: string }> {
  try {
    // 1. Get current crew locations
    const { data: currentCrews } = await supabase
      .from('current_crews')
      .select('crew_id, zone_id, estimated_size')
      .gt('estimated_size', 0);
    
    if (!currentCrews || currentCrews.length === 0) {
      return { success: true, rotations: 0, message: 'No active crews to rotate' };
    }
    
    // 2. Get current police activity
    const { data: policeActivity } = await supabase
      .from('police_activity')
      .select('zone_id, severity')
      .gt('expires_at', new Date().toISOString());
    
    // 3. Calculate danger zones
    const dangerZones = new Set<string>();
    const criticalZones = new Set<string>();
    
    policeActivity?.forEach((activity: Pick<PoliceActivity, 'zone_id' | 'severity'>) => {
      if (activity.severity === 'critical') {
        criticalZones.add(activity.zone_id);
        dangerZones.add(activity.zone_id);
      } else if (activity.severity === 'high') {
        dangerZones.add(activity.zone_id);
      }
    });
    
    // 4. Get assignable zones (excluding danger zones)
    const assignableZones = getAssignableZones(zones)
      .filter(zone => !criticalZones.has(zone.id));
    
    if (assignableZones.length < currentCrews.length) {
      console.warn('Not enough safe zones for all crews');
    }
    
    // 5. Create rotation plan
    const rotationPlan = calculateRotation(
      currentCrews,
      assignableZones,
      dangerZones
    );
    
    // 6. Execute rotation in database
    const { error } = await supabase.rpc('rotate_crews', {
      rotation_plan: JSON.stringify(rotationPlan)
    });
    
    if (error) {
      throw error;
    }
    
    return {
      success: true,
      rotations: rotationPlan.length,
      message: `Rotated ${rotationPlan.length} crews successfully`
    };
    
  } catch (error) {
    console.error('Rotation error:', error);
    return {
      success: false,
      rotations: 0,
      message: `Rotation failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Calculate optimal crew rotation
 * Ensures 40-60% of crews move to create unpredictability
 * PROTECTS ANCHOR CREW FROM ROTATION
 */
function calculateRotation(
  currentCrews: CrewLocation[],
  assignableZones: Zone[],
  dangerZones: Set<string>
): RotationPlan[] {
  const rotationPlan: RotationPlan[] = [];
  const usedZones = new Set<string>();
  
  // Identify anchor crew (largest crew in primary zone)
  let anchorCrewId: number | null = null;
  let maxSize = 0;
  
  for (const crew of currentCrews) {
    const zone = assignableZones.find(z => z.id === crew.zone_id.toString());
    if (zone && zone.type === 'primary' && crew.estimated_size > maxSize) {
      maxSize = crew.estimated_size;
      anchorCrewId = crew.crew_id;
    }
  }
  
  // Filter out anchor crew from rotation candidates
  const rotatableCrews = currentCrews.filter(c => c.crew_id !== anchorCrewId);
  
  // Determine how many crews to move (40-60% of non-anchor crews)
  const rotationPercentage = 0.4 + Math.random() * 0.2; // 40-60%
  const crewsToRotate = Math.ceil(rotatableCrews.length * rotationPercentage);
  
  // Sort crews by priority for movement
  const crewPriority = [...rotatableCrews].sort((a, b) => {
    // Prioritize moving crews in danger zones
    const aInDanger = dangerZones.has(a.zone_id) ? 1 : 0;
    const bInDanger = dangerZones.has(b.zone_id) ? 1 : 0;
    if (aInDanger !== bInDanger) return bInDanger - aInDanger;
    
    // Then prioritize larger crews (more visible)
    return b.estimated_size - a.estimated_size;
  });
  
  // Handle anchor crew first (only moves if in danger)
  const anchorCrew = currentCrews.find(c => c.crew_id === anchorCrewId);
  if (anchorCrew) {
    if (dangerZones.has(anchorCrew.zone_id)) {
      // EMERGENCY: Anchor must move to safe primary zone
      const safePrimaryZones = assignableZones.filter(z => 
        z.type === 'primary' && !dangerZones.has(z.id)
      );
      
      if (safePrimaryZones.length > 0) {
        const newAnchorZone = safePrimaryZones[0];
        rotationPlan.push({
          crew_id: anchorCrew.crew_id,
          zone_id: newAnchorZone.id,
          estimated_size: anchorCrew.estimated_size
        });
        usedZones.add(newAnchorZone.id);
      }
    } else {
      // Anchor stays in place
      rotationPlan.push({
        crew_id: anchorCrew.crew_id,
        zone_id: anchorCrew.zone_id,
        estimated_size: anchorCrew.estimated_size
      });
      usedZones.add(anchorCrew.zone_id);
    }
  }
  
  // Assign new zones to non-anchor crews
  for (let i = 0; i < rotatableCrews.length; i++) {
    const crew = crewPriority[i];
    const shouldRotate = i < crewsToRotate || dangerZones.has(crew.zone_id);
    
    let targetZone: string;
    
    if (shouldRotate) {
      // Find a new zone that isn't used yet
      const availableZones = assignableZones.filter(z => 
        !usedZones.has(z.id) && z.id !== crew.zone_id
      );
      
      if (availableZones.length > 0) {
        // Support crews prefer secondary zones
        const secondaryZones = availableZones.filter(z => z.type === 'secondary');
        const zonePool = secondaryZones.length > 0 ? secondaryZones : availableZones;
        
        // Random selection
        const selectedZone = zonePool[Math.floor(Math.random() * zonePool.length)];
        targetZone = selectedZone.id;
      } else {
        // No available zones, stay put
        targetZone = crew.zone_id;
      }
    } else {
      // Keep this crew in place
      targetZone = crew.zone_id;
    }
    
    usedZones.add(targetZone);
    rotationPlan.push({
      crew_id: crew.crew_id,
      zone_id: targetZone,
      estimated_size: crew.estimated_size
    });
  }
  
  return rotationPlan;
}

/**
 * Check if rotation is needed (called by cron)
 */
export async function shouldRotate(supabase: SupabaseClient): Promise<boolean> {
  const now = new Date();
  const minutes = now.getMinutes();
  
  // Rotate at :00 and :30
  if (minutes !== 0 && minutes !== 30) {
    return false;
  }
  
  // Check if we already rotated in the last 5 minutes
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  
  const { data: recentRotations } = await supabase
    .from('movement_stats')
    .select('timestamp')
    .gte('timestamp', fiveMinutesAgo.toISOString())
    .order('timestamp', { ascending: false })
    .limit(1);
  
  return !recentRotations || recentRotations.length === 0;
}

/**
 * Emergency evacuation - move all crews away from danger
 */
export async function emergencyEvacuation(
  supabase: SupabaseClient,
  zones: Zone[],
  dangerZoneIds: string[]
): Promise<{ success: boolean; message: string }> {
  try {
    // Get all crews in danger zones
    const { data: endangeredCrews } = await supabase
      .from('current_crews')
      .select('crew_id, zone_id, estimated_size')
      .in('zone_id', dangerZoneIds)
      .gt('estimated_size', 0);
    
    if (!endangeredCrews || endangeredCrews.length === 0) {
      return { success: true, message: 'No crews in danger zones' };
    }
    
    // Find safe zones
    const safeZones = zones.filter(z => 
      !dangerZoneIds.includes(z.id) && z.type !== 'avoid'
    );
    
    if (safeZones.length === 0) {
      return { success: false, message: 'No safe zones available!' };
    }
    
    // Create emergency rotation plan
    const rotationPlan = endangeredCrews.map((crew: CrewLocation, index: number) => ({
      crew_id: crew.crew_id,
      zone_id: safeZones[index % safeZones.length].id,
      estimated_size: crew.estimated_size
    }));
    
    // Execute emergency rotation
    await supabase.rpc('rotate_crews', {
      rotation_plan: JSON.stringify(rotationPlan)
    });
    
    // Record high-severity police activity
    for (const zoneId of dangerZoneIds) {
      await supabase.from('police_activity').insert({
        zone_id: zoneId,
        severity: 'critical',
        description: 'Emergency evacuation ordered',
        source: 'system'
      });
    }
    
    return {
      success: true,
      message: `Emergency evacuation: moved ${endangeredCrews.length} crews to safety`
    };
    
  } catch (error) {
    console.error('Emergency evacuation error:', error);
    return {
      success: false,
      message: `Evacuation failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}