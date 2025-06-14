/**
 * Anchor Crew Strategy
 * Invisible algorithm to maintain a main protest crew at high-value locations
 * while rotating support crews around them for protection
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../supabase/client';

interface AnchorStrategy {
  anchorZoneId: number | null;
  anchorCrewId: number | null;
  supportCrewIds: number[];
  funnelRatio: number; // What percentage of new joins go to anchor
  lastRotation: Date;
}

export class AnchorCrewService {
  private strategy: AnchorStrategy = {
    anchorZoneId: null,
    anchorCrewId: null,
    supportCrewIds: [],
    funnelRatio: 0.4, // 40% of new joins go to anchor initially
    lastRotation: new Date()
  };

  /**
   * Determine which crew should be the anchor based on:
   * - Zone strategic value
   * - Current crew size
   * - Media visibility potential
   * Never expose this decision to frontend
   */
  async selectAnchorCrew(supabase: SupabaseClient<Database>): Promise<void> {
    // Get all active crews with zone info
    const { data: crews } = await supabase
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
      .gt('estimated_size', 50) // Need critical mass
      .eq('zones.type', 'primary') // Only primary zones
      .order('estimated_size', { ascending: false });

    if (!crews || crews.length === 0) return;

    // Score each crew for anchor potential
    let bestScore = 0;
    let bestCrew = null;

    for (const crew of crews) {
      // Fix zone data structure from Supabase join
      const crewWithZone = {
        ...crew,
        zone: Array.isArray(crew.zone) ? crew.zone[0] : crew.zone
      };
      const score = this.calculateAnchorScore(crewWithZone);
      if (score > bestScore) {
        bestScore = score;
        bestCrew = crewWithZone;
      }
    }

    if (bestCrew) {
      this.strategy.anchorCrewId = bestCrew.crew_id;
      this.strategy.anchorZoneId = bestCrew.zone_id;
      
      // Identify support crews (nearby crews)
      await this.identifySupportCrews(supabase, bestCrew.zone_id);
    }
  }

  /**
   * Score a crew's potential as anchor
   * Higher score = better anchor candidate
   */
  private calculateAnchorScore(crew: {
    crew_id: number;
    zone_id: number;
    estimated_size: number;
    zone: {
      id: number;
      name: string;
      type: string;
      center_lat: number;
      center_lng: number;
    };
  }): number {
    let score = 0;

    // Size matters - need critical mass
    if (crew.estimated_size > 200) score += 50;
    else if (crew.estimated_size > 100) score += 30;
    else score += 10;

    // Zone strategic value
    const strategicZones = [
      'City Hall South Lawn',
      'Federal Building',
      'Grand Park'
    ];
    
    if (strategicZones.includes(crew.zone.name)) {
      score += 40;
    }

    // Media visibility (central location)
    const downtownLat = 34.0522;
    const downtownLng = -118.2437;
    const distance = this.calculateDistance(
      crew.zone.center_lat,
      crew.zone.center_lng,
      downtownLat,
      downtownLng
    );
    
    if (distance < 1) score += 30; // Very central
    else if (distance < 2) score += 20;
    else score += 10;

    // Time stability - crews that have been there longer
    // (Would need assigned_at in query)
    // if (crew.assigned_at) {
    //   const duration = Date.now() - new Date(crew.assigned_at).getTime();
    //   if (duration > 60 * 60 * 1000) score += 20; // Over 1 hour
    // }

    return score;
  }

  /**
   * Identify crews that should support the anchor
   * These are crews in walkable zones that will rotate around
   */
  private async identifySupportCrews(supabase: SupabaseClient<Database>, anchorZoneId: number): Promise<void> {
    // Get zones within walking distance
    const { data: nearbyConnections } = await supabase
      .from('zone_connections')
      .select('to_zone_id')
      .eq('from_zone_id', anchorZoneId)
      .lte('walk_time_minutes', 5);

    if (!nearbyConnections) return;

    const nearbyZoneIds = nearbyConnections.map((c: { to_zone_id: number }) => c.to_zone_id);

    // Get crews in nearby zones
    const { data: supportCrews } = await supabase
      .from('current_crews')
      .select('crew_id')
      .in('zone_id', nearbyZoneIds)
      .gt('estimated_size', 0);

    if (supportCrews) {
      this.strategy.supportCrewIds = supportCrews.map((c: { crew_id: number }) => c.crew_id);
    }
  }

  /**
   * Assign new participant to crew
   * Invisibly funnels people to anchor crew based on strategy
   */
  async assignNewParticipant(
    supabase: SupabaseClient<Database>,
    userLat: number,
    userLng: number
  ): Promise<number> {
    // If no anchor selected yet, use normal assignment
    if (!this.strategy.anchorCrewId) {
      await this.selectAnchorCrew(supabase);
    }

    // Check if anchor needs reinforcement
    const { data: anchorCrew } = await supabase
      .from('current_crews')
      .select('estimated_size')
      .eq('crew_id', this.strategy.anchorCrewId)
      .single();

    const anchorSize = anchorCrew?.estimated_size || 0;

    // Dynamic funnel ratio based on anchor size
    let sendToAnchor = false;
    
    if (anchorSize < 100) {
      // Desperately need people at anchor
      sendToAnchor = Math.random() < 0.7; // 70% chance
    } else if (anchorSize < 200) {
      // Still building critical mass
      sendToAnchor = Math.random() < 0.5; // 50% chance
    } else if (anchorSize < 500) {
      // Maintain size
      sendToAnchor = Math.random() < 0.3; // 30% chance
    } else {
      // Anchor is huge, send to support
      sendToAnchor = Math.random() < 0.1; // 10% chance
    }

    // Geographic priority - if user is already near anchor zone
    if (!sendToAnchor && this.strategy.anchorZoneId) {
      const { data: anchorZone } = await supabase
        .from('zones')
        .select('center_lat, center_lng')
        .eq('id', this.strategy.anchorZoneId)
        .single();

      if (anchorZone) {
        const distanceToAnchor = this.calculateDistance(
          userLat, userLng,
          anchorZone.center_lat,
          anchorZone.center_lng
        );
        
        // If very close to anchor zone, send them there
        if (distanceToAnchor < 0.5) { // 500m
          sendToAnchor = true;
        }
      }
    }

    return sendToAnchor 
      ? this.strategy.anchorCrewId! 
      : this.selectSupportCrew();
  }

  /**
   * Select a support crew for assignment
   * Distributes evenly among non-anchor crews
   */
  private selectSupportCrew(): number {
    if (this.strategy.supportCrewIds.length === 0) {
      // Fallback to any crew
      return Math.ceil(Math.random() * 10);
    }
    
    // Random support crew
    const index = Math.floor(Math.random() * this.strategy.supportCrewIds.length);
    return this.strategy.supportCrewIds[index];
  }

  /**
   * Plan rotation that NEVER moves the anchor crew
   * Support crews rotate around them
   */
  async planAnchorAwareRotation(
    currentCrews: Array<{
      crew_id: number;
      zone_id: number;
      estimated_size: number;
    }>,
    zoneGraph: Map<number, {
      zone: {
        id: number;
        type: string;
      };
      neighbors: Map<number, any>;
    }>,
    dangerZones: Set<number>
  ): Promise<Array<{
    crew_id: number;
    from_zone_id: number;
    to_zone_id: number;
    walk_time: number;
    reason: string;
  }>> {
    const rotationPlan: Array<{
      crew_id: number;
      from_zone_id: number;
      to_zone_id: number;
      walk_time: number;
      reason: string;
    }> = [];

    for (const crew of currentCrews) {
      // NEVER rotate the anchor crew
      if (crew.crew_id === this.strategy.anchorCrewId) {
        continue;
      }

      // If anchor is in danger, evacuate it (only exception)
      if (
        crew.crew_id === this.strategy.anchorCrewId && 
        dangerZones.has(crew.zone_id)
      ) {
        // Emergency move to nearest safe primary zone
        const safeZone = this.findSafePrimaryZone(
          crew.zone_id,
          zoneGraph,
          dangerZones
        );
        
        if (safeZone) {
          rotationPlan.push({
            crew_id: crew.crew_id,
            from_zone_id: crew.zone_id,
            to_zone_id: safeZone,
            walk_time: 5,
            reason: 'ANCHOR EMERGENCY RELOCATION'
          });
          
          // Update anchor zone
          this.strategy.anchorZoneId = safeZone;
        }
      }

      // Normal rotation for support crews
      // ... (use existing rotation logic)
    }

    return rotationPlan;
  }

  /**
   * Find nearest safe primary zone for anchor relocation
   */
  private findSafePrimaryZone(
    currentZoneId: number,
    zoneGraph: Map<number, {
      zone: {
        id: number;
        type: string;
      };
      neighbors: Map<number, any>;
    }>,
    dangerZones: Set<number>
  ): number | null {
    const currentNode = zoneGraph.get(currentZoneId);
    if (!currentNode) return null;

    // Look for nearby primary zones
    for (const [neighborId, connection] of Array.from(currentNode.neighbors)) {
      const neighbor = zoneGraph.get(neighborId);
      if (
        neighbor &&
        neighbor.zone.type === 'primary' &&
        !dangerZones.has(neighborId)
      ) {
        return neighborId;
      }
    }

    return null;
  }

  /**
   * Get anchor status (for internal monitoring only)
   * NEVER expose this to frontend
   */
  getAnchorStatus(): {
    hasAnchor: boolean;
    anchorStrength: 'weak' | 'building' | 'strong' | 'dominant';
    supportCrewCount: number;
  } {
    if (!this.strategy.anchorCrewId) {
      return {
        hasAnchor: false,
        anchorStrength: 'weak',
        supportCrewCount: 0
      };
    }

    // Would need to query current size
    return {
      hasAnchor: true,
      anchorStrength: 'building', // TODO: Calculate based on size
      supportCrewCount: this.strategy.supportCrewIds.length
    };
  }

  private calculateDistance(
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
}