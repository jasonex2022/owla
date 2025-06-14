/**
 * Supabase client configuration
 * Provides typed clients for both public and server use
 */

import { createClient } from '@supabase/supabase-js';

// Database types (generated from schema)
export interface Database {
  public: {
    Tables: {
      zones: {
        Row: {
          id: number;
          name: string;
          center_lat: number;
          center_lng: number;
          radius_meters: number;
          type: 'primary' | 'secondary' | 'avoid';
          active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['zones']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['zones']['Insert']>;
      };
      crew_zones: {
        Row: {
          crew_id: number;
          zone_id: number;
          assigned_at: string;
          next_rotation: string;
          estimated_size: number;
        };
        Insert: Omit<Database['public']['Tables']['crew_zones']['Row'], 'assigned_at' | 'next_rotation'>;
        Update: Partial<Database['public']['Tables']['crew_zones']['Insert']>;
      };
      movement_stats: {
        Row: {
          id: number;
          timestamp: string;
          total_crews_active: number;
          total_estimated_protesters: number;
          zones_occupied: number[];
          rotation_number: number;
        };
        Insert: Omit<Database['public']['Tables']['movement_stats']['Row'], 'id' | 'timestamp'>;
        Update: Partial<Database['public']['Tables']['movement_stats']['Insert']>;
      };
      police_activity: {
        Row: {
          id: number;
          zone_id: number;
          severity: 'low' | 'medium' | 'high' | 'critical';
          description: string;
          source: 'citizen' | 'news' | 'social';
          reported_at: string;
          expires_at: string;
        };
        Insert: Omit<Database['public']['Tables']['police_activity']['Row'], 'id' | 'reported_at' | 'expires_at'>;
        Update: Partial<Database['public']['Tables']['police_activity']['Insert']>;
      };
    };
    Views: {
      current_crews: {
        Row: {
          crew_id: number;
          zone_id: number;
          assigned_at: string;
          next_rotation: string;
          estimated_size: number;
        };
      };
    };
    Functions: {
      get_crew_stats: {
        Args: Record<string, never>;
        Returns: {
          active_crews: number;
          total_protesters: number;
          zones_occupied: number;
          next_rotation: string;
        };
      };
      rotate_crews: {
        Args: { rotation_plan: string };
        Returns: void;
      };
    };
  };
}

// Public client for browser use (anon key)
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false, // No auth needed
      autoRefreshToken: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 2, // Limit realtime updates
      },
    },
  }
);

// Server client for API routes (service role)
export function createServerClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

// Realtime subscription helpers
export function subscribeToCrewUpdates(
  callback: (payload: any) => void
) {
  return supabase
    .channel('crew-updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'crew_zones',
      },
      callback
    )
    .subscribe();
}

export function subscribeToPoliceActivity(
  callback: (payload: any) => void
) {
  return supabase
    .channel('police-activity')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'police_activity',
      },
      callback
    )
    .subscribe();
}

export function subscribeToStats(
  callback: (payload: any) => void
) {
  return supabase
    .channel('movement-stats')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'movement_stats',
      },
      callback
    )
    .subscribe();
}