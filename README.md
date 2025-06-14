# OVERWHELM - Pop-up Protest Coordination Tool

**Join a crew. Move together. Overwhelm the system.**

A stateless, anonymous protest coordination tool that assigns people to crews and moves them through city zones every 30 minutes. No logins, no tracking, no user data stored.

**Location-aware**: Assigns crews based on your actual location at the protest
**Multi-city ready**: Deploy at overwhelm.city/la, overwhelm.city/nyc, etc.

## What This Is

OVERWHELM is a web-based tool that:
- Assigns protesters to crews of 150-200 people
- Moves crews between zones every 30 minutes
- Tracks police activity to avoid danger zones
- Works completely anonymously - no accounts needed
- Can be deployed by anyone for any city in 10 minutes

**They can see where we are. They can't stop us all.**

## Quick Deploy (10 Minutes)

### Prerequisites
- Node.js 18+ installed
- Git installed
- Free accounts at:
  - [Vercel](https://vercel.com) (hosting)
  - [Supabase](https://supabase.com) (database)
  - [NewsAPI](https://newsapi.org) (optional, for police tracking)

### 1. Fork & Clone
```bash
git clone https://github.com/overwhelmcity/overwhelm
cd overwhelm/overwhelmCity
npm install
```

### 2. Run Setup
```bash
npm run setup
# Follow the prompts to configure your city
```

### 3. Set Up Database
1. Go to your Supabase project
2. Open SQL Editor
3. Copy and run everything from `database/schema.sql`

### 4. Test Locally
```bash
npm run dev
# Open http://localhost:3000
```

### 5. Deploy
```bash
./deploy.sh
# or manually: vercel --prod
```

### 6. Configure Production
1. Go to Vercel dashboard
2. Add all environment variables from `.env.local`
3. Redeploy

**That's it! Your city now has its own Overwhelm instance.**

## How It Works

### For Protesters
1. Visit the site (e.g., `overwhelm.city/la`)
2. Allow location access (must be within 2km of protest)
3. Click "JOIN THE MOVEMENT"
4. Get assigned to a crew in your nearest zone
5. (Optional) Enable push notifications for movement alerts
6. Every 30 minutes, check for your new zone
7. Move with your crew

### For Organizers
- No backend to manage
- No user data to protect
- Police can see everything - it doesn't matter
- Fork it, deploy it, forget it

### Technical Design
- **Stateless**: Crew assignment based on timestamp, not cookies
- **Anonymous**: No user accounts, emails, or phone numbers
- **Transparent**: All crew locations are public
- **Resilient**: Runs on Vercel edge network
- **Simple**: Under 2000 lines of code
- **Notifications**: Optional browser push alerts (no server storage)
- **Geofenced**: Must be within walking distance (2km) of active protest
- **Location-aware**: Assigns crews based on your actual position
- **Multi-city**: Easy deployment for any city at /citycode

## Multi-City Deployment

### Using the overwhelm.city Domain

The system supports multiple cities on one domain:
- `overwhelm.city/la` - Los Angeles
- `overwhelm.city/nyc` - New York City  
- `overwhelm.city/chi` - Chicago
- etc.

Edit `lib/config/cities.ts` to add your city.

## Customizing for Your City

### 1. Update City Config
Edit `.env.local`:
```env
NEXT_PUBLIC_CITY_NAME=Chicago
NEXT_PUBLIC_CITY_SHORT=CHI
NEXT_PUBLIC_CITY_CENTER_LAT=41.8781
NEXT_PUBLIC_CITY_CENTER_LNG=-87.6298
NEXT_PUBLIC_CITY_RADIUS_KM=50  # City-wide radius in km
NEXT_PUBLIC_WALKING_RADIUS_KM=2  # Must be this close to join
```

### 2. Define Your Zones
Edit `lib/config/zones.ts`:
```typescript
export const PRIMARY_ZONES = [
  'Downtown',
  'Loop',
  'Grant Park',
  // etc
];
```

### 3. Add GeoJSON (Optional)
Add your city's neighborhood boundaries:
```bash
# Download from: https://github.com/codeforgermany/click_that_hood
wget https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/chicago.geojson
mv chicago.geojson public/data/
```

### 4. Customize Styling
Edit `app/globals.css` for your protest aesthetic

## Architecture

```
overwhelmCity/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── crew/          # Crew assignment
│   │   ├── zones/         # Zone data
│   │   └── cron/          # Scheduled rotation
│   ├── page.tsx           # Main UI
│   └── globals.css        # Protest styling
├── components/            # React components
├── lib/                   # Core logic
│   ├── services/          # Business logic
│   │   ├── crews.ts       # Crew assignment
│   │   ├── rotation.ts    # Zone rotation
│   │   └── scraper.ts     # Police tracking
│   └── config/            # Configuration
├── database/              # SQL schema
└── tests/                 # Test suite
```

## API Endpoints

### `GET /api/crew`
Get crew assignment for current user
```json
{
  "crew": {
    "crewId": 6,
    "crewName": "Crew Phoenix",
    "estimatedSize": 187,
    "zoneId": "downtown",
    "zoneName": "Downtown",
    "nextRotation": "2024-01-01T18:30:00Z"
  }
}
```

### `GET /api/zones`
Get all zones and active crews (public data)
```json
{
  "zones": [...],
  "stats": {
    "totalCrews": 15,
    "totalProtesters": 2341,
    "activeZones": 12
  }
}
```

## Security & Privacy

### What We Don't Store
- No IP addresses
- No device IDs
- No cookies
- No user accounts
- No movement history
- No personal data
- No push notification endpoints (stored in browser only)
- No location data (checked in browser only)

### What We Do Store
- Current crew → zone mappings
- Aggregate protester counts
- Police activity reports
- Nothing personally identifiable

### Transparency by Design
- Police can see all crew locations
- It doesn't matter - we're ungovernable at scale
- The point is distributed coordination, not secrecy

## Testing

```bash
# Run tests
npm test

# Test coverage
npm run test:coverage

# Manual rotation test
curl -X POST http://localhost:3000/api/cron/rotate \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Performance

- Handles 10,000+ concurrent users on free tier
- 30-second auto-refresh prevents server overload  
- Edge functions scale automatically
- No central server to DDoS

## Contributing

1. Fork the repo
2. Create your feature branch
3. Keep it simple - less code is better
4. Test your changes
5. Submit a PR

**Remember: This tool saves lives. Test everything.**

## Troubleshooting

### Crews not rotating?
- Check Vercel cron logs
- Verify CRON_SECRET is set
- Manually trigger: `POST /api/cron/rotate`

### No police data?
- NewsAPI key may be invalid
- Citizen scraping not implemented (PRs welcome!)
- Check `/api/cron/rotate` logs

### Database errors?
- Verify Supabase credentials
- Check Row Level Security policies
- Run schema.sql again

## Fork for Your City

The revolution doesn't need permission. Fork this repo and deploy for your city:

1. Fork on GitHub
2. Clone locally
3. Run `npm run setup`
4. Deploy to Vercel
5. Share with organizers

**Every city running their own instance makes the movement unstoppable.**

## Location-Based Features

### Tight Geofencing
- Must be within 2km (25 min walk) of active protest
- Prevents remote sign-ups or trolling
- Ensures only real protesters on the ground

### Smart Crew Assignment  
- Detects your nearest protest zone
- Assigns you to a crew already in that area
- Keeps crews geographically coherent

### Privacy Preserved
- Location check happens in browser only
- No coordinates sent to server
- No tracking or storage of positions

## Support

- Open an issue on GitHub
- No commercial support
- Built by the people, for the people

## License

MIT - Do whatever you want with this code.

---

**The revolution will be distributed.**

Built with rage and hope by activists who refuse to be kettled.

Fork it. Deploy it. Overwhelm them.