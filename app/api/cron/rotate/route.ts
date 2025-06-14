import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { rotateCrews, shouldRotate } from '@/lib/services/rotation';
import { collectPoliceActivity } from '@/lib/services/scraper';
import { loadZonesFromGeoJSON, getDefaultZones } from '@/lib/config/zones';

/**
 * GET /api/cron/rotate
 * Cron job that runs every minute to check if rotation is needed
 * Rotates crews at :00 and :30 marks
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const supabase = createServerClient();
    
    // Check if we should rotate
    const shouldDoRotation = await shouldRotate(supabase);
    if (!shouldDoRotation) {
      return NextResponse.json({
        success: true,
        message: 'No rotation needed at this time',
        timestamp: new Date().toISOString(),
      });
    }
    
    // First, collect latest police activity
    const cityName = process.env.NEXT_PUBLIC_CITY_NAME || 'Los Angeles';
    const newsApiKey = process.env.NEWS_API_KEY || '';
    
    // Load zones (from GeoJSON or defaults)
    let zones;
    try {
      zones = await loadZonesFromGeoJSON('/data/los-angeles-county.geojson');
    } catch {
      zones = getDefaultZones();
    }
    
    // Collect police data (non-blocking)
    const collectionPromise = collectPoliceActivity(
      supabase,
      newsApiKey,
      cityName,
      zones
    );
    
    // Execute rotation
    const rotationResult = await rotateCrews(supabase, zones);
    
    // Wait for collection to finish
    const collectionResult = await collectionPromise;
    
    return NextResponse.json({
      success: rotationResult.success,
      rotation: {
        ...rotationResult,
        collectionResult,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Cron rotation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Rotation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/rotate
 * Manual rotation trigger (for testing)
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const supabase = createServerClient();
    const zones = getDefaultZones();
    
    // Force rotation
    const result = await rotateCrews(supabase, zones);
    
    return NextResponse.json({
      success: result.success,
      message: 'Manual rotation completed',
      result,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Manual rotation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Manual rotation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}