-- Update existing zones with specific intersection locations
-- This assumes zones already exist and updates their names

UPDATE zones SET name = CASE id
  WHEN 1 THEN 'Spring St & 1st St (City Hall South Lawn)'
  WHEN 2 THEN 'S Spring St & W 1st St (LAPD HQ)'
  WHEN 3 THEN 'S Hill St & W 5th St (Pershing Square)'
  WHEN 4 THEN 'S Grand Ave & W 1st St (Grand Park)'
  WHEN 5 THEN 'S Los Angeles St & W Temple St (Federal Building)'
  WHEN 6 THEN 'N Broadway & W Cesar E Chavez Ave (Union Station)'
  WHEN 7 THEN 'S San Pedro St & E 2nd St (Little Tokyo)'
  WHEN 8 THEN 'S Alameda St & E 3rd St (Arts District)'
  WHEN 9 THEN 'W 6th St & S Park View St (MacArthur Park)'
  WHEN 10 THEN 'N Park Ave & Glendale Blvd (Echo Park Lake)'
  WHEN 11 THEN 'S Figueroa St & W Jefferson Blvd (USC)'
  WHEN 12 THEN 'Westwood Plaza & Charles E Young Dr (UCLA)'
  WHEN 13 THEN 'Ocean Front Walk & Windward Ave (Venice Beach)'
  WHEN 14 THEN 'Hollywood Blvd & N Highland Ave (Hollywood)'
  WHEN 15 THEN 'N Vermont Canyon Rd & E Observatory Rd (Griffith)'
  ELSE name
END
WHERE id <= 15;

-- If you want to start fresh with proper intersection-based zones:
-- DELETE FROM crew_zones;
-- DELETE FROM zones;
-- ALTER SEQUENCE zones_id_seq RESTART WITH 1;

-- INSERT INTO zones (name, center_lat, center_lng, type, radius_meters) VALUES
-- -- Primary Protest Locations with intersections
-- ('Spring St & 1st St (City Hall)', 34.0537, -118.2427, 'primary', 200),
-- ('S Grand Ave & W 1st St (Grand Park)', 34.0569, -118.2468, 'primary', 300),
-- ('S Spring St & W 1st St (LAPD - AVOID)', 34.0502, -118.2456, 'avoid', 150),
-- ('S Los Angeles St & W Temple St (Federal Building)', 34.0563, -118.2545, 'primary', 200),
-- ('S Hill St & W 5th St (Pershing Square)', 34.0481, -118.2506, 'primary', 200),
-- ('S Grand Ave & W 4th St (California Plaza)', 34.0520, -118.2523, 'secondary', 150),
-- 
-- -- Transit and connecting intersections
-- ('N Hill St & W 1st St (Civic Center Metro)', 34.0551, -118.2463, 'secondary', 100),
-- ('N Grand Ave & W Temple St (Music Center)', 34.0571, -118.2498, 'secondary', 200),
-- ('S Hill St & W 3rd St (Angels Flight)', 34.0511, -118.2502, 'secondary', 100),
-- ('S Spring St & W 1st St (Historic Core)', 34.0525, -118.2441, 'secondary', 100),
-- ('S Broadway & W 3rd St (Broadway Theater)', 34.0507, -118.2488, 'secondary', 100),
-- ('S Spring St & W 2nd St (Times Building)', 34.0529, -118.2453, 'secondary', 150),
-- 
-- -- Nearby walkable intersections
-- ('S San Pedro St & E 2nd St (Little Tokyo)', 34.0498, -118.2399, 'secondary', 200),
-- ('N Alameda St & Cesar E Chavez Ave (Union Station)', 34.0561, -118.2365, 'secondary', 300),
-- ('N Broadway & College St (Chinatown)', 34.0636, -118.2378, 'secondary', 200),
-- ('S Spring St & W 5th St (Historic Core)', 34.0456, -118.2505, 'secondary', 150),
-- ('S Figueroa St & W 7th St (7th/Metro)', 34.0486, -118.2587, 'secondary', 200),
-- ('W 6th St & S Park View St (MacArthur Park)', 34.0592, -118.2783, 'primary', 400),
-- ('N Hill St & W Temple St (Cathedral)', 34.0575, -118.2449, 'secondary', 150),
-- ('W 5th St & S Flower St (Central Library)', 34.0502, -118.2555, 'secondary', 200);