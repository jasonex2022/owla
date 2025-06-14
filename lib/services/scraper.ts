/**
 * Data collection service
 * Monitors police activity from news and social sources
 */

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
}

interface PoliceEvent {
  location: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: 'news' | 'citizen' | 'social';
  timestamp: Date;
}

// Keywords that indicate police activity
const POLICE_KEYWORDS = [
  'police', 'lapd', 'sheriff', 'officer',
  'arrest', 'detained', 'custody', 'handcuff',
  'kettle', 'kettling', 'surrounded', 'trapped',
  'tear gas', 'rubber bullet', 'baton', 'disperse',
  'riot', 'swat', 'tactical', 'unit'
];

// Keywords that indicate high severity
const HIGH_SEVERITY_KEYWORDS = [
  'kettle', 'kettling', 'mass arrest', 'surrounded',
  'tear gas', 'rubber bullet', 'injured', 'hospitalized',
  'swat', 'tactical unit', 'riot squad'
];

/**
 * Fetch news about protests and police activity
 */
export async function fetchNewsData(
  apiKey: string,
  cityName: string
): Promise<PoliceEvent[]> {
  if (!apiKey) {
    console.warn('No NewsAPI key provided, skipping news collection');
    return [];
  }
  
  try {
    const query = `protest OR police OR demonstration "${cityName}"`;
    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.append('q', query);
    url.searchParams.append('sortBy', 'publishedAt');
    url.searchParams.append('pageSize', '50');
    url.searchParams.append('apiKey', apiKey);
    
    // Only get articles from last 2 hours
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    url.searchParams.append('from', twoHoursAgo.toISOString());
    
    const response = await fetch(url.toString());
    const data = await response.json();
    
    if (data.status !== 'ok') {
      console.error('NewsAPI error:', data.message);
      return [];
    }
    
    // Extract police events from articles
    const events: PoliceEvent[] = [];
    
    for (const article of data.articles || []) {
      const fullText = `${article.title} ${article.description}`.toLowerCase();
      
      // Check if article mentions police activity
      const mentionsPolice = POLICE_KEYWORDS.some(keyword => 
        fullText.includes(keyword)
      );
      
      if (mentionsPolice) {
        const severity = determineSeverity(fullText);
        const location = extractLocation(fullText, cityName);
        
        events.push({
          location,
          description: article.title,
          severity,
          source: 'news',
          timestamp: new Date(article.publishedAt)
        });
      }
    }
    
    return events;
    
  } catch (error) {
    console.error('News fetch error:', error);
    return [];
  }
}

/**
 * Mock Citizen app data collection
 * In production, this would scrape or use an API
 */
export async function fetchCitizenData(cityName: string): Promise<PoliceEvent[]> {
  // This is a placeholder for the actual Citizen app integration
  // In reality, you'd need to implement web scraping or find an API
  
  console.log('Citizen app integration not implemented - using mock data');
  
  // Return some realistic mock events for testing
  const mockEvents: PoliceEvent[] = [
    {
      location: 'Downtown',
      description: 'Large police presence reported near City Hall',
      severity: 'medium',
      source: 'citizen',
      timestamp: new Date()
    }
  ];
  
  // Only return mock events 20% of the time to simulate real variability
  return Math.random() < 0.2 ? mockEvents : [];
}

/**
 * Determine severity level from text content
 */
function determineSeverity(text: string): PoliceEvent['severity'] {
  const lowerText = text.toLowerCase();
  
  // Check for critical keywords
  if (HIGH_SEVERITY_KEYWORDS.some(keyword => lowerText.includes(keyword))) {
    return 'critical';
  }
  
  // Count police-related keyword mentions
  const policeCount = POLICE_KEYWORDS.filter(keyword => 
    lowerText.includes(keyword)
  ).length;
  
  if (policeCount >= 4) return 'high';
  if (policeCount >= 2) return 'medium';
  return 'low';
}

/**
 * Extract location from text (basic implementation)
 */
function extractLocation(text: string, cityName: string): string {
  const lowerText = text.toLowerCase();
  
  // Common LA locations
  const locations = [
    'downtown', 'hollywood', 'venice', 'westwood', 'santa monica',
    'beverly hills', 'echo park', 'silver lake', 'koreatown',
    'city hall', 'pershing square', 'macarthur park', 'griffith park'
  ];
  
  for (const location of locations) {
    if (lowerText.includes(location)) {
      return location.split(' ').map(w => 
        w.charAt(0).toUpperCase() + w.slice(1)
      ).join(' ');
    }
  }
  
  return 'Unknown';
}

/**
 * Map location names to zone IDs
 */
export function mapLocationToZone(location: string, zones: any[]): string | null {
  const lowerLocation = location.toLowerCase();
  
  for (const zone of zones) {
    if (zone.name.toLowerCase().includes(lowerLocation) ||
        lowerLocation.includes(zone.name.toLowerCase())) {
      return zone.id;
    }
  }
  
  return null;
}

/**
 * Aggregate police events by zone
 */
export function aggregateEventsByZone(
  events: PoliceEvent[],
  zones: any[]
): Map<string, { severity: string; count: number }> {
  const zoneActivity = new Map<string, { severity: string; count: number }>();
  
  for (const event of events) {
    const zoneId = mapLocationToZone(event.location, zones);
    if (!zoneId) continue;
    
    const current = zoneActivity.get(zoneId);
    if (!current || compareSeverity(event.severity, current.severity) > 0) {
      zoneActivity.set(zoneId, {
        severity: event.severity,
        count: (current?.count || 0) + 1
      });
    } else {
      current.count++;
    }
  }
  
  return zoneActivity;
}

/**
 * Compare severity levels
 */
function compareSeverity(a: string, b: string): number {
  const levels = { low: 1, medium: 2, high: 3, critical: 4 };
  return (levels[a as keyof typeof levels] || 0) - 
         (levels[b as keyof typeof levels] || 0);
}

/**
 * Main collection function - called by cron job
 */
export async function collectPoliceActivity(
  supabase: any,
  newsApiKey: string,
  cityName: string,
  zones: any[]
): Promise<{ success: boolean; eventsFound: number }> {
  try {
    // Collect from all sources
    const [newsEvents, citizenEvents] = await Promise.all([
      fetchNewsData(newsApiKey, cityName),
      fetchCitizenData(cityName)
    ]);
    
    const allEvents = [...newsEvents, ...citizenEvents];
    
    if (allEvents.length === 0) {
      return { success: true, eventsFound: 0 };
    }
    
    // Aggregate by zone
    const zoneActivity = aggregateEventsByZone(allEvents, zones);
    
    // Insert into database
    const inserts = Array.from(zoneActivity.entries()).map(([zoneId, activity]) => ({
      zone_id: zoneId,
      severity: activity.severity,
      description: `${activity.count} police activity reports`,
      source: 'aggregated'
    }));
    
    if (inserts.length > 0) {
      const { error } = await supabase
        .from('police_activity')
        .insert(inserts);
      
      if (error) {
        console.error('Database insert error:', error);
        return { success: false, eventsFound: 0 };
      }
    }
    
    return { success: true, eventsFound: allEvents.length };
    
  } catch (error) {
    console.error('Collection error:', error);
    return { success: false, eventsFound: 0 };
  }
}