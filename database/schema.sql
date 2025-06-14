-- OVERWHELM - Minimal Database Schema
-- Only stores crew-level data, never individual users
-- Designed for maximum privacy and minimal attack surface

-- Zones: Pre-defined protest zones for the city
CREATE TABLE zones (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  center_lat DECIMAL(10, 8) NOT NULL,
  center_lng DECIMAL(11, 8) NOT NULL,
  radius_meters INTEGER DEFAULT 500,
  type TEXT CHECK (type IN ('primary', 'secondary', 'avoid')) DEFAULT 'secondary',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crew-Zone Assignments: Current location of each crew
CREATE TABLE crew_zones (
  crew_id INTEGER NOT NULL CHECK (crew_id BETWEEN 1 AND 50),
  zone_id INTEGER REFERENCES zones(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  next_rotation TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 minutes',
  estimated_size INTEGER DEFAULT 0,
  PRIMARY KEY (crew_id, assigned_at)
);

-- Current view: Only the latest assignment for each crew
CREATE VIEW current_crews AS
SELECT DISTINCT ON (crew_id)
  crew_id,
  zone_id,
  assigned_at,
  next_rotation,
  estimated_size
FROM crew_zones
ORDER BY crew_id, assigned_at DESC;

-- Movement Stats: Aggregate data only, no individual tracking
CREATE TABLE movement_stats (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  total_crews_active INTEGER DEFAULT 0,
  total_estimated_protesters INTEGER DEFAULT 0,
  zones_occupied INTEGER[] DEFAULT '{}',
  rotation_number INTEGER DEFAULT 0
);

-- Police Activity: Scraped data about danger zones
CREATE TABLE police_activity (
  id SERIAL PRIMARY KEY,
  zone_id INTEGER REFERENCES zones(id),
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  description TEXT,
  source TEXT CHECK (source IN ('citizen', 'news', 'social')) DEFAULT 'citizen',
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '2 hours'
);

-- Indexes for performance
CREATE INDEX idx_crew_zones_current ON crew_zones(crew_id, assigned_at DESC);
CREATE INDEX idx_crew_zones_zone ON crew_zones(zone_id, assigned_at DESC);
CREATE INDEX idx_police_activity_active ON police_activity(zone_id, expires_at DESC);
CREATE INDEX idx_movement_stats_recent ON movement_stats(timestamp DESC);
CREATE INDEX idx_zones_active ON zones(active, type) WHERE active = true;

-- Ensure crew IDs stay within bounds
ALTER TABLE crew_zones ADD CONSTRAINT valid_crew_id CHECK (crew_id BETWEEN 1 AND 50);
ALTER TABLE crew_zones ADD CONSTRAINT valid_crew_size CHECK (estimated_size >= 0 AND estimated_size <= 300);

-- Add cleanup job for old data (privacy-preserving)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Delete crew assignments older than 24 hours
  DELETE FROM crew_zones WHERE assigned_at < NOW() - INTERVAL '24 hours';
  
  -- Delete expired police activity
  DELETE FROM police_activity WHERE expires_at < NOW();
  
  -- Delete movement stats older than 7 days  
  DELETE FROM movement_stats WHERE timestamp < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security (RLS) - Everyone can read, only service role can write
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE police_activity ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read zones" ON zones FOR SELECT USING (true);
CREATE POLICY "Public read crews" ON crew_zones FOR SELECT USING (true);
CREATE POLICY "Public read stats" ON movement_stats FOR SELECT USING (true);
CREATE POLICY "Public read police" ON police_activity FOR SELECT USING (true);

-- Only service role can insert/update
CREATE POLICY "Service write zones" ON zones FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write crews" ON crew_zones FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write stats" ON movement_stats FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write police" ON police_activity FOR ALL USING (auth.role() = 'service_role');

-- Function to get crew statistics
CREATE OR REPLACE FUNCTION get_crew_stats()
RETURNS TABLE (
  active_crews INTEGER,
  total_protesters INTEGER,
  zones_occupied INTEGER,
  next_rotation TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT crew_id)::INTEGER,
    SUM(estimated_size)::INTEGER,
    COUNT(DISTINCT zone_id)::INTEGER,
    MIN(current_crews.next_rotation)
  FROM current_crews
  WHERE estimated_size > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to rotate crews (called every 30 minutes)
CREATE OR REPLACE FUNCTION rotate_crews(
  rotation_plan JSONB
) RETURNS void AS $$
DECLARE
  crew_assignment JSONB;
  rotation_num INTEGER;
BEGIN
  -- Get current rotation number
  SELECT COALESCE(MAX(rotation_number), 0) + 1 INTO rotation_num FROM movement_stats;
  
  -- Insert new crew assignments
  FOR crew_assignment IN SELECT * FROM jsonb_array_elements(rotation_plan)
  LOOP
    INSERT INTO crew_zones (crew_id, zone_id, estimated_size)
    VALUES (
      (crew_assignment->>'crew_id')::INTEGER,
      (crew_assignment->>'zone_id')::INTEGER,
      (crew_assignment->>'estimated_size')::INTEGER
    );
  END LOOP;
  
  -- Record movement stats
  INSERT INTO movement_stats (
    total_crews_active,
    total_estimated_protesters,
    zones_occupied,
    rotation_number
  )
  SELECT 
    COUNT(DISTINCT crew_id),
    SUM(estimated_size),
    array_agg(DISTINCT zone_id),
    rotation_num
  FROM current_crews
  WHERE estimated_size > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add missing database functions for crew size updates
CREATE OR REPLACE FUNCTION increment_crew_size(
  p_crew_id INTEGER,
  p_increment INTEGER DEFAULT 1
) RETURNS void AS $$
BEGIN
  UPDATE crew_zones 
  SET estimated_size = estimated_size + p_increment
  WHERE crew_id = p_crew_id 
  AND assigned_at = (
    SELECT MAX(assigned_at) 
    FROM crew_zones 
    WHERE crew_id = p_crew_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get zone statistics
CREATE OR REPLACE FUNCTION get_zone_stats(
  p_zone_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
  zone_id INTEGER,
  zone_name TEXT,
  total_crews INTEGER,
  total_protesters INTEGER,
  has_police_activity BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    z.id as zone_id,
    z.name as zone_name,
    COUNT(DISTINCT c.crew_id)::INTEGER as total_crews,
    COALESCE(SUM(c.estimated_size), 0)::INTEGER as total_protesters,
    EXISTS(
      SELECT 1 FROM police_activity p 
      WHERE p.zone_id = z.id 
      AND p.expires_at > NOW()
    ) as has_police_activity
  FROM zones z
  LEFT JOIN current_crews c ON c.zone_id = z.id
  WHERE z.active = true
  AND (p_zone_id IS NULL OR z.id = p_zone_id)
  GROUP BY z.id, z.name;
END;
$$ LANGUAGE plpgsql;

-- Add the find_nearby_zones function for location-based crew assignment
CREATE OR REPLACE FUNCTION find_nearby_zones(
  user_lat DECIMAL,
  user_lng DECIMAL,
  search_radius_meters INTEGER DEFAULT 500
)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  distance_meters DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    z.id,
    z.name,
    -- Haversine formula for distance calculation
    CAST(
      6371000 * 2 * ASIN(
        SQRT(
          POWER(SIN((RADIANS(z.center_lat) - RADIANS(user_lat)) / 2), 2) +
          COS(RADIANS(user_lat)) * COS(RADIANS(z.center_lat)) *
          POWER(SIN((RADIANS(z.center_lng) - RADIANS(user_lng)) / 2), 2)
        )
      ) AS DECIMAL
    ) AS distance_meters
  FROM zones z
  WHERE z.active = true
  AND z.type != 'avoid'
  AND 
    -- Bounding box pre-filter for performance
    z.center_lat BETWEEN user_lat - (search_radius_meters / 111000.0) 
                     AND user_lat + (search_radius_meters / 111000.0)
  AND 
    z.center_lng BETWEEN user_lng - (search_radius_meters / (111000.0 * COS(RADIANS(user_lat)))) 
                     AND user_lng + (search_radius_meters / (111000.0 * COS(RADIANS(user_lat))))
  HAVING
    -- Final distance check
    CAST(
      6371000 * 2 * ASIN(
        SQRT(
          POWER(SIN((RADIANS(z.center_lat) - RADIANS(user_lat)) / 2), 2) +
          COS(RADIANS(user_lat)) * COS(RADIANS(z.center_lat)) *
          POWER(SIN((RADIANS(z.center_lng) - RADIANS(user_lng)) / 2), 2)
        )
      ) AS DECIMAL
    ) <= search_radius_meters
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to anon users
GRANT EXECUTE ON FUNCTION find_nearby_zones(DECIMAL, DECIMAL, INTEGER) TO anon;

-- Initial zones for Los Angeles with intersection-based names
INSERT INTO zones (name, center_lat, center_lng, type) VALUES
-- Primary protest zones with intersections
('Spring St & 1st St (City Hall South Lawn)', 34.0537, -118.2427, 'primary'),
('S Spring St & W 1st St (LAPD HQ)', 34.0502, -118.2456, 'primary'),
('S Hill St & W 5th St (Pershing Square)', 34.0481, -118.2506, 'primary'),
('S Grand Ave & W 1st St (Grand Park)', 34.0569, -118.2468, 'primary'),
('S Los Angeles St & W Temple St (Federal Building)', 34.0563, -118.2545, 'primary'),

-- Secondary zones with intersections
('N Broadway & W Cesar E Chavez Ave (Union Station)', 34.0561, -118.2365, 'secondary'),
('S San Pedro St & E 2nd St (Little Tokyo)', 34.0498, -118.2399, 'secondary'),
('S Alameda St & E 3rd St (Arts District)', 34.0403, -118.2367, 'secondary'),
('W 6th St & S Park View St (MacArthur Park)', 34.0592, -118.2783, 'secondary'),
('N Park Ave & Glendale Blvd (Echo Park Lake)', 34.0728, -118.2606, 'secondary'),
('S Figueroa St & W Jefferson Blvd (USC)', 34.0224, -118.2851, 'secondary'),
('Westwood Plaza & Charles E Young Dr (UCLA)', 34.0689, -118.4452, 'secondary'),
('Ocean Front Walk & Windward Ave (Venice Beach)', 33.9850, -118.4695, 'secondary'),
('Hollywood Blvd & N Highland Ave (Hollywood)', 34.1022, -118.3401, 'secondary'),
('N Vermont Canyon Rd & E Observatory Rd (Griffith)', 34.1184, -118.3004, 'secondary');

-- Enable realtime subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE crew_zones;
ALTER PUBLICATION supabase_realtime ADD TABLE movement_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE police_activity;

-- Create initial movement stats entry
INSERT INTO movement_stats (total_crews_active, total_estimated_protesters, zones_occupied, rotation_number)
VALUES (0, 0, '{}', 0);

-- Grant necessary permissions for anon users (read-only)
GRANT SELECT ON zones TO anon;
GRANT SELECT ON crew_zones TO anon;
GRANT SELECT ON current_crews TO anon;
GRANT SELECT ON movement_stats TO anon;
GRANT SELECT ON police_activity TO anon;
GRANT EXECUTE ON FUNCTION get_crew_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_zone_stats(INTEGER) TO anon;

-- Additional function for getting nearby zones with crew info
CREATE OR REPLACE FUNCTION get_zones_with_crews(
  user_lat DECIMAL DEFAULT NULL,
  user_lng DECIMAL DEFAULT NULL,
  max_distance_meters INTEGER DEFAULT 5000
)
RETURNS TABLE (
  zone_id INTEGER,
  zone_name TEXT,
  zone_type TEXT,
  distance_meters DECIMAL,
  crews JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH zone_distances AS (
    SELECT 
      z.id,
      z.name,
      z.type,
      CASE 
        WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
          CAST(
            6371000 * 2 * ASIN(
              SQRT(
                POWER(SIN((RADIANS(z.center_lat) - RADIANS(user_lat)) / 2), 2) +
                COS(RADIANS(user_lat)) * COS(RADIANS(z.center_lat)) *
                POWER(SIN((RADIANS(z.center_lng) - RADIANS(user_lng)) / 2), 2)
              )
            ) AS DECIMAL
          )
        ELSE NULL
      END AS distance
    FROM zones z
    WHERE z.active = true
  ),
  zone_crews AS (
    SELECT 
      c.zone_id,
      jsonb_agg(
        jsonb_build_object(
          'id', c.crew_id,
          'name', 'Crew ' || c.crew_id,
          'size', c.estimated_size
        ) ORDER BY c.crew_id
      ) AS crews
    FROM current_crews c
    WHERE c.estimated_size > 0
    GROUP BY c.zone_id
  )
  SELECT 
    zd.id AS zone_id,
    zd.name AS zone_name,
    zd.type AS zone_type,
    zd.distance AS distance_meters,
    COALESCE(zc.crews, '[]'::jsonb) AS crews
  FROM zone_distances zd
  LEFT JOIN zone_crews zc ON zc.zone_id = zd.id
  WHERE 
    zd.distance IS NULL 
    OR zd.distance <= max_distance_meters
  ORDER BY 
    CASE WHEN zd.distance IS NULL THEN 1 ELSE 0 END,
    zd.distance,
    zd.id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_zones_with_crews(DECIMAL, DECIMAL, INTEGER) TO anon;