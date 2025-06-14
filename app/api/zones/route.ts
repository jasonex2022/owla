import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { getAllActiveCrews } from '@/lib/services/crews';

/**
 * GET /api/zones
 * Get all active zones and crews
 * This is public information - transparency is our strength
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get all zones
    const { data: zones, error: zonesError } = await supabase
      .from('zones')
      .select('*')
      .eq('active', true)
      .order('type', { ascending: true })
      .order('name', { ascending: true });
    
    if (zonesError) throw zonesError;
    
    // Get active crews with their zones
    const activeCrews = await getAllActiveCrews(supabase);
    
    // Get police activity
    const { data: policeActivity } = await supabase
      .from('police_activity')
      .select('zone_id, severity, description')
      .gt('expires_at', new Date().toISOString());
    
    // Get movement stats
    const { data: stats } = await supabase
      .rpc('get_crew_stats')
      .single() as { data: any };
    
    // Build zone status map
    const zoneStatus = new Map<number, any>();
    
    // Add crew counts to zones
    activeCrews.forEach((crew: any) => {
      if (crew.zone?.id) {
        const current = zoneStatus.get(crew.zone.id) || { crews: [], totalProtesters: 0 };
        current.crews.push({
          id: crew.id,
          name: crew.name,
          size: crew.size,
        });
        current.totalProtesters += crew.size;
        zoneStatus.set(crew.zone.id, current);
      }
    });
    
    // Add police activity to zones
    policeActivity?.forEach((activity: any) => {
      const current = zoneStatus.get(activity.zone_id) || { crews: [], totalProtesters: 0 };
      current.policeActivity = {
        severity: activity.severity,
        description: activity.description,
      };
      zoneStatus.set(activity.zone_id, current);
    });
    
    // Combine all data
    const zonesWithStatus = zones?.map(zone => ({
      ...zone,
      status: zoneStatus.get(zone.id) || { crews: [], totalProtesters: 0 },
    })) || [];
    
    // Calculate next rotation time (every 30 minutes)
    const now = Date.now();
    const rotationInterval = 30 * 60 * 1000; // 30 minutes
    const currentCycle = Math.floor(now / rotationInterval);
    const nextRotationTime = (currentCycle + 1) * rotationInterval;
    
    return NextResponse.json({
      success: true,
      zones: zonesWithStatus,
      stats: {
        totalCrews: stats?.active_crews || 0,
        totalProtesters: stats?.total_protesters || 0,
        activeZones: stats?.zones_occupied || 0,
        nextRotation: new Date(nextRotationTime).toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Zones fetch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch zones',
        zones: [],
        stats: {
          totalCrews: 0,
          totalProtesters: 0,
          activeZones: 0,
          nextRotation: null,
        }
      },
      { status: 500 }
    );
  }
}