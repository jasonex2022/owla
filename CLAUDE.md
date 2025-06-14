# CLAUDE.md - AI Assistant Guide for Overwhelm Codebase

This guide helps AI assistants understand and work with the Overwhelm protest coordination tool effectively.

## Project Overview

Overwhelm is a **privacy-first, stateless protest coordination tool** that assigns people to crews and rotates them through city zones every 30 minutes. Key principles:

- **No personal data storage** - Never store user info, IPs, or movement history
- **Location verification** - Users must be within walking distance of active protest
- **Anchor crew strategy** - Crew 1 stays at main location (City Hall) to maintain critical mass
- **Organic activation** - New crews can form at any empty zone
- **Transparency by design** - All crew locations are public

## Architecture

```
overwhelmCity/
├── app/                    # Next.js 14 App Router
│   ├── api/               # API endpoints
│   │   ├── crew/          # Crew assignment logic
│   │   ├── zones/         # Zone data and stats
│   │   └── cron/          # Scheduled rotation
│   └── page.tsx           # Main UI component
├── components/            # React components
│   ├── CrewAssignment.tsx # Core assignment UI
│   └── LocationGate.tsx   # Location verification
├── lib/                   
│   ├── services/          # Business logic
│   │   ├── anchor-aware-crews.ts  # CRITICAL: Anchor strategy
│   │   └── rotation.ts    # Zone rotation logic
│   └── supabase/          # Database client
└── database/              
    └── schema.sql         # Complete DB schema
```

## Critical Files to Understand

### 1. `lib/services/anchor-aware-crews.ts`
**Purpose**: Implements the anchor crew strategy
- Crew 1 is the invisible "anchor" at City Hall
- Routes first 500 people to anchor for critical mass
- Then 50% until 1000 people
- Never shows Crew 1 in UI (appears as Crew 2-20)

### 2. `app/api/crew/route.ts`
**Purpose**: API endpoint for crew assignment
- Requires valid coordinates
- Verifies user is within walking distance
- Calls anchor-aware assignment logic
- Returns crew assignment with zone

### 3. `components/CrewAssignment.tsx`
**Purpose**: Main UI for joining and viewing assignment
- Shows current zone with Google Maps link
- Displays countdown timer
- Auto-refreshes when timer hits zero
- Stores assignment in localStorage (2 hour expiry)

### 4. `database/schema.sql`
**Purpose**: Complete database structure
- `zones` table with intersection names
- `crew_zones` for assignments (crew-level only)
- `find_nearby_zones` function for location queries
- Row Level Security for read-only public access

## Key Concepts

### Anchor Crew Pattern
```typescript
// In anchor-aware-crews.ts
if (anchorSize < 500) {
  return true; // Send to anchor
} else if (anchorSize < 1000) {
  return Math.random() < 0.5; // 50% chance
}
```

### Location Verification
- Browser geolocation API only
- Must be within `NEXT_PUBLIC_WALKING_RADIUS_KM` (default 4.8km/3mi)
- No location data sent to server, only verified zones

### Zone Data Structure
```sql
-- Intersection-based naming for clarity
('Spring St & 1st St (City Hall South Lawn)', 34.0537, -118.2427, 'primary'),
('S Hill St & W 5th St (Pershing Square)', 34.0481, -118.2506, 'primary'),
```

### Crew Assignment Flow
1. User clicks "Join a crew"
2. Browser requests location
3. Find nearby zones via Supabase RPC
4. Assign to crew based on anchor strategy
5. Store in localStorage with timestamp
6. Show zone assignment with map link

## Common Tasks

### Adding a New Zone
```sql
INSERT INTO zones (name, center_lat, center_lng, type) VALUES
('Broadway & 3rd St (New Location)', 34.0507, -118.2488, 'secondary');
```

### Changing Rotation Interval
1. Update `vercel.json` cron schedule
2. Update `calculateNextRotation()` in `app/api/crew/route.ts`
3. Update interval in `CrewAssignment.tsx`

### Adjusting Walking Radius
```env
NEXT_PUBLIC_WALKING_RADIUS_KM=2.4  # 1.5 miles
```

### Emergency Zone Deactivation
```sql
UPDATE zones SET active = false WHERE id = 5;
```

## Security Considerations

- **Never add user tracking** - No analytics, no user IDs
- **Avoid storing coordinates** - Only zone assignments
- **No auth required** - Stateless design is intentional
- **Transparent by design** - Police can see everything, it doesn't matter

## Testing Approach

### Location Testing
```typescript
// Mock coordinates for testing
const testCoords = {
  lat: 34.0537,  // City Hall
  lng: -118.2427
};
```

### Crew Assignment Testing
- Use browser dev tools to override geolocation
- Test both inside and outside walking radius
- Verify anchor crew routing logic

### Database Testing
```sql
-- Check crew distribution
SELECT z.name, COUNT(c.crew_id) as crews, SUM(c.estimated_size) as people
FROM zones z
LEFT JOIN current_crews c ON c.zone_id = z.id
GROUP BY z.id, z.name;
```

## Common Issues

### "No nearby zones found"
- User too far from any active zone
- Increase `NEXT_PUBLIC_WALKING_RADIUS_KM`
- Add more zones in spread out areas

### Crew not rotating
- Check Vercel cron logs
- Verify `CRON_SECRET` is set
- Manual trigger: `POST /api/cron/rotate`

### TypeScript errors
- Run `npm run build` to check
- Most are implicit 'any' types
- Add proper type annotations

## Best Practices

1. **Keep it simple** - Complexity reduces reliability
2. **Privacy first** - When in doubt, store less data
3. **Test locally** - Use `npm run dev` before deploying
4. **Clear zone names** - Use intersections, not vague areas
5. **Document changes** - Update this file when adding features

## Deployment Checklist

- [ ] Updated zone data for city
- [ ] Set all environment variables
- [ ] Tested location verification
- [ ] Verified crew assignment works
- [ ] Checked rotation timer
- [ ] Updated city name in UI
- [ ] Removed any test data

## Philosophy

This tool exists to enable peaceful protest coordination at scale. It's intentionally simple, transparent, and privacy-preserving. The goal is not to hide from authorities but to organize effectively despite their presence.

When modifying:
- Maintain stateless design
- Preserve privacy guarantees
- Keep UI simple and mobile-friendly
- Ensure 10,000+ people can use simultaneously

Remember: **The revolution will be distributed.**