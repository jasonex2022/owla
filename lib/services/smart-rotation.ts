/**
 * Smart Zone Rotation System
 * Ensures crews only move to walkable zones (4-6 minutes)
 */

import { createClient } from '@supabase/supabase-js';

interface Zone {
  id: number;
  name: string;
  type: 'primary' | 'secondary' | 'avoid';
  center_lat: number;
  center_lng: number;
}

interface ZoneConnection {
  from_zone_id: number;
  to_zone_id: number;
  walk_time_minutes: number;
  distance_meters: number;
  route_type: 'direct' | 'street' | 'underground';
}

interface CrewAssignment {
  crew_id: number;
  zone_id: number;
  estimated_size: number;
  assigned_at: Date;
}

interface RotationPlan {
  crew_id: number;
  from_zone_id: number;
  to_zone_id: number;
  walk_time: number;
  reason: string;
}

export class SmartRotationService {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  /**
   * Calculate next rotation ensuring all moves are walkable
   */
  async planRotation(): Promise<RotationPlan[]> {
    // 1. Get current crew positions
    const { data: currentCrews } = await this.supabase
      .from('current_crews')
      .select('crew_id, zone_id, estimated_size')
      .gt('estimated_size', 0) as { data: Array<{ crew_id: number; zone_id: number; estimated_size: number }> | null };

    if (!currentCrews || currentCrews.length === 0) {
      return [];
    }

    // 2. Get zone connections (walkable paths)
    const { data: connections } = await this.supabase
      .from('zone_connections')
      .select('*')
      .lte('walk_time_minutes', 6) as { data: ZoneConnection[] | null }; // Max 6 minute walk

    // 3. Get current zone statuses
    const { data: zones } = await this.supabase
      .from('zones')
      .select('*')
      .neq('type', 'avoid') as { data: Zone[] | null };

    // 4. Get police activity
    const { data: policeActivity } = await this.supabase
      .from('police_activity')
      .select('zone_id, severity')
      .gt('expires_at', new Date().toISOString()) as { data: Array<{ zone_id: number; severity: string }> | null };

    // Build zone graph
    const zoneGraph = this.buildZoneGraph(zones || [], connections || []);
    const dangerZones = new Set<number>(
      policeActivity
        ?.filter(p => p.severity === 'high' || p.severity === 'critical')
        .map(p => p.zone_id) || []
    );

    // 5. Calculate rotation plan
    return this.calculateOptimalRotation(
      currentCrews || [],
      zoneGraph,
      dangerZones
    );
  }

  /**
   * Build graph of walkable connections between zones
   */
  private buildZoneGraph(zones: Zone[], connections: ZoneConnection[]) {
    const graph = new Map<number, {
      zone: Zone;
      neighbors: Map<number, ZoneConnection>;
    }>();

    // Initialize zones
    zones.forEach(zone => {
      graph.set(zone.id, {
        zone,
        neighbors: new Map()
      });
    });

    // Add connections
    connections.forEach(conn => {
      const fromNode = graph.get(conn.from_zone_id);
      if (fromNode) {
        fromNode.neighbors.set(conn.to_zone_id, conn);
      }
    });

    return graph;
  }

  /**
   * Calculate optimal rotation considering:
   * - Walking distance constraints
   * - Strategic zone coverage
   * - Police activity avoidance
   * - Crowd distribution
   */
  private calculateOptimalRotation(
    currentCrews: Array<{ crew_id: number; zone_id: number; estimated_size: number }>,
    zoneGraph: Map<number, {
      zone: Zone;
      neighbors: Map<number, ZoneConnection>;
    }>,
    dangerZones: Set<number>
  ): RotationPlan[] {
    const rotationPlan: RotationPlan[] = [];
    const targetZoneOccupancy = new Map<number, number>();

    // Initialize current occupancy
    currentCrews.forEach(crew => {
      const current = targetZoneOccupancy.get(crew.zone_id) || 0;
      targetZoneOccupancy.set(crew.zone_id, current + 1);
    });

    // Determine rotation percentage (40-60% for unpredictability)
    const rotationRate = 0.4 + Math.random() * 0.2;
    const crewsToRotate = Math.ceil(currentCrews.length * rotationRate);

    // Sort crews by rotation priority
    const prioritizedCrews = [...currentCrews].sort((a, b) => {
      // Priority 1: Crews in danger zones must move
      if (dangerZones.has(a.zone_id) && !dangerZones.has(b.zone_id)) return -1;
      if (!dangerZones.has(a.zone_id) && dangerZones.has(b.zone_id)) return 1;

      // Priority 2: Larger crews (more visible)
      return b.estimated_size - a.estimated_size;
    });

    // Plan moves for each crew
    prioritizedCrews.forEach((crew, index) => {
      const mustMove = dangerZones.has(crew.zone_id);
      const shouldMove = mustMove || index < crewsToRotate;

      if (!shouldMove) return;

      const currentNode = zoneGraph.get(crew.zone_id);
      if (!currentNode) return;

      // Find best neighboring zone
      let bestMove: RotationPlan | undefined;
      let bestScore = -Infinity;
      let bestReason = '';

      currentNode.neighbors.forEach((connection: ZoneConnection, neighborId: number) => {
        const neighbor = zoneGraph.get(neighborId);
        if (!neighbor) return;

        // Skip danger zones unless no choice
        if (dangerZones.has(neighborId) && !mustMove) return;

        // Calculate move score
        const score = this.calculateMoveScore(
          crew,
          neighborId,
          neighbor.zone,
          connection,
          targetZoneOccupancy,
          dangerZones
        );

        if (score.total > bestScore) {
          bestScore = score.total;
          bestMove = {
            crew_id: crew.crew_id,
            from_zone_id: crew.zone_id,
            to_zone_id: neighborId,
            walk_time: connection.walk_time_minutes,
            reason: score.reason
          } as RotationPlan;
          bestReason = score.reason;
        }
      });

      if (bestMove) {
        rotationPlan.push(bestMove);
        
        // Update target occupancy
        const currentOcc = targetZoneOccupancy.get(crew.zone_id) || 0;
        targetZoneOccupancy.set(crew.zone_id, Math.max(0, currentOcc - 1));
        
        const newOcc = targetZoneOccupancy.get(bestMove.to_zone_id) || 0;
        targetZoneOccupancy.set(bestMove.to_zone_id, newOcc + 1);
      }
    });

    return rotationPlan;
  }

  /**
   * Score a potential move based on multiple factors
   */
  private calculateMoveScore(
    crew: { crew_id: number; zone_id: number; estimated_size: number },
    targetZoneId: number,
    targetZone: Zone,
    connection: ZoneConnection,
    occupancy: Map<number, number>,
    dangerZones: Set<number>
  ) {
    let score = 0;
    let reasons = [];

    // Distance penalty (prefer shorter walks)
    const distanceScore = (6 - connection.walk_time_minutes) * 10;
    score += distanceScore;
    if (connection.walk_time_minutes <= 4) {
      reasons.push('short walk');
    }

    // Zone type bonus
    if (targetZone.type === 'primary') {
      score += 20;
      reasons.push('high visibility');
    }

    // Avoid overcrowding
    const targetOccupancy = occupancy.get(targetZoneId) || 0;
    const crowdScore = Math.max(0, 30 - (targetOccupancy * 10));
    score += crowdScore;
    if (targetOccupancy === 0) {
      reasons.push('empty zone');
    }

    // Safety considerations
    if (dangerZones.has(targetZoneId)) {
      score -= 50;
      reasons.push('police activity');
    }

    // Underground route bonus (quick escape)
    if (connection.route_type === 'underground') {
      score += 15;
      reasons.push('metro access');
    }

    // Large crew considerations
    if (crew.estimated_size > 100 && targetZone.type === 'primary') {
      score += 15;
      reasons.push('visibility for large group');
    }

    return {
      total: score,
      reason: reasons.join(', ')
    };
  }

  /**
   * Emergency dispersal - find safe zones for all crews
   */
  async emergencyDispersal(threatZoneId: number): Promise<RotationPlan[]> {
    // Get all crews
    const { data: allCrews } = await this.supabase
      .from('current_crews')
      .select('crew_id, zone_id, estimated_size')
      .gt('estimated_size', 0) as { data: Array<{ crew_id: number; zone_id: number; estimated_size: number }> | null };

    // Get safe zones with metro access
    const { data: safeZones } = await this.supabase
      .from('zone_connections')
      .select('to_zone_id')
      .eq('route_type', 'underground')
      .eq('from_zone_id', threatZoneId) as { data: Array<{ to_zone_id: number }> | null };

    // Quick dispersal plan
    const dispersalPlan: RotationPlan[] = [];
    
    allCrews?.forEach(crew => {
      if (crew.zone_id === threatZoneId) {
        // Urgent evacuation
        const safeZone = safeZones?.[0]?.to_zone_id || null;
        if (safeZone) {
          dispersalPlan.push({
            crew_id: crew.crew_id,
            from_zone_id: crew.zone_id,
            to_zone_id: safeZone,
            walk_time: 2, // Assume running
            reason: 'EMERGENCY EVACUATION'
          });
        }
      }
    });

    return dispersalPlan;
  }

  /**
   * Dynamic zone creation based on crowd gathering
   */
  async suggestNewZone(lat: number, lng: number, crowdSize: number): Promise<{
    suitable: boolean;
    nearbyZones: Array<{zone: Zone; distance: number; walk_time: number}>;
    reason: string;
  }> {
    // Check if location is near existing zones
    const { data: zones } = await this.supabase
      .rpc('find_nearby_zones', {
        lat,
        lng,
        radius_meters: 500 // 6-7 minute walk
      }) as { data: Array<{ zone: Zone; distance: number; walk_time: number }> | null };

    if (!zones || zones.length === 0) {
      return {
        suitable: false,
        nearbyZones: [],
        reason: 'Too far from existing protest network'
      };
    }

    // Check if crowd is large enough
    if (crowdSize < 50) {
      return {
        suitable: false,
        nearbyZones: zones || [],
        reason: 'Crowd too small - direct to nearest zone'
      };
    }

    // Location is suitable for new zone
    return {
      suitable: true,
      nearbyZones: zones || [],
      reason: `Strategic location with ${zones?.length || 0} walkable connections`
    };
  }
}