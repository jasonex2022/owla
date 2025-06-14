#!/usr/bin/env node

/**
 * OVERWHELM - Setup Script
 * Helps users quickly set up their own instance
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

console.log(`
╔═══════════════════════════════════════╗
║          OVERWHELM SETUP              ║
║  Pop-up Protest Coordination Tool     ║
╚═══════════════════════════════════════╝
`);

async function setup() {
  try {
    // Check if .env.local already exists
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
      const overwrite = await question('\n⚠️  .env.local already exists. Overwrite? (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Setup cancelled.');
        process.exit(0);
      }
    }

    console.log('\n📍 CITY CONFIGURATION\n');
    
    const cityName = await question('City name (e.g., Los Angeles): ') || 'Los Angeles';
    const cityShort = await question('City abbreviation (e.g., LA): ') || 'LA';
    const cityLat = await question('City center latitude (e.g., 34.0522): ') || '34.0522';
    const cityLng = await question('City center longitude (e.g., -118.2437): ') || '-118.2437';

    console.log('\n🔐 SUPABASE CONFIGURATION');
    console.log('Create a free account at https://supabase.com\n');
    
    const supabaseUrl = await question('Supabase URL: ');
    const supabaseAnonKey = await question('Supabase Anon Key: ');
    const supabaseServiceKey = await question('Supabase Service Role Key: ');

    console.log('\n📰 OPTIONAL: NEWS API');
    console.log('Get a free key at https://newsapi.org (or press Enter to skip)\n');
    
    const newsApiKey = await question('NewsAPI Key (optional): ') || '';

    // Generate secure random secrets
    const cronSecret = crypto.randomBytes(32).toString('hex');

    // Create .env.local file
    const envContent = `# OVERWHELM ${cityShort.toUpperCase()} - Environment Variables
# Generated on ${new Date().toISOString()}

# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey}
SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceKey}

# City Configuration
NEXT_PUBLIC_CITY_NAME=${cityName}
NEXT_PUBLIC_CITY_SHORT=${cityShort}
NEXT_PUBLIC_CITY_CENTER_LAT=${cityLat}
NEXT_PUBLIC_CITY_CENTER_LNG=${cityLng}

# Data Sources
NEWS_API_KEY=${newsApiKey}

# Security
CRON_SECRET=${cronSecret}

# Feature Flags
NEXT_PUBLIC_ENABLE_POLICE_TRACKING=true
NEXT_PUBLIC_MAX_CREWS=20
NEXT_PUBLIC_MAX_CREW_SIZE=200
`;

    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Created .env.local');

    // Show next steps
    console.log(`
╔═══════════════════════════════════════╗
║           SETUP COMPLETE!             ║
╚═══════════════════════════════════════╝

Next steps:

1. Set up your Supabase database:
   - Go to your Supabase dashboard
   - Open SQL Editor
   - Copy and run the contents of database/schema.sql

2. Test locally:
   npm run dev

3. Deploy to Vercel:
   vercel

4. After deployment:
   - Go to Vercel dashboard
   - Add all environment variables from .env.local
   - Redeploy

Your Overwhelm ${cityShort.toUpperCase()} instance is ready!

Remember: The revolution doesn't need permission.
`);

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

setup();