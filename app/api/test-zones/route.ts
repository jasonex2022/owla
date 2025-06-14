import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

export async function GET() {
  try {
    const supabase = createServerClient();
    
    // Test 1: Get all zones
    const { data: zones, error: zonesError } = await supabase
      .from('zones')
      .select('*');
    
    // Test 2: Test the RPC function with City Hall coordinates
    const { data: nearbyZones, error: rpcError } = await supabase
      .rpc('find_nearby_zones', {
        user_lat: 34.0537,
        user_lng: -118.2427,
        search_radius_meters: 5000 // 5km to test
      });
    
    // Test 3: Direct SQL query to verify PostGIS
    const { data: directTest, error: directError } = await supabase
      .from('zones')
      .select('*')
      .eq('id', 1);
    
    return NextResponse.json({
      success: true,
      zonesCount: zones?.length || 0,
      zones: zones || [],
      zonesError: zonesError?.message,
      nearbyZonesCount: nearbyZones?.length || 0,
      nearbyZones: nearbyZones || [],
      rpcError: rpcError?.message,
      cityHallZone: directTest,
      directError: directError?.message,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}