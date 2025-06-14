# Anchor Crew Strategy (INTERNAL ONLY)

## Overview

The system invisibly maintains one "anchor crew" at strategic locations (City Hall, Federal Building, etc.) to maximize media visibility and message clarity. This crew:
- Stays in place during rotations
- Receives priority reinforcements
- Gets protected by surrounding movement

**CRITICAL: This is never visible to users. No crew knows they're the anchor.**

## How It Works

### 1. Anchor Selection (Every 10 minutes)
The algorithm identifies the anchor based on:
- **Size**: 200-400 people (optimal for media)
- **Location**: Primary zones only (City Hall, Federal Building, Grand Park)
- **Stability**: Crews that have been in place longer

### 2. Assignment Logic
New participants are assigned based on:
- **Every 3rd person** → Goes to anchor (predictable flow)
- **Anchor < 200 people** → 60% go to anchor (build critical mass)
- **Anchor 200-300** → 40% go to anchor (maintain)
- **Anchor > 500** → 10% go to anchor (prevent overcrowding)
- **Geographic proximity** → If within 500m of anchor, higher chance

### 3. Rotation Protection
During 30-minute rotations:
- **Anchor NEVER moves** (unless police danger)
- **40-60% of other crews rotate** around them
- Creates protective "swarm" movement
- If anchor zone becomes dangerous, it relocates to nearest safe primary zone

### 4. Invisible Implementation

```javascript
// User sees this:
"Join a crew" → "GO TO ZONE A"

// System does this invisibly:
if (shouldJoinAnchor()) {
  return anchorCrew; // But user never knows
} else {
  return supportCrew;
}
```

## Strategic Benefits

1. **Media Focus**: Journalists know where to find the main crowd
2. **Message Clarity**: Speakers/signs concentrated in one location
3. **Safety**: Surrounding movement protects anchor from kettling
4. **Flexibility**: System adapts if anchor gets too big/small
5. **Deniability**: No single point of failure if discovered

## Scaling for Large Protests

For 250k person protests (like "No Kings"):

### Phase 1: Build Anchor (0-2 hours)
- First 10k people: 60% go to City Hall
- Creates unmissable media presence
- Support crews fill surrounding zones

### Phase 2: Maintain (2-6 hours) 
- Anchor stabilizes at 50k
- New arrivals distributed to:
  - 30% anchor reinforcement
  - 70% tactical pressure points

### Phase 3: Sustain (6+ hours)
- Anchor crew rotates internally (people leave/arrive)
- But location stays constant
- Support crews maintain movement

## Security Considerations

1. **No UI indication** of anchor status
2. **No database flag** marking anchor
3. **Algorithm-only** decision making
4. **Changes every 10 minutes** if needed
5. **Falls back gracefully** if pattern detected

## Testing the System

Monitor these metrics (internally only):
- Largest crew size over time
- Media coverage concentration
- Police response patterns
- Natural crowd flow

## Code Locations

- `/lib/services/anchor-aware-crews.ts` - Assignment logic
- `/lib/services/rotation.ts` - Rotation protection
- `/app/api/crew/route.ts` - API integration

Remember: The beauty of this system is that it emerges naturally from the algorithm. Even if someone reads this code, they can't identify the current anchor without real-time access to all crew sizes and positions.