# Launch Overwhelm in Your City - Complete Guide

This guide will walk you through launching Overwhelm for your city in under 30 minutes.

## Prerequisites

- GitHub account
- Vercel account (free)
- Supabase account (free)
- Basic command line knowledge

## Step 1: Fork and Clone (5 minutes)

1. **Fork the repository**
   - Go to https://github.com/jasonex2022/owla
   - Click "Fork" in the top right
   - Name it something like `overwhelm-chicago` or `overwhelm-nyc`

2. **Clone your fork locally**
   ```bash
   git clone https://github.com/YOUR_USERNAME/overwhelm-YOURCITY.git
   cd overwhelm-YOURCITY
   npm install
   ```

## Step 2: Set Up Supabase (10 minutes)

1. **Create a new Supabase project**
   - Go to https://supabase.com
   - Click "New Project"
   - Name it (e.g., "overwhelm-chicago")
   - Choose a region close to your city
   - Generate a strong database password (save it!)

2. **Run the database schema**
   - In Supabase dashboard, go to SQL Editor
   - Click "New Query"
   - Copy everything from `database/schema.sql`
   - Paste and click "Run"
   - You should see "Success" messages

3. **Get your API keys**
   - Go to Settings → API
   - Copy these values:
     - Project URL (looks like `https://xxxxx.supabase.co`)
     - Anon/Public key (starts with `eyJ...`)
     - Service Role key (starts with `eyJ...`) - KEEP SECRET!

## Step 3: Customize for Your City (10 minutes)

1. **Update zone data in `database/schema.sql`**
   
   Find the section that starts with:
   ```sql
   -- Initial zones for Los Angeles with intersection-based names
   ```
   
   Replace with your city's protest locations. Use this format:
   ```sql
   INSERT INTO zones (name, center_lat, center_lng, type) VALUES
   -- Primary protest zones (most important locations)
   ('Main St & 1st Ave (City Hall)', 41.8781, -87.6298, 'primary'),
   ('State St & Madison St (Federal Plaza)', 41.8803, -87.6290, 'primary'),
   ('Michigan Ave & Congress Pkwy (Grant Park)', 41.8756, -87.6244, 'primary'),
   
   -- Secondary zones (supporting locations)
   ('Halsted St & North Ave (Near North)', 41.9103, -87.6481, 'secondary'),
   ('Milwaukee Ave & Division St (Wicker Park)', 41.9033, -87.6769, 'secondary');
   ```

   **How to find coordinates:**
   - Go to Google Maps
   - Right-click on the intersection
   - Click "What's here?"
   - Copy the coordinates (lat, lng)

2. **Update environment variables**
   
   Create `.env.local`:
   ```env
   # Your Supabase credentials
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # Your city configuration
   NEXT_PUBLIC_CITY_NAME=Chicago
   NEXT_PUBLIC_CITY_SHORT=CHI
   NEXT_PUBLIC_CITY_CENTER_LAT=41.8781
   NEXT_PUBLIC_CITY_CENTER_LNG=-87.6298
   NEXT_PUBLIC_CITY_RADIUS_KM=40
   NEXT_PUBLIC_WALKING_RADIUS_KM=3.2  # 2 miles

   # Security
   CRON_SECRET=generate-random-string-here
   ```

3. **Update the README.md**
   - Change "Los Angeles" to your city name
   - Update the domain if you have one
   - Add local emergency numbers
   - Include local ACLU/legal support links

## Step 4: Test Locally (5 minutes)

1. **Run the updated schema in Supabase**
   - Go back to SQL Editor
   - Delete existing zone data:
     ```sql
     DELETE FROM zones;
     ```
   - Run your updated zone INSERT statements

2. **Start the development server**
   ```bash
   npm run dev
   ```
   - Open http://localhost:3000
   - You should see your city name
   - Try the location check (must be near one of your zones)

## Step 5: Deploy to Vercel (5 minutes)

1. **Commit your changes**
   ```bash
   git add .
   git commit -m "Configure for [Your City]"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to https://vercel.com/new
   - Click "Import Git Repository"
   - Select your forked repo
   - Click "Import"

3. **Add environment variables**
   - Before clicking "Deploy", click "Environment Variables"
   - Add each variable from your `.env.local` file
   - Make sure to add ALL of them

4. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes
   - Your app will be live at `your-project.vercel.app`

## Step 6: Configure Domain (Optional)

1. **In Vercel dashboard**
   - Go to your project
   - Click "Settings" → "Domains"
   - Add your domain (e.g., `chicago.overwhelm.city`)

2. **Update DNS**
   - Add CNAME record pointing to `cname.vercel-dns.com`
   - Or use Vercel's nameservers

## Step 7: Final Testing

1. **Test the live site**
   - Visit your deployed URL
   - Enable location services
   - Verify you can only join when near a zone
   - Test crew assignment
   - Check that zones show your city's locations

2. **Test cron rotation**
   - Crews should rotate every 30 minutes
   - Check Vercel Functions logs to verify

## Troubleshooting

### "No zones found" error
- Check that your coordinates are correct
- Verify zones are marked as `active = true` in database
- Ensure radius is large enough

### Location verification fails
- Make sure you're within walking distance of a zone
- Check browser location permissions
- Try on mobile device for better GPS

### Database connection errors
- Verify Supabase URL and keys are correct
- Check that Row Level Security is enabled
- Ensure schema was run successfully

## Maintenance

- **Monitor usage**: Check Supabase dashboard for active crews
- **Update zones**: Run SQL updates as protest locations change
- **Emergency shutdown**: Set all zones to `active = false`

## Security Notes

- Never commit `.env.local` to git
- Regenerate API keys if exposed
- The app stores NO personal data
- All data auto-deletes after 24 hours

## Need Help?

- Open an issue on GitHub
- The system is designed to be resilient
- When in doubt, keep it simple

Remember: The goal is coordination at scale, not perfection. Get it running, then improve.

---

**The revolution will be distributed. Every city running their own instance makes us unstoppable.**