# Location Security Implementation

## Overview

The app now **strictly enforces** location verification to prevent remote participation and bot flooding. Users MUST be within 2km (configurable) of an active protest zone to join crews.

## Security Flow

### 1. Initial App Load
- `LocationGate` component checks user location
- If denied or too far → Blocked with clear message
- If allowed → Can proceed to main app
- **NO SESSION CACHING** - Must verify every time

### 2. Crew Join Attempt
- User clicks "Join a crew"
- **Fresh location check** (no cached positions)
- Coordinates sent to API
- **Server-side verification** against zone database
- Only assigns crew if within radius

### 3. No Bypasses
- ❌ No secret clicks
- ❌ No fallback crews
- ❌ No "demo mode"
- ❌ No session storage bypass
- ❌ No error → allowed

## User Experience

### ✅ Valid User (at protest)
1. Opens app → Location prompt
2. Allows location → Sees main screen
3. Clicks "Join crew" → Brief location check
4. Assigned to nearby crew → "GO TO ZONE A"

### ❌ Remote User (Philadelphia)
1. Opens app → Location prompt
2. Allows location → **BLOCKED**
   - "You're 2,577km from Los Angeles"
   - "This tool is for on-the-ground protesters only"
3. No way to proceed

### ❌ Location Denied
1. Opens app → Location prompt
2. Denies location → **BLOCKED**
   - "Location access required"
   - "Please enable location services and reload"
3. No way to proceed

## Error Messages

```
// Too far from protest
"You're 2,577km from Los Angeles. This tool is for on-the-ground protesters only."

// Not near any zone
"You must be within walking distance (2km) of an active protest zone. Nearest zone is 15km away."

// Location denied
"Location access required. Please enable location services and reload."

// API rejection
"You must be within walking distance of an active protest zone"
```

## Configuration

In `.env.local`:
```env
NEXT_PUBLIC_WALKING_RADIUS_KM=2  # Maximum distance to join
NEXT_PUBLIC_CITY_RADIUS_KM=50    # City boundary check
```

## Testing

### Test from Remote Location
1. Use browser dev tools → Sensors → Location
2. Set to NYC: 40.7128, -74.0060
3. Try to join crew → Should be blocked

### Test Valid Location
1. Set to LA City Hall: 34.0537, -118.2427
2. Try to join crew → Should work

### Test Edge Cases
- Deny location → Blocked
- Allow then move away → Can't join new crews
- VPN doesn't help (uses GPS, not IP)

## Security Guarantees

1. **Every crew member is physically present**
2. **No remote participation possible**
3. **No bot flooding from other cities**
4. **Real-time verification** (no stale checks)
5. **Server + client validation** (double check)

## Privacy Notes

- Location is **never stored** in database
- Only used for zone assignment
- Coordinates sent to API are **not logged**
- System only knows crew-level counts

## For Developers

Key files:
- `/lib/services/geofence.ts` - Core verification
- `/components/LocationGate.tsx` - UI gate
- `/components/CrewAssignment.tsx` - Join verification  
- `/app/api/crew/route.ts` - Server validation

Always test with real GPS, not just localhost!