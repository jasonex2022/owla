# Database Deployment Guide

This folder contains the complete database schema for the Overwhelm protest coordination tool.

## Files

- `schema.sql` - Complete database schema including tables, views, functions, and initial data
- `find-nearby-zones-fixed.sql` - Standalone function for location-based zone finding (already included in schema.sql)
- `update-zones-with-intersections.sql` - Zone updates with intersection names (already included in schema.sql)

## Deployment Steps

### 1. Create Supabase Project

1. Go to [Supabase](https://supabase.com) and create a new project
2. Save your project URL and anon key

### 2. Run Schema

In the Supabase SQL editor, run the entire contents of `schema.sql`. This will:

- Create all tables (zones, crew_zones, movement_stats, police_activity)
- Set up views (current_crews)
- Create functions (find_nearby_zones, get_crew_stats, etc.)
- Insert initial zone data with intersection names for LA
- Configure Row Level Security (RLS) policies
- Set up proper permissions for anon users

### 3. Verify Installation

Run these queries to verify everything is set up:

```sql
-- Check zones are loaded
SELECT id, name, type FROM zones ORDER BY id;

-- Test the find_nearby_zones function (City Hall coordinates)
SELECT * FROM find_nearby_zones(34.0537, -118.2427, 5000);

-- Check current crews view
SELECT * FROM current_crews;
```

### 4. Environment Variables

Add these to your `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_CITY_NAME=Los Angeles
NEXT_PUBLIC_WALKING_RADIUS_KM=4.8
```

### 5. Enable Realtime

In Supabase dashboard:
1. Go to Database → Replication
2. Enable replication for tables: crew_zones, movement_stats, police_activity

### 6. Set Up Cron Jobs (Optional)

For automatic crew rotation every 30 minutes:

```sql
-- Example using pg_cron (if available)
SELECT cron.schedule(
  'rotate-crews',
  '*/30 * * * *',
  $$
    SELECT rotate_crews(
      jsonb_build_array(
        jsonb_build_object('crew_id', 2, 'zone_id', 3, 'estimated_size', 50)
        -- Add more crew rotations as needed
      )
    );
  $$
);
```

## Zone Configuration

The schema includes 15 zones for Los Angeles with specific intersection names:

1. **Anchor Zone** - Spring St & 1st St (City Hall South Lawn)
2. **Primary Zones** - LAPD HQ, Pershing Square, Grand Park, Federal Building
3. **Secondary Zones** - Union Station, Little Tokyo, Arts District, MacArthur Park, Echo Park, USC, UCLA, Venice Beach, Hollywood, Griffith

Each zone has:
- Precise coordinates for the intersection
- Descriptive name with landmark in parentheses
- Type designation (primary/secondary)
- Active status

## Security Notes

- No personal data is stored
- Only crew-level aggregates
- All data auto-expires after 24 hours
- Read-only access for public users
- Write access only via service role

## Customization

To adapt for other cities:

1. Update zone data in schema.sql with local intersections
2. Change `NEXT_PUBLIC_CITY_NAME` in environment
3. Adjust `NEXT_PUBLIC_WALKING_RADIUS_KM` based on city density
4. Update zone types based on local protest patterns

## Troubleshooting

**"function find_nearby_zones does not exist"**
- Ensure you ran the complete schema.sql file
- Check function was created: `\df find_nearby_zones`

**"permission denied for function"**
- Verify GRANT statements were executed
- Check user has anon role

**Zones not showing up**
- Verify zones table has data: `SELECT COUNT(*) FROM zones;`
- Check zones are active: `SELECT * FROM zones WHERE active = true;`

**Real-time updates not working**
- Enable replication in Supabase dashboard
- Check WebSocket connection in browser console