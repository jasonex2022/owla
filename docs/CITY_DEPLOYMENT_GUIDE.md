# City Deployment Guide

## How to Deploy Overwhelm for Your City

This guide shows how to replicate the Los Angeles implementation for any city, ensuring crews can walk between zones in 4-6 minutes for effective protest coordination.

### Prerequisites

1. **Map out your city's protest landscape**
   - Identify 10-20 key locations where protests typically occur
   - Include government buildings, public squares, parks, transit hubs
   - Note which areas to avoid (police stations, federal buildings)

2. **Walk the routes**
   - Physically time walks between locations
   - Note obstacles, one-way streets, underground passages
   - Identify safe retreat routes

### Step 1: Define Your Zone Network

Create a file `database/seed-[YOURCITY]-zones.sql`:

```sql
-- Example: Chicago Zones
INSERT INTO zones (name, center_lat, center_lng, type, radius_meters) VALUES
-- Primary Protest Locations (high visibility)
('Daley Plaza', 41.8843, -87.6298, 'primary', 200),
('Federal Plaza', 41.8788, -87.6293, 'primary', 200),
('Grant Park', 41.8739, -87.6243, 'primary', 300),
('Millennium Park', 41.8826, -87.6234, 'primary', 200),

-- Secondary Zones (support/movement)
('Union Station', 41.8789, -87.6402, 'secondary', 200),
('Willis Tower Plaza', 41.8788, -87.6359, 'secondary', 150),

-- Avoid Zones (mark but don't route through)
('Chicago Police HQ', 41.8956, -87.6242, 'avoid', 100);
```

### Step 2: Map Walking Connections

Define which zones connect within 4-6 minute walks:

```sql
-- Walking connections (must be tested!)
INSERT INTO zone_connections 
(from_zone_id, to_zone_id, walk_time_minutes, distance_meters, route_type) 
VALUES
-- Daley Plaza connections
(
  (SELECT id FROM zones WHERE name = 'Daley Plaza'),
  (SELECT id FROM zones WHERE name = 'Federal Plaza'),
  4.5, 350, 'street'
),
-- Add reverse connection
(
  (SELECT id FROM zones WHERE name = 'Federal Plaza'),
  (SELECT id FROM zones WHERE name = 'Daley Plaza'),
  4.5, 350, 'street'
);
```

### Step 3: Define Strategic Patterns

Different cities need different strategies:

#### High-Density Urban (NYC, Chicago)
- Focus on subway connections for rapid movement
- Use building plazas and small parks
- Plan for vertical movement (bridges, tunnels)

#### Sprawled Cities (LA, Houston)
- Create tight clusters of zones
- Cannot cover whole city - focus on downtown
- Consider parking/transit for initial gathering

#### Historic Cities (Boston, Philadelphia)
- Use traditional gathering spaces
- Account for narrow streets
- Leverage tourist areas for visibility

### Step 4: Configure Environment

Update `.env.local`:

```env
NEXT_PUBLIC_CITY_NAME=Chicago
NEXT_PUBLIC_CITY_SHORT=CHI
NEXT_PUBLIC_CITY_CENTER_LAT=41.8781
NEXT_PUBLIC_CITY_CENTER_LNG=-87.6298
NEXT_PUBLIC_CITY_RADIUS_KM=30
NEXT_PUBLIC_WALKING_RADIUS_KM=2
```

### Step 5: Test Your Network

Run validation queries:

```sql
-- Check all zones are connected
WITH connected_zones AS (
  SELECT DISTINCT from_zone_id as zone_id FROM zone_connections
  UNION
  SELECT DISTINCT to_zone_id FROM zone_connections
)
SELECT 
  z.name,
  CASE WHEN cz.zone_id IS NULL THEN 'ISOLATED!' ELSE 'Connected' END as status
FROM zones z
LEFT JOIN connected_zones cz ON z.id = cz.zone_id
WHERE z.type != 'avoid';

-- Verify walking times
SELECT 
  z1.name as from_zone,
  z2.name as to_zone,
  zc.walk_time_minutes,
  zc.distance_meters
FROM zone_connections zc
JOIN zones z1 ON z1.id = zc.from_zone_id
JOIN zones z2 ON z2.id = zc.to_zone_id
ORDER BY zc.walk_time_minutes DESC;
```

### Key Principles

1. **Walkability First**
   - Every zone must connect to 2+ other zones
   - Maximum 6 minute walks (400-500 meters)
   - Account for crowds slowing movement

2. **Strategic Value**
   - Primary zones: Government, media visibility
   - Secondary zones: Community support, transit
   - Avoid zones: Police, federal buildings

3. **Natural Flow**
   - Follow existing pedestrian patterns
   - Use parks and plazas as gathering points
   - Plan escape routes to transit

4. **Local Knowledge**
   - Consult local organizers
   - Learn from past protests
   - Understand police patterns

### Testing Checklist

- [ ] All zones within 5-minute walk of another zone
- [ ] At least 3 primary (high-visibility) zones
- [ ] Transit connections marked
- [ ] Police/federal buildings marked as 'avoid'
- [ ] Tested actual walking times
- [ ] Validated with local organizers

### Common Mistakes to Avoid

1. **Zones too far apart** - If it takes 10+ minutes to walk, crews get separated
2. **Ignoring terrain** - Hills, highways, water create barriers
3. **No escape routes** - Every zone needs 2+ exit paths
4. **Too many zones** - Start with 10-15, expand based on usage
5. **Not testing IRL** - Walk times on maps ≠ reality with crowds

### Dynamic Expansion

The system supports adding zones on-the-fly:

```javascript
// When crowds gather somewhere new
await createDynamicZone({
  name: "Washington Square Overflow",
  lat: 41.8799,
  lng: -87.6347,
  crowdSize: 200
});
```

This automatically creates walking connections to all zones within 400m.

### Launch Strategy

1. **Soft launch** with 5-10 core zones
2. **Test** with small group (50-100 people)
3. **Expand** based on actual usage patterns
4. **Document** what works for your city

Remember: The tool is only as good as your zone network. Time spent mapping walking routes before launch will pay off during actual protests.